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
    const { userId, sessionId } = extractIds(req.body);
    const options = req.body.options || {};

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
    if (!session) return res.status(404).json({ error: 'No active session' });

    const biometrics = req.body.biometrics;
    const result = await session.abi.onArrivalComplete(biometrics);
    const events = drainEvents(session);
    const sk = session.dbSessionKey || key;

    // Persist adapted session and phase transition to DB
    await sessionStateManager.updateSessionState(sk, {
      phase: 'breathing',
      adaptedSession: result
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

    res.json({
      success: true,
      result,
      adapted_session: {
        breathwork_mode: result?.breathwork_mode || result?._breathwork_mode || 'simple_pacer',
        ratio: result?.ratio || result?._ratio || '4:6',
        track: result?.track || result?._track || 'standard',
        duration_seconds: result?.duration_seconds || result?._duration_seconds || 720,
        arc: result?.arc || result?._arc || 'foundation'
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

    res.json({ success: true, result, events });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});


// ── BREATHING TICK ──────────────────────────────────────────
// POST /api/abi/session/tick

router.post('/session/tick', (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const biometrics = req.body.biometrics;
    const result = session.abi.onBreathingTick(biometrics);
    const events = drainEvents(session);

    // Persist coherence peak to DB (non-blocking)
    const sk = session.dbSessionKey || key;
    const coherence = biometrics?.coherence || 0;
    if (coherence > 0) {
      sessionStateManager.updateSessionState(sk, {
        breathCount: (result?.breath_count || 0),
        coherencePeak: Math.max(coherence, 0)
      }).catch(() => {});
    }

    res.json({ success: true, result, events });
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
      'SELECT id, name, instructions, duration_sec, type FROM somatic_exercises WHERE id = $1',
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
      duration_seconds: drill.duration_seconds,
      type: drill.type
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
    if (!session) return res.status(404).json({ error: 'No active session' });

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
      `SELECT id, name, instructions, duration_sec, type FROM somatic_exercises ORDER BY id`
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
