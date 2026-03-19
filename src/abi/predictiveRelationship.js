// ============================================================
// [ABI] Predictive Relationship Intelligence
// File: src/abi/predictiveRelationship.js
//
// Weekly predictions with TWO-TIER output:
// - Family-visible: BEHAVIORAL SIGNALS ONLY (message frequency,
//   practice completion, conflict outcomes, shared attendance)
// - Clinician-only: NS3, HRV, biometric data (42 CFR Part 2)
//
// sonnet_full_analysis is NEVER returned by family-facing endpoints.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── GENERATE PREDICTION ─────────────────────────────────────

async function generatePrediction(familyUnitId, tenantId) {
  const aiRouter = require('../services/aiRouter');

  try {
    // Gather BEHAVIORAL data (family-visible)
    const behavioralData = await gatherBehavioralSignals(familyUnitId);

    // Gather BIOMETRIC data (clinician-only)
    const biometricData = await gatherBiometricSignals(familyUnitId);

    // Sonnet analyzes BOTH but output is split
    const result = await aiRouter.route('predictive_analysis', `
      Analyze this family's relationship trajectory.

      BEHAVIORAL SIGNALS (shareable with family):
      ${JSON.stringify(behavioralData)}

      BIOMETRIC SIGNALS (clinician eyes only — 42 CFR Part 2):
      ${JSON.stringify(biometricData)}

      Generate TWO separate outputs:

      1. FAMILY_VISIBLE (use ONLY behavioral signals — NO biometric references):
      - risk_score: 0-1 (0 = healthy, 1 = crisis)
      - risk_direction: "improving" | "stable" | "declining"
      - early_warnings: array of behavioral observations ONLY (e.g. "Response times increasing", "Fewer shared sessions this week")
      - positive_signals: array of behavioral positives ONLY (e.g. "Consistent daily practice", "Conflict resolved through breathing")
      - recommendations: array of actionable suggestions based on behavioral patterns ONLY
      - fr_readiness_score: 0-1 (Family Receiver readiness based on behavioral engagement)
      - fr_recommendation: text recommendation

      2. CLINICIAN_ONLY (can reference biometric data):
      - Full clinical analysis including NS3 trajectories
      - Biometric-informed risk factors
      - HRV trend interpretation
      - Clinical recommendations
      - Capacity currency trajectory analysis

      CRITICAL: The family_visible section must contain ZERO references to NS3, HRV, heart rate, coherence, biometrics, or any physiological data. Only behavioral engagement metrics.

      Respond ONLY with valid JSON: { "family_visible": {...}, "clinician_only": {...} }
    `, {
      maxTokens: 2000,
      temperature: 0.5,
      tenantId
    });

    let parsed;
    try {
      parsed = JSON.parse(result?.content || '{}');
    } catch {
      parsed = {
        family_visible: {
          risk_score: 0.3,
          risk_direction: 'stable',
          early_warnings: [],
          positive_signals: ['AI analysis temporarily unavailable'],
          recommendations: ['Continue current engagement patterns'],
          fr_readiness_score: 0.5,
          fr_recommendation: 'Continue building consistent practice'
        },
        clinician_only: { note: 'AI analysis unavailable for this period' }
      };
    }

    const fv = parsed.family_visible || {};
    const co = parsed.clinician_only || {};

    // Store with STRICT separation
    const predResult = await pool.query(
      `INSERT INTO relationship_predictions
       (family_unit_id, tenant_id, risk_score, risk_direction, early_warnings,
        positive_signals, recommendations, fr_readiness_score, fr_recommendation,
        sonnet_full_analysis)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        familyUnitId, tenantId,
        fv.risk_score || 0.3,
        fv.risk_direction || 'stable',
        fv.early_warnings || [],
        fv.positive_signals || [],
        fv.recommendations || [],
        fv.fr_readiness_score || 0.5,
        fv.fr_recommendation || null,
        JSON.stringify(co) // NEVER returned to family endpoints
      ]
    );

    console.log(`[PredictiveRelationship] Prediction generated for family ${familyUnitId}: risk=${fv.risk_score}, direction=${fv.risk_direction}`);

    return {
      predictionId: predResult.rows[0].id,
      familyVisible: fv,
      // clinician_only is NOT returned here — only stored in DB
      generated: true
    };
  } catch (err) {
    console.error('[PredictiveRelationship] generatePrediction failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to generate prediction' };
  }
}

// ── GET LATEST PREDICTION (FAMILY-VISIBLE ONLY) ─────────────

async function getLatestPrediction(familyUnitId) {
  try {
    // DELIBERATELY excludes sonnet_full_analysis
    const result = await pool.query(
      `SELECT id, risk_score, risk_direction, early_warnings, positive_signals,
              recommendations, fr_readiness_score, fr_recommendation, prediction_date
       FROM relationship_predictions
       WHERE family_unit_id = $1
       ORDER BY prediction_date DESC LIMIT 1`,
      [familyUnitId]
    );
    return result.rows[0] || null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

// ── GET PREDICTION HISTORY (FAMILY-VISIBLE ONLY) ────────────

async function getPredictionHistory(familyUnitId, limit = 12) {
  try {
    // DELIBERATELY excludes sonnet_full_analysis
    const result = await pool.query(
      `SELECT id, risk_score, risk_direction, early_warnings, positive_signals,
              recommendations, fr_readiness_score, prediction_date
       FROM relationship_predictions
       WHERE family_unit_id = $1
       ORDER BY prediction_date DESC LIMIT $2`,
      [familyUnitId, limit]
    );
    return result.rows;
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

// ── GET FULL PREDICTION (CLINICIAN ONLY) ────────────────────

async function getFullPrediction(predictionId) {
  try {
    // Returns ALL fields including sonnet_full_analysis
    // Caller MUST verify clinician role before using this
    const result = await pool.query(
      'SELECT * FROM relationship_predictions WHERE id = $1',
      [predictionId]
    );
    return result.rows[0] || null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

// ── GATHER BEHAVIORAL SIGNALS (FAMILY-VISIBLE) ──────────────
// NO NS3, NO HRV, NO biometric values

async function gatherBehavioralSignals(familyUnitId) {
  const signals = {
    message_frequency: { last_7_days: 0, last_30_days: 0, trend: 'stable' },
    avg_response_latency_hours: null,
    practice_completion: {
      sessions: { rate: 0, trend: 'stable' },
      kitchen_table: { rate: 0, trend: 'stable' },
      co_breath: { count: 0, trend: 'stable' },
      assignments: { rate: 0, trend: 'stable' }
    },
    conflict_events: { count: 0, resolved: 0, last_outcome: null },
    shared_session_attendance: { rate: 0 },
    curriculum_week: null
  };

  try {
    // Message frequency
    const msgs7 = await pool.query(
      `SELECT COUNT(*) as count FROM facilitated_messages
       WHERE family_unit_id = $1 AND created_at > NOW() - INTERVAL '7 days' AND delivered_at IS NOT NULL`,
      [familyUnitId]
    );
    const msgs30 = await pool.query(
      `SELECT COUNT(*) as count FROM facilitated_messages
       WHERE family_unit_id = $1 AND created_at > NOW() - INTERVAL '30 days' AND delivered_at IS NOT NULL`,
      [familyUnitId]
    );
    signals.message_frequency.last_7_days = parseInt(msgs7.rows[0]?.count) || 0;
    signals.message_frequency.last_30_days = parseInt(msgs30.rows[0]?.count) || 0;
    const weekly_avg = signals.message_frequency.last_30_days / 4;
    signals.message_frequency.trend = signals.message_frequency.last_7_days > weekly_avg * 1.2 ? 'increasing' :
      signals.message_frequency.last_7_days < weekly_avg * 0.8 ? 'decreasing' : 'stable';

    // Response latency
    const latency = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at)) / 3600) as avg_hours
       FROM facilitated_messages
       WHERE family_unit_id = $1 AND delivered_at IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'`,
      [familyUnitId]
    );
    signals.avg_response_latency_hours = parseFloat(latency.rows[0]?.avg_hours)?.toFixed(1) || null;

    // Session practice rate (last 30 days)
    const sessionRate = await pool.query(
      `SELECT COUNT(DISTINCT DATE(sc.completed_at)) as practice_days
       FROM session_completions sc
       JOIN users u ON sc.user_id = u.participant_id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1 AND sc.completed_at > NOW() - INTERVAL '30 days'`,
      [familyUnitId]
    );
    signals.practice_completion.sessions.rate = Math.min(1, (parseInt(sessionRate.rows[0]?.practice_days) || 0) / 30);

    // Co-breath sessions
    const coBreath = await pool.query(
      `SELECT COUNT(*) as count FROM cobreath_sessions
       WHERE family_unit_id = $1 AND status = 'completed' AND created_at > NOW() - INTERVAL '30 days'`,
      [familyUnitId]
    );
    signals.practice_completion.co_breath.count = parseInt(coBreath.rows[0]?.count) || 0;

    // Conflict events
    const conflicts = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE resolution_outcome = 'resolved') as resolved
       FROM conflict_events
       WHERE family_unit_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [familyUnitId]
    );
    signals.conflict_events.count = parseInt(conflicts.rows[0]?.total) || 0;
    signals.conflict_events.resolved = parseInt(conflicts.rows[0]?.resolved) || 0;

    // Curriculum progress
    const curriculum = await pool.query(
      `SELECT current_week FROM family_curricula
       WHERE family_unit_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [familyUnitId]
    );
    signals.curriculum_week = curriculum.rows[0]?.current_week || null;

    // Assignment completion rate
    if (signals.curriculum_week) {
      const assignmentRate = await pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE completed) as done
         FROM curriculum_assignments ca
         JOIN family_curricula fc ON ca.curriculum_id = fc.id
         WHERE fc.family_unit_id = $1 AND fc.status = 'active'`,
        [familyUnitId]
      );
      const aTotal = parseInt(assignmentRate.rows[0]?.total) || 0;
      const aDone = parseInt(assignmentRate.rows[0]?.done) || 0;
      signals.practice_completion.assignments.rate = aTotal > 0 ? aDone / aTotal : 0;
    }
  } catch (err) {
    // Non-blocking — return signals with defaults
  }

  return signals;
}

// ── GATHER BIOMETRIC SIGNALS (CLINICIAN-ONLY) ───────────────

async function gatherBiometricSignals(familyUnitId) {
  const biometric = {
    member_ns3_trajectories: [],
    capacity_trajectories: [],
    co_regulation_quality: { avg_connection_score: 0, hrv_correlation: 0 }
  };

  try {
    // NS3 trajectories per member
    const members = await pool.query(
      'SELECT user_id FROM family_memberships WHERE family_unit_id = $1',
      [familyUnitId]
    );

    for (const m of members.rows) {
      const ns3 = await pool.query(
        `SELECT AVG(ns3_mean) as avg_ns3, AVG(coherence_peak) as avg_coherence,
                AVG(optimal_zone_pct) as avg_optimal
         FROM session_completions sc
         JOIN users u ON sc.user_id = u.participant_id
         WHERE u.id = $1 AND sc.completed_at > NOW() - INTERVAL '7 days'`,
        [m.user_id]
      );

      const capacity = await pool.query(
        `SELECT balance, state FROM capacity_ledger
         WHERE user_id = (SELECT participant_id FROM users WHERE id = $1)
         ORDER BY created_at DESC LIMIT 1`,
        [m.user_id]
      );

      biometric.member_ns3_trajectories.push({
        user_id: m.user_id,
        ns3_7day_avg: parseFloat(ns3.rows[0]?.avg_ns3) || 0,
        coherence_avg: parseFloat(ns3.rows[0]?.avg_coherence) || 0,
        optimal_zone_avg: parseFloat(ns3.rows[0]?.avg_optimal) || 0
      });

      biometric.capacity_trajectories.push({
        user_id: m.user_id,
        state: capacity.rows[0]?.state || 'unknown',
        balance: parseFloat(capacity.rows[0]?.balance) || 0
      });
    }

    // Co-regulation quality
    const coReg = await pool.query(
      `SELECT AVG(connection_score) as avg_score, AVG(hrv_correlation) as avg_hrv
       FROM cobreath_sessions
       WHERE family_unit_id = $1 AND status = 'completed' AND created_at > NOW() - INTERVAL '30 days'`,
      [familyUnitId]
    );
    biometric.co_regulation_quality.avg_connection_score = parseFloat(coReg.rows[0]?.avg_score) || 0;
    biometric.co_regulation_quality.hrv_correlation = parseFloat(coReg.rows[0]?.avg_hrv) || 0;
  } catch (err) {
    // Non-blocking
  }

  return biometric;
}

module.exports = {
  generatePrediction,
  getLatestPrediction,
  getPredictionHistory,
  getFullPrediction,
  gatherBehavioralSignals,
  gatherBiometricSignals
};
