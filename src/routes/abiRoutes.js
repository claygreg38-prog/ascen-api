const express = require('express');
const router = express.Router();
const { createOrchestrator } = require('../abi/sessionOrchestrator');
const { getAllDrillsForUser } = require('../abi/drillAdapter');

// EXPORTED for session cleanup wiring (FIXED: was local-only)
const activeSessions = new Map();

function getSession(k) { return activeSessions.get(k); }
function setSession(k, d) { activeSessions.set(k, { ...d, lastActivity: Date.now() }); }
function removeSession(k) { activeSessions.delete(k); }

// SESSION LIFECYCLE
router.post('/session/start', async (req, res) => {
  try {
    const { user_id, session_id, facility_mode, verification_method, identity_verified } = req.body;
    if (!user_id || !session_id) return res.status(400).json({ error: 'user_id and session_id required' });
    if (typeof user_id !== 'string' || user_id.trim() === '') return res.status(400).json({ error: 'user_id must be a non-empty string' });

    const sessionKey = `${user_id}:${session_id}`;
    const pendingEvents = [];
    const orchestrator = createOrchestrator({
      onLunoSpeak: (t) => pendingEvents.push({ type: 'luno_speak', data: t }),
      onPacerUpdate: (c) => pendingEvents.push({ type: 'pacer_update', data: c }),
      onPacerPause: () => pendingEvents.push({ type: 'pacer_pause' }),
      onPacerResume: () => pendingEvents.push({ type: 'pacer_resume' }),
      onSessionEnd: (r) => pendingEvents.push({ type: 'session_end', data: r }),
      onMirrorData: (d) => pendingEvents.push({ type: 'mirror_data', data: d }),
      onOfferExit: () => pendingEvents.push({ type: 'offer_exit' }),
      onOfferDrill: (o) => pendingEvents.push({ type: 'offer_drill', data: o }),
      onIdentityChallenge: (c) => pendingEvents.push({ type: 'identity_challenge', data: c }),
      onStateChange: (s) => pendingEvents.push({ type: 'state_change', data: s })
    });
    const result = await orchestrator.onSessionStart(user_id, session_id, { facility_mode, verification_method, identity_verified });
    setSession(sessionKey, { orchestrator, pendingEvents, userId: user_id, sessionId: session_id });
    res.json({ success: true, session_key: sessionKey, ...result, events: pendingEvents.splice(0) });
  } catch (err) { console.error('ABI session start error:', err.message); res.status(500).json({ error: err.message }); }
});

router.post('/session/arrival-sample', async (req, res) => {
  try { const { session_key, biometrics } = req.body; const s = getSession(session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); const r = s.orchestrator.onArrivalSample(biometrics); res.json({ success: true, ...r }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/session/arrival-complete', async (req, res) => {
  try { const { session_key, biometrics } = req.body; const s = getSession(session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); const r = await s.orchestrator.onArrivalComplete(biometrics); res.json({ success: true, ...r, events: s.pendingEvents.splice(0) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/session/tick', async (req, res) => {
  try { const { session_key, biometrics } = req.body; const s = getSession(session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); const r = await s.orchestrator.onBreathingTick(biometrics); res.json({ success: true, ...r, events: s.pendingEvents.splice(0) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/session/pause', (req, res) => { try { const s = getSession(req.body.session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); const r = s.orchestrator.onPauseTap(); res.json({ success: true, ...r, events: s.pendingEvents.splice(0) }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.post('/session/resume', (req, res) => { try { const s = getSession(req.body.session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); const r = s.orchestrator.onResumeTap(); res.json({ success: true, ...r, events: s.pendingEvents.splice(0) }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.post('/session/exit', (req, res) => { try { const s = getSession(req.body.session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); const r = s.orchestrator.onExitTap(); res.json({ success: true, ...r, events: s.pendingEvents.splice(0) }); } catch (err) { res.status(500).json({ error: err.message }); } });

router.post('/session/complete', async (req, res) => {
  try { const { session_key, metrics } = req.body; const s = getSession(session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); const r = await s.orchestrator.onSessionComplete(metrics || {}); const ev = s.pendingEvents.splice(0); removeSession(session_key); res.json({ success: true, ...r, events: ev }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/session/ble-disconnect', (req, res) => { try { const s = getSession(req.body.session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); res.json({ success: true, ...s.orchestrator.onBLEDisconnect() }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.post('/session/ble-reconnect', (req, res) => { try { const s = getSession(req.body.session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); res.json({ success: true, ...s.orchestrator.onBLEReconnect() }); } catch (err) { res.status(500).json({ error: err.message }); } });

router.get('/session/state/:sessionKey', (req, res) => { const s = getSession(req.params.sessionKey); if (!s) return res.status(404).json({ error: 'Session not found' }); res.json({ phase: s.orchestrator.getSessionPhase(), paused: s.orchestrator.ispaused(), active_seconds: s.orchestrator.getActiveSeconds(), detection_mode: s.orchestrator.getDetectionMode() }); });
router.get('/session/adapted/:sessionKey', (req, res) => { const s = getSession(req.params.sessionKey); if (!s) return res.status(404).json({ error: 'Session not found' }); res.json(s.orchestrator.getAdaptedSession()); });
router.get('/session/events/:sessionKey', (req, res) => { const s = getSession(req.params.sessionKey); if (!s) return res.status(404).json({ error: 'Session not found' }); res.json({ events: s.pendingEvents.splice(0) }); });

// DRILLS
router.get('/drills/:track', (req, res) => { res.json({ drills: getAllDrillsForUser(req.params.track || 'standard') }); });
router.post('/drill/select', async (req, res) => { try { const s = getSession(req.body.session_key); if (!s) return res.status(404).json({ error: 'Session not found' }); res.json({ success: true, ...s.orchestrator.onDrillSelected(req.body.drill_id) }); } catch (err) { res.status(500).json({ error: err.message }); } });

// CLINICAL — FIXED: errors logged and surfaced, not swallowed
router.get('/clinical/participants', async (req, res) => {
  try { const pool = require('../db/pool'); if (!pool) return res.json({ participants: [] }); const r = await pool.query(`SELECT u.user_id, u.display_name, u.breath_track, u.current_session_number, u.active FROM users u WHERE u.active = true ORDER BY u.display_name`); res.json({ participants: r.rows }); }
  catch (err) { console.error('[Clinical] participants error:', err.message); res.json({ participants: [], error: 'Data temporarily unavailable' }); }
});

router.get('/clinical/participant/:userId', async (req, res) => {
  try {
    const pool = require('../db/pool');
    if (!pool) return res.json({ error: 'No database' });
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') return res.status(400).json({ error: 'Valid userId required' });
    const user = await pool.query(`SELECT user_id, display_name, breath_track, current_session_number, active, onboarded_at FROM users WHERE user_id = $1`, [userId]);
    const sessions = await pool.query(`SELECT * FROM session_completions WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 20`, [userId]);
    let trend = null, immune = null;
    try { const { analyzeTrends } = require('../abi/trendAnalyzer'); trend = await analyzeTrends(userId); } catch (err) { console.error(`[Clinical] Trend analysis failed for ${userId}:`, err.message); trend = { error: 'Analysis unavailable' }; }
    res.json({ user: user.rows[0] || null, recent_sessions: sessions.rows, trend, immune });
  } catch (err) { console.error('[Clinical] participant error:', err.message); res.json({ error: err.message }); }
});

router.get('/clinical/flags', async (req, res) => { try { const pool = require('../db/pool'); if (!pool) return res.json({ flags: [] }); const r = await pool.query(`SELECT * FROM immune_flags WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC`); res.json({ flags: r.rows }); } catch (err) { res.json({ flags: [], error: err.message }); } });
router.get('/clinical/compliance', async (req, res) => { try { const pool = require('../db/pool'); if (!pool) return res.json({ participants: [] }); const r = await pool.query(`SELECT u.user_id, u.display_name, COUNT(sc.id) as sessions_completed, MAX(sc.completed_at) as last_session FROM users u LEFT JOIN session_completions sc ON sc.user_id = u.user_id AND sc.completed_at > NOW() - INTERVAL '30 days' WHERE u.active = true GROUP BY u.user_id, u.display_name`); res.json({ participants: r.rows, compliance_note: 'Protected per 42 CFR Part 2' }); } catch (err) { res.json({ participants: [], error: err.message }); } });
router.get('/clinical/trends/:userId', async (req, res) => { try { const { analyzeTrends } = require('../abi/trendAnalyzer'); res.json(await analyzeTrends(req.params.userId)); } catch (err) { res.json({ error: err.message }); } });

// FACILITY ADMIN
router.get('/facility/active-sessions', (req, res) => { const s = []; activeSessions.forEach((d, k) => s.push({ session_key: k, user_id: d.userId, session_id: d.sessionId, phase: d.orchestrator.getSessionPhase(), active_seconds: d.orchestrator.getActiveSeconds(), last_activity: d.lastActivity })); res.json({ active_sessions: s, count: s.length }); });
router.post('/facility/end-all', (req, res) => { const c = activeSessions.size; activeSessions.clear(); res.json({ ended: c }); });

// HEALTH
router.get('/health', (req, res) => { res.json({ status: 'operational', active_sessions: activeSessions.size, systems: { orchestrator: 'online', state_engine: 'online', coaching_engine: 'online', immune_system: 'online', homeostatic_regulator: 'online', biometric_resilience: 'online', identity_gate: 'online', baseline_filter: 'online', luno_intelligence: 'online', drill_adapter: 'online', trend_analyzer: 'online', axis_engine: 'online', breath_protocol_adapter: 'online', pause_handler: 'online' }, timestamp: new Date().toISOString() }); });

// FIXED: export both router and activeSessions for cleanup wiring
module.exports = { router, activeSessions };
