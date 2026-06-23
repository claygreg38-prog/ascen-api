-- Migration 087 — Coupling L2: server-derived co-breath pacing
-- startSession sets partnership_sessions.breath_params at the gated start; the WS
-- breathing_start loads it FROM the session. The server is the ONLY source of
-- pacing — clients never supply breath params. Additive + idempotent. Raw SQL; no ORM.
ALTER TABLE partnership_sessions ADD COLUMN IF NOT EXISTS breath_params JSONB;
