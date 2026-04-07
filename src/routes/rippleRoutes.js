// ============================================================
// Ripple Signal Routes — /api/ripple
// "They showed up today."
// ============================================================

const express = require('express');
const router = express.Router();
const rippleService = require('../services/rippleService');

// POST /api/ripple/add — Add a recipient
router.post('/add', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { recipient_phone, recipient_name } = req.body;
    if (!recipient_phone) return res.status(400).json({ error: 'recipient_phone is required' });

    const result = await rippleService.addRecipient(userId, recipient_phone, recipient_name);
    if (result.error) return res.status(409).json(result);

    res.json(result);
  } catch (err) {
    console.error('[RIPPLE] Add error:', err.message);
    res.status(500).json({ error: 'Failed to add recipient' });
  }
});

// POST /api/ripple/confirm — Confirm a recipient (via inbound SMS webhook or manual)
router.post('/confirm', async (req, res) => {
  try {
    const { recipient_phone } = req.body;
    if (!recipient_phone) return res.status(400).json({ error: 'recipient_phone is required' });

    const result = await rippleService.confirmRecipient(recipient_phone);
    if (!result) return res.status(404).json({ error: 'No pending signal for this phone number' });

    res.json({ confirmed: true, id: result.id });
  } catch (err) {
    console.error('[RIPPLE] Confirm error:', err.message);
    res.status(500).json({ error: 'Failed to confirm' });
  }
});

// POST /api/ripple/pause — Pause the signal
router.post('/pause', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    await rippleService.pauseSignal(userId);
    res.json({ paused: true });
  } catch (err) {
    console.error('[RIPPLE] Pause error:', err.message);
    res.status(500).json({ error: 'Failed to pause' });
  }
});

// POST /api/ripple/resume — Resume a paused signal
router.post('/resume', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    await rippleService.resumeSignal(userId);
    res.json({ resumed: true });
  } catch (err) {
    console.error('[RIPPLE] Resume error:', err.message);
    res.status(500).json({ error: 'Failed to resume' });
  }
});

// DELETE /api/ripple/:id — Remove a signal (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    await rippleService.removeSignal(userId, req.params.id);
    res.json({ removed: true });
  } catch (err) {
    console.error('[RIPPLE] Remove error:', err.message);
    res.status(500).json({ error: 'Failed to remove' });
  }
});

// GET /api/ripple/status — Get current signal status
router.get('/status', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const status = await rippleService.getStatus(userId);
    res.json(status);
  } catch (err) {
    console.error('[RIPPLE] Status error:', err.message);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

module.exports = router;
