// ============================================================
// Kitchen Table Routes — Topic Discussion API
// File: src/routes/kitchenTableRoutes.js
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const kitchenTableEngine = require('../abi/kitchenTableEngine');

router.get('/topic', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.userId || req.user?.sub;
    const familyUnitId = req.user?.familyUnitId || req.query.family_unit_id || null;
    const result = await kitchenTableEngine.selectTopic(userId, familyUnitId, req.tenantId);
    res.json(result);
  } catch (err) {
    console.error('[KitchenTable] Topic failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to select topic' });
  }
});

router.post('/start', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.userId || req.user?.sub;
    const { family_unit_id, topic_id, hrv_at_start } = req.body;
    const result = await kitchenTableEngine.startSession(userId, family_unit_id, topic_id, hrv_at_start);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[KitchenTable] Start failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

router.post('/tick', async (req, res) => {
  try {
    const { session_id, hrv_reading } = req.body;
    const result = await kitchenTableEngine.recordBiometricTick(session_id, hrv_reading);
    res.json(result);
  } catch (err) {
    console.error('[KitchenTable] Tick failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record tick' });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const { session_id, journal_entry } = req.body;
    const result = await kitchenTableEngine.completeSession(session_id, journal_entry);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[KitchenTable] Complete failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

router.post('/skip', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.userId || req.user?.sub;
    const { family_unit_id, reason } = req.body;
    const result = await kitchenTableEngine.skipSession(userId, family_unit_id, reason);
    res.json(result);
  } catch (err) {
    console.error('[KitchenTable] Skip failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to skip' });
  }
});

router.get('/history/:userId', async (req, res) => {
  try {
    const history = await kitchenTableEngine.getHistory(req.params.userId);
    res.json({ history });
  } catch (err) {
    console.error('[KitchenTable] History failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

module.exports = router;
