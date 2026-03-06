// ============================================================
// axisRoutes.js — AXIS Brain Stem API
// 8 endpoints: dashboard, protocols, context, refine, stats
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { AxisEngine } = require('../axis/axisEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const axis = new AxisEngine(pool);

// GET /api/axis/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const protocols = await axis.getProtocolAnalysis();
    const totalSessions = await pool.query(`SELECT COUNT(*) as count FROM axis_sessions`).catch(() => ({ rows: [{ count: 0 }] }));
    const totalUsers = await pool.query(`SELECT COUNT(DISTINCT user_id) as count FROM axis_sessions`).catch(() => ({ rows: [{ count: 0 }] }));

    res.json({
      total_sessions_ingested: parseInt(totalSessions.rows[0]?.count || 0),
      total_users: parseInt(totalUsers.rows[0]?.count || 0),
      protocols: protocols.protocols || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.json({ error: err.message, protocols: [] });
  }
});

// GET /api/axis/protocols
router.get('/protocols', async (req, res) => {
  const result = await axis.getProtocolAnalysis();
  res.json(result);
});

// GET /api/axis/context/:userId
router.get('/context/:userId', async (req, res) => {
  try {
    const packet = await axis.generateContextPacket(req.params.userId);
    res.json(packet);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// POST /api/axis/refine
router.post('/refine', async (req, res) => {
  try {
    const result = await axis.runRefinementCycle();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/axis/stats
router.get('/stats', async (req, res) => {
  try {
    const byTrack = await pool.query(
      `SELECT track, COUNT(*) as sessions, ROUND(AVG(coherence_peak)::numeric, 3) as avg_coherence
       FROM axis_sessions GROUP BY track ORDER BY sessions DESC`
    ).catch(() => ({ rows: [] }));

    const byArc = await pool.query(
      `SELECT arc, COUNT(*) as sessions, ROUND(AVG(coherence_peak)::numeric, 3) as avg_coherence,
              ROUND(AVG(cycle_completion_rate)::numeric, 3) as avg_completion
       FROM axis_sessions GROUP BY arc ORDER BY sessions DESC`
    ).catch(() => ({ rows: [] }));

    res.json({ by_track: byTrack.rows, by_arc: byArc.rows });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// GET /api/axis/refinements
router.get('/refinements', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM axis_refinements ORDER BY refined_at DESC LIMIT 10`
    );
    res.json({ refinements: result.rows });
  } catch (err) {
    res.json({ refinements: [], error: err.message });
  }
});

// GET /api/axis/user/:userId/history
router.get('/user/:userId/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT session_number, arc, mode, coherence_peak, cycle_completion_rate,
              active_duration_seconds, exit_type, ingested_at
       FROM axis_sessions WHERE user_id = $1 ORDER BY ingested_at DESC LIMIT 50`,
      [req.params.userId]
    );
    res.json({ sessions: result.rows });
  } catch (err) {
    res.json({ sessions: [], error: err.message });
  }
});

// GET /api/axis/health
router.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    layer: 'AXIS Brain Stem',
    capabilities: ['ingest', 'refine', 'distribute'],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
