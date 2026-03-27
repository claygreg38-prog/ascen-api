-- ============================================================
-- Migration 054: Recovery Designee — Dual-Key Seed Phrase Backup
--
-- vault_recovery_backups: encrypted seed phrase backups
--   Encrypted with key derived from BOTH clinician + admin credentials.
--   Neither can decrypt alone.
--
-- vault_recovery_events: permanent audit trail for every recovery.
--   Courts and auditors see WHO recovered WHAT and WHY,
--   without seeing the phrase itself.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS vault_recovery_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),

  -- Encrypted seed phrase backup
  -- Encrypted with a key derived from BOTH approvers' credentials
  -- Neither approver alone can decrypt
  encrypted_backup BYTEA NOT NULL,
  encryption_method VARCHAR(30) DEFAULT 'aes-256-gcm-dual-key',

  -- Split key holders (dual-key)
  approver_a_role VARCHAR(20) NOT NULL DEFAULT 'clinician',
  approver_b_role VARCHAR(20) NOT NULL DEFAULT 'admin',
  approver_a_id INTEGER REFERENCES users(id),
  approver_b_id INTEGER REFERENCES users(id),

  -- Recovery metadata
  recovery_count INTEGER DEFAULT 0,
  last_recovery_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'recovered', 'revoked')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_recovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id UUID REFERENCES vault_recovery_backups(id) NOT NULL,
  user_id INTEGER REFERENCES users(id) NOT NULL,

  -- Who approved
  approver_a_id INTEGER REFERENCES users(id) NOT NULL,
  approver_b_id INTEGER REFERENCES users(id) NOT NULL,

  -- Why
  reason VARCHAR(50) NOT NULL CHECK (reason IN (
    'facility_transfer', 'lost_phrase', 'confiscated',
    'damaged', 'facility_policy', 'other'
  )),
  reason_notes TEXT,

  -- Audit
  ip_address VARCHAR(45),
  recovered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_user ON vault_recovery_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_tenant ON vault_recovery_backups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recovery_status ON vault_recovery_backups(status);
CREATE INDEX IF NOT EXISTS idx_recovery_events_backup ON vault_recovery_events(backup_id);
CREATE INDEX IF NOT EXISTS idx_recovery_events_user ON vault_recovery_events(user_id);

COMMIT;
