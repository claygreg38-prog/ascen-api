-- ══════════════════════════════════════════════════════════════
-- Migration 077: Create 14 Coupling session_templates rows
-- track = 'coupling', session_number 1-14, dialogue_phases NULL
-- Idempotent: ON CONFLICT DO NOTHING
-- ══════════════════════════════════════════════════════════════

INSERT INTO session_templates (session_number, track, title, dialogue_phases)
VALUES
  (1,  'coupling', 'Our Two Systems',             NULL),
  (2,  'coupling', 'When You Walk In The Room',    NULL),
  (3,  'coupling', 'The Thing You Do',             NULL),
  (4,  'coupling', 'The Thing I Do',               NULL),
  (5,  'coupling', 'Repair Rhythm',                NULL),
  (6,  'coupling', 'The Bid',                      NULL),
  (7,  'coupling', 'Capacity Check-In',            NULL),
  (8,  'coupling', 'Our Blueprint',                NULL),
  (9,  'coupling', 'The Third Nervous System',     NULL),
  (10, 'coupling', 'What We Carry Forward',        NULL),
  (11, 'coupling', 'The Triad',                    NULL),
  (12, 'coupling', 'Repair Before Arrival',        NULL),
  (13, 'coupling', 'The Capacity Gift',            NULL),
  (14, 'coupling', 'Co-Regulation as Parenting',   NULL)
ON CONFLICT (session_number, track) DO NOTHING;
