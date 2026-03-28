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

// ═══════════════════════════════════════════════════════════════
// PHASE 3: COACHING + GATES + MONTHLY SUMMARY
// ═══════════════════════════════════════════════════════════════

// POST /api/breath-bridge/family/:familyId/gate-override — Advance gate
router.post('/family/:familyId/gate-override', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const { gate } = req.body;
    if (!gate) return res.status(400).json({ error: 'gate required (gate_1 through gate_4)' });
    const result = await breathBridgeService.overrideGate(req.params.familyId, gate, req.user.userId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Gate override error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to override gate' });
  }
});

// PUT /api/breath-bridge/family/:familyId/emphasis — Set domain emphasis
router.put('/family/:familyId/emphasis', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const { domain } = req.body;
    const validDomains = ['showing_up', 'emotional_vocabulary', 'co_regulation', 'letting_go', 'repair', null];
    if (!validDomains.includes(domain)) {
      return res.status(400).json({ error: 'Invalid domain' });
    }
    await pool.query(
      `UPDATE breath_bridge_config SET clinician_emphasis_domain = $1, updated_at = NOW() WHERE family_id = $2`,
      [domain, req.params.familyId]
    );
    res.json({ updated: true, clinician_emphasis_domain: domain });
  } catch (err) {
    console.error('[BREATH-BRIDGE] Emphasis error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to update emphasis' });
  }
});

// POST /api/breath-bridge/family/:familyId/enable-coaching — Enable coaching
router.post('/family/:familyId/enable-coaching', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const result = await breathBridgeService.enableCoaching(req.params.familyId);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Enable coaching error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to enable coaching' });
  }
});

// GET /api/breath-bridge/family/:familyId/coaching-progress — Coaching progress
router.get('/family/:familyId/coaching-progress', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const result = await breathBridgeService.getCoachingProgress(req.params.familyId);
    if (!result) return res.status(404).json({ error: 'Not enrolled' });
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Coaching progress error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get coaching progress' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PHASE 4: POST-RELEASE + SHARED BREATHING
// ═══════════════════════════════════════════════════════════════

// POST /api/breath-bridge/family/:familyId/post-release — Trigger transition
router.post('/family/:familyId/post-release', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const result = await breathBridgeService.triggerPostRelease(req.params.familyId, req.user.userId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Post-release error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to trigger post-release' });
  }
});

// GET /api/breath-bridge/co-presence — Check if other party is breathing
router.get('/co-presence', authenticate, async (req, res) => {
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
      const fam = await pool.query(
        'SELECT family_unit_id FROM family_memberships WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      familyId = fam.rows[0]?.family_unit_id;
    }
    if (!familyId) return res.json({ co_present: false });

    // Check post-release mode
    const config = await pool.query(
      'SELECT post_release_mode FROM breath_bridge_config WHERE family_id = $1',
      [familyId]
    );
    if (!config.rows[0]?.post_release_mode) {
      return res.json({ co_present: false, reason: 'not_post_release' });
    }

    // Check if child has opted out
    const childOpted = await breathBridgeService.isSharedBreathingOptedOut(user.id, familyId);
    if (childOpted) {
      // Invisible to parent — just show not co-present
      return res.json({ co_present: false });
    }

    const result = await breathBridgeService.checkCoPresence(familyId, user.id);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Co-presence error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to check co-presence' });
  }
});

// PUT /api/breath-bridge/shared-breathing-opt-out — Child opts out/in
router.put('/shared-breathing-opt-out', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { opted_out } = req.body;

    const userResult = await pool.query(
      'SELECT id, date_of_birth, family_unit_id FROM users WHERE id = $1 OR user_id = $2',
      [parseInt(userId) || 0, userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const bracket = computeAgeBracket(user.date_of_birth);
    if (!CHILD_BRACKETS.includes(bracket)) {
      return res.status(403).json({ error: 'Only child participants can set shared breathing preference' });
    }

    let familyId = user.family_unit_id;
    if (!familyId) {
      const fam = await pool.query(
        'SELECT family_unit_id FROM family_memberships WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      familyId = fam.rows[0]?.family_unit_id;
    }

    const result = await breathBridgeService.setSharedBreathingOptOut(user.id, familyId, !!opted_out);
    res.json(result);
  } catch (err) {
    console.error('[BREATH-BRIDGE] Opt-out error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to update preference' });
  }
});

module.exports = router;
