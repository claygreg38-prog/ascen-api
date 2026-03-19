// ============================================================
// Compass Routes — Family Compass Intelligence Endpoints
// File: src/routes/compassRoutes.js
//
// Mount at /api/compass. Requires JWT + premiumGate('family_compass').
// 10 endpoints. sonnet_full_analysis NEVER returned by family endpoints.
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { requireTier } = require('../middleware/premiumGate');
const { requireRole } = require('../middleware/auth');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ═══════════════════════════════════════════════════════════════
// CURRICULUM
// ═══════════════════════════════════════════════════════════════

// Get active curriculum with current week
router.get('/curriculum/:familyUnitId', requireTier('family_compass'), async (req, res) => {
  try {
    const familyCurriculum = require('../abi/familyCurriculum');
    const result = await familyCurriculum.getCurrentWeek(req.params.familyUnitId);
    if (!result) return res.json({ active: false, message: 'No active curriculum. Generate one to get started.' });
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get curriculum' });
  }
});

// Generate new curriculum
router.post('/curriculum/generate', requireTier('family_compass'), async (req, res) => {
  try {
    const familyCurriculum = require('../abi/familyCurriculum');
    const { family_unit_id } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await familyCurriculum.generateCurriculum(family_unit_id, req.tenantId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to generate curriculum' });
  }
});

// Complete an assignment
router.post('/curriculum/assignment/:id/complete', requireTier('family_compass'), async (req, res) => {
  try {
    const familyCurriculum = require('../abi/familyCurriculum');
    const { feedback } = req.body;

    const result = await familyCurriculum.completeAssignment(req.params.id, feedback, req.user?.userId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete assignment' });
  }
});

// Trigger curriculum adaptation
router.post('/curriculum/adapt/:curriculumId', requireTier('family_compass'), async (req, res) => {
  try {
    const familyCurriculum = require('../abi/familyCurriculum');
    const result = await familyCurriculum.adaptCurriculum(req.params.curriculumId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to adapt curriculum' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PREDICTIONS — FAMILY-VISIBLE (42 CFR Part 2 ENFORCED)
// ═══════════════════════════════════════════════════════════════

// Latest prediction — FAMILY-VISIBLE ONLY
// DELIBERATELY excludes sonnet_full_analysis from query
router.get('/prediction/:familyUnitId', requireTier('family_compass'), async (req, res) => {
  try {
    const predictiveRelationship = require('../abi/predictiveRelationship');
    const prediction = await predictiveRelationship.getLatestPrediction(req.params.familyUnitId);
    // getLatestPrediction NEVER returns sonnet_full_analysis
    res.json(prediction || { message: 'No predictions yet. First prediction generates Monday.' });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get prediction' });
  }
});

// Prediction history — FAMILY-VISIBLE ONLY
router.get('/prediction/:familyUnitId/history', requireTier('family_compass'), async (req, res) => {
  try {
    const predictiveRelationship = require('../abi/predictiveRelationship');
    const history = await predictiveRelationship.getPredictionHistory(req.params.familyUnitId);
    // getPredictionHistory NEVER returns sonnet_full_analysis
    res.json({ predictions: history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get prediction history' });
  }
});

// Full clinical analysis — CLINICIAN ROLE REQUIRED
// This is the ONLY endpoint that returns sonnet_full_analysis
router.get('/prediction/:id/clinical', requireRole('clinician'), async (req, res) => {
  try {
    const predictiveRelationship = require('../abi/predictiveRelationship');
    const prediction = await predictiveRelationship.getFullPrediction(req.params.id);
    if (!prediction) return res.status(404).json({ error: 'Prediction not found' });
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get clinical prediction' });
  }
});

// ═══════════════════════════════════════════════════════════════
// HEALING MAP
// ═══════════════════════════════════════════════════════════════

// Get healing map
router.get('/healing-map/:familyUnitId', requireTier('family_compass'), async (req, res) => {
  try {
    const healingMap = require('../abi/healingMap');
    const map = await healingMap.getMap(req.params.familyUnitId);
    if (!map) return res.json({ exists: false, message: 'No healing map yet. Generate one to visualize your journey.' });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get healing map' });
  }
});

// Generate or update healing map
router.post('/healing-map/generate', requireTier('family_compass'), async (req, res) => {
  try {
    const healingMap = require('../abi/healingMap');
    const { family_unit_id, genealogy } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await healingMap.generateMap(family_unit_id, genealogy || null, req.tenantId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to generate healing map' });
  }
});

// Submit genealogy data
router.post('/healing-map/genealogy', requireTier('family_compass'), async (req, res) => {
  try {
    const healingMap = require('../abi/healingMap');
    const { family_unit_id, genealogy_data } = req.body;
    if (!family_unit_id || !genealogy_data) {
      return res.status(400).json({ error: 'family_unit_id and genealogy_data required' });
    }

    const result = await healingMap.submitGenealogy(family_unit_id, genealogy_data, req.tenantId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit genealogy' });
  }
});

module.exports = router;
