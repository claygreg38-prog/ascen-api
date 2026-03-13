-- Migration 012: Somatic Reset Gateway + Personalized Closes
-- Idempotent — safe to re-run.

-- ══════════════════════════════════════════════════════════
-- 1. SOMATIC EXERCISES TABLE
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS somatic_exercises (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  protocol VARCHAR(50) NOT NULL,
  activity_number INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  position TEXT NOT NULL,
  luno_intro TEXT NOT NULL,
  instructions JSONB NOT NULL,
  abi_watch_for JSONB NOT NULL,
  card_content JSONB NOT NULL,
  active BOOLEAN DEFAULT true
);

-- ══════════════════════════════════════════════════════════
-- 2. PERSONALIZED CLOSES TABLE
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS personalized_closes (
  id SERIAL PRIMARY KEY,
  tier VARCHAR(50) NOT NULL,
  session_range_min INTEGER NOT NULL,
  session_range_max INTEGER NOT NULL,
  tags JSONB NOT NULL,
  priority INTEGER NOT NULL,
  text TEXT NOT NULL,
  active BOOLEAN DEFAULT true
);

-- ══════════════════════════════════════════════════════════
-- 3. NEW COLUMNS ON session_completions
-- ══════════════════════════════════════════════════════════

ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS somatic_exercise_used INTEGER REFERENCES somatic_exercises(id);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS somatic_hrv_pre NUMERIC(6,2);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS somatic_hrv_post NUMERIC(6,2);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS somatic_shift_pct NUMERIC(5,2);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS personalized_close_id INTEGER REFERENCES personalized_closes(id);
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS personalized_close_tags JSONB;

-- ══════════════════════════════════════════════════════════
-- 4. INDEXES
-- ══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_somatic_protocol ON somatic_exercises(protocol, activity_number) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_closes_tier ON personalized_closes(tier, priority) WHERE active = true;

-- ══════════════════════════════════════════════════════════
-- 5. SEED SOMATIC EXERCISES (9 total: 3 per protocol)
-- ══════════════════════════════════════════════════════════

INSERT INTO somatic_exercises (name, protocol, activity_number, duration_sec, position, luno_intro, instructions, abi_watch_for, card_content)
SELECT * FROM (VALUES
  -- HYPERAROUSAL PROTOCOL (HR > 100)
  ('Bilateral Shoulder Press',
   'hyperarousal', 1, 90, 'seated',
   'Your body is holding a lot right now. Let''s move some of that out through your shoulders.',
   '["Press both palms firmly against a wall or your thighs for 10 seconds", "Release completely and notice the difference", "Repeat 5 times, breathing naturally", "On the last release, let your arms hang heavy"]'::jsonb,
   '{"target_hr_drop": 8, "pivot_if_no_shift": true, "min_hrv_rise": 3}'::jsonb,
   '{"title": "Shoulder Press Reset", "icon": "💪", "subtitle": "Push and release tension"}'::jsonb),

  ('Gravity Drop',
   'hyperarousal', 2, 120, 'standing',
   'Let''s let gravity do the work. Your body knows how to release — we just have to let it.',
   '["Stand with feet shoulder-width apart", "Slowly fold forward from the hips — let arms and head hang", "Stay here for 30 seconds, breathing naturally", "Slowly roll back up one vertebra at a time", "Repeat twice"]'::jsonb,
   '{"target_hr_drop": 10, "pivot_if_no_shift": false, "min_hrv_rise": 5}'::jsonb,
   '{"title": "Gravity Drop", "icon": "🫠", "subtitle": "Let everything hang"}'::jsonb),

  ('Cold Water Reset',
   'hyperarousal', 3, 60, 'any',
   'This one is simple but powerful. Cold tells your nervous system to slow down.',
   '["Run cold water over your wrists for 15 seconds", "Then press your cold wet hands against your neck", "Hold for 10 seconds", "Shake your hands out and notice what shifted"]'::jsonb,
   '{"target_hr_drop": 12, "pivot_if_no_shift": false, "min_hrv_rise": 4}'::jsonb,
   '{"title": "Cold Water Reset", "icon": "🧊", "subtitle": "Activate the dive reflex"}'::jsonb),

  -- HYPOAROUSAL PROTOCOL (HR < 55)
  ('Rhythmic Tapping',
   'hypoarousal', 1, 90, 'seated',
   'Your body is running quiet right now. Let''s wake it up gently — not with force, with rhythm.',
   '["Tap alternating knees with your palms at a steady rhythm", "Start slow — about one tap per second", "Gradually increase speed over 30 seconds", "Then slow back down and stop", "Notice the energy in your legs"]'::jsonb,
   '{"target_hr_rise": 8, "pivot_if_no_shift": true, "min_hrv_change": 3}'::jsonb,
   '{"title": "Rhythmic Tapping", "icon": "🥁", "subtitle": "Wake up the rhythm"}'::jsonb),

  ('Seated Marching',
   'hypoarousal', 2, 120, 'seated',
   'We''re just going to move a little. Your body will follow.',
   '["Sit tall in your chair", "March your feet in place — lift knees as high as comfortable", "Swing your arms naturally", "Keep going for 60 seconds", "Rest and notice what changed"]'::jsonb,
   '{"target_hr_rise": 10, "pivot_if_no_shift": false, "min_hrv_change": 5}'::jsonb,
   '{"title": "Seated March", "icon": "🚶", "subtitle": "Get the engine running"}'::jsonb),

  ('Vocal Activation',
   'hypoarousal', 3, 60, 'any',
   'Sound moves energy. Let''s use your voice to bring you online.',
   '["Hum at a comfortable pitch for 10 seconds", "Then make an extended ''voo'' sound for 10 seconds", "Repeat 3 times", "Notice the vibration in your chest"]'::jsonb,
   '{"target_hr_rise": 6, "pivot_if_no_shift": false, "min_hrv_change": 4}'::jsonb,
   '{"title": "Vocal Activation", "icon": "🔊", "subtitle": "Sound moves energy"}'::jsonb),

  -- COURT DAY PROTOCOL (stressor_flag + HR 60-85)
  ('Orienting Scan',
   'court_day', 1, 90, 'seated',
   'Before we breathe, let''s land you here. Right here. Not in that room, not in that conversation. Here.',
   '["Look around the room slowly — name 5 things you can see", "Touch 3 different textures near you", "Press your feet into the floor and feel the ground", "Take one natural breath and notice where you feel it"]'::jsonb,
   '{"target_hr_stabilize": true, "pivot_if_no_shift": true, "min_hrv_rise": 2}'::jsonb,
   '{"title": "Orienting Scan", "icon": "👁️", "subtitle": "Land right here"}'::jsonb),

  ('Containment Hold',
   'court_day', 2, 120, 'seated',
   'Sometimes the body needs to feel held. You can do that for yourself.',
   '["Cross your arms and place each hand on the opposite shoulder", "Squeeze gently — like giving yourself a hug", "Hold for 20 seconds", "Release and place hands on thighs", "Repeat 3 times"]'::jsonb,
   '{"target_hr_stabilize": true, "pivot_if_no_shift": false, "min_hrv_rise": 3}'::jsonb,
   '{"title": "Containment Hold", "icon": "🤗", "subtitle": "Hold yourself steady"}'::jsonb),

  ('Feet-to-Floor Anchor',
   'court_day', 3, 60, 'seated',
   'Your feet know where you are even when your head doesn''t. Trust them.',
   '["Remove shoes if possible", "Press feet flat into the floor", "Push down hard for 10 seconds — feel the resistance", "Release and notice the contact", "Repeat 3 times, slower each time"]'::jsonb,
   '{"target_hr_stabilize": true, "pivot_if_no_shift": false, "min_hrv_rise": 2}'::jsonb,
   '{"title": "Feet-to-Floor Anchor", "icon": "🦶", "subtitle": "Ground through your feet"}'::jsonb)

) AS v(name, protocol, activity_number, duration_sec, position, luno_intro, instructions, abi_watch_for, card_content)
WHERE NOT EXISTS (SELECT 1 FROM somatic_exercises LIMIT 1);
