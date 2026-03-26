-- ============================================================
-- Migration 052: Anti-Redlining Architecture
--
-- 5 systemic mechanisms preventing extraction from
-- vulnerable communities. Community equity tracking,
-- extraction detection, and governance configuration.
-- ============================================================

-- Community equity tracking
CREATE TABLE IF NOT EXISTS community_equity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geographic_code VARCHAR(20) NOT NULL,
  geographic_level VARCHAR(10) DEFAULT 'county',

  avg_disadvantage_index DECIMAL(4,3),
  total_families INTEGER DEFAULT 0,
  total_lit_earned DECIMAL(12,2) DEFAULT 0,
  avg_lit_per_family DECIMAL(10,2) DEFAULT 0,

  -- Equity ratio: this community's avg LIT vs system-wide avg LIT
  -- < 1.0 = earns less than average (needs boost)
  -- > 1.0 = earns more than average
  -- Target: all communities between 0.85 and 1.15
  equity_ratio DECIMAL(4,3) DEFAULT 1.0,

  facc_allocation DECIMAL(10,2) DEFAULT 0,

  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extraction detection log
CREATE TABLE IF NOT EXISTS extraction_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN (
    'geographic_concentration', 'value_disparity', 'access_barrier',
    'recognition_gap', 'maturation_inequality', 'facc_imbalance'
  )),
  severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  details JSONB NOT NULL,

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'accepted')),
  resolved_by INTEGER REFERENCES users(id),
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anti-redlining configuration (database-driven, not hardcoded)
CREATE TABLE IF NOT EXISTS equity_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanism VARCHAR(50) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 5 equity mechanisms
INSERT INTO equity_config (mechanism, config) VALUES
('disadvantage_floor', '{"min_multiplier": 1.0, "max_multiplier": 1.5, "description": "Disadvantage index multiplier floor — no community receives less than base value"}'),
('geographic_redistribution', '{"equity_target_min": 0.85, "equity_target_max": 1.15, "rebalance_frequency": "monthly", "description": "FACC redistribution targets equity ratio between 0.85 and 1.15 across all communities"}'),
('barrier_recognition', '{"barriers": ["incarceration", "homelessness", "foster_system", "immigration", "disability"], "boost_per_barrier": 0.05, "max_boost": 0.15, "description": "Additional credential value boost for families facing active systemic barriers"}'),
('extraction_detection', '{"value_disparity_threshold": 2.0, "geographic_concentration_threshold": 0.6, "scan_frequency": "weekly", "description": "Automated detection of value flowing disproportionately to advantaged communities"}'),
('recognition_equity', '{"min_partners_per_jurisdiction": 2, "gap_alert_days": 90, "description": "Ensure recognition partners (LHX) are available in all jurisdictions, not just affluent ones"}')
ON CONFLICT (mechanism) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_equity_geographic ON community_equity_scores(geographic_code);
CREATE INDEX IF NOT EXISTS idx_extraction_status ON extraction_alerts(status, severity);
