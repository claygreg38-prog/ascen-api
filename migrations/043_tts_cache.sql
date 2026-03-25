-- Migration 043: TTS Cache
-- ElevenLabs text-to-speech audio cache per tenant/voice/phase

CREATE TABLE IF NOT EXISTS tts_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(128) NOT NULL UNIQUE,
  tenant_id UUID REFERENCES tenants(id),
  voice_id VARCHAR(50) NOT NULL,
  text_content TEXT NOT NULL,
  phase VARCHAR(30) NOT NULL CHECK (phase IN ('arrival', 'descent_word', 'breathing_milestone', 'closing', 'somatic_instruction')),
  session_number INTEGER,
  character VARCHAR(10) CHECK (character IN ('luno', 'luna')),
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

-- Seed ASCEN Direct voice config (voice_id values set after ElevenLabs setup)
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
WHERE slug = 'ascen';
