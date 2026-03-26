-- Migration 047: Age-Gated Content System
-- Children use this system. A 7-year-old must never see adult content.

-- Kitchen table topic age filtering
ALTER TABLE kitchen_table_topics ADD COLUMN IF NOT EXISTS min_age INTEGER DEFAULT 18;
ALTER TABLE kitchen_table_topics ADD COLUMN IF NOT EXISTS sensitivity_level VARCHAR(10) DEFAULT 'high'
  CHECK (sensitivity_level IN ('high', 'medium', 'low'));

-- Update existing topics with age-appropriate minimums
-- Low sensitivity topics: any age
UPDATE kitchen_table_topics SET min_age = 6, sensitivity_level = 'low'
  WHERE category IN ('hope', 'communication') AND min_age = 18;

-- Medium sensitivity: 11+
UPDATE kitchen_table_topics SET min_age = 11, sensitivity_level = 'medium'
  WHERE category IN ('trust', 'boundaries') AND min_age = 18;

-- High sensitivity: 14+ or 18+
UPDATE kitchen_table_topics SET min_age = 14, sensitivity_level = 'high'
  WHERE category IN ('accountability') AND min_age = 18;

UPDATE kitchen_table_topics SET min_age = 18, sensitivity_level = 'high'
  WHERE category IN ('family_history') AND min_age = 18;

-- Firmware age minimums (most firmware is 14+, Cache Clearing is universal)
ALTER TABLE firmware_templates ADD COLUMN IF NOT EXISTS min_age INTEGER DEFAULT 14;
UPDATE firmware_templates SET min_age = 6 WHERE firmware_number = 1;  -- Cache Clearing: all ages
UPDATE firmware_templates SET min_age = 11 WHERE firmware_number IN (3, 6);  -- Baseline Reboot, Trust Protocol
UPDATE firmware_templates SET min_age = 14 WHERE firmware_number IN (2, 4, 5, 7, 8, 9);  -- Rest: teens+

-- Content format variants per age bracket
CREATE TABLE IF NOT EXISTS content_age_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table VARCHAR(50) NOT NULL,
  source_id UUID NOT NULL,
  age_bracket VARCHAR(20) NOT NULL CHECK (age_bracket IN ('elementary', 'middle_school', 'high_school', 'adult')),
  variant_content JSONB NOT NULL,
  -- For session templates: { luno_arrival, luno_close, vault_prompt, duration_minutes }
  -- For kitchen table: { discussion_prompts, format: 'drawing' | 'writing' | 'speaking' }
  -- For firmware: { field_test_prompts, somatic_exercises }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_age_variant ON content_age_variants(source_table, source_id, age_bracket);
