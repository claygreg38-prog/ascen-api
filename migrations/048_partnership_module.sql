-- Migration 048: Partnership Module — Couples/Intimate Partner Co-Regulation
-- Two nervous systems learning to co-regulate. The system reads the dyad.

-- Partnership enrollment
CREATE TABLE IF NOT EXISTS partnership_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_a_id INTEGER REFERENCES users(id) NOT NULL,
  partner_b_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'dissolved')),

  -- Enrollment requirements
  partner_a_sessions INTEGER DEFAULT 0,
  partner_b_sessions INTEGER DEFAULT 0,
  enrollment_eligible BOOLEAN DEFAULT false,
  -- Both partners need 5+ solo sessions before partnership work

  -- Dyadic baseline (captured during first co-breath)
  dyadic_baseline JSONB DEFAULT '{}',
  -- { correlation_score, sync_quality, individual_baselines: { a: {...}, b: {...} } }

  -- Relationship Account
  account_balance DECIMAL(6,2) DEFAULT 30.00,
  -- Starts at 30 (must earn into high-sensitivity topics). Ranges 0-100.
  -- Deposits: successful co-breaths, completed exercises, repair protocols
  -- Withdrawals: detected conflict patterns, missed sessions, unresolved ruptures

  account_history JSONB DEFAULT '[]',

  enrolled_at TIMESTAMPTZ,
  last_session_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fix #4: Order-independent unique constraint. enroll() canonicalizes LEAST as partner_a.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partnership_unique
  ON partnership_practices (LEAST(partner_a_id, partner_b_id), GREATEST(partner_a_id, partner_b_id));

-- Partnership sessions (extends session_completions)
CREATE TABLE IF NOT EXISTS partnership_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID REFERENCES partnership_practices(id) NOT NULL,
  session_completion_id INTEGER REFERENCES session_completions(id),
  session_type VARCHAR(30) NOT NULL CHECK (session_type IN (
    'co_breath', 'kitchen_table', 'heritage_price', 'firmware', 'repair'
  )),

  -- Dyadic biometric data
  partner_a_biometrics JSONB DEFAULT '{}',
  partner_b_biometrics JSONB DEFAULT '{}',
  dyadic_metrics JSONB DEFAULT '{}',
  -- { correlation, sync_quality, attunement_score, conflict_patterns: [] }

  -- Pattern detection results
  detected_patterns JSONB DEFAULT '[]',
  -- [{ pattern, timestamp, partner_role, intervention }]

  -- Repair tracking
  repair_needed BOOLEAN DEFAULT false,
  repair_completed BOOLEAN DEFAULT false,
  repair_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partnership-specific kitchen table topics
CREATE TABLE IF NOT EXISTS partnership_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  partner_a_prompt TEXT,
  partner_b_prompt TEXT,
  sensitivity_level VARCHAR(10) DEFAULT 'medium' CHECK (sensitivity_level IN ('high', 'medium', 'low')),
  min_account_balance DECIMAL(6,2) DEFAULT 30.0,
  -- High sensitivity topics only available when relationship account is above threshold
  min_age INTEGER DEFAULT 18,
  -- Partnership work is adult-only; gate exists for consistency with age-gated content system
  prerequisite_topic_id UUID REFERENCES partnership_topics(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partnership_partners ON partnership_practices(partner_a_id, partner_b_id);
CREATE INDEX IF NOT EXISTS idx_partnership_status ON partnership_practices(status);
CREATE INDEX IF NOT EXISTS idx_partnership_sessions ON partnership_sessions(partnership_id);
CREATE INDEX IF NOT EXISTS idx_partnership_topics_cat ON partnership_topics(category);

-- ═══════════════════════════════════════════════════════════════
-- SEED: 20 Partnership Topics across 5 categories
-- ═══════════════════════════════════════════════════════════════

INSERT INTO partnership_topics (category, title, partner_a_prompt, partner_b_prompt, sensitivity_level, min_account_balance, sort_order) VALUES
-- CONNECTION (4 topics, low sensitivity, balance >= 20)
('connection', 'The First Memory',
 'Tell your partner the first moment you knew they mattered to you.',
 'Listen without responding until they finish. Then share yours.',
 'low', 20.0, 1),
('connection', 'The Language',
 'How does your partner show you they care? Is it the way you need to receive it?',
 'Same question. Be specific — not "I feel loved" but "When you [action], my body relaxes."',
 'low', 20.0, 2),
('connection', 'The Safe Place',
 'Describe a moment with your partner when your body felt completely safe. What made it that way?',
 'Same question. Focus on the physical — where did you feel the safety?',
 'low', 20.0, 3),
('connection', 'The Rhythm',
 'When do you and your partner sync naturally? Morning, evening, activity, stillness?',
 'Same question. When do you feel most in rhythm with each other?',
 'low', 20.0, 4),

-- INHERITED PATTERNS (4 topics, medium sensitivity, balance >= 40)
('inherited_patterns', 'The Model',
 'What did your parents'' relationship teach you about conflict? What code are you still running?',
 'Same question. Then: do you see their patterns in ours?',
 'medium', 40.0, 1),
('inherited_patterns', 'The Armor Between Us',
 'Which of your confirmed armors shows up most in this relationship? What does it do?',
 'Same. Then: what does your partner''s armor trigger in yours?',
 'high', 50.0, 2),
('inherited_patterns', 'The Silence Code',
 'In your family growing up, what did silence mean? Safety or danger?',
 'Same question. Then: what does your silence mean to your partner now?',
 'medium', 40.0, 3),
('inherited_patterns', 'The Money Story',
 'What did your family teach you about money and partnership? Who controlled it? Who worried about it?',
 'Same question. Where do those patterns show up between us?',
 'medium', 40.0, 4),

-- REPAIR (4 topics, high sensitivity, balance >= 45)
('repair', 'The Last Rupture',
 'The last time we hurt each other — what happened in your body before the words came out?',
 'Same. Can you describe the body sensation, not the argument?',
 'high', 45.0, 1),
('repair', 'The Pattern We Keep Running',
 'What is the fight we keep having? Not the topic — the pattern. Who reaches? Who retreats?',
 'Same question. Try to describe the dance, not the content.',
 'high', 45.0, 2),
('repair', 'The Thing I Cannot Say',
 'What is one thing you have been afraid to say because of how it might land?',
 'Listen fully. Do not respond until the facilitator prompts you. Then share yours.',
 'high', 45.0, 3),
('repair', 'The Apology',
 'Name one thing you need to apologize for — not because you were wrong, but because it caused pain.',
 'Same. An apology for impact, not intent.',
 'high', 45.0, 4),

-- FUTURE (4 topics, low sensitivity, balance >= 20)
('future', 'The Blueprint',
 'If we could design our relationship from scratch — what stays and what gets deprecated?',
 'Same. Then compare lists. What surprised you?',
 'low', 20.0, 1),
('future', 'The Promise',
 'What is one commitment you want to make to this relationship that you haven''t made yet?',
 'Same question. Be specific — not "be better" but "I will [action]."',
 'low', 20.0, 2),
('future', 'The Version Upgrade',
 'If our relationship is a system — what version are we running? What would the next version look like?',
 'Same question. What would need to change in the code?',
 'low', 20.0, 3),
('future', 'The Legacy',
 'What do you want the children (or future children) to learn from watching our relationship?',
 'Same question. What pattern do we want to pass forward?',
 'low', 20.0, 4),

-- INTIMACY (4 topics, high sensitivity, balance >= 60)
('intimacy', 'Safety and Touch',
 'When does touch feel safe with your partner? When does it not? What is the difference in your body?',
 'Same question. This one is body-first — the body knows before the mind.',
 'high', 60.0, 1),
('intimacy', 'The Ask',
 'What is something you want from your partner that you have never asked for? Why haven''t you asked?',
 'Same question. The ask, and the barrier.',
 'high', 60.0, 2),
('intimacy', 'The Vulnerability',
 'When are you most vulnerable with your partner? When are you most guarded? What shifts between them?',
 'Same question. Describe the transition — what happens in your body when the guard goes up?',
 'high', 60.0, 3),
('intimacy', 'The Need',
 'What does your body need from your partner that words cannot ask for?',
 'Same question. If you could communicate one need through breath alone, what would it be?',
 'high', 60.0, 4);
