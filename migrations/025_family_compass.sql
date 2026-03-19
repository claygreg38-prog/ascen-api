-- ============================================================
-- Migration 025: Family Compass Tables
-- Session 20 — Personalized curriculum, predictive relationship
-- intelligence, multi-generational healing map
-- ============================================================

-- Personalized family curricula (Sonnet-generated)
CREATE TABLE IF NOT EXISTS family_curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  generated_by VARCHAR(10) DEFAULT 'sonnet',
  curriculum_data JSONB NOT NULL,
  current_week INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'regenerated')),
  generation_context JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual assignments within curriculum
CREATE TABLE IF NOT EXISTS curriculum_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id UUID REFERENCES family_curricula(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  week_number INTEGER NOT NULL,
  participant_id INTEGER REFERENCES users(id),
  assignment_text TEXT NOT NULL,
  assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN (
    'communication', 'breathing', 'reflection', 'shared_activity', 'journaling', 'listening'
  )),
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  participant_feedback TEXT,
  sonnet_assessment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationship predictions (weekly Sonnet analysis)
CREATE TABLE IF NOT EXISTS relationship_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  prediction_date TIMESTAMPTZ DEFAULT NOW(),
  -- Family-visible output (BEHAVIORAL SIGNALS ONLY — Review Finding #2)
  risk_score FLOAT,
  risk_direction VARCHAR(15) CHECK (risk_direction IN ('improving', 'stable', 'declining')),
  early_warnings TEXT[],
  positive_signals TEXT[],
  recommendations TEXT[],
  fr_readiness_score FLOAT,
  fr_recommendation TEXT,
  -- Clinician-only output (NS3 + biometric — NEVER family-visible)
  sonnet_full_analysis JSONB,
  clinician_reviewed BOOLEAN DEFAULT false,
  clinician_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-generational healing map
CREATE TABLE IF NOT EXISTS family_healing_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  generations JSONB NOT NULL,
  pattern_threads JSONB,
  visualization_data JSONB,
  genealogy_data JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_curricula_unit ON family_curricula(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_family_curricula_status ON family_curricula(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_curriculum_assignments_curriculum ON curriculum_assignments(curriculum_id, week_number);
CREATE INDEX IF NOT EXISTS idx_curriculum_assignments_participant ON curriculum_assignments(participant_id, completed);
CREATE INDEX IF NOT EXISTS idx_relationship_predictions_unit ON relationship_predictions(family_unit_id, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_family_healing_maps_unit ON family_healing_maps(family_unit_id);
