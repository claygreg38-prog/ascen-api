// ============================================================
// [ABI] ratioStepDown.js — Mid-session ratio step-down evaluator
// File: src/abi/ratioStepDown.js
//
// Evaluates whether the current breath ratio exceeds what the
// participant's nervous system can sustain, based on rolling
// biometric windows. Only steps DOWN, never up.
//
// Architecture:
//   - 60-second sustained distress window (prevents false positives)
//   - Maximum 2 step-downs per session
//   - 90-second cooldown between step-downs
//   - 2:3 is the floor — below that, switch modality (somatic reset)
//   - No user notification — pacer adjusts silently
//   - No step-down without biometric data
// ============================================================

'use strict';

/**
 * Step-down ratio ladder (descending difficulty).
 * Only these 5 ratios participate in mid-session step-down.
 */
const STEP_DOWN_LADDER = ['4:7', '4:6', '3:5', '3:4', '2:3'];

const STEP_DOWN_PARAMS = {
  '4:7': { inhale: 4, exhale: 7 },
  '4:6': { inhale: 4, exhale: 6 },
  '3:5': { inhale: 3, exhale: 5 },
  '3:4': { inhale: 3, exhale: 4 },
  '2:3': { inhale: 2, exhale: 3 },
};

/**
 * Configuration constants.
 */
const SUSTAINED_WINDOW_SECONDS = 60;
const READINGS_PER_WINDOW = 30;       // 60s / 2s tick interval
const MAX_STEP_DOWNS = 2;
const COOLDOWN_SECONDS = 90;
const HR_ELEVATION_THRESHOLD = 1.15;   // >15% above arrival
const RMSSD_DROP_THRESHOLD = 0.70;     // <70% of arrival (i.e. dropped >30%)
const COHERENCE_THRESHOLD = 0.3;

/**
 * Compute arithmetic mean of an array of numbers.
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Evaluate whether the current ratio is sustainable given recent biometrics.
 *
 * @param {string} currentRatio - Active breath ratio (e.g. '4:7')
 * @param {Object} arrivalBaseline - { hr, rmssd } from arrival
 * @param {Array} recentBiometrics - Last 60s of tick data (~30 readings)
 *   Each entry: { hr, rmssd, coherence, ts }
 * @returns {Object} Step-down evaluation result
 */
function evaluateRatioSustainability(currentRatio, arrivalBaseline, recentBiometrics) {
  // No step-down without biometric data — never assume distress from absence
  if (!recentBiometrics || recentBiometrics.length === 0) {
    return { step_down: false, current: currentRatio, reason: 'no_biometric_data' };
  }

  // Need at least a full window of readings for sustained evaluation
  if (recentBiometrics.length < READINGS_PER_WINDOW) {
    return { step_down: false, current: currentRatio, reason: 'insufficient_window' };
  }

  // Cannot step down from floor
  if (currentRatio === '2:3') {
    // Check if still distressed at floor — caller uses at_floor to trigger somatic
    const avgHR = mean(recentBiometrics.map(b => b.hr));
    const avgRMSSD = mean(recentBiometrics.map(b => b.rmssd));
    const avgCoh = mean(recentBiometrics.map(b => b.coherence));

    const hrElevated = arrivalBaseline.hr > 0 && avgHR > arrivalBaseline.hr * HR_ELEVATION_THRESHOLD;
    const rmssdDropped = arrivalBaseline.rmssd > 0 && avgRMSSD < arrivalBaseline.rmssd * RMSSD_DROP_THRESHOLD;
    const cohLow = avgCoh < COHERENCE_THRESHOLD;
    const distressed = hrElevated && rmssdDropped && cohLow;

    return {
      step_down: false,
      current: '2:3',
      at_floor: true,
      sustained_distress: distressed,
      evidence: { avgHR, avgRMSSD, avgCoh, arrivalHR: arrivalBaseline.hr, arrivalRMSSD: arrivalBaseline.rmssd, window_seconds: SUSTAINED_WINDOW_SECONDS }
    };
  }

  // Must have valid arrival baselines to compare against
  if (!arrivalBaseline || !arrivalBaseline.hr || arrivalBaseline.hr <= 0) {
    return { step_down: false, current: currentRatio, reason: 'no_arrival_baseline' };
  }

  const avgHR = mean(recentBiometrics.map(b => b.hr));
  const avgRMSSD = mean(recentBiometrics.map(b => b.rmssd));
  const avgCoh = mean(recentBiometrics.map(b => b.coherence));

  // ALL three criteria must be true for sustained distress
  const hrElevated = avgHR > arrivalBaseline.hr * HR_ELEVATION_THRESHOLD;
  const rmssdDropped = arrivalBaseline.rmssd > 0 && avgRMSSD < arrivalBaseline.rmssd * RMSSD_DROP_THRESHOLD;
  const cohLow = avgCoh < COHERENCE_THRESHOLD;

  const distressed = hrElevated && rmssdDropped && cohLow;

  if (!distressed) {
    return { step_down: false, current: currentRatio };
  }

  // Step down one rung on the ladder
  const currentIdx = STEP_DOWN_LADDER.indexOf(currentRatio);
  if (currentIdx === -1) {
    // Current ratio not on the step-down ladder — find the closest lower rung
    // (handles ratios like 4:8, 5:7, etc. that aren't on the ladder)
    return { step_down: false, current: currentRatio, reason: 'ratio_not_on_ladder' };
  }

  const newRatio = STEP_DOWN_LADDER[Math.min(currentIdx + 1, STEP_DOWN_LADDER.length - 1)];
  const params = STEP_DOWN_PARAMS[newRatio];

  return {
    step_down: true,
    previous: currentRatio,
    new_ratio: newRatio,
    inhale_sec: params.inhale,
    exhale_sec: params.exhale,
    reason: 'sustained_distress',
    evidence: {
      avgHR,
      avgRMSSD,
      avgCoh,
      arrivalHR: arrivalBaseline.hr,
      arrivalRMSSD: arrivalBaseline.rmssd,
      window_seconds: SUSTAINED_WINDOW_SECONDS
    }
  };
}

/**
 * Manage biometric buffer for rolling window evaluation.
 * Maintains the last 30 readings (60s at 2s intervals).
 *
 * @param {Array} buffer - Existing biometric buffer
 * @param {Object} reading - { hr, rmssd, coherence, ts }
 * @returns {Array} Updated buffer (capped at READINGS_PER_WINDOW)
 */
function updateBiometricBuffer(buffer, reading) {
  if (!reading || reading.hr == null) return buffer || [];
  const buf = buffer || [];
  buf.push({
    hr: reading.hr,
    rmssd: reading.rmssd,
    coherence: reading.coherence,
    ts: reading.ts || Date.now()
  });
  // Keep only last 30 entries
  while (buf.length > READINGS_PER_WINDOW) {
    buf.shift();
  }
  return buf;
}

/**
 * Check if cooldown period has elapsed since last step-down.
 *
 * @param {number|null} lastStepDownAt - Timestamp of last step-down
 * @returns {boolean} True if cooldown has passed (or no prior step-down)
 */
function cooldownElapsed(lastStepDownAt) {
  if (!lastStepDownAt) return true;
  return (Date.now() - lastStepDownAt) >= (COOLDOWN_SECONDS * 1000);
}

/**
 * Check if maximum step-downs have been reached.
 *
 * @param {number} stepDownCount - Number of step-downs this session
 * @returns {boolean} True if more step-downs are allowed
 */
function canStepDown(stepDownCount) {
  return (stepDownCount || 0) < MAX_STEP_DOWNS;
}

module.exports = {
  evaluateRatioSustainability,
  updateBiometricBuffer,
  cooldownElapsed,
  canStepDown,
  STEP_DOWN_LADDER,
  STEP_DOWN_PARAMS,
  MAX_STEP_DOWNS,
  COOLDOWN_SECONDS,
  SUSTAINED_WINDOW_SECONDS,
  READINGS_PER_WINDOW
};
