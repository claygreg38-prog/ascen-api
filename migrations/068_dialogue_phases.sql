-- ══════════════════════════════════════════════════════════════
-- Migration 068: Add dialogue_phases JSONB to session_templates
-- Stores per-phase Luno dialogue lines for the content pipeline.
-- Tier 1 source for frontend dialogue resolution.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS dialogue_phases JSONB DEFAULT NULL;
