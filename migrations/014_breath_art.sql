-- Migration 014: Breath Art columns on session_completions
-- Supports art generation, IPFS storage, crown selection, photo palette, intention seed

ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS art_ipfs_hash TEXT;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS art_token_id VARCHAR(100);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS art_encoding_version INTEGER DEFAULT 1;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS crown_id VARCHAR(50);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS photo_palette JSONB;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS intention_hash VARCHAR(64);
