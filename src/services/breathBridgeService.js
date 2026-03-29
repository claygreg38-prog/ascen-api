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
const { getEligibleEntries, applyCoachingTemplate } = require('../../scripts/seedCoachingFirmwareLibrary');

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
     JOIN users u ON sc.user_id = u.id
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
     WHERE family_id = $1 AND direction IN ('parent_to_child', 'child_to_parent_summary')
     ORDER BY created_at DESC LIMIT 10`,
    [familyId]
  );

  const deliveredThisWeek = await pool.query(
    `SELECT COUNT(*) as cnt FROM breath_bridge_messages
     WHERE family_id = $1 AND direction = 'parent_to_child'
       AND delivered_at > NOW() - INTERVAL '7 days'`,
    [familyId]
  );

  const summariesResult = await pool.query(
    `SELECT id, content, delivered_at, created_at
     FROM breath_bridge_messages
     WHERE family_id = $1 AND direction = 'child_to_parent_summary'
     ORDER BY created_at DESC LIMIT 3`,
    [familyId]
  );

  return {
    config,
    messages: messagesResult.rows,
    deliveredThisWeek: parseInt(deliveredThisWeek.rows[0].cnt),
    warmthSummaries: summariesResult.rows,
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

// ═══════════════════════════════════════════════════════════════
// PHASE 3: COACHING FIRMWARE + MONTHLY WARMTH SUMMARY
// ═══════════════════════════════════════════════════════════════

const GATE_ORDER = ['gate_1', 'gate_2', 'gate_3', 'gate_4'];

// ── GATE EVALUATION ───────────────────────────────────────────

async function evaluateGate(parentDbId, familyId) {
  const configResult = await pool.query(
    'SELECT * FROM breath_bridge_config WHERE family_id = $1',
    [familyId]
  );
  const config = configResult.rows[0];
  if (!config || !config.active) return null;

  const currentGateIdx = GATE_ORDER.indexOf(config.current_gate);

  // Gates never regress
  if (currentGateIdx >= 3) return config.current_gate; // already gate_4

  // Count total sessions
  const sessionCount = await pool.query(
    `SELECT COUNT(*) as cnt FROM session_completions sc
     JOIN users u ON sc.user_id = u.id
     WHERE u.id = $1`,
    [parentDbId]
  );
  const totalSessions = parseInt(sessionCount.rows[0].cnt);

  // Gate 2: 14+ sessions in first 20 calendar days
  if (currentGateIdx < 1 && totalSessions >= 14) {
    const enrolledDays = await pool.query(
      `SELECT EXTRACT(DAY FROM NOW() - created_at) as days
       FROM breath_bridge_config WHERE family_id = $1`,
      [familyId]
    );
    const days = parseInt(enrolledDays.rows[0]?.days) || 999;
    if (days <= 20) {
      await pool.query(
        `UPDATE breath_bridge_config SET current_gate = 'gate_2', updated_at = NOW() WHERE family_id = $1 AND current_gate = 'gate_1'`,
        [familyId]
      );
      return 'gate_2';
    }
  }

  // Gate 3: Consistent engagement (<=3 consecutive missed days in last 30)
  if (currentGateIdx < 2 && totalSessions >= 16) {
    const last30 = await pool.query(
      `SELECT DATE(sc.completed_at) as session_date
       FROM session_completions sc
       JOIN users u ON sc.user_id = u.id
       WHERE u.id = $1 AND sc.completed_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(sc.completed_at)
       ORDER BY session_date`,
      [parentDbId]
    );
    const dates = last30.rows.map(r => r.session_date);
    let maxConsecutiveMissed = 0;
    let consecutiveMissed = 0;
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const day = new Date(now.getTime() - i * 86400000).toISOString().split('T')[0];
      const hasSession = dates.some(d => new Date(d).toISOString().split('T')[0] === day);
      if (!hasSession) {
        consecutiveMissed++;
        maxConsecutiveMissed = Math.max(maxConsecutiveMissed, consecutiveMissed);
      } else {
        consecutiveMissed = 0;
      }
    }
    if (maxConsecutiveMissed <= 3) {
      await pool.query(
        `UPDATE breath_bridge_config SET current_gate = 'gate_3', updated_at = NOW()
         WHERE family_id = $1 AND current_gate IN ('gate_1', 'gate_2')`,
        [familyId]
      );
      return 'gate_3';
    }
  }

  // Gate 4: 60+ sessions AND clinician confirmation (no auto-advance)
  // Clinician triggers gate_4 via endpoint — not evaluated here

  // Re-read current gate (may have been updated above)
  const updated = await pool.query('SELECT current_gate FROM breath_bridge_config WHERE family_id = $1', [familyId]);
  return updated.rows[0]?.current_gate || config.current_gate;
}

// ── COACHING DELIVERY (post-session) ──────────────────────────

async function deliverCoaching(parentDbId, sessionId, familyId) {
  try {
    // Check coaching is active
    const configResult = await pool.query(
      'SELECT * FROM breath_bridge_config WHERE family_id = $1',
      [familyId]
    );
    const config = configResult.rows[0];
    if (!config || !config.active || !config.coaching_active) return null;
    if (config.paused_at) return null;

    // Evaluate gate (may advance)
    const currentGate = await evaluateGate(parentDbId, familyId);
    if (!currentGate) return null;

    // Check disclosure hold
    const members = await pool.query(
      `SELECT fm.user_id, u.date_of_birth, fm.role
       FROM family_memberships fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1`,
      [familyId]
    );
    let childId = null;
    for (const m of members.rows) {
      const bracket = computeAgeBracket(m.date_of_birth);
      if (CHILD_BRACKETS.includes(bracket) && !childId) childId = m.user_id;
    }
    if (childId) {
      const hold = await checkDisclosureHold(parentDbId, childId, familyId);
      if (hold) return null;
    }

    // Get already-delivered entry IDs for this parent
    const deliveredResult = await pool.query(
      'SELECT firmware_entry_id FROM coaching_firmware_log WHERE participant_id = $1',
      [parentDbId]
    );
    const deliveredIds = new Set(deliveredResult.rows.map(r => r.firmware_entry_id));

    // Get eligible entries
    const isPostRelease = config.post_release_mode || false;
    const allEligible = getEligibleEntries(currentGate, isPostRelease);
    const undelivered = allEligible.filter(e => !deliveredIds.has(e.id));

    if (undelivered.length === 0) return null; // All entries delivered

    // Weight toward current gate and clinician emphasis
    const emphasis = config.clinician_emphasis_domain;
    let weighted = undelivered;
    if (emphasis) {
      const emphasisEntries = weighted.filter(e => e.domain === emphasis);
      const others = weighted.filter(e => e.domain !== emphasis);
      // 60% chance emphasis domain, 40% others
      weighted = Math.random() < 0.6 && emphasisEntries.length > 0 ? emphasisEntries : others.length > 0 ? others : emphasisEntries;
    }

    // Weight toward current gate
    const currentGateEntries = weighted.filter(e => e.min_gate === currentGate);
    if (currentGateEntries.length > 0 && Math.random() < 0.5) {
      weighted = currentGateEntries;
    }

    // Get parent + child names
    const parentName = await pool.query('SELECT first_name FROM users WHERE id = $1', [parentDbId]);
    let childName = 'your child';
    if (childId) {
      const childRow = await pool.query('SELECT first_name FROM users WHERE id = $1', [childId]);
      childName = childRow.rows[0]?.first_name || 'your child';
    }

    // Try Haiku
    let content = null;
    let entryId = null;

    try {
      const aiRouter = require('./aiRouter');
      const totalSessions = await pool.query(
        `SELECT COUNT(*) as cnt FROM session_completions sc
         JOIN users u ON sc.user_id = u.id WHERE u.id = $1`,
        [parentDbId]
      );

      const prompt = `You are delivering a coaching moment to an incarcerated parent who just completed a breathing session.

CONTEXT:
- Parent's current gate: ${currentGate}
- Sessions completed: ${totalSessions.rows[0].cnt}
- Clinician emphasis: ${emphasis || 'none — natural rotation'}
- Child's name: ${childName}

RULES:
- This is a reflection, not a lesson. The parent just breathed. They are calm. Meet them there.
- Half-full mindfulness: warm and real. Never promise outcomes. Never introduce fear.
- If referencing the child, frame it through the parent's effort, not the child's behavior.
- Keep it to 1-3 sentences.

Select ONE entry from the library below and personalize it. Return ONLY the personalized text.

LIBRARY (filtered to gate ${currentGate}):
${weighted.slice(0, 20).map(e => '[' + e.id + '] ' + e.template).join('\n')}`;

      const result = await aiRouter.route('breath_bridge_message', prompt, {
        maxTokens: 300,
        temperature: 0.6,
      });

      if (result && result.content) {
        const text = result.content.trim();
        if (validateMessage(text) && text.length >= 20 && text.length <= 300) {
          content = text;
          const match = weighted.find(e => text.includes(e.template.split('{')[0].slice(0, 15)));
          entryId = match?.id || 'haiku_composed';
        }
      }
    } catch (err) {
      console.error('[BreathBridge] Coaching Haiku failed:', err.message);
      Sentry.captureException(err);
    }

    // Fallback
    if (!content) {
      const entry = weighted[Math.floor(Math.random() * weighted.length)];
      content = applyCoachingTemplate(entry.template, {
        parent_name: parentName.rows[0]?.first_name || 'You',
        child_name: childName,
        breath_count: 'those',
        session_number: '',
      });
      entryId = entry.id;
    }

    // Insert into coaching_firmware_log
    await pool.query(
      `INSERT INTO coaching_firmware_log
        (participant_id, session_id, firmware_entry_id, domain, gate, content, clinician_emphasis)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [parentDbId, sessionId, entryId,
       weighted[0]?.domain || 'showing_up', currentGate, content, emphasis]
    );

    return { delivered: true, content, gate: currentGate, entryId };
  } catch (err) {
    console.error('[BreathBridge] Coaching delivery error:', err.message);
    Sentry.captureException(err);
    return null;
  }
}

// ── GATE OVERRIDE (clinician) ─────────────────────────────────

async function overrideGate(familyId, newGate, clinicianId) {
  if (!GATE_ORDER.includes(newGate)) return { error: 'Invalid gate' };

  const configResult = await pool.query(
    'SELECT current_gate FROM breath_bridge_config WHERE family_id = $1',
    [familyId]
  );
  if (!configResult.rows[0]) return { error: 'Not enrolled' };

  // Gates never regress — but clinician can advance
  const currentIdx = GATE_ORDER.indexOf(configResult.rows[0].current_gate);
  const newIdx = GATE_ORDER.indexOf(newGate);
  if (newIdx < currentIdx) return { error: 'Cannot regress gate' };

  await pool.query(
    `UPDATE breath_bridge_config SET current_gate = $1, updated_at = NOW() WHERE family_id = $2`,
    [newGate, familyId]
  );

  return { updated: true, previous: configResult.rows[0].current_gate, current: newGate };
}

// ── ENABLE COACHING ───────────────────────────────────────────

async function enableCoaching(familyId) {
  await pool.query(
    `UPDATE breath_bridge_config SET coaching_active = true, updated_at = NOW() WHERE family_id = $1`,
    [familyId]
  );
  return { coaching_active: true };
}

// ── COACHING PROGRESS (clinician) ─────────────────────────────

async function getCoachingProgress(familyId) {
  const configResult = await pool.query(
    'SELECT * FROM breath_bridge_config WHERE family_id = $1',
    [familyId]
  );
  const config = configResult.rows[0];
  if (!config) return null;

  // Find parent
  const parent = await pool.query(
    `SELECT fm.user_id, u.id as db_id FROM family_memberships fm
     JOIN users u ON fm.user_id = u.id
     WHERE fm.family_unit_id = $1 AND fm.role = 'elder' LIMIT 1`,
    [familyId]
  );
  const parentDbId = parent.rows[0]?.db_id;

  let totalSessions = 0;
  if (parentDbId) {
    const sc = await pool.query(
      `SELECT COUNT(*) as cnt FROM session_completions sc
       JOIN users u ON sc.user_id = u.id WHERE u.id = $1`,
      [parentDbId]
    );
    totalSessions = parseInt(sc.rows[0].cnt);
  }

  // Domains covered
  const domainResult = await pool.query(
    `SELECT DISTINCT domain FROM coaching_firmware_log WHERE participant_id = $1`,
    [parentDbId || 0]
  );
  const domainsCovered = domainResult.rows.map(r => r.domain);

  // Total coaching entries delivered
  const countResult = await pool.query(
    'SELECT COUNT(*) as cnt FROM coaching_firmware_log WHERE participant_id = $1',
    [parentDbId || 0]
  );

  return {
    current_gate: config.current_gate,
    coaching_active: config.coaching_active,
    clinician_emphasis_domain: config.clinician_emphasis_domain,
    total_sessions: totalSessions,
    domains_covered: domainsCovered,
    entries_delivered: parseInt(countResult.rows[0].cnt),
    post_release_mode: config.post_release_mode,
  };
}

// ── MONTHLY WARMTH SUMMARY ────────────────────────────────────

async function generateMonthlySummary(familyId) {
  const configResult = await pool.query(
    'SELECT * FROM breath_bridge_config WHERE family_id = $1',
    [familyId]
  );
  const config = configResult.rows[0];
  if (!config || !config.active) return null;

  // Disclosure hold check
  const members = await pool.query(
    `SELECT fm.user_id, u.date_of_birth, fm.role, u.first_name, u.email, u.phone
     FROM family_memberships fm
     JOIN users u ON fm.user_id = u.id
     WHERE fm.family_unit_id = $1`,
    [familyId]
  );

  let parentId = null, parentEmail = null, parentPhone = null;
  let childId = null, childName = 'your child', childBracket = null;

  for (const m of members.rows) {
    const bracket = computeAgeBracket(m.date_of_birth);
    if (m.role === 'elder' && !parentId) {
      parentId = m.user_id;
      parentEmail = m.email;
      parentPhone = m.phone;
    }
    if (CHILD_BRACKETS.includes(bracket) && !childId) {
      childId = m.user_id;
      childName = m.first_name || 'your child';
      childBracket = bracket;
    }
  }

  if (parentId && childId) {
    const hold = await checkDisclosureHold(parentId, childId, familyId);
    if (hold) return { generated: false, reason: 'disclosure_hold' };
  }

  // Get child session summary for last month
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const childSessions = await pool.query(
    `SELECT breaths_completed, duration_seconds, early_quit, session_timestamp
     FROM child_session_log
     WHERE family_id = $1 AND session_timestamp > $2
     ORDER BY session_timestamp DESC`,
    [familyId, monthAgo]
  );

  const sessionCount = childSessions.rows.length;
  let trend = 'new';
  if (sessionCount >= 4) {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    const recent = childSessions.rows.filter(s => new Date(s.session_timestamp) >= weekAgo);
    const prior = childSessions.rows.filter(s => {
      const ts = new Date(s.session_timestamp);
      return ts >= twoWeeksAgo && ts < weekAgo;
    });
    if (recent.length > 0 && prior.length > 0) {
      const recentAvg = recent.reduce((s, r) => s + r.breaths_completed, 0) / recent.length;
      const priorAvg = prior.reduce((s, r) => s + r.breaths_completed, 0) / prior.length;
      if (recentAvg > priorAvg * 1.15) trend = 'increasing';
      else if (recentAvg < priorAvg * 0.85) trend = 'decreasing';
      else trend = 'steady';
    } else {
      trend = 'steady';
    }
  }

  // Compose warmth summary via Haiku
  let summaryContent = null;
  const trendLabel = trend === 'increasing' ? 'growing' : trend === 'decreasing' ? 'finding their rhythm' : trend === 'steady' ? 'consistent' : 'getting started';

  try {
    const aiRouter = require('./aiRouter');
    const prompt = `You are writing a monthly warmth summary for an incarcerated parent about their child's breathing engagement.

CHILD: ${childName}
SESSIONS THIS MONTH: ${sessionCount}
TREND: ${trendLabel}
${sessionCount === 0 ? 'The child has not used the Air Dancer this month.' : ''}

RULES — NON-NEGOTIABLE:
- Trend only, never session-level data. Never say exact numbers of sessions or breaths.
- Frame as child's own choice, not response to parent.
- Wins shared warmly. Working-on-it normalizes.
- Never a report card. Never alarm. Never negative.
- If zero sessions: "${childName} has their own rhythm. What matters is they know you're breathing."
- Resilience framing: "What matters is they know you're breathing. The rest takes the shape it takes."
- 2-4 sentences. Warm and real.

Write the summary. Return ONLY the summary text.`;

    const result = await aiRouter.route('breath_bridge_message', prompt, {
      maxTokens: 400,
      temperature: 0.7,
    });

    if (result && result.content) {
      const text = result.content.trim();
      if (text.length >= 20 && text.length <= 500) {
        summaryContent = text;
      }
    }
  } catch (err) {
    console.error('[BreathBridge] Monthly summary Haiku failed:', err.message);
    Sentry.captureException(err);
  }

  // Fallback
  if (!summaryContent) {
    if (sessionCount === 0) {
      summaryContent = `${childName} has their own rhythm. What matters is they know you're breathing. The rest takes the shape it takes.`;
    } else if (trend === 'increasing') {
      summaryContent = `${childName} has been opening their Air Dancer consistently this month. They're finding their own pace, and it's growing. What matters is they know you're breathing too.`;
    } else if (trend === 'decreasing') {
      summaryContent = `${childName} is still finding their rhythm. That's normal — it took you a few weeks too. What matters is they know you're breathing.`;
    } else {
      summaryContent = `${childName} has been breathing at a steady pace this month. Their rhythm is their own. Some weeks more, some less. What matters is they know you're breathing.`;
    }
  }

  // Insert as child_to_parent_summary
  await pool.query(
    `INSERT INTO breath_bridge_messages
      (family_id, direction, content, age_bracket, delivery_status, delivered_at)
     VALUES ($1, 'child_to_parent_summary', $2, $3, 'delivered', NOW())`,
    [familyId, summaryContent, childBracket || 'elementary']
  );

  // Send notification
  let notificationSent = false;
  try {
    const emailService = require('./emailService');
    if (parentEmail && emailService.isEmailAvailable()) {
      await emailService.sendEmail({
        to: parentEmail,
        subject: `Monthly Breathing Update — ${childName}`,
        text: summaryContent,
        html: `<p>${summaryContent}</p>`,
      });
      notificationSent = true;
    } else if (parentPhone) {
      await emailService.sendSMS(parentPhone, summaryContent);
      notificationSent = true;
    } else {
      console.warn(`[BreathBridge] Monthly summary: no email/SMS for family ${familyId} — Kitchen Table delivery only`);
    }
  } catch (err) {
    console.warn(`[BreathBridge] Monthly summary notification failed for family ${familyId}: ${err.message} — Kitchen Table delivery only`);
  }

  return { generated: true, familyId, notificationSent };
}

// ── CRON: MONTHLY WARMTH SUMMARY ──────────────────────────────

async function runMonthlySummaryCron() {
  console.log('[BreathBridge] Running monthly warmth summary cron...');
  let generated = 0, errors = 0;

  try {
    const configs = await pool.query(
      `SELECT family_id FROM breath_bridge_config WHERE active = true`
    );

    for (const config of configs.rows) {
      try {
        const result = await generateMonthlySummary(config.family_id);
        if (result?.generated) generated++;
      } catch (err) {
        errors++;
        console.error(`[BreathBridge] Monthly summary failed for family ${config.family_id}:`, err.message);
        Sentry.captureException(err);
      }
    }
  } catch (err) {
    console.error('[BreathBridge] Monthly summary cron failed:', err.message);
    Sentry.captureException(err);
  }

  console.log(`[BreathBridge] Monthly summaries: ${generated} generated, ${errors} errors`);
  return { generated, errors };
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4: POST-RELEASE TRANSITION + SHARED BREATHING
// ═══════════════════════════════════════════════════════════════

// ── POST-RELEASE TRANSITION ───────────────────────────────────

async function triggerPostRelease(familyId, clinicianId) {
  const configResult = await pool.query(
    'SELECT * FROM breath_bridge_config WHERE family_id = $1',
    [familyId]
  );
  if (!configResult.rows[0]) return { error: 'Not enrolled' };

  await pool.query(
    `UPDATE breath_bridge_config SET post_release_mode = true, updated_at = NOW() WHERE family_id = $1`,
    [familyId]
  );

  return { transitioned: true, familyId, post_release_mode: true };
}

// ── SHARED BREATHING — CO-PRESENCE CHECK ──────────────────────

async function checkCoPresence(familyId, requestingUserId) {
  // Check if the other party has an active session
  const members = await pool.query(
    `SELECT fm.user_id, u.id as db_id, u.date_of_birth, fm.role
     FROM family_memberships fm
     JOIN users u ON fm.user_id = u.id
     WHERE fm.family_unit_id = $1`,
    [familyId]
  );

  const requestingMember = members.rows.find(m => m.db_id === requestingUserId);
  if (!requestingMember) return { co_present: false };

  // Find the other party (parent or child)
  const otherMembers = members.rows.filter(m => m.db_id !== requestingUserId);

  for (const other of otherMembers) {
    // Check for active session (session_active = true in session_completions)
    const activeSession = await pool.query(
      `SELECT sc.id FROM session_completions sc
       JOIN users u ON sc.user_id = u.id
       WHERE u.id = $1 AND sc.session_active = true
       LIMIT 1`,
      [other.db_id]
    );

    // Also check child_session_log for very recent activity (within 10 minutes)
    const recentChild = await pool.query(
      `SELECT id FROM child_session_log
       WHERE participant_id = $1 AND session_timestamp > NOW() - INTERVAL '10 minutes'
       LIMIT 1`,
      [other.db_id]
    );

    if (activeSession.rows.length > 0 || recentChild.rows.length > 0) {
      return { co_present: true, other_user_id: other.db_id, other_role: other.role };
    }
  }

  return { co_present: false };
}

// ── CHILD OPT-OUT OF SHARED BREATHING ─────────────────────────

async function setSharedBreathingOptOut(childDbId, familyId, optedOut) {
  // Store as a simple flag — use breath_bridge_config or a separate mechanism
  // For now, store in family_memberships individual_progress JSONB
  await pool.query(
    `UPDATE family_memberships
     SET individual_progress = jsonb_set(COALESCE(individual_progress, '{}'), '{shared_breathing_opted_out}', $1::jsonb)
     WHERE user_id = $2 AND family_unit_id = $3`,
    [JSON.stringify(optedOut), childDbId, familyId]
  );
  return { opted_out: optedOut };
}

async function isSharedBreathingOptedOut(childDbId, familyId) {
  const result = await pool.query(
    `SELECT individual_progress->>'shared_breathing_opted_out' as opted_out
     FROM family_memberships WHERE user_id = $1 AND family_unit_id = $2`,
    [childDbId, familyId]
  );
  return result.rows[0]?.opted_out === 'true';
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
  // Phase 3
  evaluateGate,
  deliverCoaching,
  overrideGate,
  enableCoaching,
  getCoachingProgress,
  generateMonthlySummary,
  runMonthlySummaryCron,
  // Phase 4
  triggerPostRelease,
  checkCoPresence,
  setSharedBreathingOptOut,
  isSharedBreathingOptedOut,
};
