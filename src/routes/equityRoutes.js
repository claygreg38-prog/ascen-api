// ============================================================
// Equity Routes — Anti-Redlining Governance Dashboard
// File: src/routes/equityRoutes.js
//
// Admin-only endpoints for community equity scores,
// extraction alerts, recognition coverage, and configuration.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const Sentry = require('../instrument');
const antiRedliningEngine = require('../axis/antiRedliningEngine');
const { getFACCPool } = require('../axis/fcrManager');

// GET /api/admin/equity/scores — community equity scores
router.get('/scores', async (req, res) => {
  try {
    const scores = await antiRedliningEngine.computeEquityScores();
    res.json({ scores });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/equity/alerts — active extraction alerts
router.get('/alerts', async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const alerts = await antiRedliningEngine.getAlerts(status);
    res.json({ alerts });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/equity/alerts/:id/resolve — resolve an alert
router.post('/alerts/:id/resolve', async (req, res) => {
  try {
    const { notes } = req.body;
    const resolvedBy = req.user?.id || null;
    await antiRedliningEngine.resolveAlert(req.params.id, resolvedBy, notes || '');
    res.json({ resolved: true });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/equity/recognition-coverage — LHX partner coverage
router.get('/recognition-coverage', async (req, res) => {
  try {
    const coverage = await antiRedliningEngine.getRecognitionCoverage();
    res.json({ coverage });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/equity/scan — trigger extraction detection scan
router.post('/scan', async (req, res) => {
  try {
    const alerts = await antiRedliningEngine.runExtractionScan();
    res.json({ scan_completed: true, alerts_generated: alerts.length, alerts });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/equity/config — anti-redlining configuration
router.get('/config', async (req, res) => {
  try {
    const config = await antiRedliningEngine.getEquityConfig();
    res.json({ mechanisms: config });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/equity/config/:mechanism — update mechanism configuration
router.put('/config/:mechanism', async (req, res) => {
  try {
    const { config } = req.body;
    if (!config) return res.status(400).json({ error: 'config object required' });

    await antiRedliningEngine.updateEquityConfig(req.params.mechanism, config);
    res.json({ updated: true, mechanism: req.params.mechanism });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/equity/facc-pool — total FACC contributions
router.get('/facc-pool', async (req, res) => {
  try {
    const pool = await getFACCPool();
    res.json(pool);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
