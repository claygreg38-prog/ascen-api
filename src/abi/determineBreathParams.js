// ============================================================
// [ABI] determineBreathParams.js — Arrival-based ratio selection
// File: src/abi/determineBreathParams.js
//
// Reads 30-second arrival baseline from BaselineFilter and maps
// natural breathing rate to the closest safe ratio within the
// session's ratio_range and duration_range.
//
// Works for both FR and Foundation sessions. The YAML provides
// guardrails (ratio_range, duration_range). ABI decides.
//
// Clinical Rule #1: The system NEVER asks users about their
// breathing capacity. Silent biometric detection only.
// ============================================================

/**
 * Standard ratio library — inhale:exhale pairs sorted by difficulty.
 * Lower total cycle = easier. Higher exhale proportion = more calming.
 */
const RATIO_LIBRARY = [
  { ratio: '2:3', inhale: 2, exhale: 3, total: 5, difficulty: 1 },
  { ratio: '2:4', inhale: 2, exhale: 4, total: 6, difficulty: 2 },
  { ratio: '3:4', inhale: 3, exhale: 4, total: 7, difficulty: 3 },
  { ratio: '3:5', inhale: 3, exhale: 5, total: 8, difficulty: 4 },
  { ratio: '3:6', inhale: 3, exhale: 6, total: 9, difficulty: 5 },
  { ratio: '4:6', inhale: 4, exhale: 6, total: 10, difficulty: 6 },
  { ratio: '4:7', inhale: 4, exhale: 7, total: 11, difficulty: 7 },
  { ratio: '4:8', inhale: 4, exhale: 8, total: 12, difficulty: 8 },
  { ratio: '5:7', inhale: 5, exhale: 7, total: 12, difficulty: 9 },
  { ratio: '5:8', inhale: 5, exhale: 8, total: 13, difficulty: 10 },
  { ratio: '6:8', inhale: 6, exhale: 8, total: 14, difficulty: 11 },
  { ratio: '6:10', inhale: 6, exhale: 10, total: 16, difficulty: 12 }
];

/**
 * Determine breath parameters from arrival baseline and session config.
 *
 * @param {Object} baseline - Filtered arrival baseline
 * @param {number} baseline.resting_hr - Resting heart rate (bpm)
 * @param {number} baseline.resting_hrv - Resting HRV (ms)
 * @param {number} baseline.respiratory_rate - Breaths per minute
 * @param {Object} sessionConfig - From YAML or adapter
 * @param {string} sessionConfig.ratio_range - e.g. "2:3 → 4:7" (floor → ceiling)
 * @param {string} sessionConfig.duration_range - e.g. "120-240" (seconds)
 * @param {string} [sessionConfig.ratio] - Hardcoded ratio (foundation sessions)
 * @param {boolean} [sessionConfig.adaptive_ratio] - Whether ABI should determine ratio
 * @param {Object} [history] - Optional session history for experienced users
 * @param {number} [history.avg_coherence] - Average coherence from recent sessions
 * @param {string} [history.last_ratio] - Last successfully completed ratio
 * @returns {Object} { ratio, inhale, exhale, duration_seconds, confidence, method }
 */
function determineBreathParams(baseline, sessionConfig, history) {
  // If session has a hardcoded ratio and adaptive_ratio is not true, use it
  if (sessionConfig.ratio && sessionConfig.adaptive_ratio !== true) {
    return {
      ratio: sessionConfig.ratio,
      ...parseRatio(sessionConfig.ratio),
      duration_seconds: sessionConfig.duration_seconds || 300,
      confidence: 1.0,
      method: 'hardcoded'
    };
  }

  // ── PARSE RATIO RANGE ────────────────────────────────
  const { floor, ceiling } = parseRatioRange(sessionConfig.ratio_range);
  const allowedRatios = filterRatioLibrary(floor, ceiling);

  if (allowedRatios.length === 0) {
    // Fallback: safest ratio
    return {
      ratio: '3:4', inhale: 3, exhale: 4,
      duration_seconds: parseDurationRange(sessionConfig.duration_range).min,
      confidence: 0.3,
      method: 'fallback_no_range'
    };
  }

  // ── SELECT RATIO FROM BASELINE ───────────────────────
  const rr = baseline?.respiratory_rate || 14;
  const hr = baseline?.resting_hr || 72;
  const hrv = baseline?.resting_hrv || 45;

  // Natural breathing cycle length in seconds
  const naturalCycle = 60 / rr;

  // Capacity score: lower HR, higher HRV, slower RR = more capacity
  const capacityScore = calculateCapacity(hr, hrv, rr);

  // Find the ratio whose total cycle time is closest to natural
  // but doesn't exceed capacity
  let selectedRatio = selectRatioForCapacity(allowedRatios, naturalCycle, capacityScore);

  // ── HISTORY ADJUSTMENT ───────────────────────────────
  // If user has history and demonstrated higher capacity, nudge up
  if (history?.last_ratio && history?.avg_coherence > 0.5) {
    const lastDifficulty = RATIO_LIBRARY.find(r => r.ratio === history.last_ratio)?.difficulty || 0;
    if (lastDifficulty > selectedRatio.difficulty && lastDifficulty <= (ceiling?.difficulty || 99)) {
      // User can handle more — move up one step within range
      const nextUp = allowedRatios.find(r => r.difficulty === selectedRatio.difficulty + 1);
      if (nextUp) {
        selectedRatio = nextUp;
      }
    }
  }

  // ── DETERMINE DURATION ───────────────────────────────
  const { min: minDuration, max: maxDuration } = parseDurationRange(sessionConfig.duration_range);
  const duration = selectDuration(minDuration, maxDuration, capacityScore);

  // ── CONFIDENCE ───────────────────────────────────────
  // Higher when we have real biometrics, lower with defaults
  const hasRealBio = baseline?.resting_hr && baseline?.respiratory_rate;
  const confidence = hasRealBio ? (history ? 0.9 : 0.7) : 0.4;

  return {
    ratio: selectedRatio.ratio,
    inhale: selectedRatio.inhale,
    exhale: selectedRatio.exhale,
    duration_seconds: duration,
    confidence,
    method: history ? 'baseline_plus_history' : 'arrival_baseline'
  };
}

/**
 * Parse a ratio string like "4:6" into {inhale, exhale}
 */
function parseRatio(ratioStr) {
  if (!ratioStr || typeof ratioStr !== 'string') return { inhale: 4, exhale: 6 };
  const parts = ratioStr.split(':').map(Number);
  return { inhale: parts[0] || 4, exhale: parts[1] || 6 };
}

/**
 * Parse ratio_range string like "2:3 → 4:7" into floor/ceiling library entries
 */
function parseRatioRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') {
    return { floor: RATIO_LIBRARY[0], ceiling: RATIO_LIBRARY[RATIO_LIBRARY.length - 1] };
  }

  // Handle formats: "2:3 → 4:7", "2:3 - 4:7", "2:3 to 4:7"
  const parts = rangeStr.split(/\s*[→\-–]\s*|\s+to\s+/);
  const floorStr = (parts[0] || '').trim();
  const ceilStr = (parts[1] || '').trim();

  const floor = RATIO_LIBRARY.find(r => r.ratio === floorStr) || RATIO_LIBRARY[0];
  const ceiling = RATIO_LIBRARY.find(r => r.ratio === ceilStr) || RATIO_LIBRARY[RATIO_LIBRARY.length - 1];

  return { floor, ceiling };
}

/**
 * Filter ratio library to entries within floor-ceiling range
 */
function filterRatioLibrary(floor, ceiling) {
  return RATIO_LIBRARY.filter(r =>
    r.difficulty >= floor.difficulty && r.difficulty <= ceiling.difficulty
  );
}

/**
 * Parse duration_range string like "120-240" into {min, max}
 */
function parseDurationRange(rangeStr) {
  if (!rangeStr) return { min: 180, max: 300 };

  if (typeof rangeStr === 'string') {
    const parts = rangeStr.split(/\s*[-–]\s*/).map(Number);
    return { min: parts[0] || 180, max: parts[1] || parts[0] || 300 };
  }

  // Handle object format {min, max}
  if (typeof rangeStr === 'object') {
    return { min: rangeStr.min || 180, max: rangeStr.max || 300 };
  }

  return { min: 180, max: 300 };
}

/**
 * Calculate capacity score (0-1) from biometrics.
 * Higher = more breath capacity.
 */
function calculateCapacity(hr, hrv, rr) {
  // HR: lower is better (60-100 range)
  const hrScore = Math.max(0, Math.min(1, (100 - hr) / 40));

  // HRV: higher is better (10-100 range)
  const hrvScore = Math.max(0, Math.min(1, (hrv - 10) / 90));

  // RR: slower is better (8-22 range)
  const rrScore = Math.max(0, Math.min(1, (22 - rr) / 14));

  // Weighted: RR matters most (natural breath pace), then HRV, then HR
  return (rrScore * 0.5) + (hrvScore * 0.3) + (hrScore * 0.2);
}

/**
 * Select the best ratio for the user's capacity within allowed range.
 */
function selectRatioForCapacity(allowedRatios, naturalCycle, capacityScore) {
  if (allowedRatios.length === 1) return allowedRatios[0];

  // Target: a cycle slightly longer than natural (therapeutic stretch)
  // but not so long it causes strain
  const targetCycle = naturalCycle * (1 + capacityScore * 0.3);

  // Find closest match
  let best = allowedRatios[0];
  let bestDist = Infinity;

  for (const r of allowedRatios) {
    const dist = Math.abs(r.total - targetCycle);
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }

  // Safety: if capacity is very low (< 0.25), pick the easiest in range
  if (capacityScore < 0.25) {
    return allowedRatios[0];
  }

  return best;
}

/**
 * Select duration within range based on capacity.
 * Lower capacity → shorter duration.
 */
function selectDuration(min, max, capacityScore) {
  const range = max - min;
  const selected = min + Math.round(range * capacityScore);
  return Math.max(min, Math.min(max, selected));
}

module.exports = { determineBreathParams, parseRatio, RATIO_LIBRARY };
