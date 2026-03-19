// ============================================================
// [ABI] Family Breath Weave — Composite family breathing patterns
// File: src/abi/familyBreathWeave.js
//
// Combines multiple family members' best sessions into a single
// "Family Breath" pattern. Weighted average by coherence_peak.
// CRITICAL: Composite ratio NEVER below 2:3 clinical floor.
// Flows through ABI orchestrator.
// ============================================================

const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── createWeave ─────────────────────────────────────────────

async function createWeave(familyUnitId, contributingCapsuleIds) {
  if (!contributingCapsuleIds || contributingCapsuleIds.length < 2) {
    throw new Error('At least 2 capsules required for a family weave');
  }

  // Verify family unit exists
  const familyCheck = await pool.query(
    `SELECT family_unit_id FROM family_units WHERE family_unit_id = $1`,
    [familyUnitId]
  );
  if (familyCheck.rows.length === 0) {
    throw new Error('Family unit not found');
  }

  // Fetch breath_cadence from each contributing capsule
  const cadences = [];
  for (const capsuleId of contributingCapsuleIds) {
    const result = await pool.query(
      `SELECT breath_cadence FROM legacy_capsules WHERE id = $1`,
      [capsuleId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Capsule ${capsuleId} not found`);
    }
    const cadence = typeof result.rows[0].breath_cadence === 'string'
      ? JSON.parse(result.rows[0].breath_cadence)
      : result.rows[0].breath_cadence;
    cadences.push(cadence);
  }

  // Compute weighted average (weight = coherence_peak score)
  const composite = computeCompositeCadence(cadences);

  // Store weave
  const result = await pool.query(
    `INSERT INTO family_breath_weaves (family_unit_id, contributing_capsule_ids, composite_cadence)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [familyUnitId, contributingCapsuleIds, JSON.stringify(composite)]
  );

  return {
    weaveId: result.rows[0].id,
    compositeCadence: composite
  };
}

// ── computeCompositeCadence ─────────────────────────────────
// Exported for unit testing

function computeCompositeCadence(cadences) {
  let totalWeight = 0;
  let weightedInhale = 0;
  let weightedExhale = 0;
  const durations = [];

  for (const cadence of cadences) {
    const weight = cadence.coherence_peak || 0.5; // default weight if no coherence
    const inhale = cadence.inhale_seconds || 4;
    const exhale = cadence.exhale_seconds || 6;

    weightedInhale += inhale * weight;
    weightedExhale += exhale * weight;
    totalWeight += weight;
    durations.push(cadence.duration_seconds || 480);
  }

  let compositeInhale = totalWeight > 0 ? weightedInhale / totalWeight : 4;
  let compositeExhale = totalWeight > 0 ? weightedExhale / totalWeight : 6;

  // CRITICAL FLOOR CLAMP — Enforce 2:3 minimum ratio (matches determineBreathParams.js)
  const compositeRatio = compositeExhale / (compositeInhale + compositeExhale);
  if (compositeRatio < 3 / 5) { // 2:3 = inhale:exhale, exhale portion = 3/5
    compositeInhale = 2;
    compositeExhale = 3;
  }

  // Also enforce minimum absolute values
  compositeInhale = Math.max(compositeInhale, 2);
  compositeExhale = Math.max(compositeExhale, 3);

  // Compute composite duration (median)
  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const compositeDuration = durations.length % 2 === 0
    ? Math.round((durations[mid - 1] + durations[mid]) / 2)
    : durations[mid];

  // Round to 1 decimal for clean display
  compositeInhale = Math.round(compositeInhale * 10) / 10;
  compositeExhale = Math.round(compositeExhale * 10) / 10;

  const cycleLength = compositeInhale + compositeExhale;
  const bpm = cycleLength > 0 ? Math.round(60 / cycleLength) : 6;

  return {
    ratio: `${compositeInhale}:${compositeExhale}`,
    bpm,
    duration_seconds: compositeDuration,
    inhale_seconds: compositeInhale,
    exhale_seconds: compositeExhale,
    contributors: cadences.length
  };
}

// ── getWeaveHistory ─────────────────────────────────────────

async function getWeaveHistory(familyUnitId) {
  const result = await pool.query(
    `SELECT id, contributing_capsule_ids, composite_cadence,
            composite_art_ipfs_hash, composite_token_id, created_at
     FROM family_breath_weaves
     WHERE family_unit_id = $1
     ORDER BY created_at DESC`,
    [familyUnitId]
  );

  return result.rows;
}

module.exports = {
  createWeave,
  getWeaveHistory,
  computeCompositeCadence // exported for unit testing
};
