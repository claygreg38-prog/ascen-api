// ============================================================
// [ABI] Firmware Routes — Session Templates + AXIS Recommendation
// File: src/routes/firmwareRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { recommendFirmware, getFirmwareTemplate, getFirmwareProgress } = require('../axis/firmwareRecommender');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── GET /recommended — AXIS recommendation based on LACE ────

router.get('/recommended', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });

    // Age-gated: pass ageLimit for min_age filtering
    const ageLimit = req.ageFilter?.sqlValue || 99;
    const result = await recommendFirmware(userRow.rows[0].id, { ageLimit });
    res.json(result);
  } catch (err) {
    console.error('[FIRMWARE] Recommendation failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get firmware recommendations' });
  }
});

// ── GET /progress — Completed firmware list ─────────────────

router.get('/progress', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });

    const progress = await getFirmwareProgress(userRow.rows[0].id);
    res.json({ firmware_progress: progress });
  } catch (err) {
    console.error('[FIRMWARE] Progress failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get firmware progress' });
  }
});

// ── GET /:number — Firmware template details ────────────────

router.get('/:number', async (req, res) => {
  try {
    const fw = await getFirmwareTemplate(parseInt(req.params.number));
    if (!fw) return res.status(404).json({ error: 'Firmware not found' });
    res.json(fw);
  } catch (err) {
    console.error('[FIRMWARE] Get template failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get firmware template' });
  }
});

module.exports = router;
