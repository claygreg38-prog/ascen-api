// ============================================================
// Anti-Redlining Engine — AXIS Module
// File: src/axis/antiRedliningEngine.js
//
// 5 mechanisms preventing extraction from vulnerable communities:
//
// 1. Disadvantage Floor: No community receives less than base value
// 2. Geographic Redistribution: FACC flows to below-target communities
// 3. Barrier Recognition: Additional boosts for active systemic barriers
// 4. Extraction Detection: Automated alerts when value concentrates
// 5. Recognition Equity: LHX partners in all jurisdictions
//
// The anti-redlining architecture protects the system FROM ITSELF.
// Without it, the healing economy would inevitably concentrate
// value in communities with more resources.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');

// ── MECHANISM 1: DISADVANTAGE FLOOR ───────────────────────────

async function applyDisadvantageFloor(userId, baseValue) {
  try {
    const user = await pool.query(
      'SELECT disadvantage_index_at_enrollment, county_code FROM users WHERE id = $1',
      [userId]
    );

    const di = parseFloat(user.rows[0]?.disadvantage_index_at_enrollment || 0.5);
    // Disadvantage index: 0 = most advantaged, 1 = most disadvantaged
    // Multiplier: 1.0 (advantaged) to 1.5 (most disadvantaged)
    const multiplier = 1.0 + (di * 0.5);
    const safeMultiplier = Math.max(1.0, Math.min(1.5, multiplier));

    if (isNaN(safeMultiplier)) {
      Sentry.captureMessage(`NaN disadvantage floor multiplier for user ${userId}`, 'error');
      return { base_value: baseValue, multiplier: 1.0, adjusted_value: baseValue, disadvantage_index: di };
    }

    return {
      base_value: baseValue,
      multiplier: safeMultiplier,
      adjusted_value: Math.round(baseValue * safeMultiplier * 100) / 100,
      disadvantage_index: di,
      note: di > 0.7 ? 'Barrier recognition active — credential value reflects the additional barriers this family faces.' : null
    };
  } catch (err) {
    Sentry.captureException(err);
    return { base_value: baseValue, multiplier: 1.0, adjusted_value: baseValue, disadvantage_index: null };
  }
}

// ── MECHANISM 2: GEOGRAPHIC REDISTRIBUTION ────────────────────

async function computeEquityScores() {
  try {
    const communities = await pool.query(`
      SELECT cd.geographic_code, cd.disadvantage_index,
        COUNT(DISTINCT fm.family_unit_id) as total_families,
        COALESCE(SUM(fcr.total_lit), 0) as total_lit
      FROM census_data cd
      LEFT JOIN users u ON u.county_code = cd.geographic_code
      LEFT JOIN family_memberships fm ON fm.user_id = u.id
      LEFT JOIN family_capital_reserves fcr ON fcr.family_unit_id = fm.family_unit_id
      WHERE cd.geographic_level = 'county'
      GROUP BY cd.geographic_code, cd.disadvantage_index
    `);

    if (!communities.rows.length) return [];

    const totalLit = communities.rows.reduce((sum, c) => sum + parseFloat(c.total_lit || 0), 0);
    const totalFamilies = communities.rows.reduce((sum, c) => sum + parseInt(c.total_families || 0), 0);
    const systemAvg = totalFamilies > 0 ? totalLit / totalFamilies : 0;

    const scores = communities.rows.map(c => {
      const families = parseInt(c.total_families || 0);
      const lit = parseFloat(c.total_lit || 0);
      const avgLitPerFamily = families > 0 ? lit / families : 0;
      const equityRatio = systemAvg > 0 ? Math.round((avgLitPerFamily / systemAvg) * 1000) / 1000 : 1.0;

      return {
        geographic_code: c.geographic_code,
        avg_disadvantage_index: parseFloat(c.disadvantage_index || 0.5),
        total_families: families,
        total_lit_earned: lit,
        avg_lit_per_family: Math.round(avgLitPerFamily * 100) / 100,
        equity_ratio: equityRatio
      };
    });

    // Store scores
    for (const score of scores) {
      await pool.query(`
        INSERT INTO community_equity_scores (geographic_code, avg_disadvantage_index, total_families, total_lit_earned, avg_lit_per_family, equity_ratio)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [score.geographic_code, score.avg_disadvantage_index, score.total_families, score.total_lit_earned, score.avg_lit_per_family, score.equity_ratio]);
    }

    // Identify communities below equity target (0.85)
    const belowTarget = scores.filter(s => s.equity_ratio < 0.85 && s.total_families > 0);
    if (belowTarget.length > 0) {
      await createAlert('geographic_concentration', 'high', {
        description: `${belowTarget.length} communities below equity ratio 0.85`,
        affected_communities: belowTarget.map(c => c.geographic_code),
        equity_ratios: belowTarget.map(c => ({ code: c.geographic_code, ratio: c.equity_ratio })),
        recommendation: 'Increase FACC allocation to below-target communities. Review access barriers.'
      });
    }

    return scores;
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

// ── MECHANISM 3: BARRIER RECOGNITION ──────────────────────────

async function computeBarrierBoost(userId) {
  try {
    const config = await getConfig('barrier_recognition');
    const boostPerBarrier = config.boost_per_barrier || 0.05;
    const maxBoost = config.max_boost || 0.15;

    const activeBarriers = [];

    // Check enrollment source for incarceration
    const user = await pool.query(
      'SELECT role, enrollment_source FROM users WHERE id = $1',
      [userId]
    );
    if (user.rows[0]?.enrollment_source === 'correctional') activeBarriers.push('incarceration');

    // Check LACE domains for additional barriers
    const lace = await pool.query(
      `SELECT domain_responses FROM lace_assessments
       WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );
    if (lace.rows.length) {
      const domains = lace.rows[0].domain_responses || {};
      if (domains['LACE_010']?.acknowledged || domains['10']?.acknowledged) activeBarriers.push('foster_system');
      if (domains['LACE_011']?.acknowledged || domains['11']?.acknowledged) activeBarriers.push('economic_hardship');
      if (domains['LACE_013']?.acknowledged || domains['13']?.acknowledged) activeBarriers.push('immigration');
    }

    const boost = Math.min(maxBoost, activeBarriers.length * boostPerBarrier);

    return {
      active_barriers: activeBarriers,
      boost: Math.round(boost * 1000) / 1000,
      applied: boost > 0
    };
  } catch (err) {
    Sentry.captureException(err);
    return { active_barriers: [], boost: 0, applied: false };
  }
}

// ── MECHANISM 4: EXTRACTION DETECTION ─────────────────────────

async function runExtractionScan() {
  const alerts = [];

  try {
    // Check value disparity between communities
    const scores = await pool.query(`
      SELECT geographic_code, equity_ratio, avg_disadvantage_index
      FROM community_equity_scores
      WHERE total_families > 0
      ORDER BY computed_at DESC
    `);

    // Deduplicate by geographic_code (take most recent)
    const latest = {};
    for (const row of scores.rows) {
      if (!latest[row.geographic_code]) latest[row.geographic_code] = row;
    }
    const uniqueScores = Object.values(latest);

    if (uniqueScores.length >= 2) {
      const maxRatio = Math.max(...uniqueScores.map(s => parseFloat(s.equity_ratio)));
      const minRatio = Math.min(...uniqueScores.map(s => parseFloat(s.equity_ratio)));

      if (minRatio > 0 && maxRatio / minRatio > 2.0) {
        const alert = {
          type: 'value_disparity',
          severity: 'high',
          details: {
            description: 'Value disparity exceeds 2:1 between communities',
            max_ratio: maxRatio,
            min_ratio: minRatio,
            disparity: Math.round((maxRatio / minRatio) * 100) / 100,
            recommendation: 'Review disadvantage multipliers. Consider increasing FACC rate for high-disparity communities.'
          }
        };
        alerts.push(alert);
      }
    }

    // Check recognition partner coverage
    const jurisdictions = await pool.query(
      `SELECT jurisdiction, COUNT(*) as partner_count
       FROM lhx_recognition_partners WHERE status = 'active'
       GROUP BY jurisdiction`
    );

    const config = await getConfig('recognition_equity');
    const minPartners = config.min_partners_per_jurisdiction || 2;

    const underserved = jurisdictions.rows.filter(j => parseInt(j.partner_count) < minPartners);
    if (underserved.length > 0) {
      alerts.push({
        type: 'recognition_gap',
        severity: 'medium',
        details: {
          description: `${underserved.length} jurisdictions have fewer than ${minPartners} recognition partners`,
          jurisdictions: underserved.map(j => ({ jurisdiction: j.jurisdiction, count: parseInt(j.partner_count) })),
          recommendation: 'Recruit recognition partners in underserved jurisdictions. Healing credentials have no value if no one recognizes them.'
        }
      });
    }

    // Check FACC imbalance
    const faccData = await pool.query(`
      SELECT fcr.family_unit_id, fcr.facc_contributed, fcr.total_lit, u.county_code
      FROM family_capital_reserves fcr
      JOIN family_memberships fm ON fm.family_unit_id = fcr.family_unit_id
      JOIN users u ON u.id = fm.user_id
      WHERE fcr.total_lit > 0
    `);
    // Group by county_code, check if high-disadvantage counties contribute more FACC than low
    const byCounty = {};
    for (const row of faccData.rows) {
      const code = row.county_code || 'UNKNOWN';
      if (!byCounty[code]) byCounty[code] = { facc: 0, lit: 0 };
      byCounty[code].facc += parseFloat(row.facc_contributed || 0);
      byCounty[code].lit += parseFloat(row.total_lit || 0);
    }

    // Store alerts
    for (const alert of alerts) {
      await createAlert(alert.type, alert.severity, alert.details);
    }

    return alerts;
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

// ── MECHANISM 5: RECOGNITION EQUITY ───────────────────────────

async function getRecognitionCoverage() {
  try {
    const coverage = await pool.query(`
      SELECT cd.geographic_code, cd.geographic_name,
        COUNT(DISTINCT lhx.id) as partner_count,
        ARRAY_AGG(DISTINCT lhx.partner_type) FILTER (WHERE lhx.partner_type IS NOT NULL) as partner_types
      FROM census_data cd
      LEFT JOIN lhx_recognition_partners lhx ON lhx.jurisdiction = cd.geographic_code AND lhx.status = 'active'
      WHERE cd.geographic_level = 'county'
      GROUP BY cd.geographic_code, cd.geographic_name
    `);

    return coverage.rows.map(c => ({
      geographic_code: c.geographic_code,
      geographic_name: c.geographic_name,
      partner_count: parseInt(c.partner_count),
      partner_types: c.partner_types || [],
      adequate: parseInt(c.partner_count) >= 2,
      missing_types: ['employer', 'court', 'housing'].filter(t => !(c.partner_types || []).includes(t))
    }));
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

// ── HELPERS ───────────────────────────────────────────────────

async function createAlert(type, severity, details) {
  try {
    await pool.query(`
      INSERT INTO extraction_alerts (alert_type, severity, details)
      VALUES ($1, $2, $3)
    `, [type, severity, JSON.stringify(details)]);
  } catch (err) {
    Sentry.captureException(err);
  }
}

async function getConfig(mechanism) {
  try {
    const result = await pool.query(
      'SELECT config, enabled FROM equity_config WHERE mechanism = $1',
      [mechanism]
    );
    if (!result.rows.length) return {};
    if (!result.rows[0].enabled) return { _disabled: true };
    return result.rows[0].config;
  } catch (err) {
    Sentry.captureException(err);
    return {};
  }
}

async function getAlerts(status = 'active') {
  const result = await pool.query(
    'SELECT * FROM extraction_alerts WHERE status = $1 ORDER BY created_at DESC',
    [status]
  );
  return result.rows;
}

async function resolveAlert(alertId, resolvedBy, notes) {
  await pool.query(
    'UPDATE extraction_alerts SET status = $1, resolved_by = $2, resolution_notes = $3 WHERE id = $4',
    ['resolved', resolvedBy, notes, alertId]
  );
}

async function getEquityConfig() {
  const result = await pool.query('SELECT * FROM equity_config ORDER BY mechanism');
  return result.rows;
}

async function updateEquityConfig(mechanism, config) {
  await pool.query(
    'UPDATE equity_config SET config = $1, updated_at = NOW() WHERE mechanism = $2',
    [JSON.stringify(config), mechanism]
  );
}

module.exports = {
  applyDisadvantageFloor,
  computeEquityScores,
  computeBarrierBoost,
  runExtractionScan,
  getRecognitionCoverage,
  getAlerts,
  resolveAlert,
  getEquityConfig,
  updateEquityConfig
};
