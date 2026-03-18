-- Migration 015: Co-Creation Canvas + Social Gallery (Breath Art Showcase)
-- Session 10 deliverables

-- Personalized art (co-creation canvas saves)
-- Note: users.id and session_completions.id are INTEGER in this DB
CREATE TABLE IF NOT EXISTS personalized_art (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_completion_id INTEGER REFERENCES session_completions(id),
  participant_id INTEGER REFERENCES users(id),
  original_token_id VARCHAR(100),
  personalized_ipfs_hash TEXT,
  canvas_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social gallery posts
CREATE TABLE IF NOT EXISTS showcase_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id INTEGER REFERENCES users(id),
  personalized_art_id UUID REFERENCES personalized_art(id),
  caption TEXT CHECK (char_length(caption) <= 140),
  session_number INTEGER,
  arc_name VARCHAR(100),
  is_milestone BOOLEAN DEFAULT false,
  is_family_piece BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Social likes (one like per user per post)
CREATE TABLE IF NOT EXISTS showcase_likes (
  post_id UUID REFERENCES showcase_posts(id),
  participant_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, participant_id)
);

-- Content moderation reports
CREATE TABLE IF NOT EXISTS showcase_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES showcase_posts(id),
  reporter_id INTEGER REFERENCES users(id),
  reason TEXT,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_personalized_art_participant ON personalized_art(participant_id);
CREATE INDEX IF NOT EXISTS idx_showcase_posts_active ON showcase_posts(created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_showcase_posts_milestones ON showcase_posts(created_at DESC) WHERE is_milestone = true;
