-- Migration 064: Forced password change gate
-- New accounts seeded by facilitators and seed scripts default to password_changed = false.
-- Existing accounts default to true (no disruption).

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed BOOLEAN NOT NULL DEFAULT true;
