-- Migration 066: Ensure users.user_id column exists
-- 100+ queries reference users.user_id (the UUID identifier matching session_completions.user_id).
-- The column may not exist on databases created without the original CREATE TABLE.
-- participant_id holds the same UUID value, so backfill from it.

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id VARCHAR(40);

UPDATE users SET user_id = participant_id WHERE user_id IS NULL AND participant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
