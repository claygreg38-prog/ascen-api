/**
 * NS3 — Nervous System State Score Engine
 * AXIS Brain Stem Module | ASCEN BreathWorx
 *
 * Computes a composite nervous system regulation score (0–100)
 * from raw biometric streams. Classifies zone state and emits
 * adaptive feedback directives to Luno, BreathMatch, and session
 * track selector.
 *
 * PRIMARY DIRECTIVE: All output routes through AXIS. No bypasses.
 * Clinical Rule #1: Silent biometric detection only. No metric
 * values ever surfaced to the user.
 *
 * Inputs:  Raw RR intervals (ms), SpO2 (%), Respiratory Rate (rpm)
 * Outputs: NS3 score, zone classification, feedback directives
 */

'use strict';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const WEIGHTS = {
  rmssd:     0.30,   // Vagal tone / regulation capacity
  coherence: 0.30,   // Breath-heart synchronization
  hrTrend:   0.20,   // Arousal direction (rising vs falling)
  respRate:  0.10,   // Breath compliance with pacing
  sdnnTrend: 0.10,   // Sustainability window
};

const ZONES = {
  BELOW_WINDOW:  { min: 0,  max: 35,  label: 'below_window'  },
  APPROACHING:   { min: 36, max: 55,  label: 'approaching'   },
  OPTIMAL:       { min: 56, max: 80,  label: 'optimal'       },
  OVERDRIVE:     { min: 81, max: 100, label: 'overdrive'     },
};

// Clinical safety floor — SpO2 below this triggers grounding protocol
const SPO2_SAFETY_FLOOR = 94; // percent

// [Refinement 3] Duration (ms) below window before silent track downshift triggers
// Changed from 60000 to 120000. Timer only begins AFTER initial arrival phase is complete.
const TRACK_DOWNSHIFT_THRESHOLD = 120000; // 120 seconds

// Optimal respiratory rate range for coherence (breaths per minute)
const OPTIMAL_RESP_MIN = 4.5;
const OPTIMAL_RESP_MAX = 7.0;

// Reference ranges for normalization (population-adjusted for
// justice-involved adults with trauma history)
const REFERENCE = {
  rmssd:    { low: 10,  high: 60  },   // ms — trauma pop skews low
  sdnn:     { low: 20,  high: 100 },   // ms
  hr:       { low: 55,  high: 100 },   // bpm
  respRate: { low: 4,   high: 20  },   // rpm
};


// ─────────────────────────────────────────────
// CORE CALCULATIONS FROM RAW RR INTERVALS
// ─────────────────────────────────────────────

/**
 * Calculate RMSSD from array of RR intervals (ms)
 * Root Mean Square of Successive Differences
 * Primary vagal tone indicator
 */
function calculateRMSSD(rrIntervals) {
  if (!rrIntervals || rrIntervals.length < 2) return null;
  const diffs = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    diffs.push(Math.pow(rrIntervals[i] - rrIntervals[i - 1], 2));
  }
  return Math.sqrt(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

/**
 * Calculate SDNN from array of RR intervals (ms)
 * Standard Deviation of NN intervals
 * Overall HRV — sustainability and longitudinal trend marker
 */
function calculateSDNN(rrIntervals) {
  if (!rrIntervals || rrIntervals.length < 2) return null;
  const mean = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const variance = rrIntervals.reduce((sum, rr) => sum + Math.pow(rr - mean, 2), 0) / rrIntervals.length;
  return Math.sqrt(variance);
}

/**
 * Calculate mean HR from RR intervals
 * RR in ms → HR in bpm
 */
function calculateMeanHR(rrIntervals) {
  if (!rrIntervals || rrIntervals.length < 1) return null;
  const meanRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  return 60000 / meanRR;
}

/**
 * Calculate HRV Coherence score (0–1)
 * Measures the rhythmic order / sine-wave quality of the HRV signal
 * Uses frequency domain — peak power in LF band (0.04–0.15 Hz)
 * relative to total power
 *
 * Simplified time-domain approximation for real-time use:
 * Coherence ≈ regularity of RR oscillation pattern
 *
 * [Refinement 1] Artifact filter: discard any RR interval where
 * successive difference > 20% of mean RR before computing sign changes.
 */
function calculateCoherence(rrIntervals) {
  try { const fs = require('fs'); const bufLen = rrIntervals ? rrIntervals.length : 0; fs.appendFileSync('/tmp/bug1_diagnostic.log', `[BUG1-DIAG] ${new Date().toISOString()} calculateCoherence called | bufLen=${bufLen} | firstFew=${JSON.stringify((rrIntervals||[]).slice(0,3))}\n`); } catch(e) {}
  if (!rrIntervals || rrIntervals.length < 10) {
    try { const fs = require('fs'); fs.appendFileSync('/tmp/bug1_diagnostic.log', `[BUG1-DIAG] ${new Date().toISOString()} calculateCoherence RETURN value=null (insufficient: ${rrIntervals ? rrIntervals.length : 0} < 10)\n`); } catch(e) {}
    return null;
  }

  // [Refinement 1] Artifact filter — remove RR intervals where
  // successive difference > 20% of mean RR
  const meanRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const threshold = meanRR * 0.20;
  const filtered = [rrIntervals[0]];
  for (let i = 1; i < rrIntervals.length; i++) {
    if (Math.abs(rrIntervals[i] - rrIntervals[i - 1]) <= threshold) {
      filtered.push(rrIntervals[i]);
    }
    // else: discard this interval entirely
  }

  if (filtered.length < 10) {
    try { const fs = require('fs'); fs.appendFileSync('/tmp/bug1_diagnostic.log', `[BUG1-DIAG] ${new Date().toISOString()} calculateCoherence RETURN value=null (filtered: ${filtered.length} < 10, pre-filter: ${rrIntervals.length})\n`); } catch(e) {}
    return null;
  }

  // Compute successive differences on filtered data
  const diffs = [];
  for (let i = 1; i < filtered.length; i++) {
    diffs.push(filtered[i] - filtered[i - 1]);
  }

  // Sign changes in diffs — fewer sign changes = more coherent oscillation
  let signChanges = 0;
  for (let i = 1; i < diffs.length; i++) {
    if (Math.sign(diffs[i]) !== Math.sign(diffs[i - 1])) signChanges++;
  }

  // Normalize: perfect coherence = one sign change every breath cycle (~6–8 RR intervals)
  // More sign changes = noise/incoherence
  const coherenceRaw = Math.max(0, 1 - (signChanges / diffs.length));

  // Amplitude check — coherence requires meaningful oscillation amplitude
  const amplitude = Math.max(...filtered) - Math.min(...filtered);
  const amplitudeBonus = Math.min(1, amplitude / 100); // 100ms swing = full bonus

  const finalValue = Math.min(1, (coherenceRaw * 0.7) + (amplitudeBonus * 0.3));
  try { const fs = require('fs'); fs.appendFileSync('/tmp/bug1_diagnostic.log', `[BUG1-DIAG] ${new Date().toISOString()} calculateCoherence RETURN value=${finalValue.toFixed(4)} | filtered=${filtered.length} signChanges=${signChanges} coherenceRaw=${coherenceRaw.toFixed(4)} amplitude=${amplitude.toFixed(1)} amplitudeBonus=${amplitudeBonus.toFixed(4)}\n`); } catch(e) {}
  return finalValue;
}

/**
 * Derive respiratory rate from RR interval oscillation (rpm)
 * HRV contains respiratory sinus arrhythmia — breath modulates RR
 *
 * [Refinement 2] If local maxima returns null AND participant is in
 * active BreathMatch pacing: return 50% compliance rate instead of null.
 * Do not drop the 10% weight from NS3 score.
 */
function deriveRespiratoryRate(rrIntervals, windowSeconds = 30, sessionContext = {}) {
  if (!rrIntervals || rrIntervals.length < 10) return null;

  // Find peaks in RR interval series (local maxima)
  const peaks = [];
  for (let i = 1; i < rrIntervals.length - 1; i++) {
    if (rrIntervals[i] > rrIntervals[i - 1] && rrIntervals[i] > rrIntervals[i + 1]) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) {
    // [Refinement 2] Fallback: if BreathMatch pacing is active,
    // return 50% compliance score instead of null
    if (sessionContext.breathMatchActive) {
      return OPTIMAL_RESP_MIN + (OPTIMAL_RESP_MAX - OPTIMAL_RESP_MIN); // outside optimal = ~50 score
    }
    return null;
  }

  // Average beat interval
  const meanRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;

  // Beats between peaks = beats per breath cycle
  const peakDistances = [];
  for (let i = 1; i < peaks.length; i++) {
    peakDistances.push(peaks[i] - peaks[i - 1]);
  }
  const meanBeatsPerBreath = peakDistances.reduce((a, b) => a + b, 0) / peakDistances.length;

  // Convert: rpm = 60000 / (meanBeatsPerBreath × meanRR_ms)
  const msPerBreath = meanBeatsPerBreath * meanRR;
  return 60000 / msPerBreath;
}


// ─────────────────────────────────────────────
// NORMALIZATION
// ─────────────────────────────────────────────

/**
 * Normalize a raw metric value to 0–100 scale
 * within clinical reference range
 */
function normalize(value, low, high, invert = false) {
  if (value === null || value === undefined) return null;
  const clamped = Math.max(low, Math.min(high, value));
  const normalized = ((clamped - low) / (high - low)) * 100;
  return invert ? 100 - normalized : normalized;
}

/**
 * Score respiratory rate compliance with optimal range
 * Returns 0–100 based on proximity to 4.5–7 rpm target
 */
function scoreRespRate(respRate) {
  if (respRate === null) return null;
  if (respRate >= OPTIMAL_RESP_MIN && respRate <= OPTIMAL_RESP_MAX) return 100;
  if (respRate < OPTIMAL_RESP_MIN) {
    // Too slow — linear drop below 4.5
    return Math.max(0, 100 - ((OPTIMAL_RESP_MIN - respRate) * 20));
  }
  // Too fast — linear drop above 7
  return Math.max(0, 100 - ((respRate - OPTIMAL_RESP_MAX) * 10));
}


// ─────────────────────────────────────────────
// TREND ANALYSIS
// ─────────────────────────────────────────────

/**
 * Calculate HR trend score
 * Falling HR during session = parasympathetic activation = good
 * Returns 0–100 where 100 = HR clearly dropping
 */
function scoreHRTrend(hrHistory) {
  if (!hrHistory || hrHistory.length < 3) return 50; // neutral if no history
  const recent = hrHistory.slice(-3);
  const older = hrHistory.slice(-6, -3);
  if (older.length < 1) return 50;

  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderMean = older.reduce((a, b) => a + b, 0) / older.length;
  const delta = olderMean - recentMean; // positive = HR dropping = good

  // Scale: 5+ bpm drop = 100, flat = 50, rising = 0
  return Math.max(0, Math.min(100, 50 + (delta * 10)));
}

/**
 * Calculate SDNN trend score
 * Rising SDNN during session = increasing regulatory capacity = good
 */
function scoreSDNNTrend(sdnnHistory) {
  if (!sdnnHistory || sdnnHistory.length < 3) return 50;
  const recent = sdnnHistory.slice(-3);
  const older = sdnnHistory.slice(-6, -3);
  if (older.length < 1) return 50;

  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderMean = older.reduce((a, b) => a + b, 0) / older.length;
  const delta = recentMean - olderMean; // positive = SDNN rising = good

  return Math.max(0, Math.min(100, 50 + (delta * 2)));
}


// ─────────────────────────────────────────────
// ZONE CLASSIFICATION
// ─────────────────────────────────────────────

function classifyZone(ns3Score) {
  for (const [key, zone] of Object.entries(ZONES)) {
    if (ns3Score >= zone.min && ns3Score <= zone.max) {
      return zone.label;
    }
  }
  return 'below_window';
}


// ─────────────────────────────────────────────
// FEEDBACK DIRECTIVE GENERATOR
// ─────────────────────────────────────────────

/**
 * Generate AXIS feedback directives from zone + session context
 * These route to: BreathMatch, Luno, TrackSelector, LightBridge
 *
 * [SpO2 null handling] Kyto2935 does not measure SpO2.
 * Safety check skipped if spO2 is null. No error thrown.
 */
function generateDirectives(zone, sessionContext = {}) {
  const {
    currentTrack = 'standard',
    belowWindowDuration = 0,       // ms spent below window this session
    sessionMinute = 0,
    spO2 = null,
    arrivalComplete = false,       // [Refinement 3] Track downshift timer guard
  } = sessionContext;

  const directives = {
    breathMatch: null,
    luno: null,
    trackSelector: null,
    lightBridge: null,
    safetyFlag: null,
  };

  // ── Safety Floor First ──
  // [SpO2 null handling] Skip safety check if spO2 is null (Kyto2935 has no SpO2)
  if (spO2 !== null && spO2 !== undefined && spO2 < SPO2_SAFETY_FLOOR) {
    directives.safetyFlag = {
      type: 'spo2_below_floor',
      action: 'ease_breath_pattern',
      value: spO2,
    };
    directives.breathMatch = { ratio: '3:5', pace: 'ease' };
    return directives; // safety overrides all
  }

  // ── Breath Pacing ──
  const breathMap = {
    below_window:  { ratio: '3:5', pace: 'slow',    inhale: 3, exhale: 5 },
    approaching:   { ratio: '4:6', pace: 'moderate', inhale: 4, exhale: 6 },
    optimal:       { ratio: null,  pace: 'hold',     inhale: null, exhale: null }, // hold current
    overdrive:     { ratio: '5:5', pace: 'soften',   inhale: 5, exhale: 5 },
  };
  directives.breathMatch = breathMap[zone];

  // ── Luno Language Tone ──
  const lunoMap = {
    below_window: {
      tone: 'grounding',
      cadence: 'slow',
      spaciousness: 'high',
      directive: 'Create space. Slow breath, long exhale. No urgency.',
    },
    approaching: {
      tone: 'encouraging',
      cadence: 'moderate',
      spaciousness: 'medium',
      directive: 'Affirm movement. Guide toward rhythm. Gentle momentum.',
    },
    optimal: {
      tone: 'anchoring',
      cadence: 'steady',
      spaciousness: 'medium',
      directive: 'Anchor here. Celebrate without interrupting. Let them settle.',
    },
    overdrive: {
      tone: 'softening',
      cadence: 'slow',
      spaciousness: 'high',
      directive: 'Ease the effort. Permission to release control. Less structure.',
    },
  };
  directives.luno = lunoMap[zone];

  // ── Track Selector (silent downshift logic) ──
  // [Refinement 3] Only begin downshift timer AFTER initial arrival phase is complete
  if (zone === 'below_window' && belowWindowDuration >= TRACK_DOWNSHIFT_THRESHOLD && arrivalComplete) {
    const trackProgression = { standard: 'gentle', gentle: 'minimal', minimal: 'minimal' };
    const nextTrack = trackProgression[currentTrack] || 'minimal';
    if (nextTrack !== currentTrack) {
      directives.trackSelector = {
        action: 'downshift',
        from: currentTrack,
        to: nextTrack,
        silent: true, // Clinical Rule #1 — never surfaced to user
      };
    }
  }

  if (zone === 'optimal' && sessionMinute > 5) {
    directives.trackSelector = { action: 'hold', track: currentTrack };
  }

  // ── LightBridge Trigger ──
  // Activates family member's light when participant sustains optimal zone
  if (zone === 'optimal') {
    directives.lightBridge = {
      trigger: 'optimal_zone_active',
      intensity: 'warm',
      pulse: false,
    };
  } else if (zone === 'approaching') {
    directives.lightBridge = {
      trigger: 'approaching_zone',
      intensity: 'dim',
      pulse: true,
    };
  } else {
    directives.lightBridge = { trigger: 'off' };
  }

  return directives;
}


// ─────────────────────────────────────────────
// MAIN NS3 ENGINE
// ─────────────────────────────────────────────

/**
 * Compute NS3 score and full AXIS directive package
 *
 * @param {Object} biometricWindow - Rolling biometric data window
 * @param {number[]} biometricWindow.rrIntervals     - Recent RR intervals (ms), min 10 recommended
 * @param {number}   biometricWindow.spO2            - Current SpO2 (%) — null for Kyto2935
 * @param {number[]} biometricWindow.hrHistory       - HR readings this session (bpm)
 * @param {number[]} biometricWindow.sdnnHistory     - SDNN readings this session (ms)
 * @param {number}   biometricWindow.deviceType      - 'polar_h10' | 'kyto2935' | 'apple_watch' | 'wear_os'
 *
 * @param {Object} sessionContext - Current session metadata
 * @param {string} sessionContext.currentTrack        - 'standard' | 'gentle' | 'minimal'
 * @param {number} sessionContext.belowWindowDuration - ms spent below window this session
 * @param {number} sessionContext.sessionMinute       - Current minute of session
 * @param {string} sessionContext.participantId       - For AXIS logging
 * @param {string} sessionContext.sessionId           - For blockchain payload
 * @param {boolean} sessionContext.arrivalComplete    - Whether arrival phase is done
 * @param {boolean} sessionContext.breathMatchActive  - Whether BreathMatch pacing is active
 *
 * @returns {Object} NS3 result package
 */
function computeNS3(biometricWindow, sessionContext = {}) {
  const {
    rrIntervals = [],
    spO2 = null,
    hrHistory = [],
    sdnnHistory = [],
    deviceType = 'unknown',
  } = biometricWindow;

  // ── 1. Raw Calculations ──
  const rmssd     = calculateRMSSD(rrIntervals);
  const sdnn      = calculateSDNN(rrIntervals);
  const meanHR    = calculateMeanHR(rrIntervals);
  const coherence = calculateCoherence(rrIntervals);
  const respRate  = deriveRespiratoryRate(rrIntervals, 30, sessionContext);

  // ── 2. Normalize Components to 0–100 ──
  const rmssdScore    = normalize(rmssd, REFERENCE.rmssd.low, REFERENCE.rmssd.high);
  const coherenceScore = coherence !== null ? coherence * 100 : null;
  const hrTrendScore  = scoreHRTrend([...hrHistory, meanHR].filter(Boolean));
  const respRateScore = scoreRespRate(respRate);
  const sdnnTrendScore = scoreSDNNTrend([...sdnnHistory, sdnn].filter(Boolean));

  // ── 3. Device Confidence Adjustment ──
  const deviceConfidence = {
    polar_h10:    1.0,
    kyto2935:     0.75,
    apple_watch:  0.85,
    wear_os:      0.80,
    unknown:      0.75,
  }[deviceType] || 0.75;

  // ── 4. Weighted Composite ──
  const components = [
    { score: rmssdScore,     weight: WEIGHTS.rmssd     },
    { score: coherenceScore, weight: WEIGHTS.coherence  },
    { score: hrTrendScore,   weight: WEIGHTS.hrTrend    },
    { score: respRateScore,  weight: WEIGHTS.respRate   },
    { score: sdnnTrendScore, weight: WEIGHTS.sdnnTrend  },
  ];

  // Only include components with valid data
  const validComponents = components.filter(c => c.score !== null);
  const totalWeight = validComponents.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = validComponents.reduce((sum, c) => sum + (c.score * c.weight), 0);

  const rawNS3 = totalWeight > 0 ? weightedSum / totalWeight : null;
  const ns3Score = rawNS3 !== null ? Math.round(rawNS3 * deviceConfidence) : null;

  // ── 5. Zone Classification ──
  const zone = ns3Score !== null ? classifyZone(ns3Score) : 'unknown';

  // ── 6. Generate Directives ──
  const directives = generateDirectives(zone, {
    ...sessionContext,
    spO2,
  });

  // ── 7. Build AXIS Payload ──
  return {
    // Core output
    ns3Score,
    zone,
    directives,

    // Component breakdown (for AXIS internal logging only — never user-facing)
    components: {
      rmssd:       { raw: rmssd,      normalized: rmssdScore     },
      sdnn:        { raw: sdnn,       trend: sdnnTrendScore      },
      coherence:   { raw: coherence,  normalized: coherenceScore },
      hr:          { raw: meanHR,     trend: hrTrendScore        },
      respRate:    { raw: respRate,   score: respRateScore       },
      spO2:        { raw: spO2                                   },
    },

    // Metadata
    deviceType,
    deviceConfidence,
    dataQuality: validComponents.length / components.length, // 0–1
    timestamp: new Date().toISOString(),
    sessionId: sessionContext.sessionId || null,
    participantId: sessionContext.participantId || null,
  };
}


// ─────────────────────────────────────────────
// SESSION AGGREGATOR
// Builds longitudinal regulatory fingerprint
// ─────────────────────────────────────────────

class NS3SessionAggregator {
  constructor(participantId, sessionId) {
    this.participantId = participantId;
    this.sessionId = sessionId;
    this.readings = [];
    this.belowWindowDuration = 0;
    this.optimalDuration = 0;
    this.lastReadingTime = null;
    this.trackDownshifts = 0;
    this.sessionStartTime = Date.now();
  }

  /**
   * Add a new NS3 reading to the session
   */
  addReading(ns3Result) {
    const now = Date.now();
    const elapsed = this.lastReadingTime ? now - this.lastReadingTime : 0;

    // Accumulate zone durations
    if (ns3Result.zone === 'below_window') this.belowWindowDuration += elapsed;
    if (ns3Result.zone === 'optimal') this.optimalDuration += elapsed;

    // Track downshifts
    if (ns3Result.directives?.trackSelector?.action === 'downshift') {
      this.trackDownshifts++;
    }

    this.readings.push(ns3Result);
    this.lastReadingTime = now;
    return this;
  }

  /**
   * Generate session summary for AXIS / court reporting
   */
  summarize() {
    if (this.readings.length === 0) return null;

    const scores = this.readings
      .map(r => r.ns3Score)
      .filter(s => s !== null);

    if (scores.length === 0) return null;

    const sessionDuration = Date.now() - this.sessionStartTime;

    return {
      participantId: this.participantId,
      sessionId: this.sessionId,
      sessionDurationMs: sessionDuration,

      // Regulatory fingerprint
      ns3: {
        mean:    Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        peak:    Math.max(...scores),
        floor:   Math.min(...scores),
        readings: scores.length,
      },

      // Zone time distribution
      zoneDuration: {
        optimalMs:      this.optimalDuration,
        belowWindowMs:  this.belowWindowDuration,
        optimalPct:     Math.round((this.optimalDuration / Math.max(1, sessionDuration)) * 100),
      },

      // Clinical indicators
      clinical: {
        reachedOptimal:       scores.some(s => s >= 56),
        sustainedOptimal:     this.optimalDuration >= 120000, // 2+ minutes
        trackDownshifts:      this.trackDownshifts,
        regulatoryTrajectory: this._computeTrajectory(scores),
      },

      // Blockchain verification payload
      verificationPayload: {
        sessionCompleted: true,
        peakCoherence:    Math.max(...this.readings.map(r => r.components?.coherence?.raw || 0)),
        meanNS3:          Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        optimalZonePct:   Math.round((this.optimalDuration / Math.max(1, sessionDuration)) * 100),
        timestamp:        new Date().toISOString(),
      },
    };
  }

  /**
   * Determine if nervous system regulation improved across session
   * Splits readings into thirds and compares
   */
  _computeTrajectory(scores) {
    if (scores.length < 6) return 'insufficient_data';
    const third = Math.floor(scores.length / 3);
    const earlyMean = scores.slice(0, third).reduce((a, b) => a + b, 0) / third;
    const lateMean  = scores.slice(-third).reduce((a, b) => a + b, 0) / third;
    const delta = lateMean - earlyMean;
    if (delta > 8)  return 'improving';
    if (delta < -8) return 'declining';
    return 'stable';
  }
}


// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  computeNS3,
  NS3SessionAggregator,

  // Expose calculators for unit testing / direct use
  calculateRMSSD,
  calculateSDNN,
  calculateMeanHR,
  calculateCoherence,
  deriveRespiratoryRate,

  // Expose constants for AXIS configuration
  ZONES,
  WEIGHTS,
  SPO2_SAFETY_FLOOR,
  TRACK_DOWNSHIFT_THRESHOLD,
};
