-- Migration 017: Art Aggregation & Key Audit Tables
-- Session 12: Cumulative mandalas, family constellations, key rotation audit

-- Art aggregations (mandalas, constellations, capstones)
CREATE TABLE IF NOT EXISTS art_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id INTEGER REFERENCES users(id),
  aggregation_type VARCHAR(30) NOT NULL CHECK (aggregation_type IN (
    'mandala_50', 'mandala_100', 'arc_completion', 'annual_ring', 'capstone'
  )),
  session_range_start INTEGER,
  session_range_end INTEGER,
  arc_name VARCHAR(100),
  seed_hash VARCHAR(64),
  art_ipfs_hash TEXT,
  art_token_id VARCHAR(100),
  aggregate_parameters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family constellation pieces
CREATE TABLE IF NOT EXISTS family_constellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN (
    'combined_100', 'combined_500', 'combined_1000'
  )),
  combined_session_count INTEGER,
  member_contributions JSONB,
  constellation_art_ipfs_hash TEXT,
  constellation_token_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encryption key audit trail
CREATE TABLE IF NOT EXISTS encryption_key_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_version INTEGER NOT NULL,
  action VARCHAR(30) NOT NULL CHECK (action IN (
    'created', 'activated', 'rotation_started', 'rotation_completed', 'retired'
  )),
  affected_records INTEGER,
  initiated_by VARCHAR(100),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_art_aggregations_participant ON art_aggregations(participant_id);
CREATE INDEX IF NOT EXISTS idx_art_aggregations_type ON art_aggregations(aggregation_type);
CREATE INDEX IF NOT EXISTS idx_family_constellations_unit ON family_constellations(family_unit_id);
