// ============================================================
// Co-Breath WebSocket Server — Real-Time Breath Sync
// File: src/services/coBreathWebSocket.js
//
// Raw HRV values NEVER sent over WebSocket. Only regulation
// state categories ('regulated', 'approaching', 'below').
// Room expires after 15 minutes of inactivity.
// ============================================================

const WebSocket = require('ws');

const rooms = new Map(); // roomCode → { initiator, partner, state, breathParams, lastActivity }

// ── ENGAGEMENT EVENT LOG — Clinical Kitchen Table (Correction #4) ──
// Stores engagement events per session for communication analysis.
// In-memory per server instance; clinical analysis runs at session completion
// before the data would be lost. For horizontal scaling, move to Redis/DB.
const engagementEvents = new Map(); // sessionId → [{ user_id, status, timestamp, ... }]

function logEngagementEvent(sessionId, event) {
  if (!engagementEvents.has(sessionId)) {
    engagementEvents.set(sessionId, []);
  }
  engagementEvents.get(sessionId).push(event);

  // Cap at 1000 events per session to bound memory
  const events = engagementEvents.get(sessionId);
  if (events.length > 1000) {
    engagementEvents.set(sessionId, events.slice(-500));
  }
}

function getEngagementEvents(sessionId) {
  return engagementEvents.get(sessionId) || [];
}

function clearEngagementEvents(sessionId) {
  engagementEvents.delete(sessionId);
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

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        switch (msg.type) {
          case 'join': handleJoin(ws, msg); break;
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

function handleJoin(ws, msg) {
  const { roomCode, userId } = msg;
  if (!roomCode || !userId) {
    ws.send(JSON.stringify({ type: 'error', message: 'roomCode and userId required' }));
    return;
  }

  let room = rooms.get(roomCode);
  if (!room) {
    room = { initiator: null, partner: null, state: 'waiting', breathParams: msg.breathParams || {}, lastActivity: Date.now() };
    rooms.set(roomCode, room);
  }

  ws.roomCode = roomCode;
  ws.userId = userId;

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
  setTimeout(() => {
    if (room.state === 'countdown') {
      room.state = 'breathing';
      broadcast(room, { type: 'breathing_start', breathParams: room.breathParams });
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

module.exports = { initCoBreathWS, logEngagementEvent, getEngagementEvents, clearEngagementEvents };
