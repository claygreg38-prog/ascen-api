-- Migration 038: Prevention Impact Score
-- Base rates from published recidivism data (loaded from DB, not constants)
-- PIS history for auditability

-- Base recidivism rates
CREATE TABLE IF NOT EXISTS base_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code VARCHAR(20) NOT NULL,
  rate_type VARCHAR(30) NOT NULL,
  rate DECIMAL(4,3) NOT NULL,
  source_url TEXT,
  source_name TEXT,
  effective_date DATE NOT NULL,
  expires_at DATE,
  updated_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jurisdiction_code, rate_type, effective_date)
);

-- Seed with current Maryland DOC published data
INSERT INTO base_rates (jurisdiction_code, rate_type, rate, source_name, effective_date) VALUES
('MD', 'sud_3year', 0.400, 'Maryland DOC Annual Report', '2024-01-01'),
('MD', 'sud_1year', 0.220, 'Maryland DOC Annual Report', '2024-01-01'),
('MD-PG', 'sud_3year', 0.380, 'PG County Reentry Data', '2024-01-01'),
('MD-BALT', 'sud_3year', 0.450, 'Baltimore City DOC Data', '2024-01-01')
ON CONFLICT DO NOTHING;

-- Prevention Impact Score history
CREATE TABLE IF NOT EXISTS prevention_impact_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  tenant_id UUID,
  score DECIMAL(4,3) NOT NULL,
  confidence VARCHAR(20) NOT NULL CHECK (confidence IN ('preliminary', 'standard', 'high')),
  computation_data JSONB NOT NULL,
  base_rate_used DECIMAL(4,3),
  base_rate_source TEXT,
  improvement_score DECIMAL(4,2),
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Latest PIS on users table for fast lookup
ALTER TABLE users ADD COLUMN IF NOT EXISTS prevention_impact_score DECIMAL(4,3);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pis_confidence VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pis_computed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jurisdiction_code VARCHAR(20) DEFAULT 'MD-PG';

CREATE INDEX IF NOT EXISTS idx_pis_user ON prevention_impact_scores(user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pis_score ON prevention_impact_scores(score);
CREATE INDEX IF NOT EXISTS idx_base_rates_jurisdiction ON base_rates(jurisdiction_code, rate_type);
