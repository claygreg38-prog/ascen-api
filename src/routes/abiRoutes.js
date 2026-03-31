// ============================================================
// ASCEN ABI System Routes
// File: src/routes/abiRoutes.js
//
// Exposes the fully-wired ABI orchestrator and individual
// system endpoints to:
//   1. Frontend (session lifecycle API)
//   2. Clinical Dashboard (read-only monitoring)
//   3. Facility Admin (identity gate, immune override)
//
// v8: DB-backed session state via sessionStateManager.
// Orchestrator lives in-memory (closures), linked by session_key.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const { createOrchestrator } = require('../abi/sessionOrchestrator');
const { ImmuneSystem } = require('../abi/immuneSystem');
const { HomeostaticRegulator } = require('../abi/homeostaticRegulator');
const { analyzeTrends, getDashboardSummary, shouldRunTrendAnalysis } = require('../abi/trendAnalyzer');
const { adaptDrill, getAllDrillsForUser, filterDrillRecommendation } = require('../abi/drillAdapter');
const { IdentityGate } = require('../abi/identityEngagement');
const sessionStateManager = require('../services/sessionStateManager');
const { evaluateRatioSustainability, updateBiometricBuffer, cooldownElapsed, canStepDown, MAX_STEP_DOWNS, STEP_DOWN_PARAMS } = require('../abi/ratioStepDown');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── ACTIVE SESSION STORE ────────────────────────────────────
// In-memory map of active orchestrators keyed by session_key (sk_...).
// Also supports legacy composite keys (userId:sessionId).
// One orchestrator per active session.
const activeSessions = new Map();

function makeSessionKey(userId, sessionId) {
  return `${userId}:${sessionId}`;
}

// ── SESSION RESOLUTION HELPER ───────────────────────────────
// Resolves session from:
//   1. session_key in body (POST) or x-session-key header (GET)
//   2. Legacy: user_id + session_id composite
function resolveSession(req) {
  let key = req.headers['x-session-key'] || null;

  if (!key) {
    key = req.body?.session_key || null;
  }

  if (!key) {
    const userId = req.body?.user_id || req.body?.userId;
    const sessionId = req.body?.session_id || req.body?.sessionId;
    if (userId && sessionId) {
      key = makeSessionKey(userId, sessionId);
    }
  }

  if (!key) return { key: null, session: null };

  const session = activeSessions.get(key);
  return { key, session };
}

// Extract userId/sessionId from request body (normalize snake_case)
function extractIds(body) {
  return {
    userId: body.user_id || body.userId,
    sessionId: body.session_id || body.sessionId
  };
}

// Drain pending events from an in-memory session
function drainEvents(session) {
  const events = [...session.pendingEvents];
  session.pendingEvents.length = 0;
  return events;
}

// ═══════════════════════════════════════════════════════════════
// 1. SESSION LIFECYCLE ROUTES (Frontend)
// ═══════════════════════════════════════════════════════════════

// ── START SESSION ───────────────────────────────────────────
// POST /api/abi/session/start
// Body: { userId, sessionId, options? }
// Returns: session config (adapted protocol, detection mode, etc.)

router.post('/session/start', async (req, res) => {
  const isAborted = () => req.socket?.destroyed || res.destroyed;

  try {
    let { userId, sessionId } = extractIds(req.body);
    const options = req.body.options || {};

    // Fall back to JWT user identity (numeric DB id, stored as TEXT in session_completions)
    if (!userId) {
      userId = String(req.user?.userId || '');
    }

    // Build sessionId from session_number if not provided directly
    if (!sessionId) {
      const sn = req.body.session_number || 1;
      sessionId = `S${sn}`;
    }

    if (!userId || !sessionId) {
      return res.status(400).json({ error: 'userId and sessionId required' });
    }

    const sessionNumber = parseInt(String(sessionId).replace(/\D/g, '')) || 1;

    // Register DB-backed session state (tenant-scoped)
    const dbSessionKey = await sessionStateManager.registerSession(userId, sessionId, sessionNumber, req.tenantId);

    // Create orchestrator with event callbacks that persist to DB
    const pendingEvents = [];

    const abi = createOrchestrator({
      onLunoSpeak: (text) => {
        const evt = { type: 'luno_speak', text, ts: Date.now() };
        pendingEvents.push(evt);
        sessionStateManager.pushEvent(dbSessionKey, evt).catch(() => {});
      },
      onPacerUpdate: (config) => {
        const evt = { type: 'pacer_update', config, ts: Date.now() };
        pendingEvents.push(evt);
      },
      onPacerPause: () => {
        const evt = { type: 'pacer_pause', ts: Date.now() };
        pendingEvents.push(evt);
      },
      onPacerResume: () => {
        const evt = { type: 'pacer_resume', ts: Date.now() };
        pendingEvents.push(evt);
      },
      onSessionEnd: (result) => {
        const evt = { type: 'session_end', result, ts: Date.now() };
        pendingEvents.push(evt);
      },
      onMirrorData: (data) => {
        const evt = { type: 'mirror_data', data, ts: Date.now() };
        pendingEvents.push(evt);
      },
      onOfferExit: () => {
        const evt = { type: 'offer_exit', ts: Date.now() };
        pendingEvents.push(evt);
        sessionStateManager.pushEvent(dbSessionKey, evt).catch(() => {});
      },
      onOfferDrill: (drillData) => {
        const evt = { type: 'offer_drill', drillData, ts: Date.now() };
        pendingEvents.push(evt);
        sessionStateManager.pushEvent(dbSessionKey, evt).catch(() => {});
      },
      onIdentityChallenge: (config) => {
        pendingEvents.push({ type: 'identity_challenge', config, ts: Date.now() });
      },
      onStateChange: (stateData) => {
        const evt = { type: 'state_change', stateData, ts: Date.now() };
        pendingEvents.push(evt);
        sessionStateManager.pushEvent(dbSessionKey, evt).catch(() => {});
      }
    });

    const config = await abi.onSessionStart(userId, sessionId, options);

    if (isAborted() || res.headersSent) return;

    // Store orchestrator in memory, keyed by DB session key
    const legacyKey = makeSessionKey(userId, sessionId);
    const sessionEntry = { abi, pendingEvents, startedAt: Date.now(), dbSessionKey };
    activeSessions.set(dbSessionKey, sessionEntry);
    activeSessions.set(legacyKey, sessionEntry); // backward compat

    // Drain any events that fired during start
    const events = [...pendingEvents];
    pendingEvents.length = 0;

    res.json({ success: true, session_key: dbSessionKey, config, events });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Session start error:', error.message);
    if (!isAborted() && !res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});


// ── ARRIVAL SAMPLE (baseline filter feed) ───────────────────
// POST /api/abi/session/arrival-sample
// Body: { session_key, biometrics: { heart_rate, hrv, coherence, respiratory_rate } }
// Called every second during Arrival phase. Capped at 60 samples (sliding window).

router.post('/session/arrival-sample', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const biometrics = req.body.biometrics;
    const sk = session.dbSessionKey || key;

    // Feed orchestrator
    session.abi.onArrivalSample(biometrics);

    // [CP1] Structured log — BLE arrival sample
    console.log(`[CP1][${new Date().toISOString()}] BLE_READ | HR:${biometrics?.heart_rate || '-'} RMSSD:${biometrics?.hrv || '-'} COH:${biometrics?.coherence || '-'}`);

    // Persist sample to DB (sliding window capped at 60)
    await sessionStateManager.pushArrivalSample(sk, {
      ...biometrics,
      ts: Date.now()
    });

    const sampleCount = await sessionStateManager.getArrivalSampleCount(sk);

    // Check arrival duration for Sentry alert at 3 minutes
    const dbSession = await sessionStateManager.getSession(sk);
    if (dbSession) {
      const arrivalMs = Date.now() - new Date(dbSession.arrivalStartedAt).getTime();
      if (arrivalMs > 180000 && !dbSession._arrivalWarningFired) {
        Sentry.captureMessage('Arrival phase exceeding 3 minutes', 'warning');
        sessionStateManager.updateSessionState(sk, { _arrivalWarningFired: true }).catch(() => {});
      }
      // 5-minute arrival timeout — auto-complete
      if (arrivalMs > 300000) {
        try {
          const result = await session.abi.onArrivalComplete(biometrics);
          const events = drainEvents(session);
          await sessionStateManager.updateSessionState(sk, {
            phase: 'breathing',
            adaptedSession: result
          });
          return res.json({
            received: true,
            sample_count: sampleCount,
            auto_completed: true,
            result,
            events
          });
        } catch (err) {
          Sentry.captureException(err);
        }
      }
    }

    res.json({ received: true, sample_count: sampleCount });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ── ARRIVAL COMPLETE ────────────────────────────────────────
// POST /api/abi/session/arrival-complete
// Body: { session_key, biometrics }
// Returns: adapted session with breathwork_mode and ratio

router.post('/session/arrival-complete', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);

    // If in-memory session lost (redeploy, process restart), fall back to DB-persisted state
    if (!session) {
      const sk = req.headers['x-session-key'] || req.body?.session_key;
      if (sk) {
        console.warn(`[ABI] arrival-complete: in-memory session lost for ${sk}, falling back to DB baseline`);
        const dbSession = await sessionStateManager.getSession(sk);
        if (dbSession) {
          const samples = dbSession.arrivalSamples || [];
          const last30 = samples.slice(-30);
          const bio = req.body.biometrics || {};
          const arrivalBaseline = {
            mean_hr: last30.length ? last30.reduce((s, x) => s + (x.heart_rate || x.current_hr || 0), 0) / last30.length : bio.resting_hr || 68,
            mean_hrv: last30.length ? last30.reduce((s, x) => s + (x.hrv || x.rmssd || 0), 0) / last30.length : bio.resting_hrv || 35,
            initial_coherence: last30.length ? last30.reduce((s, x) => s + (x.coherence || 0), 0) / last30.length : 0.3
          };

          // Determine breath params from DB samples
          let ratio = '3:5', breathIn = 3, breathOut = 5; // Conservative fallback
          try {
            const { determineBreathParams } = require('../abi/determineBreathParams');
            const params = await determineBreathParams(
              { resting_hr: arrivalBaseline.mean_hr, resting_hrv: arrivalBaseline.mean_hrv, respiratory_rate: bio.respiratory_rate || 14 },
              { adaptive_ratio: true },
              null,
              { pool: require('../db/pool'), userId: dbSession.userId }
            );
            ratio = params.ratio || ratio;
            breathIn = params.inhale_sec || params.inhale || breathIn;
            breathOut = params.exhale_sec || params.exhale || breathOut;
          } catch (e) { console.warn('[ABI] DB-fallback determineBreathParams failed:', e.message); }

          await sessionStateManager.updateSessionState(sk, { phase: 'breathing', current_ratio: ratio, arrival_ratio: ratio });

          return res.json({
            success: true,
            result: { breath_params: { ratio, inhale_sec: breathIn, exhale_sec: breathOut } },
            adapted_session: { ratio, breath_in: breathIn, breath_out: breathOut, duration_seconds: 180, breathwork_mode: 'simple_pacer', track: 'standard' },
            arrival_baseline: arrivalBaseline,
            events: [],
            _fallback: true
          });
        }
      }
      return res.status(404).json({ error: 'No active session' });
    }

    const biometrics = req.body.biometrics;
    const result = await session.abi.onArrivalComplete(biometrics);
    const events = drainEvents(session);
    const sk = session.dbSessionKey || key;

    // Persist adapted session, phase transition, and ratio tracking to DB
    const assignedRatio = result?.breath_params?.ratio || result?.session_update?.breath_ratio || result?.ratio || '4:6';
    await sessionStateManager.updateSessionState(sk, {
      phase: 'breathing',
      adaptedSession: result,
      // Ratio step-down tracking
      current_ratio: assignedRatio,
      arrival_ratio: assignedRatio,
      step_down_count: 0,
      last_step_down_at: null,
      ratio_history: [],
      biometric_buffer: [],
      somatic_reset_triggered: false,
      somatic_reset_at: null
    });

    // Build arrival baseline from DB samples
    const dbSession = await sessionStateManager.getSession(sk);
    const samples = dbSession?.arrivalSamples || [];
    const last30 = samples.slice(-30);
    const arrivalBaseline = {
      mean_hr: last30.length ? last30.reduce((s, x) => s + (x.heart_rate || 0), 0) / last30.length : 0,
      mean_hrv: last30.length ? last30.reduce((s, x) => s + (x.hrv || 0), 0) / last30.length : 0,
      initial_coherence: last30.length ? last30.reduce((s, x) => s + (x.coherence || 0), 0) / last30.length : 0
    };

    // Extract ratio from orchestrator result
    // Orchestrator returns: breath_params.ratio, session_update.breath_ratio
    const resolvedRatio = result?.breath_params?.ratio
      || result?.session_update?.breath_ratio
      || result?.ratio || '4:6';
    const resolvedDuration = result?.breath_params?.duration_seconds
      || result?.session_update?.duration_seconds
      || result?.duration_seconds || 180;

    res.json({
      success: true,
      result,
      adapted_session: {
        breathwork_mode: result?.session_update?.mode || result?.breathwork_mode || 'simple_pacer',
        ratio: resolvedRatio,
        track: result?.session_update?.track || result?.track || 'standard',
        duration_seconds: resolvedDuration,
        arc: result?.arc || 'foundation',
        breath_in: result?.breath_params?.inhale_sec || result?.session_update?.breath_in,
        breath_out: result?.breath_params?.exhale_sec || result?.session_update?.breath_out
      },
      arrival_baseline: arrivalBaseline,
      events
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ── SOMATIC COMPLETE ────────────────────────────────────────
// POST /api/abi/session/somatic-complete

router.post('/session/somatic-complete', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const { exerciseId, hrvPre, hrvPost } = req.body;
    if (!exerciseId || hrvPre == null || hrvPost == null) {
      return res.status(400).json({ error: 'exerciseId, hrvPre, and hrvPost required' });
    }

    const result = await session.abi.onSomaticComplete(exerciseId, hrvPre, hrvPost);
    const events = drainEvents(session);

    // Check if this was a mid-session somatic reset (ratio floor + distress)
    const sk = session.dbSessionKey || key;
    const dbState = await sessionStateManager.getSession(sk);
    let mid_session_somatic_result = null;

    if (dbState?.somatic_reset_triggered) {
      // Somatic reset complete — resume at 2:3.
      // The frontend will resume the pacer. If distress continues
      // post-somatic, the next tick evaluation will trigger graceful end.
      await sessionStateManager.updateSessionState(sk, {
        somatic_reset_completed: true,
        somatic_reset_completed_at: new Date().toISOString(),
        post_somatic_monitoring: true
      });
      mid_session_somatic_result = {
        type: 'mid_session_somatic_reset_complete',
        resume_ratio: '2:3',
        message: "You showed up. That's the work."
      };
    }

    res.json({ success: true, result, events, mid_session_somatic_result });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ── BREATHING TICK ──────────────────────────────────────────
// POST /api/abi/session/tick

router.post('/session/tick', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) {
      // In-memory session lost (redeploy). Return minimal tick so frontend doesn't break.
      const sk = req.headers['x-session-key'] || req.body?.session_key;
      if (sk) {
        const dbState = await sessionStateManager.getSession(sk);
        if (dbState) {
          return res.json({
            success: true, result: { action: 'none' }, events: [],
            current_ratio: dbState.current_ratio || null,
            ns3: null, coherence: req.body?.biometrics?.coherence || null,
            breath_count: 0, elapsed: 0, _fallback: true
          });
        }
      }
      return res.status(404).json({ error: 'No active session' });
    }

    const biometrics = req.body.biometrics;
    const tickStart = Date.now();
    const result = await session.abi.onBreathingTick(biometrics);
    const events = drainEvents(session);
    const tickLatency = Date.now() - tickStart;
    const sk = session.dbSessionKey || key;

    // [CP2] Structured log — tick processed
    console.log(`[CP2][${new Date().toISOString()}] TICK | SK:${sk} STATUS:${result ? 'ok' : 'empty'} LATENCY:${tickLatency}ms`);

    // Persist coherence peak to DB (non-blocking)
    const coherence = biometrics?.coherence || 0;
    if (coherence > 0) {
      sessionStateManager.updateSessionState(sk, {
        breathCount: (result?.breath_count || 0),
        coherencePeak: Math.max(coherence, 0)
      }).catch(() => {});
    }

    // ── DRIFTING WORD — milestone-triggered textless UI word ──
    // 99% of ticks return null. Fires only at rare, meaningful moments.
    let drifting_word = null;
    if (!session._driftingMilestones) session._driftingMilestones = new Set();
    const milestones = session._driftingMilestones;
    const breathCount = result?.breath_count || 0;
    const currentCoherence = biometrics?.coherence || 0;
    const priorPeak = session._priorCoherencePeak || 0;

    if (currentCoherence >= 0.7 && priorPeak < 0.7 && !milestones.has('arriving')) {
      drifting_word = 'arriving';
      milestones.add('arriving');
    } else if (currentCoherence > priorPeak + 0.1 && currentCoherence > 0.5 && !milestones.has('deeper_' + Math.floor(currentCoherence * 10))) {
      drifting_word = 'deeper';
      milestones.add('deeper_' + Math.floor(currentCoherence * 10));
    } else if (breathCount === 10 && !milestones.has('breath_10')) {
      drifting_word = 'steady';
      milestones.add('breath_10');
    } else if (breathCount === 25 && !milestones.has('breath_25')) {
      drifting_word = 'building';
      milestones.add('breath_25');
    } else if (breathCount === 50 && !milestones.has('breath_50')) {
      drifting_word = 'rooted';
      milestones.add('breath_50');
    }

    // Track coherence peak for next tick comparison
    if (currentCoherence > priorPeak) session._priorCoherencePeak = currentCoherence;

    // ── RATIO STEP-DOWN EVALUATION ──────────────────────────
    // Evaluates biometric sustainability every tick. Silent system adaptation.
    let ratio_changed = false;
    let current_ratio = null;
    let ratio_step_downs_remaining = MAX_STEP_DOWNS;
    let somatic_reset = false;
    let graceful_end = false;

    try {
      const sk2 = session.dbSessionKey || key;
      const dbState = await sessionStateManager.getSession(sk2);
      const sessionState = dbState || {};

      // Only evaluate if ratio tracking is initialized
      if (sessionState.current_ratio) {
        current_ratio = sessionState.current_ratio;
        const stepDownCount = sessionState.step_down_count || 0;
        ratio_step_downs_remaining = MAX_STEP_DOWNS - stepDownCount;

        // Update rolling biometric buffer with this tick's data
        const hr = biometrics?.heart_rate || biometrics?.current_hr || null;
        const rmssd = biometrics?.hrv || biometrics?.rmssd || biometrics?.current_hrv || null;
        const coherence = biometrics?.coherence || biometrics?.coherence_score || null;

        if (hr != null) {
          const updatedBuffer = updateBiometricBuffer(
            sessionState.biometric_buffer || [],
            { hr, rmssd: rmssd || 0, coherence: coherence || 0, ts: Date.now() }
          );

          // Build arrival baseline for comparison
          const samples = sessionState.arrivalSamples || [];
          const last30 = samples.slice(-30);
          const arrivalBaseline = {
            hr: last30.length ? last30.reduce((s, x) => s + (x.heart_rate || 0), 0) / last30.length : 0,
            rmssd: last30.length ? last30.reduce((s, x) => s + (x.hrv || 0), 0) / last30.length : 0
          };

          const stateUpdate = { biometric_buffer: updatedBuffer };

          // Evaluate only if cooldown passed and step-downs remain
          if (canStepDown(stepDownCount) && cooldownElapsed(sessionState.last_step_down_at)) {
            const stepResult = evaluateRatioSustainability(current_ratio, arrivalBaseline, updatedBuffer);

            if (stepResult.step_down) {
              // System adapted breath ratio based on biometric feedback
              const newCount = stepDownCount + 1;
              const now = Date.now();
              const historyEntry = {
                from: stepResult.previous,
                to: stepResult.new_ratio,
                reason: stepResult.reason,
                timestamp: new Date(now).toISOString(),
                evidence: stepResult.evidence
              };

              stateUpdate.current_ratio = stepResult.new_ratio;
              stateUpdate.step_down_count = newCount;
              stateUpdate.last_step_down_at = now;
              stateUpdate.ratio_history = [...(sessionState.ratio_history || []), historyEntry];

              ratio_changed = true;
              current_ratio = stepResult.new_ratio;
              ratio_step_downs_remaining = MAX_STEP_DOWNS - newCount;

              // [CP6] Structured log — ratio step-down
              const elapsed = session.startedAt ? Math.round((Date.now() - session.startedAt) / 1000) : 0;
              console.log(JSON.stringify({
                cp: 'CP6', type: 'ratio_step_down',
                session_key: sk2,
                previous_ratio: stepResult.previous,
                new_ratio: stepResult.new_ratio,
                reason: stepResult.reason,
                evidence: stepResult.evidence,
                step_down_number: newCount,
                elapsed_seconds: elapsed,
                timestamp: new Date().toISOString()
              }));
            }

            // Check for somatic reset trigger at floor
            if (stepResult.at_floor && stepResult.sustained_distress && !sessionState.somatic_reset_triggered) {
              stateUpdate.somatic_reset_triggered = true;
              stateUpdate.somatic_reset_at = new Date().toISOString();
              somatic_reset = true;

              console.log(JSON.stringify({
                cp: 'CP6', type: 'somatic_reset_at_floor',
                session_key: sk2,
                current_ratio: '2:3',
                reason: 'sustained_distress_at_floor',
                evidence: stepResult.evidence,
                timestamp: new Date().toISOString()
              }));
            }

            // Post-somatic continued distress → graceful session end
            // If somatic reset was completed and distress continues at floor, end the session
            if (stepResult.at_floor && stepResult.sustained_distress
                && sessionState.somatic_reset_completed && !sessionState.graceful_end_triggered) {
              stateUpdate.graceful_end_triggered = true;
              stateUpdate.graceful_end_at = new Date().toISOString();
              stateUpdate.graceful_end_reason = 'post_somatic_continued_distress';
              graceful_end = true;

              console.log(JSON.stringify({
                cp: 'CP6', type: 'graceful_session_end',
                session_key: sk2,
                current_ratio: '2:3',
                reason: 'post_somatic_continued_distress',
                evidence: stepResult.evidence,
                timestamp: new Date().toISOString()
              }));
            }
          }

          await sessionStateManager.updateSessionState(sk2, stateUpdate);
        }
      }
    } catch (err) {
      // Non-blocking — ratio evaluation failure never breaks the tick
      console.error('[RatioStepDown] Evaluation failed (non-blocking):', err.message);
      Sentry.captureException(err);
    }

    // [CP4] Structured log — tick response (weather/ratio sent to frontend)
    console.log(`[CP4][${new Date().toISOString()}] TICK_RESP | RATIO:${current_ratio || result?.session_update?.breath_ratio || result?.breath_ratio || '-'} NS3:${result?.ns3?.score || '-'} ZONE:${result?.ns3?.zone || '-'} DRIFT:${drifting_word || 'none'} BREATH:${breathCount}`);

    res.json({
      success: true,
      result,
      events,
      drifting_word,
      ratio_changed,
      current_ratio: current_ratio || result?.session_update?.breath_ratio || result?.breath_ratio || null,
      new_ratio: ratio_changed ? current_ratio : undefined,
      ratio_step_downs_remaining,
      somatic_reset,
      graceful_end,
      graceful_end_message: graceful_end ? "You showed up. That's the work." : undefined,
      // Populate NS3/coherence so frontend can drive plankton feedback
      ns3: result?.ns3 || null,
      coherence: biometrics?.coherence || biometrics?.coherence_score || null,
      breath_count: result?.breath_count || breathCount || 0,
      elapsed: result?.elapsed || 0
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ── PAUSE / RESUME / EXIT ───────────────────────────────────

router.post('/session/pause', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    session.abi.onPauseTap();
    const events = drainEvents(session);
    const sk = session.dbSessionKey || key;

    await sessionStateManager.updateSessionState(sk, {
      paused: true,
      pausedAt: Date.now()
    });

    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
    res.json({ success: true, paused: true, elapsed_seconds: elapsed, events });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/session/resume', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    session.abi.onResumeTap();
    const events = drainEvents(session);
    const sk = session.dbSessionKey || key;

    await sessionStateManager.updateSessionState(sk, {
      paused: false,
      pausedAt: null
    });

    res.json({ success: true, resumed: true, events });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/session/exit', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    session.abi.onExitTap();
    const events = drainEvents(session);
    const sk = session.dbSessionKey || key;

    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);

    // Deactivate in DB
    await sessionStateManager.updateSessionState(sk, { phase: 'exited' });
    await sessionStateManager.deactivateSession(sk);

    // Clean up in-memory
    if (key) activeSessions.delete(key);
    if (sk && sk !== key) activeSessions.delete(sk);

    res.json({
      success: true,
      exited: true,
      mirror: {
        breath_count: session.abi.getActiveSeconds ? Math.floor(session.abi.getActiveSeconds() / 6) : 0,
        duration_seconds: elapsed,
        coherence_peak: 0
      },
      events
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ── DRILL SELECTION ─────────────────────────────────────────
// POST /api/abi/session/drill-select  (legacy)
// POST /api/abi/drill/select          (v8 pattern)

router.post('/session/drill-select', (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const drillId = req.body.drillId || req.body.drill_id;
    const result = session.abi.onDrillSelected(drillId);
    const events = drainEvents(session);
    res.json({ success: true, result, events });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

// v8 drill select — looks up from somatic_exercises DB table
router.post('/drill/select', async (req, res) => {
  try {
    const { session_key, drill_id } = req.body;
    const session = activeSessions.get(session_key);

    // Also try orchestrator drill handler
    if (session) {
      session.abi.onDrillSelected(drill_id);
    }

    // Look up drill from DB
    const result = await pool.query(
      'SELECT id, name, instructions, duration_sec, protocol FROM somatic_exercises WHERE id = $1',
      [drill_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Drill not found' });
    }

    const drill = result.rows[0];
    res.json({
      drill_id: drill.id,
      name: drill.name,
      instructions: drill.instructions,
      duration_seconds: drill.duration_sec,
      type: drill.protocol
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ── BLE DISCONNECT / RECONNECT ──────────────────────────────

router.post('/session/ble-disconnect', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    session.abi.onBLEDisconnect();
    const events = drainEvents(session);
    const sk = session.dbSessionKey || key;

    await sessionStateManager.updateSessionState(sk, {
      bleConnected: false,
      bleDisconnectedAt: Date.now()
    });

    res.json({ success: true, acknowledged: true, grace_period_seconds: 30, events });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/session/ble-reconnect', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    session.abi.onBLEReconnect();
    const events = drainEvents(session);
    const sk = session.dbSessionKey || key;

    await sessionStateManager.updateSessionState(sk, {
      bleConnected: true,
      bleDisconnectedAt: null
    });

    res.json({ success: true, reconnected: true, events });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ── SESSION COMPLETE ────────────────────────────────────────

router.post('/session/complete', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) {
      // In-memory session lost (redeploy). Return minimal completion so frontend can proceed.
      const sk = req.headers['x-session-key'] || req.body?.session_key;
      if (sk) {
        console.warn(`[ABI] session/complete: in-memory session lost for ${sk}, returning partial`);
        const metrics = req.body.rawMetrics || req.body.metrics || {};
        return res.json({
          success: true,
          result: {
            breath_count: metrics.breath_count || 0,
            duration_seconds: metrics.duration_seconds || 0,
            coherence_peak: metrics.coherence_peak || 0,
          },
          events: [], _fallback: true
        });
      }
      return res.status(404).json({ error: 'No active session' });
    }

    const rawMetrics = req.body.rawMetrics || req.body.metrics || {};
    const result = await session.abi.onSessionComplete(rawMetrics);
    const events = drainEvents(session);
    const sk = session.dbSessionKey || key;

    // Deactivate DB session
    await sessionStateManager.updateSessionState(sk, { phase: 'completed' });
    await sessionStateManager.deactivateSession(sk);

    // Clean up in-memory
    if (key) activeSessions.delete(key);
    if (sk && sk !== key) activeSessions.delete(sk);

    res.json({ success: true, result, events });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Session complete error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// ── SESSION STATUS (legacy: two URL params) ─────────────────
// GET /api/abi/session/status/:userId/:sessionId
router.get('/session/status/:userId/:sessionId', (req, res) => {
  const { userId, sessionId } = req.params;
  const session = activeSessions.get(makeSessionKey(userId, sessionId));

  if (!session) return res.json({ active: false });

  res.json({
    active: true,
    phase: session.abi.getSessionPhase(),
    paused: session.abi.ispaused(),
    activeSeconds: session.abi.getActiveSeconds(),
    detectionMode: session.abi.getDetectionMode(),
    startedAt: session.startedAt
  });
});

// ── SESSION STATE ───────────────────────────────────────────
// GET /api/abi/session/state           (header: x-session-key)
// GET /api/abi/session/state/:sessionKey  (v8 URL param pattern)
router.get('/session/state/:sessionKey?', async (req, res) => {
  try {
    const key = req.params.sessionKey || req.headers['x-session-key'];
    if (!key) return res.status(400).json({ error: 'Missing session key' });

    const session = activeSessions.get(key);
    if (session) {
      return res.json({
        session_key: key,
        state: session.abi.getSessionPhase(),
        elapsed: session.abi.getActiveSeconds(),
        coherence: 0,
        ns3_zone: 'unknown',
        paused: session.abi.ispaused()
      });
    }

    // Fall back to DB state
    const dbSession = await sessionStateManager.getSession(key);
    if (!dbSession) return res.status(404).json({ error: 'Session not found' });

    res.json({
      session_key: key,
      state: dbSession.phase || 'unknown',
      elapsed: dbSession.startedAt ? Math.floor((Date.now() - dbSession.startedAt) / 1000) : 0,
      coherence: dbSession.coherencePeak || 0,
      ns3_zone: 'unknown',
      paused: dbSession.paused || false
    });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── ADAPTED SESSION ─────────────────────────────────────────
// GET /api/abi/session/adapted           (header)
// GET /api/abi/session/adapted/:sessionKey  (v8 URL param)
router.get('/session/adapted/:sessionKey?', async (req, res) => {
  try {
    const key = req.params.sessionKey || req.headers['x-session-key'];
    if (!key) return res.status(400).json({ error: 'Missing session key' });

    const session = activeSessions.get(key);
    if (session) {
      const adapted = session.abi.getAdaptedSession ? session.abi.getAdaptedSession() : {};
      return res.json({ session_key: key, adapted_session: adapted });
    }

    // Fall back to DB
    const dbSession = await sessionStateManager.getSession(key);
    if (!dbSession) return res.status(404).json({ error: 'Session not found' });

    res.json({
      session_key: key,
      adapted_session: dbSession.adaptedSession || {}
    });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PENDING EVENTS ──────────────────────────────────────────
// GET /api/abi/session/events           (header)
// GET /api/abi/session/events/:sessionKey  (v8 URL param)
router.get('/session/events/:sessionKey?', async (req, res) => {
  try {
    const key = req.params.sessionKey || req.headers['x-session-key'];
    if (!key) return res.status(400).json({ error: 'Missing session key' });

    const session = activeSessions.get(key);
    if (session) {
      const events = drainEvents(session);
      return res.json({ session_key: key, events });
    }

    // Fall back to DB events
    const events = await sessionStateManager.getAndDrainEvents(key);
    res.json({ session_key: key, events });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// 2. DRILL ROUTES
// ═══════════════════════════════════════════════════════════════

// ── GET ALL DRILLS (adapted for user's track) ───────────────
// GET /api/abi/drills/:userId
// Also serves as GET /api/abi/drills/:track for v8 (tries user first, then track)

router.get('/drills/:param', async (req, res) => {
  try {
    const { param } = req.params;

    // First try as userId
    const userResult = await pool.query(
      `SELECT * FROM users WHERE user_id = $1`, [param]
    );
    if (userResult.rows.length > 0) {
      const drills = getAllDrillsForUser(userResult.rows[0]);
      return res.json({ drills });
    }

    // Try as track name — return somatic exercises from DB
    const trackResult = await pool.query(
      `SELECT id, name, instructions, duration_sec, protocol FROM somatic_exercises ORDER BY id`
    );
    res.json({
      track: param,
      drills: trackResult.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.instructions,
        duration_seconds: r.duration_sec
      }))
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

// ── ADAPT A SPECIFIC DRILL ──────────────────────────────────
// POST /api/abi/drills/adapt

router.post('/drills/adapt', async (req, res) => {
  try {
    const { userId, drillId } = req.body;
    const userResult = await pool.query(
      `SELECT * FROM users WHERE user_id = $1`, [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const adapted = adaptDrill({ id: drillId }, userResult.rows[0]);
    res.json({ drill: adapted });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// 3. CLINICAL DASHBOARD ROUTES (read-only monitoring)
// ═══════════════════════════════════════════════════════════════

router.get('/clinical/trends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const report = await analyzeTrends(userId);
    res.json({ userId, report });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clinical/trends', async (req, res) => {
  try {
    const summary = await getDashboardSummary();
    res.json(summary);
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clinical/immune/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const immune = new ImmuneSystem(userId, pool);
    const dashboard = await immune.getDashboardView();
    res.json({ userId, immune: dashboard });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clinical/immune/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const immune = new ImmuneSystem(userId, pool);
    const history = await immune.getImmuneHistory(limit);
    res.json({ userId, history });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clinical/homeostatic/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const regulator = new HomeostaticRegulator(userId, pool);
    const status = await regulator.preSessionCheck();
    res.json({ userId, homeostatic: status });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clinical/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userResult = await pool.query(
      `SELECT user_id, breath_track, breath_track_source, breath_track_provisional,
              breath_track_set_at, breath_track_last_advanced_at,
              total_sessions_completed, immune_status, recovery_mode, safety_mode,
              gap_recovery_sessions_remaining, created_at, updated_at
       FROM users WHERE user_id = $1`, [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    const recentSessions = await pool.query(
      `SELECT session_id, session_number, completed_at, coherence_score,
              coherence_end, cycle_completion_rate, active_duration_seconds,
              pause_count, exit_type, breathwork_mode, breath_track_at_completion, arc_id
       FROM session_completions
       WHERE user_id = $1
       ORDER BY completed_at DESC LIMIT 10`, [userId]
    );

    let trend = null;
    if (user.total_sessions_completed >= 10) {
      try {
        trend = await analyzeTrends(userId);
      } catch (err) { /* non-blocking */ }
    }

    let immune = null;
    try {
      const immuneSystem = new ImmuneSystem(userId, pool);
      immune = await immuneSystem.getDashboardView();
    } catch (err) { /* non-blocking */ }

    res.json({
      user,
      recent_sessions: recentSessions.rows,
      trend,
      immune,
      active_session: activeSessions.has(userId) || null
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// 4. FACILITY ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════

router.post('/admin/immune-override', async (req, res) => {
  try {
    const { userId, clinicianId, action } = req.body;

    if (!userId || !clinicianId || !action) {
      return res.status(400).json({ error: 'userId, clinicianId, and action required' });
    }

    const validActions = ['clear_safety', 'set_watch', 'escalate'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Must be: ${validActions.join(', ')}` });
    }

    let newStatus;
    let safetyMode = false;
    switch (action) {
      case 'clear_safety':
        newStatus = 'clear';
        safetyMode = false;
        break;
      case 'set_watch':
        newStatus = 'watch';
        safetyMode = false;
        break;
      case 'escalate':
        newStatus = 'alert';
        safetyMode = true;
        break;
    }

    await pool.query(
      `UPDATE users SET
         immune_status = $1,
         safety_mode = $2,
         last_immune_scan = NOW(),
         updated_at = NOW()
       WHERE user_id = $3`,
      [newStatus, safetyMode, userId]
    );

    await pool.query(
      `INSERT INTO immune_events (user_id, event_type, event_subtype, response_level, action_taken, detail, created_at)
       VALUES ($1, 'clinician_override', $2, 0, $3, $4, NOW())`,
      [userId, action, `status_set_to_${newStatus}`, `Clinician ${clinicianId} override`]
    );

    res.json({
      success: true,
      userId,
      new_status: newStatus,
      safety_mode: safetyMode,
      overridden_by: clinicianId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/active-sessions', async (req, res) => {
  const sessions = [];
  for (const [key, session] of activeSessions.entries()) {
    // Skip duplicate legacy key entries
    if (session.dbSessionKey && key !== session.dbSessionKey) continue;
    sessions.push({
      session_key: key,
      phase: session.abi.getSessionPhase(),
      paused: session.abi.ispaused(),
      activeSeconds: session.abi.getActiveSeconds(),
      detectionMode: session.abi.getDetectionMode(),
      startedAt: session.startedAt
    });
  }

  // Also include DB-only active sessions
  const dbCount = await sessionStateManager.getActiveSessionCount();

  res.json({ active_count: sessions.length, db_active_count: dbCount, sessions });
});


// ═══════════════════════════════════════════════════════════════
// 5. SYSTEM HEALTH
// ═══════════════════════════════════════════════════════════════

router.get('/health', async (req, res) => {
  let dbOk = false;
  let totalSessions = 0;
  let activeSessCount = 0;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
    totalSessions = await sessionStateManager.getTotalSessionCount();
    activeSessCount = await sessionStateManager.getActiveSessionCount();
  } catch (err) { /* db down */ }

  res.json({
    status: dbOk ? 'healthy' : 'degraded',
    system: 'ABI / ANS / AXIS — Adaptive Breath Intelligence',
    version: '2.1',
    systems_wired: 14,
    systems_total: 14,
    active_sessions: activeSessCount,
    total_sessions_in_db: totalSessions,
    ns3_available: true,
    luno_online: true,
    blockchain_mode: process.env.BLOCKCHAIN_SIMULATION === 'true' ? 'simulation' : 'live',
    modules: {
      breathProtocolAdapter: 'connected',
      pauseHandler: 'connected',
      sessionSafetyGuards: 'connected',
      microAffirmations: 'connected',
      stateEngine: 'connected',
      coachingEngine: 'connected',
      lunoIntelligence: 'connected',
      immuneSystem: 'connected',
      homeostaticRegulator: 'connected',
      biometricResilience: 'connected',
      identityEngagement: 'connected',
      baselineFilter: 'connected',
      drillAdapter: 'connected',
      trendAnalyzer: 'connected'
    },
    timestamp: new Date().toISOString()
  });
});


module.exports = router;
module.exports.activeSessions = activeSessions;
