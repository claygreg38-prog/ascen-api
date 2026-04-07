-- ══════════════════════════════════════════════════════════════
-- Migration 076: Ripple Signal
-- "They showed up today." — one quiet ping per day to a supporter.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ripple_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  last_sent_at TIMESTAMP,
  send_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ripple_user ON ripple_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_ripple_recipient ON ripple_signals(recipient_phone);
