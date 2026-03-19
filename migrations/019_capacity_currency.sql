-- Migration 019: Capacity Currency System
-- Session 14: Ledger, snapshots, investments, sleep entries

-- Capacity ledger (financial metaphor for emotional bandwidth)
CREATE TABLE IF NOT EXISTS capacity_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'deposit', 'withdrawal', 'investment', 'dividend', 'overdraft_protection'
  )),
  amount DECIMAL(8,2) NOT NULL,
  source VARCHAR(100) NOT NULL,
  balance_after DECIMAL(8,2) NOT NULL,
  savings_after DECIMAL(8,2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capacity snapshots (daily rollup for trend analysis)
CREATE TABLE IF NOT EXISTS capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  snapshot_date DATE NOT NULL,
  capacity_score DECIMAL(5,2) NOT NULL,
  capacity_state VARCHAR(20) NOT NULL CHECK (capacity_state IN (
    'full', 'steady', 'drawing_down', 'low', 'depleted'
  )),
  active_balance DECIMAL(8,2) NOT NULL,
  savings_balance DECIMAL(8,2) NOT NULL,
  component_scores JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

-- Investment tracking (co-breath investments and dividend returns)
CREATE TABLE IF NOT EXISTS capacity_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_user_id INTEGER REFERENCES users(id) NOT NULL,
  recipient_user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  investment_type VARCHAR(30) DEFAULT 'co_breath',
  amount_invested DECIMAL(8,2) NOT NULL,
  recipient_capacity_before DECIMAL(8,2),
  recipient_capacity_after DECIMAL(8,2),
  dividend_earned DECIMAL(8,2) DEFAULT 0,
  dividend_eligible BOOLEAN DEFAULT false,
  dividend_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sleep entries (pilot placeholder for Terra API)
CREATE TABLE IF NOT EXISTS sleep_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  entry_date DATE NOT NULL,
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'terra', 'apple_health')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_capacity_ledger_user ON capacity_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capacity_ledger_family ON capacity_ledger(family_unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_user ON capacity_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_capacity_investments_investor ON capacity_investments(investor_user_id);
CREATE INDEX IF NOT EXISTS idx_capacity_investments_recipient ON capacity_investments(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_capacity_investments_pending ON capacity_investments(dividend_eligible) WHERE dividend_eligible = false;
