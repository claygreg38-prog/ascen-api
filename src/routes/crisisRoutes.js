// ============================================================
// Crisis Routes — Crisis Lifecycle, Steward, Domestic Safety
// File: src/routes/crisisRoutes.js
//
// Participant routes: self-report, privacy mode, exit family
// Facilitator routes: declare crisis, lifecycle transitions, steward auth
// ============================================================

const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Sentry = require('../instrument');

// ═══════════════════════════════════════════════════════════════
// PARTICIPANT ROUTES
// ═══════════════════════════════════════════════════════════════

// Self-report crisis
router.post('/self-report', async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await crisisEngine.selfReportCrisis(userRow.rows[0].id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to report crisis' });
  }
});

// Get current crisis status
router.get('/status', async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const crisis = await crisisEngine.getActiveCrisis(userRow.rows[0].id);
    if (!crisis) return res.json({ inCrisis: false });
    res.json({ inCrisis: true, phase: crisis.phase, crisisEventId: crisis.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get crisis status' });
  }
});

// Enable privacy mode
router.post('/privacy-mode/enable', async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await crisisEngine.enablePrivacyMode(userRow.rows[0].id);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to enable privacy mode' });
  }
});

// Disable privacy mode
router.post('/privacy-mode/disable', async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await crisisEngine.disablePrivacyMode(userRow.rows[0].id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable privacy mode' });
  }
});

// Exit family — any member, any time, no approval needed
router.post('/exit-family', async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { family_unit_id } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await crisisEngine.exitFamily(userRow.rows[0].id, family_unit_id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to exit family' });
  }
});

// Steward: step down — single action, no explanation required
router.post('/steward/step-down', async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { family_unit_id } = req.body;
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await crisisEngine.stewardStepDown(userRow.rows[0].id, family_unit_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to step down' });
  }
});

// Steward: send preset message
router.post('/steward/send-message', async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { family_unit_id, template_id } = req.body;
    if (!family_unit_id || !template_id) return res.status(400).json({ error: 'family_unit_id and template_id required' });

    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await crisisEngine.stewardSendMessage(userRow.rows[0].id, family_unit_id, template_id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get crisis message templates
router.get('/templates', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query('SELECT * FROM crisis_message_templates ORDER BY phase, id');
    res.json({ templates: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// ═══════════════════════════════════════════════════════════════
// FACILITATOR ROUTES (require facilitator or clinician role)
// ═══════════════════════════════════════════════════════════════

// Declare active crisis
router.post('/declare', requireRole('clinician'), async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { user_id, trigger_signals } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const facRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);

    const result = await crisisEngine.declareActiveCrisis(
      user_id, facRow.rows[0]?.id || null, 'facilitator_declared', trigger_signals
    );
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to declare crisis' });
  }
});

// Transition: start recovery
router.post('/recovery/start', requireRole('clinician'), async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { user_id } = req.body;
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const facRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);

    const result = await crisisEngine.startRecovery(user_id, facRow.rows[0]?.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to start recovery' });
  }
});

// Transition: start solo period
router.post('/solo/start', requireRole('clinician'), async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { user_id } = req.body;
    const result = await crisisEngine.startSoloPeriod(user_id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to start solo period' });
  }
});

// Authorize steward
router.post('/steward/authorize', requireRole('clinician'), async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const { steward_user_id, family_unit_id, adult_backup_id } = req.body;
    if (!steward_user_id || !family_unit_id || !adult_backup_id) {
      return res.status(400).json({ error: 'steward_user_id, family_unit_id, adult_backup_id required' });
    }

    const result = await crisisEngine.authorizeSteward(steward_user_id, family_unit_id, adult_backup_id, req.tenantId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to authorize steward' });
  }
});

// Check steward eligibility
router.get('/steward/eligibility/:userId/:familyUnitId', requireRole('clinician'), async (req, res) => {
  try {
    const crisisEngine = require('../abi/crisisEngine');
    const result = await crisisEngine.evaluateStewardEligibility(
      parseInt(req.params.userId), req.params.familyUnitId
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

// View active crises (facilitator dashboard)
router.get('/active', requireRole('clinician'), async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      `SELECT ce.*, u.first_name, u.participant_id FROM crisis_events ce
       JOIN users u ON ce.user_id = u.id
       WHERE ce.phase NOT IN ('resolved')
       ORDER BY ce.created_at DESC`
    );
    res.json({ crises: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get active crises' });
  }
});

module.exports = router;
