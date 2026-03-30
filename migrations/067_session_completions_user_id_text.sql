-- Migration 067: Change session_completions.user_id from UUID to TEXT
-- The users table uses integer id and VARCHAR user_id/participant_id.
-- Neither is UUID, so session_completions.user_id must accept non-UUID values.
-- Also fix the ON CONFLICT constraint for session state upserts.

ALTER TABLE session_completions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE session_completions ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;

-- Add unique constraint for session state upsert (registerSession uses ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_completions_user_session
  ON session_completions (user_id, session_number);
