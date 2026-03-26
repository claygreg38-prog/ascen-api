// ============================================================
// Bond Maturation Engine — AXIS Module
// File: src/axis/bondMaturationEngine.js
//
// Breathing Bonds mature through 4 tiers:
// Seed → Growth → Mature → Legacy
//
// Maturation is outcome-based, not time-based.
// Quality thresholds must be met regardless of speed.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');
const litEngine = require('./litEngine');
const lineageService = require('../services/lineageService');

const MATURATION_CRITERIA = {
  growth: {
    name: 'Growth Bond',
    criteria: {
      sessions_completed: 30,
      days_active: 30,
      min_fis: 25,
      co_breath_sessions: 5
    }
  },
  mature: {
    name: 'Mature Bond',
    criteria: {
      sessions_completed: 90,
      days_active: 90,
      min_fis: 50,
      co_breath_sessions: 20,
      field_tests_completed: 3,
      crest_version_min: '2.0'
    }
  },
  legacy: {
    name: 'Legacy Bond',
    criteria: {
      sessions_completed: 250,
      days_active: 180,
      min_fis: 75,
      co_breath_sessions: 50,
      field_tests_completed: 10,
      crest_version_min: '3.0',
      quilting_completed: true
    }
  }
};

const BOND_BONUSES = { growth: 50, mature: 200, legacy: 500 };

async function evaluateMaturation(familyUnitId) {
  try {
    const fcr = await pool.query(
      'SELECT bond_tier FROM family_capital_reserves WHERE family_unit_id = $1',
      [familyUnitId]
    );
    const currentTier = fcr.rows[0]?.bond_tier || 'seed';

    const tierOrder = ['seed', 'growth', 'mature', 'legacy'];
    const currentIdx = tierOrder.indexOf(currentTier);
    if (currentIdx >= tierOrder.length - 1) return { current: currentTier, next: null, ready: false };

    const nextTier = tierOrder[currentIdx + 1];
    const criteria = MATURATION_CRITERIA[nextTier].criteria;
    const results = {};

    // Sessions completed
    const sessions = await pool.query(
      `SELECT COUNT(*) FROM session_completions sc
       JOIN family_memberships fm ON fm.user_id = sc.user_id
       WHERE fm.family_unit_id = $1 AND sc.session_active = false`,
      [familyUnitId]
    );
    const sessionCount = parseInt(sessions.rows[0].count);
    results.sessions_completed = { value: sessionCount, threshold: criteria.sessions_completed, met: sessionCount >= criteria.sessions_completed };

    // Days active
    const firstSession = await pool.query(
      `SELECT MIN(sc.created_at) as min FROM session_completions sc
       JOIN family_memberships fm ON fm.user_id = sc.user_id
       WHERE fm.family_unit_id = $1`,
      [familyUnitId]
    );
    const daysActive = firstSession.rows[0]?.min
      ? Math.floor((Date.now() - new Date(firstSession.rows[0].min)) / (24 * 60 * 60 * 1000))
      : 0;
    results.days_active = { value: daysActive, threshold: criteria.days_active, met: daysActive >= criteria.days_active };

    // FIS
    const fis = await pool.query(
      'SELECT score FROM family_investment_scores WHERE family_unit_id = $1 ORDER BY computed_at DESC LIMIT 1',
      [familyUnitId]
    );
    const fisScore = parseFloat(fis.rows[0]?.score || 0);
    results.min_fis = { value: fisScore, threshold: criteria.min_fis, met: fisScore >= criteria.min_fis };

    // Co-breath sessions
    const coBreath = await pool.query(
      `SELECT COUNT(*) FROM session_completions
       WHERE family_unit_id = $1 AND session_type = 'co_breath' AND session_active = false`,
      [familyUnitId]
    );
    const coBreathCount = parseInt(coBreath.rows[0].count);
    results.co_breath_sessions = { value: coBreathCount, threshold: criteria.co_breath_sessions, met: coBreathCount >= criteria.co_breath_sessions };

    // Field tests (mature + legacy)
    if (criteria.field_tests_completed) {
      const ft = await pool.query(
        `SELECT COUNT(*) FROM lineage_entries WHERE family_unit_id = $1 AND entry_type = 'field_test_passed'`,
        [familyUnitId]
      );
      const ftCount = parseInt(ft.rows[0].count);
      results.field_tests_completed = { value: ftCount, threshold: criteria.field_tests_completed, met: ftCount >= criteria.field_tests_completed };
    }

    // Crest version (mature + legacy)
    if (criteria.crest_version_min) {
      const crest = await pool.query(
        'SELECT current_version FROM family_crests WHERE family_unit_id = $1',
        [familyUnitId]
      );
      const version = parseFloat(crest.rows[0]?.current_version || '0');
      const threshold = parseFloat(criteria.crest_version_min);
      results.crest_version = { value: crest.rows[0]?.current_version || '0', threshold: criteria.crest_version_min, met: version >= threshold };
    }

    // Quilting completed (legacy only)
    if (criteria.quilting_completed) {
      const quilting = await pool.query(
        `SELECT COUNT(*) FROM quilting_sessions WHERE family_unit_id = $1 AND session_number = 4 AND status = 'completed'`,
        [familyUnitId]
      );
      const done = parseInt(quilting.rows[0].count) > 0;
      results.quilting_completed = { value: done, threshold: true, met: done };
    }

    const allMet = Object.values(results).every(r => r.met);

    return { current: currentTier, next: nextTier, name: MATURATION_CRITERIA[nextTier].name, ready: allMet, criteria: results };
  } catch (err) {
    Sentry.captureException(err);
    return { current: 'seed', next: 'growth', ready: false, error: err.message };
  }
}

async function matureBond(familyUnitId) {
  const evaluation = await evaluateMaturation(familyUnitId);
  if (!evaluation.ready || !evaluation.next) {
    return { matured: false, reason: evaluation.ready ? 'already_legacy' : 'criteria_not_met', evaluation };
  }

  const fromTier = evaluation.current;
  const toTier = evaluation.next;

  try {
    // Update FCR bond tier
    await pool.query(
      'UPDATE family_capital_reserves SET bond_tier = $1, bond_tier_updated_at = NOW(), updated_at = NOW() WHERE family_unit_id = $2',
      [toTier, familyUnitId]
    );

    // Record maturation event
    await pool.query(`
      INSERT INTO bond_maturation_events (family_unit_id, from_tier, to_tier, criteria_met)
      VALUES ($1, $2, $3, $4)
    `, [familyUnitId, fromTier, toTier, JSON.stringify(evaluation.criteria)]);

    // Lineage ledger
    const members = await pool.query('SELECT user_id FROM family_memberships WHERE family_unit_id = $1', [familyUnitId]);
    const tenantResult = await pool.query('SELECT tenant_id FROM family_units WHERE family_unit_id = $1', [familyUnitId]);
    const tenantId = tenantResult.rows[0]?.tenant_id || null;

    for (const m of members.rows) {
      await lineageService.recordEntry(m.user_id, familyUnitId, tenantId, 'bond_matured', {
        from: fromTier, to: toTier, name: MATURATION_CRITERIA[toTier]?.name
      });
    }

    // LIT bonus for maturation — split equally among all family members
    const bonus = BOND_BONUSES[toTier] || 0;
    if (bonus > 0 && members.rows.length > 0) {
      const perMember = Math.round((bonus / members.rows.length) * 100) / 100;
      for (const m of members.rows) {
        await litEngine.creditBondBonus(m.user_id, familyUnitId, perMember, toTier, tenantId);
      }
    }

    return { matured: true, from: fromTier, to: toTier, bonus };
  } catch (err) {
    Sentry.captureException(err);
    return { matured: false, error: err.message };
  }
}

async function getBondHistory(familyUnitId) {
  const result = await pool.query(
    'SELECT * FROM bond_maturation_events WHERE family_unit_id = $1 ORDER BY matured_at DESC',
    [familyUnitId]
  );
  return result.rows;
}

module.exports = { evaluateMaturation, matureBond, getBondHistory, MATURATION_CRITERIA, BOND_BONUSES };
