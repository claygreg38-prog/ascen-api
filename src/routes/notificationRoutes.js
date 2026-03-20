// ============================================================
// Notification Routes — Push Token Management
// File: src/routes/notificationRoutes.js
//
// Mount at /api/notifications. Requires JWT.
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Register device token
router.post('/register-device', async (req, res) => {
  try {
    const pushService = require('../services/pushService');
    const { platform, push_token } = req.body;
    if (!platform || !push_token) return res.status(400).json({ error: 'platform and push_token required' });

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await pushService.registerToken(userRow.rows[0].id, platform, push_token);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Unregister token
router.post('/unregister', async (req, res) => {
  try {
    const pushService = require('../services/pushService');
    const { push_token } = req.body;
    if (!push_token) return res.status(400).json({ error: 'push_token required' });

    const result = await pushService.unregisterToken(push_token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to unregister' });
  }
});

// Test push (admin only)
router.post('/test', async (req, res) => {
  try {
    const pushService = require('../services/pushService');
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await pushService.sendPush(userRow.rows[0].id, 'ASCEN Test', 'Push notifications are working.', { type: 'test' });
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Test push failed' });
  }
});

module.exports = router;
