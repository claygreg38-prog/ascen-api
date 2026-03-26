-- Migration 050: Prenatal Module — System Preparation
-- The parent's nervous system IS the child's environment.
-- Every breath session during pregnancy is already a co-regulation session.

-- Prenatal enrollment
CREATE TABLE IF NOT EXISTS prenatal_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  partner_id INTEGER REFERENCES users(id),
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'loss')),

  -- Pregnancy tracking
  due_date DATE NOT NULL,
  current_trimester INTEGER DEFAULT 1 CHECK (current_trimester IN (1, 2, 3)),
  weeks_at_enrollment INTEGER,

  -- Individual baseline at enrollment
  enrollment_baseline JSONB DEFAULT '{}',
  -- { mean_hr, mean_hrv, coherence, ns3, capacity_state }

  -- Prenatal Heritage/Price focus
  codes_to_deprecate JSONB DEFAULT '[]',
  -- Patterns the parent does NOT want to install in the child

  -- Birth plan integration
  birth_breath_plan JSONB,

  -- Post-natal tracking
  birth_date DATE,
  child_name VARCHAR(100),
  child_user_id INTEGER REFERENCES users(id),
  lightbridge_device_id UUID,
  postnatal_transition_date DATE,

  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trimester content
CREATE TABLE IF NOT EXISTS trimester_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trimester INTEGER NOT NULL CHECK (trimester IN (1, 2, 3)),
  week_start INTEGER NOT NULL,
  week_end INTEGER NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN (
    'breath_adaptation', 'heritage_reflection', 'body_connection',
    'partner_integration', 'preparation', 'lightbridge_preview'
  )),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  content JSONB NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triad breath sessions
CREATE TABLE IF NOT EXISTS triad_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenatal_enrollment_id UUID REFERENCES prenatal_enrollments(id) NOT NULL,
  session_completion_id INTEGER REFERENCES session_completions(id),

  parent_biometrics JSONB DEFAULT '{}',
  partner_biometrics JSONB DEFAULT '{}',

  -- The third presence is the unborn child.
  -- We measure the parent's regulation quality as a proxy for the child's environment.
  triad_quality JSONB DEFAULT '{}',
  -- { parent_regulation, partner_sync, estimated_fetal_environment }

  trimester INTEGER,
  gestational_week INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prenatal_user ON prenatal_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_prenatal_partner ON prenatal_enrollments(partner_id);
CREATE INDEX IF NOT EXISTS idx_prenatal_status ON prenatal_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_trimester_content ON trimester_content(trimester, week_start);
CREATE INDEX IF NOT EXISTS idx_triad_enrollment ON triad_sessions(prenatal_enrollment_id);

-- Fix #8: Unique constraint to support ON CONFLICT DO NOTHING on re-run
ALTER TABLE trimester_content ADD CONSTRAINT unique_trimester_content
  UNIQUE (trimester, week_start, category, title);

-- ═══════════════════════════════════════════════════════════════
-- SEED: Trimester Content (10 entries across 3 trimesters)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO trimester_content (trimester, week_start, week_end, category, title, description, content, sort_order)
VALUES
-- Trimester 1: Foundation (weeks 1-12)
(1, 1, 4, 'breath_adaptation', 'First Breath',
 'Your body is beginning something extraordinary. Today we breathe gently — no pushing, no performance.',
 '{"luno_opening": "Welcome. Something new is beginning inside you. Let''s start with the gentlest breath.", "breath_ratio": "3:5", "duration_minutes": 8, "reflection_prompt": "What does your body already know about this new presence?"}', 1),

(1, 5, 8, 'heritage_reflection', 'The Code You Carry',
 'Before this child arrives, what code are you running that you want to examine?',
 '{"luno_opening": "Your child will learn your nervous system before they learn your language. What do you want them to feel?", "reflection_prompt": "Name one pattern you inherited that you do NOT want to pass on. Not to fix it today — just to name it.", "partner_prompt": "What pattern do you see in your partner that you hope your child won''t need?"}', 2),

(1, 9, 12, 'body_connection', 'Listening Inward',
 'Your body is doing extraordinary work. Today we listen to it instead of pushing through.',
 '{"luno_opening": "Your body knows how to do this. Today we just listen.", "breath_ratio": "3:5", "duration_minutes": 10, "somatic": "gentle_movement", "reflection_prompt": "What is your body telling you that you haven''t been hearing?"}', 3),

-- Trimester 2: Deepening (weeks 13-27)
(2, 13, 16, 'heritage_reflection', 'What Will They Inherit?',
 'The Heritage/Price mapping through a prenatal lens — what code is running that this child will absorb?',
 '{"luno_opening": "Your child is already learning your rhythms. Let''s look at which ones you want to keep and which ones you want to change.", "per_armor_prompts": true, "duration_minutes": 15}', 1),

(2, 17, 20, 'partner_integration', 'Two Systems, One Environment',
 'Your partner''s regulation affects yours, which affects the baby. The triad begins.',
 '{"luno_opening": "Two nervous systems are creating the world this child will be born into. Let''s sync them.", "triad_breath": true, "duration_minutes": 15, "partner_prompt": "Place your hand on the belly. Breathe together. The baby feels both of you."}', 2),

(2, 21, 24, 'heritage_reflection', 'The Armor They Won''t Need',
 'Name the armors you carry that you want to deprecate before this child arrives.',
 '{"luno_opening": "The strongest thing you can do for your child is put down the armor they don''t need to carry.", "codes_to_deprecate_exercise": true, "duration_minutes": 15}', 3),

(2, 25, 27, 'body_connection', 'Movement and Stillness',
 'Your baby is moving. You feel them. Today we practice the balance between doing and being.',
 '{"luno_opening": "They''re moving in there. Can you feel it? That movement is their first language. Answer with your breath.", "breath_ratio": "4:6", "duration_minutes": 12}', 4),

-- Trimester 3: Preparation (weeks 28-40)
(3, 28, 31, 'preparation', 'The Arrival Breath',
 'Learning the breath techniques you''ll use during labor and delivery.',
 '{"luno_opening": "The breath that''s been regulating you for months will carry you through delivery. Let''s practice.", "birth_breath_techniques": ["extended_exhale_8", "visualization_opening", "partner_anchor_breath"], "duration_minutes": 12}', 1),

(3, 32, 35, 'lightbridge_preview', 'The First Light',
 'Setting up LightBridge for the nursery — the light that will connect your practice to your child''s room.',
 '{"luno_opening": "Soon there will be a light in their room that pulses with your breath. Let''s prepare that connection.", "lightbridge_setup_instructions": true, "duration_minutes": 10}', 2),

(3, 36, 40, 'preparation', 'When Things Get Hard',
 'Practicing regulation during intensity — the breath that works when nothing else does.',
 '{"luno_opening": "Labor will test every system you''ve built. Today we practice the one breath that works when everything else fails: slow exhale. That''s it. Just the exhale.", "breath_ratio": "4:8", "duration_minutes": 10, "partner_prompt": "Your job during labor: match their exhale. Don''t coach. Don''t fix. Just exhale together."}', 3)

ON CONFLICT DO NOTHING;
