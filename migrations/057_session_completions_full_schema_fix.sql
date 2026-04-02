-- ══════════════════════════════════════════════════════════════
-- Migration 057: session_completions — Full Schema Audit Fix
--
-- Adds ALL columns referenced in code but missing from schema.
-- Fixes name mismatches. One migration, no more whack-a-mole.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Columns referenced by AXIS crons (overnight failures) ──
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS session_type TEXT;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS correlation_score NUMERIC;

-- ── 2. Zone percentage breakdowns (legacyVault, preventionImpact, crisis) ──
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS approaching_zone_pct INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS below_window_zone_pct INTEGER;

-- ── 3. Breath parameters (legacyVault, sessionOrchestrator) ──
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS breath_ratio TEXT;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS breath_duration_seconds INTEGER;

-- ── 4. coherence_peak alias (4 files query this instead of coherence_score) ──
-- Add as a real column so queries don't fail. Orchestrator can populate both.
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS coherence_peak NUMERIC;

-- ── 5. pause_count (code uses this name, CREATE TABLE used total_pauses) ──
-- Add pause_count if it doesn't exist. If total_pauses exists but pause_count
-- doesn't, this creates the column the INSERT actually uses.
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0;

-- ── 6. participants JSONB (asymmetricVulnerabilityCheck queries it) ──
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS participants JSONB;

-- ── 7. Zone pct aliases (preventionImpact/artifactValuation use these names) ──
-- optimal_zone_pct exists from migration 013. These are alternate names used in code.
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS zone_optimal_pct INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS zone_approaching_pct INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS zone_below_pct INTEGER;

-- ── 8. Backfill zone aliases from existing columns where possible ──
UPDATE session_completions SET zone_optimal_pct = optimal_zone_pct
  WHERE zone_optimal_pct IS NULL AND optimal_zone_pct IS NOT NULL;
UPDATE session_completions SET coherence_peak = coherence_score
  WHERE coherence_peak IS NULL AND coherence_score IS NOT NULL;
