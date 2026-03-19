// ============================================================
// Stripe Webhook Routes
// File: src/routes/webhookRoutes.js
//
// CRITICAL: Uses express.raw() for Stripe signature verification.
// Must be mounted BEFORE express.json() in server.js.
// ============================================================

const express = require('express');
const router = express.Router();

router.post('/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.log('[WEBHOOK] Stripe not configured — ignoring webhook');
      return res.json({ received: true, mode: 'pilot' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[WEBHOOK] Signature verification failed:', err.message);
      return res.status(400).send('Webhook signature verification failed');
    }

    const subscriptionService = require('../services/subscriptionService');

    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await subscriptionService.handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await subscriptionService.handlePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.updated':
          // Handled via payment events and our own update flow
          console.log('[WEBHOOK] subscription.updated:', event.data.object.id);
          break;

        case 'customer.subscription.deleted':
          await subscriptionService.handleSubscriptionDeleted(event.data.object);
          break;

        default:
          console.log('[WEBHOOK] Unhandled event:', event.type);
      }
    } catch (err) {
      console.error('[WEBHOOK] Handler error:', err.message);
      // Still return 200 to prevent Stripe from retrying
    }

    res.json({ received: true });
  }
);

module.exports = router;
