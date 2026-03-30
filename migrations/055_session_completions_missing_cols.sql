-- ══════════════════════════════════════════════════════════
-- 055: Add missing columns to session_completions
-- Required by sessionOrchestrator.onSessionComplete INSERT
-- ══════════════════════════════════════════════════════════

ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS pause_seconds INTEGER DEFAULT 0;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS breathwork_mode TEXT;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS breath_track_at_completion TEXT;
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS arc_id TEXT;

-- Also fix axis_sessions.session_id type: UUID→TEXT for integer session IDs
ALTER TABLE axis_sessions ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;
