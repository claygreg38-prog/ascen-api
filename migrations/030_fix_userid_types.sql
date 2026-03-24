-- ============================================================
-- Migration 030: Fix user_id column types
--
-- Tables created in migration 009 used UUID for user_id, but
-- users.id is INTEGER (SERIAL). Later migrations (021+) correctly
-- used INTEGER. This migration aligns the early tables.
--
-- Affected tables (UUID → INTEGER):
--   session_completions, axis_sessions, immune_flags,
--   attestation_queue, modality_completion_profiles,
--   family_units.created_by
--
-- Legacy tables (VARCHAR → INTEGER):
--   session_progress, vault_entries
--
-- Run: psql $DATABASE_URL -f migrations/030_fix_userid_types.sql
-- ============================================================

BEGIN;

-- ── 1. session_completions ──────────────────────────────────
-- Drop orphaned seed data (UUID values can't map to integer user IDs)
DELETE FROM session_completions WHERE user_id IS NOT NULL;

-- Drop existing index, alter column, recreate index
DROP INDEX IF EXISTS idx_session_completions_user;
ALTER TABLE session_completions
  ALTER COLUMN user_id TYPE INTEGER USING NULL;
ALTER TABLE session_completions
  ADD CONSTRAINT session_completions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX idx_session_completions_user ON session_completions(user_id);

-- ── 2. axis_sessions ────────────────────────────────────────
DROP INDEX IF EXISTS idx_axis_sessions_user;
ALTER TABLE axis_sessions
  ALTER COLUMN user_id TYPE INTEGER USING NULL;
ALTER TABLE axis_sessions
  ADD CONSTRAINT axis_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX idx_axis_sessions_user ON axis_sessions(user_id);

-- ── 3. immune_flags ─────────────────────────────────────────
DROP INDEX IF EXISTS idx_immune_flags_user;
ALTER TABLE immune_flags
  ALTER COLUMN user_id TYPE INTEGER USING NULL;
ALTER TABLE immune_flags
  ADD CONSTRAINT immune_flags_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX idx_immune_flags_user ON immune_flags(user_id);

-- reviewed_by is also UUID but references a user — fix it too
ALTER TABLE immune_flags
  ALTER COLUMN reviewed_by TYPE INTEGER USING NULL;

-- ── 4. attestation_queue ────────────────────────────────────
DROP INDEX IF EXISTS idx_attestation_queue_user;
ALTER TABLE attestation_queue
  ALTER COLUMN user_id TYPE INTEGER USING NULL;
ALTER TABLE attestation_queue
  ADD CONSTRAINT attestation_queue_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX idx_attestation_queue_user ON attestation_queue(user_id);

-- ── 5. modality_completion_profiles ─────────────────────────
DROP INDEX IF EXISTS idx_modality_profiles_user;
ALTER TABLE modality_completion_profiles
  ALTER COLUMN user_id TYPE INTEGER USING NULL;
ALTER TABLE modality_completion_profiles
  ADD CONSTRAINT modality_completion_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX idx_modality_profiles_user ON modality_completion_profiles(user_id);

-- ── 6. family_units.created_by (UUID → INTEGER) ─────────────
-- Clear orphaned UUID seed data first
UPDATE family_units SET created_by = NULL WHERE created_by IS NOT NULL;
ALTER TABLE family_units
  ALTER COLUMN created_by TYPE INTEGER USING NULL;
ALTER TABLE family_units
  ADD CONSTRAINT family_units_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id);

-- ── 7. session_progress (legacy, VARCHAR → INTEGER) ─────────
ALTER TABLE session_progress
  ALTER COLUMN user_id TYPE INTEGER USING NULL;

-- ── 8. vault_entries (legacy, VARCHAR → INTEGER) ────────────
ALTER TABLE vault_entries
  ALTER COLUMN user_id TYPE INTEGER USING NULL;

COMMIT;
