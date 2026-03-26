-- ============================================================
-- Migration 051: Healing Economy (LIT/LHX/FCR/FIS)
--
-- LIT ledger, recognition partners, family capital reserves,
-- family investment scores, bond maturation tracking.
-- ============================================================

-- LIT Ledger (credential value accounting)
CREATE TABLE IF NOT EXISTS lit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),

  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'credential_earned', 'revaluation_increase', 'revaluation_decrease',
    'family_contribution', 'recognition_event', 'bond_maturation_bonus'
  )),

  session_completion_id INTEGER,
  lit_amount DECIMAL(10,2) NOT NULL,
  running_balance DECIMAL(12,2) NOT NULL,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LHX Recognition Registry
CREATE TABLE IF NOT EXISTS lhx_recognition_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name VARCHAR(200) NOT NULL,
  partner_type VARCHAR(30) NOT NULL CHECK (partner_type IN (
    'employer', 'court', 'housing', 'education', 'healthcare', 'insurance', 'community'
  )),
  jurisdiction VARCHAR(20) DEFAULT 'MD-PG',

  recognition_criteria JSONB NOT NULL,
  recognition_benefits JSONB NOT NULL,

  contact_info JSONB,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FCR (Family Capital Reserve)
CREATE TABLE IF NOT EXISTS family_capital_reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL UNIQUE,
  tenant_id UUID REFERENCES tenants(id),

  total_lit DECIMAL(12,2) DEFAULT 0,
  total_credentials INTEGER DEFAULT 0,
  total_value_usd DECIMAL(12,2) DEFAULT 0,

  member_contributions JSONB DEFAULT '{}',

  bond_tier VARCHAR(20) DEFAULT 'seed' CHECK (bond_tier IN ('seed', 'growth', 'mature', 'legacy')),
  bond_tier_updated_at TIMESTAMPTZ,

  facc_contributed DECIMAL(10,2) DEFAULT 0,
  facc_rate DECIMAL(4,3) DEFAULT 0.05,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FIS (Family Investment Score)
CREATE TABLE IF NOT EXISTS family_investment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),

  score DECIMAL(5,2) NOT NULL,
  confidence_tier VARCHAR(10) DEFAULT 'low' CHECK (confidence_tier IN ('low', 'medium', 'high')),

  components JSONB NOT NULL,
  weights JSONB NOT NULL DEFAULT '{"pis_avg": 0.25, "engagement": 0.20, "co_regulation": 0.20, "field_tests": 0.15, "crest": 0.10, "real_world": 0.10}',

  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bond maturation tracking
CREATE TABLE IF NOT EXISTS bond_maturation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,

  from_tier VARCHAR(20) NOT NULL,
  to_tier VARCHAR(20) NOT NULL,

  criteria_met JSONB NOT NULL,

  matured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed recognition partners
INSERT INTO lhx_recognition_partners (partner_name, partner_type, jurisdiction, recognition_criteria, recognition_benefits)
VALUES
('PG County Circuit Court', 'court', 'MD-PG',
 '{"min_sessions": 30, "min_bond_tier": "growth", "credential_types": ["session_completion", "firmware_completion"]}',
 '{"description": "Verified participation in behavioral health programming", "value_type": "sentencing", "estimated_value_usd": null}'),

('PG County Department of Corrections', 'court', 'MD-PG',
 '{"min_sessions": 90, "min_bond_tier": "mature", "credential_types": ["session_completion", "quilting_completion"]}',
 '{"description": "Demonstrated sustained behavioral change with family engagement", "value_type": "early_release_consideration", "estimated_value_usd": null}'),

('MD Workforce Development', 'employer', 'MD',
 '{"min_sessions": 60, "min_fis": 40, "credential_types": ["firmware_completion", "field_test_passed"]}',
 '{"description": "Verified self-regulation capacity and interpersonal skill development", "value_type": "employment", "estimated_value_usd": null}')

ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lit_user ON lit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_lit_family ON lit_ledger(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_fcr_family ON family_capital_reserves(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_fis_family ON family_investment_scores(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_bond_family ON bond_maturation_events(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_lhx_type ON lhx_recognition_partners(partner_type, jurisdiction);
