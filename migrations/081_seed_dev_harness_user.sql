-- ══════════════════════════════════════════════════════════════
-- Migration 081: Seed dev harness user for standalone /breathe testing
-- This user allows the v8 frontend to register sessions with ABI
-- when running without JWT (standalone mode).
-- Idempotent: ON CONFLICT (email) DO NOTHING
-- ══════════════════════════════════════════════════════════════

INSERT INTO users (
  user_id,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  participant_id,
  auth_method,
  is_active,
  is_verified,
  password_changed,
  created_at
) VALUES (
  'user_dev_harness',
  'dev@harness.local',
  '$2a$12$000000000000000000000uGHKNnQ7EcX1e5A5MjzqK7KvDqWHKFi',
  'Dev',
  'Harness',
  'participant',
  'DEV001',
  'facility_code',
  true,
  true,
  true,
  NOW()
)
ON CONFLICT (email) DO NOTHING;
