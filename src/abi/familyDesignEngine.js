// ============================================================
// [ABI] Family Design Engine — System Design Mode
// File: src/abi/familyDesignEngine.js
//
// Three modes:
//   Mode 1 (Blueprint): Family imagines life without old code
//   Mode 2 (Sandbox):   Family rehearses new code in simulated scenarios
//   Mode 3 (Vision Board): Living visual document, auto-assembled
//
// Arc position: LACE → Armor → Heritage/Price → THIS → Firmware → Field Testing
// Stages of change: Preparation — "We're designing what we want instead"
//
// Blueprint before Sandbox. You cannot rehearse what you haven't imagined.
// Sandbox before real-life Field Tests. You rehearse before the world tests you.
// Vision Board auto-assembles. No manual creation step.
// ============================================================

const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ═══════════════════════════════════════════════════════════════
// BLUEPRINT PROMPTS — per heritage dimension, by generational role
// 8 dimensions: physical, emotional, relational, financial,
//               spiritual, vocational, educational, communal
// ═══════════════════════════════════════════════════════════════

const BLUEPRINT_PROMPTS = {
  physical: {
    prompt: 'Close your eyes. Picture your family one year from now. Everyone\'s body is rested. What does that look like? What are you doing differently?',
    child: 'Draw a picture of your family when everyone feels good in their body.',
    elder: 'What would your body feel like if it could finally put down what it\'s been holding?'
  },
  emotional: {
    prompt: 'Imagine a dinner table where everyone says what they actually feel. What does the room sound like? What changes?',
    child: 'If everyone in your family could show any feeling without getting in trouble, what would change?',
    elder: 'What feeling have you been holding back your whole life? What happens if you let it out?'
  },
  relational: {
    prompt: 'Imagine your family hosting people in your home — and everyone is being themselves, not performing. Who\'s there? What\'s happening?',
    child: 'If you could bring your friends into your family without being embarrassed, what would they see?',
    elder: 'Who did you stop letting in? What would it take to open that door again?'
  },
  financial: {
    prompt: 'Picture your family five years from now with something you built together. A savings account. A property. A business. What is it?',
    child: 'If your family could save up for one big thing together, what would it be?',
    elder: 'What did you want to build that you never got to? What if your grandchildren built it?'
  },
  spiritual: {
    prompt: 'Imagine your family having a spiritual practice that feels honest — not performed, not avoided. What does it look like?',
    child: 'What do you believe about the world that nobody in your family talks about?',
    elder: 'What did your people believe before the hard times changed what faith meant?'
  },
  vocational: {
    prompt: 'Imagine your family on a Saturday where nobody is working, and nobody feels guilty about it. What are you doing instead?',
    child: 'What do you wish your parent would do instead of working all the time?',
    elder: 'When was the last time you rested without feeling like you were failing?'
  },
  educational: {
    prompt: 'Picture your family making a big decision together without the anxiety. What does the conversation look like?',
    child: 'When your family has to decide something important, what do you wish would happen?',
    elder: 'If the worry stopped, what would you think about instead?'
  },
  communal: {
    prompt: 'Imagine walking into your home and feeling like you belong there — permanently. What\'s different about the space?',
    child: 'If you could make your house feel any way you wanted, what would it feel like?',
    elder: 'Where was the last place that felt completely like home? What made it feel that way?'
  }
};

// ═══════════════════════════════════════════════════════════════
// SCENARIO TEMPLATES — role instructions by type
// ═══════════════════════════════════════════════════════════════

const SCENARIO_TEMPLATES = {
  replay: {
    instruction: 'The system takes a real moment from the family\'s past and replays it with new code.',
    elder_role: 'Tell us what actually happened. Then watch while the family practices the new way.',
    parent_role: 'You\'re in the scene. The old code wants to activate. Use the new code instead.',
    child_role: 'You\'re watching. Tell us: does this feel different from how it usually goes?'
  },
  preview: {
    instruction: 'The system generates a future scenario the family hasn\'t faced yet but likely will.',
    elder_role: 'Tell us how this scene usually plays out. Then help us script a new version.',
    parent_role: 'You\'re the Bridge. Show the family the new response in real time.',
    child_role: 'You\'re the Mirror. After the rehearsal, tell us — did it feel real? Would it actually work?'
  },
  contrast: {
    instruction: 'The family runs the same scenario TWICE. First with old code, then with new code.',
    elder_role: 'In Round 1, be yourself from 20 years ago. In Round 2, be yourself today.',
    parent_role: 'In Round 1, run the inherited code. In Round 2, run the update.',
    child_role: 'Watch both rounds. Tell us which family you want to live in.'
  }
};

// ═══════════════════════════════════════════════════════════════
// MODE 1: BLUEPRINT — Imagine
// ═══════════════════════════════════════════════════════════════

async function startBlueprint(familyUnitId, heritagePriceSessionId, tenantId) {
  try {
    const result = await pool.query(`
      INSERT INTO family_blueprints (family_unit_id, heritage_price_session_id, tenant_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [familyUnitId, heritagePriceSessionId, tenantId]);
    return { id: result.rows[0].id };
  } catch (err) {
    console.error('[DESIGN] Start blueprint failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function getBlueprint(familyUnitId) {
  try {
    const result = await pool.query(
      'SELECT * FROM family_blueprints WHERE family_unit_id = $1 ORDER BY created_at DESC LIMIT 1',
      [familyUnitId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('[DESIGN] Get blueprint failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Get blueprint prompts filtered to high-cost dimensions only.
 * Only dimensions marked 'modify' or 'deprecate' in Heritage/Price get prompts.
 */
async function getBlueprintPrompts(heritagePriceSessionId) {
  try {
    const hp = await pool.query(
      'SELECT dimension_actions, high_cost_dimensions FROM heritage_price_sessions WHERE id = $1',
      [heritagePriceSessionId]
    );
    if (!hp.rows.length) return { prompts: BLUEPRINT_PROMPTS, filtered: false };

    const actions = hp.rows[0].dimension_actions || {};
    const filtered = {};
    for (const [dim, action] of Object.entries(actions)) {
      if (action === 'modify' || action === 'deprecate') {
        if (BLUEPRINT_PROMPTS[dim]) {
          filtered[dim] = BLUEPRINT_PROMPTS[dim];
        }
      }
    }

    // If no dimensions marked, return all prompts
    if (Object.keys(filtered).length === 0) {
      return { prompts: BLUEPRINT_PROMPTS, filtered: false };
    }

    return { prompts: filtered, filtered: true, dimension_actions: actions };
  } catch (err) {
    console.error('[DESIGN] Get prompts failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function recordBlueprintVision(blueprintId, dimensionId, role, vision) {
  // role: 'elder' | 'parent' | 'child'
  // vision: text (or for elementary children: drawing upload reference)
  try {
    const bp = await pool.query(
      'SELECT dimension_blueprints FROM family_blueprints WHERE id = $1',
      [blueprintId]
    );
    if (!bp.rows.length) throw new Error('Blueprint not found');

    const dims = bp.rows[0].dimension_blueprints || {};
    if (!dims[dimensionId]) dims[dimensionId] = {};

    if (role === 'elder') dims[dimensionId].elder_vision = vision;
    else if (role === 'child') dims[dimensionId].child_vision = vision;
    else dims[dimensionId].parent_vision = vision;

    // If all three roles contributed, synthesize a blueprint statement
    if (dims[dimensionId].elder_vision && dims[dimensionId].parent_vision && dims[dimensionId].child_vision) {
      dims[dimensionId].blueprint_statement = `Elder sees: ${dims[dimensionId].elder_vision}. Parent builds: ${dims[dimensionId].parent_vision}. Child envisions: ${dims[dimensionId].child_vision}.`;
    }

    await pool.query(
      'UPDATE family_blueprints SET dimension_blueprints = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(dims), blueprintId]
    );

    return dims[dimensionId];
  } catch (err) {
    console.error('[DESIGN] Record vision failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function setFamilyDeclaration(blueprintId, declaration) {
  // "We are the [name] family. We carry the strength of [armors].
  //  We are deprecating [patterns]. We are installing [code].
  //  Our children will inherit [vision]."
  try {
    await pool.query(
      'UPDATE family_blueprints SET family_declaration = $1, updated_at = NOW() WHERE id = $2',
      [declaration, blueprintId]
    );
  } catch (err) {
    console.error('[DESIGN] Set declaration failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function completeBlueprint(blueprintId, tenantId) {
  try {
    await pool.query(
      'UPDATE family_blueprints SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['completed', blueprintId]
    );

    const bp = await pool.query('SELECT * FROM family_blueprints WHERE id = $1', [blueprintId]);
    const data = bp.rows[0];

    // Update lineage_profiles with blueprint
    await pool.query(
      'UPDATE lineage_profiles SET family_blueprint = $1, updated_at = NOW() WHERE family_unit_id = $2',
      [JSON.stringify(data.dimension_blueprints), data.family_unit_id]
    );

    // Record on lineage ledger
    const lineageService = require('../services/lineageService');
    await lineageService.recordEntry(null, data.family_unit_id, tenantId, 'blueprint_created', {
      dimensions_designed: Object.keys(data.dimension_blueprints).length,
      has_declaration: !!data.family_declaration
    });

    return data;
  } catch (err) {
    console.error('[DESIGN] Complete blueprint failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// HERITAGE/PRICE — Maps armor costs to heritage dimensions
// ═══════════════════════════════════════════════════════════════

// Armor → dimension cost mapping
// Each armor's cost manifests across specific heritage dimensions
const ARMOR_DIMENSION_COSTS = {
  'The Sentinel':   { physical: 8, emotional: 6, communal: 7 },
  'The Fortress':   { relational: 9, emotional: 7, communal: 6 },
  'The Ghost':      { relational: 9, emotional: 8, communal: 5 },
  'The Atlas':      { physical: 7, vocational: 8, relational: 6 },
  'The Override':   { physical: 9, emotional: 7 },
  'The Chameleon':  { emotional: 9, relational: 6 },
  'The Scanner':    { physical: 6, emotional: 7, communal: 8 },
  'The Hoarder':    { financial: 8, relational: 5 },
  'The Spender':    { financial: 9 },
  'The Nomad':      { communal: 9, relational: 6 },
  'The Wanderer':   { spiritual: 7, communal: 8, educational: 5 },
  'The Refuser':    { spiritual: 8, communal: 6, educational: 7 },
  'The Doubter':    { relational: 8, spiritual: 5 },
  'The Inventor':   { vocational: 6, relational: 5 },
  'The Inheritor':  { spiritual: 7, emotional: 8, communal: 6 },
};

async function startHeritagePrice(userId, familyUnitId, tenantId, confirmedArmors) {
  try {
    // Compute high-cost dimensions from confirmed armors
    const dimensionCosts = {};
    for (const armor of confirmedArmors) {
      const costs = ARMOR_DIMENSION_COSTS[armor] || {};
      for (const [dim, cost] of Object.entries(costs)) {
        dimensionCosts[dim] = (dimensionCosts[dim] || 0) + cost;
      }
    }

    // Sort by cost, take top dimensions
    const highCost = Object.entries(dimensionCosts)
      .sort((a, b) => b[1] - a[1])
      .filter(([, cost]) => cost >= 5)
      .map(([dimension, cost_score]) => {
        // Find which armor drives this dimension's cost the most
        let maxArmor = null;
        let maxCost = 0;
        for (const armor of confirmedArmors) {
          const c = (ARMOR_DIMENSION_COSTS[armor] || {})[dimension] || 0;
          if (c > maxCost) { maxCost = c; maxArmor = armor; }
        }
        return { dimension, armor: maxArmor, cost_score, action: cost_score >= 7 ? 'deprecate' : 'modify' };
      });

    // Build dimension actions
    const actions = {};
    const allDims = ['physical', 'emotional', 'relational', 'financial', 'spiritual', 'vocational', 'educational', 'communal'];
    for (const dim of allDims) {
      const entry = highCost.find(h => h.dimension === dim);
      actions[dim] = entry ? entry.action : 'maintain';
    }

    const result = await pool.query(`
      INSERT INTO heritage_price_sessions (family_unit_id, user_id, tenant_id, high_cost_dimensions, dimension_actions)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [familyUnitId, userId, tenantId, JSON.stringify(highCost), JSON.stringify(actions)]);

    return { id: result.rows[0].id, high_cost_dimensions: highCost, dimension_actions: actions };
  } catch (err) {
    console.error('[DESIGN] Start heritage/price failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function recordGenerationalResponse(sessionId, dimension, role, response) {
  try {
    const session = await pool.query(
      'SELECT generational_responses FROM heritage_price_sessions WHERE id = $1',
      [sessionId]
    );
    if (!session.rows.length) throw new Error('Heritage/Price session not found');

    const responses = session.rows[0].generational_responses || {};
    if (!responses[dimension]) responses[dimension] = {};
    responses[dimension][role] = response;

    await pool.query(
      'UPDATE heritage_price_sessions SET generational_responses = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(responses), sessionId]
    );

    return responses[dimension];
  } catch (err) {
    console.error('[DESIGN] Record generational response failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function completeHeritagePrice(sessionId, tenantId) {
  try {
    await pool.query(
      'UPDATE heritage_price_sessions SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['completed', sessionId]
    );

    const session = await pool.query('SELECT * FROM heritage_price_sessions WHERE id = $1', [sessionId]);
    const data = session.rows[0];

    // Update lineage_profiles heritage_dimensions
    await pool.query(
      'UPDATE lineage_profiles SET heritage_dimensions = $1, updated_at = NOW() WHERE family_unit_id = $2',
      [JSON.stringify(data.dimension_actions), data.family_unit_id]
    );

    // Record on lineage ledger
    const lineageService = require('../services/lineageService');
    await lineageService.recordEntry(data.user_id, data.family_unit_id, tenantId, 'heritage_mapped', {
      high_cost_count: data.high_cost_dimensions.length,
      deprecate_count: Object.values(data.dimension_actions).filter(a => a === 'deprecate').length,
      modify_count: Object.values(data.dimension_actions).filter(a => a === 'modify').length
    });

    return data;
  } catch (err) {
    console.error('[DESIGN] Complete heritage/price failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// MODE 2: SANDBOX — Rehearse
// ═══════════════════════════════════════════════════════════════

async function startSandbox(familyUnitId, blueprintId, scenarioType, targetArmor, targetDimension, title, description, tenantId) {
  try {
    const template = SCENARIO_TEMPLATES[scenarioType];
    if (!template) throw new Error(`Invalid scenario type: ${scenarioType}`);

    const result = await pool.query(`
      INSERT INTO sandbox_sessions
      (family_unit_id, blueprint_id, tenant_id, scenario_type, scenario_title, scenario_description, target_armor, target_dimension, role_assignments)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [
      familyUnitId, blueprintId, tenantId, scenarioType, title, description,
      targetArmor, targetDimension, JSON.stringify(template)
    ]);

    return { id: result.rows[0].id, role_assignments: template };
  } catch (err) {
    console.error('[DESIGN] Start sandbox failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function recordSandboxBiometrics(sandboxId, round, biometrics) {
  // round: 1 or 2 (2 only for contrast scenarios)
  try {
    const session = await pool.query('SELECT scenario_type FROM sandbox_sessions WHERE id = $1', [sandboxId]);
    if (!session.rows.length) throw new Error('Sandbox session not found');

    if (round === 2 && session.rows[0].scenario_type !== 'contrast') {
      throw new Error('Round 2 biometrics only valid for contrast scenarios');
    }

    const column = round === 1 ? 'round_1_biometrics' : 'round_2_biometrics';
    await pool.query(
      `UPDATE sandbox_sessions SET ${column} = $1 WHERE id = $2`,
      [JSON.stringify(biometrics), sandboxId]
    );
  } catch (err) {
    console.error('[DESIGN] Record biometrics failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function completeSandbox(sandboxId, debrief, tenantId) {
  try {
    const session = await pool.query('SELECT * FROM sandbox_sessions WHERE id = $1', [sandboxId]);
    if (!session.rows.length) throw new Error('Sandbox session not found');
    const data = session.rows[0];

    // Compute biometric comparison (for contrast scenarios)
    let comparison = null;
    if (data.round_1_biometrics && data.round_2_biometrics) {
      const r1 = data.round_1_biometrics;
      const r2 = data.round_2_biometrics;
      comparison = {
        ns3_improvement: (r2.ns3_mean || 0) - (r1.ns3_mean || 0),
        coherence_delta: (r2.coherence_peak || 0) - (r1.coherence_peak || 0),
        // Participants see boolean only — never raw NS3 values
        regulation_improved: (r2.ns3_mean || 0) > (r1.ns3_mean || 0)
      };
    }

    await pool.query(`
      UPDATE sandbox_sessions
      SET status = 'completed', family_debrief = $1, biometric_comparison = $2, completed_at = NOW()
      WHERE id = $3
    `, [debrief, comparison ? JSON.stringify(comparison) : null, sandboxId]);

    // Record on lineage ledger
    const lineageService = require('../services/lineageService');
    await lineageService.recordEntry(null, data.family_unit_id, tenantId, 'sandbox_completed', {
      scenario_type: data.scenario_type,
      target_armor: data.target_armor,
      target_dimension: data.target_dimension,
      regulation_improved: comparison?.regulation_improved || null
    });

    return { comparison, scenario_type: data.scenario_type };
  } catch (err) {
    console.error('[DESIGN] Complete sandbox failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function getSandboxHistory(familyUnitId) {
  try {
    const result = await pool.query(
      `SELECT id, scenario_type, scenario_title, target_armor, target_dimension,
              biometric_comparison, status, completed_at, created_at
       FROM sandbox_sessions WHERE family_unit_id = $1
       ORDER BY created_at DESC`,
      [familyUnitId]
    );

    // Strip raw NS3 from biometric_comparison — participants see regulation_improved boolean only
    return result.rows.map(row => {
      if (row.biometric_comparison) {
        row.biometric_comparison = {
          regulation_improved: row.biometric_comparison.regulation_improved
        };
      }
      return row;
    });
  } catch (err) {
    console.error('[DESIGN] Get sandbox history failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Suggest scenarios based on confirmed armors from LACE.
 * Returns matching preset scenarios, filtered by family's confirmed armors.
 */
async function suggestScenarios(familyUnitId) {
  try {
    // Get family's confirmed armors
    const lace = await pool.query(
      `SELECT confirmed_armors FROM lace_assessments
       WHERE family_unit_id = $1 AND status IN ('completed', 'reviewed')
       ORDER BY completed_at DESC LIMIT 1`,
      [familyUnitId]
    );

    const confirmedArmors = lace.rows[0]?.confirmed_armors || [];
    const armorNames = confirmedArmors.map(a => typeof a === 'string' ? a : a.armor || a.name);

    if (armorNames.length === 0) {
      return { scenarios: [], message: 'Complete LACE assessment first to get personalized scenarios' };
    }

    // Get already-completed scenarios to avoid repeats
    const completed = await pool.query(
      `SELECT target_armor, target_dimension, scenario_type FROM sandbox_sessions
       WHERE family_unit_id = $1 AND status = 'completed'`,
      [familyUnitId]
    );
    const completedKeys = new Set(completed.rows.map(r => `${r.target_armor}:${r.target_dimension}:${r.scenario_type}`));

    // Get matching presets
    const presets = await pool.query(
      'SELECT * FROM preset_scenarios WHERE target_armor = ANY($1) ORDER BY scenario_type',
      [armorNames]
    );

    const suggestions = presets.rows
      .filter(p => !completedKeys.has(`${p.target_armor}:${p.target_dimension}:${p.scenario_type}`))
      .slice(0, 5);

    return { scenarios: suggestions, total_available: presets.rows.length };
  } catch (err) {
    console.error('[DESIGN] Suggest scenarios failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// MODE 3: VISION BOARD — Manifest (auto-assembled)
// ═══════════════════════════════════════════════════════════════

async function getVisionBoard(familyUnitId) {
  try {
    // Get completed blueprint
    const blueprint = await pool.query(
      'SELECT * FROM family_blueprints WHERE family_unit_id = $1 AND status = $2 ORDER BY completed_at DESC LIMIT 1',
      [familyUnitId, 'completed']
    );

    if (!blueprint.rows.length) return null;
    const bp = blueprint.rows[0];

    // Get milestones from lineage ledger
    const milestones = await pool.query(
      'SELECT entry_type, entry_data, created_at FROM lineage_entries WHERE family_unit_id = $1 ORDER BY created_at ASC',
      [familyUnitId]
    );

    // Get sandbox history (completed only)
    const sandboxes = await pool.query(
      `SELECT scenario_type, scenario_title, target_armor, target_dimension,
              biometric_comparison, completed_at
       FROM sandbox_sessions WHERE family_unit_id = $1 AND status = $2
       ORDER BY completed_at DESC`,
      [familyUnitId, 'completed']
    );

    // Strip raw biometric values from sandbox history
    const safeSandboxes = sandboxes.rows.map(s => ({
      ...s,
      biometric_comparison: s.biometric_comparison
        ? { regulation_improved: s.biometric_comparison.regulation_improved }
        : null
    }));

    return {
      family_declaration: bp.family_declaration,
      dimension_blueprints: bp.dimension_blueprints,
      milestones: milestones.rows.map(m => ({
        type: m.entry_type,
        data: m.entry_data,
        date: m.created_at
      })),
      sandbox_history: safeSandboxes,
      progress: {
        blueprint_complete: true,
        sandboxes_completed: sandboxes.rows.length,
        milestones_reached: milestones.rows.length
      }
    };
  } catch (err) {
    console.error('[DESIGN] Get vision board failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

module.exports = {
  // Heritage/Price
  startHeritagePrice, recordGenerationalResponse, completeHeritagePrice,
  ARMOR_DIMENSION_COSTS,
  // Blueprint (Mode 1)
  startBlueprint, getBlueprint, getBlueprintPrompts, recordBlueprintVision,
  setFamilyDeclaration, completeBlueprint,
  BLUEPRINT_PROMPTS,
  // Sandbox (Mode 2)
  startSandbox, recordSandboxBiometrics, completeSandbox,
  getSandboxHistory, suggestScenarios,
  SCENARIO_TEMPLATES,
  // Vision Board (Mode 3)
  getVisionBoard
};
