-- Migration 056: TTS Cache Fix
-- Supersedes 043_tts_cache.sql which fails because voice_config column
-- doesn't exist on tenants. This migration:
-- 1. Adds voice_config column to tenants
-- 2. Creates tts_cache table (IF NOT EXISTS — safe if 043 partially ran)
-- 3. Seeds default voice config

-- Step 1: Add voice_config column (missing from original tenants schema)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS voice_config JSONB DEFAULT '{}';

-- Step 2: Create tts_cache table
CREATE TABLE IF NOT EXISTS tts_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(128) NOT NULL UNIQUE,
  tenant_id UUID REFERENCES tenants(id),
  voice_id VARCHAR(50) NOT NULL,
  text_content TEXT NOT NULL,
  phase VARCHAR(30) NOT NULL,
  session_number INTEGER,
  character VARCHAR(10),
  audio_url TEXT,
  audio_duration_ms INTEGER,
  elevenlabs_request_id TEXT,
  generated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tts_cache_key ON tts_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_tts_cache_tenant ON tts_cache(tenant_id, phase);

-- Step 3: Seed ASCEN voice config (env var overrides these empty defaults)
UPDATE tenants SET voice_config = '{
  "luno": {
    "voice_id": "",
    "name": "Luno — Grounded Guide",
    "stability": 0.75,
    "similarity_boost": 0.8,
    "style": 0.3,
    "speaking_rate": 0.9
  },
  "luna": {
    "voice_id": "",
    "name": "Luna — Warm Healer",
    "stability": 0.7,
    "similarity_boost": 0.85,
    "style": 0.4,
    "speaking_rate": 0.85
  }
}'::jsonb
WHERE slug = 'ascen' AND (voice_config IS NULL OR voice_config = '{}'::jsonb);

-- Mark 043 as applied so it stops retrying
INSERT INTO schema_migrations (filename) VALUES ('043_tts_cache.sql') ON CONFLICT DO NOTHING;
