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
const { buildSessionDataPacket, queueAttestation } = require('./buildSessionDataPacket');
const { determineBreathParams } = require('./determineBreathParams');
const { AxisEngine } = require('../axis/axisEngine');
const { PreSessionIntelligence } = require('./preSessionIntelligence');
const { PostSessionIntelligence } = require('./postSessionIntelligence');
const { ZoneTimeTracker, CoherenceMomentum } = require('./stateEngineEnhancements');
const { CoachingEffectivenessTracker } = require('./coachingEnhancements');
const { CrossSystemSynergy } = require('./crossSystemSynergy');
const { VictoryLapEngine } = require('./victoryLapEngine');
const { onBiometricWindowReceived: ns3BiometricTick, onSessionComplete: ns3Complete, initializeNS3Session } = require('../services/ns3AxisBridge');
const breathArtEngine = require('./breathArtEngine');
const ipfsService = require('../services/ipfsService');
const artAggregationEngine = require('./artAggregationEngine');
const familyIntelligence = require('./familyIntelligence');
const familyUnitEngine = require('./familyUnitEngine');
const capacityCurrency = require('./capacityCurrency');
const lightBridgeEngine = require('./lightBridgeEngine');
const galleryHarmonicsEngine = require('./galleryHarmonicsEngine');
const userPersonalizationLayer = require('./userPersonalizationLayer');
const lineageService = require('../services/lineageService');
const Sentry = require('../instrument');

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
  let tenantId = null;
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

  // ── ENHANCEMENT SYSTEM INSTANCES ────────────────────────
  let preSessionIntel = null;
  let postSessionIntel = null;
  let zoneTimeTracker = null;
  let coherenceMomentum = null;
  let coachingEffectiveness = null;
  let crossSystemSynergy = null;
  let victoryLapEngine = null;

  // ── COMPANIONSHIP MODE FLAG ─────────────────────────────
  let isCompanionshipMode = false;

  // ── NS3 ENGINE STATE ────────────────────────────────────────
  let ns3Session = null;       // { aggregator, hrHistory, sdnnHistory, belowWindowDuration, sessionMinute }
  let ns3TickCounter = 0;      // fires NS3 every 5 ticks (5 seconds)
  let ns3Summary = null;       // populated on session complete

  // ── SOMATIC RESET STATE ───────────────────────────────────
  let somaticActive = false;
  let somaticExerciseCount = 0;
  let stressorFlag = null;  // court_day | visitation_window | release_approaching

  // ═══════════════════════════════════════════════════════════
  // 1. SESSION START
  // ═══════════════════════════════════════════════════════════

  async function onSessionStart(_userId, _sessionId, options = {}) {
    userId = _userId;
    sessionId = _sessionId;
    tenantId = options.tenant_id || null;
    sessionPhase = 'pre_session';
    stressorFlag = options.stressor_flag || null;

    // ── SENTRY SESSION CONTEXT ───────────────────────────
    Sentry.setUser({ id: userId });
    Sentry.setTag('session_id', sessionId);
    if (options.device_type) Sentry.setTag('device_type', options.device_type);

    // ── LOAD USER ───────────────────────────────────────
    const userResult = await pool.query(
      `SELECT * FROM users WHERE user_id = $1 OR id = $2 OR participant_id = $3`,
      [userId, parseInt(userId) || 0, userId]
    );
    if (userResult.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }
    user = userResult.rows[0];

    // ── LOAD SESSION ────────────────────────────────────
    const sessionNumber = parseInt(String(sessionId).replace(/\D/g, '')) || 1;
    const sessResult = await pool.query(
      `SELECT * FROM session_templates WHERE session_number = $1`,
      [sessionNumber]
    );
    if (sessResult.rows.length === 0) {
      throw new Error(`Session template for session ${sessionNumber} not found`);
    }
    rawSession = sessResult.rows[0];
    Sentry.setTag('session_number', rawSession.session_number);

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
    homeostaticRegulator = new HomeostaticRegulator(String(userId), pool);
    let homeostaticResult = { allowed: true };
    try {
      homeostaticResult = await homeostaticRegulator.preSessionCheck();
    } catch (err) {
      console.error('Homeostatic pre-check failed (non-blocking):', err.message);
      Sentry.captureException(err);
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
    immuneSystem = new ImmuneSystem(String(userId), pool);
    let immuneBarrier = { blocked: false };
    try {
      immuneBarrier = immuneSystem.checkBarriers('start_session');
    } catch (err) {
      console.error('Immune barrier check failed (non-blocking):', err.message);
      Sentry.captureException(err);
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
    const isFR = String(sessionId).startsWith('FR');
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
      Sentry.captureException(err);
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

    // ── INITIALIZE ENHANCEMENT SYSTEMS ───────────────────
    preSessionIntel = new PreSessionIntelligence(userId, pool);
    postSessionIntel = new PostSessionIntelligence(pool);
    zoneTimeTracker = new ZoneTimeTracker();
    coherenceMomentum = new CoherenceMomentum();
    coachingEffectiveness = new CoachingEffectivenessTracker();
    crossSystemSynergy = new CrossSystemSynergy();
    victoryLapEngine = new VictoryLapEngine();

    // ── [NS3] INITIALIZE NS3 SESSION AGGREGATOR ──────────
    ns3Session = initializeNS3Session(userId, sessionId);
    ns3TickCounter = 0;

    // Pre-session intelligence (non-blocking)
    let preSessionAnalysis = null;
    try {
      preSessionAnalysis = await preSessionIntel.analyze();
    } catch (err) {
      console.error('[ABI] PreSessionIntelligence failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    sessionPhase = 'arrival';

    // Return initial session config for the engine
    // ── SESSION CONTENT (Luno dialogue from YAML/template) ──
    const sessionContent = {
      luno_arrival: rawSession.luno_arrival || null,
      luno_settle: rawSession.luno_settle || rawSession.yaml_data?.luno_settle || null,
      luno_mid: rawSession.luno_mid || null,
      luno_close: rawSession.luno_close || null,
      breathing_prompts: rawSession.breathing_prompts || rawSession.yaml_data?.breathing_prompts || null,
      drift_words: rawSession.drift_words || rawSession.yaml_data?.drift_words || null,
      title: rawSession.title || null,
      arc: rawSession.arc || null,
      vault_prompt: rawSession.vault_prompt || null,
      session_number: rawSession.session_number
    };

    return {
      session: adaptedSession,
      session_content: sessionContent,
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
        const filtered = baselineFilter.getFilteredBaseline();
        if (filtered && filtered.valid) {
          cleanBaseline = {
            resting_hr: filtered.resting_hr || resting_hr,
            resting_hrv: filtered.resting_hrv || resting_hrv,
            respiratory_rate: filtered.respiratory_rate || respiratory_rate
          };
        }
      } catch (err) {
        console.error('Baseline filter failed (using raw):', err.message);
      Sentry.captureException(err);
      }
    }

    // ── [ABI] SOMATIC RESET GATEWAY ─────────────────────
    // If arrival HR signals hyperarousal (>100) or hypoarousal (<55),
    // deploy somatic exercise BEFORE breathwork. Non-optional.
    // Special case: stressor_flag + HR 60-85 → court_day protocol.
    const arrivalHR = cleanBaseline.resting_hr;
    if (arrivalHR) {
      let somaticProtocol = null;

      if (arrivalHR > 100) {
        somaticProtocol = 'hyperarousal';
      } else if (arrivalHR < 55) {
        somaticProtocol = 'hypoarousal';
      } else if (stressorFlag && ['court_day', 'visitation_window', 'release_approaching'].includes(stressorFlag)
                 && arrivalHR >= 60 && arrivalHR <= 85) {
        somaticProtocol = 'court_day';
      }

      if (somaticProtocol) {
        try {
          const exercise = await getSomaticExercise(somaticProtocol, 1);
          if (exercise) {
            somaticActive = true;
            somaticExerciseCount = 1;
            sessionPhase = 'somatic';
            onLunoSpeak(exercise.luno_intro);
            return {
              somatic_required: true,
              somatic_exercise: exercise,
              protocol: somaticProtocol,
              baseline_filtered: cleanBaseline !== arrivalBaseline,
              biometrics_available: biometricsAvailable
            };
          }
        } catch (err) {
          console.error('[ABI] Somatic exercise lookup failed (proceeding to breathwork):', err.message);
      Sentry.captureException(err);
        }
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
          const isFR = String(sessionId).startsWith('FR');
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
        const isFR = String(sessionId).startsWith('FR');
        adaptedSession = isFR
          ? adaptFRBreathProtocol(rawSession, user, false)
          : adaptBreathProtocol(rawSession, user);
        if (stateEngine) stateEngine.track = provisionalResult.new_track;
      }
    }

    // ── [ABI] DETERMINE BREATH PARAMS (adaptive ratio) ──
    // If the adapted session has adaptive_ratio: true (FR corrected
    // sessions or YAML-driven), resolve the actual ratio from the
    // arrival baseline. The YAML provides guardrails, ABI decides.
    let breathParamsResult = null;
    if (adaptedSession.adaptive_ratio === true) {
      try {
        // Build history context for FR16-25 (baseline_plus_history)
        let history = null;
        if (adaptedSession._detection_mode === 'baseline_plus_history') {
          const historyResult = await pool.query(
            `SELECT coherence_score, breath_track_at_completion
             FROM session_completions
             WHERE user_id = $1
             ORDER BY completed_at DESC LIMIT 5`,
            [userId]
          );
          if (historyResult.rows.length > 0) {
            const avgCoherence = historyResult.rows.reduce((s, r) => s + (parseFloat(r.coherence_score) || 0), 0) / historyResult.rows.length;
            history = {
              avg_coherence: avgCoherence,
              last_ratio: adaptedSession.ratio || null
            };
          }
        }

        breathParamsResult = await determineBreathParams(
          {
            resting_hr: cleanBaseline.resting_hr,
            resting_hrv: cleanBaseline.resting_hrv,
            respiratory_rate: cleanBaseline.respiratory_rate
          },
          {
            adaptive_ratio: true,
            ratio_range: adaptedSession.ratio_range,
            duration_range: adaptedSession.duration_range,
            detection_mode: adaptedSession.detection_mode || adaptedSession._detection_mode || 'arrival_baseline'
          },
          history,
          { pool, userId }
        );

        // Apply resolved params to adapted session
        adaptedSession.ratio = breathParamsResult.ratio;
        adaptedSession.breath_in = breathParamsResult.inhale;
        adaptedSession.breath_out = breathParamsResult.exhale;
        adaptedSession.duration_seconds = breathParamsResult.duration_seconds;
        adaptedSession._breath_params_confidence = breathParamsResult.confidence;
        adaptedSession._breath_params_method = breathParamsResult.method;

        // Alert if ratio hits or drops below 2:3 floor
        if (breathParamsResult.ratio === '2:3' || (breathParamsResult.inhale <= 2 && breathParamsResult.exhale <= 3)) {
          Sentry.captureMessage('Breath ratio at or below 2:3 floor', {
            level: 'warning',
            tags: { participant_id: userId, session_id: sessionId },
            extra: { ratio: breathParamsResult.ratio, method: breathParamsResult.method, confidence: breathParamsResult.confidence },
          });
        }
      } catch (err) {
        // Fallback: use safest ratio in range
        console.error('[ABI] determineBreathParams failed, using fallback 3:5:', err.message);
      Sentry.captureException(err);
        adaptedSession.ratio = '3:5';
        adaptedSession.breath_in = 3;
        adaptedSession.breath_out = 5;
        adaptedSession.duration_seconds = 180;
        adaptedSession._breath_params_confidence = 0.2;
        adaptedSession._breath_params_method = 'fallback_error';
      }
    }

    // ── LUNO — ARRIVAL DIALOGUE ──────────────────────────
    // Add breath context so Luno can reference the selected ratio
    let arrivalDialogue = null;
    if (lunoIntelligence) {
      try {
        if (breathParamsResult && lunoIntelligence.context) {
          lunoIntelligence.context.breath_ratio = breathParamsResult.ratio;
          lunoIntelligence.context.breath_mode = adaptedSession._breathwork_mode;
          lunoIntelligence.context.breath_confidence = breathParamsResult.confidence;
        }
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
      breath_params: breathParamsResult,
      arrival_dialogue: arrivalDialogue,
      session_update: {
        pacer_active: adaptedSession._pacer_active !== false,
        mode: adaptedSession._breathwork_mode || 'simple_pacer',
        breath_ratio: adaptedSession.ratio,
        breath_in: adaptedSession.breath_in,
        breath_out: adaptedSession.breath_out,
        breath_hold: adaptedSession._hold_seconds || 0,
        pursed_lip: adaptedSession._pursed_lip || false,
        duration_seconds: adaptedSession.duration_seconds,
        luno_inhale_cue: adaptedSession._luno_inhale_cue || null,
        luno_exhale_cue: adaptedSession._luno_exhale_cue || null,
        suppress_coherence_display: adaptedSession._suppress_coherence_display || false,
        track: user.breath_track,
        adaptive_ratio: adaptedSession.adaptive_ratio || false,
        coherence_target: adaptedSession._coherence_target || null
      }
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 3. BREATHING TICK (every second during Breathing phase)
  // ═══════════════════════════════════════════════════════════

  async function onBreathingTick(biometrics) {
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
        const adjustments = stateResult.adjustments || {};
        onStateChange({
          type: 'state_tick',
          state: currentState,
          secondsInState: stateResult.tick || 0,
          responseLevel: stateResult.response_level || 0,
          adjustments
        });

        // ── Apply graduated adjustments to pacer ────────
        if (adjustments && Object.keys(adjustments).length > 0) {
          const adj = adjustments;
          if (adj.exhale_extend > 0 || adj.pacer_slow < 1 || adj.visual_warmth > 0) {
            result.pacer_adjustments = {
              exhale_extend: adj.exhale_extend,
              pacer_slow: adj.pacer_slow,
              visual_warmth: adj.visual_warmth,
              luno_pulse_slow: adj.luno_pulse_slow
            };
          }
        }
      } catch (err) {
        console.error('State engine tick failed (non-blocking):', err.message);
      Sentry.captureException(err);
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
          // [CP5] Structured log — message/coaching trigger decision
          console.log(`[CP5][${new Date().toISOString()}] MSG_TRIGGER | ACTION:${coachAction.action} THRESHOLD:${coachAction.threshold || '-'} DECISION:fire ELAPSED:${elapsed}s`);

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
      Sentry.captureException(err);
      }
    }

    // ── [NEW] BIOMETRIC RESILIENCE — BLE DISCONNECT ─────
    // If BLE disconnected mid-session, biometricResilience handles
    // the mode transition internally. We just check if the detection
    // mode changed and notify the frontend.
    if (biometricResilience) {
      const currentMode = biometricResilience.getDetectionMode();
      if (result.detection_mode !== currentMode) {
        if (currentMode === 'synthetic') {
          Sentry.captureMessage('Biometric disconnect mid-session', {
            level: 'warning',
            tags: { participant_id: userId, session_id: sessionId },
            extra: { previous_mode: result.detection_mode, new_mode: currentMode },
          });
        }
        result.detection_mode = currentMode;
      }
    }

    // ── ENHANCEMENT SYSTEMS — TICK ─────────────────────
    try {
      if (zoneTimeTracker && stateResult) zoneTimeTracker.onTick(stateResult.state, elapsed);
      if (coherenceMomentum) coherenceMomentum.update(biometrics.coherence || biometrics.coherence_score || 0);
      if (coachingEffectiveness && stateResult) coachingEffectiveness.onTick(stateResult.state, stateResult.response_level);
    } catch (err) {
      // Non-blocking
    }

    // ── [NS3] NERVOUS SYSTEM STATE SCORE — EVERY 5 SECONDS ──
    // Paused during somatic reset phase. Resumes after onSomaticComplete().
    ns3TickCounter++;
    if (ns3Session && ns3TickCounter >= 5 && !somaticActive) {
      ns3TickCounter = 0;
      try {
        const rrBuffer = biometrics.rr_intervals || biometrics.rrIntervals || [];
        if (rrBuffer.length >= 2) {
          ns3Session.sessionMinute = Math.floor(elapsed / 60);

          // Accumulate HR/SDNN history
          if (biometrics.current_hr || biometrics.heart_rate) {
            ns3Session.hrHistory.push(biometrics.current_hr || biometrics.heart_rate);
          }
          const sdnn = biometrics.sdnn || null;
          if (sdnn !== null) ns3Session.sdnnHistory.push(sdnn);

          const ns3Result = await ns3BiometricTick({
            participantId: userId,
            sessionId,
            rrBuffer,
            spO2: biometrics.spo2 || biometrics.spO2 || null,
            hrHistory: ns3Session.hrHistory,
            sdnnHistory: ns3Session.sdnnHistory,
            deviceType: biometrics.device_type || biometrics.source || 'unknown',
            currentTrack: user.breath_track || 'standard',
            belowWindowDuration: ns3Session.aggregator.belowWindowDuration,
            sessionMinute: ns3Session.sessionMinute,
            aggregator: ns3Session.aggregator,
            arrivalComplete: sessionPhase === 'breathing',
            breathMatchActive: adaptedSession?.adaptive_ratio || false,
          });

          // [CP3] Structured log — NS3 computation
          console.log(`[CP3][${new Date().toISOString()}] NS3_CALC | SCORE:${ns3Result.ns3Score} ZONE:${ns3Result.zone} PREV:${result.ns3?.score || 'none'} DEVICE:${biometrics.device_type || 'unknown'}`);

          result.ns3 = {
            score: ns3Result.ns3Score,
            zone: ns3Result.zone,
          };

          // Alert on NS3 crisis zone
          if (ns3Result.zone === 'below_window' && ns3Result.ns3Score !== null && ns3Result.ns3Score <= 20) {
            Sentry.captureMessage('NS3 crisis zone — score critically low', {
              level: 'warning',
              tags: { participant_id: userId, session_id: sessionId, ns3_zone: ns3Result.zone },
              extra: { ns3Score: ns3Result.ns3Score, sessionMinute: ns3Session.sessionMinute, device: biometrics.device_type || 'unknown' },
            });
          }
        }
      } catch (err) {
        console.error('[NS3] Tick failed (non-blocking):', err.message);
      Sentry.captureException(err);
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

          const isFR = String(sessionId).startsWith('FR');
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
          ).catch(err => { console.error('Live detect DB update failed:', err.message); Sentry.captureException(err); });

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
      Sentry.captureException(err);
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
    if (pauseHandler) pauseHandler.pause();
    // Track manual pause in biometric resilience (indicates self-awareness)
    if (biometricResilience) biometricResilience.onManualPause();
  }

  function onResumeTap() {
    if (pauseHandler) pauseHandler.resume();
  }

  function onExitTap() {
    if (pauseHandler) pauseHandler.exit();
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

    // ── STATE ENGINE — SESSION SUMMARY ───────────────────
    // (Moved before INSERT so enrichment columns are available)
    let stateSummary = null;
    if (stateEngine) {
      try {
        stateSummary = stateEngine.getSessionSummary();
      } catch (err) {
        console.error('State summary failed (non-blocking):', err.message);
      Sentry.captureException(err);
      }
    }

    // ── COACHING ENGINE — SESSION SUMMARY ────────────────
    let coachingSummary = null;
    if (coachingEngine) {
      try {
        coachingSummary = coachingEngine.getCoachingSummary();
      } catch (err) {
        console.error('Coaching summary failed (non-blocking):', err.message);
      Sentry.captureException(err);
      }
    }

    // ── IMMUNE SYSTEM — POST-SESSION SCAN ────────────────
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
      Sentry.captureException(err);
      }
    }

    // ── [NS3] SESSION COMPLETION — SUMMARIZE + STORE ──────
    ns3Summary = null;
    if (ns3Session && ns3Session.aggregator) {
      try {
        ns3Summary = await ns3Complete(ns3Session.aggregator, {
          sessionId,
          participantId: userId,
        });

        if (ns3Summary) {
          await pool.query(
            `UPDATE session_completions
             SET ns3_mean = $1, ns3_peak = $2, ns3_floor = $3,
                 optimal_zone_pct = $4, regulatory_trajectory = $5,
                 sustained_optimal = $6
             WHERE user_id = $7 AND session_id = $8`,
            [
              ns3Summary.ns3.mean,
              ns3Summary.ns3.peak,
              ns3Summary.ns3.floor,
              ns3Summary.zoneDuration.optimalPct,
              ns3Summary.clinical.regulatoryTrajectory,
              ns3Summary.clinical.sustainedOptimal,
              userId,
              sessionId
            ]
          );
        }
      } catch (err) {
        console.error('[NS3] Session completion failed (non-blocking):', err.message);
      Sentry.captureException(err);
      }
    }

    // ── [ABI] BUILD SESSION DATA PACKET ──────────────────
    // Canonical hash for on-chain attestation. Every session
    // from day one is retroactively attestable, even before
    // blockchain writes are live.
    let sessionPacket = null;
    const biometricSource = biometricAnnotation?.source || 'none';
    try {
      sessionPacket = buildSessionDataPacket({
        userId,
        sessionId,
        sessionNumber: rawSession.session_number || 0,
        track: user.breath_track || 'standard',
        arc: adaptedSession._arc || null,
        mode: adaptedSession._breathwork_mode || 'simple_pacer',
        arrivalBaseline,
        cleanMetrics,
        rawMetrics,
        stateSummary,
        coachingSummary,
        immuneScan,
        biometricSource,
        coherenceEnd
      });
    } catch (err) {
      console.error('[ABI] SessionDataPacket build failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // ── SAVE SESSION COMPLETION ──────────────────────────
    try {
      const cohPeak = rawMetrics.coherence_peak || 0;
      const breathRatio = adaptedSession.ratio || adaptedSession._ratio || (adaptedSession.breath_in && adaptedSession.breath_out ? adaptedSession.breath_in + ':' + adaptedSession.breath_out : null);
      const breathDur = rawMetrics.total_duration_seconds || cleanMetrics.active_duration_seconds || 0;
      const zoneProfile = sessionPacket?.zoneTimeProfile || null;
      const optPct = zoneProfile?.optimal_pct ?? null;
      const appPct = zoneProfile?.approaching_pct ?? null;
      const belPct = zoneProfile?.below_window_pct ?? null;

      await pool.query(
        `INSERT INTO session_completions (
           user_id, session_id, session_number, completed_at,
           coherence_score, coherence_peak, coherence_end, cycle_completion_rate,
           duration_seconds, active_duration_seconds,
           pause_count, pause_seconds, panic_event, exit_type,
           breathwork_mode, breath_track_at_completion, arc_id,
           breath_ratio, breath_duration_seconds, session_type,
           time_to_regulation_sec, arrival_hr, arrival_hrv,
           coherence_trajectory, zone_time_profile,
           optimal_zone_pct, zone_optimal_pct, approaching_zone_pct, zone_approaching_pct,
           below_window_zone_pct, zone_below_pct,
           packet_hash, state_summary, coaching_summary,
           immune_flags_snapshot, biometric_source
         ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                   $17, $18, $19, $20, $21, $22, $23, $24,
                   $25, $26, $27, $28, $29, $30,
                   $31, $32, $33, $34, $35)`,
        [
          userId,
          sessionId,
          rawSession.session_number || 0,
          cohPeak,                                                          // coherence_score
          cohPeak,                                                          // coherence_peak (alias)
          coherenceEnd,
          cleanMetrics.adjusted_cycle_completion_rate || rawMetrics.cycle_completion_rate || 0,
          breathDur,                                                        // duration_seconds
          cleanMetrics.active_duration_seconds || breathDur || 0,           // active_duration_seconds
          cleanMetrics.total_pauses || 0,                                   // pause_count
          cleanMetrics.total_pause_seconds || 0,                            // pause_seconds
          rawMetrics.panic_event || false,
          cleanMetrics.exit_type || 'normal',
          adaptedSession._breathwork_mode || 'simple_pacer',
          user.breath_track || 'standard',
          adaptedSession._arc || null,
          breathRatio,                                                      // breath_ratio
          breathDur,                                                        // breath_duration_seconds
          'solo',                                                           // session_type (default solo)
          sessionPacket?.timeToRegulationSec ?? null,
          sessionPacket?.arrivalHr ?? null,
          sessionPacket?.arrivalHrv ?? null,
          sessionPacket?.coherenceTrajectory ?? null,
          zoneProfile ? JSON.stringify(zoneProfile) : null,
          optPct, optPct,                                                   // optimal_zone_pct + zone_optimal_pct
          appPct, appPct,                                                   // approaching_zone_pct + zone_approaching_pct
          belPct, belPct,                                                   // below_window_zone_pct + zone_below_pct
          sessionPacket?.packetHash ?? null,
          stateSummary ? JSON.stringify(stateSummary) : null,
          coachingSummary ? JSON.stringify(coachingSummary) : null,
          immuneScan?.flags ? JSON.stringify(immuneScan.flags) : null,
          biometricSource
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
      Sentry.captureException(err);
    }

    // ── [ABI] BREATH ART GENERATION ──────────────────────
    // Generate deterministic sacred geometry art from NS3 summary
    // + packetHash. Upload to IPFS, store hash in session_completions.
    let artResult = null;
    try {
      if (sessionPacket && sessionPacket.packetHash) {
        const sessCountForArt = (user.total_sessions_completed || 0) + 1;
        const milestoneSession = [10, 30, 50].includes(sessCountForArt) ? sessCountForArt : 0;
        const artOptions = {
          session_count: sessCountForArt,
          track: user.breath_track || 'standard',
          arc_name: adaptedSession._arc || 'standard',
          time_to_regulation_sec: sessionPacket?.timeToRegulationSec ?? null,
          breath_accuracy: cleanMetrics?.adjusted_cycle_completion_rate ?? rawMetrics?.cycle_completion_rate ?? 50,
          somatic_reset_used: !!rawMetrics?.somatic_reset_used,
          family_unit_active: !!user.family_unit_id,
          lightbridge_active: !!rawMetrics?.lightbridge_active,
          court_day_flag: !!rawMetrics?.court_day_flag,
          is_dropout_return: !!rawMetrics?.is_dropout_return,
          milestone_session: milestoneSession,
          is_fr_session: (adaptedSession._arc || '').toLowerCase().includes('fr'),
          panic_recovery: !!(rawMetrics?.panic_event && cleanMetrics?.exit_type === 'normal'),
        };

        const { svgString, metadataJSON } = breathArtEngine.generate(
          ns3Summary, sessionPacket.packetHash, artOptions
        );

        // Render SVG to PNG
        const pngBuffer = await breathArtEngine.renderToPNG(svgString);

        // Apply gallery harmonics (aesthetic layer — sacred geometry frame, color wash, container shape)
        let uploadBuffer = pngBuffer;
        let harmonicsMeta = null;
        try {
          const harmonicsResult = await galleryHarmonicsEngine.applyHarmonics(
            { svgString, pngBuffer, metadataJSON },
            {
              sessionNumber: sessCountForArt,
              ns3Zone: ns3Summary?.ns3Zone || ns3Summary?.clinical?.zone || 'regulated',
              coherencePeak: rawMetrics.coherence_peak || 0,
              containerShape: rawMetrics.containerShape || 'circle',
              isFamilySession: !!user.family_unit_id,
              participantCount: rawMetrics.participant_count || 1,
              packetHash: sessionPacket.packetHash,
            }
          );
          uploadBuffer = harmonicsResult.compositePngBuffer;
          harmonicsMeta = harmonicsResult.harmonicsMeta;
        } catch (harmonicsErr) {
          console.error('[GalleryHarmonics] Failed (falling back to raw thread):', harmonicsErr.message);
          Sentry.captureException(harmonicsErr);
        }

        // Auto-apply user personalization preferences if enabled
        try {
          const prefs = await userPersonalizationLayer.getPreferences(userId);
          if (prefs && prefs.auto_apply) {
            const personalizedPng = await userPersonalizationLayer.applyPersonalization(
              uploadBuffer,
              {
                hue_shift: prefs.default_hue_shift,
                saturation_adjust: prefs.default_saturation,
                brightness_adjust: prefs.default_brightness,
                filter_preset: prefs.default_filter,
                frame_override: prefs.default_frame,
                overlay_texture: prefs.default_overlay,
                container_override: prefs.default_container,
              }
            );
            uploadBuffer = personalizedPng;
            console.log(`[Personalization] Auto-applied preferences for user ${userId}`);
          }
        } catch (persErr) {
          console.error('[Personalization] Auto-apply failed (using harmonics output):', persErr.message);
          Sentry.captureException(persErr);
        }

        // Build clinical payload for encryption
        const clinicalPayload = {
          ns3_mean: ns3Summary?.ns3?.mean ?? null,
          ns3_peak: ns3Summary?.ns3?.peak ?? null,
          coherence_peak: rawMetrics.coherence_peak || 0,
          zone_profile: ns3Summary?.zoneDuration ?? null,
          trajectory: ns3Summary?.clinical?.regulatoryTrajectory ?? null,
          sustained_optimal: ns3Summary?.clinical?.sustainedOptimal ?? false,
          session_number: rawSession.session_number || 0,
          track: user.breath_track || 'standard',
        };

        // Upload composite to IPFS (falls back to raw pngBuffer if harmonics failed)
        // Graceful: returns { skipped: true } when Pinata keys are missing
        const ipfsResult = await ipfsService.upload(
          uploadBuffer, metadataJSON, clinicalPayload,
          { sessionNumber: rawSession.session_number || 0, firstName: user.first_name || 'Participant' }
        );
        const { imageHash, metadataHash } = ipfsResult;

        // Store art_ipfs_hash + harmonic metadata in session_completions (skip if IPFS was unavailable)
        if (metadataHash) {
          await pool.query(
            `UPDATE session_completions SET art_ipfs_hash = $1, art_encoding_version = 1,
             harmonic_meta = $4, container_shape = $5
             WHERE user_id = $2 AND session_id = $3`,
            [metadataHash, userId, sessionId, harmonicsMeta ? JSON.stringify(harmonicsMeta) : null, rawMetrics.containerShape || 'circle']
          );
        } else if (harmonicsMeta) {
          // Still store harmonics even without IPFS
          await pool.query(
            `UPDATE session_completions SET harmonic_meta = $3, container_shape = $4
             WHERE user_id = $1 AND session_id = $2`,
            [userId, sessionId, JSON.stringify(harmonicsMeta), rawMetrics.containerShape || 'circle']
          );
        }

        artResult = { svgString, imageHash, metadataHash, skipped: ipfsResult.skipped || false };
        console.log(`[BreathArt] Generated for session ${sessionId}, IPFS: ${metadataHash || 'skipped (no Pinata keys)'}`);
      }
    } catch (err) {
      console.error('[BreathArt] Generation failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // ── ART AGGREGATION MILESTONE CHECK ────────────────────
    let aggregationResult = null;
    try {
      const sessCountForMilestone = (user.total_sessions_completed || 0) + 1;
      const milestone = await artAggregationEngine.checkMilestone(userId, sessCountForMilestone);
      if (milestone) {
        aggregationResult = await artAggregationEngine.generateMandala(userId, milestone);
        console.log(`[ArtAggregation] Milestone ${milestone} triggered for ${userId}`);
      }

      // Check family constellation milestone (if family unit active)
      if (user.family_unit_id) {
        const familyMilestone = await artAggregationEngine.checkFamilyMilestone(user.family_unit_id);
        if (familyMilestone) {
          await artAggregationEngine.generateConstellation(user.family_unit_id, familyMilestone);
          console.log(`[ArtAggregation] Family constellation ${familyMilestone} for ${user.family_unit_id}`);
        }
      }
    } catch (err) {
      console.error('[ArtAggregation] Milestone check failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // ── FAMILY INTELLIGENCE PROCESSING ─────────────────────
    let familyIntelResult = null;
    const familyUnitId = user.family_unit_id || null;
    if (familyUnitId) {
      try {
        const familySessionData = {
          sessionNumber: rawSession.session_number || 0,
          ns3Zone: ns3Summary ? (ns3Summary.ns3.mean >= 56 ? 'optimal' : ns3Summary.ns3.mean >= 36 ? 'approaching' : 'below_window') : 'regulated',
          ns3Mean: ns3Summary?.ns3?.mean ?? 50,
          trajectory: ns3Summary?.clinical?.regulatoryTrajectory ?? 'stable',
          coherenceEnd,
          exitType: cleanMetrics?.exit_type || 'normal',
          activeDurationSeconds: cleanMetrics?.active_duration_seconds || rawMetrics?.total_duration_seconds || 0
        };

        familyIntelResult = await familyIntelligence.onFamilyMemberSessionComplete(
          userId, familySessionData, familyUnitId
        );

        // Queue automated messages
        for (const msg of (familyIntelResult.messages || [])) {
          await pool.query(
            `INSERT INTO family_messages (family_unit_id, target_user_id, target_type, category, severity, message_template_id, message_text, cooldown_until)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [familyUnitId, msg.targetUserId, msg.targetType, msg.category, msg.severity, msg.templateId, msg.text, msg.cooldownUntil]
          );
        }

        // Handle escalations
        for (const esc of (familyIntelResult.escalations || [])) {
          await pool.query(
            'INSERT INTO family_escalations (family_unit_id, escalation_type, trigger_data, routed_to) VALUES ($1, $2, $3, $4)',
            [familyUnitId, esc.type, JSON.stringify(esc.triggerData), esc.routeTo]
          );
        }

        // Re-evaluate gates
        await familyUnitEngine.evaluateGates(familyUnitId);

        console.log(`[FamilyIntel] Processed for ${userId} in family ${familyUnitId}`);
      } catch (err) {
        console.error('[FamilyIntel] Processing failed (non-blocking):', err.message);
        Sentry.captureException(err);
      }
    }

    // ── CAPACITY CURRENCY PROCESSING ───────────────────────
    let capacityResult = null;
    try {
      capacityResult = await capacityCurrency.onSessionComplete(userId, {
        sessionNumber: rawSession.session_number || 0,
        ns3Mean: ns3Summary?.ns3?.mean ?? 50,
        ns3_mean: ns3Summary?.ns3?.mean ?? 50,
        coherencePeak: rawMetrics.coherence_peak || 0,
        coherence_peak: rawMetrics.coherence_peak || 0,
        streakDays: 0, // computed inside deposit
        somaticResetUsed: !!rawMetrics?.somatic_reset_used
      });
    } catch (err) {
      console.error('[CapacityCurrency] Session deposit failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // ── BREATH BRIDGE COACHING (Phase 3) ─────────────────
    // Deliver one coaching moment after session completion
    try {
      const breathBridgeService = require('../services/breathBridgeService');
      const internalUser = await pool.query('SELECT id, family_unit_id FROM users WHERE user_id = $1', [userId]);
      if (internalUser.rows[0]?.family_unit_id) {
        await breathBridgeService.deliverCoaching(
          internalUser.rows[0].id,
          sessionRow?.id || null,
          internalUser.rows[0].family_unit_id
        );
      }
    } catch (err) {
      // Non-blocking — coaching failure never blocks session completion
      console.error('[BreathBridge] Coaching delivery failed (non-blocking):', err.message);
    }

    // ── LINEAGE LEDGER: FIRMWARE TRACKING ──────────────────
    // If session has firmware_number, record in lineage ledger
    if (rawSession.firmware_number) {
      try {
        const internalUserId = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
        if (internalUserId.rows.length) {
          await lineageService.recordEntry(
            internalUserId.rows[0].id, familyUnitId, null,
            'firmware_installed',
            {
              firmware_number: rawSession.firmware_number,
              firmware_name: rawSession.firmware_name || null,
              session_number: rawSession.session_number || 0,
              coherence_peak: rawMetrics.coherence_peak || 0,
            }
          );
        }
      } catch (err) {
        console.error('[LINEAGE] Firmware recording failed (non-blocking):', err.message);
      }
    }

    // ── LIGHTBRIDGE: SESSION EVENT ─────────────────────────
    if (familyUnitId) {
      try {
        await lightBridgeEngine.triggerSessionEvent(userId, familyUnitId, 'session_complete');
      } catch (err) {
        // Non-blocking — device failure never blocks session completion
        console.error('[LightBridge] Session event failed (non-blocking):', err.message);
      }
    }

    // ── RIPPLE SIGNAL: "They showed up today." ────────────
    try {
      const rippleService = require('../services/rippleService');
      await rippleService.fireRippleIfApplicable(userId);
    } catch (err) {
      // Non-blocking — ripple failure never blocks session completion
      console.error('[RIPPLE] Fire failed (non-blocking):', err.message);
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
      Sentry.captureException(err);
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

    // ── [ABI] PERSONALIZED CLOSE — TAG COMPUTATION + LOOKUP ──
    let personalizedClose = null;
    let sessionTags = [];
    const sessionNumber = rawSession.session_number || 0;
    try {
      sessionTags = await computeSessionTags({
        cleanMetrics,
        stateSummary,
        rawMetrics,
        arrivalBaseline,
        sessionNumber,
        userRecord: user,
        somaticExerciseUsed: somaticExerciseCount > 0
      });

      personalizedClose = await selectPersonalizedClose(sessionTags, sessionNumber);

      if (personalizedClose) {
        await updateSessionClose(personalizedClose.id, sessionTags);
      }
    } catch (err) {
      console.error('[ABI] Personalized close failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // ── TREND ANALYZER — EVERY 10 SESSIONS ───────────────
    let trendReport = null;
    if (shouldRunTrendAnalysis(sessCount)) {
      try {
        trendReport = await analyzeTrends(String(userId));
      } catch (err) {
        console.error('Trend analysis failed (non-blocking):', err.message);
      Sentry.captureException(err);
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

    // ── [ABI] PERSONALIZED CLOSE → LUNO CONTEXT ──────────
    // Luno reads the close from DB. Zero API dependency for closes.
    // Personalized close is the LAST thing Luno says before Abby's line.
    let lunoPersonalizedClose = null;
    if (personalizedClose) {
      lunoPersonalizedClose = personalizedClose.text;
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
      Sentry.captureException(err);
    }

    // ── LEDGER SYNC (non-blocking) ─────────────────────
    try {
      if (sessionPacket && sessionPacket.packetHash) {
        // Update session_completions with packet_hash
        await pool.query(
          `UPDATE session_completions SET packet_hash = $1
           WHERE user_id = $2 AND session_id = $3`,
          [sessionPacket.packetHash, userId, sessionId]
        );

        // Queue attestation if user has a wallet
        if (user.wallet_address) {
          const scRow = await pool.query(
            `SELECT id FROM session_completions
             WHERE user_id = $1 AND session_id = $2
             ORDER BY completed_at DESC LIMIT 1`,
            [userId, sessionId]
          );
          const scId = scRow.rows[0]?.id || null;
          await queueAttestation(pool, {
            sessionCompletionId: scId,
            userId,
            packetHash: sessionPacket.packetHash
          });
        }
      }
    } catch (err) {
      console.error('Ledger sync failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // ── POST-SESSION INTELLIGENCE (non-blocking) ──────
    let postAnalysis = null;
    try {
      if (postSessionIntel) {
        postAnalysis = await postSessionIntel.analyze({
          userId, sessionId, sessionNumber: rawSession.session_number || 0,
          cleanMetrics, stateSummary, coachingSummary,
          immuneScan, sessionPacket, arrivalBaseline,
          breathParamsResult: adaptedSession
        });
      }
    } catch (err) {
      console.error('[ABI] PostSessionIntelligence failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // ── VICTORY LAP CHECK ────────────────────────────────
    let victoryLap = null;
    try {
      if (victoryLapEngine) {
        victoryLap = victoryLapEngine.evaluate({
          sessionNumber: rawSession.session_number || 0,
          coherenceEnd,
          completionRate: cleanMetrics?.adjusted_cycle_completion_rate || cleanMetrics?.cycle_completion_rate || 0,
          stateSummary, coachingSummary,
          track: user.breath_track,
          totalSessionsCompleted: (user.total_sessions_completed || 0) + 1,
          advancementResult
        });
      }
    } catch (err) {
      console.error('[ABI] VictoryLapEngine failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // ── ZONE TIME FINALIZATION ───────────────────────────
    let zoneProfile = null;
    try {
      if (zoneTimeTracker) {
        zoneProfile = zoneTimeTracker.finalize(breathingStartTime ? Math.floor((Date.now() - breathingStartTime) / 1000) : 0);
      }
    } catch (err) { /* non-blocking */ }

    // ── OUTCOME-AWARE MIRROR ─────────────────────────────
    try {
      if (lunoIntelligence && lunoIntelligence.setSessionOutcome) {
        lunoIntelligence.setSessionOutcome({
          coherence_end: coherenceEnd,
          panic_event: cleanMetrics?.panic_event || false,
          exit_type: cleanMetrics?.exit_type || 'normal'
        });
      }
    } catch (err) { /* non-blocking */ }

    // ── MIRROR SCREEN DATA ──────────────────────────────
    // Wrapped to prevent any single field from crashing the return
    let mirrorData = {};
    try {
      mirrorData = {
        suppress_biometrics: adaptedSession._suppress_biometric_mirror || false,
        coherence_display: !adaptedSession._suppress_coherence_display,
        active_duration_seconds: cleanMetrics.active_duration_seconds,
        affirmation: primaryAffirmation ? primaryAffirmation.message : null,
        mirror_dialogue: mirrorDialogue,
        pause_note: cleanMetrics.mirror_pause_note || null,
        advancement: advancementResult?.action === 'advanced' ? advancementResult : null,
        state_summary: stateSummary,
        coaching_summary: coachingSummary,
        trend_report: trendReport,
        immune_scan: immuneScan,
        biometric_annotation: biometricAnnotation,
        companionship_mode: isCompanionshipMode,
        companionship_data: (isCompanionshipMode && companionshipMode?.getSessionConfig)
          ? companionshipMode.getSessionConfig() : null,
        personalized_close: lunoPersonalizedClose,
        personalized_close_tags: sessionTags,
        victory_lap: victoryLap,
        post_analysis: postAnalysis,
        zone_time_profile: zoneProfile,
        coherence_momentum: coherenceMomentum?.getSummary ? coherenceMomentum.getSummary() : null,
        coaching_effectiveness: coachingEffectiveness?.getSummary ? coachingEffectiveness.getSummary() : null,
        breath_art: artResult ? { imageHash: artResult.imageHash, metadataHash: artResult.metadataHash } : null,
        aggregation: aggregationResult,
        family_intelligence: familyIntelResult,
        capacity: capacityResult
      };
    } catch (err) {
      console.error('[Mirror] Data assembly failed (returning partial):', err.message);
      Sentry.captureException(err);
    }

    onMirrorData(mirrorData);

    return {
      session_id: sessionId,
      track: user.breath_track,
      metrics: cleanMetrics,
      advancement: advancementResult,
      affirmation: primaryAffirmation,
      personalized_close: lunoPersonalizedClose,
      mirror: mirrorData,
      victory_lap: victoryLap,
      breath_art: artResult ? { imageHash: artResult.imageHash, metadataHash: artResult.metadataHash } : null,
      aggregation: aggregationResult,
      family_intelligence: familyIntelResult,
      capacity: capacityResult
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PERSONALIZED CLOSES — TAG COMPUTATION + LOOKUP
  // ═══════════════════════════════════════════════════════════

  /**
   * computeSessionTags — derives context tags from session data, participant profile, and engagement.
   * Called inside onSessionComplete BEFORE close lookup.
   */
  async function computeSessionTags(sessionData) {
    const tags = [];
    const {
      cleanMetrics, stateSummary, rawMetrics, arrivalBaseline: baseline,
      sessionNumber, userRecord
    } = sessionData;

    // ── BIOMETRIC TAGS (NS3-derived when available) ──────
    if (ns3Summary && ns3Summary.ns3) {
      // NS3 engine provides authoritative HRV shift data
      const ns3Shift = ns3Summary.ns3.peak - ns3Summary.ns3.floor;
      if (ns3Shift > 30) tags.push('hrv_shift_large');
      else if (ns3Shift > 15) tags.push('hrv_shift_moderate');

      // regulation_fast: sustained optimal achieved within first 3 minutes
      const earlyReadings = ns3Session?.aggregator?.readings?.slice(0, 36) || []; // ~3 min at 5s intervals
      const regulationAchievedInFirstThreeMin = earlyReadings.some(r => r.zone === 'optimal');
      if (ns3Summary.clinical.sustainedOptimal && regulationAchievedInFirstThreeMin) {
        tags.push('regulation_fast');
      }

      // fought_through_activation: floor was below_window + trajectory improving
      const floorWasBelowWindow = ns3Summary.ns3.floor <= 35;
      if (ns3Summary.clinical.regulatoryTrajectory === 'improving' && floorWasBelowWindow) {
        tags.push('fought_through_activation');
      }
    } else {
      // Fallback: legacy HRV tag logic when NS3 is not available
      const peakHRV = stateSummary?.peakHRV ?? rawMetrics?.peak_hrv ?? 0;
      const floorHRV = stateSummary?.floorHRV ?? rawMetrics?.floor_hrv ?? (baseline?.resting_hrv || 0);
      const hrvShift = peakHRV - floorHRV;

      if (hrvShift > 30) tags.push('hrv_shift_large');
      else if (hrvShift > 15) tags.push('hrv_shift_moderate');

      const ttr = stateSummary?.timeToRegulation ?? null;
      if (ttr !== null && ttr <= 180) tags.push('regulation_fast');

      const trajectory = stateSummary?.trajectory ?? rawMetrics?.coherence_trajectory ?? null;
      if (floorHRV < (baseline?.resting_hrv || 999) * 0.8 && (trajectory === 'improving' || trajectory === 'ascending')) {
        tags.push('fought_through_activation');
      }
    }

    if (rawMetrics?.panic_event) tags.push('panic_recovery');

    if (rawMetrics?.somatic_exercise_used || sessionData.somaticExerciseUsed) {
      tags.push('somatic_reset_completed');
    }

    // ── STRESSOR TAGS ───────────────────────────────────
    const stressor = stressorFlag || userRecord?.stressor_flag || null;
    if (stressor === 'court_day') tags.push('court_day');
    if (stressor === 'visitation_window') tags.push('visitation_window');
    if (stressor === 'release_approaching') tags.push('release_approaching');

    const arrivalHR = baseline?.resting_hr ?? 0;
    const track = userRecord?.breath_track || 'standard';
    if (arrivalHR > 0 && arrivalHR < 55 && track === 'minimal') {
      tags.push('depression_signal');
    }

    // ── FAMILY TAGS ─────────────────────────────────────
    const familyUnitId = userRecord?.family_unit_id ?? null;
    const lightbridgeEnabled = userRecord?.lightbridge_enabled ?? false;
    const familyRecordingCount = userRecord?.family_recording_count ?? 0;

    if (familyUnitId) {
      tags.push('has_family_unit');
    } else {
      tags.push('no_family');
    }

    if (lightbridgeEnabled) tags.push('lightbridge_active');
    if (familyRecordingCount > 0) tags.push('family_recording_active');
    if (familyRecordingCount === 1) tags.push('family_recording_first');

    // ── ENGAGEMENT TAGS ─────────────────────────────────
    try {
      const lastSession = await pool.query(
        `SELECT completed_at FROM session_completions
         WHERE user_id = $1 AND session_id != $2
         ORDER BY completed_at DESC LIMIT 1`,
        [userId, sessionId]
      );
      if (lastSession.rows.length > 0) {
        const gap = (Date.now() - new Date(lastSession.rows[0].completed_at).getTime()) / (1000 * 60 * 60 * 24);
        if (gap > 7) tags.push('dropout_return');
      }
    } catch (err) { /* non-blocking */ }

    try {
      const weekSessions = await pool.query(
        `SELECT COUNT(*) as c FROM session_completions
         WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '7 days'`,
        [userId]
      );
      if (parseInt(weekSessions.rows[0].c) >= 5) tags.push('consistency_streak');
    } catch (err) { /* non-blocking */ }

    const sessionHour = new Date().getHours();
    if (sessionHour >= 18) tags.push('evening_session');

    if (track === 'gentle') tags.push('track_gentle');
    if (track === 'minimal') tags.push('track_minimal');
    if (track === 'standard' && sessionNumber > 50) tags.push('track_advanced');

    return tags;
  }

  /**
   * selectPersonalizedClose — finds the best matching close for session tags + session number.
   * Multi-tag closes (priority 4) always win over single-tag.
   * Fallback: hrv_shift_moderate for session range.
   */
  async function selectPersonalizedClose(tags, sessionNumber) {
    const closes = await pool.query(
      `SELECT * FROM personalized_closes
       WHERE session_range_min <= $1 AND session_range_max >= $1
       AND active = true
       ORDER BY priority DESC`,
      [sessionNumber]
    );

    if (closes.rows.length === 0) return null;

    // Filter: all tags in close.tags must exist in session tags
    let bestMatch = null;
    let bestScore = -1;

    for (const close of closes.rows) {
      const closeTags = Array.isArray(close.tags) ? close.tags : JSON.parse(close.tags || '[]');
      const allMatch = closeTags.every(t => tags.includes(t));
      if (!allMatch) continue;

      // Score: priority * 10 + number of matching tags
      const score = close.priority * 10 + closeTags.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = close;
      }
    }

    // Fallback: hrv_shift_moderate for session range
    if (!bestMatch) {
      bestMatch = closes.rows.find(c => {
        const ct = Array.isArray(c.tags) ? c.tags : JSON.parse(c.tags || '[]');
        return ct.length === 1 && ct[0] === 'hrv_shift_moderate';
      }) || null;
    }

    return bestMatch;
  }

  /**
   * updateSessionClose — saves personalized close reference on session_completions.
   */
  async function updateSessionClose(closeId, tags) {
    try {
      await pool.query(
        `UPDATE session_completions
         SET personalized_close_id = $1, personalized_close_tags = $2
         WHERE user_id = $3 AND session_id = $4`,
        [closeId, JSON.stringify(tags), userId, sessionId]
      );
    } catch (err) {
      console.error('[ABI] Failed to save personalized close:', err.message);
      Sentry.captureException(err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SOMATIC RESET — HELPERS + LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  async function getSomaticExercise(protocol, activityNumber) {
    const result = await pool.query(
      'SELECT * FROM somatic_exercises WHERE protocol = $1 AND activity_number = $2 AND active = true',
      [protocol, activityNumber]
    );
    return result.rows[0] || null;
  }

  async function updateSessionSomatic(exerciseId, hrvPre, hrvPost, shiftPct) {
    await pool.query(
      `UPDATE session_completions
       SET somatic_exercise_used = $1, somatic_hrv_pre = $2, somatic_hrv_post = $3, somatic_shift_pct = $4
       WHERE user_id = $5 AND session_id = $6`,
      [exerciseId, hrvPre, hrvPost, shiftPct, userId, rawSession?.session_number || 1]
    );
  }

  async function onSomaticComplete(exerciseId, hrvPre, hrvPost) {
    const shiftPct = hrvPre > 0 ? ((hrvPost - hrvPre) / hrvPre) * 100 : 0;

    // Log to session_completions
    try {
      await updateSessionSomatic(exerciseId, hrvPre, hrvPost, shiftPct);
    } catch (err) {
      console.error('[ABI] Failed to log somatic data:', err.message);
      Sentry.captureException(err);
    }

    // Pivot logic: if shift < 10%, try next exercise (max 2 total)
    if (shiftPct < 10 && somaticExerciseCount < 2) {
      // Check current exercise for pivot_if_no_shift
      try {
        const current = await getSomaticExercise(
          arrivalBaseline.resting_hr > 100 ? 'hyperarousal'
            : arrivalBaseline.resting_hr < 55 ? 'hypoarousal'
            : 'court_day',
          somaticExerciseCount
        );
        if (current?.abi_watch_for?.pivot_if_no_shift) {
          const nextExercise = await getSomaticExercise(
            current.protocol,
            somaticExerciseCount + 1
          );
          if (nextExercise) {
            somaticExerciseCount++;
            onLunoSpeak(nextExercise.luno_intro);
            return {
              pivot: true,
              somatic_exercise: nextExercise,
              shift_pct: shiftPct,
              attempt: somaticExerciseCount
            };
          }
        }
      } catch (err) {
        console.error('[ABI] Somatic pivot lookup failed:', err.message);
      Sentry.captureException(err);
      }
    }

    // Max exercises attempted with no shift → Companionship Mode
    if (shiftPct < 10 && somaticExerciseCount >= 2) {
      somaticActive = false;
      isCompanionshipMode = true;
      companionshipMode = new CompanionshipMode();
      companionshipMode.activate();
      sessionPhase = 'breathing';
      onLunoSpeak("Your body is asking for something different today. Unc's just going to sit with you.");
      return {
        somatic_complete: true,
        shift_pct: shiftPct,
        companionship_mode: true
      };
    }

    // Sufficient shift — proceed to breathwork
    somaticActive = false;
    sessionPhase = 'breathing';
    breathingStartTime = Date.now();

    // Now run the rest of onArrivalComplete logic (state engine, detection, breath params)
    // by re-calling with the stored baseline
    if (stateEngine) stateEngine.setBaseline(arrivalBaseline);

    return {
      somatic_complete: true,
      shift_pct: shiftPct,
      proceed_to_breathwork: true
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
    onSomaticComplete,    // somatic exercise finished — pivot or proceed

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
    getImmuneSystem: () => immuneSystem,
    isSomaticActive: () => somaticActive
  };
}

// ── EXPORTS ──────────────────────────────────────────────────

module.exports = { createOrchestrator };
