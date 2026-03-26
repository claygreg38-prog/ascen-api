// ============================================================
// Quilting Routes — System Weave API
// File: src/routes/quiltingRoutes.js
//
// 12 endpoints for gate evaluation, quilting sessions,
// Session 3 Sonnet monitoring, check-in responses,
// and generational activity recording.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const Sentry = require('../instrument');
const { evaluateGate, evaluateAllGates, getGateStatus } = require('../axis/gateEvaluationEngine');
const {
  startQuiltSession, recordThread, recordBiometrics, recordIntervention,
  completeSession, convertToCoBreath, handleAbuseDisclosure,
  getQuiltProgress, recordGenerationalActivity
} = require('../abi/quiltingEngine');
const { monitorSession3Tick } = require('../abi/quiltingMonitor');
const { processCheckinResponse } = require('../services/isolationPrevention');

// ── GATE EVALUATION ───────────────────────────────────────────

// GET /api/quilting/gate/:gateNumber — evaluate specific gate
router.get('/gate/:gateNumber', async (req, res) => {
  try {
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id required' });

    const gateNumber = parseInt(req.params.gateNumber);
    if (![0, 1, 2, 3].includes(gateNumber)) return res.status(400).json({ error: 'Invalid gate number (0-3)' });

    const result = await evaluateGate(familyUnitId, gateNumber);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quilting/gates — all gates with current status
router.get('/gates', async (req, res) => {
  try {
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id required' });

    const results = await evaluateAllGates(familyUnitId);
    res.json({ gates: results });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── SESSION LIFECYCLE ─────────────────────────────────────────

// POST /api/quilting/session/start — start quilting session
router.post('/session/start', async (req, res) => {
  try {
    const { family_unit_id, session_number } = req.body;
    if (!family_unit_id || !session_number) {
      return res.status(400).json({ error: 'family_unit_id and session_number required' });
    }
    if (![1, 2, 3, 4].includes(session_number)) {
      return res.status(400).json({ error: 'Invalid session_number (1-4)' });
    }

    const tenantId = req.tenantId || null;
    const result = await startQuiltSession(family_unit_id, session_number, tenantId);

    if (result.error) {
      return res.status(result.error === 'gate_locked' ? 200 : 400).json(result);
    }

    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quilting/session/thread — record thread content
router.post('/session/thread', async (req, res) => {
  try {
    const { session_id, role, content } = req.body;
    if (!session_id || !role) return res.status(400).json({ error: 'session_id and role required' });

    const result = await recordThread(session_id, role, content);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quilting/session/biometrics — per-member biometric tick
router.post('/session/biometrics', async (req, res) => {
  try {
    const { session_id, user_id, phase, biometrics } = req.body;
    if (!session_id || !user_id || !phase) {
      return res.status(400).json({ error: 'session_id, user_id, and phase required' });
    }

    const result = await recordBiometrics(session_id, user_id, phase, biometrics);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quilting/session/monitor — Session 3 Sonnet monitoring tick
router.post('/session/monitor', async (req, res) => {
  try {
    const { session_id, member_biometrics, baselines } = req.body;
    if (!session_id || !member_biometrics) {
      return res.status(400).json({ error: 'session_id and member_biometrics required' });
    }

    const result = await monitorSession3Tick(session_id, member_biometrics, baselines || {});
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quilting/session/complete — complete with AXIS evaluation
router.post('/session/complete', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const result = await completeSession(session_id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quilting/session/convert — convert to co-breath
router.post('/session/convert', async (req, res) => {
  try {
    const { session_id, reason } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const result = await convertToCoBreath(session_id, reason || 'manual_conversion');
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quilting/session/disclosure — child abuse disclosure protocol
router.post('/session/disclosure', async (req, res) => {
  try {
    const { session_id, child_user_id, family_unit_id, disclosure_text } = req.body;
    if (!session_id || !child_user_id || !family_unit_id) {
      return res.status(400).json({ error: 'session_id, child_user_id, and family_unit_id required' });
    }

    const result = await handleAbuseDisclosure(session_id, child_user_id, family_unit_id, disclosure_text);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PROGRESS ──────────────────────────────────────────────────

// GET /api/quilting/progress — quilt progress
router.get('/progress', async (req, res) => {
  try {
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await getQuiltProgress(familyUnitId);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── CHECK-IN RESPONSES ────────────────────────────────────────

// POST /api/quilting/checkin/respond — process post-session check-in response
router.post('/checkin/respond', async (req, res) => {
  try {
    const { checkin_id, response } = req.body;
    if (!checkin_id || !response) return res.status(400).json({ error: 'checkin_id and response required' });

    const result = await processCheckinResponse(checkin_id, response);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GENERATIONAL ACTIVITIES ───────────────────────────────────

// POST /api/quilting/generational/testimony — record elder testimony (Gate 2 prerequisite)
router.post('/generational/testimony', async (req, res) => {
  try {
    const { family_unit_id, content, biometric_summary } = req.body;
    const userId = req.user?.id || req.body.user_id;
    if (!userId || !family_unit_id) return res.status(400).json({ error: 'user_id and family_unit_id required' });

    const result = await recordGenerationalActivity(userId, family_unit_id, 'elder_testimony', content, biometric_summary);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quilting/generational/bridge — record parent bridge (Gate 2 prerequisite)
router.post('/generational/bridge', async (req, res) => {
  try {
    const { family_unit_id, content, biometric_summary } = req.body;
    const userId = req.user?.id || req.body.user_id;
    if (!userId || !family_unit_id) return res.status(400).json({ error: 'user_id and family_unit_id required' });

    const result = await recordGenerationalActivity(userId, family_unit_id, 'parent_bridge', content, biometric_summary);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
