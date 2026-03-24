-- Migration 037: Blockchain tracking columns
-- Adds tx hash + simulated flag to session_completions, enrollment tracking to users

ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS blockchain_simulated BOOLEAN DEFAULT true;

ALTER TABLE users ADD COLUMN IF NOT EXISTS enrollment_tx_hash TEXT;
