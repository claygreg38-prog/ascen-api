// ============================================================
// Prenatal Routes — System Preparation API
// File: src/routes/prenatalRoutes.js
//
// The parent's nervous system IS the child's environment.
//
// Endpoints:
//   POST /enroll               — enroll with due_date
//   GET  /status               — current enrollment + trimester
//   PUT  /partner              — add partner to enrollment
//   GET  /content              — trimester content for current week
//   GET  /heritage-focus       — prenatal Heritage/Price focus
//   POST /codes-to-deprecate   — record patterns to change
//   POST /triad/start          — start triad breath session
//   POST /triad/tick           — parent + partner biometrics
//   POST /triad/complete       — complete triad session
//   GET  /adaptations          — trimester session modifications
//   POST /birth-plan           — store personalized birth breath plan
//   POST /birth                — record birth (transition to postnatal)
//   POST /loss                 — handle pregnancy loss with dignity
//   GET  /dashboard            — full prenatal dashboard
// ============================================================

'use strict';

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const prenatalEngine = require('../abi/prenatalEngine');
const triadBreathEngine = require('../abi/triadBreathEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helper: resolve user DB id ───────────────────────────────

async function resolveUserId(req) {
  const userId = req.user?.participant_id || req.user?.userId || req.user?.sub;
  const userRow = await pool.query(
    'SELECT id FROM users WHERE user_id = $1 OR id = $2',
    [userId, parseInt(userId) || 0]
  );
  return userRow.rows[0]?.id || null;
}

// ═══════════════════════════════════════════════════════════════
// ENROLLMENT
// ═══════════════════════════════════════════════════════════════

router.post('/enroll', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const { due_date, partner_id, family_unit_id } = req.body;
    if (!due_date) return res.status(400).json({ error: 'due_date required' });

    const tenantId = req.tenantId || null;
    const result = await prenatalEngine.enroll(userId, partner_id, family_unit_id, due_date, tenantId);
    res.json(result);
  } catch (err) {
    console.error('[PRENATAL] Enroll failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to enroll' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const week = prenatalEngine.computeGestationalWeek(enrollment.due_date);
    const trimester = prenatalEngine.computeTrimester(week);

    res.json({
      enrollment_id: enrollment.id,
      status: enrollment.status,
      due_date: enrollment.due_date,
      trimester,
      gestational_week: week,
      phase: prenatalEngine.TRIMESTER_PHASES[trimester],
      partner_enrolled: !!enrollment.partner_id,
      codes_to_deprecate: enrollment.codes_to_deprecate || [],
      enrolled_at: enrollment.enrolled_at
    });
  } catch (err) {
    console.error('[PRENATAL] Status failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

router.put('/partner', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const { partner_id } = req.body;
    if (!partner_id) return res.status(400).json({ error: 'partner_id required' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const result = await prenatalEngine.addPartner(enrollment.id, partner_id);
    res.json(result);
  } catch (err) {
    console.error('[PRENATAL] Add partner failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to add partner' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONTENT
// ═══════════════════════════════════════════════════════════════

router.get('/content', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const content = await prenatalEngine.getContent(enrollment.due_date);
    res.json(content);
  } catch (err) {
    console.error('[PRENATAL] Content failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get content' });
  }
});

router.get('/heritage-focus', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const focus = await prenatalEngine.getPrenatalHeritageFocus(userId);
    if (!focus) return res.status(404).json({ error: 'Complete LACE assessment first' });

    res.json(focus);
  } catch (err) {
    console.error('[PRENATAL] Heritage focus failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get heritage focus' });
  }
});

router.post('/codes-to-deprecate', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const { codes } = req.body;
    if (!codes || !Array.isArray(codes)) return res.status(400).json({ error: 'codes array required' });

    const result = await prenatalEngine.recordCodesToDeprecate(enrollment.id, codes);
    res.json(result);
  } catch (err) {
    console.error('[PRENATAL] Codes to deprecate failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record codes' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TRIAD BREATH
// ═══════════════════════════════════════════════════════════════

router.post('/triad/start', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const { session_completion_id } = req.body;
    const result = await triadBreathEngine.startTriadSession(enrollment.id, session_completion_id);
    res.json(result);
  } catch (err) {
    console.error('[PRENATAL] Triad start failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start triad session' });
  }
});

router.post('/triad/tick', async (req, res) => {
  try {
    const { session_id, parent_biometrics, partner_biometrics } = req.body;
    if (!session_id || !parent_biometrics) {
      return res.status(400).json({ error: 'session_id and parent_biometrics required' });
    }

    const triadQuality = await triadBreathEngine.recordTriadBiometrics(
      session_id, parent_biometrics, partner_biometrics
    );

    // Triad-specific drifting word
    const drifting_word = triadBreathEngine.getTriadDriftingWord(
      parent_biometrics.coherence || 0
    );

    res.json({ triad_quality: triadQuality, drifting_word });
  } catch (err) {
    console.error('[PRENATAL] Triad tick failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to process triad tick' });
  }
});

router.post('/triad/complete', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const history = await triadBreathEngine.getTriadHistory(enrollment.id, 1);

    res.json({
      completed: true,
      session_id,
      total_triad_sessions: history.length
    });
  } catch (err) {
    console.error('[PRENATAL] Triad complete failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete triad session' });
  }
});

// ═══════════════════════════════════════════════════════════════
// SESSION ADAPTATIONS
// ═══════════════════════════════════════════════════════════════

router.get('/adaptations', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const adaptations = prenatalEngine.getSessionAdaptations(enrollment.due_date);
    res.json(adaptations);
  } catch (err) {
    console.error('[PRENATAL] Adaptations failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get adaptations' });
  }
});

// ═══════════════════════════════════════════════════════════════
// BIRTH BREATH PLAN (Fix #9)
// ═══════════════════════════════════════════════════════════════

router.post('/birth-plan', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const { birth_breath_plan } = req.body;
    if (!birth_breath_plan) return res.status(400).json({ error: 'birth_breath_plan required' });

    await pool.query(
      'UPDATE prenatal_enrollments SET birth_breath_plan = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(birth_breath_plan), enrollment.id]
    );

    res.json({ stored: true, birth_breath_plan });
  } catch (err) {
    console.error('[PRENATAL] Birth plan failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to store birth plan' });
  }
});

// ═══════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════

router.post('/birth', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const { birth_date, child_name } = req.body;
    if (!birth_date) return res.status(400).json({ error: 'birth_date required' });

    const result = await prenatalEngine.recordBirth(enrollment.id, birth_date, child_name);
    res.json(result);
  } catch (err) {
    console.error('[PRENATAL] Birth recording failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record birth' });
  }
});

router.post('/loss', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const enrollment = await prenatalEngine.getEnrollment(userId);
    if (!enrollment) return res.status(404).json({ error: 'No active prenatal enrollment' });

    const result = await prenatalEngine.recordLoss(enrollment.id);
    // Fix #5: Dignity message in route layer, not engine
    res.json({
      ...result,
      note: 'The work you did for this child was real. Your practice honored them.'
    });
  } catch (err) {
    console.error('[PRENATAL] Loss recording failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to process' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

router.get('/dashboard', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: 'User not found' });

    const dashboard = await prenatalEngine.getDashboard(userId);
    if (!dashboard) return res.status(404).json({ error: 'No active prenatal enrollment' });

    res.json(dashboard);
  } catch (err) {
    console.error('[PRENATAL] Dashboard failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

module.exports = router;
