// ============================================================
// Co-Breath Routes — Synchronized Family Breathing API
// File: src/routes/coBreathRoutes.js
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const coBreathEngine = require('../abi/coBreathEngine');

router.post('/initiate', async (req, res) => {
  try {
    const { initiator_id, partner_id, family_unit_id, mode } = req.body;
    if (!initiator_id || !partner_id || !family_unit_id) {
      return res.status(400).json({ error: 'initiator_id, partner_id, and family_unit_id required' });
    }
    const result = await coBreathEngine.initiateSession(initiator_id, partner_id, family_unit_id, mode || 'sync');
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[CoBreath] Initiate failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to initiate session' });
  }
});

router.post('/join/:roomCode', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.userId || req.user?.sub;
    const result = await coBreathEngine.connectToRoom(req.params.roomCode, userId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[CoBreath] Join failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

router.get('/room/:roomCode', async (req, res) => {
  try {
    const state = await coBreathEngine.getRoomState(req.params.roomCode);
    if (!state) return res.status(404).json({ error: 'Room not found' });
    res.json(state);
  } catch (err) {
    console.error('[CoBreath] Room state failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get room state' });
  }
});

router.post('/complete/:sessionId', async (req, res) => {
  try {
    const metrics = req.body;
    const result = await coBreathEngine.completeSession(req.params.sessionId, metrics);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[CoBreath] Complete failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

router.get('/history/:familyUnitId', async (req, res) => {
  try {
    const history = await coBreathEngine.getHistory(req.params.familyUnitId);
    res.json({ history });
  } catch (err) {
    console.error('[CoBreath] History failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

router.get('/recommend/:familyUnitId', async (req, res) => {
  try {
    const rec = await coBreathEngine.getRecommendedPairing(req.params.familyUnitId);
    res.json(rec);
  } catch (err) {
    console.error('[CoBreath] Recommend failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get recommendation' });
  }
});

module.exports = router;
