-- Migration 090 — Phase 2: one open co-breath session per partnership
-- Closes the concurrent double-mint race at the DB layer. Two partners tapping
-- "enter" simultaneously both pass getOpenSessionForPartnership's SELECT before
-- either INSERTs -> two open sessions for one partnership -> split rooms. This
-- partial unique index makes a second OPEN session structurally impossible; the
-- losing INSERT throws 23505, which startSession catches and resolves to the
-- winner's token (both converge on one room). "Open" = not completed AND not
-- abandoned, so completed/abandoned history is unconstrained (a partnership can
-- have many past sessions, but at most one in-flight). Additive + idempotent.
-- Raw SQL; no ORM. Deploy order: 086 -> 087 -> 088 -> 089 -> 090.
CREATE UNIQUE INDEX IF NOT EXISTS one_open_session_per_partnership
  ON partnership_sessions (partnership_id)
  WHERE completed_at IS NULL AND abandoned_at IS NULL;
