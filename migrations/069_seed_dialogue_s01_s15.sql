-- ══════════════════════════════════════════════════════════════
-- Migration 069: Seed dialogue_phases for Sessions 1-15
-- Populates Tier 1 dialogue content for the content pipeline.
-- Each session gets arrival, opening, before_the_breath,
-- breathing round_cues, close, and vault prompt.
-- ══════════════════════════════════════════════════════════════

-- ── SESSION 1: The First Breath ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Session one."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"The first breath."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"This is your first dive. No expectations. No right way to do this."},
      {"speaker":"luno","text":"You showed up — that''s the whole thing."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Your body is already doing something it rarely gets to do."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"It''s slowing down on purpose."},
      {"speaker":"luno","text":"You don''t have to fix anything. You don''t have to feel anything specific."},
      {"speaker":"luno","text":"Just be here."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Follow Luno."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Breathe in — like you''re receiving something."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Let it go — slow, longer than the inhale."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Just breathe.",
      "No rush.",
      "You''re here. That''s enough.",
      "Stay with it.",
      "Good."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"You did something most people never do."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"You stopped. You breathed on purpose."},
      {"speaker":"luno","text":"That changes things."},
      {"speaker":"luno","text":"I''ll be here next time."}
    ]
  },
  "vault": {
    "prompt": "What did your body do when you stopped?"
  }
}'::jsonb WHERE session_number = 1;

-- ── SESSION 2: Coming Back ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"You came back."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"That matters more than you know."},
      {"speaker":"luno","text":"Session two. Let''s go deeper."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Your body remembers this from last time."},
      {"speaker":"luno","text":"Even if your mind doesn''t."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Settle in."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Same rhythm. New day."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"In through the nose. Out through the mouth."},
      {"speaker":"luno","text":"Let the exhale be longer."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Find your rhythm.",
      "Let the exhale be longer.",
      "Your body knows.",
      "Steady.",
      "There it is."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Two sessions."},
      {"speaker":"luno","text":"You''re building something."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Not a streak — a pattern."},
      {"speaker":"luno","text":"Your nervous system is starting to recognize this place."}
    ]
  },
  "vault": {
    "prompt": "What felt different this time?"
  }
}'::jsonb WHERE session_number = 2;

-- ── SESSION 3: The Body Remembers ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Three times now."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Your body is starting to expect this."},
      {"speaker":"luno","text":"That expectation — that''s regulation beginning."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"The descent gets easier."},
      {"speaker":"luno","text":"Not because it''s less deep."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Because you''re less afraid of the depth."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"If your mind wanders, let it."},
      {"speaker":"luno","text":"Your breath doesn''t need your attention to work."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"But it works different when you give it."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Let it slow.",
      "Your pace.",
      "Nothing to fix.",
      "Just this.",
      "Deeper."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Your nervous system just practiced something it rarely gets to practice."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Being safe on purpose."},
      {"speaker":"luno","text":"That''s not small."}
    ]
  },
  "vault": {
    "prompt": "Where does your body hold tension?"
  }
}'::jsonb WHERE session_number = 3;

-- ── SESSION 4: Building the Foundation ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Session four."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"You''re past the point where most people quit."},
      {"speaker":"luno","text":"Something in you decided this matters."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Let everything above the surface stay there."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"For these few minutes, the only thing that matters is the next breath."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Your exhale is where the real work happens."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"That''s your nervous system downshifting."},
      {"speaker":"luno","text":"Don''t force it — just let it be a little longer."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Exhale longer.",
      "Let it go.",
      "There''s no rush.",
      "Your body''s learning.",
      "Stay easy."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Four sessions in."},
      {"speaker":"luno","text":"The foundation is real now."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Not because I say so — because your body is changing how it responds."},
      {"speaker":"luno","text":"Trust that."}
    ]
  },
  "vault": {
    "prompt": "What does your body do differently now than it did a week ago?"
  }
}'::jsonb WHERE session_number = 4;

-- ── SESSION 5: Crossing the Threshold ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Five."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"There''s a threshold somewhere around here."},
      {"speaker":"luno","text":"Where this stops being something you do and starts being something you are."},
      {"speaker":"luno","text":"Let''s find it."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"You know this place now."},
      {"speaker":"luno","text":"The descent, the quiet, the depth."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Your body doesn''t resist it anymore."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Pay attention to the moment between exhale and inhale."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"That pause."},
      {"speaker":"luno","text":"That''s where your nervous system resets."},
      {"speaker":"luno","text":"Don''t rush past it."}
    ]
  },
  "breathing": {
    "round_cues": [
      "The pause matters.",
      "Between breaths.",
      "Right there.",
      "Stay with the quiet.",
      "That''s the reset."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Five sessions."},
      {"speaker":"luno","text":"You crossed something today."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"The first few are about showing up."},
      {"speaker":"luno","text":"Now it''s about staying."},
      {"speaker":"luno","text":"You''re staying."}
    ]
  },
  "vault": {
    "prompt": "What do you notice in the pause between breaths?"
  }
}'::jsonb WHERE session_number = 5;

-- ── SESSION 6: The Rhythm ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Session six."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Something shifted. You don''t come here to try anymore."},
      {"speaker":"luno","text":"You come here to practice."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Your breathing has a rhythm now."},
      {"speaker":"luno","text":"Not because you forced it."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Because your body started choosing it."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Today, notice the rhythm."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Not the individual breaths — the pattern underneath them."},
      {"speaker":"luno","text":"That pattern is yours."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Feel the rhythm.",
      "It''s already there.",
      "You''re not building it — you''re finding it.",
      "Steady.",
      "That''s yours."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Six sessions."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"The rhythm you just practiced doesn''t stop when you leave."},
      {"speaker":"luno","text":"It echoes. Pay attention today — you''ll feel it."}
    ]
  },
  "vault": {
    "prompt": "When in your day does your breathing change without you noticing?"
  }
}'::jsonb WHERE session_number = 6;

-- ── SESSION 7: What Stays ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Seven."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"A week of breath."},
      {"speaker":"luno","text":"Some of it stays with you now."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"There are things you carry that you didn''t choose."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"And there are things you''re building that you did."},
      {"speaker":"luno","text":"This is one of the things you chose."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Today, breathe like you''re making room."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Not pushing anything out."},
      {"speaker":"luno","text":"Just creating space where there wasn''t any."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Make room.",
      "Nothing to push away.",
      "Just space.",
      "More room.",
      "Good."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"What stays from seven sessions isn''t the breathing."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"It''s the proof that you can change how your body responds."},
      {"speaker":"luno","text":"That proof lives in you now."}
    ]
  },
  "vault": {
    "prompt": "What are you making room for?"
  }
}'::jsonb WHERE session_number = 7;

-- ── SESSION 8: The Signal ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Session eight."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Your body sends signals all day."},
      {"speaker":"luno","text":"Most people never learn to hear them."},
      {"speaker":"luno","text":"You''re learning."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Tension is a signal. Not a problem."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"It''s your body saying: I''m holding something."},
      {"speaker":"luno","text":"Today, we listen."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Scan from your head to your feet."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Where does the signal come from?"},
      {"speaker":"luno","text":"Breathe toward that place."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Where''s the signal?",
      "Breathe toward it.",
      "Don''t fix it. Just notice.",
      "Your body is talking.",
      "Listen."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Eight sessions."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"You''re not just breathing anymore."},
      {"speaker":"luno","text":"You''re listening. That''s the real skill."}
    ]
  },
  "vault": {
    "prompt": "What signal is your body sending right now?"
  }
}'::jsonb WHERE session_number = 8;

-- ── SESSION 9: The Mirror ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Nine."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Almost double digits."},
      {"speaker":"luno","text":"This breath is a mirror now. It shows you things."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Every session, you bring a different body."},
      {"speaker":"luno","text":"Different tension. Different capacity."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"The breath shows you where you are today. Not yesterday."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Don''t try to match last session."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Meet today''s body where it is."},
      {"speaker":"luno","text":"That''s the practice."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Today''s body.",
      "Not yesterday''s.",
      "Meet it here.",
      "This is enough.",
      "Right here."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Nine sessions and you know something most people don''t."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"That showing up different every time isn''t failure."},
      {"speaker":"luno","text":"It''s honesty."}
    ]
  },
  "vault": {
    "prompt": "How is today''s body different from last session?"
  }
}'::jsonb WHERE session_number = 9;

-- ── SESSION 10: The Anchor ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Ten."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Double digits."},
      {"speaker":"luno","text":"This is no longer an experiment. This is a practice."},
      {"speaker":"luno","text":"You built this."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Ten sessions ago, this place didn''t exist for you."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Now it''s an anchor."},
      {"speaker":"luno","text":"Something you can return to when everything else moves."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Today, breathe like someone who''s done this before."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Because you have."},
      {"speaker":"luno","text":"Your body knows the way."}
    ]
  },
  "breathing": {
    "round_cues": [
      "You know this.",
      "Your body knows.",
      "Anchor here.",
      "Steady.",
      "This is yours."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Ten sessions."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"You have an anchor now."},
      {"speaker":"luno","text":"Not in this app. In your nervous system."},
      {"speaker":"luno","text":"It goes where you go."}
    ]
  },
  "vault": {
    "prompt": "What has this practice anchored in you?"
  }
}'::jsonb WHERE session_number = 10;

-- ── SESSION 11: The Quiet ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Eleven."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Past the first arc."},
      {"speaker":"luno","text":"Something quiets down around here. Let it."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"The noise doesn''t stop."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"But you''re getting better at hearing underneath it."},
      {"speaker":"luno","text":"That''s where the real information lives."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Today, listen for the quiet under the noise."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"It''s been there the whole time."},
      {"speaker":"luno","text":"Your breath just makes it louder."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Under the noise.",
      "Listen.",
      "It''s there.",
      "Quiet.",
      "Stay."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"The quiet you found just now?"},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"It doesn''t belong to this room."},
      {"speaker":"luno","text":"It belongs to you. Take it with you."}
    ]
  },
  "vault": {
    "prompt": "What do you hear when it gets quiet?"
  }
}'::jsonb WHERE session_number = 11;

-- ── SESSION 12: The Weight ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Twelve."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Everybody carries weight."},
      {"speaker":"luno","text":"Today we''re not putting it down. We''re just noticing where we hold it."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Your shoulders. Your jaw. Your chest."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Your body stores what your mind won''t process."},
      {"speaker":"luno","text":"The breath gives it somewhere to go."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Breathe into the heaviest part of you right now."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Not to make it lighter."},
      {"speaker":"luno","text":"To let it know you''re paying attention."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Where''s the weight?",
      "Breathe into it.",
      "Not to fix. To notice.",
      "It can stay.",
      "You''re still here."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"You didn''t put the weight down today."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"But you stopped pretending it wasn''t there."},
      {"speaker":"luno","text":"That''s where it starts."}
    ]
  },
  "vault": {
    "prompt": "What are you carrying that you haven''t named?"
  }
}'::jsonb WHERE session_number = 12;

-- ── SESSION 13: The Pattern ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Thirteen."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"By now, your body has a pattern."},
      {"speaker":"luno","text":"Not the one you were given. The one you''re building."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Patterns run deep."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Some were installed before you had words."},
      {"speaker":"luno","text":"You''re not erasing them. You''re writing new ones alongside."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Every exhale is a new line of code."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Your nervous system is rewriting itself."},
      {"speaker":"luno","text":"One breath at a time."}
    ]
  },
  "breathing": {
    "round_cues": [
      "New pattern.",
      "One breath at a time.",
      "Writing over the old code.",
      "Steady.",
      "This is the work."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Thirteen sessions of new pattern."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"The old ones don''t disappear."},
      {"speaker":"luno","text":"But the new ones are getting stronger."}
    ]
  },
  "vault": {
    "prompt": "What pattern are you trying to change?"
  }
}'::jsonb WHERE session_number = 13;

-- ── SESSION 14: The Return ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Fourteen."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Every time you come back, you''re saying something."},
      {"speaker":"luno","text":"You''re saying: I matter enough to do this."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"The people who came before you survived things that would break most people."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"They made it through. And because they made it through — you are here."},
      {"speaker":"luno","text":"Breathing on purpose."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"Today, breathe for everyone who couldn''t."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Not heavy. Not sad."},
      {"speaker":"luno","text":"Just: this breath exists because they existed."}
    ]
  },
  "breathing": {
    "round_cues": [
      "For them.",
      "And for you.",
      "Because they survived.",
      "You''re here.",
      "Breathe."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Fourteen sessions."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"You''re not just breathing for yourself anymore."},
      {"speaker":"luno","text":"You''re breathing for the line."}
    ]
  },
  "vault": {
    "prompt": "Who are you breathing for?"
  }
}'::jsonb WHERE session_number = 14;

-- ── SESSION 15: The Foundation Complete ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"luno","text":"Fifteen."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"The foundation arc is complete."},
      {"speaker":"luno","text":"You built something real. Something that lives in your body now."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"luno","text":"Fifteen sessions ago, you walked in not knowing what this was."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Now your body knows before your mind does."},
      {"speaker":"luno","text":"It starts settling the moment you arrive."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"luno","text":"One more time through the foundation."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"Not because you need practice."},
      {"speaker":"luno","text":"Because the practice deserves your full attention."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Full attention.",
      "Every breath counts.",
      "You built this.",
      "Fifteen sessions deep.",
      "This is who you are now."
    ]
  },
  "close": {
    "lines": [
      {"speaker":"luno","text":"Fifteen sessions."},
      {"speaker":"luno","text":"The foundation is built."},
      {"speaker":"luno","text":""},
      {"speaker":"luno","text":"What comes next goes deeper."},
      {"speaker":"luno","text":"But you''re ready. Your body told me so."}
    ]
  },
  "vault": {
    "prompt": "What has changed in you since Session 1?"
  }
}'::jsonb WHERE session_number = 15;
