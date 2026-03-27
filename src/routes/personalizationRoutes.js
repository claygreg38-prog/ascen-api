// ============================================================
// [ABI] Art Personalization Routes
// File: src/routes/personalizationRoutes.js
//
// Stage 3 of art pipeline. NON-DESTRUCTIVE compositing.
// All routes require JWT auth (applied at /api/art mount).
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const userPersonalizationLayer = require('../abi/userPersonalizationLayer');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── PREVIEW RATE LIMITER ─────────────────────────────────────
// 10 previews per minute per user. In-memory, resets on restart.
const previewTracker = new Map();
const PREVIEW_LIMIT = 10;
const PREVIEW_WINDOW_MS = 60 * 1000;

function checkPreviewRate(userId) {
  const now = Date.now();
  const timestamps = previewTracker.get(userId) || [];
  const recent = timestamps.filter(t => now - t < PREVIEW_WINDOW_MS);
  if (recent.length >= PREVIEW_LIMIT) return false;
  recent.push(now);
  previewTracker.set(userId, recent);
  return true;
}

// ── HELPER: resolve JWT user to integer users.id ─────────────
async function resolveUserId(req) {
  const authId = req.user?.participant_id || req.user?.userId || req.user?.sub;
  if (!authId) return null;
  const result = await pool.query(
    'SELECT id FROM users WHERE user_id = $1 OR participant_id = $1',
    [authId]
  );
  return result.rows.length ? result.rows[0].id : null;
}

// ── POST /personalize — apply personalization ────────────────
router.post('/personalize', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const { session_completion_id, hue_shift, saturation_adjust, brightness_adjust,
            filter_preset, frame_override, overlay_texture, container_override } = req.body;

    if (!session_completion_id) {
      return res.status(400).json({ error: 'session_completion_id required' });
    }

    const result = await userPersonalizationLayer.personalizeArt(
      session_completion_id, userId, {
        hue_shift, saturation_adjust, brightness_adjust,
        filter_preset, frame_override, overlay_texture, container_override,
      }
    );

    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Personalization] Apply failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Personalization failed' });
  }
});

// ── POST /revert — revert to original harmonics version ──────
router.post('/revert', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const { session_completion_id } = req.body;
    if (!session_completion_id) {
      return res.status(400).json({ error: 'session_completion_id required' });
    }

    const result = await userPersonalizationLayer.revertToOriginal(
      session_completion_id, userId
    );
    res.json(result);
  } catch (err) {
    console.error('[Personalization] Revert failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Revert failed' });
  }
});

// ── GET /personalizations/:sessionId — get settings ──────────
router.get('/personalizations/:sessionCompletionId', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const result = await pool.query(
      'SELECT * FROM art_personalizations WHERE session_completion_id = $1 AND user_id = $2',
      [req.params.sessionCompletionId, userId]
    );

    res.json(result.rows.length ? result.rows[0] : null);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to fetch personalization' });
  }
});

// ── POST /preferences — save default preferences ────────────
router.post('/preferences', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    await userPersonalizationLayer.savePreferences(userId, req.body);
    res.json({ saved: true });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// ── GET /preferences — get user's default preferences ────────
router.get('/preferences', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const prefs = await userPersonalizationLayer.getPreferences(userId);
    res.json(prefs || { auto_apply: false });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// ── GET /presets — list available options ─────────────────────
router.get('/presets', (_req, res) => {
  res.json({
    filters: Object.keys(userPersonalizationLayer.FILTER_PRESETS),
    frames: ['none', 'seed_of_life', 'flower_of_life', 'metatrons_cube', 'sri_yantra',
             'minimal', 'double_ring', 'organic'],
    overlays: Object.keys(userPersonalizationLayer.OVERLAY_TEXTURES),
    containers: ['square', 'circle', 'oval', 'triangle', 'hexagon', 'diamond'],
  });
});

// ── GET /preview — preview without saving (rate-limited) ─────
router.get('/preview', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'User not found' });

    // Rate limit: 10 previews/min/user
    if (!checkPreviewRate(userId)) {
      return res.status(429).json({ error: 'Preview rate limit exceeded. Try again in a minute.' });
    }

    const { session_completion_id, hue_shift, saturation_adjust, brightness_adjust,
            filter_preset, frame_override, overlay_texture, container_override } = req.query;

    if (!session_completion_id) {
      return res.status(400).json({ error: 'session_completion_id required' });
    }

    const pngBuffer = await userPersonalizationLayer.previewPersonalization(
      parseInt(session_completion_id, 10), userId, {
        hue_shift: parseInt(hue_shift, 10) || 0,
        saturation_adjust: parseFloat(saturation_adjust) || 1.0,
        brightness_adjust: parseFloat(brightness_adjust) || 1.0,
        filter_preset: filter_preset || 'none',
        frame_override: frame_override || null,
        overlay_texture: overlay_texture || 'none',
        container_override: container_override || null,
      }
    );

    if (pngBuffer && pngBuffer.error) {
      return res.status(400).json(pngBuffer);
    }

    // Return raw PNG (no IPFS upload — previews are free)
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(pngBuffer);
  } catch (err) {
    console.error('[Personalization] Preview failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Preview failed' });
  }
});

module.exports = router;
