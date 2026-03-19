-- ============================================================
-- Migration 024: Guided Bridge Premium Tables
-- Session 19 — Facilitated messaging, conflict resolution,
-- therapeutic letters, therapy reports, clinical disclosures,
-- advanced vault extensions, story arcs, premium tier
-- ============================================================

-- Premium tier on family_units
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS premium_tier VARCHAR(20) DEFAULT 'base'
  CHECK (premium_tier IN ('base', 'guided_bridge', 'family_compass'));

-- Facilitated messages (two-way AI-coached messaging)
CREATE TABLE IF NOT EXISTS facilitated_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(id),
  tenant_id UUID REFERENCES tenants(id),
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('parent', 'child', 'partner', 'coparent')),
  sender_id INTEGER REFERENCES users(id),
  recipient_type VARCHAR(10) NOT NULL,
  recipient_id INTEGER REFERENCES users(id),
  original_text TEXT NOT NULL CHECK (char_length(original_text) <= 2000),
  facilitator_decision VARCHAR(10) CHECK (facilitator_decision IN ('approve', 'coach', 'flag')),
  coaching_text TEXT,
  reframe_suggestion TEXT,
  facilitator_reasoning TEXT,
  facilitator_confidence FLOAT,
  disclosure_classification VARCHAR(30) CHECK (disclosure_classification IN (
    NULL, 'self_harm', 'abuse_third_party', 'abuse_recipient'
  )),
  disclosure_routed_to TEXT[],
  sender_accepted_coaching BOOLEAN,
  final_text TEXT NOT NULL,
  recipient_coaching TEXT,
  channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('parent_child', 'partner', 'coparent')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  is_premium BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conflict events
CREATE TABLE IF NOT EXISTS conflict_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(id),
  tenant_id UUID REFERENCES tenants(id),
  channel_type VARCHAR(20),
  trigger_message_id UUID REFERENCES facilitated_messages(id),
  escalation_score FLOAT,
  pause_offered_at TIMESTAMPTZ,
  party_a_id INTEGER REFERENCES users(id),
  party_a_response VARCHAR(10) CHECK (party_a_response IN ('pause', 'continue', 'no_response')),
  party_b_id INTEGER REFERENCES users(id),
  party_b_response VARCHAR(10) CHECK (party_b_response IN ('pause', 'continue', 'no_response')),
  breathing_session_completed BOOLEAN DEFAULT false,
  breathing_session_id UUID REFERENCES cobreath_sessions(id),
  repair_framework_offered BOOLEAN DEFAULT false,
  resolution_outcome VARCHAR(30) CHECK (resolution_outcome IN (
    'resolved', 'de_escalated', 'referred_to_therapist', 'channel_paused', 'ongoing'
  )),
  clinical_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Therapeutic letters
CREATE TABLE IF NOT EXISTS therapeutic_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id INTEGER REFERENCES users(id),
  family_unit_id UUID REFERENCES family_units(id),
  tenant_id UUID REFERENCES tenants(id),
  recipient_type VARCHAR(10),
  recipient_id INTEGER REFERENCES users(id),
  draft_text TEXT,
  draft_count INTEGER DEFAULT 1,
  facilitator_feedback JSONB,
  final_text TEXT,
  is_finalized BOOLEAN DEFAULT false,
  finalized_at TIMESTAMPTZ,
  delivery_method VARCHAR(20) CHECK (delivery_method IN ('channel', 'vault', 'print', 'therapist')),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  vault_capsule_id UUID REFERENCES legacy_capsules(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Therapy prep reports
CREATE TABLE IF NOT EXISTS therapy_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(id),
  tenant_id UUID REFERENCES tenants(id),
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  report_type VARCHAR(10) DEFAULT 'weekly' CHECK (report_type IN ('weekly', 'monthly')),
  report_data JSONB NOT NULL,
  consent_channels JSONB NOT NULL DEFAULT '{"parent_child": true, "partner": true, "coparent": true}',
  consent_given_by INTEGER REFERENCES users(id),
  consent_given_at TIMESTAMPTZ,
  therapist_email VARCHAR(255),
  legal_disclaimer_version INTEGER DEFAULT 1,
  report_hash VARCHAR(64),
  sent_to_therapist_at TIMESTAMPTZ,
  previewed_by_family BOOLEAN DEFAULT false,
  previewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Therapy report consent audit trail (Review Finding #5)
CREATE TABLE IF NOT EXISTS therapy_consent_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES therapy_reports(id),
  consenter_id INTEGER REFERENCES users(id),
  channels_consented JSONB,
  action VARCHAR(20) CHECK (action IN ('consent_given', 'consent_revoked', 'preview_requested', 'report_sent')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clinical disclosure queue (Review Finding #1 — CRITICAL)
CREATE TABLE IF NOT EXISTS clinical_disclosures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES facilitated_messages(id),
  family_unit_id UUID REFERENCES family_units(id),
  tenant_id UUID REFERENCES tenants(id),
  disclosure_type VARCHAR(30) NOT NULL CHECK (disclosure_type IN ('self_harm', 'abuse_third_party', 'abuse_recipient')),
  original_text TEXT NOT NULL,
  sender_id INTEGER REFERENCES users(id),
  alleged_recipient_id INTEGER,
  clinical_team_notified_at TIMESTAMPTZ,
  caregiver_notified_at TIMESTAMPTZ,
  mandatory_reporting_flag BOOLEAN DEFAULT false,
  reviewing_clinician_id INTEGER,
  review_status VARCHAR(20) DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewing', 'reported', 'resolved', 'false_positive')),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advanced vault extensions (video capsules, story arcs)
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS capsule_type VARCHAR(20) DEFAULT 'standard'
  CHECK (capsule_type IN ('standard', 'video', 'story_arc', 'collaborative', 'time_locked'));
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS video_ipfs_hash TEXT;
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS video_review_status VARCHAR(20) DEFAULT 'not_applicable'
  CHECK (video_review_status IN ('not_applicable', 'pending_review', 'approved', 'rejected', 're_record_requested'));
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS story_arc_id UUID;
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS time_lock_date TIMESTAMPTZ;
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS time_lock_occasion VARCHAR(100);

-- Story arcs
CREATE TABLE IF NOT EXISTS story_arcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id INTEGER REFERENCES users(id),
  family_unit_id UUID REFERENCES family_units(id),
  tenant_id UUID REFERENCES tenants(id),
  title VARCHAR(200),
  description TEXT,
  total_chapters INTEGER DEFAULT 1 CHECK (total_chapters <= 10),
  capsule_ids UUID[],
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facilitated_messages_family ON facilitated_messages(family_unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facilitated_messages_sender ON facilitated_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facilitated_messages_channel ON facilitated_messages(channel_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facilitated_messages_disclosure ON facilitated_messages(disclosure_classification) WHERE disclosure_classification IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conflict_events_family ON conflict_events(family_unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_therapeutic_letters_author ON therapeutic_letters(author_id);
CREATE INDEX IF NOT EXISTS idx_therapy_reports_family ON therapy_reports(family_unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_disclosures_pending ON clinical_disclosures(review_status) WHERE review_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_story_arcs_creator ON story_arcs(creator_id);
