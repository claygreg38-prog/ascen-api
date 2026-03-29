-- Migration 065: Engagement Events — persist to DB (was in-memory Map)
-- Survives Railway redeploys and supports horizontal scaling.

CREATE TABLE IF NOT EXISTS engagement_events (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(40) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  event_type VARCHAR(30) NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_session ON engagement_events(session_id);
CREATE INDEX IF NOT EXISTS idx_engagement_user ON engagement_events(user_id);
