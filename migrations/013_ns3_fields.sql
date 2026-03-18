-- Migration 013: NS3 Engine fields on session_completions
-- Idempotent — safe to re-run.

ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS ns3_mean INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS ns3_peak INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS ns3_floor INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS optimal_zone_pct INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS regulatory_trajectory VARCHAR(20);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS sustained_optimal BOOLEAN;
