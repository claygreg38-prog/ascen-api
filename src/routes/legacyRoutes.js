// ============================================================
// [ABI] Legacy Routes — Legacy Vault API
// File: src/routes/legacyRoutes.js
//
// All routes accept X-API-Key for test harness access.
// 42 CFR Part 2 protected.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const legacyVaultEngine = require('../abi/legacyVaultEngine');
const capsuleUnlockEngine = require('../abi/capsuleUnlockEngine');
const ancestralBreathEngine = require('../abi/ancestralBreathEngine');
const familyBreathWeave = require('../abi/familyBreathWeave');

// ── POST /capsule — Create a new legacy capsule ─────────────
router.post('/capsule', async (req, res) => {
  try {
    const {
      creator_participant_id, session_completion_id, personalized_art_id,
      affirmation, release_type, release_schedule, designees, recovery_opt_in
    } = req.body;

    const participantId = creator_participant_id || req.user?.userId;
    if (!participantId || !session_completion_id || !affirmation) {
      return res.status(400).json({ error: 'creator_participant_id, session_completion_id, and affirmation required' });
    }

    const result = await legacyVaultEngine.createCapsule({
      creatorParticipantId: participantId,
      sessionCompletionId: session_completion_id,
      personalizedArtId: personalized_art_id || null,
      affirmation,
      releaseType: release_type || 'immediate',
      releaseSchedule: release_schedule || null,
      designees: designees || [],
      recoveryOptIn: recovery_opt_in || false
    });

    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] POST /capsule failed:', err.message);
    res.status(err.message.includes('not found') || err.message.includes('not eligible') ? 400 : 500)
      .json({ error: err.message });
  }
});

// ── POST /capsule/:id/review — Review capsule ───────────────
router.post('/capsule/:id/review', async (req, res) => {
  try {
    const { seed_phrase } = req.body;
    const creatorId = req.body.creator_id || req.user?.userId;

    if (!seed_phrase) {
      return res.status(400).json({ error: 'seed_phrase required' });
    }

    const result = await legacyVaultEngine.reviewCapsule(req.params.id, creatorId, seed_phrase);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] POST /capsule/:id/review failed:', err.message);
    const status = err.message.includes('does not match') ? 403
      : err.message.includes('already used') || err.message.includes('locked') ? 409
      : err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── PUT /capsule/:id/edit — Edit affirmation ────────────────
router.put('/capsule/:id/edit', async (req, res) => {
  try {
    const { seed_phrase, new_affirmation } = req.body;
    const creatorId = req.body.creator_id || req.user?.userId;

    if (!seed_phrase || !new_affirmation) {
      return res.status(400).json({ error: 'seed_phrase and new_affirmation required' });
    }

    const result = await legacyVaultEngine.editCapsule(req.params.id, creatorId, seed_phrase, new_affirmation);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] PUT /capsule/:id/edit failed:', err.message);
    const status = err.message.includes('does not match') ? 403
      : err.message.includes('already used') || err.message.includes('locked') ? 409
      : err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /capsule/:id/lock — Lock capsule permanently ───────
router.post('/capsule/:id/lock', async (req, res) => {
  try {
    const creatorId = req.body.creator_id || req.user?.userId;
    const result = await legacyVaultEngine.lockCapsule(req.params.id, creatorId);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] POST /capsule/:id/lock failed:', err.message);
    const status = err.message.includes('already locked') ? 409
      : err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /capsule/:id/recover — Recovery path ───────────────
router.post('/capsule/:id/recover', async (req, res) => {
  try {
    const { clinician_jwt, admin_jwt } = req.body;

    if (!clinician_jwt || !admin_jwt) {
      return res.status(400).json({ error: 'Both clinician_jwt and admin_jwt required (two-person rule)' });
    }

    const result = await capsuleUnlockEngine.recoverCapsule(req.params.id, clinician_jwt, admin_jwt);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] POST /capsule/:id/recover failed:', err.message);
    const status = err.message.includes('not found') ? 404
      : err.message.includes('not enabled') || err.message.includes('not configured') ? 400
      : err.message.includes('Invalid') || err.message.includes('required') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── GET /available/:walletAddress — Check available capsules ─
router.get('/available/:walletAddress', async (req, res) => {
  try {
    const result = await capsuleUnlockEngine.checkAvailableCapsules(req.params.walletAddress);
    res.json({ capsules: result });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] GET /available/:walletAddress failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /unlock/:capsuleId — Unlock a capsule ──────────────
router.post('/unlock/:capsuleId', async (req, res) => {
  try {
    const { designee_id, seed_phrase } = req.body;

    if (!designee_id || !seed_phrase) {
      return res.status(400).json({ error: 'designee_id and seed_phrase required' });
    }

    const result = await capsuleUnlockEngine.unlockCapsule(req.params.capsuleId, designee_id, seed_phrase);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] POST /unlock/:capsuleId failed:', err.message);
    const status = err.message.includes('does not match') ? 403
      : err.message.includes('not found') || err.message.includes('not authorized') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /ancestral-session/:capsuleId — Start ancestral session ─
router.post('/ancestral-session/:capsuleId', async (req, res) => {
  try {
    const { designee_id } = req.body;

    if (!designee_id) {
      return res.status(400).json({ error: 'designee_id required' });
    }

    const result = await ancestralBreathEngine.createAncestralSession(designee_id, req.params.capsuleId);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] POST /ancestral-session/:capsuleId failed:', err.message);
    const status = err.message.includes('not found') || err.message.includes('not authorized') ? 404
      : err.message.includes('must be unlocked') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /weave — Create family breath weave ────────────────
router.post('/weave', async (req, res) => {
  try {
    const { family_unit_id, contributing_capsule_ids } = req.body;

    if (!family_unit_id || !contributing_capsule_ids) {
      return res.status(400).json({ error: 'family_unit_id and contributing_capsule_ids required' });
    }

    const result = await familyBreathWeave.createWeave(family_unit_id, contributing_capsule_ids);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] POST /weave failed:', err.message);
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
});

// ── GET /weave/:familyUnitId — Get family's weave history ───
router.get('/weave/:familyUnitId', async (req, res) => {
  try {
    const result = await familyBreathWeave.getWeaveHistory(req.params.familyUnitId);
    res.json({ weaves: result });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[LEGACY] GET /weave/:familyUnitId failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
