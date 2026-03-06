-- ============================================================
-- Migration 009: AXIS tables + Audit + Immune flags
-- Run: psql $DATABASE_URL -f migrations/009_axis_audit.sql
-- ============================================================

-- AXIS session data (anonymized for population learning)
CREATE TABLE IF NOT EXISTS axis_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  session_id UUID,
  session_number INTEGER,
  track TEXT,
  arc TEXT,
  mode TEXT,
  coherence_peak NUMERIC,
  coherence_end NUMERIC,
  cycle_completion_rate NUMERIC,
  active_duration_seconds INTEGER,
  pause_count INTEGER DEFAULT 0,
  panic_event BOOLEAN DEFAULT false,
  exit_type TEXT DEFAULT 'normal',
  state_summary JSONB DEFAULT '{}',
  coaching_summary JSONB DEFAULT '{}',
  ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axis_sessions_user ON axis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_axis_sessions_arc_track ON axis_sessions(arc, track);
CREATE INDEX IF NOT EXISTS idx_axis_sessions_ingested ON axis_sessions(ingested_at);

-- AXIS refinement results
CREATE TABLE IF NOT EXISTS axis_refinements (
  id SERIAL PRIMARY KEY,
  results JSONB DEFAULT '{}',
  refined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log (42 CFR Part 2 compliance)
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  method TEXT,
  path TEXT,
  user_agent TEXT,
  ip TEXT,
  status_code INTEGER,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_logged ON audit_log(logged_at);

-- Immune system flags
CREATE TABLE IF NOT EXISTS immune_flags (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  session_id UUID,
  flags JSONB DEFAULT '[]',
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_immune_flags_user ON immune_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_immune_flags_created ON immune_flags(created_at);

-- Session completions (if not exists from earlier migrations)
CREATE TABLE IF NOT EXISTS session_completions (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  session_id UUID,
  session_number INTEGER,
  coherence_score NUMERIC,
  coherence_end NUMERIC,
  cycle_completion_rate NUMERIC,
  active_duration_seconds INTEGER,
  total_pauses INTEGER DEFAULT 0,
  exit_type TEXT DEFAULT 'normal',
  panic_event BOOLEAN DEFAULT false,
  track TEXT,
  arc TEXT,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_completions_user ON session_completions(user_id);
