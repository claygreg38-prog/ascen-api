-- Migration 044: Family Design Interface (System Design Mode)
-- Heritage/Price sessions + Blueprint + Sandbox + Vision Board
-- Arc position: LACE → Armor → Heritage/Price → System Design → Firmware → Field Testing

-- Heritage/Price sessions (dependency for blueprints)
CREATE TABLE IF NOT EXISTS heritage_price_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),

  -- Which dimensions carry the highest cost
  high_cost_dimensions JSONB NOT NULL DEFAULT '[]',
  -- Format: [{ dimension: "physical", armor: "The Override", action: "deprecate", cost_score: 8 }]

  -- Per-dimension actions: maintain (keep), modify (adjust), deprecate (remove)
  dimension_actions JSONB NOT NULL DEFAULT '{}',
  -- Format: { "physical": "deprecate", "emotional": "modify", ... }

  -- Generational responses per dimension
  generational_responses JSONB DEFAULT '{}',
  -- Format: { "physical": { elder: "text", parent: "text", child: "text" } }

  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family blueprints (Mode 1: Imagine)
CREATE TABLE IF NOT EXISTS family_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  heritage_price_session_id UUID REFERENCES heritage_price_sessions(id),

  -- Per-dimension blueprint visions
  dimension_blueprints JSONB NOT NULL DEFAULT '{}',
  -- Format: { "physical": { blueprint_statement, child_vision, elder_vision, parent_vision }, ... }

  -- Family code declaration
  family_declaration TEXT,
  -- "We are the [name] family. We carry the strength of [armors]. We are deprecating [patterns].
  --  We are installing [code]. Our children will inherit [vision]."

  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sandbox scenarios (Mode 2: Rehearse)
CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  blueprint_id UUID REFERENCES family_blueprints(id),
  tenant_id UUID REFERENCES tenants(id),

  scenario_type VARCHAR(20) NOT NULL CHECK (scenario_type IN ('replay', 'preview', 'contrast')),
  scenario_title VARCHAR(200),
  scenario_description TEXT,

  -- Which armor and dimension this scenario targets
  target_armor VARCHAR(50),
  target_dimension VARCHAR(20),

  -- Generational role assignments
  role_assignments JSONB DEFAULT '{}',
  -- { elder: "instruction", parent: "instruction", child: "instruction" }

  -- Biometric comparison data
  round_1_biometrics JSONB,  -- old code response
  round_2_biometrics JSONB,  -- new code response (Contrast scenarios only)
  biometric_comparison JSONB, -- { ns3_improvement, coherence_delta, regulation_comparison }

  -- Participant notes
  family_debrief TEXT,

  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vision board components (Mode 3: Manifest)
CREATE TABLE IF NOT EXISTS vision_board_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  blueprint_id UUID REFERENCES family_blueprints(id),
  tenant_id UUID REFERENCES tenants(id),

  component_type VARCHAR(30) NOT NULL CHECK (component_type IN (
    'family_declaration', 'dimension_dashboard', 'milestone_trail', 'family_portrait'
  )),
  content JSONB NOT NULL,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_heritage_price_family ON heritage_price_sessions(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_family ON family_blueprints(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_family ON sandbox_sessions(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_blueprint ON sandbox_sessions(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_vision_family ON vision_board_entries(family_unit_id);

-- Add family_blueprint column to lineage_profiles
ALTER TABLE lineage_profiles ADD COLUMN IF NOT EXISTS family_blueprint JSONB DEFAULT '{}';

-- Extend lineage_entries entry_type CHECK to include new types
ALTER TABLE lineage_entries DROP CONSTRAINT IF EXISTS lineage_entries_entry_type_check;
ALTER TABLE lineage_entries ADD CONSTRAINT lineage_entries_entry_type_check CHECK (entry_type IN (
  'armor_confirmed', 'firmware_installed', 'firmware_completed',
  'field_test_passed', 'crest_versioned', 'family_code_named',
  'quilting_completed', 'heritage_mapped',
  'blueprint_created', 'sandbox_completed', 'heritage_price_completed'
));

-- Seed preset scenarios (15 covering most common armor × dimension combinations)
CREATE TABLE IF NOT EXISTS preset_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type VARCHAR(20) NOT NULL CHECK (scenario_type IN ('replay', 'preview', 'contrast')),
  target_armor VARCHAR(50) NOT NULL,
  target_dimension VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO preset_scenarios (scenario_type, target_armor, target_dimension, title, description) VALUES
-- Replay scenarios (redo a real past event with new code)
('replay', 'The Ghost', 'relational', 'The Empty Chair',
 'Remember when someone was missing from an important family event and no one talked about it? That was The Ghost''s code running — normalize absence, don''t acknowledge the hole. Let''s replay that moment. Someone is missing. What does the new code do instead?'),

('replay', 'The Chameleon', 'emotional', 'The Mood Shift',
 'Remember when someone''s mood changed and everyone instantly adjusted? The Chameleon''s code — scan, adapt, perform. Let''s go back to that dinner table. The mood shifts. Instead of shape-shifting, what happens when everyone stays themselves?'),

('replay', 'The Hoarder', 'financial', 'The Unexpected Bill',
 'Remember when money got tight and the old code activated — hiding bills, pretending everything was fine, hoarding what was left? Let''s replay that moment. The bill arrives. What does the family do with the new code running?'),

('replay', 'The Override', 'physical', 'The Sick Day',
 'Remember when someone was hurt or sick but kept going? The Override says pain is weakness, rest is failure. Let''s replay that morning. Someone wakes up in pain. What happens when the new code says: rest is repair?'),

('replay', 'The Atlas', 'relational', 'The Ask for Help',
 'Remember when someone needed help but carried it alone? The Atlas code: my weight, my responsibility. Let''s go back. The weight is real. What happens when someone actually asks — and someone else actually carries?'),

-- Preview scenarios (practice a future event)
('preview', 'The Sentinel', 'communal', 'The Knock at the Door',
 'It''s 10 PM. Unexpected knock. The Sentinel activates — threat scan, position check, voice drops. What does the new code do? How does the family respond when the old code says "danger" but the new code says "just a neighbor"?'),

('preview', 'The Fortress', 'relational', 'The New Neighbor',
 'A new family moves in next door. They bring food, want to connect. The Fortress code says: strangers are threats, keep the walls up. Preview: what happens when the family runs the updated code instead?'),

('preview', 'The Spender', 'financial', 'The Tax Return',
 'The refund arrives. $3,200 in the account. The Spender code activates: spend before it disappears, treat everyone, abundance is temporary. Preview: what does the family do when the new code says resources can grow?'),

('preview', 'The Refuser', 'spiritual', 'The Invitation',
 'Someone invites the family to a community gathering — church, mosque, temple, ceremony. The Refuser code: all authority is corrupt, all institutions betray. Preview: what does discernment look like when it isn''t refusal?'),

('preview', 'The Nomad', 'communal', 'The Lease Renewal',
 'The lease is up. Time to decide: stay or go. The Nomad code whispers: leaving is safer than staying, roots get pulled up. Preview: what does it feel like to choose to stay — on purpose?'),

-- Contrast scenarios (old code vs new code, biometric comparison)
('contrast', 'The Atlas', 'vocational', 'The Weekend',
 'Saturday morning. No obligations. Round 1: The Atlas code runs — someone finds work to do, feels guilty resting, takes on everyone else''s tasks. Round 2: The updated code runs — rest happens without guilt, tasks are shared, worth isn''t measured by output.'),

('contrast', 'The Scanner', 'communal', 'The Family Gathering',
 'A big family event. 20+ people. Round 1: The Scanner code runs — every entrance mapped, every mood catalogued, every potential conflict calculated before anyone speaks. Round 2: New code — walk in, breathe, trust the room. Notice the difference in the body.'),

('contrast', 'The Ghost', 'emotional', 'The Confrontation',
 'Someone says something hurtful at dinner. Round 1: The Ghost code runs — go quiet, leave the room, pretend it didn''t happen, eat alone later. Round 2: New code — stay in the room, name the feeling, stay visible. Watch what changes.'),

('contrast', 'The Fortress', 'emotional', 'The Apology',
 'Someone genuinely apologizes. Round 1: The Fortress code — reject it, test their motives, wait for the betrayal behind the words. Round 2: New code — receive it. Let the words land. Feel what happens when the wall has a door.'),

('contrast', 'The Doubter', 'relational', 'The Compliment',
 'Someone offers genuine praise. Round 1: The Doubter code — deflect, minimize, search for the hidden agenda, distrust the kindness. Round 2: New code — receive it. Say thank you. Let trust in without the interrogation.')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_preset_armor ON preset_scenarios(target_armor);
CREATE INDEX IF NOT EXISTS idx_preset_dimension ON preset_scenarios(target_dimension);
