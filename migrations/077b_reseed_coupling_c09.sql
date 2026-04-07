-- ══════════════════════════════════════════════════════════════
-- Migration 077b: Re-seed C09 dialogue_phases with full content
-- Source: C09_third_nervous_system.yaml (rebuilt April 7, 2026)
-- Speaker: "guide" (converted from "luno" in source)
-- Track filter: AND track = 'coupling' (LOCKED RULE)
-- No loss_variant fields (C09 does not carry loss variants)
-- ══════════════════════════════════════════════════════════════

UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module nine."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"This one is about someone who hasn''t arrived yet."},
      {"speaker":"guide","text":"But who is already here."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And today there''s a third weather report."},
      {"speaker":"guide","text":"The one inside."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If you''re carrying — what''s your body been holding this week?"},
      {"speaker":"guide","text":"If you''re the partner — what weather have you been bringing home?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One sentence each. The real weather."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Right now — as you sit here — a nervous system is forming."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not in a lab. Not in a textbook."},
      {"speaker":"guide","text":"Inside one of you."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That nervous system is already learning."},
      {"speaker":"guide","text":"Not words. Not ideas."},
      {"speaker":"guide","text":"It''s learning rhythm."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Is the world out there calm or chaotic?"},
      {"speaker":"guide","text":"Is the body around me settled or stressed?"},
      {"speaker":"guide","text":"Can I trust the rhythm I''m feeling?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"When you breathe slowly — the baby feels that."},
      {"speaker":"guide","text":"When your heart rate drops — the baby''s does too."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"This is not about being perfect."},
      {"speaker":"guide","text":"Stress happens. Arguments happen. Bad days happen."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"But when you breathe after the stress —"},
      {"speaker":"guide","text":"when you come back to calm —"},
      {"speaker":"guide","text":"the baby learns the most important thing a nervous system can learn."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"It learns: things get hard. And then they get better."},
      {"speaker":"guide","text":"Recovery is possible."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s the first lesson you''re teaching."},
      {"speaker":"guide","text":"Before the nursery. Before the name. Before the birth."},
      {"speaker":"guide","text":"You''re teaching recovery."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And to the partner who isn''t carrying —"},
      {"speaker":"guide","text":"your weather reaches the baby too."},
      {"speaker":"guide","text":"Through your partner''s response to you."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"When you walk in storming, your partner''s body tightens."},
      {"speaker":"guide","text":"When their body tightens, the baby''s environment shifts."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You are not separate from this."},
      {"speaker":"guide","text":"You''re in the room. You''re in the rhythm."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Breathe now."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Four minutes alone. Notice your own rhythm."},
      {"speaker":"guide","text":"If you''re carrying — feel where the baby is."},
      {"speaker":"guide","text":"Not as an idea. As a presence."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If you''re the partner — picture your breath reaching the room."},
      {"speaker":"guide","text":"Reaching your partner. Reaching the smallest one inside."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Then four minutes together."},
      {"speaker":"guide","text":"Three nervous systems. One rhythm."}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Find your own rhythm first. Slow. Steady.",
      "If you''re carrying — notice the space inside. The baby is already here.",
      "If you''re the partner — your breath matters. Your weather matters.",
      "Three systems. Each one settling. Each one teaching the next."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together now."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Three nervous systems finding one rhythm."},
      {"speaker":"guide","text":"The baby is in the room with you."}
    ],
    "shared_round_cues": [
      "In together. The baby is breathing this rhythm too.",
      "Your calm is not just yours. It''s shared.",
      "This is the first family co-regulation. It''s already happening.",
      "Remember this rhythm. The baby already knows it."
    ]
  },
  "kitchen_table": {
    "a_prompt": "What has the last month been like in your body? Mostly calm? Mostly activated? A mix? If you''re carrying this baby — what weather has the baby been living in? Not to judge. To know. What do you want to change before they arrive?",
    "b_prompt": "For the non-carrying partner: what weather have you been bringing home? When you walk through that door stressed, activated, heavy — that reaches the baby too. Through your partner''s response to you. What do you want to bring home instead? What''s one thing you can change this week?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just did something the baby felt."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You sat together. You breathed slowly. You talked about them."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That rhythm you just made — that was the baby''s environment for the last twenty minutes."},
      {"speaker":"guide","text":"Calm. Connected. Safe."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s what you can build for them."},
      {"speaker":"guide","text":"Not all the time. Nobody can."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"But often enough that they learn it''s possible."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — once a day — do this."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Sit together for five minutes."},
      {"speaker":"guide","text":"Breathe slowly. Side by side."},
      {"speaker":"guide","text":"Don''t talk. Don''t fix anything. Just breathe."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s the baby''s first lesson."},
      {"speaker":"guide","text":"Not the nursery. Not the name."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The rhythm of two adults choosing calm together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"They''re already learning it."},
      {"speaker":"guide","text":"Make sure it''s a rhythm worth learning."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What weather do you want your child''s first year to feel like?",
    "shared_prompt": "Write one sentence to your child about what you''re building for them."
  },
  "visual_narrative": [
    {
      "trigger": "shared_phase.luno_breath.round_1",
      "visual": "third_rhythm",
      "description": "Two soft glowing forms (the partners) breathing in shared rhythm. Between and slightly below them, a third small light pulses gently — not separate, but woven into the shared field. As the partners'' breath synchronizes, the small light pulses in time with them. The visual shows: the baby is already part of the rhythm, not waiting outside it.",
      "duration_seconds": 12,
      "breath_sync": true,
      "signature": true,
      "signature_id": "third_nervous_system"
    }
  ],
  "context_hooks": {
    "justice_facility": {
      "opening_variant_line": "You can''t put your hand on the belly from where you are. But when you breathe slowly on this call — and your partner puts the phone close — the baby hears the rhythm of your voice. Distance doesn''t break this. Stress does. So when you''re on the phone — breathe first.",
      "note": "For incarcerated expecting parents. The non-carrying partner may be the one inside. The module still works on phone/video calls. The rhythm is what the baby learns — and rhythm travels through voice."
    },
    "community_wellness": {
      "opening_variant_line": "You walk in from work. From the grocery store. From your mother''s house. Whatever weather you''re carrying — it walks in with you. The baby is already in the room that weather is filling."
    },
    "expecting_solo": {
      "note": "If only one parent is engaged (other parent absent or unwilling), the module adapts. The carrying parent does individual + simulated shared breath. Guide emphasizes: ''Your regulation alone is enough. The baby has one parent breathing. That is not a deficit.''"
    }
  }
}'::jsonb WHERE session_number = 9 AND track = 'coupling';
