// ============================================================
// [ABI] SessionDataPacket Builder
// File: src/abi/buildSessionDataPacket.js
//
// Assembles a canonical data packet from the 14 ABI systems
// at session completion, hashes it (SHA-256), and returns both
// the packet and hash for storage + future on-chain attestation.
//
// The hash format is LOCKED once real sessions start generating
// data. Changing the schema later makes old hashes incompatible.
//
// Called by onSessionComplete() — NOT a parallel flow.
// ============================================================

const crypto = require('crypto');

/**
 * Builds a canonical SessionDataPacket from data already computed
 * by the 14 ABI systems during session lifecycle.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.sessionId
 * @param {number} params.sessionNumber
 * @param {string} params.track - breath_track at completion
 * @param {string} params.arc - resolved arc (body, awareness, etc.)
 * @param {string} params.mode - breathwork mode (simple_pacer, etc.)
 * @param {Object} params.arrivalBaseline - {resting_hr, resting_hrv, respiratory_rate}
 * @param {Object} params.cleanMetrics - pause-adjusted metrics
 * @param {Object} params.rawMetrics - raw biometric metrics
 * @param {Object} params.stateSummary - from StateEngine.getSessionSummary()
 * @param {Object} params.coachingSummary - from CoachingEngine.getCoachingSummary()
 * @param {Object} params.immuneScan - from ImmuneSystem.postSessionScan()
 * @param {string} params.biometricSource - polar_h10 | rppg_camera | none
 * @param {number} params.coherenceEnd - end-of-session coherence
 * @returns {Object} { packet, packetHash, coherenceTrajectory, zoneTimeProfile }
 */
function buildSessionDataPacket(params) {
  const {
    userId,
    sessionId,
    sessionNumber,
    track,
    arc,
    mode,
    arrivalBaseline,
    cleanMetrics,
    rawMetrics,
    stateSummary,
    coachingSummary,
    immuneScan,
    biometricSource,
    coherenceEnd
  } = params;

  // ── ARRIVAL BIOMETRICS ──────────────────────────────────
  const arrivalHr = arrivalBaseline?.resting_hr || null;
  const arrivalHrv = arrivalBaseline?.resting_hrv || null;

  // ── COHERENCE TRAJECTORY ────────────────────────────────
  // Compare arrival coherence baseline to end-of-session coherence
  const coherencePeak = rawMetrics?.coherence_peak || 0;
  const coherenceTrajectory = deriveCoherenceTrajectory(
    coherencePeak, coherenceEnd, cleanMetrics
  );

  // ── ZONE TIME PROFILE ──────────────────────────────────
  // Extract time-in-zone from state engine history
  const zoneTimeProfile = deriveZoneTimeProfile(stateSummary);

  // ── TIME TO REGULATION ─────────────────────────────────
  // First transition to REGULATED state (seconds from session start)
  const timeToRegulationSec = deriveTimeToRegulation(stateSummary);

  // ── CANONICAL PACKET ───────────────────────────────────
  // Field order is LOCKED. Do not reorder or rename fields.
  // Adding new fields at the end is safe. Removing or
  // reordering fields breaks hash compatibility.
  const packet = {
    version: 1,
    userId,
    sessionId,
    sessionNumber: sessionNumber || 0,
    track: track || 'standard',
    arc: arc || null,
    mode: mode || 'simple_pacer',
    completedAt: new Date().toISOString(),

    // Arrival biometrics (pre-session state)
    arrival: {
      hr: arrivalHr,
      hrv: arrivalHrv
    },

    // Session biometrics (post-session state)
    // NOTE: RR intervals stay on-device only. Hash on-chain.
    biometrics: {
      coherence_peak: coherencePeak,
      coherence_end: coherenceEnd || 0,
      cycle_completion_rate: cleanMetrics?.adjusted_cycle_completion_rate
        || rawMetrics?.cycle_completion_rate || 0,
      active_duration_seconds: cleanMetrics?.active_duration_seconds
        || rawMetrics?.total_duration_seconds || 0,
      total_pauses: cleanMetrics?.total_pauses || 0,
      panic_event: rawMetrics?.panic_event || false,
      exit_type: cleanMetrics?.exit_type || 'normal',
      biometric_source: biometricSource || 'none'
    },

    // Regulation metrics
    regulation: {
      time_to_regulation_sec: timeToRegulationSec,
      coherence_trajectory: coherenceTrajectory,
      zone_time_profile: zoneTimeProfile
    },

    // Session intelligence flags (non-clinical, attestation-safe)
    flags: {
      state_transitions: stateSummary?.state_transitions || 0,
      dominant_state: stateSummary?.dominant_state || 'unknown',
      coaching_interventions: coachingSummary?.total_interventions || 0,
      immune_flags_count: immuneScan?.flags?.length || 0
    }
  };

  // ── SHA-256 HASH ───────────────────────────────────────
  // Deterministic: JSON.stringify with sorted keys
  const canonicalJson = JSON.stringify(packet, Object.keys(packet).sort());
  const packetHash = crypto
    .createHash('sha256')
    .update(canonicalJson)
    .digest('hex');

  return {
    packet,
    packetHash,
    // Enrichment columns for session_completions
    timeToRegulationSec,
    arrivalHr,
    arrivalHrv,
    coherenceTrajectory,
    zoneTimeProfile
  };
}

/**
 * Derive coherence trajectory from session data.
 * Returns: 'improving' | 'stable' | 'declining'
 */
function deriveCoherenceTrajectory(coherencePeak, coherenceEnd, cleanMetrics) {
  if (!coherencePeak && !coherenceEnd) return 'stable';

  const start = coherencePeak * 0.5; // rough proxy: peak/2 as early-session estimate
  const end = coherenceEnd || 0;
  const delta = end - start;

  if (delta > 0.1) return 'improving';
  if (delta < -0.1) return 'declining';
  return 'stable';
}

/**
 * Extract zone time profile from state engine summary.
 * Returns JSONB-ready object: { regulated: N, flow: N, ... }
 */
function deriveZoneTimeProfile(stateSummary) {
  if (!stateSummary?.state_distribution) return {};

  // state_distribution counts state transitions, not seconds.
  // Each tick ≈ 1 second, so counts approximate seconds-in-zone.
  return { ...stateSummary.state_distribution };
}

/**
 * Derive time-to-regulation from state history.
 * Returns seconds until first REGULATED state, or null if never reached.
 */
function deriveTimeToRegulation(stateSummary) {
  if (!stateSummary) return null;

  // If dominant state is regulated and few transitions, likely regulated quickly
  if (stateSummary.dominant_state === 'regulated' && stateSummary.state_transitions <= 1) {
    // Regulated from baseline — TTR is effectively 0
    return 0;
  }

  // total_ticks is the session length in ticks (~seconds)
  // time_in_activation approximates ticks before regulation
  const activationTicks = stateSummary.time_in_activation || 0;

  if (activationTicks === 0 && stateSummary.total_ticks > 0) {
    return 0; // Never activated — regulated throughout
  }

  // Best approximation: activation ticks occurred before regulation
  // This is a heuristic — enhancement spec can add precise tracking later
  return activationTicks > 0 ? activationTicks : null;
}

/**
 * Queue a session attestation for facilitator review.
 * Inserts into attestation_queue with status 'awaiting_facilitator'.
 *
 * @param {Object} pool - pg Pool instance
 * @param {Object} params
 * @param {number} params.sessionCompletionId - session_completions.id
 * @param {string} params.userId
 * @param {string} params.packetHash - SHA-256 hash from buildSessionDataPacket
 */
async function queueAttestation(pool, { sessionCompletionId, userId, packetHash }) {
  await pool.query(
    `INSERT INTO attestation_queue (session_completion_id, user_id, packet_hash, status)
     VALUES ($1, $2, $3, 'awaiting_facilitator')`,
    [sessionCompletionId || null, userId, packetHash]
  );
}

module.exports = { buildSessionDataPacket, queueAttestation };
