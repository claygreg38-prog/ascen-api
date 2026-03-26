// ============================================================
// FIS Engine — Family Investment Score
// File: src/axis/fisEngine.js
//
// Composite score (0-100) combining 6 weighted inputs.
// Used for bond maturation and FACC eligibility.
// Pure AXIS math — no AI. Defensible to courts and investors.
//
// Weights: PIS avg (0.25), engagement (0.20), co-regulation (0.20),
//          field tests (0.15), crest (0.10), real world (0.10)
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');

const WEIGHTS = {
  pis_avg: 0.25,
  engagement: 0.20,
  co_regulation: 0.20,
  field_tests: 0.15,
  crest: 0.10,
  real_world: 0.10
};

const CREST_SCORES = { '1.0': 20, '1.5': 40, '2.0': 60, '2.5': 70, '3.0': 100 };

async function computeFIS(familyUnitId) {
  try {
    // 1. Average PIS across family members (PIS is 0-1, scale to 0-100)
    const pisData = await pool.query(
      `SELECT AVG(u.prevention_impact_score) as avg_pis FROM users u
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1 AND u.prevention_impact_score IS NOT NULL`,
      [familyUnitId]
    );
    const pisAvg = Math.min(100, (parseFloat(pisData.rows[0]?.avg_pis || 0)) * 100);

    // 2. Engagement trajectory (active weeks / total weeks since first session)
    const engagement = await pool.query(
      `SELECT COUNT(*) as total,
       COUNT(DISTINCT DATE_TRUNC('week', sc.created_at)) as active_weeks,
       MIN(sc.created_at) as first_session
       FROM session_completions sc
       JOIN family_memberships fm ON fm.user_id = sc.user_id
       WHERE fm.family_unit_id = $1 AND sc.session_active = false`,
      [familyUnitId]
    );
    const totalSessions = parseInt(engagement.rows[0].total);
    const activeWeeks = parseInt(engagement.rows[0].active_weeks);
    const totalWeeks = engagement.rows[0].first_session
      ? Math.max(1, Math.ceil((Date.now() - new Date(engagement.rows[0].first_session)) / (7 * 24 * 60 * 60 * 1000)))
      : 1;
    const engagementScore = Math.min(100, (activeWeeks / totalWeeks) * 100);

    // 3. Co-regulation quality (avg correlation from last 10 co-breaths)
    const coReg = await pool.query(
      `SELECT AVG(correlation_score) as avg_corr FROM (
         SELECT correlation_score FROM session_completions
         WHERE family_unit_id = $1 AND session_type = 'co_breath' AND session_active = false
         ORDER BY created_at DESC LIMIT 10
       ) recent`,
      [familyUnitId]
    );
    const coRegScore = Math.min(100, (parseFloat(coReg.rows[0]?.avg_corr || 0)) * 100);

    // 4. Field test completion rate
    const fieldTests = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE entry_type = 'field_test_passed') as completed,
         COUNT(*) FILTER (WHERE entry_type IN ('field_test_passed', 'firmware_installed')) as total
       FROM lineage_entries WHERE family_unit_id = $1`,
      [familyUnitId]
    );
    const ftCompleted = parseInt(fieldTests.rows[0]?.completed || 0);
    const ftTotal = parseInt(fieldTests.rows[0]?.total || 0);
    const fieldTestScore = ftTotal > 0 ? Math.min(100, (ftCompleted / ftTotal) * 100) : 0;

    // 5. Crest version
    const crest = await pool.query(
      'SELECT current_version FROM family_crests WHERE family_unit_id = $1',
      [familyUnitId]
    );
    const crestVersion = crest.rows[0]?.current_version || '0';
    const crestScore = CREST_SCORES[crestVersion] || 0;

    // 6. Real-world evidence (recognition events from LHX)
    const recognition = await pool.query(
      `SELECT COUNT(*) FROM lit_ledger
       WHERE family_unit_id = $1 AND transaction_type = 'recognition_event'`,
      [familyUnitId]
    );
    const realWorldScore = Math.min(100, parseInt(recognition.rows[0].count) * 25);

    // Compute weighted FIS
    const components = {
      pis_avg: pisAvg,
      engagement: engagementScore,
      co_regulation: coRegScore,
      field_tests: fieldTestScore,
      crest: crestScore,
      real_world: realWorldScore
    };

    let fis = 0;
    for (const [key, weight] of Object.entries(WEIGHTS)) {
      const value = components[key] || 0;
      // NaN guard per component
      if (isNaN(value)) {
        Sentry.captureMessage(`FIS NaN component: ${key} for family ${familyUnitId}`, 'error');
        continue;
      }
      fis += value * weight;
    }
    fis = Math.round(fis * 100) / 100;

    // Final NaN guard
    if (isNaN(fis)) {
      Sentry.captureMessage(`FIS NaN for family ${familyUnitId}`, 'error');
      fis = 0;
    }

    const confidenceTier = totalSessions >= 50 ? 'high' : totalSessions >= 15 ? 'medium' : 'low';

    // Store
    const tenantResult = await pool.query('SELECT tenant_id FROM family_units WHERE family_unit_id = $1', [familyUnitId]);
    const tenantId = tenantResult.rows[0]?.tenant_id || null;

    await pool.query(`
      INSERT INTO family_investment_scores (family_unit_id, tenant_id, score, confidence_tier, components, weights)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [familyUnitId, tenantId, fis, confidenceTier, JSON.stringify(components), JSON.stringify(WEIGHTS)]);

    return { score: fis, confidence_tier: confidenceTier, components };
  } catch (err) {
    Sentry.captureException(err);
    return { score: 0, confidence_tier: 'low', components: {}, error: err.message };
  }
}

async function getLatestFIS(familyUnitId) {
  const result = await pool.query(
    'SELECT * FROM family_investment_scores WHERE family_unit_id = $1 ORDER BY computed_at DESC LIMIT 1',
    [familyUnitId]
  );
  return result.rows[0] || null;
}

module.exports = { computeFIS, getLatestFIS, WEIGHTS, CREST_SCORES };
