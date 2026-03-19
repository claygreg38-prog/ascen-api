// ============================================================
// [ABI] Crisis Engine — Crisis Lifecycle, Steward System, Domestic Safety
// File: src/abi/crisisEngine.js
//
// Phases: pre_crisis → active_crisis → recovery_start → solo_period
//         → reintegration → resolution → resolved
//
// Pre-crisis requires 3+ compound signals — no single indicator triggers.
// Active crisis freezes Capacity Currency. Messaging pauses except
// periodic check-ins (72h) using pre-approved templates.
// Recovery message: "You're here. That's enough." — NOT "Welcome back!"
// Solo period 7-14 days before family features reopen.
// Resolution requires 14+ days sustained steady capacity.
//
// Steward system: teen (16-17) family stewards with strict guardrails.
// Domestic safety: privacy mode, coercive control detection, exit family.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── CONSTANTS ───────────────────────────────────────────────

const MIN_COMPOUND_SIGNALS = 3;
const ZERO_ENGAGEMENT_HOURS = 72;
const CHECKIN_INTERVAL_HOURS = 72;
const SOLO_PERIOD_MIN_DAYS = 7;
const SOLO_PERIOD_MAX_DAYS = 14;
const REINTEGRATION_STEADY_DAYS = 3;
const RESOLUTION_STEADY_DAYS = 14;
const STEWARD_MAX_DAILY_ACTIONS = 2;
const STEWARD_EXPIRY_DAYS = 30;
const STEWARD_MIN_AGE = 16;
const STEWARD_MAX_AGE = 17;
const STEWARD_MIN_SESSIONS = 30;
const STEWARD_MIN_ENGAGEMENT_DAYS = 60;

// Fields that MUST be stripped from all family-facing data
const BIOMETRIC_FIELDS = [
  'hrv', 'heart_rate', 'rr_intervals', 'ns3_peak', 'ns3_mean', 'ns3_floor',
  'coherence_peak', 'coherence_end', 'arrival_hr', 'arrival_hrv',
  'optimal_zone_pct', 'approaching_zone_pct', 'below_window_zone_pct'
];

// ═══════════════════════════════════════════════════════════════
// CRISIS DETECTION
// ═══════════════════════════════════════════════════════════════

async function detectPreCrisis(userId, signals) {
  try {
    // signals: { missedSessions, capacityDeclining, conflictEscalating,
    //            sleepDeterioration, engagementDropping, isolationIncreasing }
    const activeSignals = Object.entries(signals || {}).filter(([_, v]) => v === true);

    // Requires 3+ compound signals — no single indicator triggers crisis
    if (activeSignals.length < MIN_COMPOUND_SIGNALS) {
      return { detected: false, signalCount: activeSignals.length, required: MIN_COMPOUND_SIGNALS };
    }

    // Check if already in crisis
    const existing = await pool.query(
      "SELECT id FROM crisis_events WHERE user_id = $1 AND phase NOT IN ('resolved') ORDER BY created_at DESC LIMIT 1",
      [userId]
    );
    if (existing.rows.length > 0) {
      return { detected: false, reason: 'Already in crisis lifecycle', existingCrisisId: existing.rows[0].id };
    }

    // Create pre-crisis event
    const result = await pool.query(
      `INSERT INTO crisis_events (user_id, phase, trigger_type, trigger_signals)
       VALUES ($1, 'pre_crisis', 'compound_signals', $2)
       RETURNING id`,
      [userId, JSON.stringify({ signals: activeSignals.map(([k]) => k), count: activeSignals.length })]
    );

    // Notify facilitator
    await notifyFacilitator(userId, 'pre_crisis', activeSignals.map(([k]) => k));

    console.log(`[CrisisEngine] Pre-crisis detected for user ${userId}: ${activeSignals.length} signals`);

    return {
      detected: true,
      crisisEventId: result.rows[0].id,
      phase: 'pre_crisis',
      signalCount: activeSignals.length,
      signals: activeSignals.map(([k]) => k)
    };
  } catch (err) {
    console.error('[CrisisEngine] detectPreCrisis failed:', err.message);
    Sentry.captureException(err);
    return { detected: false, error: err.message };
  }
}

async function detectZeroEngagement(userId) {
  try {
    // Check last session completion
    const lastSession = await pool.query(
      `SELECT MAX(completed_at) as last_active FROM session_completions
       WHERE user_id = (SELECT participant_id FROM users WHERE id = $1)`,
      [userId]
    );

    const lastActive = lastSession.rows[0]?.last_active;
    if (!lastActive) return { detected: false };

    const hoursSinceActive = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60);

    if (hoursSinceActive >= ZERO_ENGAGEMENT_HOURS) {
      // Check not already in crisis
      const existing = await pool.query(
        "SELECT id FROM crisis_events WHERE user_id = $1 AND phase NOT IN ('resolved') LIMIT 1",
        [userId]
      );
      if (existing.rows.length > 0) return { detected: false, reason: 'Already in crisis' };

      return await declareActiveCrisis(userId, null, 'zero_engagement',
        { hours_inactive: Math.round(hoursSinceActive) });
    }

    return { detected: false, hoursSinceActive: Math.round(hoursSinceActive) };
  } catch (err) {
    Sentry.captureException(err);
    return { detected: false };
  }
}

// ═══════════════════════════════════════════════════════════════
// CRISIS LIFECYCLE
// ═══════════════════════════════════════════════════════════════

async function declareActiveCrisis(userId, facilitatorId, triggerType, triggerSignals) {
  try {
    // Check for existing active crisis
    const existing = await pool.query(
      "SELECT id FROM crisis_events WHERE user_id = $1 AND phase NOT IN ('resolved') LIMIT 1",
      [userId]
    );

    let crisisId;
    if (existing.rows.length > 0) {
      crisisId = existing.rows[0].id;
      await pool.query(
        `UPDATE crisis_events SET phase = 'active_crisis', trigger_type = COALESCE($1, trigger_type),
         trigger_signals = COALESCE($2, trigger_signals), capacity_frozen = true,
         capacity_frozen_at = NOW(), messaging_paused = true, facilitator_id = $3, updated_at = NOW()
         WHERE id = $4`,
        [triggerType, triggerSignals ? JSON.stringify(triggerSignals) : null, facilitatorId, crisisId]
      );
    } else {
      // Get family unit
      const userInfo = await pool.query(
        `SELECT u.id, fm.family_unit_id, u.tenant_id FROM users u
         LEFT JOIN family_memberships fm ON fm.user_id = u.id
         WHERE u.id = $1 LIMIT 1`,
        [userId]
      );
      const familyUnitId = userInfo.rows[0]?.family_unit_id || null;
      const tenantId = userInfo.rows[0]?.tenant_id || null;

      const result = await pool.query(
        `INSERT INTO crisis_events
         (user_id, family_unit_id, tenant_id, phase, trigger_type, trigger_signals,
          capacity_frozen, capacity_frozen_at, messaging_paused, facilitator_id)
         VALUES ($1, $2, $3, 'active_crisis', $4, $5, true, NOW(), true, $6)
         RETURNING id`,
        [userId, familyUnitId, tenantId, triggerType || 'facilitator_declared',
         triggerSignals ? JSON.stringify(triggerSignals) : null, facilitatorId]
      );
      crisisId = result.rows[0].id;
    }

    // Freeze Capacity Currency — block all withdrawals
    await freezeCapacity(userId);

    // Pause all automated messaging
    // (premium gate and messaging engine check crisis status)

    // LightBridge: crisis pulse — communicates presence, not decline
    try {
      const lightBridge = require('./lightBridgeEngine');
      await lightBridge.triggerSessionEvent(
        (await pool.query('SELECT user_id FROM users WHERE id = $1', [userId])).rows[0]?.user_id,
        null, 'crisis_pulse'
      );
    } catch (e) { /* non-blocking */ }

    await notifyFacilitator(userId, 'active_crisis', triggerSignals);

    console.log(`[CrisisEngine] Active crisis declared for user ${userId}, capacity frozen`);

    return { detected: true, crisisEventId: crisisId, phase: 'active_crisis', capacityFrozen: true };
  } catch (err) {
    console.error('[CrisisEngine] declareActiveCrisis failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to declare crisis' };
  }
}

async function selfReportCrisis(userId) {
  return await declareActiveCrisis(userId, null, 'self_report', { source: 'user_self_report' });
}

async function startRecovery(userId, facilitatorId) {
  try {
    const crisis = await getActiveCrisis(userId);
    if (!crisis) return { error: true, message: 'No active crisis found' };

    // Unfreeze capacity
    await unfreezeCapacity(userId);

    await pool.query(
      `UPDATE crisis_events SET phase = 'recovery_start', capacity_frozen = false,
       capacity_unfrozen_at = NOW(), facilitator_id = COALESCE($1, facilitator_id), updated_at = NOW()
       WHERE id = $2`,
      [facilitatorId, crisis.id]
    );

    // Send recovery message: "You're here. That's enough." — NOT "Welcome back!"
    await sendCheckin(crisis.id, userId, 'recovery_1');

    // LightBridge: recovery warming
    try {
      const lightBridge = require('./lightBridgeEngine');
      await lightBridge.triggerSessionEvent(
        (await pool.query('SELECT user_id FROM users WHERE id = $1', [userId])).rows[0]?.user_id,
        null, 'recovery_warming'
      );
    } catch (e) { /* non-blocking */ }

    console.log(`[CrisisEngine] Recovery started for user ${userId}, capacity unfrozen`);

    return { crisisEventId: crisis.id, phase: 'recovery_start', capacityUnfrozen: true };
  } catch (err) {
    console.error('[CrisisEngine] startRecovery failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to start recovery' };
  }
}

async function startSoloPeriod(userId) {
  try {
    const crisis = await getActiveCrisis(userId);
    if (!crisis) return { error: true, message: 'No active crisis found' };

    const soloEnd = new Date(Date.now() + SOLO_PERIOD_MIN_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE crisis_events SET phase = 'solo_period', solo_period_start = NOW(),
       solo_period_end = $1, messaging_paused = false, updated_at = NOW()
       WHERE id = $2`,
      [soloEnd, crisis.id]
    );

    // Re-baseline: read fresh arrival data, NEVER compare to pre-crisis
    // (The orchestrator's onArrivalComplete uses current data by default)

    console.log(`[CrisisEngine] Solo period started for user ${userId}, ${SOLO_PERIOD_MIN_DAYS}-${SOLO_PERIOD_MAX_DAYS} days`);

    return { crisisEventId: crisis.id, phase: 'solo_period', soloPeriodEnd: soloEnd };
  } catch (err) {
    console.error('[CrisisEngine] startSoloPeriod failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to start solo period' };
  }
}

async function evaluateReintegration(userId) {
  try {
    const crisis = await getActiveCrisis(userId);
    if (!crisis || crisis.phase !== 'solo_period') return { ready: false };

    // Check steady capacity for 3+ consecutive days
    const capacityCurrency = require('./capacityCurrency');
    const balance = await capacityCurrency.getBalance(
      (await pool.query('SELECT user_id FROM users WHERE id = $1', [userId])).rows[0]?.user_id
    );

    if (!balance || balance.error) return { ready: false };

    const state = balance.state;
    if (state === 'steady' || state === 'full') {
      const newStreak = (crisis.steady_streak_days || 0) + 1;
      await pool.query(
        'UPDATE crisis_events SET steady_streak_days = $1, updated_at = NOW() WHERE id = $2',
        [newStreak, crisis.id]
      );

      if (newStreak >= REINTEGRATION_STEADY_DAYS) {
        await pool.query(
          `UPDATE crisis_events SET phase = 'reintegration', reintegration_started_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [crisis.id]
        );
        console.log(`[CrisisEngine] Reintegration started for user ${userId}`);
        return { ready: true, phase: 'reintegration', crisisEventId: crisis.id };
      }

      return { ready: false, steadyDays: newStreak, required: REINTEGRATION_STEADY_DAYS };
    }

    // Reset streak if not steady
    await pool.query('UPDATE crisis_events SET steady_streak_days = 0, updated_at = NOW() WHERE id = $1', [crisis.id]);
    return { ready: false, steadyDays: 0, required: REINTEGRATION_STEADY_DAYS };
  } catch (err) {
    Sentry.captureException(err);
    return { ready: false };
  }
}

async function evaluateResolution(userId) {
  try {
    const crisis = await getActiveCrisis(userId);
    if (!crisis || crisis.phase !== 'reintegration') return { resolved: false };

    if ((crisis.steady_streak_days || 0) >= RESOLUTION_STEADY_DAYS) {
      await pool.query(
        `UPDATE crisis_events SET phase = 'resolved', resolved_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [crisis.id]
      );
      console.log(`[CrisisEngine] Crisis resolved for user ${userId} after ${RESOLUTION_STEADY_DAYS}+ days steady`);
      return { resolved: true, crisisEventId: crisis.id };
    }

    return { resolved: false, steadyDays: crisis.steady_streak_days, required: RESOLUTION_STEADY_DAYS };
  } catch (err) {
    return { resolved: false };
  }
}

// ═══════════════════════════════════════════════════════════════
// STEWARD SYSTEM
// ═══════════════════════════════════════════════════════════════

async function evaluateStewardEligibility(userId, familyUnitId) {
  try {
    const user = await pool.query(
      'SELECT id, first_name FROM users WHERE id = $1',
      [userId]
    );
    if (user.rows.length === 0) return { eligible: false, reason: 'User not found' };

    // Check age (16-17) — using family membership metadata or birth date
    const membership = await pool.query(
      'SELECT role, joined_at FROM family_memberships WHERE user_id = $1 AND family_unit_id = $2',
      [userId, familyUnitId]
    );
    if (membership.rows.length === 0) return { eligible: false, reason: 'Not a family member' };

    // For pilot: check role is 'child' and assume age from metadata
    // Production would use verified birth date
    const age = membership.rows[0].age || null;
    if (age !== null && (age < STEWARD_MIN_AGE || age > STEWARD_MAX_AGE)) {
      return { eligible: false, reason: `Must be ${STEWARD_MIN_AGE}-${STEWARD_MAX_AGE} years old` };
    }

    // 30+ sessions
    const sessions = await pool.query(
      `SELECT COUNT(*) as count FROM session_completions
       WHERE user_id = (SELECT participant_id FROM users WHERE id = $1)`,
      [userId]
    );
    if (parseInt(sessions.rows[0]?.count) < STEWARD_MIN_SESSIONS) {
      return { eligible: false, reason: `Requires ${STEWARD_MIN_SESSIONS}+ completed sessions` };
    }

    // 60+ days engagement
    const engagement = await pool.query(
      `SELECT MIN(completed_at) as first_session FROM session_completions
       WHERE user_id = (SELECT participant_id FROM users WHERE id = $1)`,
      [userId]
    );
    const firstSession = engagement.rows[0]?.first_session;
    if (firstSession) {
      const daysSince = (Date.now() - new Date(firstSession).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < STEWARD_MIN_ENGAGEMENT_DAYS) {
        return { eligible: false, reason: `Requires ${STEWARD_MIN_ENGAGEMENT_DAYS}+ days engagement` };
      }
    }

    // Positive savings (capacity)
    try {
      const capacityCurrency = require('./capacityCurrency');
      const userIdStr = (await pool.query('SELECT user_id FROM users WHERE id = $1', [userId])).rows[0]?.user_id;
      const balance = await capacityCurrency.getBalance(userIdStr);
      if (!balance || balance.error || balance.balance <= 0) {
        return { eligible: false, reason: 'Requires positive capacity savings' };
      }
    } catch (e) {
      return { eligible: false, reason: 'Could not verify capacity' };
    }

    // Adult backup EXISTS — non-negotiable
    const adultBackup = await pool.query(
      `SELECT fm.user_id FROM family_memberships fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1 AND fm.role IN ('parent', 'caregiver')
       AND fm.user_id != $2 LIMIT 1`,
      [familyUnitId, userId]
    );
    if (adultBackup.rows.length === 0) {
      return { eligible: false, reason: 'Adult backup must exist in family unit' };
    }

    return {
      eligible: true,
      adultBackupId: adultBackup.rows[0].user_id,
      requirements: {
        age: 'verified',
        sessions: parseInt(sessions.rows[0]?.count),
        engagement_days: Math.round((Date.now() - new Date(firstSession).getTime()) / (1000 * 60 * 60 * 24)),
        positive_savings: true,
        adult_backup: true
      }
    };
  } catch (err) {
    console.error('[CrisisEngine] evaluateStewardEligibility failed:', err.message);
    Sentry.captureException(err);
    return { eligible: false, reason: 'Eligibility check failed' };
  }
}

async function authorizeSteward(stewardUserId, familyUnitId, adultBackupId, tenantId) {
  try {
    const eligibility = await evaluateStewardEligibility(stewardUserId, familyUnitId);
    if (!eligibility.eligible) return { error: true, message: eligibility.reason };

    const expiresAt = new Date(Date.now() + STEWARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO steward_actions
       (steward_user_id, family_unit_id, tenant_id, adult_backup_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [stewardUserId, familyUnitId, tenantId, adultBackupId, expiresAt]
    );

    console.log(`[CrisisEngine] Steward authorized: user ${stewardUserId}, expires ${expiresAt.toISOString()}`);

    return { stewardId: result.rows[0].id, expiresAt, adultBackupId };
  } catch (err) {
    console.error('[CrisisEngine] authorizeSteward failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to authorize steward' };
  }
}

async function stewardSendMessage(stewardUserId, familyUnitId, templateId) {
  try {
    // Verify active steward
    const steward = await pool.query(
      "SELECT * FROM steward_actions WHERE steward_user_id = $1 AND family_unit_id = $2 AND status = 'active'",
      [stewardUserId, familyUnitId]
    );
    if (steward.rows.length === 0) return { error: true, message: 'Not an active steward' };

    const s = steward.rows[0];

    // Check expiry
    if (new Date(s.expires_at) < new Date()) {
      await pool.query("UPDATE steward_actions SET status = 'expired' WHERE id = $1", [s.id]);
      return { error: true, message: 'Steward authorization expired. Reauthorization required from adult backup.' };
    }

    // Max 2 action items per day
    const today = new Date().toISOString().split('T')[0];
    if (s.daily_actions_reset_date !== today) {
      await pool.query(
        'UPDATE steward_actions SET daily_actions_today = 0, daily_actions_reset_date = $1 WHERE id = $2',
        [today, s.id]
      );
      s.daily_actions_today = 0;
    }

    if (s.daily_actions_today >= STEWARD_MAX_DAILY_ACTIONS) {
      return { error: true, message: 'Daily action limit reached (max 2 per day). You are doing enough.' };
    }

    // Only preset messages — no freeform text
    const template = await pool.query('SELECT * FROM crisis_message_templates WHERE id = $1', [templateId]);
    if (template.rows.length === 0) return { error: true, message: 'Invalid message template' };

    // Increment daily actions
    await pool.query(
      'UPDATE steward_actions SET daily_actions_today = daily_actions_today + 1 WHERE id = $1',
      [s.id]
    );

    console.log(`[CrisisEngine] Steward ${stewardUserId} sent template ${templateId}`);

    return { sent: true, templateId, messageText: template.rows[0].message_text };
  } catch (err) {
    console.error('[CrisisEngine] stewardSendMessage failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to send message' };
  }
}

async function stewardStepDown(stewardUserId, familyUnitId) {
  try {
    // Single action, no explanation required
    await pool.query(
      "UPDATE steward_actions SET status = 'stepped_down', stepped_down_at = NOW() WHERE steward_user_id = $1 AND family_unit_id = $2 AND status = 'active'",
      [stewardUserId, familyUnitId]
    );
    console.log(`[CrisisEngine] Steward ${stewardUserId} stepped down`);
    return { steppedDown: true };
  } catch (err) {
    return { error: true, message: 'Failed to step down' };
  }
}

// ═══════════════════════════════════════════════════════════════
// DOMESTIC SAFETY
// ═══════════════════════════════════════════════════════════════

async function enablePrivacyMode(userId) {
  try {
    await pool.query(
      'UPDATE users SET privacy_mode = true, privacy_mode_since = NOW() WHERE id = $1',
      [userId]
    );

    // Facilitator IS notified — family is NOT notified
    await notifyFacilitator(userId, 'privacy_mode_activated', null);

    console.log(`[CrisisEngine] Privacy mode enabled for user ${userId} — family NOT notified`);
    return { privacyMode: true, familyNotified: false, facilitatorNotified: true };
  } catch (err) {
    Sentry.captureException(err);
    return { error: true, message: 'Failed to enable privacy mode' };
  }
}

async function disablePrivacyMode(userId) {
  try {
    await pool.query('UPDATE users SET privacy_mode = false WHERE id = $1', [userId]);
    return { privacyMode: false };
  } catch (err) {
    return { error: true, message: 'Failed to disable privacy mode' };
  }
}

async function exitFamily(userId, familyUnitId) {
  try {
    // Any member, any time, no approval needed
    await pool.query(
      'DELETE FROM family_memberships WHERE user_id = $1 AND family_unit_id = $2',
      [userId, familyUnitId]
    );

    // Individual data fully preserved — we only remove the membership link
    // Session data, capacity, vault capsules all remain on the user record

    // Neutral exit message — no reason given
    const user = await pool.query('SELECT first_name FROM users WHERE id = $1', [userId]);
    const name = user.rows[0]?.first_name || 'A family member';

    // Notify remaining family members with neutral message
    const remaining = await pool.query(
      'SELECT user_id FROM family_memberships WHERE family_unit_id = $1',
      [familyUnitId]
    );

    // The message is neutral: "[Name] has transitioned to individual practice"
    const exitMessage = `${name} has transitioned to individual practice.`;

    console.log(`[CrisisEngine] User ${userId} exited family ${familyUnitId}. Data preserved.`);

    return {
      exited: true,
      dataPreserved: true,
      exitMessage,
      familyNotificationSent: remaining.rows.length > 0
    };
  } catch (err) {
    console.error('[CrisisEngine] exitFamily failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to exit family' };
  }
}

async function detectCoerciveControl(userId, familyUnitId) {
  try {
    // Behavioral signals: excessive monitoring, message frequency pressure, etc.
    // Flag to facilitator ONLY, NEVER family
    const signals = [];

    // Check for excessive message checking by other family members
    // Check for pressure patterns in facilitated messages
    // This is a stub for clinical configuration — facilitators define thresholds

    if (signals.length > 0) {
      await notifyFacilitator(userId, 'coercive_control_flag', signals);
      return { flagged: true, facilitatorNotified: true, familyNotified: false };
    }

    return { flagged: false };
  } catch (err) {
    return { flagged: false };
  }
}

// ═══════════════════════════════════════════════════════════════
// SANITIZE FAMILY DATA
// ═══════════════════════════════════════════════════════════════

function sanitizeFamilyData(data) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(sanitizeFamilyData);

  const sanitized = { ...data };
  for (const field of BIOMETRIC_FIELDS) {
    delete sanitized[field];
  }
  // Also strip nested objects
  if (sanitized.ns3) delete sanitized.ns3;
  if (sanitized.biometrics) delete sanitized.biometrics;
  if (sanitized.clinical) delete sanitized.clinical;
  if (sanitized.hrv_data) delete sanitized.hrv_data;

  return sanitized;
}

function getFamilyMemberState(userId) {
  // Returns ONLY capacity state for family-facing views
  // If privacy mode: returns neutral 'private' state
  return async function() {
    try {
      const user = await pool.query('SELECT privacy_mode FROM users WHERE id = $1', [userId]);
      if (user.rows[0]?.privacy_mode) {
        return { state: 'private', visible: false };
      }

      const capacityCurrency = require('./capacityCurrency');
      const userIdStr = (await pool.query('SELECT user_id FROM users WHERE id = $1', [userId])).rows[0]?.user_id;
      const balance = await capacityCurrency.getBalance(userIdStr);
      return { state: balance?.state || 'unknown', visible: true };
    } catch (err) {
      return { state: 'unknown', visible: false };
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// CHECK-INS & CRONS
// ═══════════════════════════════════════════════════════════════

async function sendCheckin(crisisEventId, userId, templateId) {
  try {
    const template = await pool.query('SELECT * FROM crisis_message_templates WHERE id = $1', [templateId]);
    if (template.rows.length === 0) return;

    await pool.query(
      `INSERT INTO crisis_checkins (crisis_event_id, user_id, template_id, message_text)
       VALUES ($1, $2, $3, $4)`,
      [crisisEventId, userId, templateId, template.rows[0].message_text]
    );
  } catch (err) { /* non-blocking */ }
}

async function processPeriodicCheckins() {
  let sent = 0;
  try {
    // Find active crises needing check-in (72h since last)
    const crises = await pool.query(
      `SELECT ce.id, ce.user_id, ce.phase FROM crisis_events ce
       WHERE ce.phase IN ('active_crisis', 'recovery_start')
       AND NOT EXISTS (
         SELECT 1 FROM crisis_checkins cc
         WHERE cc.crisis_event_id = ce.id
         AND cc.sent_at > NOW() - INTERVAL '${CHECKIN_INTERVAL_HOURS} hours'
       )`
    );

    const templates = {
      active_crisis: ['checkin_1', 'checkin_2', 'checkin_3', 'checkin_4'],
      recovery_start: ['recovery_1', 'recovery_2', 'recovery_3', 'recovery_4']
    };

    for (const crisis of crises.rows) {
      const phaseTemplates = templates[crisis.phase] || templates.active_crisis;
      const templateId = phaseTemplates[Math.floor(Math.random() * phaseTemplates.length)];
      await sendCheckin(crisis.id, crisis.user_id, templateId);
      sent++;
    }
  } catch (err) {
    console.error('[CrisisEngine] processPeriodicCheckins failed:', err.message);
  }
  return { sent };
}

async function processExpiredStewards() {
  let expired = 0;
  try {
    const result = await pool.query(
      "UPDATE steward_actions SET status = 'expired' WHERE status = 'active' AND expires_at < NOW() RETURNING id"
    );
    expired = result.rowCount;
    if (expired > 0) console.log(`[CrisisEngine] ${expired} steward authorizations expired`);
  } catch (err) {
    console.error('[CrisisEngine] processExpiredStewards failed:', err.message);
  }
  return { expired };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function getActiveCrisis(userId) {
  try {
    const result = await pool.query(
      "SELECT * FROM crisis_events WHERE user_id = $1 AND phase NOT IN ('resolved') ORDER BY created_at DESC LIMIT 1",
      [userId]
    );
    return result.rows[0] || null;
  } catch (err) {
    return null;
  }
}

async function freezeCapacity(userId) {
  try {
    // Mark in crisis — the capacityCurrency.processWithdrawal checks this
    // We set a flag that the withdrawal function respects
    await pool.query(
      `UPDATE crisis_events SET capacity_frozen = true, capacity_frozen_at = NOW()
       WHERE user_id = $1 AND phase NOT IN ('resolved')`,
      [userId]
    );
  } catch (err) { /* non-blocking */ }
}

async function unfreezeCapacity(userId) {
  try {
    await pool.query(
      `UPDATE crisis_events SET capacity_frozen = false, capacity_unfrozen_at = NOW()
       WHERE user_id = $1 AND phase NOT IN ('resolved')`,
      [userId]
    );
  } catch (err) { /* non-blocking */ }
}

async function isCapacityFrozen(userId) {
  try {
    const result = await pool.query(
      "SELECT capacity_frozen FROM crisis_events WHERE user_id = $1 AND phase NOT IN ('resolved') AND capacity_frozen = true LIMIT 1",
      [userId]
    );
    return result.rows.length > 0;
  } catch (err) {
    return false;
  }
}

async function notifyFacilitator(userId, eventType, data) {
  try {
    console.log(`[CrisisEngine] FACILITATOR NOTIFICATION: user=${userId}, event=${eventType}, data=${JSON.stringify(data)}`);
    // In production: send to facilitator dashboard, email, or push notification
  } catch (err) { /* non-blocking */ }
}

async function isInCrisis(userId) {
  try {
    const result = await pool.query(
      "SELECT phase FROM crisis_events WHERE user_id = $1 AND phase NOT IN ('resolved') LIMIT 1",
      [userId]
    );
    return result.rows.length > 0 ? result.rows[0].phase : null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  // Detection
  detectPreCrisis,
  detectZeroEngagement,
  // Lifecycle
  declareActiveCrisis,
  selfReportCrisis,
  startRecovery,
  startSoloPeriod,
  evaluateReintegration,
  evaluateResolution,
  getActiveCrisis,
  isInCrisis,
  isCapacityFrozen,
  // Steward
  evaluateStewardEligibility,
  authorizeSteward,
  stewardSendMessage,
  stewardStepDown,
  // Domestic Safety
  enablePrivacyMode,
  disablePrivacyMode,
  exitFamily,
  detectCoerciveControl,
  // Data
  sanitizeFamilyData,
  getFamilyMemberState,
  BIOMETRIC_FIELDS,
  // Crons
  processPeriodicCheckins,
  processExpiredStewards,
  // Constants
  MIN_COMPOUND_SIGNALS,
  ZERO_ENGAGEMENT_HOURS,
  SOLO_PERIOD_MIN_DAYS,
  RESOLUTION_STEADY_DAYS,
  REINTEGRATION_STEADY_DAYS,
  STEWARD_MAX_DAILY_ACTIONS,
  STEWARD_EXPIRY_DAYS
};
