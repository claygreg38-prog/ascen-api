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
 * @param {Object} sessionConfig - From YAML or adapter
 * @param {Object} [history] - Optional session history for experienced users
 * @param {Object} [options] - { pool, userId } for DB-based history lookup
 * @returns {Object} { ratio, inhale_sec, exhale_sec, cycle_sec, duration_sec, detection_mode, selection_reason, confidence }
 */
async function determineBreathParams(baseline, sessionConfig, history, options) {
  // If session has a hardcoded ratio and adaptive_ratio is not true, use it
  if (sessionConfig.ratio && sessionConfig.adaptive_ratio !== true) {
    const parsed = parseRatio(sessionConfig.ratio);
    return {
      ratio: sessionConfig.ratio,
      inhale_sec: parsed.inhale,
      exhale_sec: parsed.exhale,
      cycle_sec: parsed.inhale + parsed.exhale,
      duration_sec: sessionConfig.duration_seconds || 300,
      detection_mode: 'hardcoded',
      selection_reason: 'Fixed ratio from session config',
      confidence: 1.0,
      // Backward compat
      inhale: parsed.inhale,
      exhale: parsed.exhale,
      duration_seconds: sessionConfig.duration_seconds || 300,
      method: 'hardcoded'
    };
  }

  // ── PARSE RATIO RANGE ────────────────────────────────
  const allowedRatios = filterRatioOptionsForUser(sessionConfig.ratio_range);

  if (allowedRatios.length === 0) {
    const dur = calculateDuration(sessionConfig.duration_range, 0.3);
    return {
      ratio: '3:4', inhale_sec: 3, exhale_sec: 4, cycle_sec: 7,
      duration_sec: dur,
      detection_mode: 'fallback',
      selection_reason: 'No valid ratios in range',
      confidence: 0.3,
      inhale: 3, exhale: 4, duration_seconds: dur, method: 'fallback_no_range'
    };
  }

  // ── BASELINE BIOMETRICS ───────────────────────────────
  const rr = baseline?.respiratory_rate || 14;
  const hr = baseline?.resting_hr || 72;
  const hrv = baseline?.resting_hrv || 45;
  const naturalCycle = 60 / rr;

  // Target BPM = naturalRR * 0.75 (therapeutic slowdown)
  const targetBPM = rr * 0.75;
  const targetCycle = 60 / targetBPM;

  // Safety floor: selected ratio BPM must not be < naturalRR * 0.5
  const safetyFloorCycle = 60 / (rr * 0.5);

  const capacityScore = calculateCapacity(hr, hrv, rr);

  // ── DETECTION MODE ────────────────────────────────────
  const detectionMode = sessionConfig.detection_mode || 'arrival_baseline';
  let selectionReason = 'Selected from arrival baseline';

  // ── HISTORY-BASED ADJUSTMENT ──────────────────────────
  // For arrival_baseline_plus_history, query last 10 sessions
  if (detectionMode === 'arrival_baseline_plus_history' && !history && options?.pool && options?.userId) {
    try {
      const histResult = await options.pool.query(
        `SELECT coherence_score, breath_track_at_completion, arc_id
         FROM session_completions
         WHERE user_id = $1
         ORDER BY completed_at DESC LIMIT 10`,
        [options.userId]
      );
      if (histResult.rows.length > 0) {
        const avgCoherence = histResult.rows.reduce((s, r) => s + (parseFloat(r.coherence_score) || 0), 0) / histResult.rows.length;
        history = { avg_coherence: avgCoherence, last_ratio: null };
      }
    } catch (err) {
      // Non-blocking — proceed without history
    }
  }

  // ── SELECT RATIO ──────────────────────────────────────
  let selectedRatio = findClosestRatio(allowedRatios, targetCycle);

  // Safety floor check: if selected ratio cycle > safetyFloorCycle, use floor
  if (selectedRatio.total > safetyFloorCycle) {
    selectedRatio = allowedRatios[0];
    selectionReason = 'Safety floor applied — ratio capped to prevent strain';
  }

  // Low capacity override
  if (capacityScore < 0.25) {
    selectedRatio = allowedRatios[0];
    selectionReason = 'Low biometric capacity — using easiest ratio in range';
  }

  // History nudge
  if (history?.last_ratio && history?.avg_coherence > 0.5) {
    const { floor: rangeFloor, ceiling: rangeCeiling } = parseRatioRange(sessionConfig.ratio_range);
    const lastDifficulty = RATIO_LIBRARY.find(r => r.ratio === history.last_ratio)?.difficulty || 0;
    if (lastDifficulty > selectedRatio.difficulty && lastDifficulty <= (rangeCeiling?.difficulty || 99)) {
      const nextUp = allowedRatios.find(r => r.difficulty === selectedRatio.difficulty + 1);
      if (nextUp && nextUp.total <= safetyFloorCycle) {
        selectedRatio = nextUp;
        selectionReason = 'Nudged up based on session history';
      }
    }
  }

  if (history && detectionMode === 'arrival_baseline_plus_history') {
    selectionReason += ' (with history from last 10 sessions)';
  }

  // ── DURATION ──────────────────────────────────────────
  const duration = calculateDuration(sessionConfig.duration_range, capacityScore);

  // ── CONFIDENCE ────────────────────────────────────────
  const hasRealBio = baseline?.resting_hr && baseline?.respiratory_rate;
  const confidence = hasRealBio ? (history ? 0.9 : 0.7) : 0.4;

  return {
    ratio: selectedRatio.ratio,
    inhale_sec: selectedRatio.inhale,
    exhale_sec: selectedRatio.exhale,
    cycle_sec: selectedRatio.total,
    duration_sec: duration,
    detection_mode: detectionMode,
    selection_reason: selectionReason,
    confidence,
    // Backward compat fields
    inhale: selectedRatio.inhale,
    exhale: selectedRatio.exhale,
    duration_seconds: duration,
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
 * Filter RATIO_LIBRARY to entries allowed by ratio_range config.
 * Accepts string format "2:3 → 4:7" or array format ["2:3", "3:4", "4:6"].
 */
function filterRatioOptionsForUser(ratioRange) {
  if (!ratioRange) {
    return [...RATIO_LIBRARY];
  }

  // Array format (from corrected YAML abi_config)
  if (Array.isArray(ratioRange)) {
    return RATIO_LIBRARY.filter(r => ratioRange.includes(r.ratio));
  }

  // String format "2:3 → 4:7"
  const { floor, ceiling } = parseRatioRange(ratioRange);
  return RATIO_LIBRARY.filter(r =>
    r.difficulty >= floor.difficulty && r.difficulty <= ceiling.difficulty
  );
}

/**
 * Calculate duration from duration_range and capacity score.
 * Lower capacity → shorter duration.
 */
function calculateDuration(durationRange, capacityScore) {
  const { min, max } = parseDurationRange(durationRange);
  const range = max - min;
  const selected = min + Math.round(range * (capacityScore || 0.5));
  return Math.max(min, Math.min(max, selected));
}

/**
 * Find the ratio in allowedRatios closest to targetCycle seconds.
 */
function findClosestRatio(allowedRatios, targetCycle) {
  if (!allowedRatios || allowedRatios.length === 0) {
    return RATIO_LIBRARY[2]; // 3:4 fallback
  }
  if (allowedRatios.length === 1) return allowedRatios[0];

  let best = allowedRatios[0];
  let bestDist = Infinity;

  for (const r of allowedRatios) {
    const dist = Math.abs(r.total - targetCycle);
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }

  return best;
}

/**
 * Parse ratio_range string "2:3 → 4:7" into floor/ceiling library entries
 */
function parseRatioRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') {
    return { floor: RATIO_LIBRARY[0], ceiling: RATIO_LIBRARY[RATIO_LIBRARY.length - 1] };
  }

  const parts = rangeStr.split(/\s*[→\-–]\s*|\s+to\s+/);
  const floorStr = (parts[0] || '').trim();
  const ceilStr = (parts[1] || '').trim();

  const floor = RATIO_LIBRARY.find(r => r.ratio === floorStr) || RATIO_LIBRARY[0];
  const ceiling = RATIO_LIBRARY.find(r => r.ratio === ceilStr) || RATIO_LIBRARY[RATIO_LIBRARY.length - 1];

  return { floor, ceiling };
}

/**
 * Parse duration_range — string "120-240" or object {min_sec, max_sec}
 */
function parseDurationRange(rangeStr) {
  if (!rangeStr) return { min: 180, max: 300 };

  if (typeof rangeStr === 'string') {
    const parts = rangeStr.split(/\s*[-–]\s*/).map(Number);
    return { min: parts[0] || 180, max: parts[1] || parts[0] || 300 };
  }

  if (typeof rangeStr === 'object') {
    return {
      min: rangeStr.min_sec || rangeStr.min || 180,
      max: rangeStr.max_sec || rangeStr.max || 300
    };
  }

  return { min: 180, max: 300 };
}

/**
 * Calculate capacity score (0-1) from biometrics.
 */
function calculateCapacity(hr, hrv, rr) {
  const hrScore = Math.max(0, Math.min(1, (100 - hr) / 40));
  const hrvScore = Math.max(0, Math.min(1, (hrv - 10) / 90));
  const rrScore = Math.max(0, Math.min(1, (22 - rr) / 14));
  return (rrScore * 0.5) + (hrvScore * 0.3) + (hrScore * 0.2);
}

module.exports = {
  determineBreathParams,
  filterRatioOptionsForUser,
  calculateDuration,
  findClosestRatio,
  parseRatio,
  RATIO_LIBRARY
};
