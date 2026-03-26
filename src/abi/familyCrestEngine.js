// ============================================================
// [ABI] Family Crest Engine — Living System Document
// File: src/abi/familyCrestEngine.js
//
// The Crest exists from day one. It versions up based on
// behavioral evidence, not session attendance.
//
// Version evaluation is AXIS math — criteria-based, no AI.
// Ceremony narration uses Haiku (AI_007 from token optimization).
//
// Architecture:
//   - v1.0 auto-generated after LACE completion
//   - v1.5 on first Legacy Code Deprecation
//   - v2.0 requires 3 types of real-world evidence
//   - v2.5 can happen at ANY major version (new member joins)
//   - v3.0 requires biometric improvement over 30+ days
//   - Crest never shrinks. Only adds.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const VERSION_CRITERIA = {
  '1.0': { trigger: 'lace_completed', auto: true },
  '1.5': { trigger: 'first_deprecation', requires: ['one_deprecation'] },
  '2.0': {
    trigger: 'demonstration',
    requires_all: ['behavioral_change', 'family_project', 'courage_demonstrated'],
    minimum_evidence: 3
  },
  '2.5': { trigger: 'member_joined', can_happen_anytime: true },
  '3.0': {
    trigger: 'pattern_break',
    requires_all: ['biometric_improvement', 'heritage_costs_decreasing'],
    minimum_days: 30
  }
};

const VERSION_NAMES = {
  '1.0': 'The Inventory',
  '1.5': 'The First Release',
  '2.0': 'The Demonstration',
  '2.5': 'The Expansion',
  '3.0': 'The Pattern Break'
};

const ARMOR_STRENGTHS = {
  'The Sentinel': 'Protective instinct. Sees danger before it arrives.',
  'The Fortress': 'Unbreakable endurance. Community building under impossible conditions.',
  'The Ghost': 'Street intelligence. Reading power dynamics instantly.',
  'The Atlas': 'Reliability. The family always has someone to lean on.',
  'The Override': 'Pain tolerance. Functioning when others would stop.',
  'The Chameleon': 'Adaptability. Surviving systems designed to destroy you.',
  'The Scanner': 'Awareness. Nothing gets past unnoticed.',
  'The Hoarder': 'Resourcefulness. Making something from nothing.',
  'The Spender': 'Generosity. Sharing what little exists.',
  'The Nomad': 'Mobility. Can build something from nothing, anywhere.',
  'The Wanderer': 'Independence. Not trapped by attachment.',
  'The Refuser': 'Self-protection. Setting boundaries, even if unconsciously.',
  'The Doubter': 'Critical thinking. Not easily deceived.',
  'The Inventor': 'Creativity. Building new systems when old ones fail.',
  'The Inheritor': 'Legacy awareness. Carrying forward what matters.'
};

function getArmorStrength(armorName) {
  return ARMOR_STRENGTHS[armorName] || 'Strength unnamed — the family will discover it.';
}

// ═══════════════════════════════════════════════════════════════
// CREATE CREST — v1.0 after LACE completion
// ═══════════════════════════════════════════════════════════════

async function createCrest(familyUnitId, laceData, tenantId) {
  const crest = await pool.query(`
    INSERT INTO family_crests (family_unit_id, tenant_id, current_version,
      inheritance, keepers, family_name, first_session_date, participating_members, version_history)
    VALUES ($1, $2, '1.0', $3, $4, $5, NOW(), $6, $7)
    ON CONFLICT (family_unit_id) DO UPDATE SET
      inheritance = $3, keepers = $4, updated_at = NOW()
    RETURNING id
  `, [
    familyUnitId, tenantId,
    JSON.stringify({
      domains: laceData.domains_activated,
      armors: laceData.confirmed_armors,
      carriers: laceData.carriers || []
    }),
    JSON.stringify({
      strengths: (laceData.confirmed_armors || []).map(a => ({
        armor: a,
        strength: getArmorStrength(a)
      }))
    }),
    laceData.family_name || 'Family',
    JSON.stringify(laceData.participating_members || []),
    JSON.stringify([{ version: '1.0', triggered_at: new Date().toISOString(), trigger_type: 'lace_completed' }])
  ]);

  // Record on lineage ledger
  try {
    const lineageService = require('../services/lineageService');
    await lineageService.recordEntry(null, familyUnitId, tenantId, 'crest_versioned', {
      version: '1.0', name: 'The Inventory'
    });
  } catch (err) {
    console.error('[CREST] Lineage entry failed (non-blocking):', err.message);
    Sentry.captureException(err);
  }

  return crest.rows[0].id;
}

// ═══════════════════════════════════════════════════════════════
// SUBMIT EVIDENCE toward a version upgrade
// ═══════════════════════════════════════════════════════════════

async function submitEvidence(crestId, versionTarget, triggerType, evidenceData, submittedBy) {
  await pool.query(`
    INSERT INTO crest_version_evidence (crest_id, version_target, trigger_type, evidence_data, submitted_by)
    VALUES ($1, $2, $3, $4, $5)
  `, [crestId, versionTarget, triggerType, JSON.stringify(evidenceData), submittedBy]);

  // Check if version upgrade criteria met
  return await evaluateVersion(crestId, versionTarget);
}

// ═══════════════════════════════════════════════════════════════
// EVALUATE VERSION — AXIS math, no AI
// ═══════════════════════════════════════════════════════════════

async function evaluateVersion(crestId, targetVersion) {
  const criteria = VERSION_CRITERIA[targetVersion];
  if (!criteria) return { eligible: false, reason: 'Unknown version' };

  const evidence = await pool.query(
    'SELECT trigger_type, evidence_data, facilitator_confirmed FROM crest_version_evidence WHERE crest_id = $1 AND version_target = $2',
    [crestId, targetVersion]
  );

  const evidenceTypes = evidence.rows.map(e => e.trigger_type);

  if (criteria.requires_all) {
    const met = criteria.requires_all.filter(r => evidenceTypes.includes(r));
    const missing = criteria.requires_all.filter(r => !evidenceTypes.includes(r));

    return {
      eligible: missing.length === 0,
      met,
      missing,
      evidence_count: evidence.rows.length,
      minimum_required: criteria.minimum_evidence || criteria.requires_all.length
    };
  }

  if (criteria.requires) {
    const met = criteria.requires.filter(r => {
      if (r === 'one_deprecation') return evidenceTypes.includes('first_deprecation');
      return evidenceTypes.includes(r);
    });
    return { eligible: met.length >= criteria.requires.length, met };
  }

  return { eligible: evidence.rows.length > 0 };
}

// ═══════════════════════════════════════════════════════════════
// UPGRADE VERSION
// ═══════════════════════════════════════════════════════════════

async function upgradeVersion(crestId, newVersion, upgradeData) {
  const crest = await pool.query('SELECT * FROM family_crests WHERE id = $1', [crestId]);
  if (!crest.rows.length) throw new Error('Crest not found');
  const current = crest.rows[0];

  const history = current.version_history || [];
  history.push({
    version: newVersion,
    triggered_at: new Date().toISOString(),
    trigger_type: upgradeData.trigger_type,
    evidence_summary: upgradeData.evidence_summary
  });

  // Build update object based on version
  const updates = { current_version: newVersion, version_history: JSON.stringify(history) };

  if (newVersion === '1.5' && upgradeData.deprecated_pattern) {
    const release = current.release || {};
    if (!release.patterns) release.patterns = [];
    release.patterns.push(upgradeData.deprecated_pattern);
    updates.release = JSON.stringify(release);
  }

  if (newVersion === '2.0') {
    const release = current.release || {};
    release.evidence = upgradeData.evidence;
    updates.release = JSON.stringify(release);

    const promise = current.promise || {};
    promise.blueprint_visions = upgradeData.blueprint_visions;
    updates.promise = JSON.stringify(promise);
  }

  if (newVersion === '2.5' && upgradeData.new_member) {
    const members = current.participating_members || [];
    members.push(upgradeData.new_member);
    updates.participating_members = JSON.stringify(members);

    // Remove from absent if they were listed
    const absent = (current.absent_members || []).filter(m => m.name !== upgradeData.new_member.name);
    updates.absent_members = JSON.stringify(absent);
  }

  // Dynamic SQL construction — keys come from the internal `updates` object built
  // above, NOT from user input. All keys are string literals defined in this function.
  // Values are parameterized. Safe by design.
  const setClauses = Object.entries(updates)
    .map(([key], i) => `${key} = $${i + 2}`)
    .join(', ');
  const values = Object.values(updates);

  await pool.query(
    `UPDATE family_crests SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
    [crestId, ...values]
  );

  // Record on lineage ledger
  try {
    const lineageService = require('../services/lineageService');
    await lineageService.recordEntry(null, current.family_unit_id, current.tenant_id, 'crest_versioned', {
      version: newVersion, name: VERSION_NAMES[newVersion] || `System Build ${newVersion}`
    });
  } catch (err) {
    console.error('[CREST] Lineage entry failed (non-blocking):', err.message);
    Sentry.captureException(err);
  }

  return { version: newVersion, upgraded: true };
}

// ═══════════════════════════════════════════════════════════════
// GET CREST — by family_unit_id (primary lookup)
// ═══════════════════════════════════════════════════════════════

async function getCrest(familyUnitId) {
  const crest = await pool.query(
    'SELECT * FROM family_crests WHERE family_unit_id = $1',
    [familyUnitId]
  );
  if (!crest.rows.length) return null;

  return formatCrest(crest.rows[0]);
}

// ═══════════════════════════════════════════════════════════════
// GET CREST BY ID — for ceremony narration (Review Fix #2)
// generateCeremonyNarration receives crestId, not familyUnitId
// ═══════════════════════════════════════════════════════════════

async function getCrestById(crestId) {
  const crest = await pool.query(
    'SELECT * FROM family_crests WHERE id = $1',
    [crestId]
  );
  if (!crest.rows.length) return null;

  return formatCrest(crest.rows[0]);
}

/**
 * Format a raw crest row into the display object.
 */
async function formatCrest(c) {
  // Get next version(s) — v2.5 evaluated in parallel (Review Fix #3)
  const nextVersions = getNextVersions(c.current_version);
  let nextVersionProgress = null;

  if (nextVersions.length > 0) {
    // Evaluate all candidate versions in parallel
    const evaluations = await Promise.all(
      nextVersions.map(async (v) => ({
        target: v,
        progress: await evaluateVersion(c.id, v)
      }))
    );
    // Return all, so the frontend/caller can see v2.5 availability at any time
    nextVersionProgress = evaluations;
  }

  return {
    id: c.id,
    family_unit_id: c.family_unit_id,
    family_name: c.family_name,
    family_code_name: c.family_code_name,
    current_version: c.current_version,
    version_name: VERSION_NAMES[c.current_version],
    quadrants: {
      inheritance: c.inheritance,
      release: c.release,
      keepers: c.keepers,
      promise: c.promise
    },
    participating_members: c.participating_members,
    absent_members: c.absent_members,
    version_history: c.version_history,
    first_session_date: c.first_session_date,
    next_versions: nextVersionProgress,
    ceremony_count: c.ceremony_count
  };
}

// ═══════════════════════════════════════════════════════════════
// GET NEXT VERSIONS — v2.5 can happen at ANY major version
// (Review Fix #3: evaluate in parallel, not sequentially)
// ═══════════════════════════════════════════════════════════════

function getNextVersions(current) {
  const sequential = ['1.0', '1.5', '2.0', '3.0'];
  const idx = sequential.indexOf(current);

  const candidates = [];

  // Next sequential version (if not at 3.0)
  if (idx >= 0 && idx < sequential.length - 1) {
    candidates.push(sequential[idx + 1]);
  }

  // v2.5 can happen at any major version — check it in parallel
  // regardless of current version (as long as we're not already past it
  // and it hasn't already been achieved)
  if (current !== '2.5' && current !== '3.0') {
    candidates.push('2.5');
  }

  return candidates;
}

// ═══════════════════════════════════════════════════════════════
// CEREMONY NARRATION — Haiku (AI_007)
// ═══════════════════════════════════════════════════════════════

async function generateCeremonyNarration(crestId, tenantId) {
  // Review Fix #2: getCrestById since we have crestId, not familyUnitId
  const crest = await getCrestById(crestId);
  if (!crest) return { narration: 'The facilitator reads each quadrant aloud to the family.' };

  try {
    const aiRouter = require('../services/aiRouter');

    const prompt = `Narrate this family's System Build ceremony. Four quadrants.
Inheritance: ${JSON.stringify(crest.quadrants.inheritance)}.
Release: ${JSON.stringify(crest.quadrants.release)}.
Keepers: ${JSON.stringify(crest.quadrants.keepers)}.
Promise: ${JSON.stringify(crest.quadrants.promise)}.
Family name: ${crest.family_name}. System Build: ${crest.current_version}.
One warm paragraph per quadrant. Use the family members' actual names.
Warrior-framed. No clinical language.`;

    const result = await aiRouter.route('crest_ceremony', prompt, {
      systemPrompt: 'You are a warm, warrior-framed narrator for a family healing ceremony. Use HOS vocabulary only. No clinical terms.',
      maxTokens: 800,
      temperature: 0.7,
      tenantId
    });

    if (result && result.content) {
      return { narration: result.content, model: result.model };
    }
  } catch (err) {
    console.error('[CREST] Ceremony narration failed (using fallback):', err.message);
    Sentry.captureException(err);
  }

  // Fallback: facilitator reads
  return { narration: 'The facilitator reads each quadrant aloud to the family.' };
}

module.exports = {
  createCrest,
  submitEvidence,
  evaluateVersion,
  upgradeVersion,
  getCrest,
  getCrestById,
  getNextVersions,
  generateCeremonyNarration,
  VERSION_CRITERIA,
  VERSION_NAMES
};
