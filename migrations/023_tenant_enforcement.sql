-- Migration 023: Multi-Tenancy Enforcement + AI Usage Tracking
-- Session 18: Add tenant_id to remaining tables, backfill, AI usage log

-- ═══════════════════════════════════════════════════════
-- ADD tenant_id TO TABLES MISSING IT
-- ═══════════════════════════════════════════════════════

ALTER TABLE personalized_art ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE showcase_posts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE capacity_snapshots ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE capacity_investments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE art_aggregations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE family_constellations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE family_invitations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE family_memberships ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE family_patterns ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE family_messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE family_escalations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE sleep_entries ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- ═══════════════════════════════════════════════════════
-- BACKFILL EXISTING RECORDS WITH ASCEN TENANT
-- ═══════════════════════════════════════════════════════

DO $$
DECLARE ascen_id UUID;
BEGIN
  SELECT id INTO ascen_id FROM tenants WHERE slug = 'ascen';
  IF ascen_id IS NOT NULL THEN
    UPDATE users SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE session_completions SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE family_units SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE personalized_art SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE showcase_posts SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE legacy_capsules SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE capacity_ledger SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE capacity_snapshots SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE capacity_investments SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE art_aggregations SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE family_constellations SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE family_invitations SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE family_memberships SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE family_patterns SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE family_messages SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE family_escalations SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE kitchen_table_sessions SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE cobreath_sessions SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE lightbridge_devices SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE sleep_entries SET tenant_id = ascen_id WHERE tenant_id IS NULL;
    UPDATE enrollment_codes SET tenant_id = ascen_id WHERE tenant_id IS NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- TENANT INDEXES
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_personalized_art_tenant ON personalized_art(tenant_id);
CREATE INDEX IF NOT EXISTS idx_showcase_posts_tenant ON showcase_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_legacy_capsules_tenant ON legacy_capsules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_tenant ON capacity_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_capacity_investments_tenant ON capacity_investments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_art_aggregations_tenant ON art_aggregations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_tenant ON family_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_family_patterns_tenant ON family_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_tenant ON family_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sleep_entries_tenant ON sleep_entries(tenant_id);

-- ═══════════════════════════════════════════════════════
-- AI USAGE LOG
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id INTEGER,
  session_id UUID,
  task_type VARCHAR(50) NOT NULL,
  model_tier VARCHAR(10) NOT NULL,
  model_name VARCHAR(100),
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_cents DECIMAL(8,4),
  elapsed_ms INTEGER,
  is_fallback BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_task ON ai_usage_log(task_type, created_at DESC);
