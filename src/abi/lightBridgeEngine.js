// ============================================================
// [ABI] LightBridge Engine — IoT Light Control
// File: src/abi/lightBridgeEngine.js
//
// Physical light that activates in family homes when a member
// completes a session. Communicates capacity state and events
// through color and pattern — NEVER raw clinical data.
//
// Flows through ABI orchestrator. All calls non-blocking.
// Device provider abstracted (LIFX, Wyze, Hue, custom).
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

// ── NS3 STATE → LIGHT MAPPING ─────────────────────────────────

const NS3_STATE_MAP = {
  optimal: { color: '#FFF5E0', brightness: 80, description: 'Warm steady glow — safe to engage' },
  approaching: { color: '#F59E0B', brightness: 70, description: 'Moderate warm — approaching regulation' },
  below_window: { color: '#93C5FD', brightness: 60, description: 'Calm blue — needs gentle space' },
  overdrive: { color: '#FCA5A5', brightness: 40, description: 'Soft red — system is calming down' }
};

const CAPACITY_TO_NS3 = {
  full: 'optimal',
  steady: 'approaching',
  drawing_down: 'approaching',
  low: 'below_window',
  depleted: 'overdrive'
};

// ── TRIGGER TYPES ───────────────────────────────────────────

const TRIGGER_TYPES = {
  SESSION_COMPLETE: 'session_complete',
  ARRIVAL_HOME: 'arrival_home',
  MANUAL_OVERRIDE: 'manual_override',
  CAPACITY_CHANGE: 'capacity_change',
  CELEBRATION: 'celebration'
};

// ── RESET TIMERS ────────────────────────────────────────────

const resetTimers = new Map();

function scheduleReset(familyUnitId, holdMinutes) {
  if (resetTimers.has(familyUnitId)) clearTimeout(resetTimers.get(familyUnitId));

  const ms = (holdMinutes || 0) * 60 * 1000;
  if (ms <= 0) {
    // Immediate reset
    resetLights(familyUnitId);
    return;
  }

  const timer = setTimeout(() => {
    resetLights(familyUnitId);
    resetTimers.delete(familyUnitId);
  }, ms);
  resetTimers.set(familyUnitId, timer);
}

async function resetLights(familyUnitId) {
  try {
    const devices = await pool.query(
      "SELECT * FROM lightbridge_devices WHERE family_unit_id = $1 AND is_active = true AND device_subtype IN ('light', 'plug')",
      [familyUnitId]
    );
    for (const d of devices.rows) {
      await sendCommand(d, { color: '#1a1a1a', brightness: 0.05, power: 'on' }, 'reset');
    }
  } catch (err) {
    console.error('[LightBridge] resetLights failed:', err.message);
  }
}

// ── UNIFIED TRIGGER ─────────────────────────────────────────

async function triggerLightBridge({ family_unit_id, user_id, trigger_type }) {
  try {
    // Check if enabled
    const family = await pool.query(
      'SELECT lightbridge_active, lightbridge_hold_minutes, lightbridge_privacy_mode FROM family_units WHERE family_unit_id = $1',
      [family_unit_id]
    );
    if (!family.rows.length || !family.rows[0].lightbridge_active) return;

    const holdMinutes = family.rows[0].lightbridge_hold_minutes || 30;
    const privacyMode = family.rows[0].lightbridge_privacy_mode || 'caregiver_controlled';

    // Check member visibility
    if (privacyMode === 'caregiver_controlled') {
      const membership = await pool.query(
        'SELECT lightbridge_visible FROM family_memberships WHERE family_unit_id = $1 AND user_id = (SELECT id FROM users WHERE user_id = $2 OR participant_id = $2 LIMIT 1)',
        [family_unit_id, user_id]
      );
      if (membership.rows.length > 0 && !membership.rows[0].lightbridge_visible) return;
    }

    // Check personal privacy mode
    const userRow = await pool.query(
      'SELECT id, privacy_mode FROM users WHERE user_id = $1 OR participant_id = $1 LIMIT 1',
      [user_id]
    );
    if (userRow.rows[0]?.privacy_mode) return;
    const userDbId = userRow.rows[0]?.id;

    // Get capacity state → NS3 zone
    let ns3Zone = 'approaching';
    try {
      const capacityCurrency = require('./capacityCurrency');
      const balance = await capacityCurrency.getBalance(user_id);
      ns3Zone = CAPACITY_TO_NS3[balance?.state] || 'approaching';
    } catch {}

    const stateMap = NS3_STATE_MAP[ns3Zone] || NS3_STATE_MAP.approaching;

    // Get devices
    const devices = await pool.query(
      'SELECT * FROM lightbridge_devices WHERE family_unit_id = $1 AND is_active = true',
      [family_unit_id]
    );

    const lightDevices = devices.rows.filter(d => d.device_subtype === 'light' || d.device_subtype === 'plug' || !d.device_subtype);
    const speakerDevices = devices.rows.filter(d => d.device_subtype === 'speaker');

    // Send light commands
    for (const d of lightDevices) {
      try {
        await sendCommand(d, { color: stateMap.color, brightness: stateMap.brightness / 100, power: 'on' }, trigger_type);
        await logEvent(d.id, userDbId, family_unit_id, trigger_type, { ns3Zone }, { color: stateMap.color, brightness: stateMap.brightness }, true, null);
      } catch (err) {
        Sentry.captureException(err);
      }
    }

    // Play music on speakers
    const musicService = require('../services/lightBridgeMusicService');
    const track = await musicService.getMusicTrack(family_unit_id, ns3Zone);
    for (const d of speakerDevices) {
      await musicService.playTrack(d, track);
    }

    // Schedule reset
    scheduleReset(family_unit_id, holdMinutes);

    console.log(`[LightBridge] Triggered: family=${family_unit_id}, type=${trigger_type}, zone=${ns3Zone}`);
  } catch (err) {
    console.error('[LightBridge] triggerLightBridge failed:', err.message);
    Sentry.captureException(err);
  }
}

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

// ── WYZE PROVIDER ────────────────────────────────────────────

const WYZE_API = 'https://api.wyzecam.com/app/v2';

function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return { r: 255, g: 245, b: 224 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

async function wyzeSetState(token, deviceMac, command) {
  if (!token || !deviceMac) return;

  // Handle effects by simulating brightness alternation
  if (command.effect === 'breathe' || command.effect === 'pulse') {
    const cycles = command.cycles || 3;
    const halfPeriod = ((command.period || 4) * 500);
    for (let i = 0; i < cycles; i++) {
      await wyzeSetColorBrightness(token, deviceMac, command.color, 80);
      await new Promise(r => setTimeout(r, halfPeriod));
      await wyzeSetColorBrightness(token, deviceMac, command.color, 20);
      await new Promise(r => setTimeout(r, halfPeriod));
    }
    return;
  }

  await wyzeSetColorBrightness(token, deviceMac, command.color, Math.round((command.brightness || 0.8) * 100));
}

async function wyzeSetColorBrightness(token, deviceMac, color, brightness) {
  const rgb = hexToRgb(color);
  try {
    await fetch(`${WYZE_API}/device/set_property_list`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_mac: deviceMac,
        device_model: 'WLPA19',
        property_list: [
          { pid: 'P1507', pvalue: `${rgb.r},${rgb.g},${rgb.b}` },
          { pid: 'P1501', pvalue: String(brightness) }
        ]
      })
    });
  } catch (err) {
    throw new Error(`Wyze API error: ${err.message}`);
  }
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
    } else if (provider === 'wyze') {
      result = await wyzeSetState(device.device_token, device.wyze_device_id || device.device_selector, command);
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
  triggerLightBridge,
  sendTestPattern,
  registerDevice,
  getDevices,
  removeDevice,
  getDeviceState,
  getEvents,
  manualOverride,
  scheduleReset,
  CAPACITY_LIGHT_MAP,
  NS3_STATE_MAP,
  CAPACITY_TO_NS3,
  SESSION_EVENT_PATTERNS,
  CELEBRATION_PATTERNS,
  TRIGGER_TYPES
};
