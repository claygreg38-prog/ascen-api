-- Migration 063: Coaching Firmware Log (Breath Bridge Phase 3)

CREATE TABLE IF NOT EXISTS coaching_firmware_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id INTEGER NOT NULL REFERENCES users(id),
  session_id INTEGER,
  firmware_entry_id VARCHAR(50) NOT NULL,
  domain VARCHAR(30) NOT NULL CHECK (domain IN ('showing_up', 'emotional_vocabulary', 'co_regulation', 'letting_go', 'repair')),
  gate VARCHAR(10) NOT NULL CHECK (gate IN ('gate_1', 'gate_2', 'gate_3', 'gate_4')),
  content TEXT NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  clinician_emphasis VARCHAR(30),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaching_fw_participant ON coaching_firmware_log(participant_id);
CREATE INDEX IF NOT EXISTS idx_coaching_fw_delivered ON coaching_firmware_log(delivered_at DESC);

-- Add coaching_active default to true for new enrollments (Phase 3 enables it)
-- Column already exists from Phase 2 migration 058, just update default behavior
