// ============================================================
// Gate Evaluation Engine — AXIS Module
// File: src/axis/gateEvaluationEngine.js
//
// Evaluates family readiness for depth work (System Weave).
// Gates are biometric-based, not time-based.
// The family NEVER knows gates exist. They feel paced, not blocked.
//
// Gate 0: Network Boot (auto-open)
// Gate 1: Network Stable (co-breath history, co-regulation, no depleted, LACE)
// Gate 2: Network Resilient (HP dimensions, no dysregulation, Steady+, co-reg 3x, no crisis)
// Gate 3: Network Woven (deprecation, testimony, bridge, NS3 trending, vulnerability check)
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');
const { runAsymmetricVulnerabilityCheck } = require('./asymmetricVulnerabilityCheck');

const GATE_CRITERIA = {
  0: { name: 'Network Boot', criteria: [], auto_open: true },
  1: {
    name: 'Network Stable',
    criteria: [
      {
        id: 'co_breath_count',
        check: async (familyUnitId) => {
          const result = await pool.query(
            `SELECT COUNT(*) FROM session_completions
             WHERE family_unit_id = $1 AND session_type = 'co_breath' AND session_active = false`,
            [familyUnitId]
          );
          const count = parseInt(result.rows[0].count);
          return { met: count >= 5, value: count, threshold: 5 };
        }
      },
      {
        id: 'co_regulation_trend',
        check: async (familyUnitId) => {
          const sessions = await pool.query(
            `SELECT correlation_score FROM session_completions
             WHERE family_unit_id = $1 AND session_type = 'co_breath' AND session_active = false
             ORDER BY created_at`,
            [familyUnitId]
          );
          if (sessions.rows.length < 4) return { met: false, value: 'insufficient_data', threshold: 'stable_or_improving' };
          const early = sessions.rows.slice(0, 2).reduce((sum, r) => sum + (r.correlation_score || 0), 0) / 2;
          const late = sessions.rows.slice(-2).reduce((sum, r) => sum + (r.correlation_score || 0), 0) / 2;
          return { met: late >= early - 0.05, value: { early, late }, threshold: 'no_decline' };
        }
      },
      {
        id: 'no_depleted_members',
        check: async (familyUnitId) => {
          const members = await pool.query(
            `SELECT DISTINCT ON (u.id) u.id, cs.state FROM family_memberships fm
             JOIN users u ON u.id = fm.user_id
             LEFT JOIN capacity_snapshots cs ON cs.user_id = u.id
             WHERE fm.family_unit_id = $1
             ORDER BY u.id, cs.created_at DESC`,
            [familyUnitId]
          );
          const depleted = members.rows.filter(m => m.state === 'depleted');
          return { met: depleted.length === 0, value: depleted.length, threshold: 0 };
        }
      },
      {
        id: 'lace_with_armor',
        check: async (familyUnitId) => {
          const lace = await pool.query(
            `SELECT confirmed_armors FROM lace_assessments
             WHERE family_unit_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
            [familyUnitId]
          );
          if (!lace.rows.length) return { met: false, value: 0, threshold: 1 };
          const confirmed = (lace.rows[0].confirmed_armors || []).filter(a => a.confirmed);
          return { met: confirmed.length >= 1, value: confirmed.length, threshold: 1 };
        }
      }
    ]
  },
  2: {
    name: 'Network Resilient',
    criteria: [
      {
        id: 'heritage_price_dimensions',
        check: async (familyUnitId) => {
          const hp = await pool.query(
            `SELECT dimensions FROM heritage_price_sessions
             WHERE family_unit_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
            [familyUnitId]
          );
          const dimCount = hp.rows.length ? Object.keys(hp.rows[0].dimensions || {}).length : 0;
          return { met: dimCount >= 2, value: dimCount, threshold: 2 };
        }
      },
      {
        // FIX #2: Removed permissive fallback. Only passes if at least one HP session
        // completed WITHOUT sustained dysregulation (>3 min below baseline).
        // Previous code: `return { met: clean || hpSessions.rows.length > 0 }`
        // That passed ANY family with ANY completed HP session, defeating the gate.
        id: 'hp_without_mutual_dysregulation',
        check: async (familyUnitId) => {
          const hpSessions = await pool.query(
            `SELECT biometric_snapshots FROM heritage_price_sessions
             WHERE family_unit_id = $1 AND status = 'completed'`,
            [familyUnitId]
          );
          if (!hpSessions.rows.length) return { met: false, value: false, threshold: true };
          const clean = hpSessions.rows.some(s => {
            const snapshots = s.biometric_snapshots || [];
            const sustained = snapshots.filter(snap => snap.sustained_below_baseline_seconds > 180);
            return sustained.length === 0;
          });
          return { met: clean, value: clean, threshold: true };
        }
      },
      {
        id: 'all_members_steady_plus',
        check: async (familyUnitId) => {
          const members = await pool.query(
            `SELECT DISTINCT ON (u.id) u.id, cs.state FROM family_memberships fm
             JOIN users u ON u.id = fm.user_id
             LEFT JOIN capacity_snapshots cs ON cs.user_id = u.id
             WHERE fm.family_unit_id = $1
             ORDER BY u.id, cs.created_at DESC`,
            [familyUnitId]
          );
          const belowSteady = members.rows.filter(m => ['drawing_down', 'low', 'depleted'].includes(m.state));
          return { met: belowSteady.length === 0, value: belowSteady.length, threshold: 0 };
        }
      },
      {
        id: 'co_reg_above_baseline_3x',
        check: async (familyUnitId) => {
          const sessions = await pool.query(
            `SELECT correlation_score FROM session_completions
             WHERE family_unit_id = $1 AND session_type = 'co_breath' AND session_active = false
             ORDER BY created_at DESC LIMIT 3`,
            [familyUnitId]
          );
          if (sessions.rows.length < 3) return { met: false, value: sessions.rows.length, threshold: 3 };
          const allAbove = sessions.rows.every(s => (s.correlation_score || 0) > 0.3);
          return { met: allAbove, value: sessions.rows.map(s => s.correlation_score), threshold: 'all > 0.3' };
        }
      },
      {
        id: 'no_crisis_flags',
        check: async (familyUnitId) => {
          const flags = await pool.query(
            `SELECT COUNT(*) FROM immune_flags
             WHERE family_unit_id = $1 AND status = 'active' AND severity IN ('critical', 'high')`,
            [familyUnitId]
          );
          return { met: parseInt(flags.rows[0].count) === 0, value: parseInt(flags.rows[0].count), threshold: 0 };
        }
      }
    ]
  },
  3: {
    name: 'Network Woven',
    criteria: [
      {
        id: 'deprecation_completed',
        check: async (familyUnitId) => {
          const deprc = await pool.query(
            `SELECT COUNT(*) FROM lineage_entries
             WHERE family_unit_id = $1 AND entry_type = 'firmware_completed'
             AND entry_data->>'firmware_type' = 'deprecation'`,
            [familyUnitId]
          );
          return { met: parseInt(deprc.rows[0].count) >= 1, value: parseInt(deprc.rows[0].count), threshold: 1 };
        }
      },
      {
        id: 'elder_testimony_completed',
        check: async (familyUnitId) => {
          const testimony = await pool.query(
            'SELECT COUNT(*) FROM generational_activities WHERE family_unit_id = $1 AND activity_type = $2',
            [familyUnitId, 'elder_testimony']
          );
          return { met: parseInt(testimony.rows[0].count) >= 1, value: parseInt(testimony.rows[0].count), threshold: 1 };
        }
      },
      {
        id: 'parent_bridge_completed',
        check: async (familyUnitId) => {
          const bridge = await pool.query(
            'SELECT COUNT(*) FROM generational_activities WHERE family_unit_id = $1 AND activity_type = $2',
            [familyUnitId, 'parent_bridge']
          );
          return { met: parseInt(bridge.rows[0].count) >= 1, value: parseInt(bridge.rows[0].count), threshold: 1 };
        }
      },
      {
        // FIX #3: ns3_mean IS a top-level column on session_completions (Migration 013).
        // Verified: ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS ns3_mean INTEGER;
        id: 'ns3_trending_up',
        check: async (familyUnitId) => {
          const members = await pool.query(
            'SELECT user_id FROM family_memberships WHERE family_unit_id = $1',
            [familyUnitId]
          );
          for (const m of members.rows) {
            const sessions = await pool.query(
              `SELECT ns3_mean FROM session_completions
               WHERE user_id = $1 AND session_active = false
               ORDER BY created_at DESC LIMIT 5`,
              [m.user_id]
            );
            if (sessions.rows.length < 5) return { met: false, value: 'insufficient_sessions', threshold: 5 };
            const values = sessions.rows.map(s => s.ns3_mean || 0).reverse();
            const firstHalf = values.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
            const secondHalf = values.slice(-2).reduce((a, b) => a + b, 0) / 2;
            if (secondHalf < firstHalf - 5) return { met: false, value: 'declining', threshold: 'stable_or_improving' };
          }
          return { met: true, value: 'all_trending_up', threshold: 'stable_or_improving' };
        }
      },
      {
        id: 'asymmetric_vulnerability_passed',
        check: async (familyUnitId) => {
          return await runAsymmetricVulnerabilityCheck(familyUnitId);
        }
      }
    ]
  }
};

async function evaluateGate(familyUnitId, gateNumber) {
  const gate = GATE_CRITERIA[gateNumber];
  if (!gate) return { error: 'Unknown gate' };
  if (gate.auto_open) return { gate: gateNumber, status: 'open', criteria: {} };

  const results = {};
  let allMet = true;

  for (const criterion of gate.criteria) {
    try {
      const result = await criterion.check(familyUnitId);
      results[criterion.id] = { ...result, evaluated_at: new Date() };
      if (!result.met) allMet = false;
    } catch (err) {
      results[criterion.id] = { met: false, error: err.message, evaluated_at: new Date() };
      allMet = false;
      Sentry.captureException(err);
    }
  }

  // Store evaluation — requires UNIQUE(family_unit_id, gate_number) from migration 049
  await pool.query(`
    INSERT INTO gate_evaluations (family_unit_id, gate_number, status, criteria_results, last_evaluated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (family_unit_id, gate_number) DO UPDATE SET
      status = $3, criteria_results = $4, last_evaluated_at = NOW(),
      opened_at = CASE WHEN $3 = 'open' AND gate_evaluations.status != 'open' THEN NOW() ELSE gate_evaluations.opened_at END
  `, [familyUnitId, gateNumber, allMet ? 'open' : 'locked', JSON.stringify(results)]);

  return { gate: gateNumber, name: gate.name, status: allMet ? 'open' : 'locked', criteria: results };
}

async function evaluateAllGates(familyUnitId) {
  const results = [];
  for (let g = 0; g <= 3; g++) {
    const result = await evaluateGate(familyUnitId, g);
    results.push(result);
    if (result.status !== 'open') break;
  }
  return results;
}

async function getGateStatus(familyUnitId) {
  const result = await pool.query(
    `SELECT gate_number, status, criteria_results, opened_at, last_evaluated_at
     FROM gate_evaluations WHERE family_unit_id = $1 ORDER BY gate_number`,
    [familyUnitId]
  );
  return result.rows;
}

// ════════════════════════════════════════════════════════════════
// COUPLING UNLOCK GATE (Tending) — A1
// Both partners must have completed foundation through S15 individually
// before Coupling unlocks. Curriculum track is NOT recorded on
// session_completions (the `track` column is NULL across all rows), so
// "reached S15" is verified as a COMPLETED session at session_number >= 15.
// Coupling modules cap at 14, so a coupling completion can never self-satisfy
// this. The ~8-day calendar minimum is a natural consequence of reaching S15
// at AM/PM cadence — no separate timer. Extends this engine (no parallel gate
// path); partnershipEngine calls it.
// ════════════════════════════════════════════════════════════════
const COUPLING_UNLOCK_SESSION = 15;

async function partnerUnlockStatus(userId) {
  // session_completions.user_id is stored inconsistently — text user_id on some
  // rows, integer-id-as-text on others. Match on ALL of this user's id forms so
  // the gate finds completions whether the route passed a text id or a resolved
  // users.id, and regardless of how the session was originally started.
  const forms = new Set([String(userId)]);
  try {
    const u = await pool.query(
      `SELECT id, user_id, participant_id FROM users WHERE id = $1 OR user_id = $2`,
      [parseInt(userId) || 0, String(userId)]
    );
    if (u.rows[0]) {
      forms.add(String(u.rows[0].id));
      if (u.rows[0].user_id) forms.add(String(u.rows[0].user_id));
      if (u.rows[0].participant_id) forms.add(String(u.rows[0].participant_id));
    }
  } catch (e) { /* fall back to the raw id form */ }

  const r = await pool.query(
    `SELECT COALESCE(MAX(session_number), 0) AS max_session,
            COALESCE(BOOL_OR(session_number >= $2), false) AS reached
     FROM session_completions
     WHERE user_id = ANY($1) AND session_active = false`,
    [Array.from(forms), COUPLING_UNLOCK_SESSION]
  );
  const maxSession = parseInt(r.rows[0].max_session, 10) || 0;
  const reached = r.rows[0].reached === true;
  return {
    reached_s15: reached,
    max_session: maxSession,
    needs: reached ? 0 : Math.max(0, COUPLING_UNLOCK_SESSION - maxSession),
  };
}

async function evaluateCouplingUnlock(partnerAId, partnerBId) {
  const [a, b] = await Promise.all([
    partnerUnlockStatus(partnerAId),
    partnerUnlockStatus(partnerBId),
  ]);
  const unlocked = a.reached_s15 && b.reached_s15;
  return {
    gate: 'coupling_unlock',
    status: unlocked ? 'unlocked' : 'locked',
    threshold_session: COUPLING_UNLOCK_SESSION,
    reason: unlocked
      ? 'Coupling is unlocked — both of you have reached S15.'
      : 'Coupling unlocks when both of you reach S15.',
    partner_a: { user_id: partnerAId, ...a },
    partner_b: { user_id: partnerBId, ...b },
  };
}

// ════════════════════════════════════════════════════════════════
// COUPLING DV-SCREENING GATE (Tending) — B1 (Jenae's 5-state framework)
// Deny-by-default entry gate for ALL Coupling modules. Entry is ALLOWED only when
// dv_screening_status IN ('pass','pass_with_support'); every other value
// (not_screened | clinical_review_required | not_appropriate | missing row)
// DENIES — so it is structurally impossible to enter ungated, even before the
// screening intake exists. 'pass_with_support' allows but flags
// requires_support_monitoring so downstream can schedule check-ins + give the
// clinician visibility. NO screening/scoring logic lives here (Jenae owns the
// intake build). Extends this engine (no parallel gate path).
//
// Fast-follow room (NOT built): 90-day re-screen expiry keyed on dv_screened_at
// (returned below); active protective-order -> auto clinical_review_required.
// ════════════════════════════════════════════════════════════════
const COUPLING_DV_ALLOWED = ['pass', 'pass_with_support'];
const COUPLING_DV_REASONS = {
  not_screened: 'DV screening required before Coupling.',
  clinical_review_required: 'Pending clinician review.',
  not_appropriate: 'Not available at this time.',
};

async function evaluateCouplingDvGate(partnershipId) {
  const r = await pool.query(
    `SELECT dv_screening_status, dv_screened_at FROM partnership_practices WHERE id = $1`,
    [partnershipId]
  );
  const dvStatus = r.rows[0]?.dv_screening_status || 'not_screened';
  const allowed = COUPLING_DV_ALLOWED.includes(dvStatus);
  return {
    gate: 'coupling_dv_screening',
    status: allowed ? 'allowed' : 'denied',
    dv_screening_status: dvStatus,
    dv_screened_at: r.rows[0]?.dv_screened_at || null, // surfaced for the 90-day expiry fast-follow
    reason: allowed ? null : (COUPLING_DV_REASONS[dvStatus] || 'DV screening required before Coupling.'),
    requires_support_monitoring: dvStatus === 'pass_with_support',
  };
}

// ════════════════════════════════════════════════════════════════
// COUPLING MIN-GAP GATE (Tending) — B2
// Reject starting a new Coupling module within 48h of the partnership's last
// COMPLETED module. First module (no prior completion) is allowed — the gap only
// applies between modules. Gap measured against the DB clock (NOW()) to avoid
// app/DB skew. Returns next-available time + a human reason for the UI. Extends
// this engine (no parallel gate path); checked at partnershipEngine.startSession.
// ════════════════════════════════════════════════════════════════
const COUPLING_MIN_GAP_HOURS = 48;

async function evaluateCouplingGap(partnershipId) {
  const r = await pool.query(
    `SELECT MAX(completed_at) AS last_completed,
            EXTRACT(EPOCH FROM (NOW() - MAX(completed_at))) AS elapsed_sec
     FROM partnership_sessions
     WHERE partnership_id = $1 AND completed_at IS NOT NULL`,
    [partnershipId]
  );
  const last = r.rows[0] && r.rows[0].last_completed;
  if (!last) {
    // first module — no prior completion
    return { gate: 'coupling_min_gap', status: 'allowed', last_module_completed_at: null, reason: null };
  }
  const elapsedSec = parseFloat(r.rows[0].elapsed_sec) || 0;
  const minSec = COUPLING_MIN_GAP_HOURS * 3600;
  if (elapsedSec >= minSec) {
    return { gate: 'coupling_min_gap', status: 'allowed', last_module_completed_at: last, reason: null };
  }
  const hoursRemaining = Math.ceil((minSec - elapsedSec) / 3600);
  const nextAvailableAt = new Date(new Date(last).getTime() + minSec * 1000).toISOString();
  return {
    gate: 'coupling_min_gap',
    status: 'denied',
    last_module_completed_at: last,
    next_available_at: nextAvailableAt,
    hours_remaining: hoursRemaining,
    reason: `Your next session unlocks in ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`,
  };
}

module.exports = { evaluateGate, evaluateAllGates, getGateStatus, GATE_CRITERIA, evaluateCouplingUnlock, evaluateCouplingDvGate, evaluateCouplingGap };
