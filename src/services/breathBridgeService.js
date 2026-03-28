// ============================================================
// Breath Bridge Service — Phase 2
// File: src/services/breathBridgeService.js
//
// Parent → child presence channel. Haiku-composed warmth
// messages rooted in parent's breath effort.
//
// Safety rails:
// - Disclosure hold gate (reused from facilitatedMessaging.js)
// - Dual consent required (parent + guardian)
// - Weekly message cap
// - Clinician pause control
// - Content validation (no child engagement, no obligation)
// ============================================================

'use strict';

const Sentry = require('../instrument');
const { Pool } = require('pg');
const { checkDisclosureHold } = require('../abi/facilitatedMessaging');
const { computeAgeBracket } = require('./personaEngine');
const { getLibraryForBracket, applyTemplate } = require('../../scripts/seedBreathBridgeLibrary');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CHILD_BRACKETS = ['elementary', 'middle_school', 'high_school'];

const FORBIDDEN_TERMS = [
  'should', 'must', 'need to', 'have to',
  'coherence', 'rmssd', 'ns3', 'hrv', 'score', 'percentage',
  'therapy', 'treatment', 'diagnosis', 'clinical',
];

// ── ENROLL FAMILY ─────────────────────────────────────────────

async function enrollFamily(familyId, parentId, clinicianId) {
  // Check parent exists
  const parentResult = await pool.query(
    'SELECT id, role FROM users WHERE id = $1',
    [parentId]
  );
  if (!parentResult.rows[0]) {
    return { enrolled: false, error: 'Parent participant not found' };
  }

  // Check family has at least one child member
  const childResult = await pool.query(
    `SELECT fm.user_id, u.date_of_birth
     FROM family_memberships fm
     JOIN users u ON fm.user_id = u.id
     WHERE fm.family_unit_id = $1 AND fm.status = 'active'`,
    [familyId]
  );

  let childCount = 0;
  for (const member of childResult.rows) {
    const bracket = computeAgeBracket(member.date_of_birth);
    if (CHILD_BRACKETS.includes(bracket)) childCount++;
  }

  if (childCount === 0) {
    return { enrolled: false, error: 'Family has no child members with valid age bracket' };
  }

  // Upsert config
  await pool.query(
    `INSERT INTO breath_bridge_config (family_id, active, clinician_id, parent_consent_at)
     VALUES ($1, true, $2, NOW())
     ON CONFLICT (family_id) DO UPDATE SET
       active = true,
       clinician_id = COALESCE($2, breath_bridge_config.clinician_id),
       parent_consent_at = NOW(),
       updated_at = NOW()`,
    [familyId, clinicianId]
  );

  return { enrolled: true, familyId, childCount };
}

// ── SCHEDULE MESSAGES ─────────────────────────────────────────

async function scheduleMessages(familyId) {
  // Load config
  const configResult = await pool.query(
    'SELECT * FROM breath_bridge_config WHERE family_id = $1',
    [familyId]
  );
  const config = configResult.rows[0];
  if (!config) return { scheduled: 0, reason: 'not_enrolled' };
  if (!config.active) return { scheduled: 0, reason: 'inactive' };
  if (config.paused_at) return { scheduled: 0, reason: 'paused' };
  if (!config.parent_consent_at || !config.guardian_consent_at) {
    return { scheduled: 0, reason: 'missing_consent' };
  }

  // Check disclosure hold before wasting a Haiku call
  const members = await pool.query(
    `SELECT fm.user_id, u.date_of_birth, fm.role
     FROM family_memberships fm
     JOIN users u ON fm.user_id = u.id
     WHERE fm.family_unit_id = $1 AND fm.status = 'active'`,
    [familyId]
  );

  let parentId = null;
  let childId = null;
  let childBracket = null;

  for (const m of members.rows) {
    const bracket = computeAgeBracket(m.date_of_birth);
    if (m.role === 'elder' && !parentId) {
      parentId = m.user_id;
    }
    if (CHILD_BRACKETS.includes(bracket) && !childId) {
      childId = m.user_id;
      childBracket = bracket;
    }
  }

  if (!parentId || !childId) {
    return { scheduled: 0, reason: 'missing_parent_or_child' };
  }

  // Check disclosure hold
  const hold = await checkDisclosureHold(parentId, childId, familyId);
  if (hold) {
    return { scheduled: 0, reason: 'disclosure_hold' };
  }

  // Check weekly cap
  const capResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM breath_bridge_messages
     WHERE family_id = $1 AND direction = 'parent_to_child'
       AND delivered_at > NOW() - INTERVAL '7 days'`,
    [familyId]
  );
  const deliveredThisWeek = parseInt(capResult.rows[0].cnt);
  if (deliveredThisWeek >= config.weekly_message_cap) {
    return { scheduled: 0, reason: 'cap_reached' };
  }

  // Also count already-scheduled messages this week
  const scheduledResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM breath_bridge_messages
     WHERE family_id = $1 AND direction = 'parent_to_child'
       AND delivery_status IN ('scheduled', 'pending')
       AND scheduled_for > NOW() - INTERVAL '7 days'`,
    [familyId]
  );
  const pendingThisWeek = parseInt(scheduledResult.rows[0].cnt);
  if (deliveredThisWeek + pendingThisWeek >= config.weekly_message_cap) {
    return { scheduled: 0, reason: 'cap_reached' };
  }

  // Find parent's most recent session (decoupled — message sends even if no recent session)
  const sessionResult = await pool.query(
    `SELECT sc.id, sc.completed_at, sc.session_number, sc.active_duration_seconds
     FROM session_completions sc
     JOIN users u ON sc.user_id = u.user_id
     WHERE u.id = $1
     ORDER BY sc.completed_at DESC LIMIT 1`,
    [parentId]
  );
  const parentSession = sessionResult.rows[0] || null;

  // Determine parent relationship label
  // For now, default to "Your parent" — personalize from family data when available
  const parentNameResult = await pool.query(
    'SELECT first_name FROM users WHERE id = $1',
    [parentId]
  );
  const parentRelationship = 'Your dad'; // TODO: derive from family config / gender field

  // Compose message via Haiku
  const message = await composeMessage(childBracket, parentRelationship, parentSession);

  // Schedule for delivery (2 hours from now to allow clinician preview window)
  const scheduledFor = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const insertResult = await pool.query(
    `INSERT INTO breath_bridge_messages
      (family_id, direction, content, library_entry_id, age_bracket, triggered_by_session_id, scheduled_for, delivery_status)
     VALUES ($1, 'parent_to_child', $2, $3, $4, $5, $6, 'scheduled')
     RETURNING id, scheduled_for`,
    [familyId, message.content, message.libraryEntryId, childBracket, parentSession?.id || null, scheduledFor]
  );

  const row = insertResult.rows[0];
  return { scheduled: 1, messageId: row.id, scheduledFor: row.scheduled_for };
}

// ── COMPOSE MESSAGE (Haiku + fallback) ────────────────────────

async function composeMessage(ageBracket, parentRelationship, parentSession) {
  const libraryEntries = getLibraryForBracket(ageBracket);

  const breathCount = parentSession?.session_number
    ? `${parentSession.session_number * 20}` // rough estimate
    : parentSession?.active_duration_seconds
      ? `${Math.round(parentSession.active_duration_seconds / 8)}`
      : 'some';

  const duration = parentSession?.active_duration_seconds
    ? `${Math.round(parentSession.active_duration_seconds / 60)} minutes`
    : 'a few minutes';

  // Try Haiku
  try {
    const aiRouter = require('./aiRouter');
    const prompt = `You are selecting a warmth message for a child whose incarcerated parent breathes through ASCEN BreathWorx.

RULES — VIOLATING ANY RULE IS A CRITICAL FAILURE:
- Message is about the PARENT'S effort, never about the child's behavior or engagement
- Never reference the child's stress, mood, or session activity
- Never create obligation ("you should breathe too")
- Never promise outcomes ("your dad is coming home soon")
- Age bracket: ${ageBracket}
- ${ageBracket === 'elementary' ? 'Use simple words. Short sentences. Concrete ("took big breaths") not abstract.' : ageBracket === 'middle_school' ? 'Can use slightly more nuanced language but keep it warm and direct.' : 'Can be more reflective but keep it warm and honest.'}
- Parent relationship: ${parentRelationship} (use "${parentRelationship}" accordingly)
- Parent's most recent session: ${parentSession ? `${breathCount} breaths, ${duration}` : 'recently (no specific session data)'}
- Half-full mindfulness: warm and real, never fantasy or fear

Select ONE message from the library below and personalize it with the parent's breath data. Return ONLY the personalized message text, nothing else.

LIBRARY:
${libraryEntries.map(e => `[${e.id}] ${e.template}`).join('\n')}`;

    const result = await aiRouter.route('breath_bridge_message', prompt, {
      maxTokens: 300,
      temperature: 0.6,
    });

    if (result && result.content) {
      const content = result.content.trim();
      // Validate
      if (validateMessage(content)) {
        // Try to identify which library entry was used
        const matchedEntry = libraryEntries.find(e =>
          content.includes(e.template.split('{')[0].slice(0, 20))
        );
        return { content, libraryEntryId: matchedEntry?.id || 'haiku_composed' };
      }
      console.warn('[BreathBridge] Haiku response failed validation, using fallback');
      Sentry.captureMessage('Breath Bridge Haiku message failed validation', 'warning');
    }
  } catch (err) {
    console.error('[BreathBridge] Haiku call failed:', err.message);
    Sentry.captureException(err);
  }

  // Fallback: random library entry with string replacement
  const entry = libraryEntries[Math.floor(Math.random() * libraryEntries.length)];
  const content = applyTemplate(entry.template, {
    parent_name: parentRelationship,
    breath_count: breathCount,
    duration,
  });
  return { content, libraryEntryId: entry.id };
}

// ── VALIDATE MESSAGE ──────────────────────────────────────────

function validateMessage(content) {
  if (!content || content.length < 10 || content.length > 200) return false;

  const lower = content.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term)) return false;
  }

  return true;
}

// ── DELIVER MESSAGE ───────────────────────────────────────────

async function deliverMessage(messageId) {
  // Load message
  const msgResult = await pool.query(
    'SELECT * FROM breath_bridge_messages WHERE id = $1',
    [messageId]
  );
  const msg = msgResult.rows[0];
  if (!msg) return { delivered: false, reason: 'not_found' };
  if (msg.delivery_status === 'delivered') return { delivered: false, reason: 'already_delivered' };

  // Load config
  const configResult = await pool.query(
    'SELECT * FROM breath_bridge_config WHERE family_id = $1',
    [msg.family_id]
  );
  const config = configResult.rows[0];
  if (!config) return { delivered: false, reason: 'no_config' };

  // Check config is active and not paused
  if (!config.active || config.paused_at) {
    await pool.query(
      `UPDATE breath_bridge_messages SET delivery_status = 'held', held_reason = 'clinician_paused' WHERE id = $1`,
      [messageId]
    );
    return { delivered: false, reason: 'clinician_paused' };
  }

  // DISCLOSURE HOLD GATE — reuse from facilitatedMessaging.js
  const members = await pool.query(
    `SELECT fm.user_id, u.date_of_birth, fm.role
     FROM family_memberships fm
     JOIN users u ON fm.user_id = u.id
     WHERE fm.family_unit_id = $1 AND fm.status = 'active'`,
    [msg.family_id]
  );

  let parentId = null;
  let childId = null;

  for (const m of members.rows) {
    const bracket = computeAgeBracket(m.date_of_birth);
    if (m.role === 'elder' && !parentId) parentId = m.user_id;
    if (CHILD_BRACKETS.includes(bracket) && !childId) childId = m.user_id;
  }

  if (parentId && childId) {
    const hold = await checkDisclosureHold(parentId, childId, msg.family_id);
    if (hold) {
      await pool.query(
        `UPDATE breath_bridge_messages SET delivery_status = 'held', held_reason = 'disclosure_hold' WHERE id = $1`,
        [messageId]
      );
      return { delivered: false, reason: 'disclosure_hold' };
    }
  }

  // Deliver
  await pool.query(
    `UPDATE breath_bridge_messages SET delivery_status = 'delivered', delivered_at = NOW() WHERE id = $1`,
    [messageId]
  );

  return { delivered: true, messageId };
}

// ── GET CHILD MESSAGES ────────────────────────────────────────

async function getChildMessages(childParticipantId, familyId) {
  // Verify child is in this family
  const memberResult = await pool.query(
    `SELECT fm.user_id FROM family_memberships fm
     WHERE fm.family_unit_id = $1 AND fm.user_id = $2 AND fm.status = 'active'`,
    [familyId, childParticipantId]
  );
  if (!memberResult.rows[0]) {
    return { messages: [], error: 'Not a member of this family' };
  }

  const result = await pool.query(
    `SELECT id, content, age_bracket, delivered_at, channel
     FROM breath_bridge_messages
     WHERE family_id = $1 AND direction = 'parent_to_child' AND delivery_status = 'delivered'
     ORDER BY delivered_at DESC LIMIT 20`,
    [familyId]
  );

  return { messages: result.rows };
}

// ── PAUSE CHANNEL ─────────────────────────────────────────────

async function pauseChannel(familyId, clinicianId, reason) {
  if (!reason) return { paused: false, error: 'Reason required' };

  await pool.query(
    `UPDATE breath_bridge_config SET paused_at = NOW(), paused_reason = $1, updated_at = NOW()
     WHERE family_id = $2`,
    [reason, familyId]
  );

  // Hold all pending/scheduled messages
  const held = await pool.query(
    `UPDATE breath_bridge_messages SET delivery_status = 'held', held_reason = 'clinician_paused'
     WHERE family_id = $1 AND delivery_status IN ('pending', 'scheduled')
     RETURNING id`,
    [familyId]
  );

  return { paused: true, familyId, reason, messagesHeld: held.rowCount };
}

// ── RESUME CHANNEL ────────────────────────────────────────────

async function resumeChannel(familyId, clinicianId) {
  await pool.query(
    `UPDATE breath_bridge_config SET paused_at = NULL, paused_reason = NULL, updated_at = NOW()
     WHERE family_id = $1`,
    [familyId]
  );

  // Do NOT re-schedule held messages — they expire. New messages on next cron.
  return { resumed: true, familyId };
}

// ── GET FAMILY STATUS (clinician) ─────────────────────────────

async function getFamilyStatus(familyId) {
  const configResult = await pool.query(
    'SELECT * FROM breath_bridge_config WHERE family_id = $1',
    [familyId]
  );
  const config = configResult.rows[0] || null;

  const messagesResult = await pool.query(
    `SELECT id, direction, content, age_bracket, delivery_status, held_reason,
            delivered_at, scheduled_for, clinician_previewed, created_at
     FROM breath_bridge_messages
     WHERE family_id = $1 AND direction = 'parent_to_child'
     ORDER BY created_at DESC LIMIT 10`,
    [familyId]
  );

  const deliveredThisWeek = await pool.query(
    `SELECT COUNT(*) as cnt FROM breath_bridge_messages
     WHERE family_id = $1 AND direction = 'parent_to_child'
       AND delivered_at > NOW() - INTERVAL '7 days'`,
    [familyId]
  );

  return {
    config,
    messages: messagesResult.rows,
    deliveredThisWeek: parseInt(deliveredThisWeek.rows[0].cnt),
  };
}

// ── UPDATE CADENCE ────────────────────────────────────────────

async function updateCadence(familyId, weeklyCap) {
  const cap = Math.max(1, Math.min(5, parseInt(weeklyCap) || 3));
  await pool.query(
    `UPDATE breath_bridge_config SET weekly_message_cap = $1, updated_at = NOW()
     WHERE family_id = $2`,
    [cap, familyId]
  );
  return { updated: true, weekly_message_cap: cap };
}

// ── RECORD GUARDIAN CONSENT ───────────────────────────────────

async function recordGuardianConsent(familyId) {
  await pool.query(
    `UPDATE breath_bridge_config SET guardian_consent_at = NOW(), updated_at = NOW()
     WHERE family_id = $1`,
    [familyId]
  );
  return { recorded: true, familyId };
}

// ── PREVIEW NEXT MESSAGE ──────────────────────────────────────

async function previewNextMessage(familyId) {
  const result = await pool.query(
    `SELECT id, content, age_bracket, scheduled_for, library_entry_id
     FROM breath_bridge_messages
     WHERE family_id = $1 AND delivery_status = 'scheduled'
     ORDER BY scheduled_for ASC LIMIT 1`,
    [familyId]
  );

  if (!result.rows[0]) return { preview: null };

  // Mark as previewed
  await pool.query(
    'UPDATE breath_bridge_messages SET clinician_previewed = true WHERE id = $1',
    [result.rows[0].id]
  );

  return { preview: result.rows[0] };
}

// ── CRON: SCHEDULE ALL FAMILIES ───────────────────────────────

async function runSchedulerCron() {
  console.log('[BreathBridge] Running scheduler cron...');
  let scheduled = 0;
  let families = 0;
  let errors = 0;

  try {
    const configs = await pool.query(
      `SELECT family_id FROM breath_bridge_config
       WHERE active = true AND paused_at IS NULL
         AND parent_consent_at IS NOT NULL AND guardian_consent_at IS NOT NULL`
    );

    families = configs.rows.length;

    for (const config of configs.rows) {
      try {
        const result = await scheduleMessages(config.family_id);
        scheduled += result.scheduled;
      } catch (err) {
        errors++;
        console.error(`[BreathBridge] Schedule failed for family ${config.family_id}:`, err.message);
        Sentry.captureException(err);
      }
    }
  } catch (err) {
    console.error('[BreathBridge] Scheduler cron failed:', err.message);
    Sentry.captureException(err);
  }

  console.log(`[BreathBridge] Scheduled ${scheduled} messages across ${families} families (${errors} errors)`);
  return { scheduled, families, errors };
}

// ── CRON: DELIVER SCHEDULED MESSAGES ──────────────────────────

async function runDeliveryCron() {
  let delivered = 0;
  let held = 0;
  let errors = 0;

  try {
    const pending = await pool.query(
      `SELECT id FROM breath_bridge_messages
       WHERE delivery_status = 'scheduled' AND scheduled_for <= NOW()`
    );

    for (const msg of pending.rows) {
      try {
        const result = await deliverMessage(msg.id);
        if (result.delivered) delivered++;
        else held++;
      } catch (err) {
        errors++;
        console.error(`[BreathBridge] Delivery failed for message ${msg.id}:`, err.message);
        Sentry.captureException(err);
      }
    }
  } catch (err) {
    console.error('[BreathBridge] Delivery cron failed:', err.message);
    Sentry.captureException(err);
  }

  if (delivered > 0 || held > 0) {
    console.log(`[BreathBridge] Delivered ${delivered} messages, held ${held} (${errors} errors)`);
  }
  return { delivered, held, errors };
}

module.exports = {
  enrollFamily,
  scheduleMessages,
  deliverMessage,
  getChildMessages,
  pauseChannel,
  resumeChannel,
  getFamilyStatus,
  updateCadence,
  recordGuardianConsent,
  previewNextMessage,
  runSchedulerCron,
  runDeliveryCron,
  validateMessage,
};
