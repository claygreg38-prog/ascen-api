-- Migration 055: Gallery Harmonics Engine
-- Adds harmonic metadata and container shape to session_completions

ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS harmonic_meta JSONB;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS container_shape VARCHAR(20) DEFAULT 'circle';
