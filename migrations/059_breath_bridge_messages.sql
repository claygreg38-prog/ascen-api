-- Migration 059: Breath Bridge Messages

CREATE TABLE IF NOT EXISTS breath_bridge_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  direction VARCHAR(30) NOT NULL CHECK (direction IN ('parent_to_child', 'child_to_parent_summary')),
  channel VARCHAR(20) NOT NULL DEFAULT 'message' CHECK (channel IN ('message', 'visual', 'lightbridge')),
  content TEXT NOT NULL,
  library_entry_id VARCHAR(50),
  age_bracket VARCHAR(20) NOT NULL CHECK (age_bracket IN ('elementary', 'middle_school', 'high_school')),
  triggered_by_session_id UUID,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'scheduled', 'delivered', 'viewed', 'expired', 'held')),
  held_reason VARCHAR(50),
  clinician_previewed BOOLEAN NOT NULL DEFAULT false,
  clinician_paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bb_messages_family ON breath_bridge_messages(family_id);
CREATE INDEX IF NOT EXISTS idx_bb_messages_status ON breath_bridge_messages(delivery_status);
CREATE INDEX IF NOT EXISTS idx_bb_messages_scheduled ON breath_bridge_messages(scheduled_for) WHERE delivery_status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_bb_messages_family_direction ON breath_bridge_messages(family_id, direction);
