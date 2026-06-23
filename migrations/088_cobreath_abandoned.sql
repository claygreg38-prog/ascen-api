-- Migration 088 — Coupling L4: stale-session reaper marker
-- A session abandoned (crashed / redeployed / inactivity-expired mid-session) is
-- marked abandoned_at — NOT completed_at. This keeps it out of the 48h-gap gate
-- (which keys off completed_at) so an abandoned room can't soft-lock the couple,
-- and out of room admission (an abandoned session is no longer joinable), and it
-- deposits nothing to the relationship account. Distinct from a real completion.
-- (NB: this is the abandoned marker, NOT the L3 per-tick snapshot table, which was
-- intentionally not built.)
-- Additive + idempotent. Raw SQL; no ORM.
ALTER TABLE partnership_sessions ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;
