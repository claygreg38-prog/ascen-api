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
    const { family_unit_id, device_provider, device_token, device_selector, device_name } = req.body;
    const user_id = req.user?.participant_id || req.user?.user_id || req.user?.sub;

    if (!user_id || !device_token) {
      return res.status(400).json({ error: 'device_token required' });
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

// ── POST /trigger — Unified trigger (session/arrival/manual) ──

router.post('/trigger', async (req, res) => {
  try {
    const { family_unit_id, user_id, trigger_type } = req.body;
    await lightBridgeEngine.triggerLightBridge({
      family_unit_id,
      user_id: user_id || req.user?.userId || req.user?.sub,
      trigger_type: trigger_type || 'manual_override'
    });
    res.json({ triggered: true });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Trigger failed' });
  }
});

// ── POST /arrival — Arrival-home trigger ─────────────────────

router.post('/arrival', async (req, res) => {
  try {
    const { family_unit_id } = req.body;
    const userId = req.user?.userId || req.user?.sub;
    await lightBridgeEngine.triggerLightBridge({
      family_unit_id,
      user_id: userId,
      trigger_type: 'arrival_home'
    });
    res.json({ triggered: true, trigger_type: 'arrival_home' });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Arrival trigger failed' });
  }
});

// ── GET /music — Available music tracks ──────────────────────

router.get('/music', async (req, res) => {
  try {
    const musicService = require('../services/lightBridgeMusicService');
    const tracks = await musicService.getAllTracks();
    res.json({ tracks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get music' });
  }
});

// ── POST /prefs — Set family music preferences ──────────────

router.post('/prefs', async (req, res) => {
  try {
    const musicService = require('../services/lightBridgeMusicService');
    const { family_unit_id, ns3_state, track_id, custom_file_url } = req.body;
    if (!family_unit_id || !ns3_state) return res.status(400).json({ error: 'family_unit_id and ns3_state required' });

    const result = await musicService.setFamilyPreference(family_unit_id, ns3_state, track_id, custom_file_url);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// ── PUT /visibility — Update member LightBridge visibility ───

router.put('/visibility', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { family_unit_id, member_user_id, visible } = req.body;
    if (!family_unit_id || !member_user_id) return res.status(400).json({ error: 'family_unit_id and member_user_id required' });

    await pool.query(
      'UPDATE family_memberships SET lightbridge_visible = $1 WHERE family_unit_id = $2 AND user_id = $3',
      [visible !== false, family_unit_id, member_user_id]
    );
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

// ── POST /reset/:familyUnitId — Force reset lights ───────────

router.post('/reset/:familyUnitId', async (req, res) => {
  try {
    lightBridgeEngine.scheduleReset(req.params.familyUnitId, 0);
    res.json({ reset: true });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ── GET /config/:familyUnitId — Get LightBridge config ───────

router.get('/config/:familyUnitId', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const config = await pool.query(
      'SELECT lightbridge_active, lightbridge_hold_minutes, lightbridge_privacy_mode FROM family_units WHERE family_unit_id = $1',
      [req.params.familyUnitId]
    );
    res.json(config.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to get config' });
  }
});

// ── PUT /config/:familyUnitId — Update LightBridge config ────

router.put('/config/:familyUnitId', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { lightbridge_enabled, lightbridge_hold_minutes, lightbridge_privacy_mode } = req.body;
    await pool.query(
      `UPDATE family_units SET
        lightbridge_active = COALESCE($1, lightbridge_active),
        lightbridge_hold_minutes = COALESCE($2, lightbridge_hold_minutes),
        lightbridge_privacy_mode = COALESCE($3, lightbridge_privacy_mode)
       WHERE family_unit_id = $4`,
      [lightbridge_enabled, lightbridge_hold_minutes, lightbridge_privacy_mode, req.params.familyUnitId]
    );
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update config' });
  }
});

module.exports = router;
