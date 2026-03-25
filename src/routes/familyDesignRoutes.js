// ============================================================
// Family Design Routes — System Design Mode API
// File: src/routes/familyDesignRoutes.js
//
// Blueprint (Mode 1): POST start, GET prompts, POST vision, POST declaration, POST complete, GET current
// Sandbox (Mode 2): POST start, POST biometrics, POST complete, GET history, GET suggest
// Vision Board (Mode 3): GET vision-board, GET milestones
// Heritage/Price: POST start, POST response, POST complete, GET current
//
// All endpoints require authentication + family membership.
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Sentry = require('../instrument');
const engine = require('../abi/familyDesignEngine');

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
    res.status(400).json({ error: 'Family membership required for system design' });
    return null;
  }

  return user.rows[0];
}

// ── HELPER: verify family role ───────────────────────────────
async function getFamilyRole(userId, familyUnitId) {
  const result = await pool.query(
    'SELECT role FROM family_memberships WHERE user_id = $1 AND family_unit_id = $2 AND status = $3',
    [userId, familyUnitId, 'active']
  );
  return result.rows[0]?.role || 'member';
}

// ═══════════════════════════════════════════════════════════════
// HERITAGE/PRICE ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/design/heritage-price/start — begin heritage/price session
router.post('/heritage-price/start', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { confirmed_armors } = req.body;
    if (!confirmed_armors || !Array.isArray(confirmed_armors) || confirmed_armors.length === 0) {
      // Try to get from latest LACE assessment
      const lace = await pool.query(
        `SELECT confirmed_armors FROM lace_assessments
         WHERE family_unit_id = $1 AND status IN ('completed', 'reviewed')
         ORDER BY completed_at DESC LIMIT 1`,
        [user.family_unit_id]
      );

      if (!lace.rows.length || !lace.rows[0].confirmed_armors?.length) {
        return res.status(400).json({ error: 'Complete LACE assessment first — armor map required before heritage/price' });
      }

      const armors = lace.rows[0].confirmed_armors.map(a => typeof a === 'string' ? a : a.armor || a.name);
      const result = await engine.startHeritagePrice(user.id, user.family_unit_id, user.tenant_id, armors);
      return res.json(result);
    }

    const result = await engine.startHeritagePrice(user.id, user.family_unit_id, user.tenant_id, confirmed_armors);
    res.json(result);
  } catch (err) {
    console.error('[DESIGN] Heritage/Price start error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start heritage/price session' });
  }
});

// POST /api/design/heritage-price/response — record generational response
router.post('/heritage-price/response', async (req, res) => {
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
    console.error('[DESIGN] Heritage/Price response error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record response' });
  }
});

// POST /api/design/heritage-price/complete — finalize heritage/price
router.post('/heritage-price/complete', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const result = await engine.completeHeritagePrice(session_id, user.tenant_id);
    res.json({ completed: true, high_cost_dimensions: result.high_cost_dimensions });
  } catch (err) {
    console.error('[DESIGN] Heritage/Price complete error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete heritage/price session' });
  }
});

// GET /api/design/heritage-price — get current heritage/price session
router.get('/heritage-price', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await pool.query(
      'SELECT * FROM heritage_price_sessions WHERE family_unit_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.family_unit_id]
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('[DESIGN] Heritage/Price get error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load heritage/price session' });
  }
});

// ═══════════════════════════════════════════════════════════════
// BLUEPRINT ROUTES (Mode 1)
// ═══════════════════════════════════════════════════════════════

// POST /api/design/blueprint/start — begin blueprint
router.post('/blueprint/start', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { heritage_price_session_id } = req.body;
    if (!heritage_price_session_id) {
      return res.status(400).json({ error: 'heritage_price_session_id required — complete Heritage/Price first' });
    }

    const result = await engine.startBlueprint(user.family_unit_id, heritage_price_session_id, user.tenant_id);
    res.json(result);
  } catch (err) {
    console.error('[DESIGN] Blueprint start error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start blueprint' });
  }
});

// GET /api/design/blueprint/prompts — dimension prompts (filtered to high-cost)
router.get('/blueprint/prompts', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { heritage_price_session_id } = req.query;
    const result = await engine.getBlueprintPrompts(heritage_price_session_id);
    res.json(result);
  } catch (err) {
    console.error('[DESIGN] Blueprint prompts error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load prompts' });
  }
});

// POST /api/design/blueprint/vision — record per-dimension vision by role
router.post('/blueprint/vision', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { blueprint_id, dimension, role, vision } = req.body;
    if (!blueprint_id || !dimension || !role || !vision) {
      return res.status(400).json({ error: 'blueprint_id, dimension, role, and vision required' });
    }

    const result = await engine.recordBlueprintVision(blueprint_id, dimension, role, vision);
    res.json(result);
  } catch (err) {
    console.error('[DESIGN] Blueprint vision error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record vision' });
  }
});

// POST /api/design/blueprint/declaration — set family code declaration (elder only)
router.post('/blueprint/declaration', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    // Elder-only action
    const familyRole = await getFamilyRole(user.id, user.family_unit_id);
    if (familyRole !== 'elder') {
      return res.status(403).json({ error: 'Only the elder can set the family declaration' });
    }

    const { blueprint_id, declaration } = req.body;
    if (!blueprint_id || !declaration) {
      return res.status(400).json({ error: 'blueprint_id and declaration required' });
    }

    await engine.setFamilyDeclaration(blueprint_id, declaration);
    res.json({ saved: true });
  } catch (err) {
    console.error('[DESIGN] Blueprint declaration error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to set declaration' });
  }
});

// POST /api/design/blueprint/complete — finalize blueprint
router.post('/blueprint/complete', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { blueprint_id } = req.body;
    if (!blueprint_id) return res.status(400).json({ error: 'blueprint_id required' });

    const result = await engine.completeBlueprint(blueprint_id, user.tenant_id);
    res.json({
      completed: true,
      dimensions_designed: Object.keys(result.dimension_blueprints).length,
      has_declaration: !!result.family_declaration
    });
  } catch (err) {
    console.error('[DESIGN] Blueprint complete error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete blueprint' });
  }
});

// GET /api/design/blueprint — get current/latest blueprint
router.get('/blueprint', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await engine.getBlueprint(user.family_unit_id);
    res.json(result);
  } catch (err) {
    console.error('[DESIGN] Blueprint get error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load blueprint' });
  }
});

// ═══════════════════════════════════════════════════════════════
// SANDBOX ROUTES (Mode 2)
// ═══════════════════════════════════════════════════════════════

// POST /api/design/sandbox/start — begin scenario
router.post('/sandbox/start', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { blueprint_id, scenario_type, target_armor, target_dimension, title, description } = req.body;
    if (!blueprint_id || !scenario_type) {
      return res.status(400).json({ error: 'blueprint_id and scenario_type required' });
    }

    // Verify blueprint is completed before sandbox
    const bp = await pool.query('SELECT status FROM family_blueprints WHERE id = $1', [blueprint_id]);
    if (!bp.rows.length || bp.rows[0].status !== 'completed') {
      return res.status(400).json({ error: 'Complete the blueprint before starting sandbox sessions' });
    }

    const result = await engine.startSandbox(
      user.family_unit_id, blueprint_id, scenario_type,
      target_armor, target_dimension, title, description, user.tenant_id
    );
    res.json(result);
  } catch (err) {
    console.error('[DESIGN] Sandbox start error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start sandbox session' });
  }
});

// POST /api/design/sandbox/biometrics — record round biometrics
router.post('/sandbox/biometrics', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { sandbox_id, round, biometrics } = req.body;
    if (!sandbox_id || !round || !biometrics) {
      return res.status(400).json({ error: 'sandbox_id, round, and biometrics required' });
    }

    await engine.recordSandboxBiometrics(sandbox_id, round, biometrics);
    res.json({ recorded: true, round });
  } catch (err) {
    console.error('[DESIGN] Sandbox biometrics error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record biometrics' });
  }
});

// POST /api/design/sandbox/complete — finalize with debrief
router.post('/sandbox/complete', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const { sandbox_id, debrief } = req.body;
    if (!sandbox_id) return res.status(400).json({ error: 'sandbox_id required' });

    const result = await engine.completeSandbox(sandbox_id, debrief, user.tenant_id);
    // Return regulation_improved boolean only — never raw NS3
    res.json({
      completed: true,
      scenario_type: result.scenario_type,
      regulation_improved: result.comparison?.regulation_improved || null
    });
  } catch (err) {
    console.error('[DESIGN] Sandbox complete error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete sandbox session' });
  }
});

// GET /api/design/sandbox/history — past scenarios
router.get('/sandbox/history', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await engine.getSandboxHistory(user.family_unit_id);
    res.json(result);
  } catch (err) {
    console.error('[DESIGN] Sandbox history error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load sandbox history' });
  }
});

// GET /api/design/sandbox/suggest — AXIS suggests scenarios based on armor
router.get('/sandbox/suggest', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await engine.suggestScenarios(user.family_unit_id);
    res.json(result);
  } catch (err) {
    console.error('[DESIGN] Sandbox suggest error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to suggest scenarios' });
  }
});

// ═══════════════════════════════════════════════════════════════
// VISION BOARD ROUTES (Mode 3)
// ═══════════════════════════════════════════════════════════════

// GET /api/design/vision-board — assembled vision board
router.get('/vision-board', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await engine.getVisionBoard(user.family_unit_id);
    if (!result) {
      return res.json({ available: false, message: 'Complete a blueprint to unlock the system rendering' });
    }
    res.json({ available: true, ...result });
  } catch (err) {
    console.error('[DESIGN] Vision board error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load system rendering' });
  }
});

// GET /api/design/vision-board/milestones — milestone trail
router.get('/vision-board/milestones', async (req, res) => {
  try {
    const user = await requireFamilyMember(req, res);
    if (!user) return;

    const result = await pool.query(
      'SELECT entry_type, entry_data, created_at FROM lineage_entries WHERE family_unit_id = $1 ORDER BY created_at ASC',
      [user.family_unit_id]
    );

    res.json(result.rows.map(m => ({
      type: m.entry_type,
      data: m.entry_data,
      date: m.created_at
    })));
  } catch (err) {
    console.error('[DESIGN] Milestones error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load milestones' });
  }
});

module.exports = router;
