-- Migration 020: LightBridge IoT Phase 1
-- Session 15: Device registry, event log

-- LightBridge devices
CREATE TABLE IF NOT EXISTS lightbridge_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  tenant_id UUID REFERENCES tenants(id),
  device_provider VARCHAR(20) DEFAULT 'lifx' CHECK (device_provider IN ('lifx', 'hue', 'custom')),
  device_token TEXT NOT NULL,
  device_selector VARCHAR(255),
  device_name VARCHAR(100),
  current_state JSONB DEFAULT '{"power": "off", "color": null, "brightness": 0}',
  is_active BOOLEAN DEFAULT true,
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LightBridge event log
CREATE TABLE IF NOT EXISTS lightbridge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES lightbridge_devices(id),
  user_id INTEGER REFERENCES users(id),
  family_unit_id UUID REFERENCES family_units(family_unit_id),
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
    'capacity_state', 'session_complete', 'co_breath_active',
    'member_joined', 'gate_unlocked', 'savings_milestone',
    'family_milestone', 'celebration', 'test_pattern'
  )),
  event_data JSONB,
  command_sent JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lightbridge_devices_user ON lightbridge_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_lightbridge_devices_family ON lightbridge_devices(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_lightbridge_events_device ON lightbridge_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lightbridge_events_family ON lightbridge_events(family_unit_id, created_at DESC);
