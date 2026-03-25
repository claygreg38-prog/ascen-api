-- Migration 041: Firmware Session Templates + AXIS Recommendation
-- HOS Family Layer N3: 8 YAML-defined firmware types as foundation,
-- plus Boundary Firmware extension. Each firmware is a specific practice
-- that installs new deep-level code.

CREATE TABLE IF NOT EXISTS firmware_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firmware_key VARCHAR(50) NOT NULL UNIQUE,
  firmware_number INTEGER NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  target_armors JSONB NOT NULL DEFAULT '[]',
  session_count INTEGER DEFAULT 3,
  breath_mode VARCHAR(50) DEFAULT 'simple_pacer',
  breath_ratio VARCHAR(10) DEFAULT '4:6',
  duration_minutes INTEGER DEFAULT 12,
  level INTEGER DEFAULT 1 CHECK (level IN (1, 2, 3)),
  prerequisite_firmware VARCHAR(50),
  luno_opening TEXT,
  luno_closing TEXT,
  somatic_exercises JSONB DEFAULT '[]',
  field_test_prompts JSONB DEFAULT '[]',
  is_yaml_defined BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add firmware tracking to session_completions
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS firmware_number INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS firmware_name VARCHAR(100);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS field_test_response TEXT;

-- ═══════════════════════════════════════════════════════════════
-- SEED: 8 YAML-defined firmware (foundation) + 1 extension
-- Source: legacy-ace-v2-dual-axis.yaml firmware_sequence arrays
-- ═══════════════════════════════════════════════════════════════

INSERT INTO firmware_templates (firmware_key, firmware_number, name, description, target_armors, session_count, breath_mode, breath_ratio, luno_opening, luno_closing, somatic_exercises, field_test_prompts, is_yaml_defined)
VALUES
-- 1. Cache Clearing (YAML: cache_clearing) — universal, always first
('cache_clearing', 1, 'Cache Clearing', 'Release accumulated stress patterns. The restart practice. Every system needs this before targeted work.', '["all"]', 3, 'extended_exhale', '4:8',
 'Your system has been holding a lot. Today we clear what is no longer needed.',
 'You just freed up space your body has been using to carry old weight.',
 '["progressive_muscle_release", "feet_on_floor"]',
 '["Notice one moment today where your body feels lighter than expected.", "Before bed, name three things your body held today that it can release."]',
 true),

-- 2. Baseline Reboot (YAML: baseline_reboot)
('baseline_reboot', 2, 'Baseline Reboot', 'Reset the safety threshold. Recalibrate what safe feels like. Update the definition your body learned long ago.', '["The Sentinel", "The Fortress", "The Scanner"]', 3, 'simple_pacer', '4:6',
 'Your body learned to define safe a long time ago. Today we update that definition.',
 'Safe does not mean nothing bad happens. It means you can handle what comes.',
 '["grounding_5_senses", "temperature_awareness"]',
 '["Identify one space this week where your body relaxes without you telling it to.", "Notice the difference between being safe and feeling safe."]',
 true),

-- 3. File Recovery (YAML: file_recovery)
('file_recovery', 3, 'File Recovery', 'Recover presence. Rediscover a pattern''s origin. Practice being seen without danger.', '["The Ghost", "The Wanderer", "The Inheritor"]', 3, 'simple_pacer', '3:5',
 'You learned to disappear to survive. Today we practice being here.',
 'You showed up. Your body stayed. That is the recovery.',
 '["gentle_movement", "self_holding"]',
 '["Make eye contact with one person today for 3 seconds longer than comfortable.", "Say one thing out loud that you would normally keep silent."]',
 true),

-- 4. Legacy Thread (YAML: legacy_thread)
('legacy_thread', 4, 'Legacy Thread', 'Install new permission through inherited code. Thread new patterns where old ones ran. Practice allowing needs.', '["The Override", "The Refuser", "The Atlas"]', 3, 'somatic_release', '4:8',
 'Your system learned that needing something was dangerous. Today we install a new permission.',
 'You are allowed to need. That was always true. Your body is remembering.',
 '["progressive_muscle_release", "self_holding"]',
 '["Today, when you want something, say it out loud — even if only to yourself.", "Practice one no this week that protects your energy."]',
 true),

-- 5. Legacy Code Deprecation (YAML: legacy_code_deprecation)
('legacy_code_deprecation', 5, 'Legacy Code Deprecation', 'Reorganize scattered patterns into coherent awareness. Deprecate code that no longer serves. Keep what protects, release what exhausts.', '["The Scanner", "The Chameleon", "The Hoarder", "The Spender"]', 3, 'pendulation_loop', '4:6',
 'Your awareness is powerful. Today we organize it so it serves you instead of exhausting you.',
 'Your scanner is still online. But now it works for you, not against you.',
 '["orienting_to_space", "bilateral_tapping"]',
 '["Today, notice when your scanner activates. Just notice — do not judge.", "Practice one conversation where you let your guard scan at 50 percent instead of 100."]',
 true),

-- 6. Gratitude Patch (YAML: gratitude_patch)
('gratitude_patch', 6, 'Gratitude Patch', 'Process loss patterns through acknowledgment. Distinguish hoarding from fear versus releasing. Grief is code that runs until acknowledged.', '["The Hoarder", "The Spender", "The Inheritor"]', 3, 'pendulation_loop', '4:2:6',
 'Loss taught your body to hold tight or let go of everything. Today we find the middle.',
 'Grief is not a problem to solve. It is code that runs until it is acknowledged.',
 '["self_holding", "gentle_movement"]',
 '["Name one thing you are holding onto because letting go feels like losing again.", "Name one thing you gave away too quickly because holding felt too heavy."]',
 true),

-- 7. Cultural Source Code Recovery (YAML: cultural_source_code_recovery)
('cultural_source_code_recovery', 7, 'Cultural Source Code Recovery', 'Recover cultural patterns that were severed. Reconnect to identity code that displacement, persecution, or unknown lineage interrupted.', '["The Nomad", "The Wanderer", "The Fortress", "The Refuser"]', 3, 'coherence', '6:6',
 'Your family carried something worth keeping, even if it was interrupted. Today we recover what we can.',
 'The source code was never deleted. It was waiting for someone brave enough to look.',
 '["orienting_to_space", "feet_on_floor"]',
 '["Ask one family member about a tradition that was lost. Just listen.", "Identify one cultural practice your family stopped — and ask why."]',
 true),

-- 8. Network Expansion Protocol (YAML: network_expansion_protocol)
('network_expansion_protocol', 8, 'Network Expansion Protocol', 'Graduated trust and connection exercises. Start with breath, extend to co-breath. Install connection code without engulfment.', '["The Doubter", "The Scanner", "The Nomad", "The Fortress"]', 3, 'simple_pacer', '4:6',
 'Trust is not blind. It is graduated. Today we start small.',
 'You trusted your own breath today. That is where all trust begins.',
 '["bilateral_tapping", "feet_on_floor"]',
 '["Identify one person you trust 60 percent — not 100, not 0. Sit with that number.", "Share one small thing with someone this week. Notice what your body does after."]',
 true),

-- 9. Boundary Firmware (extension — not in YAML, from handoff)
('boundary_firmware', 9, 'Boundary Firmware', 'Install clear boundary code. Practice no without guilt. A boundary is not a wall — it is a door you control.', '["The Atlas", "The Chameleon"]', 3, 'coherence', '6:6',
 'You carry more than your share because your code told you that was your job. Today we update that code.',
 'A boundary is not a wall. It is a door you control.',
 '["progressive_muscle_release", "box_breathing"]',
 '["Say no to one small thing this week. Notice if the world ends. It will not.", "Identify one responsibility you carry that is not actually yours."]',
 false)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_firmware_number ON firmware_templates(firmware_number);
CREATE INDEX IF NOT EXISTS idx_firmware_key ON firmware_templates(firmware_key);
CREATE INDEX IF NOT EXISTS idx_sc_firmware ON session_completions(firmware_number) WHERE firmware_number IS NOT NULL;
