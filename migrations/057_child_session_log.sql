-- Migration 057: Child Session Log (Breath Bridge Phase 1)

CREATE TABLE IF NOT EXISTS child_session_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id INTEGER NOT NULL REFERENCES users(id),
  family_id UUID,
  age_bracket VARCHAR(20) NOT NULL CHECK (age_bracket IN ('elementary', 'middle_school', 'high_school')),
  breaths_completed INTEGER NOT NULL CHECK (breaths_completed >= 0),
  breaths_available INTEGER NOT NULL CHECK (breaths_available > 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  early_quit BOOLEAN NOT NULL DEFAULT false,
  session_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_child_session_participant ON child_session_log(participant_id);
CREATE INDEX IF NOT EXISTS idx_child_session_family ON child_session_log(family_id);
CREATE INDEX IF NOT EXISTS idx_child_session_timestamp ON child_session_log(session_timestamp DESC);
