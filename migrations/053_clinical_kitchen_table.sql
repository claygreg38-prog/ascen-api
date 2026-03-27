-- ============================================================
-- Migration 053: Clinical Kitchen Table Layer
-- Clinician-facing data capture on top of Session 17's kitchen table.
-- Family NEVER sees any of this data.
--
-- Correction #1: user_id/member_id are INTEGER (Migration 030 converted users.id to INTEGER)
-- Correction #2: session_id is UUID REFERENCES kitchen_table_sessions(id)
-- ============================================================

-- Prompt/topic impact scoring per member
CREATE TABLE IF NOT EXISTS kitchen_table_prompt_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES kitchen_table_sessions(id),
  topic_id UUID,
  user_id INTEGER NOT NULL REFERENCES users(id),
  pre_topic_ns3 INTEGER,
  post_topic_ns3 INTEGER,
  response_type VARCHAR(20) CHECK (response_type IN ('activated', 'settled', 'withdrew', 'no_change')),
  recovery_seconds INTEGER,
  biometric_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-session communication pattern metrics
CREATE TABLE IF NOT EXISTS kitchen_table_communication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES kitchen_table_sessions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  speaking_pct DECIMAL(5,2),
  listening_quality_avg DECIMAL(5,2),
  engagement_duration_sec INTEGER,
  interruption_count INTEGER DEFAULT 0,
  co_regulation_events INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sonnet coaching card delivery log
CREATE TABLE IF NOT EXISTS kitchen_table_coaching_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES kitchen_table_sessions(id),
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN (
    'dysregulation', 'cascade', 'breakthrough', 'withdrawal', 'co_regulation', 'coach_me'
  )),
  member_id INTEGER REFERENCES users(id),
  coaching_card JSONB NOT NULL,
  was_seen BOOLEAN DEFAULT false,
  was_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add impact_monitoring JSONB to kitchen_table_sessions for tick-based monitoring state
-- (Correction #3: replaces setTimeout with DB-persisted state evaluated on each tick)
ALTER TABLE kitchen_table_sessions ADD COLUMN IF NOT EXISTS impact_monitoring JSONB;

CREATE INDEX IF NOT EXISTS idx_prompt_impact_session ON kitchen_table_prompt_impacts(session_id);
CREATE INDEX IF NOT EXISTS idx_communication_session ON kitchen_table_communication(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_session ON kitchen_table_coaching_logs(session_id);
