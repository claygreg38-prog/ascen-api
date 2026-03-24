-- Migration 036: Notification Queue
-- Stores all email/SMS deliveries for retry + facilitator visibility

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms')),
  recipient TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  template_name VARCHAR(50),
  template_data JSONB,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending ON notification_queue(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_notification_queue_failed ON notification_queue(status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient ON notification_queue(recipient, created_at DESC);
