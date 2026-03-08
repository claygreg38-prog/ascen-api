-- ============================================================
-- Migration 011: Combined Ledger Sync Schema
-- Run: psql $DATABASE_URL -f migrations/011_combined_ledger_sync.sql
--
-- Merges:
--   - Blockchain attestation infrastructure (wallet, SCT, attestation queue)
--   - Family unit scaffolding (nullable — Phase 3 build)
--   - Modality model (active_modalities JSONB)
--   - Enhancement Spec enrichment columns (data that the orchestrator
--     already computes but currently throws away)
--
-- Safe to re-run: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

BEGIN;

-- ============================================================
-- 1. USERS TABLE — New Columns
-- ============================================================

-- [BLOCKCHAIN] Embedded wallet address (silent keypair at onboarding)
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) UNIQUE;

-- [FAMILY] Nullable scaffolding — foreign key added after family_units table exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_unit_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fis_consent BOOLEAN DEFAULT false;

-- [MODALITY] Replaces track model — solo spine + concurrent modalities
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_modalities JSONB DEFAULT '{"solo": {"session": 0, "act": 1}}';

-- ============================================================
-- 2. SESSION_COMPLETIONS — Enrichment Columns
--    (Orchestrator already computes these; currently thrown away)
-- ============================================================

-- [ABI] Time from session start to first REGULATED state (seconds)
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS time_to_regulation_sec INTEGER;

-- [ABI] Arrival baseline captured by BaselineFilter
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS arrival_hr INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS arrival_hrv NUMERIC;

-- [ABI] Coherence direction across session: improving | stable | declining
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS coherence_trajectory TEXT;

-- [ABI] Time spent in each state zone (JSONB: {regulated: 45, flow: 12, ...})
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS zone_time_profile JSONB;

-- ============================================================
-- 3. SESSION_COMPLETIONS — Blockchain Attestation Columns
-- ============================================================

-- [BLOCKCHAIN] SHA-256 hash of canonical SessionDataPacket
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS packet_hash VARCHAR(64);

-- [BLOCKCHAIN] Facilitator co-signed the attestation
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS facilitator_attested BOOLEAN DEFAULT false;

-- [BLOCKCHAIN] Attestation submitted to chain
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS attestation_submitted BOOLEAN DEFAULT false;

-- [BLOCKCHAIN] On-chain SCT token ID (set after mint confirmation)
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS sct_token_id VARCHAR(78);

-- ============================================================
-- 4. SESSION_COMPLETIONS — Enhancement Spec Columns
--    (From vault pattern, victory lap, cross-system synergy)
-- ============================================================

-- [ABI] State engine summary snapshot
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS state_summary JSONB;

-- [ABI] Coaching engine summary snapshot
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS coaching_summary JSONB;

-- [ABI] Immune system flags for this session
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS immune_flags_snapshot JSONB;

-- [ABI] Biometric source annotation (polar_h10 | rppg_camera | none)
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS biometric_source TEXT;

-- ============================================================
-- 5. FAMILY_UNITS TABLE (Empty — FK references need it to exist)
-- ============================================================

CREATE TABLE IF NOT EXISTS family_units (
  family_unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  created_by UUID,
  lightbridge_active BOOLEAN DEFAULT false,
  fis_tier TEXT DEFAULT 'reconnecting',
  fis_score NUMERIC,
  fis_last_computed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Now add the FK from users → family_units
-- (DO / NOTHING pattern: safe if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_family_unit'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_family_unit
      FOREIGN KEY (family_unit_id) REFERENCES family_units(family_unit_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 6. ATTESTATION_QUEUE TABLE
--    Status workflow: awaiting_facilitator → ready → submitting
--                     → confirmed → failed
-- ============================================================

CREATE TABLE IF NOT EXISTS attestation_queue (
  id SERIAL PRIMARY KEY,
  session_completion_id INTEGER REFERENCES session_completions(id),
  user_id UUID NOT NULL,
  packet_hash VARCHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_facilitator'
    CHECK (status IN ('awaiting_facilitator', 'ready', 'submitting', 'confirmed', 'failed', 'gas_deferred')),
  facilitator_id UUID,
  facilitator_signed_at TIMESTAMP WITH TIME ZONE,
  tx_hash VARCHAR(66),
  tx_submitted_at TIMESTAMP WITH TIME ZONE,
  tx_confirmed_at TIMESTAMP WITH TIME ZONE,
  gas_price_gwei NUMERIC,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attestation_queue_status ON attestation_queue(status);
CREATE INDEX IF NOT EXISTS idx_attestation_queue_user ON attestation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_attestation_queue_hash ON attestation_queue(packet_hash);

-- ============================================================
-- 7. CONTRACT_REGISTRY TABLE
--    Addresses in DB, never hardcoded in code
-- ============================================================

CREATE TABLE IF NOT EXISTS contract_registry (
  id SERIAL PRIMARY KEY,
  contract_name TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL,
  address VARCHAR(42) NOT NULL,
  abi_hash VARCHAR(64),
  deployed_at TIMESTAMP WITH TIME ZONE,
  deployed_by TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 8. MODALITY_COMPLETION_PROFILES TABLE
--    Built by ABI when any modality completes (e.g., FR25 → solo bridge)
-- ============================================================

CREATE TABLE IF NOT EXISTS modality_completion_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  modality TEXT NOT NULL,
  completed_session INTEGER NOT NULL,
  exit_coherence NUMERIC,
  exit_ratio TEXT,
  last_5_avg_coherence NUMERIC,
  ramp_window_start INTEGER,
  ramp_window_end INTEGER,
  transition_flags JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modality_profiles_user ON modality_completion_profiles(user_id);

-- ============================================================
-- 9. INDEXES on new columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_family_unit ON users(family_unit_id) WHERE family_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_completions_packet ON session_completions(packet_hash) WHERE packet_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_completions_attestation ON session_completions(attestation_submitted) WHERE attestation_submitted = true;

COMMIT;

-- ============================================================
-- Verification query — run after migration to confirm
-- ============================================================
-- SELECT
--   (SELECT count(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'wallet_address') AS users_wallet,
--   (SELECT count(*) FROM information_schema.columns WHERE table_name = 'session_completions' AND column_name = 'packet_hash') AS sc_packet_hash,
--   (SELECT count(*) FROM information_schema.tables WHERE table_name = 'family_units') AS family_units_exists,
--   (SELECT count(*) FROM information_schema.tables WHERE table_name = 'attestation_queue') AS attestation_queue_exists,
--   (SELECT count(*) FROM information_schema.tables WHERE table_name = 'contract_registry') AS contract_registry_exists,
--   (SELECT count(*) FROM information_schema.tables WHERE table_name = 'modality_completion_profiles') AS modality_profiles_exists;
