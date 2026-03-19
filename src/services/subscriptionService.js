// ============================================================
// Subscription Service — Stripe Integration + Lifecycle Management
// File: src/services/subscriptionService.js
//
// Handles trials, subscriptions, upgrades, downgrades, cancellation.
// Pilot mode: works without STRIPE_SECRET_KEY (manual tier management).
// Downgrade preserves ALL data read-only. No data hostage. Ever.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TIER_CONFIG = {
  guided_bridge: {
    price_id: process.env.STRIPE_GUIDED_BRIDGE_PRICE_ID,
    monthly_cents: 1499,
    display_name: 'Guided Bridge',
    trial_days: 14
  },
  family_compass: {
    price_id: process.env.STRIPE_FAMILY_COMPASS_PRICE_ID,
    monthly_cents: 2999,
    display_name: 'Family Compass',
    requires_tier: 'guided_bridge',
    trial_days: 0
  }
};

const GRACE_PERIOD_DAYS = 7;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ── START TRIAL ─────────────────────────────────────────────

async function startTrial(familyUnitId, tier, tenantId) {
  try {
    if (!TIER_CONFIG[tier]) return { error: true, message: 'Invalid tier' };

    // Only guided_bridge has trial
    if (tier !== 'guided_bridge') {
      return { error: true, message: 'Trial is only available for Guided Bridge' };
    }

    // Verify family exists
    const family = await pool.query(
      'SELECT family_unit_id, premium_tier FROM family_units WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (family.rows.length === 0) return { error: true, message: 'Family unit not found' };

    // Check for previous trial (one trial per tier per family)
    const prevTrial = await pool.query(
      'SELECT id FROM subscriptions WHERE family_unit_id = $1 AND tier = $2 AND is_trial = true',
      [familyUnitId, tier]
    );
    if (prevTrial.rows.length > 0) {
      return { error: true, message: 'Trial already used for this tier. Subscribe to access Guided Bridge.' };
    }

    const trialDays = TIER_CONFIG[tier].trial_days;
    const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    // Create subscription record
    const sub = await pool.query(
      `INSERT INTO subscriptions
       (family_unit_id, tenant_id, tier, status, is_trial, trial_start_date, trial_end_date, monthly_price_cents)
       VALUES ($1, $2, $3, 'trial', true, NOW(), $4, $5)
       RETURNING id`,
      [familyUnitId, tenantId, tier, trialEnd, TIER_CONFIG[tier].monthly_cents]
    );

    // Update family tier
    await pool.query(
      'UPDATE family_units SET premium_tier = $1 WHERE family_unit_id = $2',
      [tier, familyUnitId]
    );

    // Log event
    await logEvent(sub.rows[0].id, familyUnitId, 'trial_started', null, tier);

    console.log(`[BILLING] Trial started: family ${familyUnitId} → ${tier}, expires ${trialEnd.toISOString()}`);

    return {
      subscriptionId: sub.rows[0].id,
      tier,
      trialEndsAt: trialEnd,
      trialDays
    };
  } catch (err) {
    console.error('[Subscription] startTrial failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to start trial' };
  }
}

// ── CREATE SUBSCRIPTION ─────────────────────────────────────

async function createSubscription(familyUnitId, tier, paymentMethodId, tenantId) {
  try {
    if (!TIER_CONFIG[tier]) return { error: true, message: 'Invalid tier' };

    // Verify tier prerequisites
    if (TIER_CONFIG[tier].requires_tier) {
      const current = await pool.query(
        'SELECT premium_tier FROM family_units WHERE family_unit_id = $1',
        [familyUnitId]
      );
      const currentTier = current.rows[0]?.premium_tier || 'base';
      const { validateUpgrade } = require('../middleware/premiumGate');
      const validation = validateUpgrade(currentTier, tier);
      if (!validation.valid) return { error: true, message: validation.message };
    }

    const stripe = getStripe();

    if (!stripe) {
      // Pilot mode: manual billing
      console.log(`[BILLING] Manual subscription: family ${familyUnitId} → ${tier}`);

      // Cancel any existing trial for this tier
      await pool.query(
        "UPDATE subscriptions SET status = 'expired' WHERE family_unit_id = $1 AND tier = $2 AND status = 'trial'",
        [familyUnitId, tier]
      );

      const sub = await pool.query(
        `INSERT INTO subscriptions
         (family_unit_id, tenant_id, tier, status, monthly_price_cents, current_period_start, current_period_end)
         VALUES ($1, $2, $3, 'active', $4, NOW(), NOW() + INTERVAL '30 days')
         ON CONFLICT (family_unit_id, tier) DO UPDATE SET
           status = 'active', current_period_start = NOW(), current_period_end = NOW() + INTERVAL '30 days',
           cancelled_at = NULL, cancel_reason = NULL
         RETURNING id`,
        [familyUnitId, tenantId, tier, TIER_CONFIG[tier].monthly_cents]
      );

      await pool.query('UPDATE family_units SET premium_tier = $1 WHERE family_unit_id = $2', [tier, familyUnitId]);
      await logEvent(sub.rows[0].id, familyUnitId, 'subscribed', null, tier, { mode: 'pilot' });

      return { subscriptionId: sub.rows[0].id, mode: 'pilot', tier };
    }

    // Real Stripe integration
    let customerId;
    const existingSub = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE family_unit_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1',
      [familyUnitId]
    );

    if (existingSub.rows.length > 0) {
      customerId = existingSub.rows[0].stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        metadata: { family_unit_id: familyUnitId }
      });
      customerId = customer.id;
    }

    // Attach payment method
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
    }

    // Create Stripe subscription
    const stripeSub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: TIER_CONFIG[tier].price_id }],
      metadata: { family_unit_id: familyUnitId, tier }
    });

    // Cancel any existing trial
    await pool.query(
      "UPDATE subscriptions SET status = 'expired' WHERE family_unit_id = $1 AND tier = $2 AND status = 'trial'",
      [familyUnitId, tier]
    );

    const sub = await pool.query(
      `INSERT INTO subscriptions
       (family_unit_id, tenant_id, tier, status, stripe_customer_id, stripe_subscription_id,
        stripe_price_id, monthly_price_cents, current_period_start, current_period_end)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7,
        to_timestamp($8), to_timestamp($9))
       ON CONFLICT (family_unit_id, tier) DO UPDATE SET
         status = 'active', stripe_customer_id = $4, stripe_subscription_id = $5,
         stripe_price_id = $6, current_period_start = to_timestamp($8),
         current_period_end = to_timestamp($9), cancelled_at = NULL
       RETURNING id`,
      [familyUnitId, tenantId, tier, customerId, stripeSub.id,
       TIER_CONFIG[tier].price_id, TIER_CONFIG[tier].monthly_cents,
       stripeSub.current_period_start, stripeSub.current_period_end]
    );

    await pool.query('UPDATE family_units SET premium_tier = $1 WHERE family_unit_id = $2', [tier, familyUnitId]);
    await logEvent(sub.rows[0].id, familyUnitId, 'subscribed', null, tier);

    return { subscriptionId: sub.rows[0].id, stripeSubscriptionId: stripeSub.id, tier };
  } catch (err) {
    console.error('[Subscription] createSubscription failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to create subscription' };
  }
}

// ── UPGRADE SUBSCRIPTION ────────────────────────────────────

async function upgradeSubscription(familyUnitId, newTier, tenantId) {
  try {
    const current = await pool.query(
      'SELECT premium_tier FROM family_units WHERE family_unit_id = $1',
      [familyUnitId]
    );
    const currentTier = current.rows[0]?.premium_tier || 'base';

    const { validateUpgrade } = require('../middleware/premiumGate');
    const validation = validateUpgrade(currentTier, newTier);
    if (!validation.valid) return { error: true, message: validation.message };

    // Create the new tier subscription
    const result = await createSubscription(familyUnitId, newTier, null, tenantId);
    if (result.error) return result;

    await logEvent(result.subscriptionId, familyUnitId, 'upgraded', currentTier, newTier);

    return { previousTier: currentTier, newTier, subscriptionId: result.subscriptionId };
  } catch (err) {
    console.error('[Subscription] upgradeSubscription failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to upgrade' };
  }
}

// ── DOWNGRADE SUBSCRIPTION ──────────────────────────────────
// Data preservation: ALL data preserved read-only. No data hostage. Ever.

async function downgradeSubscription(familyUnitId, newTier, reason) {
  try {
    const current = await pool.query(
      'SELECT premium_tier FROM family_units WHERE family_unit_id = $1',
      [familyUnitId]
    );
    const currentTier = current.rows[0]?.premium_tier || 'base';

    if (newTier === currentTier) return { error: true, message: 'Already at this tier' };

    // Cancel higher tier subscriptions
    await pool.query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $1, downgraded_from = $2 WHERE family_unit_id = $3 AND tier = $2 AND status IN ('active', 'trial')",
      [reason || 'downgrade', currentTier, familyUnitId]
    );

    // Cancel Stripe subscription if exists
    const stripe = getStripe();
    if (stripe) {
      const stripeSub = await pool.query(
        "SELECT stripe_subscription_id FROM subscriptions WHERE family_unit_id = $1 AND tier = $2 AND stripe_subscription_id IS NOT NULL",
        [familyUnitId, currentTier]
      );
      if (stripeSub.rows[0]?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(stripeSub.rows[0].stripe_subscription_id);
        } catch (e) { console.error('[Subscription] Stripe cancel failed:', e.message); }
      }
    }

    // Pause curriculum (resumes on re-subscribe)
    await pool.query(
      "UPDATE family_curricula SET status = 'paused' WHERE family_unit_id = $1 AND status = 'active'",
      [familyUnitId]
    );

    // Update family tier
    await pool.query('UPDATE family_units SET premium_tier = $1 WHERE family_unit_id = $2', [newTier, familyUnitId]);

    await logEvent(null, familyUnitId, 'downgraded', currentTier, newTier, { reason });

    console.log(`[BILLING] Downgrade: family ${familyUnitId} ${currentTier} → ${newTier}. All data preserved read-only.`);

    return {
      previousTier: currentTier,
      newTier,
      dataPreserved: true,
      message: 'Your data is preserved. You can access your history anytime.'
    };
  } catch (err) {
    console.error('[Subscription] downgradeSubscription failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to downgrade' };
  }
}

// ── CANCEL SUBSCRIPTION ─────────────────────────────────────

async function cancelSubscription(familyUnitId, reason) {
  try {
    // Cancel at end of billing period, not immediate
    const sub = await pool.query(
      "SELECT id, stripe_subscription_id, tier, current_period_end FROM subscriptions WHERE family_unit_id = $1 AND status IN ('active', 'trial') ORDER BY created_at DESC LIMIT 1",
      [familyUnitId]
    );
    if (sub.rows.length === 0) return { error: true, message: 'No active subscription' };

    const s = sub.rows[0];
    const stripe = getStripe();

    if (stripe && s.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(s.stripe_subscription_id, {
          cancel_at_period_end: true
        });
      } catch (e) { console.error('[Subscription] Stripe cancel-at-end failed:', e.message); }
    }

    await pool.query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $1 WHERE id = $2",
      [reason || 'user_cancelled', s.id]
    );

    // In pilot mode or if no period end, downgrade immediately
    if (!stripe || !s.current_period_end) {
      await pool.query("UPDATE family_units SET premium_tier = 'base' WHERE family_unit_id = $1", [familyUnitId]);
      await pool.query(
        "UPDATE family_curricula SET status = 'paused' WHERE family_unit_id = $1 AND status = 'active'",
        [familyUnitId]
      );
    }

    await logEvent(s.id, familyUnitId, 'cancelled', s.tier, 'base', { reason });

    console.log(`[BILLING] Cancelled: family ${familyUnitId}, tier ${s.tier}`);

    return {
      cancelled: true,
      effectiveDate: s.current_period_end || new Date(),
      dataPreserved: true
    };
  } catch (err) {
    console.error('[Subscription] cancelSubscription failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to cancel' };
  }
}

// ── REACTIVATE ──────────────────────────────────────────────

async function reactivateSubscription(familyUnitId, tenantId) {
  try {
    const sub = await pool.query(
      "SELECT id, tier, stripe_subscription_id FROM subscriptions WHERE family_unit_id = $1 AND status = 'cancelled' ORDER BY cancelled_at DESC LIMIT 1",
      [familyUnitId]
    );
    if (sub.rows.length === 0) return { error: true, message: 'No cancelled subscription to reactivate' };

    const s = sub.rows[0];
    const stripe = getStripe();

    if (stripe && s.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(s.stripe_subscription_id, {
          cancel_at_period_end: false
        });
      } catch (e) {
        // If Stripe sub is fully cancelled, create new one
        return createSubscription(familyUnitId, s.tier, null, tenantId);
      }
    }

    await pool.query(
      "UPDATE subscriptions SET status = 'active', cancelled_at = NULL, cancel_reason = NULL WHERE id = $1",
      [s.id]
    );

    await pool.query('UPDATE family_units SET premium_tier = $1 WHERE family_unit_id = $2', [s.tier, familyUnitId]);

    // Resume paused curriculum
    await pool.query(
      "UPDATE family_curricula SET status = 'active' WHERE family_unit_id = $1 AND status = 'paused'",
      [familyUnitId]
    );

    await logEvent(s.id, familyUnitId, 'reactivated', 'base', s.tier);

    return { reactivated: true, tier: s.tier };
  } catch (err) {
    console.error('[Subscription] reactivateSubscription failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to reactivate' };
  }
}

// ── GET CURRENT SUBSCRIPTION ────────────────────────────────

async function getCurrentSubscription(familyUnitId) {
  try {
    const sub = await pool.query(
      `SELECT s.*, f.premium_tier as current_tier
       FROM subscriptions s
       JOIN family_units f ON s.family_unit_id = f.family_unit_id
       WHERE s.family_unit_id = $1 AND s.status IN ('active', 'trial', 'past_due')
       ORDER BY s.created_at DESC LIMIT 1`,
      [familyUnitId]
    );

    if (sub.rows.length === 0) {
      return { tier: 'base', status: 'none', subscription: null };
    }

    const s = sub.rows[0];
    let trialDaysRemaining = null;
    if (s.is_trial && s.trial_end_date) {
      trialDaysRemaining = Math.max(0, Math.ceil((new Date(s.trial_end_date) - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    return {
      tier: s.tier,
      status: s.status,
      isTrial: s.is_trial,
      trialDaysRemaining,
      trialEndsAt: s.trial_end_date,
      currentPeriodEnd: s.current_period_end,
      monthlyCents: s.monthly_price_cents,
      subscription: s
    };
  } catch (err) {
    Sentry.captureException(err);
    return { tier: 'base', status: 'error' };
  }
}

// ── PROCESS EXPIRED TRIALS ──────────────────────────────────

async function processExpiredTrials() {
  let processed = 0;
  try {
    const expired = await pool.query(
      "SELECT id, family_unit_id, tier FROM subscriptions WHERE is_trial = true AND status = 'trial' AND trial_end_date < NOW()"
    );

    for (const sub of expired.rows) {
      try {
        await pool.query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [sub.id]);
        await pool.query("UPDATE family_units SET premium_tier = 'base' WHERE family_unit_id = $1", [sub.family_unit_id]);
        await pool.query(
          "UPDATE family_curricula SET status = 'paused' WHERE family_unit_id = $1 AND status = 'active'",
          [sub.family_unit_id]
        );
        await logEvent(sub.id, sub.family_unit_id, 'trial_ended', sub.tier, 'base');
        processed++;
        console.log(`[BILLING] Trial expired: family ${sub.family_unit_id}`);
      } catch (e) {
        console.error(`[BILLING] Trial expiry failed for ${sub.family_unit_id}:`, e.message);
      }
    }
  } catch (err) {
    console.error('[Subscription] processExpiredTrials failed:', err.message);
  }
  return { processed };
}

// ── PROCESS PAST DUE (grace period enforcement) ─────────────

async function processPastDue() {
  let processed = 0;
  try {
    const graceCutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const pastDue = await pool.query(
      "SELECT id, family_unit_id, tier FROM subscriptions WHERE status = 'past_due' AND current_period_end < $1",
      [graceCutoff]
    );

    for (const sub of pastDue.rows) {
      try {
        await pool.query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [sub.id]);
        await pool.query("UPDATE family_units SET premium_tier = 'base' WHERE family_unit_id = $1", [sub.family_unit_id]);
        await logEvent(sub.id, sub.family_unit_id, 'expired', sub.tier, 'base', { reason: 'past_due_grace_period_exceeded' });
        processed++;
      } catch (e) { /* non-blocking */ }
    }
  } catch (err) {
    console.error('[Subscription] processPastDue failed:', err.message);
  }
  return { processed };
}

// ── WEBHOOK HANDLERS ────────────────────────────────────────

async function handlePaymentSucceeded(invoice) {
  try {
    const stripeSubId = invoice.subscription;
    const sub = await pool.query(
      'SELECT id, family_unit_id, tier FROM subscriptions WHERE stripe_subscription_id = $1',
      [stripeSubId]
    );
    if (sub.rows.length === 0) return;

    const s = sub.rows[0];

    await pool.query(
      `INSERT INTO payment_history (subscription_id, family_unit_id, stripe_invoice_id, stripe_payment_intent_id, amount_cents, status)
       VALUES ($1, $2, $3, $4, $5, 'succeeded')`,
      [s.id, s.family_unit_id, invoice.id, invoice.payment_intent, invoice.amount_paid]
    );

    // Restore from past_due if applicable
    await pool.query(
      "UPDATE subscriptions SET status = 'active', current_period_start = to_timestamp($1), current_period_end = to_timestamp($2) WHERE id = $3",
      [invoice.period_start, invoice.period_end, s.id]
    );

    await logEvent(s.id, s.family_unit_id, 'payment_succeeded', null, null, { amount: invoice.amount_paid });
  } catch (err) {
    console.error('[Webhook] handlePaymentSucceeded failed:', err.message);
    Sentry.captureException(err);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    const stripeSubId = invoice.subscription;
    const sub = await pool.query(
      'SELECT id, family_unit_id, tier FROM subscriptions WHERE stripe_subscription_id = $1',
      [stripeSubId]
    );
    if (sub.rows.length === 0) return;

    const s = sub.rows[0];

    await pool.query(
      `INSERT INTO payment_history (subscription_id, family_unit_id, stripe_invoice_id, amount_cents, status, failure_reason)
       VALUES ($1, $2, $3, $4, 'failed', $5)`,
      [s.id, s.family_unit_id, invoice.id, invoice.amount_due,
       invoice.last_finalization_error?.message || 'Payment failed']
    );

    await pool.query("UPDATE subscriptions SET status = 'past_due' WHERE id = $1", [s.id]);
    await logEvent(s.id, s.family_unit_id, 'payment_failed', null, null, { amount: invoice.amount_due });
    await logEvent(s.id, s.family_unit_id, 'past_due', null, null);

    console.log(`[BILLING] Payment failed: family ${s.family_unit_id}, ${GRACE_PERIOD_DAYS}-day grace period active`);
  } catch (err) {
    console.error('[Webhook] handlePaymentFailed failed:', err.message);
    Sentry.captureException(err);
  }
}

async function handleSubscriptionDeleted(stripeSub) {
  try {
    const sub = await pool.query(
      'SELECT id, family_unit_id, tier FROM subscriptions WHERE stripe_subscription_id = $1',
      [stripeSub.id]
    );
    if (sub.rows.length === 0) return;

    const s = sub.rows[0];
    await pool.query("UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1", [s.id]);
    await pool.query("UPDATE family_units SET premium_tier = 'base' WHERE family_unit_id = $1", [s.family_unit_id]);
    await logEvent(s.id, s.family_unit_id, 'cancelled', s.tier, 'base', { source: 'stripe_webhook' });
  } catch (err) {
    console.error('[Webhook] handleSubscriptionDeleted failed:', err.message);
    Sentry.captureException(err);
  }
}

// ── GET HISTORY ─────────────────────────────────────────────

async function getHistory(familyUnitId, limit = 50) {
  try {
    const payments = await pool.query(
      'SELECT * FROM payment_history WHERE family_unit_id = $1 ORDER BY created_at DESC LIMIT $2',
      [familyUnitId, limit]
    );
    const events = await pool.query(
      'SELECT * FROM subscription_events WHERE family_unit_id = $1 ORDER BY created_at DESC LIMIT $2',
      [familyUnitId, limit]
    );
    return { payments: payments.rows, events: events.rows };
  } catch (err) {
    return { payments: [], events: [] };
  }
}

// ── HELPERS ─────────────────────────────────────────────────

async function logEvent(subscriptionId, familyUnitId, eventType, previousTier, newTier, metadata) {
  try {
    await pool.query(
      `INSERT INTO subscription_events (subscription_id, family_unit_id, event_type, previous_tier, new_tier, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [subscriptionId, familyUnitId, eventType, previousTier || null, newTier || null,
       metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    // Non-blocking
  }
}

module.exports = {
  TIER_CONFIG,
  startTrial,
  createSubscription,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  getCurrentSubscription,
  processExpiredTrials,
  processPastDue,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleSubscriptionDeleted,
  getHistory
};
