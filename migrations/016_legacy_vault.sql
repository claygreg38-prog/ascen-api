-- Migration 016: Legacy Vault — Capsules, Designees, Unlock Log, Family Breath Weaves
-- Session 11 deliverables
-- Note: users.id and session_completions.id are INTEGER in this DB

-- Legacy capsules (parent creates for child)
CREATE TABLE IF NOT EXISTS legacy_capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_participant_id INTEGER REFERENCES users(id),
  session_completion_id INTEGER REFERENCES session_completions(id),
  art_token_id VARCHAR(100),
  personalized_art_id UUID REFERENCES personalized_art(id),

  -- Affirmation (1-2 sentences, encrypted with capsule key)
  affirmation_encrypted TEXT NOT NULL,

  -- Breathing cadence from the legacy session
  breath_cadence JSONB NOT NULL,
  -- Format: { "ratio": "4:6", "bpm": 6, "duration_seconds": 480, "coherence_peak": 0.82, "inhale_seconds": 4, "exhale_seconds": 6 }

  -- NS3 snapshot (encrypted — clinical context for future decode)
  ns3_snapshot_encrypted TEXT NOT NULL,

  -- Encryption
  encryption_method VARCHAR(20) DEFAULT 'bip39',
  seed_phrase_hash VARCHAR(64) NOT NULL,
  -- SHA-256 hash of the BIP39 seed phrase (for verification, NOT the phrase itself)

  -- Recovery designee (CRITICAL — prevents permanent capsule loss)
  recovery_backup_encrypted TEXT,
  -- Seed phrase encrypted with Mettle Works recovery key (separate from ART_ENCRYPTION_KEY)
  recovery_opted_in BOOLEAN DEFAULT false,
  recovery_authorized_by VARCHAR(200),
  recovery_authorized_at TIMESTAMPTZ,

  -- Release configuration
  release_type VARCHAR(20) NOT NULL CHECK (release_type IN ('immediate', 'drip', 'date_locked', 'on_request')),
  release_schedule JSONB,

  -- Edit tracking (ONE review, ONE edit max — enforced at DB level)
  review_count INTEGER DEFAULT 0 CHECK (review_count <= 1),
  edit_count INTEGER DEFAULT 0 CHECK (edit_count <= 1),
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capsule designees (who can unlock)
CREATE TABLE IF NOT EXISTS capsule_designees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID REFERENCES legacy_capsules(id),
  designee_wallet_address VARCHAR(42),
  designee_name VARCHAR(100),
  relationship VARCHAR(50) CHECK (relationship IN ('child', 'grandchild', 'sibling', 'partner', 'other')),
  has_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capsule unlock audit log
CREATE TABLE IF NOT EXISTS capsule_unlock_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID REFERENCES legacy_capsules(id),
  designee_id UUID REFERENCES capsule_designees(id),
  unlock_method VARCHAR(20) CHECK (unlock_method IN ('seed_phrase', 'wallet_match', 'scheduled_release', 'recovery')),
  unlocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family Breath Weaves (composite family patterns)
CREATE TABLE IF NOT EXISTS family_breath_weaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  contributing_capsule_ids UUID[],
  composite_cadence JSONB NOT NULL,
  composite_art_ipfs_hash TEXT,
  composite_token_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_legacy_capsules_creator ON legacy_capsules(creator_participant_id);
CREATE INDEX IF NOT EXISTS idx_capsule_designees_capsule ON capsule_designees(capsule_id);
CREATE INDEX IF NOT EXISTS idx_capsule_designees_wallet ON capsule_designees(designee_wallet_address);
CREATE INDEX IF NOT EXISTS idx_capsule_unlock_log_capsule ON capsule_unlock_log(capsule_id);
