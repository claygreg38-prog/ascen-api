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

// CLINICAL FLOOR: 2:3 (inhale:exhale) is the minimum physiological ratio.
// Below this, the breath cycle is too short to produce vagal tone improvement.
// Matches the individual floor in ratioStepDown.js.
const RATIO_FLOOR = 2 / 3; // 2:3 = 0.6667 (inhale/exhale)
const RATIO_FLOOR_INHALE = 2;
const RATIO_FLOOR_EXHALE = 3;

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
  const composite = computeCompositeCadence(cadences, familyUnitId);

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

function computeCompositeCadence(cadences, familyUnitId) {
  let totalWeight = 0;
  let weightedInhale = 0;
  let weightedExhale = 0;
  const durations = [];
  const memberRatios = [];

  for (const cadence of cadences) {
    const weight = cadence.coherence_peak || 0.5; // default weight if no coherence
    const inhale = cadence.inhale_seconds || 4;
    const exhale = cadence.exhale_seconds || 6;

    weightedInhale += inhale * weight;
    weightedExhale += exhale * weight;
    totalWeight += weight;
    durations.push(cadence.duration_seconds || 480);
    memberRatios.push(exhale > 0 ? inhale / exhale : RATIO_FLOOR);
  }

  let compositeInhale = totalWeight > 0 ? weightedInhale / totalWeight : 4;
  let compositeExhale = totalWeight > 0 ? weightedExhale / totalWeight : 6;

  // Track raw values before clamp for logging
  const rawInhale = compositeInhale;
  const rawExhale = compositeExhale;

  // CRITICAL FLOOR CLAMP — Enforce 2:3 minimum ratio
  // Below 2:3, the breath cycle is too short to produce vagal tone improvement.
  // Matches the individual floor in ratioStepDown.js.
  const rawRatio = compositeExhale > 0 ? compositeInhale / compositeExhale : 0;
  if (rawRatio < RATIO_FLOOR || compositeInhale < RATIO_FLOOR_INHALE || compositeExhale < RATIO_FLOOR_EXHALE) {
    compositeInhale = RATIO_FLOOR_INHALE;
    compositeExhale = RATIO_FLOOR_EXHALE;

    // Log floor hit with capacity track member count
    const membersOnCapacityTrack = memberRatios.filter(r => r <= RATIO_FLOOR).length;
    console.log(JSON.stringify({
      type: 'breath_weave_floor_hit',
      family_unit_id: familyUnitId || null,
      raw_composite: `${Math.round(rawInhale * 10) / 10}:${Math.round(rawExhale * 10) / 10}`,
      raw_ratio: Math.round(rawRatio * 10000) / 10000,
      clamped_to: '2:3',
      members_on_capacity_track: membersOnCapacityTrack,
      total_members: cadences.length,
      timestamp: new Date().toISOString()
    }));
  }

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

// ── Ratio conversion helpers ────────────────────────────────
// Used when ratios are stored as strings (e.g., '4:6')

function ratioToDecimal(ratio) {
  const [inhale, exhale] = ratio.split(':').map(Number);
  return exhale > 0 ? inhale / exhale : 0;
}

function decimalToRatio(decimal) {
  const LADDER = [
    { ratio: '4:7', decimal: 4 / 7 },
    { ratio: '4:6', decimal: 4 / 6 },
    { ratio: '3:5', decimal: 3 / 5 },
    { ratio: '3:4', decimal: 3 / 4 },
    { ratio: '2:3', decimal: 2 / 3 },
  ];
  return LADDER.reduce((closest, entry) =>
    Math.abs(entry.decimal - decimal) < Math.abs(closest.decimal - decimal)
      ? entry : closest
  ).ratio;
}

module.exports = {
  createWeave,
  getWeaveHistory,
  computeCompositeCadence, // exported for unit testing
  ratioToDecimal,
  decimalToRatio,
  RATIO_FLOOR
};
