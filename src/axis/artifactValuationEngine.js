// ============================================================
// [ABI] AXIS Module — Artifact Valuation Engine
// File: src/axis/artifactValuationEngine.js
//
// Assigns defensible economic value to each healing credential.
// Value = base × milestone × NS3Quality × PIS × jurisdiction × disadvantage
//
// Ceilings:
//   $500 per credential (Finding 3.2)
//   $50,000 annual portfolio (Finding 3.2)
//   25% retroactive increase cap per refresh (Finding 3.3)
//
// NaN guard on ALL multipliers (Finding 3.1)
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── CONSTANTS ───────────────────────────────────────────────

const CREDENTIAL_VALUE_CEILING = 500.00;
const ANNUAL_PORTFOLIO_CEILING = 50000.00;
const RETROACTIVE_INCREASE_CAP = 0.25;
const BASE_CREDENTIAL_VALUE = 25.00;

const JURISDICTION_MULTIPLIERS = {
  'MD': 1.0,
  'MD-PG': 1.15,
  'MD-BALT': 1.25,
  'MD-ANNE_ARUNDEL': 1.05,
  'MD-BALTIMORE_CO': 1.10,
  'MD-HOWARD': 0.95,
  'MD-CHARLES': 1.10,
  'MD-HARFORD': 1.05,
  'DEFAULT': 1.0
};

// ── MAIN COMPUTE ────────────────────────────────────────────

async function computeArtifactValue(userId, sessionCompletionId, isRefresh = false) {
  let userData, sessionData;

  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user.rows.length) throw new Error(`User ${userId} not found`);
    userData = user.rows[0];

    const session = await pool.query('SELECT * FROM session_completions WHERE id = $1', [sessionCompletionId]);
    if (!session.rows.length) throw new Error(`Session ${sessionCompletionId} not found`);
    sessionData = session.rows[0];
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }

  const pis = parseFloat(userData.prevention_impact_score) || 0.5;
  const pisConfidence = userData.pis_confidence || 'preliminary';

  // 1. Milestone Weight
  const milestoneWeight = computeMilestoneWeight(userData, sessionData);

  // 2. NS3 Quality Score
  const ns3Quality = computeNS3Quality(sessionData);

  // 3. PIS Multiplier (confidence-aware)
  let pisMultiplier = 0.5 + (pis * 1.0);
  if (pisConfidence === 'preliminary') {
    pisMultiplier = Math.min(pisMultiplier, 0.8); // Cap preliminary PIS influence
  }

  // 4. Jurisdiction Multiplier
  const jurisdictionCode = userData.jurisdiction_code || 'MD-PG';
  const jurisdictionMultiplier = JURISDICTION_MULTIPLIERS[jurisdictionCode] || JURISDICTION_MULTIPLIERS.DEFAULT;

  // 5. Contextual Disadvantage Multiplier (anti-redlining)
  const contextualMultiplier = await getDisadvantageMultiplier(userData);

  // ── NaN GUARD on ALL multipliers ──────────────────────────
  const multipliers = { milestoneWeight, ns3Quality, pisMultiplier, jurisdictionMultiplier, contextualMultiplier };
  for (const [name, val] of Object.entries(multipliers)) {
    if (val == null || isNaN(val)) {
      Sentry.captureMessage(`NaN/null multiplier in artifact valuation: ${name} for user ${userId}`, 'error');
      multipliers[name] = 1.0;
    }
  }

  // Compute raw value
  let rawValue = BASE_CREDENTIAL_VALUE
    * multipliers.milestoneWeight
    * multipliers.ns3Quality
    * multipliers.pisMultiplier
    * multipliers.jurisdictionMultiplier
    * multipliers.contextualMultiplier;

  // ── ANTI-REDLINING: Barrier boost applied BEFORE ceiling ──
  let barrierBoost = 0;
  try {
    const antiRedlining = require('./antiRedliningEngine');
    const barrierResult = await antiRedlining.computeBarrierBoost(userId);
    if (barrierResult.applied) {
      barrierBoost = barrierResult.boost;
      rawValue = rawValue * (1 + barrierBoost);
    }
  } catch (e) { /* Anti-redlining optional — does not block valuation */ }

  // ── CREDENTIAL CEILING ($500) ─────────────────────────────
  let ceilingApplied = false;
  if (rawValue > CREDENTIAL_VALUE_CEILING) {
    rawValue = CREDENTIAL_VALUE_CEILING;
    ceilingApplied = true;
  }

  // ── RETROACTIVE INCREASE CAP (25%) — decreases uncapped ──
  let previousValue = null;
  let revaluationDelta = null;

  if (isRefresh) {
    try {
      const prev = await pool.query(
        'SELECT value_usd FROM artifact_valuations WHERE session_completion_id = $1 AND is_latest = true',
        [sessionCompletionId]
      );
      if (prev.rows.length) {
        previousValue = parseFloat(prev.rows[0].value_usd);
        const maxIncrease = previousValue * RETROACTIVE_INCREASE_CAP;
        if (rawValue > previousValue + maxIncrease) {
          rawValue = previousValue + maxIncrease;
          ceilingApplied = true;
        }
        // Decreases are uncapped (safety — values can decline freely)
        revaluationDelta = rawValue - previousValue;
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  const finalValue = Math.round(rawValue * 100) / 100;

  // Store valuation
  try {
    if (isRefresh) {
      await pool.query(
        'UPDATE artifact_valuations SET is_latest = false WHERE session_completion_id = $1 AND is_latest = true',
        [sessionCompletionId]
      );
    }

    await pool.query(`
      INSERT INTO artifact_valuations
      (session_completion_id, user_id, tenant_id, value_usd, previous_value_usd, revaluation_delta, ceiling_applied, computation_data, is_latest)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
    `, [
      sessionCompletionId, userId, userData.tenant_id, finalValue,
      previousValue, revaluationDelta, ceilingApplied,
      JSON.stringify({
        base: BASE_CREDENTIAL_VALUE,
        milestoneWeight: multipliers.milestoneWeight,
        ns3Quality: multipliers.ns3Quality,
        pisMultiplier: multipliers.pisMultiplier,
        pis, pisConfidence,
        jurisdictionMultiplier: multipliers.jurisdictionMultiplier,
        jurisdictionCode,
        contextualMultiplier: multipliers.contextualMultiplier,
        disadvantageIndex: parseFloat(userData.disadvantage_index_at_enrollment) || null,
        barrierBoost: barrierBoost || undefined,
        rawBeforeCeiling: ceilingApplied ? rawValue : undefined,
        ceilingApplied,
        retroactiveCap: isRefresh ? RETROACTIVE_INCREASE_CAP : undefined,
        previousValue, revaluationDelta
      })
    ]);

    // Update session_completions
    await pool.query('UPDATE session_completions SET artifact_value_usd = $1 WHERE id = $2', [finalValue, sessionCompletionId]);
  } catch (err) {
    console.error(`[VALUATION] Storage failed for session ${sessionCompletionId}:`, err.message);
    Sentry.captureException(err);
  }

  return { value: finalValue, ceilingApplied, previousValue, revaluationDelta };
}

// ── MILESTONE WEIGHT ────────────────────────────────────────

function computeMilestoneWeight(user, session) {
  const sessionNumber = session.session_number || 1;

  // Family gate multiplier
  let gateMultiplier = 1.0;
  // gate_state is JSONB — check for gate progression
  const gateState = user.gate_state || {};
  const gateCount = [gateState.gate_1, gateState.gate_2, gateState.gate_3].filter(Boolean).length;
  if (gateCount >= 3) gateMultiplier = 3.0;
  else if (gateCount >= 2) gateMultiplier = 2.0;
  else if (gateCount >= 1) gateMultiplier = 1.5;

  // Session milestone bonus
  let milestoneBonus = 1.0;
  if (sessionNumber >= 365) milestoneBonus = 2.5;
  else if (sessionNumber >= 150) milestoneBonus = 2.0;
  else if (sessionNumber >= 100) milestoneBonus = 1.75;
  else if (sessionNumber >= 50) milestoneBonus = 1.5;
  else if (sessionNumber >= 30) milestoneBonus = 1.25;
  else if (sessionNumber >= 10) milestoneBonus = 1.1;

  return gateMultiplier * milestoneBonus;
}

// ── NS3 QUALITY ─────────────────────────────────────────────

function computeNS3Quality(session) {
  const ns3Mean = parseFloat(session.ns3_mean) || 50;
  const coherencePeak = parseFloat(session.coherence_peak) || 0;
  const optimalPct = parseFloat(session.zone_optimal_pct) || 0;

  // Normalize each to 0-1
  const ns3Score = Math.min(ns3Mean / 85, 1.0);
  const coherenceScore = Math.min(coherencePeak / 0.9, 1.0);
  const zoneScore = Math.min(optimalPct / 60, 1.0);

  // Weighted composite → scale to 0.5-2.0 range
  const composite = (ns3Score * 0.4) + (coherenceScore * 0.35) + (zoneScore * 0.25);
  return 0.5 + (composite * 1.5);
}

// ── DISADVANTAGE MULTIPLIER (anti-redlining) ────────────────

async function getDisadvantageMultiplier(userData) {
  // Use stored multiplier if locked at enrollment
  if (userData.disadvantage_index_multiplier && !isNaN(parseFloat(userData.disadvantage_index_multiplier))) {
    const stored = parseFloat(userData.disadvantage_index_multiplier);
    if (stored !== 1.0) return stored; // Only use if actually computed (not default)
  }

  // Compute from census data
  const countyCode = userData.county_code || 'DEFAULT';
  try {
    const census = await pool.query(
      'SELECT disadvantage_index FROM census_data WHERE geographic_level = $1 AND geographic_code = $2',
      ['county', countyCode]
    );

    if (!census.rows.length || census.rows[0].disadvantage_index == null) {
      Sentry.captureMessage(`Missing disadvantage data for county: ${countyCode} — using DEFAULT`, 'warning');
      const fallback = await pool.query(
        "SELECT disadvantage_index FROM census_data WHERE geographic_code = 'DEFAULT'"
      );
      const index = parseFloat(fallback.rows[0]?.disadvantage_index) || 0.5;
      return 1.0 + (index * 1.5);
    }

    const index = parseFloat(census.rows[0].disadvantage_index);
    if (isNaN(index)) {
      Sentry.captureMessage(`NaN disadvantage index for county: ${countyCode}`, 'error');
      return 1.0;
    }

    return 1.0 + (index * 1.5);
  } catch (err) {
    Sentry.captureException(err);
    return 1.0; // Safe default on error
  }
}

// ── PORTFOLIO CEILING CHECK ─────────────────────────────────

async function checkPortfolioCeiling(userId) {
  try {
    const result = await pool.query(`
      SELECT SUM(value_usd) as total FROM artifact_valuations
      WHERE user_id = $1 AND is_latest = true AND computed_at > NOW() - INTERVAL '1 year'
    `, [userId]);
    const total = parseFloat(result.rows[0]?.total) || 0;
    return { total, exceedsCeiling: total > ANNUAL_PORTFOLIO_CEILING };
  } catch (err) {
    Sentry.captureException(err);
    return { total: 0, exceedsCeiling: false };
  }
}

module.exports = {
  computeArtifactValue,
  computeMilestoneWeight,
  computeNS3Quality,
  getDisadvantageMultiplier,
  checkPortfolioCeiling,
  CREDENTIAL_VALUE_CEILING,
  ANNUAL_PORTFOLIO_CEILING,
  RETROACTIVE_INCREASE_CAP,
  BASE_CREDENTIAL_VALUE,
  JURISDICTION_MULTIPLIERS
};
