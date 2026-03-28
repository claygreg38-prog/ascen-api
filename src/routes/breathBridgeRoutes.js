// ============================================================
// Breath Bridge Routes — Phase 2
// File: src/routes/breathBridgeRoutes.js
//
// Parent → child presence channel. Three access levels:
//   - Parent (participant): enroll, status
//   - Child (participant): messages
//   - Clinician: full control, pause, preview, cadence
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { computeAgeBracket } = require('../services/personaEngine');
const breathBridgeService = require('../services/breathBridgeService');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CHILD_BRACKETS = ['elementary', 'middle_school', 'high_school'];

// ═══════════════════════════════════════════════════════════════
// PARENT-FACING
// ═══════════════════════════════════════════════════════════════

// POST /api/breath-bridge/enroll — Parent opts in
router.post('/enroll', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;

    // Look up user
    const userResult = await pool.query(
      'SELECT id, date_of_birth, family_unit_id FROM users WHERE id = $1 OR user_id = $2',
      [parseInt(userId) || 0, userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Must be adult (parent)
    const bracket = computeAgeBracket(user.date_of_birth);
    if (CHILD_BRACKETS.includes(bracket)) {
      return res.status(403).json({ error: 'Only adult participants can enroll in Breath Bridge' });
    }

    // Find family
    let familyId = user.family_unit_id;
    if (!familyId) {
      const famResult = await pool.query(
        `SELECT family_unit_id FROM family_memberships
         WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [user.id]
      );
      familyId = famResult.rows[0]?.family_unit_id;
    }
    if (!familyId) {
      return res.status(400).json({ error: 'No family unit found. Join a family first.' });
    }

    const result = await breathBridgeService.enrollFamily(familyId, user.id, null);

    if (!result.enrolled) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Enroll error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

// GET /api/breath-bridge/status — Parent's enrollment status
router.get('/status', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;

    const userResult = await pool.query(
      'SELECT id, family_unit_id FROM users WHERE id = $1 OR user_id = $2',
      [parseInt(userId) || 0, userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    let familyId = user.family_unit_id;
    if (!familyId) {
      const famResult = await pool.query(
        `SELECT family_unit_id FROM family_memberships
         WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [user.id]
      );
      familyId = famResult.rows[0]?.family_unit_id;
    }

    if (!familyId) {
      return res.json({ enrolled: false, reason: 'no_family' });
    }

    const configResult = await pool.query(
      'SELECT active, parent_consent_at, guardian_consent_at, paused_at, weekly_message_cap FROM breath_bridge_config WHERE family_id = $1',
      [familyId]
    );
    const config = configResult.rows[0];

    if (!config) {
      return res.json({ enrolled: false });
    }

    res.json({
      enrolled: config.active,
      parent_consent: !!config.parent_consent_at,
      guardian_consent: !!config.guardian_consent_at,
      paused: !!config.paused_at,
      weekly_message_cap: config.weekly_message_cap,
    });
  } catch (err) {
    console.error('[BREATH-BRIDGE] Status error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CHILD-FACING
// ═══════════════════════════════════════════════════════════════

// GET /api/breath-bridge/messages — Child's delivered messages
router.get('/messages', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;

    const userResult = await pool.query(
      'SELECT id, date_of_birth, family_unit_id FROM users WHERE id = $1 OR user_id = $2',
      [parseInt(userId) || 0, userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Must be a child
    const bracket = computeAgeBracket(user.date_of_birth);
    if (!CHILD_BRACKETS.includes(bracket)) {
      return res.status(403).json({ error: 'This endpoint is for child participants only' });
    }

    // Find family
    let familyId = user.family_unit_id;
    if (!familyId) {
      const famResult = await pool.query(
        `SELECT family_unit_id FROM family_memberships
         WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [user.id]
      );
      familyId = famResult.rows[0]?.family_unit_id;
    }
    if (!familyId) {
      return res.json({ messages: [] });
    }

    const result = await breathBridgeService.getChildMessages(user.id, familyId);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Messages error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CLINICIAN-FACING
// ═══════════════════════════════════════════════════════════════

// GET /api/breath-bridge/family/:familyId — Full status + message log
router.get('/family/:familyId', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const result = await breathBridgeService.getFamilyStatus(req.params.familyId);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Family status error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get family status' });
  }
});

// PUT /api/breath-bridge/family/:familyId/cadence — Update weekly cap
router.put('/family/:familyId/cadence', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const { weekly_message_cap } = req.body;
    if (!weekly_message_cap || !Number.isInteger(weekly_message_cap)) {
      return res.status(400).json({ error: 'weekly_message_cap (integer 1-5) required' });
    }
    const result = await breathBridgeService.updateCadence(req.params.familyId, weekly_message_cap);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Cadence update error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to update cadence' });
  }
});

// POST /api/breath-bridge/family/:familyId/pause — Pause channel
router.post('/family/:familyId/pause', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason required to pause Breath Bridge' });
    }
    const result = await breathBridgeService.pauseChannel(req.params.familyId, req.user.userId, reason.trim());
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Pause error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to pause' });
  }
});

// POST /api/breath-bridge/family/:familyId/resume — Resume channel
router.post('/family/:familyId/resume', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const result = await breathBridgeService.resumeChannel(req.params.familyId, req.user.userId);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Resume error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to resume' });
  }
});

// POST /api/breath-bridge/family/:familyId/guardian-consent — Record guardian consent
router.post('/family/:familyId/guardian-consent', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const result = await breathBridgeService.recordGuardianConsent(req.params.familyId);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Guardian consent error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

// GET /api/breath-bridge/family/:familyId/preview — Preview next scheduled message
router.get('/family/:familyId/preview', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const result = await breathBridgeService.previewNextMessage(req.params.familyId);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Preview error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to preview' });
  }
});

module.exports = router;
