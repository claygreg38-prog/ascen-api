-- Migration 058: Breath Bridge Configuration (per-family)

CREATE TABLE IF NOT EXISTS breath_bridge_config (
  family_id UUID PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT false,
  weekly_message_cap INTEGER NOT NULL DEFAULT 3,
  coaching_active BOOLEAN NOT NULL DEFAULT false,
  current_gate VARCHAR(10) NOT NULL DEFAULT 'gate_1' CHECK (current_gate IN ('gate_1', 'gate_2', 'gate_3', 'gate_4')),
  clinician_emphasis_domain VARCHAR(30),
  clinician_id INTEGER REFERENCES users(id),
  parent_consent_at TIMESTAMP WITH TIME ZONE,
  guardian_consent_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  paused_reason TEXT,
  post_release_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
