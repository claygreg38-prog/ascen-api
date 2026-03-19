// ============================================================
// [ABI] LightBridge Engine — IoT Light Control
// File: src/abi/lightBridgeEngine.js
//
// Physical light that activates in family homes when a member
// completes a session. Communicates capacity state and events
// through color and pattern — NEVER raw clinical data.
//
// Flows through ABI orchestrator. All calls non-blocking.
// Device provider abstracted (LIFX today, Hue/custom tomorrow).
//
// Exports:
//   setCapacityState(userId, state)
//   triggerSessionEvent(userId, familyUnitId, eventType)
//   triggerCelebration(familyUnitId, celebrationType)
//   sendTestPattern(deviceId)
//   registerDevice(params)
//   getDevices(userId)
//   removeDevice(deviceId)
//   getEvents(familyUnitId, limit)
//   getDeviceState(userId)
//   manualOverride(deviceId, command)
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SIMULATE = process.env.LIGHTBRIDGE_SIMULATE === 'true';

// ── RATE LIMITING ───────────────────────────────────────────
const stateChangeTimestamps = new Map(); // deviceId → lastChangeTime
const STATE_CHANGE_COOLDOWN = 30 * 1000; // 30 seconds
const failureCounts = new Map(); // deviceId → consecutive failures
const MAX_CONSECUTIVE_FAILURES = 3;

// ── CAPACITY STATE → LIGHT MAPPING ──────────────────────────

const CAPACITY_LIGHT_MAP = {
  full: { color: 'kelvin:2500', brightness: 0.8, description: 'Warm steady glow' },
  steady: { color: 'kelvin:2700', brightness: 0.6, description: 'Moderate warm' },
  drawing_down: { color: 'kelvin:2700', brightness: 0.35, description: 'Dimming — be gentle' },
  low: { color: 'kelvin:2200', brightness: 0.15, pattern: 'slow_pulse', description: 'Needs space' },
  depleted: { color: 'kelvin:2000', brightness: 0.05, pattern: 'flicker', description: 'Leave them alone' }
};

// ── SESSION EVENT PATTERNS ──────────────────────────────────

const SESSION_EVENT_PATTERNS = {
  session_complete: { effect: 'pulse', color: '#5ffce0', period: 1.5, cycles: 3 },
  co_breath_active: { effect: 'breathe', color: '#2dd4a8', period: 4, cycles: 0 },
  member_joined: { effect: 'pulse', color: '#fad49a', period: 2, cycles: 5 }
};

// ── CELEBRATION PATTERNS ────────────────────────────────────

const CELEBRATION_PATTERNS = {
  gate_unlocked: { effect: 'breathe', color: '#5ffce0', period: 3, cycles: 5, target: 'family' },
  savings_milestone: { effect: 'setState', color: 'kelvin:2500', brightness: 1.0, duration: 60, target: 'individual' },
  family_milestone: { effect: 'breathe', color: '#5ffce0', period: 3, cycles: 10, target: 'family' }
};

// ── LIFX PROVIDER ───────────────────────────────────────────

const LIFX_BASE = 'https://api.lifx.com/v1';

async function lifxSetState(token, selector, { color, brightness, duration, power }) {
  const response = await fetch(`${LIFX_BASE}/lights/${selector}/state`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ power: power || 'on', color, brightness, duration: duration || 2.0 })
  });
  if (!response.ok) throw new Error(`LIFX setState ${response.status}`);
  return response.json();
}

async function lifxBreathe(token, selector, { color, period, cycles }) {
  const response = await fetch(`${LIFX_BASE}/lights/${selector}/effects/breathe`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ color, period, cycles, power_on: true })
  });
  if (!response.ok) throw new Error(`LIFX breathe ${response.status}`);
  return response.json();
}

async function lifxPulse(token, selector, { color, period, cycles }) {
  const response = await fetch(`${LIFX_BASE}/lights/${selector}/effects/pulse`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ color, period, cycles, power_on: true })
  });
  if (!response.ok) throw new Error(`LIFX pulse ${response.status}`);
  return response.json();
}

// ── COMMAND EXECUTION (with simulation) ─────────────────────

async function sendCommand(device, command, eventType) {
  const deviceId = device.id;

  if (SIMULATE) {
    console.log(`[LIGHTBRIDGE SIM] ${device.device_name || deviceId}: ${eventType} → ${JSON.stringify(command)}`);
    await pool.query(
      'UPDATE lightbridge_devices SET current_state = $1, last_heartbeat = NOW() WHERE id = $2',
      [JSON.stringify({ ...command, simulated: true }), deviceId]
    );
    return { simulated: true, command };
  }

  // Real API call
  try {
    let result;
    const provider = device.device_provider || 'lifx';

    if (provider === 'lifx') {
      if (command.effect === 'breathe') {
        result = await lifxBreathe(device.device_token, device.device_selector || 'all', command);
      } else if (command.effect === 'pulse') {
        result = await lifxPulse(device.device_token, device.device_selector || 'all', command);
      } else {
        result = await lifxSetState(device.device_token, device.device_selector || 'all', command);
      }
    }

    // Update device state
    await pool.query(
      'UPDATE lightbridge_devices SET current_state = $1, last_heartbeat = NOW() WHERE id = $2',
      [JSON.stringify(command), deviceId]
    );

    // Reset failure counter on success
    failureCounts.set(deviceId, 0);

    return result;
  } catch (err) {
    // Track consecutive failures
    const count = (failureCounts.get(deviceId) || 0) + 1;
    failureCounts.set(deviceId, count);

    if (count >= MAX_CONSECUTIVE_FAILURES) {
      await pool.query('UPDATE lightbridge_devices SET is_active = false WHERE id = $1', [deviceId]);
      console.error(`[LightBridge] Device ${deviceId} deactivated after ${count} failures`);
    }

    throw err;
  }
}

async function logEvent(deviceId, userId, familyUnitId, eventType, eventData, commandSent, success, errorMessage) {
  try {
    await pool.query(
      `INSERT INTO lightbridge_events (device_id, user_id, family_unit_id, event_type, event_data, command_sent, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [deviceId, userId, familyUnitId, eventType, JSON.stringify(eventData), JSON.stringify(commandSent), success, errorMessage]
    );
  } catch (err) {
    console.error('[LightBridge] Event log failed:', err.message);
    Sentry.captureException(err);
  }
}

// ── CORE FUNCTIONS ──────────────────────────────────────────

/**
 * Update capacity state light. Rate-limited to 1 change per 30s per device.
 * Non-blocking — errors logged, never thrown.
 */
async function setCapacityState(userId, state) {
  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return;

    const devices = await pool.query(
      'SELECT * FROM lightbridge_devices WHERE user_id = $1 AND is_active = true',
      [userRow.rows[0].id]
    );
    if (devices.rows.length === 0) return; // No device — silent return

    const lightConfig = CAPACITY_LIGHT_MAP[state] || CAPACITY_LIGHT_MAP.steady;

    for (const device of devices.rows) {
      // Rate limit: max 1 state change per 30s
      const lastChange = stateChangeTimestamps.get(device.id);
      if (lastChange && Date.now() - lastChange < STATE_CHANGE_COOLDOWN) continue;
      stateChangeTimestamps.set(device.id, Date.now());

      const command = { color: lightConfig.color, brightness: lightConfig.brightness, duration: 2.0, power: 'on' };

      try {
        await sendCommand(device, command, 'capacity_state');

        // If low/depleted, add slow pulse pattern
        if (lightConfig.pattern === 'slow_pulse') {
          await sendCommand(device, { effect: 'breathe', color: lightConfig.color, period: 8, cycles: 0 }, 'capacity_state');
        } else if (lightConfig.pattern === 'flicker') {
          await sendCommand(device, { effect: 'breathe', color: lightConfig.color, period: 12, cycles: 0 }, 'capacity_state');
        }

        await logEvent(device.id, userRow.rows[0].id, device.family_unit_id, 'capacity_state', { state }, command, true, null);
      } catch (err) {
        await logEvent(device.id, userRow.rows[0].id, device.family_unit_id, 'capacity_state', { state }, command, false, err.message);
        console.error('[LightBridge] Capacity state failed:', err.message);
        Sentry.captureException(err);
      }
    }
  } catch (err) {
    console.error('[LightBridge] setCapacityState failed:', err.message);
    Sentry.captureException(err);
  }
}

/**
 * Trigger session event on family devices. Non-blocking.
 */
async function triggerSessionEvent(userId, familyUnitId, eventType) {
  try {
    const pattern = SESSION_EVENT_PATTERNS[eventType];
    if (!pattern) return;

    const devices = await pool.query(
      'SELECT * FROM lightbridge_devices WHERE family_unit_id = $1 AND is_active = true',
      [familyUnitId]
    );

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    const userDbId = userRow.rows[0]?.id;

    for (const device of devices.rows) {
      try {
        await sendCommand(device, pattern, eventType);
        await logEvent(device.id, userDbId, familyUnitId, eventType, { triggeredBy: userId }, pattern, true, null);
      } catch (err) {
        await logEvent(device.id, userDbId, familyUnitId, eventType, { triggeredBy: userId }, pattern, false, err.message);
        Sentry.captureException(err);
      }
    }
  } catch (err) {
    console.error('[LightBridge] triggerSessionEvent failed:', err.message);
    Sentry.captureException(err);
  }
}

/**
 * Trigger celebration pattern on family devices. Non-blocking.
 */
async function triggerCelebration(familyUnitId, celebrationType) {
  try {
    const pattern = CELEBRATION_PATTERNS[celebrationType];
    if (!pattern) return;

    const devices = await pool.query(
      'SELECT * FROM lightbridge_devices WHERE family_unit_id = $1 AND is_active = true',
      [familyUnitId]
    );

    for (const device of devices.rows) {
      try {
        const command = pattern.effect === 'setState'
          ? { color: pattern.color, brightness: pattern.brightness, duration: pattern.duration, power: 'on' }
          : { effect: pattern.effect, color: pattern.color, period: pattern.period, cycles: pattern.cycles };

        await sendCommand(device, command, 'celebration');
        await logEvent(device.id, null, familyUnitId, 'celebration', { celebrationType }, command, true, null);
      } catch (err) {
        await logEvent(device.id, null, familyUnitId, 'celebration', { celebrationType }, command, false, err.message);
        Sentry.captureException(err);
      }
    }
  } catch (err) {
    console.error('[LightBridge] triggerCelebration failed:', err.message);
    Sentry.captureException(err);
  }
}

/**
 * Send test pattern: 3 slow color pulses (teal → amber → teal).
 */
async function sendTestPattern(deviceId) {
  try {
    const device = await pool.query('SELECT * FROM lightbridge_devices WHERE id = $1', [deviceId]);
    if (device.rows.length === 0) return { error: true, message: 'Device not found' };

    const d = device.rows[0];
    const colors = ['#5ffce0', '#fad49a', '#5ffce0'];

    for (const color of colors) {
      await sendCommand(d, { effect: 'pulse', color, period: 1.5, cycles: 1 }, 'test_pattern');
      if (!SIMULATE) await new Promise(r => setTimeout(r, 2000)); // Wait between pulses
    }

    await logEvent(deviceId, d.user_id, d.family_unit_id, 'test_pattern', {}, { colors }, true, null);
    return { success: true, simulated: SIMULATE };
  } catch (err) {
    console.error('[LightBridge] Test pattern failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: err.message };
  }
}

// ── DEVICE MANAGEMENT ───────────────────────────────────────

async function registerDevice(params) {
  const { userId, familyUnitId, deviceProvider, deviceToken, deviceSelector, deviceName, tenantId } = params;

  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return { error: true, message: 'User not found' };

    const result = await pool.query(
      `INSERT INTO lightbridge_devices (user_id, family_unit_id, tenant_id, device_provider, device_token, device_selector, device_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userRow.rows[0].id, familyUnitId, tenantId, deviceProvider || 'lifx', deviceToken, deviceSelector, deviceName]
    );

    const deviceId = result.rows[0].id;

    // Send test pattern
    const testResult = await sendTestPattern(deviceId);

    if (testResult.error) {
      // Mark as inactive if test fails
      await pool.query('UPDATE lightbridge_devices SET is_active = false WHERE id = $1', [deviceId]);
      return { deviceId, testResult: 'failed', error: testResult.message };
    }

    await pool.query('UPDATE lightbridge_devices SET last_heartbeat = NOW() WHERE id = $1', [deviceId]);
    console.log(`[LightBridge] Device ${deviceId} registered for user ${userId}`);

    return { deviceId, testResult: 'success', simulated: SIMULATE };
  } catch (err) {
    console.error('[LightBridge] Registration failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Registration failed' };
  }
}

async function getDevices(userId) {
  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return [];

    const devices = await pool.query(
      `SELECT id, device_provider, device_name, device_selector, current_state, is_active, last_heartbeat, created_at
       FROM lightbridge_devices WHERE user_id = $1 ORDER BY created_at DESC`,
      [userRow.rows[0].id]
    );
    return devices.rows;
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

async function removeDevice(deviceId) {
  try {
    await pool.query('UPDATE lightbridge_devices SET is_active = false WHERE id = $1', [deviceId]);
    return { removed: true };
  } catch (err) {
    Sentry.captureException(err);
    return { error: true, message: 'Remove failed' };
  }
}

async function getDeviceState(userId) {
  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return null;

    const device = await pool.query(
      'SELECT current_state, is_active, last_heartbeat FROM lightbridge_devices WHERE user_id = $1 AND is_active = true LIMIT 1',
      [userRow.rows[0].id]
    );
    return device.rows[0] || null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function getEvents(familyUnitId, limit = 20) {
  try {
    const events = await pool.query(
      `SELECT le.event_type, le.event_data, le.command_sent, le.success, le.error_message, le.created_at,
              ld.device_name
       FROM lightbridge_events le
       LEFT JOIN lightbridge_devices ld ON le.device_id = ld.id
       WHERE le.family_unit_id = $1
       ORDER BY le.created_at DESC LIMIT $2`,
      [familyUnitId, limit]
    );
    return events.rows;
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

async function manualOverride(deviceId, command) {
  try {
    const device = await pool.query('SELECT * FROM lightbridge_devices WHERE id = $1', [deviceId]);
    if (device.rows.length === 0) return { error: true, message: 'Device not found' };

    // Rate limit: respect 30s cooldown even for manual overrides
    const lastChange = stateChangeTimestamps.get(deviceId);
    if (lastChange && Date.now() - lastChange < STATE_CHANGE_COOLDOWN) {
      return { error: true, message: 'Rate limited — wait 30 seconds between state changes' };
    }
    stateChangeTimestamps.set(deviceId, Date.now());

    const result = await sendCommand(device.rows[0], command, 'capacity_state');
    await logEvent(deviceId, device.rows[0].user_id, device.rows[0].family_unit_id, 'capacity_state', { manual: true }, command, true, null);
    return { success: true, result };
  } catch (err) {
    Sentry.captureException(err);
    return { error: true, message: err.message };
  }
}

module.exports = {
  setCapacityState,
  triggerSessionEvent,
  triggerCelebration,
  sendTestPattern,
  registerDevice,
  getDevices,
  removeDevice,
  getDeviceState,
  getEvents,
  manualOverride,
  CAPACITY_LIGHT_MAP,
  SESSION_EVENT_PATTERNS,
  CELEBRATION_PATTERNS
};
