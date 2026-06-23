// ============================================================
// Co-Breath WebSocket Server — Real-Time Breath Sync
// File: src/services/coBreathWebSocket.js
//
// Raw HRV values NEVER sent over WebSocket. Only regulation
// state categories ('regulated', 'approaching', 'below').
// Room expires after 15 minutes of inactivity.
// ============================================================

const WebSocket = require('ws');
// L1 — gated room admission: the room token IS the gated partnership_sessions.id.
const partnershipEngine = require('../abi/partnershipEngine');

const rooms = new Map(); // roomCode → { initiator, partner, state, breathParams, lastActivity }

// ── ENGAGEMENT EVENT LOG — DB-backed (survives restarts) ──
const { Pool } = require('pg');
const engagementPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function logEngagementEvent(sessionId, event) {
  try {
    await engagementPool.query(
      'INSERT INTO engagement_events (session_id, user_id, event_type, payload) VALUES ($1, $2, $3, $4)',
      [sessionId, event.user_id || null, event.status || event.event_type || 'unknown', JSON.stringify(event)]
    );
  } catch (err) {
    // Non-blocking — log but don't crash the WebSocket
    console.error('[CoBreath WS] Engagement event log failed:', err.message);
  }
}

async function getEngagementEvents(sessionId) {
  try {
    const result = await engagementPool.query(
      'SELECT * FROM engagement_events WHERE session_id = $1 ORDER BY created_at',
      [sessionId]
    );
    return result.rows.map(r => ({ ...r.payload, id: r.id, created_at: r.created_at }));
  } catch (err) {
    console.error('[CoBreath WS] Get engagement events failed:', err.message);
    return [];
  }
}

async function clearEngagementEvents(sessionId) {
  try {
    await engagementPool.query('DELETE FROM engagement_events WHERE session_id = $1', [sessionId]);
  } catch (err) {
    console.error('[CoBreath WS] Clear engagement events failed:', err.message);
  }
}

function initCoBreathWS(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/cobreath' });

  console.log('[CoBreath WS] WebSocket server initialized at /ws/cobreath');

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.roomCode = null;
    ws.userId = null;
    ws.role = null; // 'initiator' or 'partner'

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data);
        switch (msg.type) {
          case 'join': await handleJoin(ws, msg); break;
          case 'ready': handleReady(ws, msg); break;
          case 'breath_phase': handleBreathPhase(ws, msg); break;
          case 'regulation_state': handleRegulationState(ws, msg); break;
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => handleDisconnect(ws));
  });

  // Heartbeat: every 30s, clean expired rooms
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });

    // Clean expired rooms
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.lastActivity > 15 * 60 * 1000) {
        broadcast(room, { type: 'room_expired' });
        rooms.delete(code);
      }
    }
  }, 30000);

  wss.on('close', () => clearInterval(heartbeatInterval));

  return wss;
}

async function handleJoin(ws, msg) {
  const { roomCode, userId } = msg;
  if (!roomCode || !userId) {
    ws.send(JSON.stringify({ type: 'error', message: 'roomCode and userId required' }));
    return;
  }

  // L1 — roomCode IS the gated session token (partnership_sessions.id). Admit only
  // if a gated startSession minted it and this user is one of its partners. The
  // gates (S15/DV/48h) run in startSession; this only verifies the minted token,
  // so a co-breath room can never exist ungated.
  let admission;
  try {
    admission = await partnershipEngine.validateRoomAdmission(roomCode, userId);
  } catch (err) {
    console.error('[CoBreath WS] Admission check failed:', err.message);
    ws.send(JSON.stringify({ type: 'error', message: 'Admission check failed' }));
    return;
  }
  if (!admission.ok) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room admission denied: ' + admission.reason }));
    return;
  }

  let room = rooms.get(roomCode);
  if (!room) {
    // L2 — NO client-supplied breathParams. The session (server) is the only source;
    // breathing_start loads breath_params from it. Store the session token on the room.
    room = { initiator: null, partner: null, state: 'waiting', sessionId: roomCode, lastActivity: Date.now() };
    rooms.set(roomCode, room);
  }

  ws.roomCode = roomCode;
  ws.userId = userId;
  ws.sessionId = roomCode;                       // L1 — gated session token
  ws.partnershipId = admission.partnership_id;   // for L3/L4 (server-side tick + completion)
  ws.userDbId = admission.user_db_id;            // L3 — partner targeting for regulation forward

  if (!room.initiator) {
    room.initiator = ws;
    ws.role = 'initiator';
  } else if (!room.partner) {
    room.partner = ws;
    ws.role = 'partner';
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
    return;
  }

  room.lastActivity = Date.now();
  ws.send(JSON.stringify({ type: 'joined', role: ws.role, roomCode }));

  // If both connected, notify
  if (room.initiator && room.partner) {
    broadcast(room, { type: 'both_connected', state: 'countdown' });
  }
}

function handleReady(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  room.state = 'countdown';
  room.lastActivity = Date.now();

  broadcast(room, { type: 'countdown', seconds: 3 });

  // After 3 seconds, start breathing
  setTimeout(async () => {
    if (room.state === 'countdown') {
      room.state = 'breathing';
      // L2 — breath params come ONLY from the session (server-derived), loaded at
      // broadcast time. Client-supplied breathParams are never read.
      let breathParams = {};
      try {
        breathParams = (await partnershipEngine.getSessionBreathParams(room.sessionId)) || {};
      } catch (err) {
        console.error('[CoBreath WS] breath_params load failed:', err.message);
      }
      broadcast(room, { type: 'breathing_start', breathParams });
    }
  }, 3000);
}

function handleBreathPhase(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  room.lastActivity = Date.now();

  // Forward phase to partner (sync their pacer)
  const target = ws.role === 'initiator' ? room.partner : room.initiator;
  if (target && target.readyState === WebSocket.OPEN) {
    target.send(JSON.stringify({
      type: 'partner_breath_phase',
      phase: msg.phase, // 'inhale', 'exhale', 'hold'
      timestamp: msg.timestamp
    }));
  }
}

function handleRegulationState(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  room.lastActivity = Date.now();

  // Forward regulation STATE only — never raw HRV values
  const target = ws.role === 'initiator' ? room.partner : room.initiator;
  if (target && target.readyState === WebSocket.OPEN) {
    target.send(JSON.stringify({
      type: 'partner_regulation',
      state: msg.state // 'regulated', 'approaching', 'below' — no numbers
    }));
  }
}

function handleDisconnect(ws) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  if (ws.role === 'initiator') room.initiator = null;
  if (ws.role === 'partner') room.partner = null;

  // Notify remaining participant
  const remaining = room.initiator || room.partner;
  if (remaining && remaining.readyState === WebSocket.OPEN) {
    remaining.send(JSON.stringify({ type: 'partner_disconnected', message: 'Connection paused — reconnecting...' }));
  }

  // If both gone, clean up after 30 seconds
  if (!room.initiator && !room.partner) {
    setTimeout(() => {
      const r = rooms.get(ws.roomCode);
      if (r && !r.initiator && !r.partner) rooms.delete(ws.roomCode);
    }, 30000);
  }
}

function broadcast(room, data) {
  const msg = JSON.stringify(data);
  if (room.initiator?.readyState === WebSocket.OPEN) room.initiator.send(msg);
  if (room.partner?.readyState === WebSocket.OPEN) room.partner.send(msg);
}

// L3 — forward a server-derived regulation CATEGORY to the PARTNER of `fromUserDbId`
// in the session's room. Called by the REST bio-tick route after server-side
// processTick. Raw HRV never crosses the socket — only the category does.
function pushPartnerRegulation(sessionId, fromUserDbId, category) {
  const room = rooms.get(sessionId);
  if (!room) return false;
  let sent = false;
  for (const t of [room.initiator, room.partner]) {
    if (t && t.userDbId !== fromUserDbId && t.readyState === WebSocket.OPEN) {
      t.send(JSON.stringify({ type: 'partner_regulation', state: category }));
      sent = true;
    }
  }
  return sent;
}

module.exports = { initCoBreathWS, logEngagementEvent, getEngagementEvents, clearEngagementEvents, pushPartnerRegulation };
