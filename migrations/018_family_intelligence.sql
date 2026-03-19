-- Migration 018: Multi-Tenancy + Family Intelligence Layer
-- Session 13: Tenants, family memberships, invitations, patterns, messages, escalations

-- ═══════════════════════════════════════════════════════
-- TENANTS (multi-tenancy foundation)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  config JSONB DEFAULT '{}',
  curriculum_namespace VARCHAR(100) DEFAULT 'ascen',
  billing_config JSONB DEFAULT '{}',
  feature_flags JSONB DEFAULT '{"co_breath": false, "lightbridge": false, "capacity_currency": false, "family_units": true}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default ASCEN tenant
INSERT INTO tenants (name, slug, config, curriculum_namespace, feature_flags)
VALUES (
  'ASCEN BreathWorx',
  'ascen',
  '{"branding": "mettle_works", "theme": "teal", "closing_tone": "warrior_reassurance"}',
  'ascen',
  '{"co_breath": true, "lightbridge": true, "capacity_currency": true, "family_units": true}'
) ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- ADD TENANT_ID TO EXISTING TABLES (nullable for backward compat)
-- ═══════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS family_unit_id UUID;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- ═══════════════════════════════════════════════════════
-- EXPAND FAMILY_UNITS (add columns that don't exist yet)
-- Note: family_units PK is family_unit_id (UUID), name and created_at already exist
-- ═══════════════════════════════════════════════════════

ALTER TABLE family_units ADD COLUMN IF NOT EXISTS elder_user_id INTEGER REFERENCES users(id);
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS gate_state JSONB DEFAULT '{"gate_1": false, "gate_2": false, "gate_3": false}';
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS shared_goals JSONB DEFAULT '[]';
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS collective_metrics JSONB DEFAULT '{"total_sessions": 0, "collective_regulated_hours": 0, "co_breath_count": 0}';

-- ═══════════════════════════════════════════════════════
-- FAMILY MEMBERSHIPS (relational layer)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS family_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('elder', 'adult_child', 'grandchild', 'extended')),
  generation_level INTEGER DEFAULT 0,
  invited_by INTEGER REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  individual_progress JSONB DEFAULT '{"session_count": 0, "curriculum_position": 1, "streak_days": 0}',
  UNIQUE(family_unit_id, user_id)
);

-- ═══════════════════════════════════════════════════════
-- FAMILY INVITATIONS (gate-controlled)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  invited_by INTEGER REFERENCES users(id) NOT NULL,
  invitee_name VARCHAR(100) NOT NULL,
  invitee_relationship VARCHAR(50) NOT NULL,
  invitation_code VARCHAR(20) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  gate_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  accepted_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════
-- FAMILY PATTERNS (Intelligence Layer data)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS family_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  pattern_type VARCHAR(30) NOT NULL CHECK (pattern_type IN ('topic_response', 'temporal', 'dyadic', 'cascade')),
  pattern_key VARCHAR(255) NOT NULL,
  pattern_data JSONB NOT NULL,
  observation_count INTEGER DEFAULT 1,
  last_observed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_unit_id, pattern_type, pattern_key)
);

-- ═══════════════════════════════════════════════════════
-- FAMILY MESSAGES (automated, cooldown-tracked)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS family_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  target_user_id INTEGER REFERENCES users(id),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('individual', 'family_unit', 'dyad')),
  category VARCHAR(30) NOT NULL CHECK (category IN ('disagreement', 'avoidance', 'milestone', 'dropout', 'breakthrough', 'overdraft', 'cascade')),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('gentle', 'moderate', 'urgent')),
  message_template_id VARCHAR(100),
  message_text TEXT,
  cooldown_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- FAMILY ESCALATIONS
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS family_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  escalation_type VARCHAR(50) NOT NULL,
  trigger_data JSONB,
  routed_to VARCHAR(100),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════
-- MESSAGE TEMPLATES (preset library)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS message_templates (
  id VARCHAR(100) PRIMARY KEY,
  tenant_slug VARCHAR(100) DEFAULT 'ascen',
  category VARCHAR(30) NOT NULL,
  severity VARCHAR(10) NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  message_text TEXT NOT NULL,
  rotation_group INTEGER DEFAULT 1
);

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_session_completions_tenant ON session_completions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_family_units_tenant ON family_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_family_memberships_unit ON family_memberships(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_family_memberships_user ON family_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_code ON family_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_family_patterns_unit ON family_patterns(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_family_patterns_type ON family_patterns(family_unit_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_family_messages_target ON family_messages(target_user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_messages_cooldown ON family_messages(target_user_id, category, sent_at DESC);

-- ═══════════════════════════════════════════════════════
-- SEED MESSAGE TEMPLATES (ASCEN tenant — warrior reassurance)
-- ═══════════════════════════════════════════════════════

INSERT INTO message_templates (id, tenant_slug, category, severity, target_type, message_text, rotation_group) VALUES
  -- Milestone (gentle, family_unit)
  ('milestone_1', 'ascen', 'milestone', 'gentle', 'family_unit', 'Your family just hit [N] sessions together. That''s [N] times you chose healing over habit.', 1),
  ('milestone_2', 'ascen', 'milestone', 'gentle', 'family_unit', 'Look at your family. [N] sessions deep. This is what showing up looks like.', 2),
  ('milestone_3', 'ascen', 'milestone', 'gentle', 'family_unit', 'Your family''s healing gallery just grew. [N] sessions. Each one earned.', 3),
  -- Dropout (gentle, individual)
  ('dropout_1', 'ascen', 'dropout', 'gentle', 'individual', 'It''s been a few days. Your breath is still here when you''re ready.', 1),
  ('dropout_2', 'ascen', 'dropout', 'gentle', 'individual', 'No judgment. Just a reminder: your nervous system remembers the work you''ve done.', 2),
  ('dropout_3', 'ascen', 'dropout', 'gentle', 'individual', 'When you''re ready, Session [N] is waiting. No rush.', 3),
  -- Breakthrough (gentle, individual)
  ('breakthrough_1', 'ascen', 'breakthrough', 'gentle', 'individual', 'Something shifted. Your body held regulation longer than ever before. Feel that.', 1),
  ('breakthrough_2', 'ascen', 'breakthrough', 'gentle', 'individual', 'New baseline. Your nervous system just leveled up. Keep going.', 2),
  ('breakthrough_3', 'ascen', 'breakthrough', 'gentle', 'individual', '72 hours of sustained regulation. That''s not luck — that''s practice.', 3),
  -- Overdraft (moderate, individual)
  ('overdraft_1', 'ascen', 'overdraft', 'moderate', 'individual', 'Your body is telling you it needs space. Honor that.', 1),
  ('overdraft_2', 'ascen', 'overdraft', 'moderate', 'individual', 'Low capacity today. That''s real information, not weakness. Rest is work.', 2),
  ('overdraft_3', 'ascen', 'overdraft', 'moderate', 'individual', 'The system sees you''re running low. Protect your energy today.', 3),
  -- Cascade (urgent, family_unit)
  ('cascade_1', 'ascen', 'cascade', 'urgent', 'family_unit', 'Your family needs individual space right now. Solo sessions recommended before the next family session.', 1),
  ('cascade_2', 'ascen', 'cascade', 'urgent', 'family_unit', 'The system detected overlapping stress. Take a breath alone first.', 2),
  -- Disagreement (moderate, dyad)
  ('disagreement_1', 'ascen', 'disagreement', 'moderate', 'dyad', 'Two hearts beating differently today. A co-breath session might help you find rhythm together.', 1),
  ('disagreement_2', 'ascen', 'disagreement', 'moderate', 'dyad', 'Divergent days happen. When you''re both ready, breathe together.', 2),
  -- Avoidance (gentle, individual)
  ('avoidance_1', 'ascen', 'avoidance', 'gentle', 'individual', 'Some topics take time. There''s no deadline on healing.', 1),
  ('avoidance_2', 'ascen', 'avoidance', 'gentle', 'individual', 'Your body knows what it needs to process. Trust the pace.', 2)
ON CONFLICT (id) DO NOTHING;
