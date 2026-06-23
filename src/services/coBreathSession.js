'use strict';
// ============================================================
// Co-Breath Session Manager (L3) — in-memory dyadic state
// File: src/services/coBreathSession.js
//
// Shared by the REST bio-tick route and the WS layer (same process). Holds, per
// session: both partners' latest raw bio, the dyadic buffer, baselines, and a
// rolling in-memory aggregate (NO per-tick DB table — decision: in-memory only).
// Raw biometrics live here on the SERVER only; they are never forwarded over the
// WS (only the server-derived regulation category is).
//
// Designed mode/metric-pluggable so Echo (E) slots in without rework:
//   partnerSource: 'live_socket' | 'trace_player'   (L3 builds live only)
//   metricKind:    'sync'        | 'entrainment'     (L3 builds sync only)
// ============================================================

const partnershipEngine = require('../abi/partnershipEngine');

const sessions = new Map(); // sessionId -> state

async function ensureSession(sessionId) {
  let s = sessions.get(sessionId);
  if (s) return s;
  // Load dyadic baselines (set by captureDyadicBaseline) for pattern thresholds.
  let baselines = { a: null, b: null };
  try {
    const active = await partnershipEngine.getActiveSession(sessionId);
    if (active) {
      const p = await partnershipEngine.getPartnershipById(active.partnership_id);
      const db = p && p.dyadic_baseline;
      if (db && db.individual_baselines) {
        baselines = { a: db.individual_baselines.a || null, b: db.individual_baselines.b || null };
      }
    }
  } catch (e) { /* defaults used in detectPatterns if baselines absent */ }
  const ratioState = () => ({ current: '5:5', arrival: '5:5', step_down_count: 0, last_step_down_at: null, biometric_buffer: [] });
  s = {
    mode: 'live', metricKind: 'sync',
    baselines, buffer: [], lastBio: { a: null, b: null },
    ratioA: ratioState(), ratioB: ratioState(),
    aggregate: { ticks: 0, sync_sum: 0, sync_max: 0, patterns: {} },
    lastTickAt: null,
  };
  sessions.set(sessionId, s);
  return s;
}

// Server-derived regulation CATEGORY from raw bio (never the raw values).
function regulationCategory(bio) {
  const coh = (bio && bio.coherence != null) ? bio.coherence : 0;
  if (coh >= 0.5) return 'regulated';
  if (coh >= 0.3) return 'approaching';
  return 'below';
}

function summarize(s) {
  return {
    ticks: s.aggregate.ticks,
    sync_mean: s.aggregate.ticks ? Math.round((s.aggregate.sync_sum / s.aggregate.ticks) * 100) / 100 : 0,
    sync_max: s.aggregate.sync_max,
    patterns: s.aggregate.patterns,
    buffer_len: s.buffer.length,
  };
}

// Ingest one partner's raw bio. Runs processTick server-side once BOTH partners
// have a current reading; updates the rolling aggregate. Returns the sender's own
// regulation category (for forwarding to the partner over WS) + dyad metrics.
async function ingestBio(sessionId, isPartnerA, bio) {
  const s = await ensureSession(sessionId);
  s.lastBio[isPartnerA ? 'a' : 'b'] = bio;
  s.lastTickAt = Date.now();

  let metrics = null;
  if (s.lastBio.a && s.lastBio.b) {
    const r = partnershipEngine.processTick(
      s.lastBio.a, s.lastBio.b, s.baselines.a, s.baselines.b, s.buffer, s.ratioA, s.ratioB
    );
    s.buffer = r.dyadic_buffer || s.buffer;
    s.ratioA = r.partner_a_ratio || s.ratioA;
    s.ratioB = r.partner_b_ratio || s.ratioB;
    const sync = (r.dyadic && r.dyadic.sync_quality) || 0;
    s.aggregate.ticks += 1;
    s.aggregate.sync_sum += sync;
    s.aggregate.sync_max = Math.max(s.aggregate.sync_max, sync);
    for (const p of (r.patterns || [])) {
      s.aggregate.patterns[p.pattern] = (s.aggregate.patterns[p.pattern] || 0) + 1;
    }
    metrics = { sync_quality: sync, patterns: r.patterns || [], drifting_word: r.drifting_word };
  }
  return { regulation_category: regulationCategory(bio), metrics, aggregate: summarize(s) };
}

function getAggregate(sessionId) { const s = sessions.get(sessionId); return s ? summarize(s) : null; }
function hasSession(sessionId) { return sessions.has(sessionId); }

// L4 — in-memory fast guard against concurrent completion (same process). The
// check+add is synchronous (no await between), so it is race-safe in single-thread
// JS. The DURABLE exactly-once guard is the atomic DB UPDATE in finalizeLiveSession.
const completing = new Set();

// L4 — complete a live session: read the in-memory aggregate as final metrics, then
// idempotently finalize in the DB (deposit happens exactly once) and drop the
// in-memory state. Engagement logging is done by the caller (WS layer) to avoid a
// require cycle.
async function endLiveSession(sessionId, reason) {
  if (completing.has(sessionId)) return { skipped: true, reason: 'already completing' };
  completing.add(sessionId);
  try {
    const s = sessions.get(sessionId);
    const finalMetrics = Object.assign({}, s ? summarize(s) : {}, { end_reason: reason || 'ended' });
    const r = await partnershipEngine.finalizeLiveSession(sessionId, finalMetrics);
    sessions.delete(sessionId);
    return Object.assign({ end_reason: reason || 'ended' }, r);
  } finally {
    completing.delete(sessionId);
  }
}

// L4 — reaper: mark a session abandoned (no deposit, doesn't count toward the gap).
async function abandonLiveSession(sessionId, reason) {
  if (completing.has(sessionId)) return { skipped: true, reason: 'already completing' };
  completing.add(sessionId);
  try {
    const r = await partnershipEngine.abandonSession(sessionId, reason);
    sessions.delete(sessionId);
    return r;
  } finally {
    completing.delete(sessionId);
  }
}

module.exports = { ensureSession, ingestBio, getAggregate, hasSession, regulationCategory, endLiveSession, abandonLiveSession, _sessions: sessions };
