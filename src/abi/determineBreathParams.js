// ============================================================
// [ABI] determineBreathParams.js — Arrival-based ratio selection
// File: src/abi/determineBreathParams.js
//
// Selects breathing cadence from 30-second arrival baseline.
// HRV thresholds drive track selection. Session count drives
// capacity ramp for compromised lungs (silent detection).
//
// Clinical Rule #1: The system NEVER asks users about their
// breathing capacity. Silent biometric detection only.
//
// Track selection (from 30s arrival baseline):
//   depleted / HRV < 20   → gentle  → 3:5
//   HRV 20-50              → standard → 4:6
//   HRV > 50               → standard → 4:7 or 4:8
//   Capacity Track (S0.5-S4.5) → minimal → 3:4
//
// Capacity ramp (compromised lungs, silent):
//   Sessions 1-5:  2:4
//   Sessions 6-10: 3:5
//   Sessions 11-15: 4:6
//   Sessions 16+:  personalized resonance frequency
//
// Absolute floor: 2:3 (Capacity Track S0.5 only)
// Fallback when arrival-complete fails: 3:5
// ============================================================

const RATIO_LIBRARY = [
  { ratio: '2:3', inhale: 2, exhale: 3, total: 5, difficulty: 1 },
  { ratio: '2:4', inhale: 2, exhale: 4, total: 6, difficulty: 2 },
  { ratio: '3:4', inhale: 3, exhale: 4, total: 7, difficulty: 3 },
  { ratio: '3:5', inhale: 3, exhale: 5, total: 8, difficulty: 4 },
  { ratio: '4:6', inhale: 4, exhale: 6, total: 10, difficulty: 6 },
  { ratio: '4:7', inhale: 4, exhale: 7, total: 11, difficulty: 7 },
  { ratio: '4:8', inhale: 4, exhale: 8, total: 12, difficulty: 8 },
];

// Lookup helper
function getRatio(ratioStr) {
  return RATIO_LIBRARY.find(r => r.ratio === ratioStr) || RATIO_LIBRARY[3]; // 3:5 fallback
}

/**
 * Determine breath parameters from arrival baseline.
 *
 * @param {Object} baseline - { resting_hr, resting_hrv, respiratory_rate, mean_coherence }
 * @param {Object} sessionConfig - { adaptive_ratio, ratio, ratio_range, duration_range, detection_mode, capacity_state }
 * @param {Object} [history] - { avg_coherence, last_ratio, session_count }
 * @param {Object} [options] - { pool, userId }
 */
async function determineBreathParams(baseline, sessionConfig, history, options) {
  // ── HARDCODED RATIO (First Spiral S121-S150 = locked 6:6) ──
  if (sessionConfig.ratio && sessionConfig.adaptive_ratio !== true) {
    const parsed = parseRatio(sessionConfig.ratio);
    console.log('[BREATH_PARAMS] Hardcoded ratio:', sessionConfig.ratio);
    return buildResult(parsed.inhale, parsed.exhale, sessionConfig.duration_seconds || 180,
      'hardcoded', 'Fixed ratio from session config', 1.0);
  }

  // ── INPUTS ──
  const hrv = baseline?.resting_hrv ?? baseline?.mean_hrv ?? baseline?.hrv ?? null;
  const hr = baseline?.resting_hr ?? baseline?.mean_hr ?? baseline?.heart_rate ?? null;
  const coherence = baseline?.mean_coherence ?? baseline?.initial_coherence ?? baseline?.coherence ?? null;
  const capacityState = sessionConfig?.capacity_state || null;

  // ── SESSION COUNT (for capacity ramp) ──
  let sessionCount = history?.session_count || 0;
  if (!sessionCount && options?.pool && options?.userId) {
    try {
      const countResult = await options.pool.query(
        'SELECT COUNT(*) as cnt FROM session_completions WHERE user_id = $1',
        [options.userId]
      );
      sessionCount = parseInt(countResult.rows[0]?.cnt || 0);
    } catch { /* non-blocking */ }
  }

  // ── TRACK + RATIO DETERMINATION ──
  let track = 'standard';
  let selected = getRatio('4:6'); // standard default
  let reason = '';

  // Rule 1: Capacity Track user (S0.5-S4.5 — compromised lungs ramp)
  const isCapacityTrack = sessionConfig?.track === 'minimal'
    || sessionConfig?.track === 'capacity'
    || capacityState === 'capacity_track';

  if (isCapacityTrack) {
    track = 'minimal';
    if (sessionCount <= 5) {
      selected = getRatio('2:4');
      reason = 'Capacity ramp: sessions 1-5 → 2:4';
    } else if (sessionCount <= 10) {
      selected = getRatio('3:5');
      reason = 'Capacity ramp: sessions 6-10 → 3:5';
    } else if (sessionCount <= 15) {
      selected = getRatio('4:6');
      reason = 'Capacity ramp: sessions 11-15 → 4:6';
    } else {
      // Sessions 16+: personalized resonance frequency from history
      selected = getRatio('4:6');
      reason = 'Capacity ramp: sessions 16+ → personalized (default 4:6)';
      // If history has a successful ratio, use it
      if (history?.last_ratio) {
        const prev = getRatio(history.last_ratio);
        if (prev) { selected = prev; reason = 'Capacity ramp: sessions 16+ → last successful ratio ' + prev.ratio; }
      }
    }
  }
  // Rule 2: Depleted capacity state
  else if (capacityState === 'depleted') {
    track = 'gentle';
    selected = getRatio('3:5');
    reason = 'Depleted capacity state → gentle track → 3:5';
  }
  // Rule 3: HRV-based track selection (primary path)
  else if (hrv !== null) {
    if (hrv < 20) {
      track = 'gentle';
      selected = getRatio('3:5');
      reason = 'HRV ' + Math.round(hrv) + ' < 20 → gentle track → 3:5';
    } else if (hrv <= 50) {
      track = 'standard';
      selected = getRatio('4:6');
      reason = 'HRV ' + Math.round(hrv) + ' (20-50) → standard track → 4:6';
    } else {
      track = 'standard';
      // HRV > 50: higher capacity, can handle longer exhales
      if (hrv > 70) {
        selected = getRatio('4:8');
        reason = 'HRV ' + Math.round(hrv) + ' > 70 → standard track → 4:8';
      } else {
        selected = getRatio('4:7');
        reason = 'HRV ' + Math.round(hrv) + ' > 50 → standard track → 4:7';
      }
    }
  }
  // Rule 4: No HRV data — conservative fallback
  else {
    track = 'gentle';
    selected = getRatio('3:5');
    reason = 'No HRV data → gentle fallback → 3:5';
  }

  // ── RATIO RANGE GUARD ──
  // If session config has a ratio_range, clamp selection to it
  const allowedRatios = filterRatioOptionsForUser(sessionConfig.ratio_range);
  if (allowedRatios.length > 0) {
    const inRange = allowedRatios.find(r => r.ratio === selected.ratio);
    if (!inRange) {
      // Selected ratio not in range — find closest allowed
      const closest = findClosestRatio(allowedRatios, selected.total);
      reason += ' (clamped from ' + selected.ratio + ' to ' + closest.ratio + ' by ratio_range)';
      selected = closest;
    }
  }

  // ── DURATION ──
  const duration = calculateDuration(sessionConfig.duration_range, hrv ? Math.min(1, hrv / 80) : 0.4);

  // ── CONFIDENCE ──
  const hasRealBio = hr !== null && hrv !== null;
  const confidence = hasRealBio ? 0.8 : 0.4;

  // ── LOGGING ──
  console.log('[BREATH_PARAMS] Input:', JSON.stringify({
    mean_hr: hr, mean_hrv: hrv, initial_coherence: coherence,
    session_count: sessionCount, capacity_state: capacityState, track_config: sessionConfig?.track
  }));
  console.log('[BREATH_PARAMS] Output:', JSON.stringify({
    ratio: selected.ratio, track, reason, confidence, duration
  }));

  return buildResult(selected.inhale, selected.exhale, duration,
    sessionConfig.detection_mode || 'arrival_baseline', reason, confidence, track);
}

function buildResult(inhale, exhale, duration, mode, reason, confidence, track) {
  return {
    ratio: inhale + ':' + exhale,
    inhale_sec: inhale,
    exhale_sec: exhale,
    cycle_sec: inhale + exhale,
    duration_sec: duration,
    detection_mode: mode,
    selection_reason: reason,
    confidence,
    track: track || 'standard',
    // Backward compat
    inhale, exhale,
    duration_seconds: duration,
    method: mode
  };
}

function parseRatio(ratioStr) {
  if (!ratioStr || typeof ratioStr !== 'string') return { inhale: 4, exhale: 6 };
  const parts = ratioStr.split(':').map(Number);
  return { inhale: parts[0] || 4, exhale: parts[1] || 6 };
}

function filterRatioOptionsForUser(ratioRange) {
  if (!ratioRange) return [...RATIO_LIBRARY];

  if (Array.isArray(ratioRange)) {
    return RATIO_LIBRARY.filter(r => ratioRange.includes(r.ratio));
  }

  const { floor, ceiling } = parseRatioRange(ratioRange);
  return RATIO_LIBRARY.filter(r =>
    r.difficulty >= floor.difficulty && r.difficulty <= ceiling.difficulty
  );
}

function calculateDuration(durationRange, capacityFactor) {
  const { min, max } = parseDurationRange(durationRange);
  const range = max - min;
  const selected = min + Math.round(range * (capacityFactor || 0.5));
  return Math.max(min, Math.min(max, selected));
}

function findClosestRatio(allowedRatios, targetTotal) {
  if (!allowedRatios || allowedRatios.length === 0) return getRatio('3:5');
  if (allowedRatios.length === 1) return allowedRatios[0];

  let best = allowedRatios[0];
  let bestDist = Infinity;
  for (const r of allowedRatios) {
    const dist = Math.abs(r.total - targetTotal);
    if (dist < bestDist) { bestDist = dist; best = r; }
  }
  return best;
}

function parseRatioRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') {
    return { floor: RATIO_LIBRARY[0], ceiling: RATIO_LIBRARY[RATIO_LIBRARY.length - 1] };
  }
  const parts = rangeStr.split(/\s*[→\-–]\s*|\s+to\s+/);
  const floorStr = (parts[0] || '').trim();
  const ceilStr = (parts[1] || '').trim();
  return {
    floor: RATIO_LIBRARY.find(r => r.ratio === floorStr) || RATIO_LIBRARY[0],
    ceiling: RATIO_LIBRARY.find(r => r.ratio === ceilStr) || RATIO_LIBRARY[RATIO_LIBRARY.length - 1]
  };
}

function parseDurationRange(rangeStr) {
  if (!rangeStr) return { min: 180, max: 180 }; // 3-minute default
  if (typeof rangeStr === 'string') {
    const parts = rangeStr.split(/\s*[-–]\s*/).map(Number);
    return { min: parts[0] || 180, max: parts[1] || parts[0] || 180 };
  }
  if (typeof rangeStr === 'object') {
    return { min: rangeStr.min_sec || rangeStr.min || 180, max: rangeStr.max_sec || rangeStr.max || 180 };
  }
  return { min: 180, max: 180 };
}

module.exports = {
  determineBreathParams,
  filterRatioOptionsForUser,
  calculateDuration,
  findClosestRatio,
  parseRatio,
  RATIO_LIBRARY
};
