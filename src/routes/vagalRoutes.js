// ============================================================
// [ABI] Vagal Journey Routes — Post-Session NS3 Mapping
// File: src/routes/vagalRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// HOS vocabulary ONLY: Regulated, Settling, Activated, Protected.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── HOS Zone Mapping ────────────────────────────────────────
// Never clinical terms. Regulated, Settling, Activated, Protected.
function ns3ToZone(score) {
  if (score === null || score === undefined) return null;
  if (score >= 71) return 'Regulated';
  if (score >= 41) return 'Settling';
  if (score >= 25) return 'Activated';
  return 'Protected';
}

// ── GET /vagal-journey/:sessionId — Arrival + Landing NS3 ───
// Returns arrival and landing NS3 data for a completed session.
// Used by the post-session vagal journey map.

router.get('/vagal-journey/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;

    // Resolve internal user id
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });
    const internalId = userRow.rows[0].id;

    const result = await pool.query(
      `SELECT session_state, ns3_mean, ns3_peak, coherence_peak, session_number
       FROM session_completions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, internalId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];
    const state = session.session_state || {};

    // Arrival NS3 from session_state JSONB (stored during arrival-complete)
    const arrivalBaseline = state.arrivalBaseline || state.arrival_baseline || {};
    const arrivalNs3 = arrivalBaseline.ns3_score || (arrivalBaseline.initial_coherence ? arrivalBaseline.initial_coherence * 100 : null);

    // Landing NS3 from session completion
    const landingNs3 = session.ns3_mean || session.ns3_peak || null;

    res.json({
      session_id: sessionId,
      session_number: session.session_number,
      arrival_ns3: arrivalNs3 !== null ? Math.round(arrivalNs3) : null,
      landing_ns3: landingNs3 !== null ? Math.round(landingNs3) : null,
      arrival_zone: ns3ToZone(arrivalNs3),
      landing_zone: ns3ToZone(landingNs3),
      journey_distance: (arrivalNs3 !== null && landingNs3 !== null)
        ? Math.round(landingNs3 - arrivalNs3)
        : null
    });
  } catch (err) {
    console.error('[VAGAL-JOURNEY] Error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load vagal journey' });
  }
});

// ── GET /vagal-pattern — 30-Day Arrival/Landing Trend ───────
// Available after 5+ completed sessions.
// Powers "Your arrival point is moving up."

router.get('/vagal-pattern', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;

    // Resolve internal user id
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });
    const internalId = userRow.rows[0].id;

    // Get last 30 sessions with arrival + landing data
    const result = await pool.query(
      `SELECT id, session_number, created_at, session_state, ns3_mean, ns3_peak
       FROM session_completions
       WHERE user_id = $1 AND session_active = false
       ORDER BY created_at DESC LIMIT 30`,
      [internalId]
    );

    if (result.rows.length < 5) {
      return res.json({
        sufficient: false,
        sessions_needed: 5 - result.rows.length,
        message: 'Keep showing up. After 5 sessions, your pattern becomes visible.'
      });
    }

    const entries = result.rows.map(row => {
      const state = row.session_state || {};
      const arrivalBaseline = state.arrivalBaseline || state.arrival_baseline || {};
      const arrivalNs3 = arrivalBaseline.ns3_score || (arrivalBaseline.initial_coherence ? arrivalBaseline.initial_coherence * 100 : null);
      const landingNs3 = row.ns3_mean || row.ns3_peak || null;

      return {
        date: row.created_at,
        session_number: row.session_number,
        arrival_ns3: arrivalNs3 !== null ? Math.round(arrivalNs3) : null,
        landing_ns3: landingNs3 !== null ? Math.round(landingNs3) : null
      };
    }).reverse(); // chronological order

    // Compute trend: compare last 7 days avg vs last 30 days avg
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const last7 = entries.filter(e => new Date(e.date) >= sevenDaysAgo && e.arrival_ns3 !== null);
    const all30 = entries.filter(e => e.arrival_ns3 !== null);

    const avg7 = last7.length > 0
      ? Math.round(last7.reduce((sum, e) => sum + e.arrival_ns3, 0) / last7.length)
      : null;
    const avg30 = all30.length > 0
      ? Math.round(all30.reduce((sum, e) => sum + e.arrival_ns3, 0) / all30.length)
      : null;

    let trendDirection = 'stable';
    if (avg7 !== null && avg30 !== null) {
      const diff = avg7 - avg30;
      if (diff > 5) trendDirection = 'improving';
      else if (diff < -5) trendDirection = 'declining';
    }

    res.json({
      sufficient: true,
      entries,
      trend_direction: trendDirection,
      avg_arrival_ns3_30d: avg30,
      avg_arrival_ns3_7d: avg7,
      session_count: entries.length
    });
  } catch (err) {
    console.error('[VAGAL-PATTERN] Error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load vagal pattern' });
  }
});

module.exports = router;
