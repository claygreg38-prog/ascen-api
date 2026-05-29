-- Migration 084: add users.updated_at
-- Six "UPDATE users SET ... updated_at = NOW()" sites reference this column
-- (sessionOrchestrator.js:1169/1543/1840/1866, verificationService.js:295,
-- abiRoutes.js:1209), but it was never added to the schema. Without it, the
-- session-completion UPDATE throws "column updated_at of relation users does
-- not exist" and rolls back, so total_sessions_completed never increments for
-- real participants. Idempotent (IF NOT EXISTS) so it is safe to re-run.
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
