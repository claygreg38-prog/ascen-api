// ============================================================
// [ABI] Heritage/Price Engine
// File: src/abi/heritagePriceEngine.js
//
// Maps confirmed armors to 8 heritage dimensions.
// Heritage = what the armor PROTECTED (strength language).
// Price = what the armor COST (cost language).
// Never "trauma assessment."
//
// 8 HOS Dimensions: Body, Heart, Mind, People, Work, Money/Time, Spirit, Home
// Each dimension has 6 prompts: heritage, price, elder, parent, child, child_elementary
// Breath baselines captured between dimensions (same pattern as LACE).
//
// Arc: LACE → Armor → THIS → System Design → Firmware → Field Testing
// ============================================================

const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ═══════════════════════════════════════════════════════════════
// 8 HOS DIMENSIONS
// Heritage = strength language. Price = cost language. Always.
// ═══════════════════════════════════════════════════════════════

const DIMENSIONS = [
  {
    id: 'body',
    name: 'Body',
    heritage_prompt: 'What did your family\'s bodies learn to do to survive? The tension, the alertness, the way you hold your shoulders — that wasn\'t random. That was intelligence.',
    price_prompt: 'What has that body intelligence cost your family? Where does the tension live now? What can\'t your body do because it\'s still holding on?',
    elder_prompt: 'What did your body learn to carry that your grandchildren shouldn\'t have to?',
    parent_prompt: 'When you look at your children\'s bodies — how they sleep, how they hold tension — what patterns do you recognize from your own childhood?',
    child_prompt: 'Where in your body do you feel it when things get tense at home?',
    child_elementary: 'Draw where your body feels tight or funny when your family is upset.'
  },
  {
    id: 'heart',
    name: 'Heart',
    heritage_prompt: 'What feelings were allowed in your family? Which ones had to be hidden? The rules about emotion — those were survival code.',
    price_prompt: 'What feelings does your family still not know how to hold? What gets shut down before it can be spoken?',
    elder_prompt: 'What feeling have you been holding back your whole life? What happens if you let it out?',
    parent_prompt: 'Which of your parent\'s emotional rules do you catch yourself enforcing — even when you swore you wouldn\'t?',
    child_prompt: 'If everyone in your family could show any feeling without getting in trouble, what would change?',
    child_elementary: 'Draw a face that shows a feeling nobody in your family talks about.'
  },
  {
    id: 'mind',
    name: 'Mind',
    heritage_prompt: 'How did your family make decisions under pressure? The way you think through problems — that pattern was inherited. It kept someone alive.',
    price_prompt: 'What does that inherited thinking cost your family now? Where does anxiety replace planning? Where does vigilance replace curiosity?',
    elder_prompt: 'If the worry stopped, what would you think about instead?',
    parent_prompt: 'When you\'re making a big decision, whose voice do you hear in your head? Is it helping or holding you back?',
    child_prompt: 'When your family has to decide something important, what do you wish would happen?',
    child_elementary: 'Draw what your family looks like when everyone is figuring something out together.'
  },
  {
    id: 'people',
    name: 'People',
    heritage_prompt: 'How does your family decide who to trust? The rules about letting people in or keeping them out — those are ancient code. They kept someone safe.',
    price_prompt: 'What has that code cost your relationships? Who got shut out? What connections never formed because the old rules said "not safe"?',
    elder_prompt: 'Who did you stop letting in? What would it take to open that door again?',
    parent_prompt: 'How do you decide who\'s safe for your children to be around? Where does protection end and isolation begin?',
    child_prompt: 'If you could bring your friends into your family without being embarrassed, what would they see?',
    child_elementary: 'Draw your family with their favorite people. Who comes over? What are they doing?'
  },
  {
    id: 'work',
    name: 'Work',
    heritage_prompt: 'What did your family believe about work and worth? The hustle, the grinding, the inability to rest — that code was written by someone who had no other choice.',
    price_prompt: 'What has that work code cost your family? Where did ambition become compulsion? Where did providing become disappearing?',
    elder_prompt: 'When was the last time you rested without feeling like you were failing?',
    parent_prompt: 'What do your children believe about your relationship with work? Is that what you want them to inherit?',
    child_prompt: 'What do you wish your parent would do instead of working all the time?',
    child_elementary: 'Draw what your family does on the best Saturday — when nobody has to work.'
  },
  {
    id: 'money_time',
    name: 'Money/Time',
    heritage_prompt: 'What did your family learn about holding onto things — money, time, possessions? The scarcity thinking or the spending patterns — those came from somewhere real.',
    price_prompt: 'What has that relationship with resources cost your family? Where does saving become hoarding? Where does generosity become depletion?',
    elder_prompt: 'What did you want to build that you never got to? What if your grandchildren built it?',
    parent_prompt: 'What are you teaching your children about money without saying a word? What do they see you do?',
    child_prompt: 'If your family could save up for one big thing together, what would it be?',
    child_elementary: 'Draw the one thing your family would buy if you could get anything.'
  },
  {
    id: 'spirit',
    name: 'Spirit',
    heritage_prompt: 'What did your family believe about something larger than themselves? The faith, the skepticism, the silence around spiritual things — that was shaped by what happened to your people.',
    price_prompt: 'What has that spiritual code cost your family? Where did faith become performance? Where did doubt become disconnection?',
    elder_prompt: 'What did your people believe before the hard times changed what faith meant?',
    parent_prompt: 'What spiritual practices, if any, do you want your children to have — and which ones do you want them to be free from?',
    child_prompt: 'What do you believe about the world that nobody in your family talks about?',
    child_elementary: 'Draw something that makes you feel like the world is bigger than just your house.'
  },
  {
    id: 'home',
    name: 'Home',
    heritage_prompt: 'What did home mean to the people who came before you? Safety? Temporary? Something you built or something that was taken? The relationship to place was inherited.',
    price_prompt: 'What has that relationship to home cost your family? Where does moving become running? Where does staying become hiding?',
    elder_prompt: 'Where was the last place that felt completely like home? What made it feel that way?',
    parent_prompt: 'When your children think of home, what do you want them to feel? Is that what they feel now?',
    child_prompt: 'If you could make your house feel any way you wanted, what would it feel like?',
    child_elementary: 'Draw your dream home — not what it looks like outside, but what it FEELS like inside.'
  }
];

// Dimension ID → DB column name mapping (for lineage_profiles.heritage_dimensions)
const DIM_TO_DB = {
  body: 'physical', heart: 'emotional', mind: 'educational',
  people: 'relational', work: 'vocational', money_time: 'financial',
  spirit: 'spiritual', home: 'communal'
};

// ═══════════════════════════════════════════════════════════════
// ARMOR → DIMENSION COST MAPPING
// ═══════════════════════════════════════════════════════════════

const ARMOR_DIMENSION_COSTS = {
  'The Sentinel':   { body: 8, heart: 6, home: 7 },
  'The Fortress':   { people: 9, heart: 7, home: 6 },
  'The Ghost':      { people: 9, heart: 8, home: 5 },
  'The Atlas':      { body: 7, work: 8, people: 6 },
  'The Override':   { body: 9, heart: 7 },
  'The Chameleon':  { heart: 9, people: 6 },
  'The Scanner':    { body: 6, mind: 7, home: 8 },
  'The Hoarder':    { money_time: 8, people: 5 },
  'The Spender':    { money_time: 9 },
  'The Nomad':      { home: 9, people: 6 },
  'The Wanderer':   { spirit: 7, home: 8, mind: 5 },
  'The Refuser':    { spirit: 8, home: 6, mind: 7 },
  'The Doubter':    { people: 8, spirit: 5 },
  'The Inventor':   { work: 6, people: 5 },
  'The Inheritor':  { spirit: 7, heart: 8, home: 6 },
};

// ═══════════════════════════════════════════════════════════════
// ENGINE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Start a Heritage/Price session. Requires completed LACE assessment.
 */
async function startSession(userId, familyUnitId, tenantId) {
  try {
    // Check for completed LACE assessment
    const lace = await pool.query(
      `SELECT id, confirmed_armors FROM lace_assessments
       WHERE family_unit_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [familyUnitId]
    );

    if (!lace.rows.length) {
      throw new Error('Completed LACE assessment required before Heritage/Price');
    }

    const laceId = lace.rows[0].id;
    const confirmedArmors = lace.rows[0].confirmed_armors || [];
    const armorNames = confirmedArmors.map(a => typeof a === 'string' ? a : a.armor || a.name);

    // Compute initial high-cost dimensions from confirmed armors
    const dimensionCosts = {};
    for (const armor of armorNames) {
      const costs = ARMOR_DIMENSION_COSTS[armor] || {};
      for (const [dim, cost] of Object.entries(costs)) {
        dimensionCosts[dim] = (dimensionCosts[dim] || 0) + cost;
      }
    }

    const highCost = Object.entries(dimensionCosts)
      .sort((a, b) => b[1] - a[1])
      .filter(([, cost]) => cost >= 5)
      .map(([dimension, cost_score]) => {
        let maxArmor = null, maxCost = 0;
        for (const armor of armorNames) {
          const c = (ARMOR_DIMENSION_COSTS[armor] || {})[dimension] || 0;
          if (c > maxCost) { maxCost = c; maxArmor = armor; }
        }
        return { dimension, armor: maxArmor, cost_score, action: cost_score >= 7 ? 'deprecate' : 'modify' };
      });

    // Build dimension actions
    const actions = {};
    for (const dim of DIMENSIONS) {
      const entry = highCost.find(h => h.dimension === dim.id);
      actions[dim.id] = entry ? entry.action : 'maintain';
    }

    // Build armor_dimension_map — which armor shows up in which dimension
    const armorDimMap = {};
    for (const armor of armorNames) {
      const costs = ARMOR_DIMENSION_COSTS[armor] || {};
      for (const dim of Object.keys(costs)) {
        if (!armorDimMap[dim]) armorDimMap[dim] = [];
        armorDimMap[dim].push({ armor, cost: costs[dim] });
      }
    }

    const result = await pool.query(`
      INSERT INTO heritage_price_sessions
      (family_unit_id, user_id, tenant_id, lace_assessment_id, high_cost_dimensions, dimension_actions, armor_dimension_map)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [familyUnitId, userId, tenantId, laceId,
        JSON.stringify(highCost), JSON.stringify(actions), JSON.stringify(armorDimMap)]);

    return {
      id: result.rows[0].id,
      lace_assessment_id: laceId,
      confirmed_armors: armorNames,
      high_cost_dimensions: highCost,
      dimension_actions: actions,
      armor_dimension_map: armorDimMap
    };
  } catch (err) {
    console.error('[HERITAGE] Start session failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Get prompts for a dimension, age-appropriate and role-appropriate.
 * @param {string} dimensionId - body, heart, mind, people, work, money_time, spirit, home
 * @param {string} role - elder, parent, child
 * @param {string} ageGroup - elementary (<12), teen (12-17), adult (18+)
 */
function getPrompts(dimensionId, role, ageGroup) {
  const dim = DIMENSIONS.find(d => d.id === dimensionId);
  if (!dim) return null;

  const prompts = {
    heritage: dim.heritage_prompt,
    price: dim.price_prompt,
    dimension_name: dim.name
  };

  // Role-appropriate prompt
  if (role === 'elder') {
    prompts.role_prompt = dim.elder_prompt;
  } else if (role === 'parent') {
    prompts.role_prompt = dim.parent_prompt;
  } else if (role === 'child') {
    // Age-appropriate for children
    if (ageGroup === 'elementary') {
      prompts.role_prompt = dim.child_elementary;
      prompts.input_type = 'drawing';
    } else {
      prompts.role_prompt = dim.child_prompt;
      prompts.input_type = 'text';
    }
  }

  return prompts;
}

/**
 * Record a dimension response with heritage text, price text, action, and biometric snapshot.
 */
async function recordDimension(sessionId, dimensionId, data) {
  // data: { heritage_text, price_text, action (keep/modify/deprecate), role, biometric_snapshot }
  try {
    const session = await pool.query(
      'SELECT dimensions, biometric_snapshots FROM heritage_price_sessions WHERE id = $1',
      [sessionId]
    );
    if (!session.rows.length) throw new Error('Heritage/Price session not found');

    const dimensions = session.rows[0].dimensions || {};
    const snapshots = session.rows[0].biometric_snapshots || [];

    dimensions[dimensionId] = {
      ...(dimensions[dimensionId] || {}),
      heritage_text: data.heritage_text,
      price_text: data.price_text,
      action: data.action || 'maintain',
      role: data.role,
      recorded_at: Date.now()
    };

    if (data.biometric_snapshot) {
      snapshots.push({
        dimension: dimensionId,
        ...data.biometric_snapshot,
        timestamp: Date.now()
      });
    }

    await pool.query(
      'UPDATE heritage_price_sessions SET dimensions = $1, biometric_snapshots = $2, updated_at = NOW() WHERE id = $3',
      [JSON.stringify(dimensions), JSON.stringify(snapshots), sessionId]
    );

    return dimensions[dimensionId];
  } catch (err) {
    console.error('[HERITAGE] Record dimension failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Record breath baseline between dimension clusters (same pattern as LACE).
 */
async function recordBreathBaseline(sessionId, afterDimension, baseline) {
  // baseline: { hr, hrv, coherence, ns3, breath_ratio }
  try {
    const session = await pool.query(
      'SELECT breath_baselines FROM heritage_price_sessions WHERE id = $1',
      [sessionId]
    );
    if (!session.rows.length) throw new Error('Session not found');

    const baselines = session.rows[0].breath_baselines || [];
    baselines.push({
      after_dimension: afterDimension,
      ...baseline,
      timestamp: Date.now()
    });

    await pool.query(
      'UPDATE heritage_price_sessions SET breath_baselines = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(baselines), sessionId]
    );
  } catch (err) {
    console.error('[HERITAGE] Record breath baseline failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Record generational response for a dimension.
 */
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
    console.error('[HERITAGE] Record generational response failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Complete Heritage/Price session.
 * Identifies high_cost_dimensions, builds armor_dimension_map,
 * updates lineage_profiles, records heritage_mapped on lineage ledger.
 */
async function completeSession(sessionId, tenantId) {
  try {
    const session = await pool.query('SELECT * FROM heritage_price_sessions WHERE id = $1', [sessionId]);
    if (!session.rows.length) throw new Error('Session not found');
    const data = session.rows[0];

    // Recompute high_cost_dimensions from recorded dimensions + biometrics
    const dims = data.dimensions || {};
    const snapshots = data.biometric_snapshots || [];
    const highCost = [];

    for (const [dimId, dimData] of Object.entries(dims)) {
      if (dimData.action === 'modify' || dimData.action === 'deprecate') {
        // Find biometric activation for this dimension
        const dimSnapshots = snapshots.filter(s => s.dimension === dimId);
        const avgActivation = dimSnapshots.length > 0
          ? dimSnapshots.reduce((sum, s) => sum + (100 - (s.ns3 || 50)), 0) / dimSnapshots.length
          : 0;

        highCost.push({
          dimension: dimId,
          action: dimData.action,
          biometric_activation: Math.round(avgActivation),
          armor: (data.armor_dimension_map?.[dimId] || [])[0]?.armor || null
        });
      }
    }

    // Sort by biometric activation (highest activation = highest cost)
    highCost.sort((a, b) => b.biometric_activation - a.biometric_activation);

    // Build dimension actions from recorded data
    const dimActions = {};
    for (const dim of DIMENSIONS) {
      dimActions[dim.id] = dims[dim.id]?.action || data.dimension_actions?.[dim.id] || 'maintain';
    }

    await pool.query(`
      UPDATE heritage_price_sessions
      SET status = 'completed', high_cost_dimensions = $1, dimension_actions = $2, completed_at = NOW(), updated_at = NOW()
      WHERE id = $3
    `, [JSON.stringify(highCost), JSON.stringify(dimActions), sessionId]);

    // Update lineage_profiles heritage_dimensions + high_cost_dimensions
    const heritageDims = {};
    for (const [dimId, dimData] of Object.entries(dims)) {
      const dbKey = DIM_TO_DB[dimId] || dimId;
      heritageDims[dbKey] = {
        heritage: dimData.heritage_text,
        price: dimData.price_text,
        action: dimData.action
      };
    }

    await pool.query(
      `UPDATE lineage_profiles SET heritage_dimensions = $1, updated_at = NOW() WHERE family_unit_id = $2`,
      [JSON.stringify(heritageDims), data.family_unit_id]
    );

    // Record on lineage ledger
    const lineageService = require('../services/lineageService');
    await lineageService.recordEntry(data.user_id, data.family_unit_id, tenantId, 'heritage_mapped', {
      high_cost_count: highCost.length,
      deprecate_count: highCost.filter(h => h.action === 'deprecate').length,
      modify_count: highCost.filter(h => h.action === 'modify').length,
      dimensions_mapped: Object.keys(dims).length
    });

    return {
      high_cost_dimensions: highCost,
      dimension_actions: dimActions,
      armor_dimension_map: data.armor_dimension_map
    };
  } catch (err) {
    console.error('[HERITAGE] Complete session failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Get transition guidance via Haiku — ONLY for unsupervised families (no facilitator_id).
 * Falls back to static text when API unavailable.
 */
async function getTransitionGuidance(sessionId, dimensionId) {
  try {
    const session = await pool.query(
      'SELECT family_unit_id, dimensions FROM heritage_price_sessions WHERE id = $1',
      [sessionId]
    );
    if (!session.rows.length) return null;

    // Check if family has a facilitator
    const family = await pool.query(
      `SELECT fu.id FROM family_units fu
       JOIN users u ON u.family_unit_id = fu.family_unit_id
       WHERE fu.family_unit_id = $1 AND u.role = 'facilitator'
       LIMIT 1`,
      [session.rows[0].family_unit_id]
    );

    // If family has a facilitator, no AI guidance — facilitator leads
    if (family.rows.length > 0) {
      return null;
    }

    const dim = DIMENSIONS.find(d => d.id === dimensionId);
    if (!dim) return null;

    const dimData = session.rows[0].dimensions?.[dimensionId];

    // Try Haiku for personalized transition
    try {
      const aiRouter = require('../services/aiRouter');
      const prompt = `The family just explored the "${dim.name}" dimension of their heritage. They identified the strength: "${dimData?.heritage_text || 'not yet shared'}". They identified the cost: "${dimData?.price_text || 'not yet shared'}". They chose to ${dimData?.action || 'maintain'} this pattern. Write one sentence (under 30 words) acknowledging what they just shared, using HOS language (system code, firmware, not clinical terms). Warm but grounded.`;

      const result = await aiRouter.generate({
        task: 'heritage_transition',
        prompt,
        maxTokens: 60,
        temperature: 0.6
      });

      if (result?.text) return { guidance: result.text, source: 'haiku' };
    } catch (e) {
      // Haiku unavailable — fall through to static
    }

    // Static fallback
    const staticGuidance = {
      body: 'Your body carried this code for a reason. Now you get to choose what stays.',
      heart: 'Those feelings were survival intelligence. Naming them is the first firmware update.',
      mind: 'The way your family thinks was built under pressure. You\'re designing a new operating system.',
      people: 'The rules about trust were written by someone who got hurt. You\'re writing the update.',
      work: 'That work ethic kept someone alive. Now you get to define what productivity means on your terms.',
      money_time: 'The relationship with resources was learned in scarcity. You\'re coding for abundance.',
      spirit: 'Whatever your people believed, it was shaped by what happened to them. You get to choose what stays.',
      home: 'The idea of home was shaped by who got to keep one. You\'re building something permanent.'
    };

    return { guidance: staticGuidance[dimensionId] || 'You\'re mapping the code. That\'s the first step.', source: 'static' };
  } catch (err) {
    console.error('[HERITAGE] Transition guidance failed:', err.message);
    Sentry.captureException(err);
    return { guidance: 'You\'re mapping the code. That\'s the first step.', source: 'static' };
  }
}

/**
 * Family-map: aggregates heritage/price data across all family members.
 */
async function getFamilyMap(familyUnitId) {
  try {
    const sessions = await pool.query(
      `SELECT hp.*, u.first_name, u.id
       FROM heritage_price_sessions hp
       JOIN users u ON hp.user_id = u.id
       WHERE hp.family_unit_id = $1 AND hp.status = 'completed'
       ORDER BY hp.completed_at DESC`,
      [familyUnitId]
    );

    if (!sessions.rows.length) return null;

    // Aggregate across members
    const dimensionMap = {};
    for (const dim of DIMENSIONS) {
      dimensionMap[dim.id] = {
        name: dim.name,
        actions: [],
        members: []
      };
    }

    for (const session of sessions.rows) {
      const dims = session.dimensions || {};
      const actions = session.dimension_actions || {};

      for (const dim of DIMENSIONS) {
        if (actions[dim.id] && actions[dim.id] !== 'maintain') {
          dimensionMap[dim.id].actions.push(actions[dim.id]);
        }
        if (dims[dim.id]) {
          dimensionMap[dim.id].members.push({
            name: session.first_name,
            heritage: dims[dim.id].heritage_text,
            price: dims[dim.id].price_text,
            action: dims[dim.id].action
          });
        }
      }
    }

    // Compute consensus action per dimension
    for (const dim of DIMENSIONS) {
      const acts = dimensionMap[dim.id].actions;
      if (acts.length === 0) {
        dimensionMap[dim.id].consensus = 'maintain';
      } else {
        const deprecateCount = acts.filter(a => a === 'deprecate').length;
        dimensionMap[dim.id].consensus = deprecateCount > acts.length / 2 ? 'deprecate' : 'modify';
      }
    }

    // Get armor_dimension_map from most recent session
    const latestMap = sessions.rows[0].armor_dimension_map || {};

    return {
      family_unit_id: familyUnitId,
      dimensions: dimensionMap,
      armor_dimension_map: latestMap,
      members_completed: sessions.rows.length
    };
  } catch (err) {
    console.error('[HERITAGE] Get family map failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Get current session for a family.
 */
async function getSession(familyUnitId) {
  try {
    const result = await pool.query(
      'SELECT * FROM heritage_price_sessions WHERE family_unit_id = $1 ORDER BY created_at DESC LIMIT 1',
      [familyUnitId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('[HERITAGE] Get session failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

module.exports = {
  DIMENSIONS, ARMOR_DIMENSION_COSTS, DIM_TO_DB,
  startSession, getSession, getPrompts,
  recordDimension, recordBreathBaseline, recordGenerationalResponse,
  completeSession, getTransitionGuidance, getFamilyMap
};
