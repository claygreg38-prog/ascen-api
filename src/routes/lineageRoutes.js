// ============================================================
// [ABI] Lineage Routes — Lineage Ledger Read Endpoints
// File: src/routes/lineageRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// Lineage entries are permanent — read only from these routes.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { getUserTimeline, getFamilyTimeline, getUserLedger } = require('../services/lineageService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── GET / — User lineage ledger summary ─────────────────────

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });

    const ledger = await getUserLedger(userRow.rows[0].id);
    res.json({ ledger });
  } catch (err) {
    console.error('[LINEAGE] Ledger failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load lineage ledger' });
  }
});

// ── GET /timeline — Chronological milestones ────────────────

router.get('/timeline', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });

    const timeline = await getUserTimeline(userRow.rows[0].id);
    res.json({ timeline });
  } catch (err) {
    console.error('[LINEAGE] Timeline failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load timeline' });
  }
});

// ── GET /family — Family lineage (aggregated) ───────────────

router.get('/family', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });

    // Get user's family unit
    const membership = await pool.query(
      'SELECT family_unit_id FROM family_memberships WHERE user_id = $1 LIMIT 1',
      [userRow.rows[0].id]
    );
    if (!membership.rows.length) return res.json({ timeline: [] });

    const timeline = await getFamilyTimeline(membership.rows[0].family_unit_id);
    res.json({ timeline });
  } catch (err) {
    console.error('[LINEAGE] Family timeline failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load family lineage' });
  }
});

module.exports = router;
