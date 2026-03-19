-- ============================================================
-- Migration 027: Crisis Architecture
-- Session 22 — Crisis lifecycle, steward system, domestic safety
-- ============================================================

-- Privacy mode on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_mode BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_mode_since TIMESTAMPTZ;

-- Crisis events
CREATE TABLE IF NOT EXISTS crisis_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),
  phase VARCHAR(30) NOT NULL CHECK (phase IN (
    'pre_crisis', 'active_crisis', 'recovery_start', 'solo_period',
    'reintegration', 'resolution', 'resolved'
  )),
  trigger_type VARCHAR(30) CHECK (trigger_type IN (
    'compound_signals', 'zero_engagement', 'facilitator_declared', 'self_report'
  )),
  trigger_signals JSONB,
  capacity_frozen BOOLEAN DEFAULT false,
  capacity_frozen_at TIMESTAMPTZ,
  capacity_unfrozen_at TIMESTAMPTZ,
  messaging_paused BOOLEAN DEFAULT true,
  solo_period_start TIMESTAMPTZ,
  solo_period_end TIMESTAMPTZ,
  reintegration_started_at TIMESTAMPTZ,
  steady_streak_days INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  facilitator_id INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crisis check-ins (periodic zero-expectation messages)
CREATE TABLE IF NOT EXISTS crisis_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crisis_event_id UUID REFERENCES crisis_events(id) NOT NULL,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  template_id VARCHAR(50) NOT NULL,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steward assignments (teen family stewards)
CREATE TABLE IF NOT EXISTS steward_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  steward_user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  adult_backup_id INTEGER REFERENCES users(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'stepped_down', 'revoked')),
  authorized_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  reauthorized_count INTEGER DEFAULT 0,
  daily_actions_today INTEGER DEFAULT 0,
  daily_actions_reset_date DATE DEFAULT CURRENT_DATE,
  last_reminder_at TIMESTAMPTZ,
  stepped_down_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crisis message templates
CREATE TABLE IF NOT EXISTS crisis_message_templates (
  id VARCHAR(50) PRIMARY KEY,
  phase VARCHAR(30) NOT NULL,
  message_text TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crisis_events_user ON crisis_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_events_family ON crisis_events(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_crisis_events_phase ON crisis_events(phase) WHERE phase NOT IN ('resolved');
CREATE INDEX IF NOT EXISTS idx_crisis_checkins_event ON crisis_checkins(crisis_event_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_steward_actions_family ON steward_actions(family_unit_id, status);
CREATE INDEX IF NOT EXISTS idx_steward_actions_steward ON steward_actions(steward_user_id, status);

-- Seed 16 crisis message templates across 4 phases
INSERT INTO crisis_message_templates (id, phase, message_text, description) VALUES
  ('checkin_1', 'active_crisis', 'We are still here. No rush.', 'Standard check-in'),
  ('checkin_2', 'active_crisis', 'Nothing is needed from you right now.', 'Zero expectation'),
  ('checkin_3', 'active_crisis', 'Your light is still on. That is all.', 'LightBridge reference'),
  ('checkin_4', 'active_crisis', 'Take whatever time you need.', 'Time permission'),
  ('recovery_1', 'recovery_start', 'You''re here. That''s enough.', 'Recovery acknowledgment'),
  ('recovery_2', 'recovery_start', 'One breath at a time. No catching up needed.', 'No pressure recovery'),
  ('recovery_3', 'recovery_start', 'Your practice is waiting whenever you''re ready. No rush.', 'Practice invitation'),
  ('recovery_4', 'recovery_start', 'Whatever today looks like is okay.', 'Daily acceptance'),
  ('solo_1', 'solo_period', 'Your solo practice is exactly right for now.', 'Solo affirmation'),
  ('solo_2', 'solo_period', 'Building your own ground first. That takes courage.', 'Solo encouragement'),
  ('solo_3', 'solo_period', 'Family features will be available when you''re ready. No timeline.', 'No pressure reintegration'),
  ('solo_4', 'solo_period', 'Your progress is yours. No one else needs to see it yet.', 'Privacy affirmation'),
  ('reintegration_1', 'reintegration', 'Family connection is available when you choose. No pressure.', 'Optional family'),
  ('reintegration_2', 'reintegration', 'You''ve built solid ground. Shared practice can begin whenever you''re ready.', 'Readiness affirmation'),
  ('reintegration_3', 'reintegration', 'One connection at a time. You set the pace.', 'Pace control'),
  ('reintegration_4', 'reintegration', 'Your family has been holding space for you.', 'Family holding space')
ON CONFLICT (id) DO NOTHING;
