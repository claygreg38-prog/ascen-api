-- ══════════════════════════════════════════════════════════════
-- Migration 078: Seed dialogue_phases for Coupling C01-C14
-- ALL updates include AND track = 'coupling' (LOCKED RULE).
-- Speaker token: "guide" (runtime voice resolver maps to user choice).
-- C09-C14 include loss_variant fields inline.
-- C12: breath_mode = pendulation_loop
-- C14: breath_mode = coherent, ceremony_override = true
-- ══════════════════════════════════════════════════════════════

-- ── C01: Our Two Systems ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module one."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Welcome. Both of you."},
      {"speaker":"guide","text":"Sit however feels right. Facing each other. Side by side. Doesn''t matter."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You''re here together. That''s the whole start."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Before we do anything — how''s your weather right now?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not fine. Not good. The real weather."},
      {"speaker":"guide","text":"Clear skies? Cloudy? Storm coming in?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One of you go first. Just one sentence. Your weather."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Now the other."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Good. You just did the hardest thing most couples never do."},
      {"speaker":"guide","text":"You told the truth about where you are before pretending to be somewhere else."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Your body is running a program right now."},
      {"speaker":"guide","text":"So is your partner''s."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Heart rate. Breath speed. Muscle tension. Gut tightness."},
      {"speaker":"guide","text":"Your body set all of that before you sat down."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Most people spend their whole relationship reacting to each other''s programs."},
      {"speaker":"guide","text":"Without knowing they''re running."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"She goes quiet. His chest tightens."},
      {"speaker":"guide","text":"He raises his voice. Her stomach drops."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s not communication. That''s two nervous systems having a conversation your mouths don''t know about."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you''re going to learn what your system does."},
      {"speaker":"guide","text":"And then you''re going to tell your partner."},
      {"speaker":"guide","text":"Out loud. In plain language."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"We''re going to breathe now."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"First — alone. Four minutes. Eyes closed if you want."},
      {"speaker":"guide","text":"Your only job is to notice what your body does when you slow down."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Then — together. Four minutes. Same breath."},
      {"speaker":"guide","text":"Notice what changes when you breathe next to this person."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Does your body calm down? Speed up? Stay the same?"},
      {"speaker":"guide","text":"There''s no right answer. Just data."}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Find your own rhythm first.",
      "Notice what your body does when you stop talking.",
      "Where does the tension live? Jaw? Shoulders? Gut? Just notice.",
      "Your partner is breathing next to you. You don''t have to match them yet."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Now breathe together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Same rhythm. In together. Out together."},
      {"speaker":"guide","text":"If you fall out of sync — find your way back. No rush."}
    ],
    "shared_round_cues": [
      "In together. Out together.",
      "Notice if your body responds differently when you breathe with someone.",
      "This is co-regulation. Two systems finding the same rhythm.",
      "You don''t have to talk to connect. The breath does it."
    ]
  },
  "kitchen_table": {
    "a_prompt": "Think about the last week. What has your weather been? Not events — your body. Were you mostly clear? Mostly cloudy? Was there a day your body felt heavier than the rest? Tell your partner. Just the weather. Not why.",
    "b_prompt": "Same question. Your weather this week. And then: did you know your partner''s weather before they told you? Could you feel it? Or were you guessing?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just did something most couples never try."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You named your weather. Out loud. To each other."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s not small. That''s the foundation."},
      {"speaker":"guide","text":"Because you can''t navigate a storm together if neither of you admits it''s raining."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"Module one is done."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Between now and next time — try this."},
      {"speaker":"guide","text":"Once a day, tell your partner your weather."},
      {"speaker":"guide","text":"Not ''I''m fine.'' The real weather."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You don''t have to fix each other''s weather."},
      {"speaker":"guide","text":"You just have to know what it is."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What was your weather today that you didn''t say out loud?",
    "shared_prompt": "What surprised you about your partner''s weather?"
  }
}'::jsonb WHERE session_number = 1 AND track = 'coupling';

-- ── C02: When You Walk In The Room ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module two."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today is about something that happens before conversation."},
      {"speaker":"guide","text":"Before eye contact. Before touch."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Something your body does the moment this person enters a room."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check. One sentence each."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And this time — notice what your body does while your partner talks."},
      {"speaker":"guide","text":"Not the words. The body. Yours."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"When your partner walks through the front door — what happens in your chest?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Does it open? Does it tighten? Does it stay the same?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Most people have never asked that question."},
      {"speaker":"guide","text":"They just react. Smile. Tense up. Turn away. Start talking."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"But your body answered before any of that."},
      {"speaker":"guide","text":"Your nervous system read the room in a quarter of a second."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Safe? Threat? Neutral?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That reading is not about your partner."},
      {"speaker":"guide","text":"It''s about every person who ever walked through a door in your life."},
      {"speaker":"guide","text":"Your body learned: when someone enters, prepare."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you find out what ''prepare'' means for each of you."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Four minutes alone. Then four together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"During the shared breath — pay attention."},
      {"speaker":"guide","text":"Does breathing next to this person calm you down?"},
      {"speaker":"guide","text":"Or does your body stay on guard?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Either answer is fine. Both are real."}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Settle into your own body first.",
      "Notice your baseline. This is your system running alone.",
      "No performance. No adjusting for the person next to you.",
      "This is your weather without anyone else''s influence."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Now together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Same breath. And notice — did something just shift?"}
    ],
    "shared_round_cues": [
      "Breathing together now. Notice what changed.",
      "Is your heart rate the same? Faster? Slower?",
      "This is what your body does when this person is close.",
      "Not what you think it should do. What it actually does."
    ]
  },
  "kitchen_table": {
    "a_prompt": "When your partner walks through the door at the end of the day — what happens in your body? Be specific. Not emotion. Body. Does your jaw tighten? Do your shoulders drop? Does your stomach flip? Tell your partner what your body does. Not why. Just what.",
    "b_prompt": "Same question. And then: is your partner''s answer what you expected? Did you know what your presence does to their body? What does that feel like to hear?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just learned something most couples go decades without knowing."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"What your body does when the other person is near."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s not about love or not-love."},
      {"speaker":"guide","text":"It''s about what your nervous system learned about people before you two ever met."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — notice the door moment."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"When your partner enters a room, pause."},
      {"speaker":"guide","text":"Feel what your body does."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Don''t judge it. Don''t fix it."},
      {"speaker":"guide","text":"Just know it."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What did your body do during the shared breath that surprised you?",
    "shared_prompt": "What did you learn about your partner''s nervous system response to you?"
  }
}'::jsonb WHERE session_number = 2 AND track = 'coupling';

-- ── C03: The Thing You Do ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module three."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"This one takes courage."},
      {"speaker":"guide","text":"You''re going to name a pattern in your partner."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And then they''re going to sit with it."},
      {"speaker":"guide","text":"Without defending."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Be honest. If you''re nervous about this one, that''s weather."},
      {"speaker":"guide","text":"Name it."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"There''s something your partner does that fires your body."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Maybe they go quiet when they''re upset."},
      {"speaker":"guide","text":"Maybe they get loud."},
      {"speaker":"guide","text":"Maybe they leave the room."},
      {"speaker":"guide","text":"Maybe they stay but disappear behind their eyes."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Whatever it is — your body knows it."},
      {"speaker":"guide","text":"Your body reacts before your mind catches up."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Here''s the part most couples miss."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That thing your partner does?"},
      {"speaker":"guide","text":"They learned it from someone else."},
      {"speaker":"guide","text":"Long before you."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And your reaction to it?"},
      {"speaker":"guide","text":"You learned that too."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Two inherited programs running into each other."},
      {"speaker":"guide","text":"Neither one is personal."},
      {"speaker":"guide","text":"Both feel like they are."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Breathe first. Name the pattern after."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Your body needs to be settled before your mouth opens about this."},
      {"speaker":"guide","text":"Trust me on that."}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Settle.",
      "Think about the thing. The pattern. Feel where your body holds it.",
      "Don''t rehearse what you''ll say. Just breathe into where it lives.",
      "Your body is getting ready to say something hard. Let it prepare."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together now."},
      {"speaker":"guide","text":"Breathe next to the person you''re about to be honest with."}
    ],
    "shared_round_cues": [
      "In together. This breath is building the bridge.",
      "You''re about to say something real. The breath holds you both.",
      "Whatever comes next — the breath was here first.",
      "Ready."
    ]
  },
  "kitchen_table": {
    "a_prompt": "There''s something your partner does that fires your body. Name it. Not as an accusation. As a body report. ''When you [specific behavior], my body [specific response].'' Not ''you make me feel.'' Your body. What it does. Then: where did you first learn to react that way? Who in your family did the same thing your partner does?",
    "b_prompt": "Listen without defending. Just listen. Then: does what your partner described surprise you? Did you know your body does that to theirs? And your turn — same exercise. Name the thing. ''When you [behavior], my body [response].''"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just named the loop."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Two inherited programs. Running into each other."},
      {"speaker":"guide","text":"Neither of you invented them."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"But now you can see them."},
      {"speaker":"guide","text":"And you can''t unsee this."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — when the loop starts, pause."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Don''t fix it. Don''t fight it."},
      {"speaker":"guide","text":"Just say: ''The loop is running.''"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Naming it out loud changes everything."},
      {"speaker":"guide","text":"Because now it''s something you see together."},
      {"speaker":"guide","text":"Not something that happens to you."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What did it feel like to hear what your body does to your partner?",
    "shared_prompt": "Name the loop in one sentence. ''When I ___, you ___, then I ___.'' "
  }
}'::jsonb WHERE session_number = 3 AND track = 'coupling';

-- ── C04: The Thing I Do ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module four."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Last time — you named something your partner does."},
      {"speaker":"guide","text":"Today — the mirror turns."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you name your own move."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And notice — does your weather change when you know you are about to look at yourself?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One at a time."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"You named your partner''s pattern last time."},
      {"speaker":"guide","text":"Now the harder question."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"What do YOU do?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"When you feel criticized — what is your move?"},
      {"speaker":"guide","text":"Do you get loud? Go quiet? Leave the room?"},
      {"speaker":"guide","text":"Do you make a joke? Change the subject? Start keeping score?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"When you feel ignored — what happens?"},
      {"speaker":"guide","text":"Do you try harder? Pull away? Punish with silence?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Everyone has a move."},
      {"speaker":"guide","text":"The people who say they don''t — they just have not looked yet."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Your move is not your fault."},
      {"speaker":"guide","text":"It is a program you learned. From watching someone survive."},
      {"speaker":"guide","text":"But it is running in your relationship right now."},
      {"speaker":"guide","text":"And your partner feels it every time."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"The voice says:"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That is just how I am."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"No it is not."},
      {"speaker":"guide","text":"That is how you learned to be."},
      {"speaker":"guide","text":"From someone who learned it from someone else."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You can see it now. That is already different."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Four minutes alone. Then four together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"While you breathe — think about the last time you made the move."},
      {"speaker":"guide","text":"Not to judge it. To see it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Where did you learn that move? Who showed you?"}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Settle. Think about the move. The thing you do when it gets hard.",
      "Where does it live in your body? Jaw? Fists? Chest? Stomach?",
      "Who did you first see do this? A parent? A coach? Someone on the block?",
      "You did not invent this move. You borrowed it. And it worked — once."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together now."},
      {"speaker":"guide","text":"You are about to tell your partner what you just saw."},
      {"speaker":"guide","text":"The breath holds both of you."}
    ],
    "shared_round_cues": [
      "In together. Two people about to be honest.",
      "Your partner named their move last time. Now it is your turn.",
      "The breath is building the bridge for what comes next.",
      "Ready."
    ]
  },
  "kitchen_table": {
    "a_prompt": "What do you do when you feel criticized? When you feel ignored? When you feel unsafe? Name the move. Not as a confession. As a body report. ''When I feel ___, my body does ___.'' Then: who in your family did the same move?",
    "b_prompt": "Listen without fixing. Just listen. Then your turn. Same format. ''When I feel ___, my body does ___.'' And: does your partner''s description surprise you? Did you already know their move?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just named your own move."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That takes more courage than naming your partner''s."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Because now you cannot unsee it."},
      {"speaker":"guide","text":"Next time you make the move — you will catch it."},
      {"speaker":"guide","text":"Maybe not fast enough to stop it."},
      {"speaker":"guide","text":"But fast enough to know."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — watch for the move."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not to fight it. To see it."},
      {"speaker":"guide","text":"And when you catch it — say out loud:"},
      {"speaker":"guide","text":"''That is the move.''"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Your partner heard you name it today."},
      {"speaker":"guide","text":"They will know what you mean."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What is your move — and who taught it to you?",
    "shared_prompt": "Name both moves in one sentence: ''When I ___, you ___. When you ___, I ___.'' "
  }
}'::jsonb WHERE session_number = 4 AND track = 'coupling';

-- ── C05: Repair Rhythm ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module five."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You named your partner''s move. You named your own."},
      {"speaker":"guide","text":"Now — what happens after the moves collide?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you build a way back."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And this time — think about the last argument."},
      {"speaker":"guide","text":"Not what it was about. How it ended."},
      {"speaker":"guide","text":"Did it end? Or did it just stop?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One at a time."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Every couple fights."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That is not the problem."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The problem is what happens after."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Most couples have no way back."},
      {"speaker":"guide","text":"The fight stops. Nobody apologizes. Nobody explains."},
      {"speaker":"guide","text":"You just move on. Pretend it did not happen."},
      {"speaker":"guide","text":"Until the next one."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That is not repair. That is storage."},
      {"speaker":"guide","text":"And everything in storage leaks."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you build a repair protocol."},
      {"speaker":"guide","text":"Six steps. Body first. Words after."},
      {"speaker":"guide","text":"So the next time the moves collide — you have a way back."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"The voice says:"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"We should not have to follow steps. If we loved each other it would just work."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That is the biggest lie about relationships."},
      {"speaker":"guide","text":"Love does not come with a repair manual."},
      {"speaker":"guide","text":"You have to build one yourself."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The protocol is not a sign of weakness."},
      {"speaker":"guide","text":"It is a sign you care enough to build one."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Four minutes alone. Then four together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"While you breathe — think about the last fight that never got resolved."},
      {"speaker":"guide","text":"What happened in your body afterward?"},
      {"speaker":"guide","text":"Where did the unfinished business go?"}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Settle. Think about the last one that just stopped. No resolution. No repair.",
      "Where is it in your body right now? The unfinished fight. It is still in there somewhere.",
      "Your body stored it because your relationship had no place to put it.",
      "Today you build that place."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together now."},
      {"speaker":"guide","text":"Breathe next to the person you fight with."},
      {"speaker":"guide","text":"And next to the person you want to repair with."},
      {"speaker":"guide","text":"Same person."}
    ],
    "shared_round_cues": [
      "In together. The fight and the repair live in the same breath.",
      "Your partner''s body is carrying unfinished business too.",
      "You are about to build something most couples never build.",
      "A way back."
    ]
  },
  "kitchen_table": {
    "a_prompt": "Think about the last argument that did not get resolved. What happened in your body after? Not your thoughts — your body. Did you tighten? Go numb? Want to leave? Then together — build the protocol:",
    "b_prompt": "Same. Then build it together. Six steps: Step one: stop talking. Both of you. Step two: breathe. Individual breath. Two minutes minimum. Step three: one sentence each — ''What happened in my body was...'' Step four: listen. No response. Just witness. Step five: shared breath. Two minutes. No words. Step six: then — and only then — talk about what happened."
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just built something."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not a perfect system. A starting point."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Step one: stop talking."},
      {"speaker":"guide","text":"Step two: breathe."},
      {"speaker":"guide","text":"Step three: body report."},
      {"speaker":"guide","text":"Step four: witness."},
      {"speaker":"guide","text":"Step five: shared breath."},
      {"speaker":"guide","text":"Step six: then talk."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The body settles before the mouth opens."},
      {"speaker":"guide","text":"That is the whole thing."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — practice it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not during a real fight. Not yet."},
      {"speaker":"guide","text":"Pick something small. A disagreement. A tension."},
      {"speaker":"guide","text":"Run the six steps."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The first time should be practice."},
      {"speaker":"guide","text":"So when the real storm comes — the protocol is already in your body."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What is the fight that never got resolved? What is your body still carrying from it?",
    "shared_prompt": "Write the six steps in your own words. This is YOUR repair protocol."
  }
}'::jsonb WHERE session_number = 5 AND track = 'coupling';

-- ── C06: The Bid ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module six."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You have your moves. You have your repair protocol."},
      {"speaker":"guide","text":"Today — the quiet part."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The reach that happens before words."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And this time — did your partner reach for you this week?"},
      {"speaker":"guide","text":"Not with words. With presence."},
      {"speaker":"guide","text":"Did you catch it?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One at a time."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Your partner reached for you today."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Maybe you caught it. Maybe you missed it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"A bid is a reach. A try. A hand extended."},
      {"speaker":"guide","text":"Most bids do not sound like ''I need you.''"},
      {"speaker":"guide","text":"They sound like ''did you see that thing on TV?''"},
      {"speaker":"guide","text":"Or they do not sound like anything at all."},
      {"speaker":"guide","text":"They look like sitting next to you. Walking into the room. Making eye contact."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The body bids before the mouth opens."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And when the bid is missed — the body stops bidding."},
      {"speaker":"guide","text":"One missed bid is nothing."},
      {"speaker":"guide","text":"A hundred missed bids is a wall."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you learn to see the reach."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"The voice says:"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"They should just tell me what they need."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And sometimes they will."},
      {"speaker":"guide","text":"But the most important bids are the ones that cannot be said."},
      {"speaker":"guide","text":"Because the person does not have the words."},
      {"speaker":"guide","text":"Or because saying it feels too risky."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The silent bid is the bravest one."},
      {"speaker":"guide","text":"Learning to catch it is the skill."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Four minutes alone. Then four together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"While you breathe — think about a time you reached for your partner."},
      {"speaker":"guide","text":"And they did not see it."},
      {"speaker":"guide","text":"What did your body do?"}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Think about the reach. The one that was missed.",
      "What did it feel like when they did not see it?",
      "Now think about a time they reached and YOU missed it.",
      "Both of you have missed bids. Both of you have felt invisible. That is the starting point."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together now."},
      {"speaker":"guide","text":"Breathe next to the person whose bids you have missed."},
      {"speaker":"guide","text":"And who has missed yours."}
    ],
    "shared_round_cues": [
      "In together. Two people who have been reaching.",
      "The breath itself is a bid. You are both turning toward it right now.",
      "Co-regulation is what happens when two bids are caught at the same time.",
      "This is what turning toward feels like."
    ]
  },
  "kitchen_table": {
    "a_prompt": "Think of a time this week you wanted connection from your partner but did not say it. What did you do instead? Did you walk into the room? Pick up your phone? Go quiet? Tell your partner what the bid looked like from the outside.",
    "b_prompt": "Same question. And then: did your partner catch the bid? Did they turn toward it? Or did they miss it? No blame. Just data. How often do you see each other''s reaches?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just learned something."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Your partner has been reaching."},
      {"speaker":"guide","text":"In ways you did not recognize."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And you have been reaching too."},
      {"speaker":"guide","text":"In ways they did not see."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Now you both know what the reach looks like."},
      {"speaker":"guide","text":"That changes everything."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — count the bids."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not to keep score."},
      {"speaker":"guide","text":"To see how many reaches happen every day that nobody notices."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And when you catch one — turn toward it."},
      {"speaker":"guide","text":"You do not have to fix anything."},
      {"speaker":"guide","text":"Just turn toward it."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What does your bid for connection look like when you cannot use words?",
    "shared_prompt": "Name one bid your partner made this week that you almost missed."
  }
}'::jsonb WHERE session_number = 6 AND track = 'coupling';

-- ── C07: Capacity Check-In ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module seven."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You have the weather. The moves. The repair protocol. The bids."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today — timing."},
      {"speaker":"guide","text":"Because all of those skills fail when the tank is empty."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And today — add a number."},
      {"speaker":"guide","text":"If ten is full and one is running on nothing — where is your tank?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One at a time. Just the number and the weather."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"You have been learning skills."},
      {"speaker":"guide","text":"Weather reporting. Pattern naming. Repair."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"But here is what nobody tells you about skills:"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"They disappear when the tank is empty."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You cannot name your move when you are running on four hours of sleep."},
      {"speaker":"guide","text":"You cannot run the repair protocol when your body has nothing left."},
      {"speaker":"guide","text":"You cannot catch a bid when you are barely standing."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The skills are real. But they need fuel."},
      {"speaker":"guide","text":"And the fuel is capacity."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Most couples crash because they try to do the hard conversation"},
      {"speaker":"guide","text":"at the wrong time."},
      {"speaker":"guide","text":"Both tanks empty. Both bodies on edge."},
      {"speaker":"guide","text":"The moves fire. The repair fails. The bids get missed."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The fix is simple and almost nobody does it."},
      {"speaker":"guide","text":"Check the tank first."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"The voice says:"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"If they can''t talk about it now — they don''t care enough."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That is fear talking. Not truth."},
      {"speaker":"guide","text":"''Not now'' is not ''never.''"},
      {"speaker":"guide","text":"''Not now'' is ''my body can''t hold this yet.''"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Honoring that is not avoidance."},
      {"speaker":"guide","text":"Honoring that is love."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Four minutes alone. Then four together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"While you breathe — think about a conversation"},
      {"speaker":"guide","text":"that went badly because the timing was wrong."},
      {"speaker":"guide","text":"One of you was not ready. But the other pushed."}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Think about the bad-timing conversation. What was your tank level?",
      "What was your partner''s? Did either of you check?",
      "The conversation might have gone differently at a different time.",
      "Not a different topic. The same topic. Different tank level."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together now."},
      {"speaker":"guide","text":"Breathe next to the person you need a timing protocol with."}
    ],
    "shared_round_cues": [
      "In together. Building something practical.",
      "This is not about avoiding hard conversations.",
      "It is about having them when the body can hold them.",
      "Timing is not weakness. Timing is wisdom."
    ]
  },
  "kitchen_table": {
    "a_prompt": "Think about a conversation that went badly because the timing was wrong. One of you was empty. The other pushed. What happened? What would have been different at a full tank?",
    "b_prompt": "Same. Then build the protocol together: how will you signal ''I can''t do this right now''? Not ''I don''t want to.'' Not ''I don''t care.'' ''My tank is empty and this conversation deserves more than what I have right now.'' What does that signal look like between you?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just built a timing signal."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"A way to say ''I care about this topic''"},
      {"speaker":"guide","text":"''but my body needs time before I can do it well.''"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That is not avoidance."},
      {"speaker":"guide","text":"That is the most respectful thing you can do."},
      {"speaker":"guide","text":"For the conversation. And for each other."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — check the tank before the hard conversation."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Both tanks."},
      {"speaker":"guide","text":"And if either one is below a five — wait."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The conversation will still be there tomorrow."},
      {"speaker":"guide","text":"But tomorrow your body might have more to give it."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What is your tank level right now — honestly?",
    "shared_prompt": "Write the signal: ''When I say ___, it means my tank is empty. Not that I don''t care.''"
  }
}'::jsonb WHERE session_number = 7 AND track = 'coupling';

-- ── C08: Our Blueprint ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module eight."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The foundation is almost complete."},
      {"speaker":"guide","text":"Weather. Moves. Repair. Bids. Timing."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today — the blueprint underneath all of it."},
      {"speaker":"guide","text":"Where did your relationship learn to be a relationship?"}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And today — when you think about your parents'' relationship —"},
      {"speaker":"guide","text":"what is your weather?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One at a time."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Your parents had a relationship."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Maybe it was good. Maybe it was terrible."},
      {"speaker":"guide","text":"Maybe they stayed. Maybe they left."},
      {"speaker":"guide","text":"Maybe you never saw them in the same room."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"It does not matter."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Whatever it was — your body recorded it."},
      {"speaker":"guide","text":"How they fought. How they loved. How they didn''t."},
      {"speaker":"guide","text":"Whether they touched. Whether they talked. Whether they hid."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That recording is running in your relationship right now."},
      {"speaker":"guide","text":"You did not choose it. You did not agree to it."},
      {"speaker":"guide","text":"But it is the blueprint your body is following."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Both of you have a blueprint."},
      {"speaker":"guide","text":"Two blueprints. From two families. Running into each other."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you make both visible."},
      {"speaker":"guide","text":"And you start drawing your own."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"The voice says:"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"We are nothing like my parents."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Maybe."},
      {"speaker":"guide","text":"But your body learned from watching them."},
      {"speaker":"guide","text":"And learned things run quietly."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You do not have to be LIKE your parents"},
      {"speaker":"guide","text":"to be carrying their code."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Four minutes alone. Then four together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"While you breathe — picture your parents in a room."},
      {"speaker":"guide","text":"Not a good day or a bad day. A typical day."},
      {"speaker":"guide","text":"What was the blueprint?"}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "See your parents. A regular day. How are they in the room together?",
      "What is the distance between them? Physical. Emotional.",
      "Now see yourself with your partner. Same question. What is the distance?",
      "If there is a match — that is the blueprint running."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together now."},
      {"speaker":"guide","text":"You both just looked at your parents'' blueprint."},
      {"speaker":"guide","text":"Now breathe next to the person you are building a new one with."}
    ],
    "shared_round_cues": [
      "In together. Two blueprints. Two histories.",
      "Some of what your parents built was good. Keep that.",
      "Some of it was survival. You can set that down.",
      "The blueprint you draw together starts here."
    ]
  },
  "kitchen_table": {
    "a_prompt": "If you could design this relationship from scratch — what code from your parents would you keep? What would you throw out? What would you install new? Three lists. Keep. Stop. Install.",
    "b_prompt": "Same. Then compare lists. What overlaps? What surprises you? Where do your inherited blueprints agree? Where do they collide?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"Two blueprints. Now visible."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Your parents gave you a starting point."},
      {"speaker":"guide","text":"Not a destination."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The relationship you are building does not have to look like theirs."},
      {"speaker":"guide","text":"But now you can see which parts already do."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Seeing is how you choose."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"Eight modules."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You learned your weather."},
      {"speaker":"guide","text":"You felt what your presence does."},
      {"speaker":"guide","text":"You named each other''s moves. And your own."},
      {"speaker":"guide","text":"You built a repair protocol."},
      {"speaker":"guide","text":"You learned to catch the bid."},
      {"speaker":"guide","text":"You learned to check the tank."},
      {"speaker":"guide","text":"And today — you saw the blueprint."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That is the foundation."},
      {"speaker":"guide","text":"Everything that comes next builds on this."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The next chapter depends on where you are headed."},
      {"speaker":"guide","text":"Your path will be there when you are ready."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What pattern from your parents are you most afraid of repeating?",
    "shared_prompt": "Write one line of new code for your relationship. One thing you are installing that your parents did not have."
  }
}'::jsonb WHERE session_number = 8 AND track = 'coupling';

-- ── C09: The Third Nervous System ──
-- NOTE: C09 is structurally shorter — missing check_in, before_the_breath,
-- breathing, shift_moment, close in source. Seeding available phases only.
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module nine."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"This one is about someone who hasn''t arrived yet."},
      {"speaker":"guide","text":"But who is already here."}
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
      {"speaker":"guide","text":"You''re teaching recovery."}
    ]
  },
  "kitchen_table": {
    "a_prompt": "What has the last month been like in your body? Mostly calm? Mostly activated? A mix? If you''re carrying this baby — what weather has the baby been living in? Not to judge. To know.",
    "b_prompt": "For the non-carrying partner: what weather have you been bringing home? When you walk through that door stressed, activated, heavy — that reaches the baby too. Through your partner''s response to you. What do you want to bring home instead?"
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What weather do you want your child''s first year to feel like?",
    "shared_prompt": "Write one sentence to your child about what you''re building for them."
  }
}'::jsonb WHERE session_number = 9 AND track = 'coupling';

-- ── C10: What We Carry Forward ──
-- Expecting parent module. loss_variant fields preserved inline.
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module ten."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Last session you learned something."},
      {"speaker":"guide","text":"Everything you feel — the baby feels too.","loss_variant":"Last session you learned something about what your body carries."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today we go one layer deeper."},
      {"speaker":"guide","text":"Because some of what you feel didn''t start with you."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And today — add something."},
      {"speaker":"guide","text":"When you think about your parents — what''s your weather?"},
      {"speaker":"guide","text":"Not your opinion of them. Your body''s response to them."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One of you go first."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Now the other."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Your parents gave you a lot of things."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Some you chose to keep. Some you didn''t know you had."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The way your dad went quiet when things got hard."},
      {"speaker":"guide","text":"The way your mom made everything fine when it wasn''t."},
      {"speaker":"guide","text":"The way nobody in your house said what they really felt."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Those weren''t just habits. They were instructions."},
      {"speaker":"guide","text":"Your body learned them before you could talk."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And right now — your body is passing instructions to someone new.","loss_variant":"And right now — your body is still running those instructions."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not the ones you chose."},
      {"speaker":"guide","text":"The ones that run in the background."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you make them visible."},
      {"speaker":"guide","text":"Because the ones you can see — you can choose."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"There''s a voice that says:"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"I''ll just do the opposite of what my parents did."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That sounds smart. But it''s still their code running."},
      {"speaker":"guide","text":"The opposite of a pattern is still shaped by the pattern."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Choosing what to keep takes more courage than rejecting everything."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Four minutes alone. Then four together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"During your breath — think about what you got from your parents."},
      {"speaker":"guide","text":"Not what you wish you got. What you actually got."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Some of it kept you alive."},
      {"speaker":"guide","text":"Some of it kept you small."},
      {"speaker":"guide","text":"Today you sort them."}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Settle into your own body. Your parents'' code is in there somewhere.",
      "Think about what you got from your mother. Not the stories — the body response.",
      "Now your father. What did your body learn from watching them?",
      "Some of it was good. Some of it was heavy. Both are real."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together now."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You''re about to talk about what you inherited."},
      {"speaker":"guide","text":"The breath holds both of you while you do."}
    ],
    "shared_round_cues": [
      "In together. Two people carrying two histories.",
      "Your partner''s parents wrote code too. Different code. Same weight.",
      {"text":"Right now your child is receiving from both of you.","loss_variant":"Right now both of you are carrying these instructions."},
      "Breathe. You get to choose what travels forward."
    ]
  },
  "kitchen_table": {
    "a_prompt": "Name one pattern from your parents that you caught yourself doing. Not one you''re proud of — one that surprised you. ''I never wanted to be like that. And then I heard it come out of my mouth.'' Tell your partner. Not the story — the pattern.",
    "b_prompt": "Same. And then together: make two lists. What we keep. What we stop here. Write them down. These are the first instructions for the family you''re building."
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just did something your parents never did."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You looked at what they gave you."},
      {"speaker":"guide","text":"And you chose."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That choice is already changing the code.","loss_variant":"That choice is already changing something."},
      {"speaker":"guide","text":"Not by trying harder. By seeing clearly."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — watch for the inherited moves."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"When you catch yourself doing the thing —"},
      {"speaker":"guide","text":"the thing your parent did —"},
      {"speaker":"guide","text":"don''t judge it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Just say: ''That''s their code. Not mine.''"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Naming it is how you choose."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What pattern from your parents are you most afraid of repeating?",
    "shared_prompt": "Write one thing you''re choosing to stop here — one instruction that doesn''t travel to your child.",
    "shared_prompt_loss_variant": "Write one thing you''re choosing to stop here — one instruction that doesn''t travel any further."
  }
}'::jsonb WHERE session_number = 10 AND track = 'coupling';

-- ── C11: The Triad ──
-- Expecting parent module. Triad breath. Extensive loss_variant fields.
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module eleven."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today is different."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"There are two of you in this room.","loss_variant":"Today you breathe together."},
      {"speaker":"guide","text":"But there are three nervous systems.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The smallest one is listening.","loss_variant":null}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And this time — include the baby in your report.","loss_variant":"How are both of you today?"},
      {"speaker":"guide","text":"What''s the weather between the three of you?","loss_variant":"What''s the weather between you?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One at a time."}
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
      {"speaker":"guide","text":"Rhythm."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Is the world out there calm or wild?"},
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
      {"speaker":"guide","text":"the baby learns the most important thing a body can learn."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Things get hard. And then they get better."},
      {"speaker":"guide","text":"Recovery is possible."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s the first lesson you''re teaching."},
      {"speaker":"guide","text":"Before the nursery. Before the name. Before the birth."},
      {"speaker":"guide","text":"You''re teaching recovery."}
    ],
    "loss_variant_block": "Replace entire opening with standard Coupling shared breath opening from C05 (Repair Rhythm). No baby references."
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"There''s a fear in here."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"What if I can''t give them what they need?","loss_variant":"What if I''m not ready for what comes next?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That fear is honest."},
      {"speaker":"guide","text":"And it means you already care enough to worry."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The baby doesn''t need a perfect parent.","loss_variant":"You don''t need to be perfect."},
      {"speaker":"guide","text":"The baby needs a parent who comes back to calm.","loss_variant":"You need to be someone who comes back to calm."},
      {"speaker":"guide","text":"That''s what this breath is."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Today is the first Triad Breath.","loss_variant":"Today you breathe together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Four minutes alone. Then four together."},
      {"speaker":"guide","text":"But this time — there''s a third ring on the screen.","loss_variant":null},
      {"speaker":"guide","text":"A small one. Between you.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That ring doesn''t have its own heartbeat data yet.","loss_variant":null},
      {"speaker":"guide","text":"It mirrors both of yours. When you''re calm — the baby''s ring is calm.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"[To non-carrying partner:] You can''t feel the baby the way your partner does.","loss_variant":null},
      {"speaker":"guide","text":"But your calm reaches the baby through your partner.","loss_variant":null},
      {"speaker":"guide","text":"When you regulate, your partner regulates.","loss_variant":null},
      {"speaker":"guide","text":"When your partner regulates, the baby regulates.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Your breath reaches all the way through.","loss_variant":null},
      {"speaker":"guide","text":"You are part of this chain.","loss_variant":null}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      {"text":"Find your own rhythm first. The baby waits.","loss_variant":"Find your own rhythm first."},
      {"text":"Notice what your body does when you think about three of you.","loss_variant":"Notice what your body does when you think about what''s ahead."},
      "Every slow breath is a message. Safe. Safe. Safe.",
      {"text":"You''re about to breathe as a family for the first time.","loss_variant":"You''re about to breathe together."}
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Now — together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Three rhythms. Finding each other.","loss_variant":"Two rhythms. Finding each other."}
    ],
    "shared_round_cues": [
      {"text":"In together. Out together. The little one is listening.","loss_variant":"In together. Out together."},
      {"text":"When your rhythms match — the baby''s ring matches too.","loss_variant":"When your rhythms match — something settles."},
      {"text":"Three hearts. One rhythm. This is how families start.","loss_variant":"Two hearts. One rhythm."},
      {"text":"You just taught recovery. Together. As a family.","loss_variant":"You just found each other in the breath."}
    ]
  },
  "kitchen_table": {
    "a_prompt": "What has the last month been like in your body? Mostly calm? Mostly heavy? A mix? If you''re carrying this baby — what weather has the baby been living in? Not to judge. To know.",
    "a_prompt_loss_variant": "What has the last month been like in your body? Mostly calm? Mostly heavy? A mix? What weather have you been carrying?",
    "b_prompt": "For the non-carrying partner: what weather have you been bringing home? When you walk through that door stressed or heavy — that reaches the baby too. Through your partner''s response to you. What do you want to bring home instead?",
    "b_prompt_loss_variant": "What weather have you been bringing into the space between you? When you walk in stressed or heavy — your partner feels it. What do you want to bring instead?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just breathed as three.","loss_variant":"You just breathed together."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The baby felt that.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not because you tried."},
      {"speaker":"guide","text":"Because that''s how bodies work."},
      {"speaker":"guide","text":"Calm is contagious. And the smallest system in the room caught it.","loss_variant":"Calm is contagious. You just proved it."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"From now on — Triad Breath is available to you.","loss_variant":"From now on — shared breath is available to you."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Any time. Short sessions. Eight minutes.","loss_variant":"Any time. Short sessions."},
      {"speaker":"guide","text":"No module. No kitchen table. Just breath."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Three rhythms. Any time you need it.","loss_variant":"Two rhythms. Any time you need it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The baby already knows the feeling.","loss_variant":null}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "When you breathe with your child inside you, what do you feel happening between you?",
    "private_prompt_loss_variant": "What did the shared breath feel like today?",
    "shared_prompt": "What surprised you about breathing as three?",
    "shared_prompt_loss_variant": "What surprised you about breathing together?"
  }
}'::jsonb WHERE session_number = 11 AND track = 'coupling';

-- ── C12: Repair Before Arrival ──
-- Expecting parent module. breath_mode = pendulation_loop
UPDATE session_templates SET dialogue_phases = '{
  "breath_mode": "pendulation_loop",
  "pendulation_spec": {"touch_seconds": 10, "return_seconds": 45},
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module twelve."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Something is coming.","loss_variant":"Something is shifting between you."},
      {"speaker":"guide","text":"And before it arrives — there are things that need attention.","loss_variant":"And some things need attention."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not because they''ll be perfect."},
      {"speaker":"guide","text":"Because you tried."}
    ]
  },
  "check_in": {
    "lines": [
      {"speaker":"guide","text":"Weather check."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And notice — when you think about something unfinished between you —"},
      {"speaker":"guide","text":"what does your body do?"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Name it. Not the issue. The body."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Every couple has something unfinished."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The argument that never got resolved."},
      {"speaker":"guide","text":"The thing that was said and never taken back."},
      {"speaker":"guide","text":"The silence that went on too long."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You know what it is. Your body knows."},
      {"speaker":"guide","text":"It tightens every time the subject gets close."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That tightness — the baby feels it.","loss_variant":"That tightness — your partner feels it."},
      {"speaker":"guide","text":"Not the details. The chemistry.","loss_variant":"Not the details. The body."},
      {"speaker":"guide","text":"Your body floods. Theirs floods too.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The repairs you make now —"},
      {"speaker":"guide","text":"are gifts your child will never have to unwrap.","loss_variant":"are gifts you give your future."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not all of them can be fixed."},
      {"speaker":"guide","text":"Some things you hold with open hands."},
      {"speaker":"guide","text":"But the ones you can reach — reach."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"The voice says:"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"We''ll deal with it after the baby comes.","loss_variant":"We''ll deal with it later."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"But after the baby comes — you''ll be exhausted.","loss_variant":"But later never comes easy."},
      {"speaker":"guide","text":"And exhaustion doesn''t make hard conversations easier."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Now is the time. While you still have room."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Today''s breath uses pendulation."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Anchor. Touch. Return."},
      {"speaker":"guide","text":"You''ll touch the thing that needs repair."},
      {"speaker":"guide","text":"Then you''ll come back."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The touch is short. Ten seconds."},
      {"speaker":"guide","text":"The return is long. Forty-five seconds."},
      {"speaker":"guide","text":"Because recovery matters more than exposure right now.","loss_variant":null}
    ]
  },
  "breathing": {
    "mode": "pendulation",
    "individual_cues": {
      "anchor": "Settle. Feel the ground.",
      "cycles": [
        {"touch": "The unfinished thing. Let it come close for ten seconds.", "return": "Back to the breath. Forty-five seconds of coming home."},
        {"touch": "Again. The same thing. What does your body do now?", "return": "Back. Your body knows how to return."},
        {"touch": "Once more. Is it smaller now? Or just less surprising?", "return": "Return. The return is the skill."},
        {"touch": "Last touch. Just notice. Nothing to fix yet.", "return": "Done. You touched it four times and came back every time."}
      ]
    },
    "shared_transition": [
      {"speaker":"guide","text":"Together now. Triad Breath.","loss_variant":"Together now."},
      {"speaker":"guide","text":"Three rhythms settling.","loss_variant":"Two rhythms settling."}
    ],
    "shared_round_cues": [
      "Breathe together. The repair starts here.",
      "You don''t need to fix it in this breath. Just be with it together.",
      {"text":"The baby is learning what repair looks like. Calm after the hard thing.","loss_variant":"This is what repair feels like. Calm after the hard thing."},
      "Recovery. Together. That''s the gift."
    ]
  },
  "kitchen_table": {
    "a_prompt": "There''s something between us that needs attention. Not to solve it. To name it. Out loud. ''The thing I''ve been carrying about us is ___.'' Then: can it be repaired? Or is this something we hold?",
    "b_prompt": "Listen first. Then your turn. Same format. ''The thing I''ve been carrying about us is ___.'' Then together: which of these can we start? Which ones do we hold with honesty instead of fixing?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just named the unfinished things."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Some can be mended."},
      {"speaker":"guide","text":"Some get carried honestly."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Both count as repair."},
      {"speaker":"guide","text":"Because the opposite of repair isn''t breaking."},
      {"speaker":"guide","text":"The opposite of repair is pretending nothing is broken."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — pick one thing from the list."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"One thing you can start."},
      {"speaker":"guide","text":"Not finish. Start."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Starting is the repair."},
      {"speaker":"guide","text":"The baby doesn''t need parents who fixed everything.","loss_variant":"You don''t need to fix everything."},
      {"speaker":"guide","text":"The baby needs parents who try.","loss_variant":"You need to be someone who tries."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What relationship needs attention before this child enters the world?",
    "private_prompt_loss_variant": "What relationship needs your attention right now?",
    "shared_prompt": "Name one repair you''re going to start this week."
  }
}'::jsonb WHERE session_number = 12 AND track = 'coupling';

-- ── C13: The Capacity Gift ──
-- Expecting parent module. No check_in phase.
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module thirteen."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You''ve been building something."},
      {"speaker":"guide","text":"Naming your weather. Seeing each other''s code. Repairing what needed mending."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today — you build room."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"There''s something coming that will test everything you''ve built.","loss_variant":"There''s something about capacity you need to know."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Four hours of sleep.","loss_variant":null},
      {"speaker":"guide","text":"A baby who won''t stop crying.","loss_variant":null},
      {"speaker":"guide","text":"Your body running on nothing.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And in that moment — everything you learned goes offline."},
      {"speaker":"guide","text":"The weather reporting stops. The pattern-watching stops."},
      {"speaker":"guide","text":"You react. You snap. You say the thing."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s not failure. That''s depletion."},
      {"speaker":"guide","text":"Your window gets narrow when the body has nothing left."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Here''s what matters:"},
      {"speaker":"guide","text":"The wider you build your window NOW —"},
      {"speaker":"guide","text":"the more room you have when depletion comes."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And your child''s window?","loss_variant":null},
      {"speaker":"guide","text":"It starts where yours is.","loss_variant":null},
      {"speaker":"guide","text":"Wide parents. Wide child.","loss_variant":null},
      {"speaker":"guide","text":"That''s the gift.","loss_variant":"That''s the work."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"The voice says: we''ll figure it out."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"And you will. But ''figuring it out'' at 3 AM with no sleep"},
      {"speaker":"guide","text":"looks different than figuring it out right now."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Building capacity before you need it"},
      {"speaker":"guide","text":"is not being negative."},
      {"speaker":"guide","text":"It''s the most loving thing you can do."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Today''s breath goes deeper. Longer exhale."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The longer exhale builds a wider window."},
      {"speaker":"guide","text":"Think of it as stretching. Making room."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Room for the 3 AM. Room for the hard days."},
      {"speaker":"guide","text":"Room for your child to feel everything.","loss_variant":"Room for whatever comes."}
    ]
  },
  "breathing": {
    "individual_round_cues": [
      "Long exhale. Your body is making room.",
      "Think about your hardest day. Your body handled it. This breath makes the next one easier.",
      {"text":"The wider you build this — the more your child has to work with.","loss_variant":"The wider you build this — the more you have to work with."},
      "This is not about surviving. This is about having room to feel."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Triad Breath.","loss_variant":"Together."},
      {"speaker":"guide","text":"Three systems widening together.","loss_variant":"Two systems widening together."}
    ],
    "shared_round_cues": [
      {"text":"Together. Long exhale. Building room as a family.","loss_variant":"Together. Long exhale. Building room."},
      {"text":"Your child will inherit this room. Not through words. Through chemistry.","loss_variant":"This room stays with you. Not through words. Through the body."},
      {"text":"Wide parents. Wide child. That''s the inheritance you''re choosing.","loss_variant":"Wider capacity. That''s what this builds."},
      {"text":"The gift isn''t in the nursery. The gift is in your body right now.","loss_variant":"The gift is in your body right now."}
    ]
  },
  "kitchen_table": {
    "a_prompt": "When you''re running on four hours of sleep and the baby won''t stop crying — what will your body do? Not your plan. Your body. Will you go quiet? Get loud? Freeze? Leave the room? Name it. Because at 3 AM your body runs the program, not your plan.",
    "a_prompt_loss_variant": "When you''re depleted — exhausted, running on nothing — what does your body do? Not your plan. Your body. Will you go quiet? Get loud? Freeze? Walk away?",
    "b_prompt": "Same. Then together: build the protocol. Who breathes first? What''s the signal for ''I''m done, your turn''? What does ''I need help'' look like at 3 AM when words aren''t available?",
    "b_prompt_loss_variant": "Same. Then together: build the protocol. What''s the signal for ''I''m depleted''? What does ''I need you to take this'' look like when words aren''t available?"
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"You just built a plan for when the plan stops working."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s not pessimism."},
      {"speaker":"guide","text":"That''s the most honest thing expecting parents can do.","loss_variant":"That''s the most honest thing two people can do."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The protocol isn''t perfect. It doesn''t have to be."},
      {"speaker":"guide","text":"It just has to exist."},
      {"speaker":"guide","text":"Because at 3 AM — existing is enough."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"This week — practice the signal."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Whatever you decided ''I need help'' looks like —"},
      {"speaker":"guide","text":"use it once. Before you need it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Because the first time should not be at 3 AM."},
      {"speaker":"guide","text":"The first time should be now. While you have room."}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What does ''enough'' feel like in your body right now?",
    "shared_prompt": "Write the 3 AM protocol in one sentence: ''When I''m done, I will ___. When you''re done, you will ___.'' "
  }
}'::jsonb WHERE session_number = 13 AND track = 'coupling';

-- ── C14: Co-Regulation as Parenting ──
-- Ceremony breath. breath_mode = coherent, ceremony_override = true.
-- No check_in phase. Creed assembly and crest declaration.
UPDATE session_templates SET dialogue_phases = '{
  "breath_mode": "coherent",
  "ceremony_override": true,
  "arrival": {
    "lines": [
      {"speaker":"guide","text":"Module fourteen."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The last one."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Not the last breath. Just the last module before the next chapter."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Today you write the founding sentence of your family.","loss_variant":"Today you write something together that will last."}
    ]
  },
  "opening": {
    "lines": [
      {"speaker":"guide","text":"Every parenting book will tell you what to do.","loss_variant":"Every book will tell you what to do."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"When the baby cries, do this.","loss_variant":null},
      {"speaker":"guide","text":"When the toddler acts out, do that.","loss_variant":null},
      {"speaker":"guide","text":"When the teenager pushes back, do the other thing.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"None of them will tell you the truth."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The truth is: your child doesn''t need the right strategy."},
      {"speaker":"guide","text":"Your child needs a calm parent.","loss_variant":"What matters isn''t the right strategy. It''s the right state."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"When you''re calm — you choose better."},
      {"speaker":"guide","text":"When you''re calm — your child feels safe.","loss_variant":"When you''re calm — the people around you feel it."},
      {"speaker":"guide","text":"When you''re calm — mistakes can be repaired."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Your state is the strategy."},
      {"speaker":"guide","text":"Your calm is the intervention."},
      {"speaker":"guide","text":"Your breath is the parenting.","loss_variant":"Your breath is the foundation."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You''ve been practicing this for fourteen modules."},
      {"speaker":"guide","text":"Today you seal it."}
    ]
  },
  "resistance": {
    "lines": [
      {"speaker":"guide","text":"The voice says: but I need to DO something."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You will. You''ll do a thousand things."},
      {"speaker":"guide","text":"But the thing underneath all of them —"},
      {"speaker":"guide","text":"the thing that makes the doing work —"},
      {"speaker":"guide","text":"is the state you''re in when you do it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"A calm parent making the wrong choice"},
      {"speaker":"guide","text":"is better than an activated parent making the right one."},
      {"speaker":"guide","text":"Because the child reads the body, not the decision.","loss_variant":"Because people read the body, not the decision."}
    ]
  },
  "before_the_breath": {
    "lines": [
      {"speaker":"guide","text":"Before we breathe — listen."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Over the last five modules, you wrote something."},
      {"speaker":"guide","text":"One line at a time. In your vault. In your own words."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"[Guide reads the assembled creed — all 5 lines from C09-C13]"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"That''s your creed so far. Five lines."},
      {"speaker":"guide","text":"Today you write the sixth. The declaration."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Then we seal it."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Ceremony breath. Six-six. Equal in. Equal out."},
      {"speaker":"guide","text":"Not because it''s harder. Because it''s balanced."},
      {"speaker":"guide","text":"The way you want your family to be.","loss_variant":"The way you want your life to be."}
    ]
  },
  "breathing": {
    "mode": "ceremony",
    "ratio": "6:6",
    "individual_round_cues": [
      "Equal in. Equal out. Balance.",
      {"text":"Think about the family you are choosing to become.","loss_variant":"Think about what you are choosing to become."},
      {"text":"Not the family you came from. The one you''re building.","loss_variant":"Not what you came from. What you''re building."},
      "Let the breath carry the intention."
    ],
    "shared_transition": [
      {"speaker":"guide","text":"Together. Ceremony breath."},
      {"speaker":"guide","text":"Three rhythms. One intention.","loss_variant":"Two rhythms. One intention."}
    ],
    "shared_round_cues": [
      "In together. Out together. Equal. Balanced.",
      "This is the last shared breath of this curriculum.",
      {"text":"Everything after this — the birth, the first year, the whole life — starts here.","loss_variant":"Everything after this starts here."},
      {"text":"Breathe the family into being.","loss_variant":"Breathe the future into being."}
    ]
  },
  "kitchen_table": {
    "a_prompt": "Write one sentence. The founding sentence of your family. ''This is the family we are choosing to become.'' Not a goal. Not a hope. A declaration. What kind of family are you building?",
    "a_prompt_loss_variant": "Write one sentence. A declaration. ''This is what we are choosing to become.'' Not a goal. Not a hope. A statement. What are you building together?",
    "b_prompt": "Listen to your partner''s sentence. Then write yours. Then together — find the one sentence that holds both. That sentence becomes the declaration on your Family Crest.",
    "b_prompt_loss_variant": "Same exercise. Together — find the one sentence that holds both of you."
  },
  "shift_moment": {
    "lines": [
      {"speaker":"guide","text":"Your creed."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"[Guide reads the full 6-line creed — assembled from C09-C14]"},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Those are your words. Shaped. Sealed."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"They are now inscribed in your Family Crest.","loss_variant":"They are now part of your record."},
      {"speaker":"guide","text":"Version zero. The founding layer.","loss_variant":null},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You can add to them. You can never delete them."},
      {"speaker":"guide","text":"Because growth is additive."},
      {"speaker":"guide","text":"The foundation stays."}
    ]
  },
  "close": {
    "lines": [
      {"speaker":"guide","text":"Fourteen modules."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"You learned your weather."},
      {"speaker":"guide","text":"You named the loop."},
      {"speaker":"guide","text":"You built a repair rhythm."},
      {"speaker":"guide","text":"You sorted what you carry."},
      {"speaker":"guide","text":"You breathed as three.","loss_variant":"You breathed together."},
      {"speaker":"guide","text":"You mended what you could."},
      {"speaker":"guide","text":"You built room."},
      {"speaker":"guide","text":"And you declared your family.","loss_variant":"And you declared what you''re building."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Your child''s first breath will happen inside a family that chose itself.","loss_variant":"You chose each other. That''s not small."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"The breath continues."},
      {"speaker":"guide","text":"The creed grows."},
      {"speaker":"guide","text":"The crest deepens."},
      {"speaker":"guide","text":""},
      {"speaker":"guide","text":"Both of you did something today.","loss_variant":null},
      {"speaker":"guide","text":"All three of you did.","loss_variant":null}
    ]
  },
  "vault": {
    "shared_optional": true,
    "private_prompt": "What kind of nervous system do you want to be for your child?",
    "private_prompt_loss_variant": "What kind of person do you want to be for the people you love?",
    "shared_prompt": "Complete this sentence together: ''Our child will inherit _____.''",
    "shared_prompt_loss_variant": "Complete this sentence together: ''We are choosing to become _____.''",
    "creed_finalization": true,
    "crest_inscription": true
  }
}'::jsonb WHERE session_number = 14 AND track = 'coupling';

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after seeding)
-- ══════════════════════════════════════════════════════════════

-- a) Count: should be 14
-- SELECT COUNT(*) FROM session_templates WHERE track = 'coupling';

-- b) Anti-pattern check: should be 0
-- SELECT session_number FROM session_templates
-- WHERE track = 'coupling'
--   AND (dialogue_phases::text ILIKE '%getting better%'
--     OR dialogue_phases::text ILIKE '%you''re healed%'
--     OR dialogue_phases::text ILIKE '%stronger now%'
--     OR dialogue_phases::text ILIKE '%pushed through%'
--     OR dialogue_phases::text ILIKE '%overcame%');

-- c) Foundation untouched: should match pre-seed count
-- SELECT COUNT(*) FROM session_templates
-- WHERE track = 'foundation' AND dialogue_phases IS NOT NULL;
