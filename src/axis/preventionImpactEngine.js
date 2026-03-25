// ============================================================
// [ABI] AXIS Module — Prevention Impact Score (PIS)
// File: src/axis/preventionImpactEngine.js
//
// PIS = P(no recidivism | NS3 trajectory, engagement, capacity)
// Output: 0.000 to 1.000
// Confidence: preliminary (<15), standard (15-50), high (>50)
//
// CRITICAL: logisticTransform() is a MANUAL sigmoid.
// simple-statistics does NOT have logistic regression.
// Do NOT replace with a library import.
// ============================================================

const ss = require('simple-statistics');
const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── MAIN COMPUTE ────────────────────────────────────────────

async function computePIS(userId) {
  const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user.rows.length) throw new Error(`User ${userId} not found`);

  const jurisdictionCode = user.rows[0].jurisdiction_code || 'MD-PG';

  // Load base rate from database (NOT constants)
  const baseRate = await getBaseRate(jurisdictionCode);

  // Gather input signals
  const ns3Trajectory = await getNS3Trajectory(userId);
  const engagementSignals = await getEngagementSignals(userId);
  const capacitySignals = await getCapacitySignals(userId);

  // Check minimum session requirement
  if (!ns3Trajectory.sufficient) {
    return {
      score: null,
      confidence: null,
      reason: 'insufficient_data',
      sessionsNeeded: 5 - (ns3Trajectory.sessionCount || 0)
    };
  }

  // Determine confidence tier
  const confidence = getConfidenceTier(ns3Trajectory.sessionCount);

  // Compute composite improvement score (0-10 scale)
  const improvementScore = computeImprovementScore(ns3Trajectory, engagementSignals, capacitySignals);

  // Apply manual sigmoid to map improvement to probability
  const pis = logisticTransform(improvementScore, baseRate.rate);

  // Store result
  await pool.query(`
    INSERT INTO prevention_impact_scores
    (user_id, tenant_id, score, confidence, computation_data, base_rate_used, base_rate_source, improvement_score)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    userId,
    user.rows[0].tenant_id,
    pis,
    confidence,
    JSON.stringify({
      ns3_trajectory: ns3Trajectory.summary,
      engagement: engagementSignals.summary,
      capacity: capacitySignals.summary,
      improvement_score: improvementScore,
      confidence,
      base_rate: {
        jurisdiction: jurisdictionCode,
        rate: parseFloat(baseRate.rate),
        source: baseRate.source_name,
        effective_date: baseRate.effective_date
      }
    }),
    baseRate.rate,
    baseRate.source_name,
    improvementScore
  ]);

  // Update user's latest PIS for fast lookup
  await pool.query(
    'UPDATE users SET prevention_impact_score = $1, pis_confidence = $2, pis_computed_at = NOW() WHERE id = $3',
    [pis, confidence, userId]
  );

  return { score: pis, confidence, improvementScore };
}

// ── BASE RATE (from DB, not constants) ──────────────────────

async function getBaseRate(jurisdictionCode) {
  const result = await pool.query(`
    SELECT rate, source_name, effective_date FROM base_rates
    WHERE jurisdiction_code = $1 AND rate_type = 'sud_3year'
    ORDER BY effective_date DESC LIMIT 1
  `, [jurisdictionCode]);

  if (!result.rows.length) {
    // Fall back to state-level rate
    const fallback = await pool.query(`
      SELECT rate, source_name, effective_date FROM base_rates
      WHERE jurisdiction_code = 'MD' AND rate_type = 'sud_3year'
      ORDER BY effective_date DESC LIMIT 1
    `);

    if (!fallback.rows.length) {
      Sentry.captureMessage(`No base rates found for ${jurisdictionCode} or MD fallback`, 'error');
      return { rate: 0.40, source_name: 'hardcoded_emergency_fallback', effective_date: '2024-01-01' };
    }
    return fallback.rows[0];
  }

  // Staleness warning at 18 months
  const effectiveDate = new Date(result.rows[0].effective_date);
  const monthsOld = (Date.now() - effectiveDate) / (1000 * 60 * 60 * 24 * 30);
  if (monthsOld > 18) {
    Sentry.captureMessage(`Base rate for ${jurisdictionCode} is ${Math.round(monthsOld)} months old — update needed`, 'warning');
  }

  return result.rows[0];
}

// ── CONFIDENCE TIERS ────────────────────────────────────────

function getConfidenceTier(sessionCount) {
  if (sessionCount >= 50) return 'high';
  if (sessionCount >= 15) return 'standard';
  return 'preliminary';
}

// ── NS3 TRAJECTORY ──────────────────────────────────────────

async function getNS3Trajectory(userId) {
  const sessions = await pool.query(`
    SELECT session_number, ns3_mean, ns3_peak, ns3_floor, coherence_peak,
           zone_optimal_pct, zone_approaching_pct, zone_below_pct, created_at
    FROM session_completions
    WHERE user_id = $1
    ORDER BY session_number ASC
  `, [userId.toString()]);

  const sessionCount = sessions.rows.length;

  if (sessionCount < 5) {
    return { sufficient: false, sessionCount, summary: 'insufficient_data' };
  }

  const ns3Values = sessions.rows.map(s => parseFloat(s.ns3_mean)).filter(v => !isNaN(v));
  const coherenceValues = sessions.rows.map(s => parseFloat(s.coherence_peak)).filter(v => !isNaN(v));

  // Linear regression on NS3 over session index
  let ns3Slope = 0, ns3R2 = 0;
  if (ns3Values.length >= 3) {
    const ns3Pairs = ns3Values.map((v, i) => [i, v]);
    const ns3Regression = ss.linearRegression(ns3Pairs);
    ns3Slope = ns3Regression.m;
    const ns3Line = ss.linearRegressionLine(ns3Regression);
    ns3R2 = ss.rSquared(ns3Pairs, ns3Line);
  }

  // Optimal zone trend
  const optimalPcts = sessions.rows.map(s => parseFloat(s.zone_optimal_pct) || 0);
  const recentOptimal = optimalPcts.length >= 10 ? ss.mean(optimalPcts.slice(-10)) : ss.mean(optimalPcts);
  const earlyOptimal = ss.mean(optimalPcts.slice(0, Math.min(10, optimalPcts.length)));
  const optimalImprovement = recentOptimal - earlyOptimal;

  // Coherence trend
  const coherenceSlope = coherenceValues.length >= 3
    ? ss.linearRegression(coherenceValues.map((v, i) => [i, v])).m
    : 0;

  return {
    sufficient: true,
    sessionCount,
    ns3Slope,
    ns3R2,
    optimalImprovement,
    coherenceSlope,
    latestNS3: ns3Values.length > 0 ? ns3Values[ns3Values.length - 1] : null,
    summary: {
      ns3_trend: ns3Slope > 0 ? 'improving' : 'declining',
      consistency: Math.round(ns3R2 * 1000) / 1000,
      optimal_zone_change: Math.round(optimalImprovement * 100) / 100,
      coherence_trend: coherenceSlope > 0 ? 'improving' : 'declining',
      session_count: sessionCount
    }
  };
}

// ── ENGAGEMENT SIGNALS ──────────────────────────────────────

async function getEngagementSignals(userId) {
  const user = await pool.query('SELECT created_at FROM users WHERE id = $1', [userId]);
  const enrollmentDate = user.rows[0]?.created_at;
  const daysSinceEnrollment = Math.max(Math.floor((Date.now() - new Date(enrollmentDate)) / (1000 * 60 * 60 * 24)), 1);
  const weeksEnrolled = Math.max(daysSinceEnrollment / 7, 1);

  const sessionCount = await pool.query(
    'SELECT COUNT(*) as count FROM session_completions WHERE user_id = $1',
    [userId.toString()]
  );
  const totalSessions = parseInt(sessionCount.rows[0].count);
  const sessionsPerWeek = totalSessions / weeksEnrolled;

  const recentSessions = await pool.query(
    "SELECT COUNT(*) as count FROM session_completions WHERE user_id = $1 AND created_at > NOW() - INTERVAL '14 days'",
    [userId.toString()]
  );
  const recentCount = parseInt(recentSessions.rows[0].count);

  let kitchenTableCount = 0;
  try {
    const ktResult = await pool.query(
      'SELECT COUNT(*) as count FROM kitchen_table_sessions WHERE user_id = $1 AND completed_at IS NOT NULL',
      [userId.toString()]
    );
    kitchenTableCount = parseInt(ktResult.rows[0].count);
  } catch {}

  let coBreathCount = 0;
  try {
    const cbResult = await pool.query(
      "SELECT COUNT(*) as count FROM cobreath_sessions WHERE (initiator_id = $1 OR partner_id = $1) AND status = 'completed'",
      [userId.toString()]
    );
    coBreathCount = parseInt(cbResult.rows[0].count);
  } catch {}

  return {
    totalSessions,
    sessionsPerWeek,
    recentSessionCount: recentCount,
    kitchenTableCount,
    coBreathCount,
    daysSinceEnrollment,
    summary: {
      frequency: sessionsPerWeek >= 3 ? 'high' : sessionsPerWeek >= 1.5 ? 'moderate' : 'low',
      recent_engagement: recentCount >= 5 ? 'active' : recentCount >= 2 ? 'moderate' : 'declining',
      family_engagement: coBreathCount > 0 ? 'active' : 'none'
    }
  };
}

// ── CAPACITY SIGNALS ────────────────────────────────────────

async function getCapacitySignals(userId) {
  // Use actual capacity_snapshots columns: capacity_state, active_balance, savings_balance
  const latest = await pool.query(
    'SELECT capacity_state, active_balance, savings_balance FROM capacity_snapshots WHERE user_id = $1 ORDER BY snapshot_date DESC LIMIT 1',
    [userId.toString()]
  );
  const trend = await pool.query(
    'SELECT active_balance FROM capacity_snapshots WHERE user_id = $1 ORDER BY snapshot_date DESC LIMIT 30',
    [userId.toString()]
  );

  const balances = trend.rows.map(r => parseFloat(r.active_balance)).filter(v => !isNaN(v));
  const currentState = latest.rows[0]?.capacity_state || 'unknown';
  const savingsReserve = parseFloat(latest.rows[0]?.savings_balance) || 0;

  let savingsTrend = 'insufficient_data';
  if (balances.length >= 7) {
    const recentAvg = ss.mean(balances.slice(0, 7));
    const olderAvg = ss.mean(balances.slice(-7));
    savingsTrend = recentAvg > olderAvg ? 'growing' : recentAvg < olderAvg ? 'declining' : 'stable';
  }

  return {
    currentState,
    savingsReserve,
    savingsTrend,
    summary: {
      state: currentState,
      savings_trend: savingsTrend,
      reserve_level: savingsReserve > 50 ? 'strong' : savingsReserve > 20 ? 'moderate' : 'low'
    }
  };
}

// ── IMPROVEMENT SCORE (0-10) ────────────────────────────────

function computeImprovementScore(ns3, engagement, capacity) {
  if (!ns3.sufficient) return 0;
  let score = 0;

  // NS3 trajectory (0-3)
  if (ns3.ns3Slope > 0.5) score += 3;
  else if (ns3.ns3Slope > 0.1) score += 2;
  else if (ns3.ns3Slope > 0) score += 1;

  // NS3 consistency (0-1)
  if (ns3.ns3R2 > 0.5) score += 1;

  // Optimal zone improvement (0-2)
  if (ns3.optimalImprovement > 20) score += 2;
  else if (ns3.optimalImprovement > 10) score += 1;

  // Engagement frequency (0-1.5)
  if (engagement.sessionsPerWeek >= 3) score += 1.5;
  else if (engagement.sessionsPerWeek >= 1.5) score += 1;
  else if (engagement.sessionsPerWeek >= 0.5) score += 0.5;

  // Recent engagement (0-1)
  if (engagement.recentSessionCount >= 5) score += 1;
  else if (engagement.recentSessionCount >= 2) score += 0.5;

  // Family engagement (0-0.5)
  if (engagement.coBreathCount > 0) score += 0.5;

  // Capacity savings (0-1)
  if (capacity.savingsTrend === 'growing') score += 1;
  else if (capacity.savingsTrend === 'stable' && capacity.savingsReserve > 30) score += 0.5;

  return Math.min(score, 10);
}

// ── MANUAL SIGMOID — DO NOT REPLACE WITH LIBRARY ────────────
//
// simple-statistics does NOT have logistic regression.
// This is a hand-tuned sigmoid mapping improvement score
// to probability of non-recidivism.
//
// k = steepness, x0 = midpoint
// floor = 1 - baseRecidivismRate (someone with zero improvement
//   still has this probability of not recidivating)
// ceiling = 0.98 (never claim certainty)

function logisticTransform(improvementScore, baseRecidivismRate) {
  const k = 0.5;
  const x0 = 3.0;
  const raw = 1 / (1 + Math.exp(-k * (improvementScore - x0)));
  const floor = 1 - parseFloat(baseRecidivismRate);
  const ceiling = 0.98;
  const pis = floor + (ceiling - floor) * raw;
  return Math.round(pis * 1000) / 1000;
}

module.exports = {
  computePIS,
  getBaseRate,
  getConfidenceTier,
  getNS3Trajectory,
  getEngagementSignals,
  getCapacitySignals,
  computeImprovementScore,
  logisticTransform
};
