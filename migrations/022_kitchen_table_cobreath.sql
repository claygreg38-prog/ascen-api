-- Migration 022: Kitchen Table + Co-Breath Sessions
-- Session 17: Topic library, session tracking, co-breath rooms

-- Kitchen Table topic library
CREATE TABLE IF NOT EXISTS kitchen_table_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  curriculum_namespace VARCHAR(100) DEFAULT 'ascen',
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  prompt_text TEXT NOT NULL,
  journal_prompt TEXT,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  min_capacity_state VARCHAR(20) DEFAULT 'steady',
  age_appropriate_min INTEGER DEFAULT 0,
  estimated_minutes INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kitchen Table session records
CREATE TABLE IF NOT EXISTS kitchen_table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),
  topic_id UUID REFERENCES kitchen_table_topics(id),
  hrv_at_start DECIMAL(8,2),
  hrv_at_end DECIMAL(8,2),
  hrv_min_during DECIMAL(8,2),
  dysregulation_detected BOOLEAN DEFAULT false,
  dysregulation_timestamp TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  skipped BOOLEAN DEFAULT false,
  skip_reason VARCHAR(50),
  journal_encrypted TEXT,
  transitioned_to_breath BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Co-breath sessions
CREATE TABLE IF NOT EXISTS cobreath_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(family_unit_id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  initiator_id INTEGER REFERENCES users(id) NOT NULL,
  partner_id INTEGER REFERENCES users(id) NOT NULL,
  session_mode VARCHAR(20) NOT NULL CHECK (session_mode IN ('sync', 'adaptive', 'silent')),
  sync_ratio VARCHAR(10),
  initiator_ratio VARCHAR(10),
  partner_ratio VARCHAR(10),
  duration_seconds INTEGER DEFAULT 120,
  initiator_hrv_start DECIMAL(8,2),
  initiator_hrv_end DECIMAL(8,2),
  partner_hrv_start DECIMAL(8,2),
  partner_hrv_end DECIMAL(8,2),
  hrv_correlation DECIMAL(5,4),
  synchronization_pct DECIMAL(5,2),
  mutual_regulation_success BOOLEAN DEFAULT false,
  connection_score DECIMAL(5,2),
  is_investment BOOLEAN DEFAULT false,
  investment_id UUID,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'waiting', 'connecting', 'in_progress', 'completed', 'missed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  co_art_ipfs_hash TEXT,
  co_art_token_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Co-breath WebSocket rooms
CREATE TABLE IF NOT EXISTS cobreath_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobreath_session_id UUID REFERENCES cobreath_sessions(id) UNIQUE,
  room_code VARCHAR(10) UNIQUE NOT NULL,
  initiator_connected BOOLEAN DEFAULT false,
  partner_connected BOOLEAN DEFAULT false,
  state VARCHAR(20) DEFAULT 'waiting' CHECK (state IN ('waiting', 'countdown', 'breathing', 'complete', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kt_topics_tenant ON kitchen_table_topics(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_kt_topics_difficulty ON kitchen_table_topics(difficulty_level, min_capacity_state);
CREATE INDEX IF NOT EXISTS idx_kt_sessions_user ON kitchen_table_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kt_sessions_topic ON kitchen_table_sessions(topic_id);
CREATE INDEX IF NOT EXISTS idx_cobreath_sessions_family ON cobreath_sessions(family_unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cobreath_sessions_initiator ON cobreath_sessions(initiator_id);
CREATE INDEX IF NOT EXISTS idx_cobreath_sessions_partner ON cobreath_sessions(partner_id);
CREATE INDEX IF NOT EXISTS idx_cobreath_rooms_code ON cobreath_rooms(room_code) WHERE state != 'expired';

-- ═══════════════════════════════════════════════════════════════
-- SEED 30 KITCHEN TABLE TOPICS (ASCEN tenant)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO kitchen_table_topics (curriculum_namespace, category, title, prompt_text, journal_prompt, difficulty_level, min_capacity_state, estimated_minutes) VALUES
-- Family History (difficulty 1-3)
('ascen', 'family_history', 'Traditions', 'What''s one tradition from your family that you want to keep? What''s one you want to change?', 'Write about a tradition that shaped you.', 1, 'steady', 10),
('ascen', 'family_history', 'Safety', 'Describe a moment when you felt truly safe as a child. What made it feel safe?', 'What does safety feel like in your body now?', 2, 'steady', 10),
('ascen', 'family_history', 'Asking for Help', 'What did your family teach you about asking for help?', 'How has that teaching served you? How has it held you back?', 2, 'steady', 10),
('ascen', 'family_history', 'Patterns', 'What pattern from your parents do you see in yourself? How do you feel about it?', 'Which pattern do you want to break? Which do you want to keep?', 3, 'steady', 12),
('ascen', 'family_history', 'Letter to Yourself', 'What would you tell your younger self about the family you grew up in?', 'Write that letter.', 3, 'full', 15),
-- Communication (difficulty 1-2)
('ascen', 'communication', 'Good Listening', 'Think of someone who listened to you well. What did they do differently?', 'What would change if you listened that way?', 1, 'steady', 8),
('ascen', 'communication', 'Hard to Say', 'When do you find it hardest to say what you mean? What gets in the way?', 'Practice saying one hard thing here.', 2, 'steady', 10),
('ascen', 'communication', 'I''m Fine', 'What does "I''m fine" usually mean when you say it?', 'What would you say instead if you felt safe enough?', 1, 'steady', 8),
('ascen', 'communication', 'Really Listening', 'How do you show someone you''re really listening?', 'Who needs you to listen right now?', 1, 'drawing_down', 8),
('ascen', 'communication', 'Unasked Questions', 'What''s something you wish someone would ask you?', 'Why do you think no one has asked?', 2, 'steady', 10),
-- Boundaries (difficulty 2-3)
('ascen', 'boundaries', 'Body Signals', 'What does a healthy boundary feel like in your body? What does a violated one feel like?', 'Name one boundary your body is asking for right now.', 2, 'steady', 10),
('ascen', 'boundaries', 'Saying No', 'When is it hardest to say no? What happens when you do?', 'Practice a no that you need to give.', 3, 'steady', 10),
('ascen', 'boundaries', 'Protection vs. Walls', 'What''s the difference between protecting yourself and pushing people away?', 'Where are you right now on that spectrum?', 3, 'full', 12),
('ascen', 'boundaries', 'Respect', 'Who in your life respects your boundaries best? What do they do?', 'What can you learn from how they show up?', 2, 'steady', 8),
('ascen', 'boundaries', 'Needed Boundary', 'What boundary do you need right now that you haven''t set?', 'What''s the first step to setting it?', 3, 'full', 10),
-- Accountability (difficulty 2-4)
('ascen', 'accountability', 'Apology vs. Accountability', 'What''s the difference between an apology and accountability?', 'Which one do you owe someone?', 2, 'steady', 10),
('ascen', 'accountability', 'Real Repair', 'Think of a time you hurt someone. What would real repair look like?', 'What step can you take this week?', 3, 'steady', 12),
('ascen', 'accountability', 'Being Wrong', 'What makes it hard to admit when you''re wrong?', 'What would change if you could?', 3, 'steady', 10),
('ascen', 'accountability', 'Models', 'Who has modeled accountability for you? What did they do?', 'How can you model that for someone else?', 2, 'drawing_down', 10),
('ascen', 'accountability', 'Legacy Lessons', 'What would you want your child to learn from your mistakes?', 'Write the lesson you want to pass on.', 4, 'full', 15),
-- Trust (difficulty 3-5)
('ascen', 'trust', 'Body of Trust', 'What does trust feel like in your body when it''s present? When it''s broken?', 'Where in your body do you hold broken trust?', 3, 'steady', 10),
('ascen', 'trust', 'Smallest Step', 'What''s the smallest step toward rebuilding trust with someone?', 'Can you take that step this week?', 3, 'steady', 10),
('ascen', 'trust', 'Earned Back', 'How do you know when someone has earned your trust back?', 'What signals does your body give you?', 4, 'full', 12),
('ascen', 'trust', 'Future Self', 'What are you doing right now that your future self will trust you for?', 'What promise are you keeping?', 3, 'steady', 8),
('ascen', 'trust', 'Kept Promises', 'What promise to yourself have you kept recently?', 'How did keeping it change how you see yourself?', 3, 'steady', 8),
-- Hope (difficulty 1-2)
('ascen', 'hope', 'Looking Forward', 'What''s one thing you''re looking forward to?', 'Why does it matter to you?', 1, 'drawing_down', 5),
('ascen', 'hope', 'Okay Moment', 'What moment this week made you feel like things might be okay?', 'Hold onto that feeling.', 1, 'drawing_down', 5),
('ascen', 'hope', 'The Middle', 'What does healing look like to you — not the end, but the middle?', 'Where are you in the middle right now?', 2, 'steady', 10),
('ascen', 'hope', 'Believers', 'Who believes in you? How do you know?', 'What would you say to thank them?', 1, 'drawing_down', 8),
('ascen', 'hope', 'Good from Hard', 'What''s something good that came from something hard?', 'What strength did that build in you?', 2, 'steady', 10)
ON CONFLICT DO NOTHING;
