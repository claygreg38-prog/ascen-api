-- Migration 086 — Coupling B2: 48-hour minimum gap between modules
-- partnership_sessions records start (created_at) but no completion time. The gap
-- gate (gateEvaluationEngine.evaluateCouplingGap) needs "last COMPLETED module",
-- so completeSession() now stamps completed_at and the gate reads MAX(completed_at).
-- Additive + idempotent (IF NOT EXISTS). Raw SQL run_NNN; no ORM.
ALTER TABLE partnership_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
