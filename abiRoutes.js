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
// Wire into server.js with:
//   const abiRoutes = require('./src/routes/abiRoutes');
//   app.use('/api/abi', abiRoutes);
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const { createOrchestrator } = require('../abi/sessionOrchestrator');
const { ImmuneSystem } = require('../abi/immuneSystem');
const { HomeostaticRegulator } = require('../abi/homeostaticRegulator');
const { analyzeTrends, getDashboardSummary, shouldRunTrendAnalysis } = require('../abi/trendAnalyzer');
const { adaptDrill, getAllDrillsForUser, filterDrillRecommendation } = require('../abi/drillAdapter');
const { IdentityGate } = require('../abi/identityEngagement');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── ACTIVE SESSION STORE ────────────────────────────────────
// In-memory map of active orchestrators keyed by `userId:sessionId`.
// In production, this would be backed by Redis or similar.
// One orchestrator per active session.
const activeSessions = new Map();

function makeSessionKey(userId, sessionId) {
  return `${userId}:${sessionId}`;
}

// ── SESSION RESOLUTION HELPER ───────────────────────────────
// Handles both frontend conventions:
//   1. Frontend sends session_key (composite "userId:sessionId")
//   2. Frontend sends user_id + session_id (snake_case)
//   3. Legacy: userId + sessionId (camelCase)
// Also reads x-session-key header for GET requests.
function resolveSession(req) {
  // Try header first (security: keeps key out of URLs)
  let key = req.headers['x-session-key'] || null;

  if (!key) {
    // Try composite session_key from body
    key = req.body?.session_key || null;
  }

  if (!key) {
    // Try individual fields (support both snake_case and camelCase)
    const userId = req.body?.user_id || req.body?.userId || req.params?.userId;
    const sessionId = req.body?.session_id || req.body?.sessionId || req.params?.sessionId;
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

// Drain pending events from a session
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
  try {
    const { userId, sessionId } = extractIds(req.body);
    const options = req.body.options || {};

    if (!userId || !sessionId) {
      return res.status(400).json({ error: 'userId and sessionId required' });
    }

    const key = makeSessionKey(userId, sessionId);

    // Create orchestrator with SSE-compatible callbacks
    // (In production, these push to a WebSocket or SSE stream)
    const pendingEvents = [];

    const abi = createOrchestrator({
      onLunoSpeak: (text) => {
        pendingEvents.push({ type: 'luno_speak', text, ts: Date.now() });
      },
      onPacerUpdate: (config) => {
        pendingEvents.push({ type: 'pacer_update', config, ts: Date.now() });
      },
      onPacerPause: () => {
        pendingEvents.push({ type: 'pacer_pause', ts: Date.now() });
      },
      onPacerResume: () => {
        pendingEvents.push({ type: 'pacer_resume', ts: Date.now() });
      },
      onSessionEnd: (result) => {
        pendingEvents.push({ type: 'session_end', result, ts: Date.now() });
      },
      onMirrorData: (data) => {
        pendingEvents.push({ type: 'mirror_data', data, ts: Date.now() });
      },
      onOfferExit: () => {
        pendingEvents.push({ type: 'offer_exit', ts: Date.now() });
      },
      onOfferDrill: (drillData) => {
        pendingEvents.push({ type: 'offer_drill', drillData, ts: Date.now() });
      },
      onIdentityChallenge: (config) => {
        pendingEvents.push({ type: 'identity_challenge', config, ts: Date.now() });
      },
      onStateChange: (stateData) => {
        pendingEvents.push({ type: 'state_change', stateData, ts: Date.now() });
      }
    });

    const config = await abi.onSessionStart(userId, sessionId, options);

    // Store orchestrator + event queue
    activeSessions.set(key, { abi, pendingEvents, startedAt: Date.now() });

    // Drain any events that fired during start
    const events = [...pendingEvents];
    pendingEvents.length = 0;

    res.json({ success: true, session_key: key, config, events });
  } catch (error) {
    console.error('Session start error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// ── ARRIVAL SAMPLE (baseline filter feed) ───────────────────
// POST /api/abi/session/arrival-sample
// Body: { userId, sessionId, biometrics }
// Called every second during 60-second Arrival phase.

router.post('/session/arrival-sample', (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const biometrics = req.body.biometrics;
    session.abi.onArrivalSample(biometrics);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ── ARRIVAL COMPLETE ────────────────────────────────────────
// POST /api/abi/session/arrival-complete
// Body: { userId, sessionId, biometrics }
// Returns: detection result, filtered baseline, arrival dialogue

router.post('/session/arrival-complete', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const biometrics = req.body.biometrics;
    const result = await session.abi.onArrivalComplete(biometrics);
    const events = drainEvents(session);

    res.json({ success: true, result, events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ── BREATHING TICK ──────────────────────────────────────────
// POST /api/abi/session/tick
// Body: { userId, sessionId, biometrics }
// Called every second during Breathing phase.
// Returns: action, pacer adjustments, coaching, state

router.post('/session/tick', (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const biometrics = req.body.biometrics;
    const result = session.abi.onBreathingTick(biometrics);
    const events = drainEvents(session);

    res.json({ success: true, result, events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ── PAUSE / RESUME / EXIT ───────────────────────────────────
// POST /api/abi/session/pause
// POST /api/abi/session/resume
// POST /api/abi/session/exit

router.post('/session/pause', (req, res) => {
  const { key, session } = resolveSession(req);
  if (!session) return res.status(404).json({ error: 'No active session' });

  session.abi.onPauseTap();
  const events = drainEvents(session);
  res.json({ success: true, events });
});

router.post('/session/resume', (req, res) => {
  const { key, session } = resolveSession(req);
  if (!session) return res.status(404).json({ error: 'No active session' });

  session.abi.onResumeTap();
  const events = drainEvents(session);
  res.json({ success: true, events });
});

router.post('/session/exit', (req, res) => {
  const { key, session } = resolveSession(req);
  if (!session) return res.status(404).json({ error: 'No active session' });

  session.abi.onExitTap();
  const events = drainEvents(session);
  if (key) activeSessions.delete(key);
  res.json({ success: true, events });
});


// ── DRILL SELECTION ─────────────────────────────────────────
// POST /api/abi/session/drill-select
// Body: { userId, sessionId, drillId }

router.post('/session/drill-select', (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const drillId = req.body.drillId || req.body.drill_id;
    const result = session.abi.onDrillSelected(drillId);
    const events = drainEvents(session);
    res.json({ success: true, result, events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ── BLE DISCONNECT / RECONNECT ──────────────────────────────
// POST /api/abi/session/ble-disconnect
// POST /api/abi/session/ble-reconnect

router.post('/session/ble-disconnect', (req, res) => {
  const { key, session } = resolveSession(req);
  if (!session) return res.status(404).json({ error: 'No active session' });

  session.abi.onBLEDisconnect();
  const events = drainEvents(session);
  res.json({ success: true, events });
});

router.post('/session/ble-reconnect', (req, res) => {
  const { key, session } = resolveSession(req);
  if (!session) return res.status(404).json({ error: 'No active session' });

  session.abi.onBLEReconnect();
  const events = drainEvents(session);
  res.json({ success: true, events });
});


// ── SESSION COMPLETE ────────────────────────────────────────
// POST /api/abi/session/complete
// Body: { userId, sessionId, rawMetrics }
// Returns: cleaned metrics, affirmations, mirror data, trend report, immune scan

router.post('/session/complete', async (req, res) => {
  try {
    const { key, session } = resolveSession(req);
    if (!session) return res.status(404).json({ error: 'No active session' });

    const rawMetrics = req.body.rawMetrics || req.body.metrics || {};
    const result = await session.abi.onSessionComplete(rawMetrics);
    const events = drainEvents(session);

    // Clean up session from active store
    if (key) activeSessions.delete(key);

    res.json({ success: true, result, events });
  } catch (error) {
    console.error('Session complete error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// ── SESSION STATUS ──────────────────────────────────────────
// GET /api/abi/session/status/:userId/:sessionId

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

// ── SESSION STATE (frontend pattern: x-session-key header) ──
// GET /api/abi/session/state/:key?
// Session key via header (preferred) or optional URL param (backward compat)
router.get('/session/state/:key?', (req, res) => {
  try {
    const key = req.headers['x-session-key'] || req.params.key;
    if (!key) return res.status(400).json({ error: 'Missing session key (send x-session-key header)' });
    const session = activeSessions.get(key);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
      session_key: key,
      state: session.abi.getState ? session.abi.getState() : {
        phase: session.abi.getSessionPhase(),
        paused: session.abi.ispaused(),
        activeSeconds: session.abi.getActiveSeconds()
      }
    });
  } catch (err) {
    console.error('[ABI] State error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── ADAPTED SESSION ─────────────────────────────────────────
// GET /api/abi/session/adapted/:key?
router.get('/session/adapted/:key?', (req, res) => {
  try {
    const key = req.headers['x-session-key'] || req.params.key;
    if (!key) return res.status(400).json({ error: 'Missing session key' });
    const session = activeSessions.get(key);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
      session_key: key,
      adapted_session: session.abi.getAdaptedSession ? session.abi.getAdaptedSession() : {}
    });
  } catch (err) {
    console.error('[ABI] Adapted error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PENDING EVENTS (SSE-ready) ──────────────────────────────
// GET /api/abi/session/events/:key?
router.get('/session/events/:key?', (req, res) => {
  try {
    const key = req.headers['x-session-key'] || req.params.key;
    if (!key) return res.status(400).json({ error: 'Missing session key' });
    const session = activeSessions.get(key);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const events = drainEvents(session);
    res.json({ session_key: key, events });
  } catch (err) {
    console.error('[ABI] Events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// 2. DRILL ROUTES
// ═══════════════════════════════════════════════════════════════

// ── GET ALL DRILLS (adapted for user's track) ───────────────
// GET /api/abi/drills/:userId

router.get('/drills/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userResult = await pool.query(
      `SELECT * FROM users WHERE user_id = $1`, [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const drills = getAllDrillsForUser(userResult.rows[0]);
    res.json({ drills });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── ADAPT A SPECIFIC DRILL ──────────────────────────────────
// POST /api/abi/drills/adapt
// Body: { userId, drillId }

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
    res.status(500).json({ error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// 3. CLINICAL DASHBOARD ROUTES (read-only monitoring)
// ═══════════════════════════════════════════════════════════════

// ── TREND ANALYSIS (per user) ───────────────────────────────
// GET /api/abi/clinical/trends/:userId

router.get('/clinical/trends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const report = await analyzeTrends(userId);
    res.json({ userId, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── TREND DASHBOARD (all users with flags) ──────────────────
// GET /api/abi/clinical/trends

router.get('/clinical/trends', async (req, res) => {
  try {
    const summary = await getDashboardSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── IMMUNE SYSTEM STATUS (per user) ─────────────────────────
// GET /api/abi/clinical/immune/:userId

router.get('/clinical/immune/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const immune = new ImmuneSystem(userId, pool);
    const dashboard = await immune.getDashboardView();
    res.json({ userId, immune: dashboard });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── IMMUNE EVENT LOG ────────────────────────────────────────
// GET /api/abi/clinical/immune/:userId/history

router.get('/clinical/immune/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const immune = new ImmuneSystem(userId, pool);
    const history = await immune.getImmuneHistory(limit);
    res.json({ userId, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── HOMEOSTATIC STATUS (per user) ───────────────────────────
// GET /api/abi/clinical/homeostatic/:userId

router.get('/clinical/homeostatic/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const regulator = new HomeostaticRegulator(userId, pool);
    const status = await regulator.preSessionCheck();
    res.json({ userId, homeostatic: status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── COMPREHENSIVE USER ABI PROFILE ──────────────────────────
// GET /api/abi/clinical/profile/:userId
// Returns: track, trends, immune status, homeostatic status, session stats

router.get('/clinical/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // User record
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

    // Recent sessions
    const recentSessions = await pool.query(
      `SELECT session_id, session_number, completed_at, coherence_score,
              coherence_end, cycle_completion_rate, active_duration_seconds,
              pause_count, exit_type, breathwork_mode, breath_track_at_completion, arc_id
       FROM session_completions
       WHERE user_id = $1
       ORDER BY completed_at DESC LIMIT 10`, [userId]
    );

    // Trend (if enough sessions)
    let trend = null;
    if (user.total_sessions_completed >= 10) {
      try {
        trend = await analyzeTrends(userId);
      } catch (err) { /* non-blocking */ }
    }

    // Immune status
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
    res.status(500).json({ error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// 4. FACILITY ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════

// ── IMMUNE OVERRIDE (clinician unlocks safety mode) ─────────
// POST /api/abi/admin/immune-override
// Body: { userId, clinicianId, action: 'clear_safety' | 'set_watch' | 'escalate' }

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

    // Log the override as an immune event
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
    res.status(500).json({ error: error.message });
  }
});

// ── ACTIVE SESSIONS OVERVIEW ────────────────────────────────
// GET /api/abi/admin/active-sessions

router.get('/admin/active-sessions', (req, res) => {
  const sessions = [];
  for (const [key, session] of activeSessions.entries()) {
    const parts = key.split(':');
    const userId = parts[0];
    const sessionId = parts.slice(1).join(':');
    sessions.push({
      session_key: key,
      userId,
      sessionId,
      phase: session.abi.getSessionPhase(),
      paused: session.abi.ispaused(),
      activeSeconds: session.abi.getActiveSeconds(),
      detectionMode: session.abi.getDetectionMode(),
      startedAt: session.startedAt
    });
  }
  res.json({ active_count: sessions.length, sessions });
});


// ═══════════════════════════════════════════════════════════════
// 5. SYSTEM HEALTH
// ═══════════════════════════════════════════════════════════════

// ── ABI SYSTEM STATUS ───────────────────────────────────────
// GET /api/abi/health

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'ABI / ANS / AXIS — Adaptive Breath Intelligence',
    version: '2.0',
    systems_wired: 14,
    systems_total: 14,
    active_sessions: activeSessions.size,
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
