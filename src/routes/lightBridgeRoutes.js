// ============================================================
// [ABI] LightBridge Routes — IoT Device Control API
// File: src/routes/lightBridgeRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// Light states communicate capacity and events — never raw clinical data.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const lightBridgeEngine = require('../abi/lightBridgeEngine');

// ── POST /register — Register a new device ───────────────────

router.post('/register', async (req, res) => {
  try {
    const { user_id, family_unit_id, device_provider, device_token, device_selector, device_name } = req.body;

    if (!user_id || !device_token) {
      return res.status(400).json({ error: 'user_id and device_token required' });
    }

    const result = await lightBridgeEngine.registerDevice({
      userId: user_id,
      familyUnitId: family_unit_id,
      deviceProvider: device_provider,
      deviceToken: device_token,
      deviceSelector: device_selector,
      deviceName: device_name,
      tenantId: req.tenantId
    });

    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[LightBridge] Register failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── GET /devices/:userId — List user's devices ───────────────

router.get('/devices/:userId', async (req, res) => {
  try {
    const devices = await lightBridgeEngine.getDevices(req.params.userId);
    res.json({ devices });
  } catch (err) {
    console.error('[LightBridge] List devices failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

// ── DELETE /devices/:id — Unregister a device ────────────────

router.delete('/devices/:id', async (req, res) => {
  try {
    const result = await lightBridgeEngine.removeDevice(req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[LightBridge] Remove device failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// ── POST /test/:deviceId — Send test pattern ─────────────────

router.post('/test/:deviceId', async (req, res) => {
  try {
    const result = await lightBridgeEngine.sendTestPattern(req.params.deviceId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[LightBridge] Test pattern failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Test pattern failed' });
  }
});

// ── GET /state/:userId — Get current light state ─────────────

router.get('/state/:userId', async (req, res) => {
  try {
    const state = await lightBridgeEngine.getDeviceState(req.params.userId);
    if (!state) return res.json({ device: null, message: 'No active LightBridge device' });
    res.json({ device: state });
  } catch (err) {
    console.error('[LightBridge] Get state failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get state' });
  }
});

// ── GET /events/:familyUnitId — Recent events ────────────────

router.get('/events/:familyUnitId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const events = await lightBridgeEngine.getEvents(req.params.familyUnitId, limit);
    res.json({ events });
  } catch (err) {
    console.error('[LightBridge] Get events failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// ── POST /manual/:deviceId — Manual state override ───────────

router.post('/manual/:deviceId', async (req, res) => {
  try {
    const { color, brightness, duration, power, effect, period, cycles } = req.body;
    const command = {};
    if (color) command.color = color;
    if (brightness !== undefined) command.brightness = brightness;
    if (duration) command.duration = duration;
    if (power) command.power = power;
    if (effect) command.effect = effect;
    if (period) command.period = period;
    if (cycles !== undefined) command.cycles = cycles;

    const result = await lightBridgeEngine.manualOverride(req.params.deviceId, command);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[LightBridge] Manual override failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Manual override failed' });
  }
});

module.exports = router;
