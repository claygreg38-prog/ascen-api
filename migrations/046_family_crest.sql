-- Migration 046: Family Crest — Living System Document
-- The Crest exists from day one. It versions up based on behavioral evidence.

CREATE TABLE IF NOT EXISTS family_crests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL UNIQUE,
  tenant_id UUID REFERENCES tenants(id),

  current_version VARCHAR(10) DEFAULT '1.0',
  version_history JSONB DEFAULT '[]',
  -- Format: [{ version: "1.0", triggered_at, trigger_type, evidence }]

  -- Four quadrants
  inheritance JSONB DEFAULT '{}',
  -- LACE domains, confirmed armors, named carriers

  release JSONB DEFAULT '{}',
  -- Deprecated patterns with date and evidence

  keepers JSONB DEFAULT '{}',
  -- Armor strengths retained, cultural source code recovered

  promise JSONB DEFAULT '{}',
  -- Blueprint visions, family declaration, commitments

  -- Center
  family_name VARCHAR(100),
  family_code_name VARCHAR(100),
  first_session_date TIMESTAMPTZ,
  participating_members JSONB DEFAULT '[]',
  absent_members JSONB DEFAULT '[]',
  -- Absent: [{ name, relationship, note: "Honored in absence. Welcomed when ready." }]

  -- Ceremony tracking
  last_ceremony_at TIMESTAMPTZ,
  ceremony_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version trigger evidence
CREATE TABLE IF NOT EXISTS crest_version_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crest_id UUID REFERENCES family_crests(id) NOT NULL,
  version_target VARCHAR(10) NOT NULL,
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN (
    'lace_completed', 'first_deprecation', 'behavioral_change',
    'family_project', 'courage_demonstrated', 'member_joined',
    'biometric_improvement', 'heritage_costs_decreasing', 'quilting_completed'
  )),
  evidence_data JSONB NOT NULL,
  -- { description, reported_by, witnessed_by, armor_addressed, dimension, date }
  submitted_by INTEGER REFERENCES users(id),
  facilitator_confirmed BOOLEAN DEFAULT false,
  confirmed_by INTEGER REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crest_family ON family_crests(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_crest_evidence ON crest_version_evidence(crest_id, version_target);
