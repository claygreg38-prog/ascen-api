-- Migration 089 — Phase E (Echo): reaper parity for echo_sessions
-- Mirrors partnership_sessions.abandoned_at (088) so the L4 idempotent-finalize +
-- stale-session reaper work identically for async Echo sessions. Additive +
-- idempotent. Raw SQL; no ORM.
ALTER TABLE echo_sessions ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;
