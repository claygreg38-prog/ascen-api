// ============================================================
// [ABI] Partnership Engine — Dyadic Co-Regulation Module
// File: src/abi/partnershipEngine.js
//
// Manages co-regulation between intimate partners. The system
// reads the SPACE BETWEEN two nervous systems, not just
// individual regulation.
//
// Core principle: both partners must have solo practices
// before the dyad work begins. You cannot co-regulate
// what you cannot self-regulate.
//
// Architecture:
//   - Solo before dyad (A1: both partners reach foundation S15)
//   - Relationship Account gates content (0-100, starts 50)
//   - Pattern detection is biometric, not behavioral
//   - System NEVER identifies the "problem partner"
//   - Flooding = immediate pause (non-negotiable)
//   - Repair is always available — rupture is information
// ============================================================

'use strict';

const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// A1/B1/B2 — Coupling gates live in the AXIS gate engine (single gate path, no bypass).
const { evaluateCouplingUnlock, evaluateCouplingDvGate, evaluateCouplingGap } = require('../axis/gateEvaluationEngine');

// DEPRECATED (A1): the raw 5-solo-session count is superseded by the S15 unlock
// gate (evaluateCouplingUnlock). Kept exported for backward compatibility only.
const ENROLLMENT_THRESHOLD = 5;
const ACCOUNT_START = 30.0;   // Fix #5: start at 30, must earn into high-sensitivity topics
const ACCOUNT_MIN = 0;
const ACCOUNT_MAX = 100;

// ═══════════════════════════════════════════════════════════════
// CONFLICT PATTERN SIGNATURES
// Detected from biometric divergence. HOS labels only to users.
// ═══════════════════════════════════════════════════════════════

const CONFLICT_PATTERNS = {
  pursuit_withdrawal: {
    name: 'Pursuit-Withdrawal',
    detection: 'One partner HR increases while the other HRV drops (activating + shutting down)',
    hos_label: 'One system is reaching while the other is retreating',
    intervention: 'co_breath_pause',
    account_cost: 3
  },
  mutual_escalation: {
    name: 'Mutual Escalation',
    detection: 'Both partners HR increasing simultaneously with coherence dropping',
    hos_label: 'Both systems are heating up together',
    intervention: 'co_breath_pause',
    account_cost: 5
  },
  stonewalling: {
    name: 'Stonewalling',
    detection: 'One partner HRV flatlines (RMSSD < 10ms) while HR remains elevated',
    hos_label: 'One system has gone offline while the other is still transmitting',
    intervention: 'individual_reset',
    account_cost: 8
  },
  flooding: {
    name: 'Flooding',
    detection: 'One partner HR exceeds 100 BPM sustained for >60 seconds during conversation',
    hos_label: 'One system is overwhelmed — too much signal, not enough processing',
    intervention: 'session_pause',
    account_cost: 10
  }
};

// Account transaction values
const DEPOSITS = {
  co_breath_completed: 3,
  kitchen_table_completed: 5,
  repair_completed: 8,
  heritage_price_dimension: 4,
  firmware_completed: 6,
  courage_demonstrated: 10
};

const WITHDRAWALS = {
  pursuit_withdrawal: -3,
  mutual_escalation: -5,
  stonewalling: -8,
  flooding: -10,
  missed_session: -2,
  session_aborted: -4
};

// ═══════════════════════════════════════════════════════════════
// ENROLLMENT
// ═══════════════════════════════════════════════════════════════

/**
 * A1 — Coupling unlock eligibility. Both partners must have completed foundation
 * through S15 individually (verified as a completed session at session_number >= 15;
 * coupling caps at module 14 so it can't self-satisfy). Delegates to the AXIS gate
 * rule (single gate path); returns locked/unlocked + reason for the UI.
 */
async function checkEligibility(partnerAId, partnerBId) {
  const gate = await evaluateCouplingUnlock(partnerAId, partnerBId);
  return {
    eligible: gate.status === 'unlocked',
    reason: gate.reason,
    threshold_session: gate.threshold_session,
    // `.sessions` retained for enroll()'s partner_*_sessions columns — now the
    // partner's max completed session_number (foundation progress), not a raw count.
    partner_a: { sessions: gate.partner_a.max_session, reached_s15: gate.partner_a.reached_s15, max_session: gate.partner_a.max_session, needs: gate.partner_a.needs },
    partner_b: { sessions: gate.partner_b.max_session, reached_s15: gate.partner_b.reached_s15, max_session: gate.partner_b.max_session, needs: gate.partner_b.needs },
    gate,
  };
}

/**
 * Enroll a partnership. Both partners must have 5+ solo sessions.
 */
async function enroll(partnerAId, partnerBId, familyUnitId, tenantId) {
  // Fix #4: Canonicalize partner order — always store lower ID as partner_a
  const canonA = Math.min(partnerAId, partnerBId);
  const canonB = Math.max(partnerAId, partnerBId);

  const eligibility = await checkEligibility(canonA, canonB);
  if (!eligibility.eligible) {
    return { enrolled: false, reason: eligibility.reason, eligibility };
  }

  const result = await pool.query(`
    INSERT INTO partnership_practices (partner_a_id, partner_b_id, family_unit_id, tenant_id,
      partner_a_sessions, partner_b_sessions, enrollment_eligible, status, enrolled_at)
    VALUES ($1, $2, $3, $4, $5, $6, true, 'active', NOW())
    ON CONFLICT (LEAST(partner_a_id, partner_b_id), GREATEST(partner_a_id, partner_b_id))
    DO UPDATE SET status = 'active', enrolled_at = NOW(), updated_at = NOW()
    RETURNING id
  `, [canonA, canonB, familyUnitId, tenantId,
      eligibility.partner_a.sessions, eligibility.partner_b.sessions]);

  return { enrolled: true, partnership_id: result.rows[0].id };
}

/**
 * Get partnership for a user (as either partner A or B).
 */
async function getPartnership(userId) {
  const result = await pool.query(
    `SELECT * FROM partnership_practices
     WHERE (partner_a_id = $1 OR partner_b_id = $1) AND status = 'active'
     ORDER BY enrolled_at DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Get partnership by ID.
 */
async function getPartnershipById(partnershipId) {
  const result = await pool.query(
    'SELECT * FROM partnership_practices WHERE id = $1',
    [partnershipId]
  );
  return result.rows[0] || null;
}

/**
 * B1 — DV screening status interface. The clean insertion point for Jenae's
 * clinical screening protocol to call once it exists. NO screening logic here —
 * this only SETS the gate's status field. The deny-by-default gate
 * (gateEvaluationEngine.evaluateCouplingDvGate) reads it; only 'passed' opens
 * Coupling entry. Valid: passed | flagged (and not_screened to reset).
 * @param {number} partnershipId
 * @param {'passed'|'flagged'|'not_screened'} status
 * @param {string|null} setBy - clinician identifier, for audit
 */
async function setDvScreeningStatus(partnershipId, status, setBy = null) {
  const VALID = ['not_screened', 'pass', 'pass_with_support', 'clinical_review_required', 'not_appropriate'];
  if (!VALID.includes(status)) {
    throw new Error(`Invalid dv_screening_status '${status}' — must be one of: ${VALID.join(', ')}`);
  }
  const r = await pool.query(
    `UPDATE partnership_practices
        SET dv_screening_status = $1, dv_screened_at = NOW(), dv_screened_by = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, dv_screening_status, dv_screened_at, dv_screened_by`,
    [status, setBy, partnershipId]
  );
  if (!r.rows.length) throw new Error('Partnership not found');
  return r.rows[0];
}

// ═══════════════════════════════════════════════════════════════
// L1 — SESSION TOKEN + WS ROOM ADMISSION (live co-breath unification)
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve a user_id / code / numeric id -> internal users.id. THE single resolver
 * (canonical home; partnershipRoutes imports this). One implementation used by
 * both the REST routes and the WS room-admission check.
 */
async function resolveUserIdValue(idOrCode) {
  if (idOrCode === undefined || idOrCode === null || idOrCode === '') return null;
  const r = await pool.query(
    'SELECT id FROM users WHERE user_id = $1 OR id = $2',
    [String(idOrCode), parseInt(idOrCode) || 0]
  );
  return r.rows[0] ? r.rows[0].id : null;
}

/**
 * Look up an ACTIVE (not completed) co-breath session + its partnership/partners.
 * The session id (partnership_sessions.id, minted by the gated startSession) is the
 * shared room token.
 */
async function getActiveSession(sessionId) {
  const r = await pool.query(
    `SELECT ps.id, ps.partnership_id, ps.session_type, ps.completed_at,
            pp.partner_a_id, pp.partner_b_id, pp.status AS partnership_status
       FROM partnership_sessions ps
       JOIN partnership_practices pp ON pp.id = ps.partnership_id
      WHERE ps.id = $1`,
    [sessionId]
  );
  return r.rows[0] || null;
}

/**
 * L1 — WS room admission. A room is valid ONLY if a gated startSession minted it
 * (roomCode === the session token), the session is still open, and the joining
 * user is one of its two partners. The gates (S15/DV/48h) themselves run in
 * startSession; this only verifies the minted token — no gate logic duplicated.
 */
async function validateRoomAdmission(sessionId, userId) {
  if (!sessionId) return { ok: false, reason: 'session token required' };
  const s = await getActiveSession(sessionId);
  if (!s) return { ok: false, reason: 'session not found' };
  if (s.completed_at) return { ok: false, reason: 'session already completed' };
  const uid = await resolveUserIdValue(userId);
  if (!uid) return { ok: false, reason: 'user not found' };
  if (uid !== s.partner_a_id && uid !== s.partner_b_id) {
    return { ok: false, reason: 'not a partner of this session' };
  }
  return {
    ok: true,
    partnership_id: s.partnership_id,
    user_db_id: uid,
    is_partner_a: uid === s.partner_a_id,
  };
}

/**
 * L2 — load the server-derived breath params for a session. The WS breathing_start
 * reads from here; the server is the ONLY source of pacing.
 */
async function getSessionBreathParams(sessionId) {
  const r = await pool.query('SELECT breath_params FROM partnership_sessions WHERE id = $1', [sessionId]);
  return r.rows[0] ? (r.rows[0].breath_params || null) : null;
}

/**
 * L2 — derive the dyad's breath pacing server-side. Shared coherent pace for
 * co-breathing together; the ONLY source of breath params (clients never supply
 * them). A richer per-partner / per-module derivation can refine this later
 * without changing the session contract.
 */
function deriveCoBreathParams(sessionType) {
  return {
    mode: 'coherence',
    ratio: '5:5',
    inhale_sec: 5,
    exhale_sec: 5,
    cycle_sec: 10,
    source: 'server_protocol_default',
    session_type: sessionType,
  };
}

// ═══════════════════════════════════════════════════════════════
// DYADIC BASELINE
// ═══════════════════════════════════════════════════════════════

/**
 * Capture dyadic baseline during first co-breath.
 */
async function captureDyadicBaseline(partnershipId, partnerABio, partnerBBio) {
  const correlation = computeCorrelation(
    partnerABio.hrv_series || [],
    partnerBBio.hrv_series || []
  );
  const syncQuality = computeSyncQuality(partnerABio, partnerBBio);

  const baseline = {
    correlation_score: correlation,
    sync_quality: syncQuality,
    individual_baselines: {
      a: { mean_hr: partnerABio.mean_hr, mean_hrv: partnerABio.mean_hrv, coherence: partnerABio.coherence },
      b: { mean_hr: partnerBBio.mean_hr, mean_hrv: partnerBBio.mean_hrv, coherence: partnerBBio.coherence }
    },
    captured_at: new Date().toISOString()
  };

  await pool.query(
    'UPDATE partnership_practices SET dyadic_baseline = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(baseline), partnershipId]
  );

  return baseline;
}

// ═══════════════════════════════════════════════════════════════
// PATTERN DETECTION — biometric, not behavioral
// Uses sustained windows to prevent false positives.
// ═══════════════════════════════════════════════════════════════

// Sustained window requirements (in seconds) — Fix #1
const PATTERN_WINDOWS = {
  pursuit_withdrawal: 30,
  mutual_escalation: 30,
  stonewalling: 60,
  flooding: 60
};

/**
 * Check if a pattern condition has been sustained for the required window.
 * Uses dyadic_buffer accumulated in session state.
 *
 * @param {Array} buffer - Rolling dyadic buffer entries [{...conditions, ts}]
 * @param {string} patternName - Pattern to check
 * @param {Function} conditionFn - (entry) => boolean, checks if condition met on a single tick
 * @returns {boolean} True if condition sustained for required window
 */
function checkSustained(buffer, patternName, conditionFn) {
  const windowSec = PATTERN_WINDOWS[patternName] || 30;
  const windowMs = windowSec * 1000;

  if (!buffer || buffer.length < 2) return false;

  const now = buffer[buffer.length - 1].ts || Date.now();
  const windowStart = now - windowMs;
  const inWindow = buffer.filter(b => (b.ts || 0) >= windowStart);

  // Need at least half the expected readings (2s ticks) to evaluate
  const minReadings = Math.floor(windowSec / 2) * 0.5;
  if (inWindow.length < minReadings) return false;

  // ALL readings in window must meet the condition
  return inWindow.every(conditionFn);
}

/**
 * Detect conflict patterns from rolling dyadic buffer.
 * Fix #1: requires sustained windows, not single-tick detection.
 * Fix #2: stonewalling uses baseline-relative thresholds.
 *
 * INTERNAL ONLY: pursuer/withdrawer/stonewaller/flooded fields are for
 * clinician dashboard and backend analytics. These MUST NEVER appear in
 * any API response to partners. The tick response strips them — only
 * returns { pattern, label }. Architecture Rule 5: system never identifies
 * the "problem partner." (Fix #3)
 */
function detectPatterns(dyadicBuffer, baselineA, baselineB) {
  const patterns = [];
  if (!dyadicBuffer || dyadicBuffer.length < 5) return patterns;

  const bhrA = baselineA?.mean_hr || 72;
  const bhrvA = baselineA?.mean_hrv || 45;
  const brmssdA = baselineA?.mean_rmssd || baselineA?.mean_hrv || 45;
  const bhrB = baselineB?.mean_hr || 72;
  const bhrvB = baselineB?.mean_hrv || 45;
  const brmssdB = baselineB?.mean_rmssd || baselineB?.mean_hrv || 45;

  // Pursuit-withdrawal: one HR up >15% + other HRV dropped >30% (30s sustained)
  if (checkSustained(dyadicBuffer, 'pursuit_withdrawal', (e) =>
    (e.a_hr > bhrA * 1.15 && e.b_hrv < bhrvB * 0.7) ||
    (e.b_hr > bhrB * 1.15 && e.a_hrv < bhrvA * 0.7)
  )) {
    patterns.push({
      pattern: 'pursuit_withdrawal',
      timestamp: new Date().toISOString(),
      ...CONFLICT_PATTERNS.pursuit_withdrawal
    });
  }

  // Mutual escalation: both HR up >10%, both coherence < 0.3 (30s sustained)
  if (checkSustained(dyadicBuffer, 'mutual_escalation', (e) =>
    e.a_hr > bhrA * 1.1 && e.b_hr > bhrB * 1.1 &&
    (e.a_coh || 0) < 0.3 && (e.b_coh || 0) < 0.3
  )) {
    patterns.push({
      pattern: 'mutual_escalation',
      timestamp: new Date().toISOString(),
      ...CONFLICT_PATTERNS.mutual_escalation
    });
  }

  // Stonewalling: Fix #2 — baseline-relative, not hardcoded.
  // RMSSD < 25% of baseline AND HR > 110% of baseline (60s sustained)
  if (checkSustained(dyadicBuffer, 'stonewalling', (e) =>
    (e.a_rmssd < brmssdA * 0.25 && e.a_hr > bhrA * 1.1) ||
    (e.b_rmssd < brmssdB * 0.25 && e.b_hr > bhrB * 1.1)
  )) {
    patterns.push({
      pattern: 'stonewalling',
      timestamp: new Date().toISOString(),
      ...CONFLICT_PATTERNS.stonewalling
    });
  }

  // Flooding: HR > 100 BPM sustained for 60s (already had sustained requirement)
  if (checkSustained(dyadicBuffer, 'flooding', (e) =>
    (e.a_hr || 0) > 100 || (e.b_hr || 0) > 100
  )) {
    patterns.push({
      pattern: 'flooding',
      timestamp: new Date().toISOString(),
      ...CONFLICT_PATTERNS.flooding
    });
  }

  return patterns;
}

/**
 * Update the rolling dyadic buffer with a new tick.
 * Keeps last 60 seconds (30 readings at 2s ticks).
 */
function updateDyadicBuffer(buffer, partnerABio, partnerBBio) {
  const buf = buffer || [];
  buf.push({
    a_hr: partnerABio.hr || 0,
    a_hrv: partnerABio.hrv || 0,
    a_rmssd: partnerABio.rmssd || partnerABio.hrv || 0,
    a_coh: partnerABio.coherence || 0,
    b_hr: partnerBBio.hr || 0,
    b_hrv: partnerBBio.hrv || 0,
    b_rmssd: partnerBBio.rmssd || partnerBBio.hrv || 0,
    b_coh: partnerBBio.coherence || 0,
    ts: Date.now()
  });
  // Keep last 30 entries (60s at 2s intervals)
  while (buf.length > 30) buf.shift();
  return buf;
}

/**
 * Determine intervention for detected patterns.
 * Returns HOS-labeled intervention — never identifies "problem partner."
 */
function determineIntervention(patterns) {
  if (patterns.length === 0) return null;

  // Most severe pattern determines intervention
  const worst = patterns.sort((a, b) => b.account_cost - a.account_cost)[0];

  const INTERVENTION_MESSAGES = {
    co_breath_pause: "Let's pause and breathe together for a moment. There's no rush.",
    individual_reset: 'Each of you take a moment. Close your eyes. Three breaths on your own.',
    session_pause: "Let's stop here for today. What you started matters. We'll come back to it."
  };

  return {
    type: worst.intervention,
    label: worst.hos_label,
    action: INTERVENTION_MESSAGES[worst.intervention] || INTERVENTION_MESSAGES.co_breath_pause
  };
}

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP ACCOUNT
// ═══════════════════════════════════════════════════════════════

/**
 * Update relationship account balance. Clamps to 0-100.
 */
async function updateAccount(partnershipId, amount, reason) {
  const partnership = await pool.query(
    'SELECT account_balance, account_history FROM partnership_practices WHERE id = $1',
    [partnershipId]
  );
  if (!partnership.rows.length) throw new Error('Partnership not found');

  let balance = parseFloat(partnership.rows[0].account_balance) + amount;
  balance = Math.max(ACCOUNT_MIN, Math.min(ACCOUNT_MAX, balance));

  const history = partnership.rows[0].account_history || [];
  history.push({ amount, reason, balance_after: balance, timestamp: new Date().toISOString() });

  // Keep last 100 entries
  const trimmed = history.slice(-100);

  await pool.query(
    'UPDATE partnership_practices SET account_balance = $1, account_history = $2, updated_at = NOW() WHERE id = $3',
    [balance, JSON.stringify(trimmed), partnershipId]
  );

  return balance;
}

/**
 * Get account summary.
 */
async function getAccount(partnershipId) {
  const p = await getPartnershipById(partnershipId);
  if (!p) return null;

  const history = p.account_history || [];
  const recent = history.slice(-20);

  return {
    balance: parseFloat(p.account_balance),
    status: getAccountStatus(parseFloat(p.account_balance)),
    recent_transactions: recent,
    enrolled_at: p.enrolled_at,
    last_session_at: p.last_session_at
  };
}

function getAccountStatus(balance) {
  if (balance >= 60) return 'strong';
  if (balance >= 40) return 'steady';
  if (balance >= 20) return 'rebuilding';
  return 'co_breath_only';
}

/**
 * Get 30-day account trend.
 */
async function getAccountTrend(partnershipId) {
  const p = await getPartnershipById(partnershipId);
  if (!p) return null;

  const history = p.account_history || [];
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recent = history.filter(h => new Date(h.timestamp).getTime() > thirtyDaysAgo);

  if (recent.length < 2) return { trend: 'insufficient_data', data_points: recent.length };

  const firstBalance = recent[0].balance_after;
  const lastBalance = recent[recent.length - 1].balance_after;
  const direction = lastBalance > firstBalance ? 'improving' : lastBalance < firstBalance ? 'declining' : 'stable';

  return {
    trend: direction,
    start_balance: firstBalance,
    current_balance: lastBalance,
    change: Math.round((lastBalance - firstBalance) * 100) / 100,
    transactions_count: recent.length,
    deposits: recent.filter(h => h.amount > 0).length,
    withdrawals: recent.filter(h => h.amount < 0).length
  };
}

// ═══════════════════════════════════════════════════════════════
// PARTNERSHIP SESSIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Start a partnership session.
 */
async function startSession(partnershipId, sessionType) {
  // B1 — DV deny-by-default gate (scope: ALL Coupling). Entry is structurally
  // impossible unless dv_screening_status = 'passed'. Single gate path via the
  // AXIS gate engine; no bypass. Returns { started: false } on deny (route -> 403).
  const dvGate = await evaluateCouplingDvGate(partnershipId);
  if (dvGate.status !== 'allowed') {
    return { started: false, reason: dvGate.reason, gate: dvGate };
  }

  // B2 — 48h minimum gap between modules (first module is allowed). Returns the
  // next-available time + reason; surfaces in the UI via the same 403 path as DV.
  const gapGate = await evaluateCouplingGap(partnershipId);
  if (gapGate.status !== 'allowed') {
    return { started: false, reason: gapGate.reason, gate: gapGate };
  }

  // L2 — server-derived breath pacing, persisted on the session (the ONLY source).
  const breathParams = deriveCoBreathParams(sessionType);
  const result = await pool.query(`
    INSERT INTO partnership_sessions (partnership_id, session_type, breath_params)
    VALUES ($1, $2, $3) RETURNING id
  `, [partnershipId, sessionType, JSON.stringify(breathParams)]);

  await pool.query(
    'UPDATE partnership_practices SET last_session_at = NOW(), updated_at = NOW() WHERE id = $1',
    [partnershipId]
  );

  // pass_with_support entry carries a monitoring flag so downstream can schedule
  // check-ins + give the clinician visibility.
  return {
    session_id: result.rows[0].id,
    session_type: sessionType,
    requires_support_monitoring: dvGate.requires_support_monitoring === true,
  };
}

/**
 * Process a dual-biometric tick during a partnership session.
 * Fix #1: Accumulates dyadic_buffer for sustained window detection.
 * Fix #9: Evaluates ratio step-down independently per partner.
 *
 * @param {Object} partnerABio - Partner A biometric tick
 * @param {Object} partnerBBio - Partner B biometric tick
 * @param {Object} baselineA - Partner A dyadic baseline
 * @param {Object} baselineB - Partner B dyadic baseline
 * @param {Array} dyadicBuffer - Rolling dyadic buffer (mutated in place)
 * @param {Object} partnerARatio - { current, arrival, step_down_count, last_step_down_at, biometric_buffer }
 * @param {Object} partnerBRatio - same structure for B
 * @returns {Object} Tick result with dyadic metrics, patterns, interventions, per-partner ratios
 */
function processTick(partnerABio, partnerBBio, baselineA, baselineB, dyadicBuffer, partnerARatio, partnerBRatio) {
  // Update rolling dyadic buffer
  const updatedBuffer = updateDyadicBuffer(dyadicBuffer || [], partnerABio, partnerBBio);

  // Pattern detection from sustained buffer
  const patterns = detectPatterns(updatedBuffer, baselineA, baselineB);
  const intervention = determineIntervention(patterns);

  // Dyadic metrics
  const syncQuality = computeSyncQuality(partnerABio, partnerBBio);

  // Fix #9: Per-partner ratio step-down evaluation
  let ratioResultA = null;
  let ratioResultB = null;
  try {
    const { evaluateRatioSustainability, updateBiometricBuffer, cooldownElapsed, canStepDown } = require('./ratioStepDown');

    // Partner A ratio evaluation
    if (partnerARatio && partnerARatio.current) {
      const bufA = updateBiometricBuffer(
        partnerARatio.biometric_buffer || [],
        { hr: partnerABio.hr, rmssd: partnerABio.rmssd || partnerABio.hrv || 0, coherence: partnerABio.coherence || 0, ts: Date.now() }
      );
      partnerARatio.biometric_buffer = bufA;

      if (canStepDown(partnerARatio.step_down_count || 0) && cooldownElapsed(partnerARatio.last_step_down_at)) {
        const arrivalA = { hr: baselineA?.mean_hr || 72, rmssd: baselineA?.mean_hrv || 45 };
        ratioResultA = evaluateRatioSustainability(partnerARatio.current, arrivalA, bufA);
      }
    }

    // Partner B ratio evaluation
    if (partnerBRatio && partnerBRatio.current) {
      const bufB = updateBiometricBuffer(
        partnerBRatio.biometric_buffer || [],
        { hr: partnerBBio.hr, rmssd: partnerBBio.rmssd || partnerBBio.hrv || 0, coherence: partnerBBio.coherence || 0, ts: Date.now() }
      );
      partnerBRatio.biometric_buffer = bufB;

      if (canStepDown(partnerBRatio.step_down_count || 0) && cooldownElapsed(partnerBRatio.last_step_down_at)) {
        const arrivalB = { hr: baselineB?.mean_hr || 72, rmssd: baselineB?.mean_hrv || 45 };
        ratioResultB = evaluateRatioSustainability(partnerBRatio.current, arrivalB, bufB);
      }
    }
  } catch (err) {
    // ratioStepDown not available — non-blocking
    Sentry.captureException(err);
  }

  // Drifting word for the dyad
  let drifting_word = null;
  if (syncQuality > 0.7) drifting_word = 'together';
  else if (syncQuality > 0.4) drifting_word = 'finding';

  return {
    dyadic: { sync_quality: syncQuality },
    // Fix #3: only pattern + label to partners, role fields stripped
    patterns: patterns.map(p => ({ pattern: p.pattern, label: p.hos_label })),
    intervention,
    drifting_word,
    dyadic_buffer: updatedBuffer,
    // Fix #9: per-partner ratio state
    partner_a_ratio: ratioResultA,
    partner_b_ratio: ratioResultB
  };
}

/**
 * Complete a partnership session. Updates account based on outcome.
 */
async function completeSession(sessionId, partnershipId, metrics) {
  const { partner_a_biometrics, partner_b_biometrics, dyadic_metrics, detected_patterns, session_type } = metrics;

  // Store session data
  await pool.query(`
    UPDATE partnership_sessions SET
      partner_a_biometrics = $1, partner_b_biometrics = $2,
      dyadic_metrics = $3, detected_patterns = $4,
      completed_at = NOW()
    WHERE id = $5
  `, [
    JSON.stringify(partner_a_biometrics || {}),
    JSON.stringify(partner_b_biometrics || {}),
    JSON.stringify(dyadic_metrics || {}),
    JSON.stringify(detected_patterns || []),
    sessionId
  ]);

  // Deposit to account based on session type
  const depositKey = session_type + '_completed';
  const depositAmount = DEPOSITS[depositKey] || DEPOSITS.co_breath_completed;
  let newBalance = await updateAccount(partnershipId, depositAmount, depositKey);

  // Withdraw for any detected patterns
  if (detected_patterns && detected_patterns.length > 0) {
    for (const p of detected_patterns) {
      const cost = WITHDRAWALS[p.pattern] || 0;
      if (cost < 0) {
        newBalance = await updateAccount(partnershipId, cost, p.pattern);
      }
    }
  }

  // Check if repair is needed (balance dropped significantly or severe pattern)
  const repairNeeded = detected_patterns?.some(p =>
    p.pattern === 'flooding' || p.pattern === 'stonewalling'
  ) || false;

  if (repairNeeded) {
    await pool.query(
      'UPDATE partnership_sessions SET repair_needed = true WHERE id = $1',
      [sessionId]
    );
  }

  return {
    completed: true,
    session_id: sessionId,
    account_balance: newBalance,
    account_status: getAccountStatus(newBalance),
    repair_needed: repairNeeded
  };
}

/**
 * Get session history for a partnership.
 */
async function getSessionHistory(partnershipId, limit) {
  const result = await pool.query(
    `SELECT id, session_type, dyadic_metrics, detected_patterns, repair_needed, repair_completed, created_at
     FROM partnership_sessions WHERE partnership_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [partnershipId, limit || 20]
  );
  return result.rows;
}

// ═══════════════════════════════════════════════════════════════
// PARTNERSHIP TOPICS — gated by account balance
// ═══════════════════════════════════════════════════════════════

/**
 * Get available partnership topics filtered by account balance.
 */
async function getTopics(accountBalance) {
  const result = await pool.query(
    `SELECT id, category, title, description, partner_a_prompt, partner_b_prompt,
            sensitivity_level, min_account_balance, sort_order
     FROM partnership_topics
     WHERE min_account_balance <= $1
     ORDER BY category, sort_order`,
    [accountBalance]
  );
  return result.rows;
}

// ═══════════════════════════════════════════════════════════════
// REPAIR PROTOCOL
// ═══════════════════════════════════════════════════════════════

/**
 * Initiate repair protocol. Always available — rupture is information.
 */
async function initiateRepair(partnershipId, sessionId, reason) {
  if (sessionId) {
    await pool.query(
      'UPDATE partnership_sessions SET repair_needed = true WHERE id = $1',
      [sessionId]
    );
  }

  // Create repair session
  const repairSession = await startSession(partnershipId, 'repair');

  return {
    session_id: repairSession.session_id,
    type: 'repair',
    steps: [
      { step: 1, name: 'Individual reset', description: 'Each partner does a solo breath session (5 minutes)', duration_seconds: 300 },
      { step: 2, name: 'Acknowledgment', description: 'Each partner names what happened in their body (not what the other person did)', format: 'speaking' },
      { step: 3, name: 'Co-breath reconnect', description: 'Partners breathe together without talking (3 minutes)', duration_seconds: 180 },
      { step: 4, name: 'One sentence each', description: 'Each partner says one sentence: "When [thing happened], my body felt [sensation]."', format: 'speaking' },
      { step: 5, name: 'Closing co-breath', description: 'Final co-breath (2 minutes). System reads whether reconnection occurred.', duration_seconds: 120 }
    ],
    reason,
    account_deposit_on_completion: DEPOSITS.repair_completed
  };
}

/**
 * Complete repair protocol. Deposits to account.
 */
async function completeRepair(sessionId, partnershipId, metrics) {
  await pool.query(
    'UPDATE partnership_sessions SET repair_completed = true, repair_data = $1 WHERE id = $2',
    [JSON.stringify(metrics || {}), sessionId]
  );

  const newBalance = await updateAccount(partnershipId, DEPOSITS.repair_completed, 'repair_completed');

  return {
    completed: true,
    session_id: sessionId,
    account_balance: newBalance,
    account_status: getAccountStatus(newBalance)
  };
}

// ═══════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Pearson correlation between two HRV time series.
 */
function computeCorrelation(seriesA, seriesB) {
  if (!seriesA || !seriesB || seriesA.length < 5 || seriesB.length < 5) return 0;
  const n = Math.min(seriesA.length, seriesB.length);
  const meanA = seriesA.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanB = seriesB.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = seriesA[i] - meanA;
    const db = seriesB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

/**
 * Sync quality composite: HRV proximity + coherence proximity + HR stability.
 */
function computeSyncQuality(bioA, bioB) {
  const aHrv = bioA.mean_hrv || bioA.hrv || 0;
  const bHrv = bioB.mean_hrv || bioB.hrv || 0;
  const aCoh = bioA.coherence || 0;
  const bCoh = bioB.coherence || 0;
  const aHr = bioA.mean_hr || bioA.hr || 72;
  const bHr = bioB.mean_hr || bioB.hr || 72;

  const hrvProximity = 1 - Math.abs(aHrv - bHrv) / Math.max(aHrv, bHrv, 1);
  const coherenceProximity = 1 - Math.abs(aCoh - bCoh);
  const hrStability = 1 - (Math.abs(aHr - bHr) / 100);

  return Math.round((hrvProximity * 0.4 + coherenceProximity * 0.4 + hrStability * 0.2) * 100) / 100;
}

module.exports = {
  checkEligibility,
  enroll,
  getPartnership,
  getPartnershipById,
  setDvScreeningStatus,
  resolveUserIdValue,
  getActiveSession,
  validateRoomAdmission,
  getSessionBreathParams,
  captureDyadicBaseline,
  detectPatterns,
  determineIntervention,
  updateDyadicBuffer,
  updateAccount,
  getAccount,
  getAccountTrend,
  startSession,
  processTick,
  completeSession,
  getSessionHistory,
  getTopics,
  initiateRepair,
  completeRepair,
  computeCorrelation,
  computeSyncQuality,
  CONFLICT_PATTERNS,
  DEPOSITS,
  WITHDRAWALS,
  ENROLLMENT_THRESHOLD,
  ACCOUNT_START,
  PATTERN_WINDOWS
};
