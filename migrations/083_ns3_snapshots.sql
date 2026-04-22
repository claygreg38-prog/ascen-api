-- Migration 083 — NS3 per-window snapshots
-- Part of Option E refactor: NS3 computed every tick, persisted as
-- 5-tick mean aggregates. Session-end row still lives in
-- session_completions (ns3_mean/ns3_peak/ns3_floor/...). This table
-- captures the intra-session trajectory for audit and trace analysis.

CREATE TABLE IF NOT EXISTS ns3_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  tick_count INTEGER NOT NULL,
  ns3_mean NUMERIC(5,2),
  zone TEXT,
  coherence_mean NUMERIC(5,4),
  rmssd_mean NUMERIC(7,2),
  hr_trend_mean NUMERIC(5,2),
  resp_rate_mean NUMERIC(5,2),
  sdnn_trend_mean NUMERIC(7,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ns3_snapshots_user_session ON ns3_snapshots (user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_ns3_snapshots_session_window ON ns3_snapshots (session_id, window_start);
