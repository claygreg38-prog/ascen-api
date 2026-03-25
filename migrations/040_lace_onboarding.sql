-- Migration 040: LACE (Legacy ACE) Onboarding + Lineage Profile
-- HOS Family Layer N2: 15 domains (from legacy-ace-v2-dual-axis.yaml),
-- 6 clusters (from breath-first-onboarding-and-actions.yaml),
-- armor recognition, breath-first diagnostic

-- LACE assessments — breath-first, biometric-confirmed
CREATE TABLE IF NOT EXISTS lace_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'reviewed')),

  -- 15 domain responses (experience axis — LACE_001 through LACE_014 + LACE_OPP)
  domain_responses JSONB NOT NULL DEFAULT '{}',

  -- Armor recognition results (armor axis — biometric confirmation)
  confirmed_armors JSONB NOT NULL DEFAULT '[]',

  -- Biometric data during assessment
  biometric_snapshots JSONB DEFAULT '[]',

  -- Breath-first baseline (captured between 6 question clusters)
  breath_baselines JSONB DEFAULT '[]',

  -- Adaptive pacing
  pacing_track VARCHAR(20) DEFAULT 'standard' CHECK (pacing_track IN ('standard', 'extended', 'gentle')),

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lineage profile (Family Code naming)
CREATE TABLE IF NOT EXISTS lineage_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),

  -- Named carriers
  carriers JSONB NOT NULL DEFAULT '[]',
  -- Format: [{ name: "Grandpa Joe", role: "patriarch", armors: ["The Sentinel", "The Atlas"], generation: -2 }]

  -- Family code summary
  family_code_name VARCHAR(100),
  -- e.g., "The Gregory Code" — family's self-chosen name for their inherited patterns

  -- Dominant patterns
  dominant_armors JSONB DEFAULT '[]',
  -- Top armors confirmed across family members

  -- Heritage dimensions (from heritage-price mapping)
  -- 8 dimensions: physical, emotional, relational, financial, spiritual, vocational, educational, communal
  heritage_dimensions JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_lace_user ON lace_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_lace_family ON lace_assessments(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_lace_status ON lace_assessments(status);
CREATE INDEX IF NOT EXISTS idx_lineage_user ON lineage_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_lineage_family ON lineage_profiles(family_unit_id);
