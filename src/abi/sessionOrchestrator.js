// ============================================================
// ASCEN ABI Session Flow Orchestrator — FULLY WIRED
// File: src/abi/sessionOrchestrator.js
//
// The single integration point between the session engine and
// the entire ABI system. ALL 14 systems connected.
//
// Session Engine only needs to know:
//   1. orchestrator.onSessionStart(userId, sessionId)
//   2. orchestrator.onArrivalComplete(biometrics)
//   3. orchestrator.onBreathingTick(biometrics)     — every second
//   4. orchestrator.onPauseTap()                    — user taps screen
//   5. orchestrator.onResumeTap()                   — user taps to resume
//   6. orchestrator.onExitTap()                     — user exits from extended pause
//   7. orchestrator.onSessionComplete(rawMetrics)
//
// Everything else — detection, adaptation, pauses, affirmations,
// coaching, state tracking, immune, homeostatic, identity,
// biometric resilience, drills, trends — is internal.
//
// v2.0 — Phase 1 Rewire: 14/14 systems connected
// ============================================================

const { Pool } = require('pg');

// ── CONNECTED SYSTEMS (original 4) ─────────────────────────
const { adaptBreathProtocol, adaptFRBreathProtocol, resolveArc } = require('./breathProtocolAdapter');
const { PauseHandler, PAUSE_STATE } = require('./pauseHandler');
const {
  checkProvisionalTrack,
  applyGraduationBridge,
  weightCoherenceForAdvancement,
  checkGapAndStepBack,
  checkPanicSignals,
  getBiometricFallback,
  checkSpiralGate
} = require('./sessionSafetyGuards');
const { getAffirmation, getSessionAffirmations } = require('./microAffirmations');

// ── NEWLY WIRED SYSTEMS (10) ───────────────────────────────
const { StateEngine, STATES, RESPONSE_LEVEL } = require('./stateEngine');
const { CoachingEngine } = require('./coachingEngine');
const { LunoIntelligence, generateContextPacket } = require('./lunoIntelligence');
const { ImmuneSystem } = require('./immuneSystem');
const { HomeostaticRegulator } = require('./homeostaticRegulator');
const { BiometricResilience } = require('./biometricResilience');
const { IdentityGate, CompanionshipMode } = require('./identityEngagement');
const { BaselineFilter } = require('./baselineFilter');
const { adaptDrill, filterDrillRecommendation, getAllDrillsForUser } = require('./drillAdapter');
const { analyzeTrends, shouldRunTrendAnalysis } = require('./trendAnalyzer');
const { AxisEngine } = require('../axis/axisEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── ORCHESTRATOR FACTORY ─────────────────────────────────────

/**
 * Creates an ABI orchestrator for a single session.
 * One orchestrator per session instance.
 *
 * @param {Object} callbacks - Session engine callbacks:
 *   onLunoSpeak(text)         — display Luno dialogue
 *   onPacerUpdate(config)     — update breath pacer (ratio, active, etc.)
 *   onPacerPause()            — freeze the pacer
 *   onPacerResume()           — unfreeze the pacer
 *   onSessionEnd(result)      — session complete or aborted
 *   onMirrorData(data)        — data for mirror screen
 *   onOfferExit()             — show honorable exit option
 *   onOfferDrill(drillOptions)— show drill selection (NEW)
 *   onIdentityChallenge(cfg)  — show identity gate UI (NEW)
 *   onStateChange(state)      — state engine update for frontend (NEW)
 * @returns {Object} - Orchestrator with lifecycle methods
 */
function createOrchestrator(callbacks = {}) {
  const {
    onLunoSpeak = () => {},
    onPacerUpdate = () => {},
    onPacerPause = () => {},
    onPacerResume = () => {},
    onSessionEnd = () => {},
    onMirrorData = () => {},
    onOfferExit = () => {},
    onOfferDrill = () => {},
    onIdentityChallenge = () => {},
    onStateChange = () => {}
  } = callbacks;

  // ── INTERNAL STATE ──────────────────────────────────────
  let userId = null;
  let sessionId = null;
  let rawSession = null;
  let adaptedSession = null;
  let user = null;
  let pauseHandler = null;
  let panicState = { panic_seconds: 0 };
  let liveDetectFired = false;
  let breathingStartTime = null;
  let biometricsAvailable = false;
  let arrivalBaseline = null;
  let sessionPhase = 'init';

  // ── NEW SYSTEM INSTANCES ────────────────────────────────
  let stateEngine = null;
  let coachingEngine = null;
  let lunoIntelligence = null;
  let immuneSystem = null;
  let homeostaticRegulator = null;
  let biometricResilience = null;
  let identityGate = null;
  let companionshipMode = null;
  let baselineFilter = null;

  // ── COMPANIONSHIP MODE FLAG ─────────────────────────────
  let isCompanionshipMode = false;

  // ═══════════════════════════════════════════════════════════
  // 1. SESSION START
  // ═══════════════════════════════════════════════════════════

  async function onSessionStart(_userId, _sessionId, options = {}) {
    userId = _userId;
    sessionId = _sessionId;
    sessionPhase = 'pre_session';

    // ── LOAD USER ───────────────────────────────────────
    const userResult = await pool.query(
      `SELECT * FROM users WHERE user_id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }
    user = userResult.rows[0];

    // ── LOAD SESSION ────────────────────────────────────
    const sessResult = await pool.query(
      `SELECT * FROM session_templates WHERE session_id = $1`,
      [sessionId]
    );
    if (sessResult.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }
    rawSession = sessResult.rows[0];

    // ── [NEW] IDENTITY GATE ─────────────────────────────
    // Verify user identity on shared devices before Arrival
    // baseline collection begins.
    identityGate = new IdentityGate({
      verification_method: options.verification_method || 'pin',
      facility_mode: options.facility_mode || false
    });

    if (options.facility_mode && !options.identity_verified) {
      // Return identity challenge — session engine must call
      // onSessionStart again with identity_verified: true
      return {
        identity_challenge: true,
        challenge_config: identityGate.getChallenge(),
        session: null,
        pacer_active: false
      };
    }

    // ── [NEW] HOMEOSTATIC REGULATOR — PRE-SESSION CHECK ─
    // Dosage limit, recovery insert, emotional load
    homeostaticRegulator = new HomeostaticRegulator(userId, pool);
    let homeostaticResult = { allowed: true };
    try {
      homeostaticResult = await homeostaticRegulator.preSessionCheck();
    } catch (err) {
      console.error('Homeostatic pre-check failed (non-blocking):', err.message);
    }

    if (homeostaticResult.allowed === false) {
      return {
        session_blocked: true,
        block_reason: homeostaticResult.reason,
        suggestion: homeostaticResult.suggestion || null,
        luno_message: homeostaticResult.luno_message || 'Your body is asking for rest today. That wisdom is strength.',
        pacer_active: false
      };
    }

    // ── [NEW] IMMUNE SYSTEM — BARRIER CHECK ─────────────
    // Verify no safety mode is active
    immuneSystem = new ImmuneSystem(userId, pool);
    let immuneBarrier = { blocked: false };
    try {
      immuneBarrier = immuneSystem.checkBarriers('start_session');
    } catch (err) {
      console.error('Immune barrier check failed (non-blocking):', err.message);
    }

    if (immuneBarrier.blocked) {
      return {
        session_blocked: true,
        block_reason: immuneBarrier.reason,
        safety_mode: true,
        luno_message: immuneBarrier.luno_message || 'A clinician needs to check in with you before your next session.',
        pacer_active: false
      };
    }

    // ── [NEW] COMPANIONSHIP MODE CHECK ──────────────────
    // For court-mandated users who won't engage. Luno waits.
    // Session counts for compliance. No coaching pressure.
    try {
      const recentForCompanionship = await pool.query(
        `SELECT cycle_completion_rate FROM session_completions
         WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 5`,
        [userId]
      );
      const compCheck = CompanionshipMode.shouldActivate(recentForCompanionship.rows);
      if (compCheck.should_activate) {
        companionshipMode = new CompanionshipMode();
        companionshipMode.activate();
        isCompanionshipMode = true;
      }
    } catch (err) {
      // Non-blocking — companionship mode is optional
    }

    // ── CHECK GAP ───────────────────────────────────────
    const gapCheck = await checkGapAndStepBack(userId);
    let gapLunoMessage = null;

    if (gapCheck.gap_detected) {
      gapLunoMessage = gapCheck.luno_message;
    }

    // ── CHECK NO-BIOMETRIC FALLBACK ─────────────────────
    if (!user.breath_track || user.breath_track === 'standard') {
      if (!user.breath_track_source) {
        const fallback = getBiometricFallback(user);
        if (fallback.fallback_track && fallback.fallback_track !== 'standard') {
          user.breath_track = fallback.fallback_track;
          user._fallback_applied = true;
        }
      }
    }

    // ── APPLY GRADUATION BRIDGE ─────────────────────────
    const bridge = applyGraduationBridge(rawSession, user);

    // ── ADAPT SESSION ───────────────────────────────────
    const isFR = sessionId.startsWith('FR');
    adaptedSession = isFR
      ? adaptFRBreathProtocol(rawSession, user, false)
      : adaptBreathProtocol(rawSession, user);

    // Apply bridge overrides if applicable
    if (bridge) {
      adaptedSession.breath_in = bridge.breath_in;
      adaptedSession.breath_out = bridge.breath_out;
      adaptedSession.breath_hold = bridge.breath_hold;
      adaptedSession.breath_ratio = bridge.breath_ratio;
      adaptedSession._bridge_active = true;
      adaptedSession._bridge_note = bridge._bridge_note;
    }

    // ── SPIRAL GATE CHECK ───────────────────────────────
    const spiralGate = checkSpiralGate(user, rawSession.session_number || 0);
    if (spiralGate.gated) {
      return {
        session: adaptedSession,
        spiral_gated: true,
        spiral_gate_message: spiralGate.luno_message,
        hold_at_session: spiralGate.hold_at_session,
        repeat_arc: spiralGate.repeat_arc,
        repeat_range: spiralGate.repeat_range,
        track: user.breath_track,
        pacer_active: false,
        breathwork_mode: null
      };
    }

    // Apply homeostatic recovery overrides if suggested
    if (homeostaticResult.suggestion) {
      const sug = homeostaticResult.suggestion;
      if (sug.reduce_duration) {
        adaptedSession.duration_seconds = Math.round(
          (adaptedSession.duration_seconds || 720) * (sug.duration_factor || 0.75)
        );
      }
      if (sug.recovery_session_id) {
        adaptedSession._recovery_override = sug.recovery_session_id;
        adaptedSession._recovery_note = sug.luno_message;
      }
    }

    // ── INITIALIZE PAUSE HANDLER ────────────────────────
    pauseHandler = new PauseHandler({
      duration_seconds: adaptedSession.duration_seconds || 720,
      baselineHR: 72,
      baselineRR: 16,
      onPause: (data) => {
        onPacerPause();
        // Notify state engine of pause
        if (stateEngine) stateEngine.currentState = STATES.PAUSED;
        if (data.type === 'extended' && data.offer_exit) {
          onOfferExit();
        }
      },
      onResume: (data) => {
        onPacerResume();
        if (data.luno_text) {
          onLunoSpeak(data.luno_text);
        }
      },
      onExit: (data) => {
        onSessionEnd({
          completed: true,
          exit_type: 'honorable_exit',
          ...data
        });
      },
      onLunoSpeak: (text) => {
        onLunoSpeak(text);
      }
    });

    // ── [NEW] INITIALIZE STATE ENGINE ───────────────────
    stateEngine = new StateEngine({
      baselineHR: 72,
      baselineHRV: 30,
      baselineRR: 16,
      track: user.breath_track || 'standard',
      sessionNumber: rawSession.session_number || 1
    });

    // ── [NEW] INITIALIZE LUNO INTELLIGENCE ──────────────
    let userContext = {};
    try {
      userContext = await generateContextPacket(userId, pool);
    } catch (err) {
      console.error('Luno context packet failed (non-blocking):', err.message);
    }

    lunoIntelligence = new LunoIntelligence(userContext, stateEngine, {
      sessionNumber: rawSession.session_number || 1,
      isFR,
      track: user.breath_track || 'standard',
      arc: adaptedSession._arc || null
    });

    // Load offline context packet for this session
    try {
      lunoIntelligence.loadSessionFromPacket(rawSession.session_number || 1);
    } catch (err) {
      // Non-blocking — Luno falls back to generic dialogue
    }

    // ── [NEW] INITIALIZE COACHING ENGINE ────────────────
    coachingEngine = new CoachingEngine(stateEngine, lunoIntelligence, {
      sessionNumber: rawSession.session_number || 1,
      isFR,
      track: user.breath_track || 'standard',
      arc: adaptedSession._arc || null,
      companionship_mode: isCompanionshipMode  // suppress coaching when active
    });

    // ── [NEW] PREDICTIVE PRE-FRAME ──────────────────────
    // Pre-frame high-difficulty sessions during Arrival
    let preFrameMessage = null;
    try {
      const preFrame = coachingEngine.getPredictivePreFrame();
      if (preFrame && preFrame.message) {
        preFrameMessage = preFrame.message;
      }
    } catch (err) {
      // Non-blocking
    }

    // ── [NEW] INITIALIZE BIOMETRIC RESILIENCE ───────────
    biometricResilience = new BiometricResilience({
      track: user.breath_track || 'standard',
      sessionNumber: rawSession.session_number || 1,
      hasPolar: options.has_polar || false,
      hasCamera: options.has_camera || false,
      onModeChange: (modeData) => {
        // Notify frontend of detection mode change
        onStateChange({
          type: 'biometric_mode_change',
          ...modeData
        });
      },
      onLunoSpeak: (text) => {
        onLunoSpeak(text);
      }
    });
    biometricResilience.startSession();

    // ── [NEW] INITIALIZE BASELINE FILTER ────────────────
    baselineFilter = new BaselineFilter({
      track: user.breath_track || 'standard'
    });

    sessionPhase = 'arrival';

    // Return initial session config for the engine
    return {
      session: adaptedSession,
      gap_detected: gapCheck.gap_detected,
      gap_luno_message: gapLunoMessage,
      pre_frame_message: preFrameMessage,
      homeostatic_note: homeostaticResult.luno_message || null,
      pacer_active: adaptedSession._pacer_active !== false,
      breathwork_mode: adaptedSession._breathwork_mode || 'simple_pacer',
      mode: adaptedSession._mode || adaptedSession._breathwork_mode || 'simple_pacer',
      breath_ratio: adaptedSession.breath_ratio,
      breath_in: adaptedSession.breath_in,
      breath_out: adaptedSession.breath_out,
      breath_hold: adaptedSession.breath_hold,
      pursed_lip: adaptedSession._pursed_lip || false,
      luno_inhale_cue: adaptedSession._luno_inhale_cue || null,
      luno_exhale_cue: adaptedSession._luno_exhale_cue || null,
      luno_mid_cue: adaptedSession._luno_mid_cue || null,
      luno_pursed_lip_cue: adaptedSession._luno_pursed_lip_cue || null,
      suppress_coherence_display: adaptedSession._suppress_coherence_display || false,
      suppress_biometric_mirror: adaptedSession._suppress_biometric_mirror || false,
      track: adaptedSession._track,
      bridge_active: adaptedSession._bridge_active || false,
      spiral_gated: false,
      arc: adaptedSession._arc || null,
      arc_name: adaptedSession._arc_name || null,
      arc_phase: adaptedSession._arc_phase || null,
      visual_palette: adaptedSession._visual_palette || null,
      pendulation: adaptedSession._pendulation || null,
      exhale_instruction: adaptedSession._exhale_instruction || null,
      touch_phase: adaptedSession._touch_phase || null,
      return_phase: adaptedSession._return_phase || null,
      ratio_options: adaptedSession._ratio_options || null,
      // New fields from wired systems
      detection_mode: biometricResilience.getDetectionMode(),
      identity_challenge: false,
      session_blocked: false,
      companionship_mode: isCompanionshipMode
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 2. ARRIVAL COMPLETE
  // ═══════════════════════════════════════════════════════════

  async function onArrivalComplete(biometrics) {
    sessionPhase = 'breathing';

    const { resting_hr, resting_hrv, respiratory_rate } = biometrics || {};

    // Determine if biometrics are available
    const measuredCount = [resting_hr, resting_hrv, respiratory_rate]
      .filter(v => v !== null && v !== undefined).length;
    biometricsAvailable = measuredCount >= 2;

    arrivalBaseline = { resting_hr, resting_hrv, respiratory_rate };

    // Update pause handler with actual baseline
    if (resting_hr) pauseHandler.baselineHR = resting_hr;
    if (respiratory_rate) pauseHandler.baselineRR = respiratory_rate;

    // ── [NEW] BASELINE FILTER ───────────────────────────
    // Use filtered baseline instead of raw if available.
    // The baselineFilter has been collecting samples during
    // the Arrival phase via addSample() calls from the
    // session engine (or we process the aggregate here).
    let cleanBaseline = arrivalBaseline;
    if (baselineFilter && biometricsAvailable) {
      try {
        const filtered = baselineFilter.getCleanBaseline();
        if (filtered && filtered.valid) {
          cleanBaseline = {
            resting_hr: filtered.resting_hr || resting_hr,
            resting_hrv: filtered.resting_hrv || resting_hrv,
            respiratory_rate: filtered.respiratory_rate || respiratory_rate
          };
        }
      } catch (err) {
        console.error('Baseline filter failed (using raw):', err.message);
      }
    }

    // ── [NEW] STATE ENGINE — SET BASELINE ───────────────
    if (stateEngine) {
      stateEngine.setBaseline(cleanBaseline);
    }

    // ── SILENT DETECTION ────────────────────────────────
    let detectionResult = { auto_assigned: false };

    if (biometricsAvailable && user.breath_track_provisional !== false) {
      const indicators = {
        elevated_hr: cleanBaseline.resting_hr > 90,
        low_hrv: cleanBaseline.resting_hrv !== null && cleanBaseline.resting_hrv !== undefined && cleanBaseline.resting_hrv < 20,
        rapid_breathing: cleanBaseline.respiratory_rate > 20
      };
      const flagCount = Object.values(indicators).filter(Boolean).length;

      if (flagCount >= 2) {
        const newTrack = flagCount >= 3 ? 'minimal' : 'gentle';

        if (!user.breath_track || user.breath_track === 'standard' || user._fallback_applied) {
          await pool.query(
            `UPDATE users SET
               breath_track = $1,
               breath_track_set_at = NOW(),
               breath_track_source = 'arrival_detection',
               breath_track_detection_session = $2,
               breath_track_provisional = TRUE,
               breath_track_first_hr = $3,
               breath_track_first_hrv = $4,
               breath_track_first_rr = $5,
               capacity_track = CASE
                 WHEN total_sessions_completed = 0 THEN TRUE
                 ELSE capacity_track
               END,
               updated_at = NOW()
             WHERE user_id = $6
               AND (breath_track IS NULL OR breath_track = 'standard')
               AND (breath_track_source IS NULL OR breath_track_source = 'no_biometric_fallback')`,
            [newTrack, rawSession.session_number || 1, cleanBaseline.resting_hr, cleanBaseline.resting_hrv, cleanBaseline.respiratory_rate, userId]
          );

          user.breath_track = newTrack;
          detectionResult = {
            auto_assigned: true,
            track: newTrack,
            indicators,
            flagCount
          };

          // RE-ADAPT the session with the new track
          const isFR = sessionId.startsWith('FR');
          adaptedSession = isFR
            ? adaptFRBreathProtocol(rawSession, user, false)
            : adaptBreathProtocol(rawSession, user);

          const bridge = applyGraduationBridge(rawSession, user);
          if (bridge) {
            Object.assign(adaptedSession, bridge);
          }

          // Update state engine track
          if (stateEngine) stateEngine.track = newTrack;
        }
      }
    }

    // ── PROVISIONAL TRACK CHECK (sessions 2-3) ──────────
    if (biometricsAvailable && user.breath_track_provisional === true &&
        user.breath_track_source === 'arrival_detection') {
      const provisionalResult = await checkProvisionalTrack(userId, cleanBaseline);
      if (provisionalResult.action === 'upgraded') {
        user.breath_track = provisionalResult.new_track;
        const isFR = sessionId.startsWith('FR');
        adaptedSession = isFR
          ? adaptFRBreathProtocol(rawSession, user, false)
          : adaptBreathProtocol(rawSession, user);
        if (stateEngine) stateEngine.track = provisionalResult.new_track;
      }
    }

    // ── [NEW] LUNO — ARRIVAL DIALOGUE ───────────────────
    let arrivalDialogue = null;
    if (lunoIntelligence) {
      try {
        arrivalDialogue = await lunoIntelligence.getPhaseDialogue('arrival');
      } catch (err) {
        // Non-blocking — arrival dialogue is optional
      }
    }

    breathingStartTime = Date.now();

    // Return updated session config
    return {
      detection: detectionResult,
      biometrics_available: biometricsAvailable,
      baseline_filtered: cleanBaseline !== arrivalBaseline,
      arrival_dialogue: arrivalDialogue,
      session_update: detectionResult.auto_assigned ? {
        pacer_active: adaptedSession._pacer_active !== false,
        mode: adaptedSession._mode || 'simple_pacer',
        breath_ratio: adaptedSession.breath_ratio,
        breath_in: adaptedSession.breath_in,
        breath_out: adaptedSession.breath_out,
        breath_hold: adaptedSession.breath_hold,
        pursed_lip: adaptedSession._pursed_lip || false,
        luno_inhale_cue: adaptedSession._luno_inhale_cue || null,
        luno_exhale_cue: adaptedSession._luno_exhale_cue || null,
        suppress_coherence_display: adaptedSession._suppress_coherence_display || false,
        track: adaptedSession._track
      } : null
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 3. BREATHING TICK (every second during Breathing phase)
  // ═══════════════════════════════════════════════════════════

  function onBreathingTick(biometrics) {
    if (sessionPhase !== 'breathing') return { action: 'none' };

    const elapsed = breathingStartTime ? Math.floor((Date.now() - breathingStartTime) / 1000) : 0;
    const result = { action: 'none', elapsed };

    // ── [NEW] BIOMETRIC RESILIENCE — UPDATE ─────────────
    // Feed biometrics to resilience layer (handles BLE dropout)
    if (biometricResilience) {
      try {
        biometricResilience.onBiometricUpdate(biometrics);
      } catch (err) {
        // Non-blocking
      }
    }

    // ── PAUSE AUTO-DETECTION ────────────────────────────
    if (pauseHandler && pauseHandler.state === PAUSE_STATE.ACTIVE) {
      pauseHandler.checkForInterrupt(biometrics);
      if (pauseHandler.state !== PAUSE_STATE.ACTIVE) {
        result.action = 'paused';
        result.pause_type = pauseHandler.state;
        return result;
      }
    }

    // ── PANIC DETECTION ─────────────────────────────────
    if (biometrics.current_hr && biometrics.current_rr) {
      const panicCheck = checkPanicSignals(biometrics, panicState);
      panicState = panicCheck.state;

      if (panicCheck.panic_detected) {
        sessionPhase = 'close';
        onLunoSpeak(panicCheck.luno_message);
        onPacerPause();

        result.action = 'panic_abort';
        result.luno_message = panicCheck.luno_message;
        result.session_flags = panicCheck.session_flags;
        return result;
      }
    }

    // ── [NEW] STATE ENGINE — TICK ───────────────────────
    // Continuous autonomic state classification every second
    let stateResult = null;
    if (stateEngine) {
      try {
        stateResult = stateEngine.tick(biometrics);
        const currentState = stateEngine.currentState;
        const response = stateResult;

        // Notify frontend of state changes
        onStateChange({
          type: 'state_tick',
          state: currentState,
          secondsInState: stateEngine.secondsInState,
          responseLevel: stateEngine.currentResponseLevel,
          adjustments: stateEngine.activeAdjustments
        });

        // ── Apply graduated adjustments to pacer ────────
        if (stateEngine.activeAdjustments) {
          const adj = stateEngine.activeAdjustments;
          if (adj.exhale_extend_sec > 0 || adj.pacer_slow_pct > 0 || adj.visual_warmth > 0) {
            result.pacer_adjustments = {
              exhale_extend_sec: adj.exhale_extend_sec,
              pacer_slow_pct: adj.pacer_slow_pct,
              visual_warmth: adj.visual_warmth,
              luno_pulse: adj.luno_pulse
            };
          }
          if (adj.haptic_pending) {
            result.haptic = 'single_tap';
            stateEngine.activeAdjustments.haptic_pending = false;
          }
        }
      } catch (err) {
        console.error('State engine tick failed (non-blocking):', err.message);
      }
    }

    // ── [NEW] COACHING ENGINE — EVALUATE ────────────────
    // Ambient coaching + intervention triggers, every second
    if (coachingEngine) {
      try {
        const coachAction = coachingEngine.evaluate({
          elapsed,
          biometrics,
          isPaused: pauseHandler ? pauseHandler.state !== PAUSE_STATE.ACTIVE : false,
          isPostExhale: biometrics.is_post_exhale || false
        });

        if (coachAction && coachAction.action !== 'none') {
          switch (coachAction.action) {
            case 'ambient_line':
              // Micro-line delivered during breath pause
              onLunoSpeak(coachAction.text);
              result.coaching = { type: 'ambient', text: coachAction.text };
              break;

            case 'intervention':
              // Pause the session and offer choices
              onPacerPause();
              if (stateEngine) stateEngine.currentState = STATES.PAUSED;
              onLunoSpeak(coachAction.luno_text);

              // Build drill options if coaching recommends a drill
              let drillOptions = null;
              if (coachAction.suggest_drill) {
                try {
                  drillOptions = getAllDrillsForUser(user);
                } catch (err) {
                  // Non-blocking
                }
              }

              onOfferDrill({
                luno_text: coachAction.luno_text,
                options: ['continue', 'drill', 'end'],
                drill_recommendations: drillOptions,
                coaching_context: coachAction.context || null
              });

              result.action = 'coaching_intervention';
              result.coaching = {
                type: 'intervention',
                text: coachAction.luno_text,
                options: ['continue', 'drill', 'end'],
                drills: drillOptions
              };
              return result;

            case 'luno_speaks':
              // Re-engagement line (not a full intervention)
              onLunoSpeak(coachAction.text);
              result.coaching = { type: 're_engage', text: coachAction.text };
              break;
          }
        }
      } catch (err) {
        console.error('Coaching engine evaluate failed (non-blocking):', err.message);
      }
    }

    // ── [NEW] BIOMETRIC RESILIENCE — BLE DISCONNECT ─────
    // If BLE disconnected mid-session, biometricResilience handles
    // the mode transition internally. We just check if the detection
    // mode changed and notify the frontend.
    if (biometricResilience) {
      const currentMode = biometricResilience.getDetectionMode();
      if (result.detection_mode !== currentMode) {
        result.detection_mode = currentMode;
      }
    }

    // ── LIVE DETECTION (90-second check) ────────────────
    if (!liveDetectFired && elapsed >= 90 && biometrics.coherence_score !== undefined) {
      liveDetectFired = true;

      const shouldAdjust =
        biometrics.coherence_score < 0.30 &&
        (biometrics.cycle_completion_rate || 1) < 0.60;

      if (shouldAdjust) {
        const currentTrack = user.breath_track || 'standard';
        let newTrack;

        if (currentTrack === 'standard' || !currentTrack) {
          newTrack = 'gentle';
        } else if (currentTrack === 'gentle') {
          newTrack = 'minimal';
        }

        if (newTrack) {
          user.breath_track = newTrack;

          const isFR = sessionId.startsWith('FR');
          adaptedSession = isFR
            ? adaptFRBreathProtocol(rawSession, user, false)
            : adaptBreathProtocol(rawSession, user);

          const transitionText = "Let\u2019s slow this down just a little. Your body will find its rhythm.";
          onLunoSpeak(transitionText);

          // Update state engine track
          if (stateEngine) stateEngine.track = newTrack;

          pool.query(
            `UPDATE users SET
               breath_track = $1,
               breath_track_source = COALESCE(breath_track_source, '') || '+live_detection',
               updated_at = NOW()
             WHERE user_id = $2`,
            [newTrack, userId]
          ).catch(err => console.error('Live detect DB update failed:', err.message));

          result.action = 'live_adjust';
          result.old_track = currentTrack;
          result.new_track = newTrack;
          result.session_update = {
            pacer_active: adaptedSession._pacer_active !== false,
            mode: adaptedSession._mode || 'simple_pacer',
            breath_ratio: adaptedSession.breath_ratio,
            breath_in: adaptedSession.breath_in,
            breath_out: adaptedSession.breath_out,
            pursed_lip: adaptedSession._pursed_lip || false,
            luno_inhale_cue: adaptedSession._luno_inhale_cue || null,
            luno_exhale_cue: adaptedSession._luno_exhale_cue || null
          };

          onPacerUpdate(result.session_update);
          return result;
        }
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // 3b. [NEW] DRILL SELECTION (coaching engine triggered)
  // ═══════════════════════════════════════════════════════════

  function onDrillSelected(drillId) {
    if (!drillId) return { action: 'resume' };

    try {
      const drill = adaptDrill({ id: drillId }, user);
      return {
        action: 'start_drill',
        drill,
        post_drill_options: coachingEngine
          ? coachingEngine.getPostDrillOptions()
          : { options: ['return_to_session', 'end_session'] }
      };
    } catch (err) {
      console.error('Drill adaptation failed:', err.message);
      return { action: 'resume' };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 3c. [NEW] ARRIVAL SAMPLE (for baseline filter)
  // ═══════════════════════════════════════════════════════════

  function onArrivalSample(biometrics) {
    if (baselineFilter) {
      try {
        baselineFilter.addSample(biometrics);
      } catch (err) {
        // Non-blocking
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 3d. [NEW] BLE DISCONNECT / RECONNECT
  // ═══════════════════════════════════════════════════════════

  function onBLEDisconnect() {
    if (biometricResilience) {
      biometricResilience.onDisconnect();
    }
  }

  function onBLEReconnect() {
    if (biometricResilience) {
      biometricResilience.onReconnect();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. PAUSE CONTROLS
  // ═══════════════════════════════════════════════════════════

  function onPauseTap() {
    if (pauseHandler) pauseHandler.manualPause();
    // Track manual pause in biometric resilience (indicates self-awareness)
    if (biometricResilience) biometricResilience.onManualPause();
  }

  function onResumeTap() {
    if (pauseHandler) pauseHandler.resume();
  }

  function onExitTap() {
    if (pauseHandler) pauseHandler.exitSession();
  }

  // ═══════════════════════════════════════════════════════════
  // 5. SESSION COMPLETE
  // ═══════════════════════════════════════════════════════════

  async function onSessionComplete(rawMetrics) {
    sessionPhase = 'done';

    // End biometric resilience session
    let biometricAnnotation = null;
    if (biometricResilience) {
      try {
        biometricResilience.endSession();
        biometricAnnotation = biometricResilience.getSessionAnnotation();
      } catch (err) {
        // Non-blocking
      }
    }

    // ── CLEAN METRICS (exclude pause windows) ───────────
    const cleanMetrics = pauseHandler
      ? pauseHandler.getCleanMetrics(rawMetrics)
      : rawMetrics;

    // ── WEIGHT COHERENCE ────────────────────────────────
    const coherenceEnd = rawMetrics.coherence_end || rawMetrics.coherence_peak || 0;

    // ── SAVE SESSION COMPLETION ─────────────────────────
    try {
      await pool.query(
        `INSERT INTO session_completions (
           user_id, session_id, session_number, completed_at,
           coherence_score, coherence_end, cycle_completion_rate,
           duration_seconds, active_duration_seconds,
           pause_count, pause_seconds, panic_event, exit_type,
           breathwork_mode, breath_track_at_completion, arc_id
         ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          userId,
          sessionId,
          rawSession.session_number || 0,
          rawMetrics.coherence_peak || 0,
          coherenceEnd,
          cleanMetrics.adjusted_cycle_completion_rate || rawMetrics.cycle_completion_rate || 0,
          rawMetrics.total_duration_seconds || 0,
          cleanMetrics.active_duration_seconds || rawMetrics.total_duration_seconds || 0,
          cleanMetrics.total_pauses || 0,
          cleanMetrics.total_pause_seconds || 0,
          rawMetrics.panic_event || false,
          cleanMetrics.exit_type || 'normal',
          adaptedSession._breathwork_mode || 'simple_pacer',
          user.breath_track || 'standard',
          adaptedSession._arc || null
        ]
      );

      await pool.query(
        `UPDATE users SET
           total_sessions_completed = COALESCE(total_sessions_completed, 0) + 1,
           updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
    } catch (err) {
      console.error('Session completion save failed:', err.message);
    }

    // ── TRACK ADVANCEMENT CHECK ─────────────────────────
    let advancementResult = { action: 'none' };
    const sessCount = (user.total_sessions_completed || 0) + 1;

    if (sessCount % 5 === 0 && user.breath_track && user.breath_track !== 'standard') {
      try {
        const recentResult = await pool.query(
          `SELECT coherence_score, coherence_end, cycle_completion_rate
           FROM session_completions
           WHERE user_id = $1
           ORDER BY completed_at DESC LIMIT 5`,
          [userId]
        );

        const weighted = weightCoherenceForAdvancement(recentResult.rows, user.breath_track);

        if (weighted.ready) {
          const newTrack = user.breath_track === 'minimal' ? 'gentle' : 'standard';
          await pool.query(
            `UPDATE users SET
               breath_track = $1,
               breath_track_last_advanced_at = NOW(),
               updated_at = NOW()
             WHERE user_id = $2`,
            [newTrack, userId]
          );

          advancementResult = {
            action: 'advanced',
            old_track: user.breath_track,
            new_track: newTrack,
            luno_message: getAffirmation(user.breath_track, 'track_advanced', {
              from: user.breath_track, to: newTrack
            })
          };
        }
      } catch (err) {
        console.error('Advancement check failed:', err.message);
      }
    }

    // ── GAP RECOVERY DECREMENT ──────────────────────────
    if (user.gap_recovery_sessions_remaining > 0) {
      await pool.query(
        `UPDATE users SET
           gap_recovery_sessions_remaining = GREATEST(0, gap_recovery_sessions_remaining - 1),
           updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      ).catch(() => {});
    }

    // ── AFFIRMATIONS ────────────────────────────────────
    const affirmations = getSessionAffirmations(
      {
        track: user.breath_track,
        session_number: rawSession.session_number || 0,
        coherence_peak: rawMetrics.coherence_peak || 0,
        cycle_completion_rate: cleanMetrics.adjusted_cycle_completion_rate || 0,
        pause_count: cleanMetrics.total_pauses || 0
      },
      user
    );

    const primaryAffirmation = affirmations.length > 0 ? affirmations[0] : null;

    // ── [NEW] STATE ENGINE — SESSION SUMMARY ────────────
    let stateSummary = null;
    if (stateEngine) {
      try {
        stateSummary = stateEngine.getSessionSummary();
      } catch (err) {
        console.error('State summary failed (non-blocking):', err.message);
      }
    }

    // ── [NEW] COACHING ENGINE — SESSION SUMMARY ─────────
    let coachingSummary = null;
    if (coachingEngine) {
      try {
        coachingSummary = coachingEngine.getCoachingSummary();
      } catch (err) {
        console.error('Coaching summary failed (non-blocking):', err.message);
      }
    }

    // ── [NEW] TREND ANALYZER — EVERY 10 SESSIONS ────────
    let trendReport = null;
    if (shouldRunTrendAnalysis(sessCount)) {
      try {
        trendReport = await analyzeTrends(userId);
      } catch (err) {
        console.error('Trend analysis failed (non-blocking):', err.message);
      }
    }

    // ── [NEW] IMMUNE SYSTEM — POST-SESSION SCAN ─────────
    let immuneScan = null;
    if (immuneSystem) {
      try {
        immuneScan = await immuneSystem.postSessionScan(
          {
            session_id: sessionId,
            session_number: rawSession.session_number || 0,
            coherence_peak: rawMetrics.coherence_peak || 0,
            coherence_end: coherenceEnd,
            cycle_completion_rate: cleanMetrics.adjusted_cycle_completion_rate || 0,
            panic_event: rawMetrics.panic_event || false,
            exit_type: cleanMetrics.exit_type || 'normal',
            pause_count: cleanMetrics.total_pauses || 0,
            track: user.breath_track || 'standard'
          },
          stateSummary
        );
      } catch (err) {
        console.error('Immune post-scan failed (non-blocking):', err.message);
      }
    }

    // ── [NEW] LUNO — MIRROR DIALOGUE ────────────────────
    let mirrorDialogue = null;
    if (lunoIntelligence) {
      try {
        mirrorDialogue = await lunoIntelligence.getPhaseDialogue('mirror');
      } catch (err) {
        // Non-blocking
      }
    }

    // ── [NEW] AXIS — INGEST SESSION DATA ────────────────
    // Feed anonymized session data to the brain stem for
    // population-level learning. Non-blocking.
    try {
      const axisInstance = new AxisEngine(pool);
      await axisInstance.ingestSessionData({
        user_id: userId,
        session_id: sessionId,
        session_number: rawSession.session_number || 0,
        track: user.breath_track || 'standard',
        arc: adaptedSession._arc || null,
        mode: adaptedSession._breathwork_mode || 'simple_pacer',
        coherence_peak: rawMetrics.coherence_peak || 0,
        coherence_end: coherenceEnd,
        cycle_completion_rate: cleanMetrics.adjusted_cycle_completion_rate || rawMetrics.cycle_completion_rate || 0,
        active_duration_seconds: cleanMetrics.active_duration_seconds || rawMetrics.total_duration_seconds || 0,
        pause_count: cleanMetrics.total_pauses || 0,
        panic_event: rawMetrics.panic_event || false,
        exit_type: cleanMetrics.exit_type || 'normal',
        state_summary: stateSummary,
        coaching_summary: coachingSummary
      });
    } catch (err) {
      console.error('AXIS ingest failed (non-blocking):', err.message);
    }

    // ── MIRROR SCREEN DATA ──────────────────────────────
    const mirrorData = {
      suppress_biometrics: adaptedSession._suppress_biometric_mirror || false,
      coherence_display: !adaptedSession._suppress_coherence_display,
      active_duration_seconds: cleanMetrics.active_duration_seconds,
      affirmation: primaryAffirmation ? primaryAffirmation.message : null,
      mirror_dialogue: mirrorDialogue,
      pause_note: cleanMetrics.mirror_pause_note || null,
      advancement: advancementResult.action === 'advanced' ? advancementResult : null,
      // New data from wired systems
      state_summary: stateSummary,
      coaching_summary: coachingSummary,
      trend_report: trendReport,
      immune_scan: immuneScan,
      biometric_annotation: biometricAnnotation,
      companionship_mode: isCompanionshipMode,
      companionship_data: isCompanionshipMode && companionshipMode
        ? companionshipMode.getSessionConfig() : null
    };

    onMirrorData(mirrorData);

    return {
      session_id: sessionId,
      track: user.breath_track,
      metrics: cleanMetrics,
      advancement: advancementResult,
      affirmation: primaryAffirmation,
      mirror: mirrorData
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════

  return {
    // Original 7 lifecycle methods (contract unchanged)
    onSessionStart,
    onArrivalComplete,
    onBreathingTick,
    onPauseTap,
    onResumeTap,
    onExitTap,
    onSessionComplete,

    // New lifecycle additions (additive, non-breaking)
    onArrivalSample,      // feed baseline filter during Arrival
    onDrillSelected,      // user picks a drill from coaching intervention
    onBLEDisconnect,      // Polar H10 drops
    onBLEReconnect,       // Polar H10 returns

    // Getters for session engine
    getAdaptedSession: () => adaptedSession,
    getPauseHandler: () => pauseHandler,
    getActiveSeconds: () => pauseHandler ? pauseHandler.getActiveSeconds() : 0,
    getSessionPhase: () => sessionPhase,
    ispaused: () => pauseHandler ? pauseHandler.state !== PAUSE_STATE.ACTIVE : false,

    // New getters
    getStateEngine: () => stateEngine,
    getCoachingEngine: () => coachingEngine,
    getDetectionMode: () => biometricResilience ? biometricResilience.getDetectionMode() : 'unknown',
    getImmuneSystem: () => immuneSystem
  };
}

// ── EXPORTS ──────────────────────────────────────────────────

module.exports = { createOrchestrator };
