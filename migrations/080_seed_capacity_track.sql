-- ══════════════════════════════════════════════════════════════
-- Migration 080: Create capacity track (S0.5–S4.5) as 5 new rows
-- track = 'capacity', session_number 1-5 (integers)
-- Display labels S0.5-S4.5 stored in title prefix
-- breath_mode = 'capacity_gentle' for all rows
-- Speaker token: "guide" (runtime voice resolver maps to user choice)
-- Ratio progression: 2:3 → 2:4 → 2:4 → 2:4 → 3:5
-- ALL statements include track = 'capacity' (LOCKED RULE)
-- Idempotent: ON CONFLICT DO UPDATE
-- ══════════════════════════════════════════════════════════════

-- ── S0.5: Just Arrive (capacity session 1) ──
INSERT INTO session_templates (session_number, track, title, breath_mode, ratio, duration_seconds, arc, dialogue_phases)
VALUES (1, 'capacity', 'S0.5: Just Arrive', 'capacity_gentle', '2:3', 90, 'Body', '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Welcome."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You don''t have to do anything yet."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Just be here."},
      {"speaker":"guide","text":"This room is yours. Nothing in here will rush you."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"You showed up."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s the whole thing for today."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Luno is going to breathe with you."},
      {"speaker":"guide","text":"Not fast. Not deep. Just a breath."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"In and out. That''s it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If your body wants to breathe faster — let it."},
      {"speaker":"guide","text":"If it wants to stop — that''s fine too."},
      {"speaker":"guide","text":"There is no wrong way to do this."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Two counts in. Three counts out."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Ninety seconds. That''s it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If it feels like too much — stop. You can always stop."},
      {"speaker":"guide","text":"Luno will be right here."}
    ]
  },
  "breathing": {
    "round_cues": [
      "In... and out. That''s it. Just like that.",
      "Your body is doing this. You don''t have to force it.",
      "One more. In... and out. You showed up. That''s the whole thing."
    ],
    "inhale_cue": "In — two counts.",
    "exhale_cue": "Out — three. Let it go.",
    "breath_count_spoken": true
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just breathed."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"On purpose."},
      {"speaker":"guide","text":"Most people never do that."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"That was ninety seconds."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You showed up. You breathed."},
      {"speaker":"guide","text":"That''s not small."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Same time tomorrow."}
    ]
  }
}')
ON CONFLICT (session_number, track) DO UPDATE SET
  title = EXCLUDED.title,
  breath_mode = EXCLUDED.breath_mode,
  ratio = EXCLUDED.ratio,
  duration_seconds = EXCLUDED.duration_seconds,
  arc = EXCLUDED.arc,
  dialogue_phases = EXCLUDED.dialogue_phases;

-- ── S1.5: The Next Breath (capacity session 2) ──
INSERT INTO session_templates (session_number, track, title, breath_mode, ratio, duration_seconds, arc, dialogue_phases)
VALUES (2, 'capacity', 'S1.5: The Next Breath', 'capacity_gentle', '2:4', 120, 'Body', '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"You came back."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That matters."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Yesterday you breathed."},
      {"speaker":"guide","text":"Today we try something small."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The breath out can be a little longer than the breath in."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not by much."},
      {"speaker":"guide","text":"Just a little longer."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That longer breath out is how the body calms itself down."},
      {"speaker":"guide","text":"It''s not a trick. It''s how the system works."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Two counts in. Four counts out."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If four feels like too much — three is fine."},
      {"speaker":"guide","text":"Your body sets the pace. Luno follows."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Two minutes. That''s it."}
    ]
  },
  "breathing": {
    "round_cues": [
      "In... and out. Slow. The out is the important part.",
      "Good. The longer out is talking to your body right now.",
      "Your body is already responding. You might not feel it yet. But it is.",
      "One more. In... and out. You''re doing this."
    ],
    "inhale_cue": "In — two counts.",
    "exhale_cue": "Out — let it be long.",
    "breath_count_spoken": true
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just did something."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You made the breath out longer."},
      {"speaker":"guide","text":"Your body allowed it."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"Two sessions."},
      {"speaker":"guide","text":"Your body can do more than you thought."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Same time tomorrow."}
    ]
  }
}')
ON CONFLICT (session_number, track) DO UPDATE SET
  title = EXCLUDED.title,
  breath_mode = EXCLUDED.breath_mode,
  ratio = EXCLUDED.ratio,
  duration_seconds = EXCLUDED.duration_seconds,
  arc = EXCLUDED.arc,
  dialogue_phases = EXCLUDED.dialogue_phases;

-- ── S2.5: Steady (capacity session 3) ──
INSERT INTO session_templates (session_number, track, title, breath_mode, ratio, duration_seconds, arc, dialogue_phases)
VALUES (3, 'capacity', 'S2.5: Steady', 'capacity_gentle', '2:4', 150, 'Body', '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Three sessions."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Settle in."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Today is the same rhythm."},
      {"speaker":"guide","text":"A little longer."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You don''t need to push harder."},
      {"speaker":"guide","text":"Steady is the work."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Same breath. More time."},
      {"speaker":"guide","text":"That''s how the body learns to trust the calm."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Two counts in. Four counts out."},
      {"speaker":"guide","text":"Two and a half minutes."},
      {"speaker":"guide","text":"Same pace. Just longer."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Same rhythm. Your body knows this one now.",
      "Steady. Not fast. Not hard. Just steady.",
      "The body is building something with each session. You can''t see it yet.",
      "But it''s there. Under the surface.",
      "One more round. In... and out. Steady."
    ],
    "inhale_cue": "In — two.",
    "exhale_cue": "Out — four.",
    "breath_count_spoken": true
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"Longer today."},
      {"speaker":"guide","text":"Same breath."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s how trust gets built."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"Steady is stronger than fast."},
      {"speaker":"guide","text":"You just proved that."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"See you tomorrow."}
    ]
  }
}')
ON CONFLICT (session_number, track) DO UPDATE SET
  title = EXCLUDED.title,
  breath_mode = EXCLUDED.breath_mode,
  ratio = EXCLUDED.ratio,
  duration_seconds = EXCLUDED.duration_seconds,
  arc = EXCLUDED.arc,
  dialogue_phases = EXCLUDED.dialogue_phases;

-- ── S3.5: Something Is Changing (capacity session 4) ──
INSERT INTO session_templates (session_number, track, title, breath_mode, ratio, duration_seconds, arc, dialogue_phases)
VALUES (4, 'capacity', 'S3.5: Something Is Changing', 'capacity_gentle', '2:4', 180, 'Body', '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Four sessions."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Something is different today."},
      {"speaker":"guide","text":"Your body might already know what it is."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"You''ve been breathing with Luno for four sessions now."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Same rhythm. Same room."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"But something in your body is shifting."},
      {"speaker":"guide","text":"You might not have words for it yet."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The body changes before the mind catches up."},
      {"speaker":"guide","text":"That''s normal. That''s how it works."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today we breathe a little longer."},
      {"speaker":"guide","text":"And let whatever is changing keep changing."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"Feeling different can feel wrong."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If calm feels unfamiliar — that makes sense."},
      {"speaker":"guide","text":"You''ve been running a long time."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The unfamiliar thing is not the problem."},
      {"speaker":"guide","text":"It''s the goal."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Two counts in. Four counts out."},
      {"speaker":"guide","text":"Three minutes."},
      {"speaker":"guide","text":"Let whatever is changing keep changing."}
    ]
  },
  "breathing": {
    "round_cues": [
      "Same breath. Your body knows it now.",
      "Can you feel what''s different? Something in your chest. Your shoulders. Your gut.",
      "That''s the body changing. Not because you forced it. Because you showed up.",
      "Four sessions of showing up. The body noticed.",
      "Steady. Slow. The calm is building underneath.",
      "One more minute. You''ve got this."
    ],
    "inhale_cue": "In — two.",
    "exhale_cue": "Out — four.",
    "breath_count_spoken": true
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"Something changed."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You felt it."},
      {"speaker":"guide","text":"The body doesn''t lie."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"Four sessions."},
      {"speaker":"guide","text":"The body is changing before the mind."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s how it''s supposed to work."},
      {"speaker":"guide","text":"See you tomorrow."}
    ]
  }
}')
ON CONFLICT (session_number, track) DO UPDATE SET
  title = EXCLUDED.title,
  breath_mode = EXCLUDED.breath_mode,
  ratio = EXCLUDED.ratio,
  duration_seconds = EXCLUDED.duration_seconds,
  arc = EXCLUDED.arc,
  dialogue_phases = EXCLUDED.dialogue_phases;

-- ── S4.5: Ready (capacity session 5) ──
INSERT INTO session_templates (session_number, track, title, breath_mode, ratio, duration_seconds, arc, dialogue_phases)
VALUES (5, 'capacity', 'S4.5: Ready', 'capacity_gentle', '3:5', 240, 'Body', '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Five sessions."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s not nothing."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Five sessions."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You showed up every time."},
      {"speaker":"guide","text":"Your body learned to breathe slower."},
      {"speaker":"guide","text":"Your system found a rhythm."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today the breath goes a little deeper."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Three counts in. Five counts out."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If that feels like too much — Luno will adjust."},
      {"speaker":"guide","text":"Your body decides. Not the plan."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"Deeper can feel scary."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Because when you breathe deeper, you feel more."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s okay."},
      {"speaker":"guide","text":"You''ve been building the floor for five sessions."},
      {"speaker":"guide","text":"The floor holds."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Three counts in. Five counts out."},
      {"speaker":"guide","text":"Four minutes."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If the breath needs to be shorter — shorten it."},
      {"speaker":"guide","text":"The body sets the pace."}
    ]
  },
  "breathing": {
    "round_cues": [
      "New depth. Same safety. In... and out.",
      "The out is longer now. Feel what that does to the body.",
      "The longer out is telling the body: it''s safe to slow down.",
      "Your body is listening. Even if the mind has doubts.",
      "Four minutes is the longest you''ve breathed with Luno.",
      "And you''re doing it at a deeper breath than where you started.",
      "Five sessions ago, you just arrived.",
      "Now look at you."
    ],
    "inhale_cue": "In — three counts.",
    "exhale_cue": "Out — five. Let it be long.",
    "breath_count_spoken": true
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You did it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Deeper breath. Longer time."},
      {"speaker":"guide","text":"Five sessions built this."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"You started with ninety seconds at the shallowest breath."},
      {"speaker":"guide","text":"Today you did four minutes at a deeper one."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s not a small change."},
      {"speaker":"guide","text":"That''s your body proving what it can do."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You are ready for Session 1."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The real work starts now."},
      {"speaker":"guide","text":"And you''ve already proven you can do it."}
    ]
  }
}')
ON CONFLICT (session_number, track) DO UPDATE SET
  title = EXCLUDED.title,
  breath_mode = EXCLUDED.breath_mode,
  ratio = EXCLUDED.ratio,
  duration_seconds = EXCLUDED.duration_seconds,
  arc = EXCLUDED.arc,
  dialogue_phases = EXCLUDED.dialogue_phases;
