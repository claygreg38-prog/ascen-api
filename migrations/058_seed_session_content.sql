-- ══════════════════════════════════════════════════════════════
-- Migration 058: Seed Sessions 1-5 with Luno dialogue
-- Each session has distinct arrival, settle, breathing prompts,
-- drift words, and closing content.
-- ══════════════════════════════════════════════════════════════

-- Ensure luno columns exist (may already from original schema)
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS luno_arrival TEXT;
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS luno_mid TEXT;
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS luno_close TEXT;
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS luno_settle TEXT;
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS breathing_prompts JSONB;
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS drift_words JSONB;

-- ── SESSION 1: The First Breath ──
UPDATE session_templates SET
  luno_arrival = 'This is your first dive. No expectations. No right way to do this. You showed up — that''s the whole thing.',
  luno_settle = 'Going deeper now. The noise stays up there. Down here, it''s just you and your breath.',
  luno_mid = 'You''re doing it. Don''t try to control anything. Just notice. Your body already knows how to breathe — you''re just paying attention now.',
  luno_close = 'You did something most people never do. You stopped. You breathed on purpose. That changes things. I''ll be here next time.',
  breathing_prompts = '["Just breathe.", "No rush.", "You''re here. That''s enough.", "Stay with it.", "Good."]'::jsonb,
  drift_words = '["Breathe.", "Here.", "Yours.", "Safe."]'::jsonb
WHERE session_number = 1;

-- ── SESSION 2: Coming Back ──
UPDATE session_templates SET
  luno_arrival = 'You came back. That matters more than you know. Session two. Let''s go deeper.',
  luno_settle = 'Settle in. Your body remembers this from last time — even if your mind doesn''t.',
  luno_mid = 'Notice what''s different today. Your breath has a different shape every time. That''s not a problem — that''s information.',
  luno_close = 'Two sessions. You''re building something. Not a streak — a pattern. Your nervous system is starting to recognize this place.',
  breathing_prompts = '["Find your rhythm.", "Let the exhale be longer.", "Your body knows.", "Steady.", "There it is."]'::jsonb,
  drift_words = '["Deeper.", "Steady.", "Again.", "Here."]'::jsonb
WHERE session_number = 2;

-- ── SESSION 3: The Body Remembers ──
UPDATE session_templates SET
  luno_arrival = 'Three times now. Your body is starting to expect this. That expectation — that''s regulation beginning.',
  luno_settle = 'The descent gets easier. Not because it''s less deep — because you''re less afraid of the depth.',
  luno_mid = 'If your mind wanders, let it. Your breath doesn''t need your attention to work. But it works different when you give it.',
  luno_close = 'Your nervous system just practiced something it rarely gets to practice: being safe on purpose. That''s not small.',
  breathing_prompts = '["Let it slow.", "Your pace.", "Nothing to fix.", "Just this.", "Deeper."]'::jsonb,
  drift_words = '["Slower.", "Yours.", "Deeper.", "Home."]'::jsonb
WHERE session_number = 3;

-- ── SESSION 4: Building the Foundation ──
UPDATE session_templates SET
  luno_arrival = 'Session four. You''re past the point where most people quit. Something in you decided this matters.',
  luno_settle = 'Let everything above the surface stay there. For these few minutes, the only thing that matters is the next breath.',
  luno_mid = 'Your exhale is where the real work happens. That''s your nervous system downshifting. Don''t force it — just let it be a little longer.',
  luno_close = 'Four sessions in. The foundation is real now. Not because I say so — because your body is changing how it responds. Trust that.',
  breathing_prompts = '["Exhale longer.", "Let it go.", "There''s no rush.", "Your body''s learning.", "Stay easy."]'::jsonb,
  drift_words = '["Roots.", "Ground.", "Steady.", "Built."]'::jsonb
WHERE session_number = 4;

-- ── SESSION 5: Crossing the Threshold ──
UPDATE session_templates SET
  luno_arrival = 'Five. There''s a threshold somewhere around here — where this stops being something you do and starts being something you are. Let''s find it.',
  luno_settle = 'You know this place now. The descent, the quiet, the depth. Your body doesn''t resist it anymore.',
  luno_mid = 'Pay attention to the moment between exhale and inhale. That pause. That''s where your nervous system resets. Don''t rush past it.',
  luno_close = 'Five sessions. You crossed something today. The first few are about showing up. Now it''s about staying. You''re staying.',
  breathing_prompts = '["The pause matters.", "Between breaths.", "Right there.", "Stay with the quiet.", "That''s the reset."]'::jsonb,
  drift_words = '["Threshold.", "Pause.", "Between.", "Yours."]'::jsonb
WHERE session_number = 5;

-- If sessions 1-5 don't exist yet, insert them with minimal structure
INSERT INTO session_templates (session_number, title, arc, luno_arrival, luno_settle, luno_mid, luno_close, breathing_prompts, drift_words)
VALUES
  (1, 'The First Breath', 'foundation',
   'This is your first dive. No expectations. No right way to do this. You showed up — that''s the whole thing.',
   'Going deeper now. The noise stays up there. Down here, it''s just you and your breath.',
   'You''re doing it. Don''t try to control anything. Just notice.',
   'You did something most people never do. You stopped. You breathed on purpose. That changes things.',
   '["Just breathe.", "No rush.", "You''re here.", "Stay with it.", "Good."]'::jsonb,
   '["Breathe.", "Here.", "Yours.", "Safe."]'::jsonb),
  (2, 'Coming Back', 'foundation',
   'You came back. That matters more than you know. Session two.',
   'Settle in. Your body remembers this from last time.',
   'Notice what''s different today. Your breath has a different shape every time.',
   'Two sessions. You''re building something. Not a streak — a pattern.',
   '["Find your rhythm.", "Let the exhale be longer.", "Steady.", "There it is."]'::jsonb,
   '["Deeper.", "Steady.", "Again.", "Here."]'::jsonb),
  (3, 'The Body Remembers', 'foundation',
   'Three times now. Your body is starting to expect this.',
   'The descent gets easier. Not because it''s less deep — because you''re less afraid.',
   'If your mind wanders, let it. Your breath doesn''t need your attention to work.',
   'Your nervous system just practiced being safe on purpose. That''s not small.',
   '["Let it slow.", "Your pace.", "Nothing to fix.", "Deeper."]'::jsonb,
   '["Slower.", "Yours.", "Deeper.", "Home."]'::jsonb),
  (4, 'Building the Foundation', 'foundation',
   'Session four. You''re past the point where most people quit.',
   'Let everything above the surface stay there.',
   'Your exhale is where the real work happens.',
   'Four sessions in. The foundation is real now.',
   '["Exhale longer.", "Let it go.", "No rush.", "Stay easy."]'::jsonb,
   '["Roots.", "Ground.", "Steady.", "Built."]'::jsonb),
  (5, 'Crossing the Threshold', 'foundation',
   'Five. There''s a threshold somewhere around here.',
   'You know this place now. The descent, the quiet, the depth.',
   'Pay attention to the moment between exhale and inhale.',
   'Five sessions. You crossed something today.',
   '["The pause matters.", "Between breaths.", "Right there.", "That''s the reset."]'::jsonb,
   '["Threshold.", "Pause.", "Between.", "Yours."]'::jsonb)
ON CONFLICT (session_number) DO NOTHING;
