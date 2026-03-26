// ============================================================
// Heritage/Price Routes — Heritage Strength & Cost Mapping API
// File: src/routes/heritagePriceRoutes.js
//
// POST /start         — begin session (requires completed LACE)
// GET  /prompts       — dimension prompts (age + role appropriate)
// POST /dimension     — record heritage/price per dimension
// POST /breath        — breath baseline between dimensions
// POST /response      — generational response per dimension
// POST /complete      — finalize session
// GET  /current       — get current session
// GET  /transition    — Haiku transition guidance (unsupervised only)
// GET  /family-map    — aggregate across family members
//
// All endpoints require authentication + family membership.
// Heritage = strength language. Price = cost language.
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Sentry = require('../instrument');
const engine = require('../abi/heritagePriceEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ── HELPER: verify family membership ─────────────────────────
async function requireFamilyMember(req, res) {
  const userId = req.user?.userId || req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const user = await pool.query(
    'SELECT id, family_unit_id, tenant_id FROM users WHERE id = $1 OR user_id = $2',
    [parseInt(userId) || 0, userId]
  );

  if (!user.rows.length) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }

  if (!user.rows[0].family_unit_id) {
    res.status(400).json({ error: 'Family membership required for heritage mapping' });
    return null;
  }

  return user.rows[0];
}

// POST /api/heritage/start — begin heritage/price session
router.post('/start', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await engine.startSession(user.id, user.family_unit_id, user.tenant_id);
    res.json(result);
  } catch (err) {
    console.error('[HERITAGE] Start error:', err.message);
    Sentry.captureException(err);
    if (err.message.includes('LACE assessment required')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to start heritage/price session' });
  }
});

// GET /api/heritage/prompts — dimension prompts (age + role appropriate)
router.get('/prompts', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { dimension, role, age_group } = req.query;

    if (dimension) {
      // Single dimension prompts
      const prompts = engine.getPrompts(dimension, role || 'parent', age_group || 'adult');
      if (!prompts) return res.status(400).json({ error: `Unknown dimension: ${dimension}` });
      return res.json(prompts);
    }

    // All dimensions
    const all = engine.DIMENSIONS.map(d => ({
      id: d.id,
      name: d.name,
      prompts: engine.getPrompts(d.id, role || 'parent', age_group || 'adult')
    }));
    res.json(all);
  } catch (err) {
    console.error('[HERITAGE] Prompts error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load prompts' });
  }
});

// POST /api/heritage/dimension — record heritage/price for a dimension
router.post('/dimension', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { session_id, dimension, heritage_text, price_text, action, role, biometric_snapshot } = req.body;
    if (!session_id || !dimension) {
      return res.status(400).json({ error: 'session_id and dimension required' });
    }

    const result = await engine.recordDimension(session_id, dimension, {
      heritage_text, price_text, action, role, biometric_snapshot
    });
    res.json(result);
  } catch (err) {
    console.error('[HERITAGE] Dimension error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record dimension' });
  }
});

// POST /api/heritage/breath — breath baseline between dimensions
router.post('/breath', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { session_id, after_dimension, baseline } = req.body;
    if (!session_id || !after_dimension || !baseline) {
      return res.status(400).json({ error: 'session_id, after_dimension, and baseline required' });
    }

    await engine.recordBreathBaseline(session_id, after_dimension, baseline);
    res.json({ recorded: true });
  } catch (err) {
    console.error('[HERITAGE] Breath baseline error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record breath baseline' });
  }
});

// POST /api/heritage/response — generational response for a dimension
router.post('/response', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { session_id, dimension, role, response } = req.body;
    if (!session_id || !dimension || !role || !response) {
      return res.status(400).json({ error: 'session_id, dimension, role, and response required' });
    }

    const result = await engine.recordGenerationalResponse(session_id, dimension, role, response);
    res.json(result);
  } catch (err) {
    console.error('[HERITAGE] Response error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record response' });
  }
});

// POST /api/heritage/complete — finalize heritage/price session
router.post('/complete', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const result = await engine.completeSession(session_id, user.tenant_id);
    res.json({ completed: true, ...result });
  } catch (err) {
    console.error('[HERITAGE] Complete error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete heritage/price session' });
  }
});

// GET /api/heritage/current — get current session
router.get('/current', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await engine.getSession(user.family_unit_id);
    res.json(result);
  } catch (err) {
    console.error('[HERITAGE] Current error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// GET /api/heritage/transition — Haiku transition guidance (unsupervised only)
router.get('/transition', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { session_id, dimension } = req.query;
    if (!session_id || !dimension) {
      return res.status(400).json({ error: 'session_id and dimension required' });
    }

    const result = await engine.getTransitionGuidance(session_id, dimension);
    res.json(result || { guidance: null });
  } catch (err) {
    console.error('[HERITAGE] Transition error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get transition guidance' });
  }
});

// GET /api/heritage/family-map — aggregate across family members
router.get('/family-map', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await engine.getFamilyMap(user.family_unit_id);
    if (!result) {
      return res.json({ available: false, message: 'No completed heritage/price sessions for this family' });
    }
    res.json({ available: true, ...result });
  } catch (err) {
    console.error('[HERITAGE] Family map error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load family map' });
  }
});

module.exports = router;
