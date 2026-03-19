// ============================================================
// Subscription Routes — Billing & Tier Management
// File: src/routes/subscriptionRoutes.js
//
// Mount at /api/subscription. Requires JWT.
// 10 endpoints for subscription lifecycle.
// ============================================================

const express = require('express');
const router = express.Router();
const Sentry = require('../instrument');

// ── TIERS ───────────────────────────────────────────────────

router.get('/tiers', (req, res) => {
  res.json({
    tiers: [
      {
        id: 'base',
        name: 'Base LightBridge',
        price: 'Included',
        monthly_cents: 0,
        features: ['One-way messages', 'Pre-written library', 'Child practices', 'Basic caregiver dashboard', 'Standard vault']
      },
      {
        id: 'guided_bridge',
        name: 'Guided Bridge',
        price: '$14.99/month',
        monthly_cents: 1499,
        trial_days: 14,
        features: ['Two-way facilitated messaging', 'Partner/co-parent channels', 'Conflict resolution', 'Letter writing assistant', 'Shared breathing', 'Therapy prep reports', 'Advanced vault']
      },
      {
        id: 'family_compass',
        name: 'Family Compass',
        price: '$29.99/month',
        monthly_cents: 2999,
        requires: 'guided_bridge',
        features: ['Personalized family curriculum', 'Predictive relationship intelligence', 'Multi-generational healing map']
      }
    ],
    pilot_mode: !process.env.STRIPE_SECRET_KEY
  });
});

// ── CURRENT SUBSCRIPTION ────────────────────────────────────

router.get('/current/:familyUnitId', async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const result = await subscriptionService.getCurrentSubscription(req.params.familyUnitId);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// ── START TRIAL ─────────────────────────────────────────────

router.post('/trial/start', async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const { family_unit_id } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await subscriptionService.startTrial(family_unit_id, 'guided_bridge', req.tenantId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start trial' });
  }
});

// ── CREATE SUBSCRIPTION ─────────────────────────────────────

router.post('/create', async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const { family_unit_id, tier, payment_method_id } = req.body;
    if (!family_unit_id || !tier) return res.status(400).json({ error: 'family_unit_id and tier required' });

    const result = await subscriptionService.createSubscription(family_unit_id, tier, payment_method_id, req.tenantId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// ── UPGRADE ─────────────────────────────────────────────────

router.post('/upgrade', async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const { family_unit_id, tier } = req.body;
    if (!family_unit_id || !tier) return res.status(400).json({ error: 'family_unit_id and tier required' });

    const result = await subscriptionService.upgradeSubscription(family_unit_id, tier, req.tenantId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to upgrade' });
  }
});

// ── DOWNGRADE ───────────────────────────────────────────────

router.post('/downgrade', async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const { family_unit_id, tier, reason } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await subscriptionService.downgradeSubscription(family_unit_id, tier || 'base', reason);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to downgrade' });
  }
});

// ── CANCEL ──────────────────────────────────────────────────

router.post('/cancel', async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const { family_unit_id, reason } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await subscriptionService.cancelSubscription(family_unit_id, reason);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// ── REACTIVATE ──────────────────────────────────────────────

router.post('/reactivate', async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const { family_unit_id } = req.body;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await subscriptionService.reactivateSubscription(family_unit_id, req.tenantId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to reactivate' });
  }
});

// ── HISTORY ─────────────────────────────────────────────────

router.get('/history/:familyUnitId', async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const result = await subscriptionService.getHistory(req.params.familyUnitId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ── UPDATE PAYMENT METHOD ───────────────────────────────────

router.post('/update-payment', async (req, res) => {
  try {
    const { family_unit_id, payment_method_id } = req.body;
    if (!family_unit_id || !payment_method_id) {
      return res.status(400).json({ error: 'family_unit_id and payment_method_id required' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({ updated: true, mode: 'pilot', message: 'Pilot mode — no payment method needed' });
    }

    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const sub = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE family_unit_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1',
      [family_unit_id]
    );

    if (sub.rows.length === 0) return res.status(404).json({ error: 'No subscription found' });

    const customerId = sub.rows[0].stripe_customer_id;
    await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id }
    });

    res.json({ updated: true });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

module.exports = router;
