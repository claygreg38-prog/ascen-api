// ============================================================
// Healing Economy Routes — LIT/FCR/FIS/Bond/LHX
// File: src/routes/healingEconomyRoutes.js
//
// 14 endpoints for credential portfolios, family reserves,
// investment scores, bond maturation, and recognition partners.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const Sentry = require('../instrument');
const litEngine = require('../axis/litEngine');
const { getFCR, getFACCPool } = require('../axis/fcrManager');
const { computeFIS, getLatestFIS } = require('../axis/fisEngine');
const { evaluateMaturation, matureBond, getBondHistory } = require('../axis/bondMaturationEngine');
const pool = require('../db/pool');

// ── LIT ───────────────────────────────────────────────────────

// GET /api/economy/portfolio/:userId — individual credential portfolio
router.get('/portfolio/:userId', async (req, res) => {
  try {
    const result = await litEngine.getPortfolio(parseInt(req.params.userId));
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/economy/lit/history/:userId — LIT transaction history
router.get('/lit/history/:userId', async (req, res) => {
  try {
    const history = await litEngine.getLITHistory(parseInt(req.params.userId), parseInt(req.query.limit) || 50);
    res.json({ entries: history });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── FCR ───────────────────────────────────────────────────────

// GET /api/economy/fcr — family capital reserve
router.get('/fcr', async (req, res) => {
  try {
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id required' });

    const fcr = await getFCR(familyUnitId);
    if (!fcr) return res.json({ message: 'No reserve yet — complete sessions to begin building.' });
    res.json(fcr);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/economy/fcr/contributions — per-member contribution breakdown
router.get('/fcr/contributions', async (req, res) => {
  try {
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id required' });

    const fcr = await getFCR(familyUnitId);
    if (!fcr) return res.json({ contributions: {} });
    res.json({ contributions: fcr.member_contributions || {} });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── FIS ───────────────────────────────────────────────────────

// GET /api/economy/fis — current Family Investment Score
router.get('/fis', async (req, res) => {
  try {
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id required' });

    const fis = await getLatestFIS(familyUnitId);
    if (!fis) return res.json({ message: 'FIS not yet computed. Computed monthly.' });
    res.json(fis);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/economy/fis/compute — trigger FIS recomputation
router.post('/fis/compute', async (req, res) => {
  try {
    const { family_unit_id } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await computeFIS(family_unit_id);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── BOND ──────────────────────────────────────────────────────

// GET /api/economy/bond — current bond tier + maturation progress
router.get('/bond', async (req, res) => {
  try {
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id required' });

    const evaluation = await evaluateMaturation(familyUnitId);
    res.json(evaluation);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/economy/bond/evaluate — evaluate maturation readiness
router.post('/bond/evaluate', async (req, res) => {
  try {
    const { family_unit_id } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await evaluateMaturation(family_unit_id);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/economy/bond/mature — trigger maturation
router.post('/bond/mature', async (req, res) => {
  try {
    const { family_unit_id } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await matureBond(family_unit_id);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/economy/bond/history — maturation event history
router.get('/bond/history', async (req, res) => {
  try {
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id required' });

    const history = await getBondHistory(familyUnitId);
    res.json({ events: history });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── LHX RECOGNITION ──────────────────────────────────────────

// GET /api/economy/recognition — available recognition partners
router.get('/recognition', async (req, res) => {
  try {
    const jurisdiction = req.query.jurisdiction || 'MD-PG';
    const result = await pool.query(
      `SELECT id, partner_name, partner_type, jurisdiction, recognition_criteria, recognition_benefits
       FROM lhx_recognition_partners WHERE status = 'active' AND (jurisdiction = $1 OR jurisdiction = 'MD')
       ORDER BY partner_type`,
      [jurisdiction]
    );
    res.json({ partners: result.rows });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/economy/recognition/claim — submit credential for recognition
router.post('/recognition/claim', async (req, res) => {
  try {
    const { user_id, family_unit_id, partner_id } = req.body;
    if (!user_id || !partner_id) return res.status(400).json({ error: 'user_id and partner_id required' });

    // Record recognition event in LIT ledger
    const lastEntry = await pool.query(
      'SELECT running_balance FROM lit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user_id]
    );
    const currentBalance = lastEntry.rows.length ? parseFloat(lastEntry.rows[0].running_balance) : 0;

    await pool.query(`
      INSERT INTO lit_ledger (user_id, family_unit_id, transaction_type, lit_amount, running_balance, metadata)
      VALUES ($1, $2, 'recognition_event', 0, $3, $4)
    `, [user_id, family_unit_id || null, currentBalance,
      JSON.stringify({ partner_id, claimed_at: new Date() })]);

    res.json({ claimed: true, partner_id });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
