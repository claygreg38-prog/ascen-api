-- Migration 034: DB-backed session state for v8 immersive frontend
-- Survives Railway redeploys. Supports horizontal scaling.

ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS session_state JSONB DEFAULT '{}';
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS session_key VARCHAR(40) UNIQUE;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS session_active BOOLEAN DEFAULT false;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS arrival_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_session_key ON session_completions(session_key) WHERE session_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_active ON session_completions(session_active) WHERE session_active = true;

-- Vault responses encrypted at rest
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS vault_response_encrypted TEXT;
