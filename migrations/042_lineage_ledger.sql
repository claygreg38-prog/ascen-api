-- Migration 042: Lineage Ledger — Permanent Healing Record
-- HOS Family Layer N4: milestone entries with SHA-256 attestation hashes
-- Entries are permanent. They compose the healing record.

CREATE TABLE IF NOT EXISTS lineage_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),
  entry_type VARCHAR(30) NOT NULL CHECK (entry_type IN (
    'armor_confirmed', 'firmware_installed', 'firmware_completed',
    'field_test_passed', 'crest_versioned', 'family_code_named',
    'quilting_completed', 'heritage_mapped'
  )),
  entry_data JSONB NOT NULL,
  attestation_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lineage_entries_user ON lineage_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lineage_entries_family ON lineage_entries(family_unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lineage_entries_type ON lineage_entries(entry_type);
