// ============================================================
// Onboarding Routes — Consent, Orientation, State
// File: src/routes/onboardingRoutes.js
//
// Requires JWT. Manages post-registration onboarding flow.
// ============================================================

const express = require('express');
const router = express.Router();
const onboardingEngine = require('../abi/onboardingEngine');
const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resolveUserDbId(req) {
  const userId = req.user?.userId || req.user?.sub;
  if (!userId) return null;
  const r = await pool.query('SELECT id FROM users WHERE user_id = $1 OR id = $2', [userId, parseInt(userId) || 0]);
  return r.rows[0]?.id || null;
}

router.post('/consent', async (req, res) => {
  try {
    const userDbId = await resolveUserDbId(req);
    if (!userDbId) return res.status(401).json({ error: 'Authentication required' });

    const { art_generation, gallery_visible, data_sharing, lightbridge } = req.body;
    const result = await onboardingEngine.collectConsent(userDbId, { art_generation, gallery_visible, data_sharing, lightbridge });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Onboarding] Consent failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to save consent' });
  }
});

router.post('/orientation/complete', async (req, res) => {
  try {
    const userDbId = await resolveUserDbId(req);
    if (!userDbId) return res.status(401).json({ error: 'Authentication required' });

    const result = await onboardingEngine.completeOrientation(userDbId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Onboarding] Orientation failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete orientation' });
  }
});

router.get('/state', async (req, res) => {
  try {
    const userDbId = await resolveUserDbId(req);
    if (!userDbId) return res.status(401).json({ error: 'Authentication required' });

    const state = await onboardingEngine.getState(userDbId);
    res.json({ onboardingState: state });
  } catch (err) {
    console.error('[Onboarding] State failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get state' });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const userDbId = await resolveUserDbId(req);
    if (!userDbId) return res.status(401).json({ error: 'Authentication required' });

    const result = await onboardingEngine.completeOnboarding(userDbId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Onboarding] Complete failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

module.exports = router;
