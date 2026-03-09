// ============================================================
// axisValueRoutes.js — Value reporting endpoints
// Exposes ValueEngine data for dashboards and reporting.
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { ValueEngine } = require('../abi/valueEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── SYSTEM VALUE REPORT ────────────────────────────────────
// GET /api/axis/value/report
router.get('/report', async (req, res) => {
  try {
    const engine = new ValueEngine(pool);
    const periodDays = parseInt(req.query.period) || 30;
    const report = await engine.computeValueReport({
      jurisdiction: process.env.ASCEN_JURISDICTION,
      period_days: periodDays
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── USER VALUE SUMMARY ─────────────────────────────────────
// GET /api/axis/value/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const engine = new ValueEngine(pool);
    const summary = await engine.getUserValueSummary(req.params.userId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ATTESTATION QUEUE STATUS ───────────────────────────────
// GET /api/axis/value/attestation-status
router.get('/attestation-status', async (req, res) => {
  try {
    const { BlockchainRetry } = require('../blockchain/blockchainRetry');
    const retry = new BlockchainRetry(pool);
    const status = await retry.getQueueStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── JURISDICTION INFO ──────────────────────────────────────
// GET /api/axis/value/jurisdiction
router.get('/jurisdiction', (req, res) => {
  res.json({
    jurisdiction: process.env.ASCEN_JURISDICTION || 'not_set',
    jurisdiction_name: process.env.ASCEN_JURISDICTION_NAME || 'not_set',
    jurisdiction_level: process.env.ASCEN_JURISDICTION_LEVEL || 'not_set',
    data_residency: process.env.ASCEN_DATA_RESIDENCY || 'not_set'
  });
});

module.exports = router;
