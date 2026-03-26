-- ============================================================
-- Migration 049: Quilting Intelligence (System Weave)
--
-- Gate readiness tracking, quilting sessions, generational
-- activities, post-session check-ins, and isolation prevention.
-- ============================================================

-- Gate readiness tracking
CREATE TABLE IF NOT EXISTS gate_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  gate_number INTEGER NOT NULL CHECK (gate_number IN (0, 1, 2, 3)),
  status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked', 'evaluating', 'open', 'suspended')),

  criteria_results JSONB DEFAULT '{}',
  -- Per-criterion: { criterion_name: { met: boolean, value, threshold, evaluated_at } }

  -- Asymmetric readiness (Gate 2+)
  per_member_readiness JSONB DEFAULT '{}',
  -- { user_id: { ready: boolean, blocking_criteria: [...] } }

  -- Asymmetric vulnerability check (Gate 3)
  vulnerability_check JSONB,
  -- { parent_id, child_id, checks: [...], passed: boolean, evaluated_at }

  opened_at TIMESTAMPTZ,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- FIX #1: UNIQUE CONSTRAINT required for ON CONFLICT upsert in evaluateGate()
  CONSTRAINT unique_gate_family UNIQUE (family_unit_id, gate_number)
);

-- Quilting sessions
CREATE TABLE IF NOT EXISTS quilting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  session_number INTEGER NOT NULL CHECK (session_number IN (1, 2, 3, 4)),

  -- Participants
  participants JSONB NOT NULL,
  -- [{ user_id, role: 'elder'|'parent'|'child', generation: -2|-1|0 }]

  -- Session content
  thread_content JSONB DEFAULT '{}',
  -- Session 1: { elder_testimony, parent_receipt }
  -- Session 2: { parent_bridge, elder_acknowledgment }
  -- Session 3: { child_mirror, parent_receipt, elder_honoring, mirror_format }
  -- Session 4: { weave_discussion, quilted_pattern, keep_modify_deprecate }

  -- Biometric monitoring
  per_member_biometrics JSONB DEFAULT '{}',
  -- { user_id: { baseline, during_sharing, during_listening, post_cobreathe } }

  -- Luno interventions that fired
  interventions JSONB DEFAULT '[]',
  -- [{ timestamp, signal, action, member_affected }]

  -- Session 3: Sonnet monitoring log
  sonnet_monitoring_log JSONB,

  -- AXIS evaluation after session
  axis_post_evaluation JSONB,
  -- { proceed: boolean, reason, next_session_ready: boolean, deferred_action }

  -- Status
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'in_progress', 'completed', 'converted', 'deferred'
  )),
  -- 'converted' = session converted to co-breath due to dysregulation
  -- 'deferred' = AXIS determined not ready, rescheduled

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generational activities log (Gate 2 prerequisites)
CREATE TABLE IF NOT EXISTS generational_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN (
    'elder_testimony', 'parent_bridge', 'child_mirror', 'legacy_thread'
  )),
  content JSONB DEFAULT '{}',
  biometric_summary JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post-session check-ins (isolation prevention)
CREATE TABLE IF NOT EXISTS quilting_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quilting_session_id UUID REFERENCES quilting_sessions(id) NOT NULL,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  message_sent TEXT,
  response TEXT,
  distress_detected BOOLEAN DEFAULT false,
  facilitator_notified BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- FIX #7: Add missing columns to family_units for isolation prevention
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS co_breath_priority BOOLEAN DEFAULT false;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS co_breath_priority_until TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gate_family ON gate_evaluations(family_unit_id, gate_number);
CREATE INDEX IF NOT EXISTS idx_quilting_family ON quilting_sessions(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_gen_activities ON generational_activities(user_id, family_unit_id);
CREATE INDEX IF NOT EXISTS idx_quilting_checkins ON quilting_checkins(quilting_session_id);
CREATE INDEX IF NOT EXISTS idx_quilting_status ON quilting_sessions(family_unit_id, status);

-- Extend lineage_entries CHECK constraint for quilting entry types
-- quilting_completed already in the CHECK from session 25, verify it exists
-- If not, this is a no-op since we use IF NOT EXISTS pattern
