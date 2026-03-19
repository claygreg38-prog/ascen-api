-- ============================================================
-- Migration 026: Subscription Management Tables
-- Session 21 — Stripe integration, trial system, payment history
-- ============================================================

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('guided_bridge', 'family_compass')),
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  stripe_price_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'cancelled', 'past_due', 'trial', 'expired'
  )),
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  is_trial BOOLEAN DEFAULT false,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  monthly_price_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  downgraded_from VARCHAR(20),
  UNIQUE(family_unit_id, tier)
);

-- Payment history
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),
  stripe_invoice_id VARCHAR(100),
  stripe_payment_intent_id VARCHAR(100),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(20) CHECK (status IN ('succeeded', 'failed', 'pending', 'refunded')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription events audit log
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
    'trial_started', 'trial_ended', 'subscribed', 'upgraded', 'downgraded',
    'cancelled', 'reactivated', 'payment_succeeded', 'payment_failed',
    'past_due', 'expired'
  )),
  previous_tier VARCHAR(20),
  new_tier VARCHAR(20),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_family ON subscriptions(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status) WHERE status IN ('active', 'trial');
CREATE INDEX IF NOT EXISTS idx_payment_history_sub ON payment_history(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_family ON subscription_events(family_unit_id, created_at DESC);
