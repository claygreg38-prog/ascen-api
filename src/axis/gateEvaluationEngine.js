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

module.exports = { evaluateGate, evaluateAllGates, getGateStatus, GATE_CRITERIA };
