-- ============================================================
-- Migration 028: LightBridge Upgrade — Wyze, Music, Config
-- Adds Wyze provider support, ambient music library, family
-- config columns, caregiver visibility per member.
-- ============================================================

-- Music library (curated royalty-free tracks by NS3 state)
CREATE TABLE IF NOT EXISTS lightbridge_music_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  ns3_state TEXT NOT NULL CHECK (ns3_state IN ('optimal', 'approaching', 'below_window', 'overdrive')),
  tempo_bpm INTEGER,
  duration_s INTEGER,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family music preferences per NS3 state
CREATE TABLE IF NOT EXISTS lightbridge_family_music_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID NOT NULL REFERENCES family_units(family_unit_id),
  ns3_state TEXT NOT NULL CHECK (ns3_state IN ('optimal', 'approaching', 'below_window', 'overdrive')),
  track_id UUID REFERENCES lightbridge_music_library(id),
  custom_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_unit_id, ns3_state)
);

-- Expand lightbridge_devices for Wyze + speaker
ALTER TABLE lightbridge_devices ADD COLUMN IF NOT EXISTS wyze_device_id TEXT;
ALTER TABLE lightbridge_devices ADD COLUMN IF NOT EXISTS speaker_endpoint TEXT;
ALTER TABLE lightbridge_devices ADD COLUMN IF NOT EXISTS room VARCHAR(100);
ALTER TABLE lightbridge_devices ADD COLUMN IF NOT EXISTS device_subtype VARCHAR(20) DEFAULT 'light'
  CHECK (device_subtype IN ('light', 'plug', 'speaker'));

-- Update device_provider CHECK to include wyze
ALTER TABLE lightbridge_devices DROP CONSTRAINT IF EXISTS lightbridge_devices_device_provider_check;
ALTER TABLE lightbridge_devices ADD CONSTRAINT lightbridge_devices_device_provider_check
  CHECK (device_provider IN ('lifx', 'hue', 'wyze', 'custom'));

-- LightBridge config on family_units
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS lightbridge_hold_minutes INTEGER DEFAULT 30;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS lightbridge_privacy_mode TEXT DEFAULT 'caregiver_controlled'
  CHECK (lightbridge_privacy_mode IN ('caregiver_controlled', 'individual', 'off'));

-- Caregiver visibility per member
ALTER TABLE family_memberships ADD COLUMN IF NOT EXISTS lightbridge_visible BOOLEAN DEFAULT true;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_music_library_state ON lightbridge_music_library(ns3_state) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_music_prefs_family ON lightbridge_family_music_prefs(family_unit_id);

-- Seed 12 default music tracks (placeholder URLs — replace with real hosted tracks)
INSERT INTO lightbridge_music_library (title, file_url, ns3_state, tempo_bpm, duration_s, is_default) VALUES
('Calm Dawn', '/audio/calm_dawn.mp3', 'optimal', 90, 180, true),
('Gentle Sunrise', '/audio/gentle_sunrise.mp3', 'optimal', 100, 180, false),
('Warm Current', '/audio/warm_current.mp3', 'optimal', 85, 180, false),
('Approaching Light', '/audio/approaching_light.mp3', 'approaching', 72, 180, true),
('Steady Ground', '/audio/steady_ground.mp3', 'approaching', 75, 180, false),
('Amber Tide', '/audio/amber_tide.mp3', 'approaching', 68, 180, false),
('Deep Water', '/audio/deep_water.mp3', 'below_window', 55, 180, true),
('Still Lake', '/audio/still_lake.mp3', 'below_window', 58, 180, false),
('Slow River', '/audio/slow_river.mp3', 'below_window', 52, 180, false),
('Cooling Earth', '/audio/cooling_earth.mp3', 'overdrive', 55, 180, true),
('Grounding Rain', '/audio/grounding_rain.mp3', 'overdrive', 58, 180, false),
('Quiet Stone', '/audio/quiet_stone.mp3', 'overdrive', 52, 180, false)
ON CONFLICT DO NOTHING;
