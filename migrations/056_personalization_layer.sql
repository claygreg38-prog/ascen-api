-- Migration 056: User Art Personalization Layer
-- Stage 3 of art pipeline: non-destructive compositing on top of harmonics output.

-- User art personalization settings (per session)
CREATE TABLE IF NOT EXISTS art_personalizations (
  id SERIAL PRIMARY KEY,
  session_completion_id INTEGER REFERENCES session_completions(id) NOT NULL,
  user_id INTEGER REFERENCES users(id) NOT NULL,

  -- Personalization settings
  hue_shift INTEGER DEFAULT 0 CHECK (hue_shift >= -180 AND hue_shift <= 180),
  saturation_adjust DECIMAL(3,2) DEFAULT 1.0 CHECK (saturation_adjust >= 0.0 AND saturation_adjust <= 2.0),
  brightness_adjust DECIMAL(3,2) DEFAULT 1.0 CHECK (brightness_adjust >= 0.5 AND brightness_adjust <= 1.5),

  filter_preset VARCHAR(30) CHECK (filter_preset IN (
    'none', 'warm', 'cool', 'midnight', 'golden', 'muted', 'vivid', 'sepia', 'frost'
  )),

  frame_override VARCHAR(30) CHECK (frame_override IN (
    'none', 'seed_of_life', 'flower_of_life', 'metatrons_cube', 'sri_yantra',
    'minimal', 'double_ring', 'organic'
  )),

  overlay_texture VARCHAR(30) CHECK (overlay_texture IN (
    'none', 'linen', 'grain', 'watercolor', 'silk', 'stone', 'paper'
  )),

  container_override VARCHAR(20) CHECK (container_override IN (
    'square', 'circle', 'oval', 'triangle', 'hexagon', 'diamond'
  )),

  -- Composite result
  personalized_png_hash TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Allows upsert per session per user; also allows different
  -- family members to personalize the same session independently.
  CONSTRAINT unique_personalization UNIQUE (session_completion_id, user_id)
);

-- User default preferences (applied to new art automatically)
CREATE TABLE IF NOT EXISTS art_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL UNIQUE,

  default_hue_shift INTEGER DEFAULT 0,
  default_saturation DECIMAL(3,2) DEFAULT 1.0,
  default_brightness DECIMAL(3,2) DEFAULT 1.0,
  default_filter VARCHAR(30) DEFAULT 'none',
  default_frame VARCHAR(30),
  default_overlay VARCHAR(30) DEFAULT 'none',
  default_container VARCHAR(20),

  auto_apply BOOLEAN DEFAULT false,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personalization_session ON art_personalizations(session_completion_id);
CREATE INDEX IF NOT EXISTS idx_personalization_user ON art_personalizations(user_id);
CREATE INDEX IF NOT EXISTS idx_art_prefs_user ON art_preferences(user_id);
