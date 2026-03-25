-- Migration 039: Artifact Valuation Engine
-- Defensible dollar values per credential, census disadvantage data

CREATE TABLE IF NOT EXISTS artifact_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_completion_id UUID,
  user_id INTEGER NOT NULL,
  tenant_id UUID,
  value_usd DECIMAL(10,2) NOT NULL,
  previous_value_usd DECIMAL(10,2),
  revaluation_delta DECIMAL(10,2),
  ceiling_applied BOOLEAN DEFAULT false,
  computation_data JSONB NOT NULL,
  is_latest BOOLEAN DEFAULT true,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Census data (interim: county proxies; Phase 2: zip-code level via Census ACS API)
CREATE TABLE IF NOT EXISTS census_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geographic_level VARCHAR(10) NOT NULL CHECK (geographic_level IN ('county', 'zip_code')),
  geographic_code VARCHAR(20) NOT NULL,
  geographic_name VARCHAR(100),
  incarceration_rate_per_100k DECIMAL(8,2),
  poverty_rate DECIMAL(4,3),
  provider_shortage_ratio DECIMAL(4,3),
  disadvantage_index DECIMAL(4,3),
  data_source TEXT,
  retrieved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(geographic_level, geographic_code)
);

-- Seed county-level data (all Maryland counties with published data)
INSERT INTO census_data (geographic_level, geographic_code, geographic_name, incarceration_rate_per_100k, poverty_rate, provider_shortage_ratio, disadvantage_index, data_source) VALUES
('county', 'PG', 'Prince George''s County', 450, 0.090, 0.70, 0.65, 'MD DOC + Census ACS 2023'),
('county', 'BALT_CITY', 'Baltimore City', 850, 0.210, 0.85, 0.90, 'MD DOC + Census ACS 2023'),
('county', 'MONTGOMERY', 'Montgomery County', 200, 0.070, 0.30, 0.30, 'MD DOC + Census ACS 2023'),
('county', 'ANNE_ARUNDEL', 'Anne Arundel County', 320, 0.080, 0.45, 0.45, 'MD DOC + Census ACS 2023'),
('county', 'BALTIMORE_CO', 'Baltimore County', 380, 0.100, 0.55, 0.55, 'MD DOC + Census ACS 2023'),
('county', 'HOWARD', 'Howard County', 150, 0.055, 0.25, 0.22, 'MD DOC + Census ACS 2023'),
('county', 'CHARLES', 'Charles County', 400, 0.085, 0.65, 0.60, 'MD DOC + Census ACS 2023'),
('county', 'HARFORD', 'Harford County', 340, 0.080, 0.50, 0.48, 'MD DOC + Census ACS 2023'),
('county', 'DEFAULT', 'Maryland Statewide Average', 350, 0.100, 0.50, 0.50, 'MD DOC Statewide Average')
ON CONFLICT (geographic_level, geographic_code) DO NOTHING;

-- User columns for valuation
ALTER TABLE users ADD COLUMN IF NOT EXISTS disadvantage_index_at_enrollment DECIMAL(4,3);
ALTER TABLE users ADD COLUMN IF NOT EXISTS disadvantage_index_multiplier DECIMAL(4,2) DEFAULT 1.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS county_code VARCHAR(20);

-- Session completion artifact value
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS artifact_value_usd DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_valuations_session ON artifact_valuations(session_completion_id);
CREATE INDEX IF NOT EXISTS idx_valuations_user ON artifact_valuations(user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_valuations_latest ON artifact_valuations(is_latest) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS idx_census_data ON census_data(geographic_level, geographic_code);
