// ============================================================
// Session State Manager — DB-Backed
// File: src/services/sessionStateManager.js
//
// Replaces in-memory Map with PostgreSQL-backed session state.
// All session state reads/writes go through the database.
// Survives Railway redeploys and supports horizontal scaling.
// ============================================================

const crypto = require('crypto');
const { Pool } = require('pg');
const { tenantWhere, tenantInsert } = require('../utils/tenantHelper');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Module-level tenantId — set per-request by callers via setTenantId()
let _currentTenantId = null;
function setTenantId(tenantId) { _currentTenantId = tenantId; }

function createSessionKey() {
  return 'sk_' + crypto.randomBytes(16).toString('hex');
}

async function registerSession(userId, sessionId, sessionNumber, tenantId) {
  const sessionKey = createSessionKey();
  const tid = tenantId || _currentTenantId;
  const t = tenantInsert(tid, 5);

  await pool.query(`
    INSERT INTO session_completions (user_id, session_number, session_key, session_active, session_state, arrival_started_at${t.columns}, created_at)
    VALUES ($1, $2, $3, true, $4, NOW()${t.values}, NOW())
    ON CONFLICT (user_id, session_number)
    DO UPDATE SET session_key = $3, session_active = true, session_state = $4, arrival_started_at = NOW()
  `, [userId, sessionNumber, sessionKey, JSON.stringify({
    phase: 'arrival',
    paused: false,
    arrivalSamples: [],
    adaptedSession: null,
    events: [],
    bleConnected: true,
    breathCount: 0,
    coherencePeak: 0,
    startedAt: Date.now()
  }), ...t.params]);

  return sessionKey;
}

async function getSession(sessionKey) {
  const result = await pool.query(
    'SELECT id, user_id, session_number, session_state, session_active, arrival_started_at FROM session_completions WHERE session_key = $1 AND session_active = true',
    [sessionKey]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    sessionNumber: row.session_number,
    arrivalStartedAt: row.arrival_started_at,
    ...row.session_state
  };
}

async function updateSessionState(sessionKey, updates) {
  await pool.query(`
    UPDATE session_completions
    SET session_state = session_state || $1::jsonb
    WHERE session_key = $2 AND session_active = true
  `, [JSON.stringify(updates), sessionKey]);
}

async function pushArrivalSample(sessionKey, sample) {
  // Atomic JSONB array append with sliding window cap at 60
  await pool.query(`
    UPDATE session_completions
    SET session_state = jsonb_set(
      session_state,
      '{arrivalSamples}',
      CASE
        WHEN jsonb_array_length(COALESCE(session_state->'arrivalSamples', '[]'::jsonb)) >= 60
        THEN (
          SELECT jsonb_agg(elem)
          FROM (
            SELECT elem FROM jsonb_array_elements(session_state->'arrivalSamples') WITH ORDINALITY AS t(elem, ord)
            ORDER BY ord
            OFFSET 1
          ) sub
        ) || jsonb_build_array($1::jsonb)
        ELSE COALESCE(session_state->'arrivalSamples', '[]'::jsonb) || jsonb_build_array($1::jsonb)
      END
    )
    WHERE session_key = $2 AND session_active = true
  `, [JSON.stringify(sample), sessionKey]);
}

async function pushEvent(sessionKey, event) {
  await pool.query(`
    UPDATE session_completions
    SET session_state = jsonb_set(
      session_state,
      '{events}',
      COALESCE(session_state->'events', '[]'::jsonb) || jsonb_build_array($1::jsonb)
    )
    WHERE session_key = $2 AND session_active = true
  `, [JSON.stringify(event), sessionKey]);
}

async function getAndDrainEvents(sessionKey) {
  // Read events first
  const readResult = await pool.query(
    "SELECT session_state->'events' AS events FROM session_completions WHERE session_key = $1 AND session_active = true",
    [sessionKey]
  );
  if (!readResult.rows.length) return [];
  const events = readResult.rows[0].events || [];

  // Clear events
  if (events.length > 0) {
    await pool.query(`
      UPDATE session_completions
      SET session_state = jsonb_set(session_state, '{events}', '[]'::jsonb)
      WHERE session_key = $1 AND session_active = true
    `, [sessionKey]);
  }

  return events;
}

async function deactivateSession(sessionKey) {
  await pool.query(
    'UPDATE session_completions SET session_active = false WHERE session_key = $1',
    [sessionKey]
  );
}

async function getArrivalSampleCount(sessionKey) {
  const result = await pool.query(
    "SELECT jsonb_array_length(COALESCE(session_state->'arrivalSamples', '[]'::jsonb)) AS count FROM session_completions WHERE session_key = $1 AND session_active = true",
    [sessionKey]
  );
  if (!result.rows.length) return 0;
  return result.rows[0].count;
}

async function getActiveSessionCount() {
  const result = await pool.query(
    'SELECT COUNT(*) AS count FROM session_completions WHERE session_active = true'
  );
  return parseInt(result.rows[0].count, 10);
}

async function getTotalSessionCount() {
  const result = await pool.query(
    'SELECT COUNT(*) AS count FROM session_completions'
  );
  return parseInt(result.rows[0].count, 10);
}

// Clean up stale sessions (active for > 2 hours)
async function cleanupStaleSessions() {
  const result = await pool.query(`
    UPDATE session_completions
    SET session_active = false
    WHERE session_active = true
    AND arrival_started_at < NOW() - INTERVAL '2 hours'
    RETURNING session_key
  `);
  if (result.rows.length > 0) {
    console.log(`[SESSION] Cleaned up ${result.rows.length} stale sessions`);
  }
  return result.rows.length;
}

module.exports = {
  createSessionKey,
  registerSession,
  getSession,
  updateSessionState,
  pushArrivalSample,
  pushEvent,
  getAndDrainEvents,
  deactivateSession,
  getArrivalSampleCount,
  getActiveSessionCount,
  getTotalSessionCount,
  cleanupStaleSessions,
  setTenantId
};
