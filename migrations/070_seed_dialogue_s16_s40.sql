-- ── SESSION 16: The Archaeology Begins ── (source: ASCEN_Sessions_S16-S30_Enhanced_Narrative_Spec.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Something shifts today."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "For fifteen sessions, you learned about your nervous system."
      },
      {
        "speaker": "luno",
        "text": "How it works. Why it fires. Where the exit is."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now we turn the lens on your story."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "This is the Integration Arc."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is not about blame."
      },
      {
        "speaker": "luno",
        "text": "It is about archaeology."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "We are going to dig — gently —"
      },
      {
        "speaker": "luno",
        "text": "into the strategies you built to survive your life."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Every one of those strategies was intelligent."
      },
      {
        "speaker": "luno",
        "text": "Every one of them solved a real problem."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Shutting down when the yelling started. That was a strategy."
      },
      {
        "speaker": "luno",
        "text": "Going hard before someone could go hard on you. Strategy."
      },
      {
        "speaker": "luno",
        "text": "Making yourself invisible. Not needing anyone. Keeping score."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The question is not whether those strategies were wrong."
      },
      {
        "speaker": "luno",
        "text": "The question is whether they''re still necessary."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Looking at this stuff is hard."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not because you''re weak."
      },
      {
        "speaker": "luno",
        "text": "Because these strategies are wired deep."
      },
      {
        "speaker": "luno",
        "text": "They''ve been running since before you had words for them."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You don''t have to dismantle anything today."
      },
      {
        "speaker": "luno",
        "text": "You just have to see it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Seeing is enough."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Eight minutes. Your breath pattern today."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, let one strategy come to mind."
      },
      {
        "speaker": "luno",
        "text": "One thing you learned to do to survive."
      },
      {
        "speaker": "luno",
        "text": "Don''t chase it. Let it find you."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In... and out. What strategy comes to mind? Don''t force it.",
      "That strategy was a solution. It solved a real problem.",
      "The child who built it was intelligent. Resourceful. Surviving.",
      "Is it still necessary? Just ask. Don''t answer yet.",
      "The breath holds you while you look.",
      "You just named something real about yourself. That takes courage.",
      "Sixteen sessions. You''re doing the deepest work now."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just looked at a survival strategy."
      },
      {
        "speaker": "luno",
        "text": "Not to judge it. Not to fix it."
      },
      {
        "speaker": "luno",
        "text": "Just to see it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That is how integration begins."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "This is the Integration Arc."
      },
      {
        "speaker": "luno",
        "text": "We dig to understand. Not to judge."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your strategies were intelligent."
      },
      {
        "speaker": "luno",
        "text": "You were intelligent."
      }
    ]
  }
}'::jsonb WHERE session_number = 16;

-- ── SESSION 17: The Survival Strategies ── (source: ASCEN_Sessions_S16-S30_Enhanced_Narrative_Spec.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Seventeen sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Yesterday you started digging."
      },
      {
        "speaker": "luno",
        "text": "Today we go a little deeper."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You developed strategies to cope with your environment."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Maybe you learned to read a room before you walked in."
      },
      {
        "speaker": "luno",
        "text": "Maybe you learned to be louder than the threat."
      },
      {
        "speaker": "luno",
        "text": "Maybe you learned to disappear."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Every one of those strategies kept you alive."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The problem is not the strategy."
      },
      {
        "speaker": "luno",
        "text": "The problem is when a strategy designed for a war zone"
      },
      {
        "speaker": "luno",
        "text": "is still running in peacetime."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Reading every room is exhausting when you''re safe."
      },
      {
        "speaker": "luno",
        "text": "Being the loudest voice costs you when the threat is gone."
      },
      {
        "speaker": "luno",
        "text": "Disappearing means people can''t find you. Even the ones who want to."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your strategies were intelligent."
      },
      {
        "speaker": "luno",
        "text": "You were intelligent."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The question is whether they''re still serving you."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Letting go of a strategy feels dangerous."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Because the strategy WAS safety."
      },
      {
        "speaker": "luno",
        "text": "Dropping it feels like dropping your guard."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Nobody is asking you to drop your guard."
      },
      {
        "speaker": "luno",
        "text": "Just to notice that you''re holding it."
      },
      {
        "speaker": "luno",
        "text": "And to ask — right now, in this room — is the guard necessary?"
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Eight and a half minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Let one strategy sit with you while you breathe."
      },
      {
        "speaker": "luno",
        "text": "Honor it. And question it."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In... and out. What strategy are you still carrying?",
      "When did it start? How old were you when you first needed it?",
      "It worked. It kept you alive. Honor that.",
      "Now ask: is the environment that required it still here?",
      "You don''t have to drop it. Just loosen your grip. See what happens.",
      "Seventeen sessions of breath. You have something now that you didn''t have then.",
      "You were intelligent then. You are intelligent now. And now you have options."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just held a survival strategy in one hand"
      },
      {
        "speaker": "luno",
        "text": "and the breath in the other."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s what integration looks like."
      },
      {
        "speaker": "luno",
        "text": "Not throwing away what saved you."
      },
      {
        "speaker": "luno",
        "text": "Learning when to set it down."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your strategies were not flaws."
      },
      {
        "speaker": "luno",
        "text": "They were solutions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The question is not whether they were wrong."
      },
      {
        "speaker": "luno",
        "text": "It''s whether they''re still necessary."
      }
    ]
  }
}'::jsonb WHERE session_number = 17;

-- ── SESSION 18: The Shame Cycle ── (source: ASCEN_Sessions_S16-S30_Enhanced_Narrative_Spec.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Eighteen sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today is heavy. Luno knows that."
      },
      {
        "speaker": "luno",
        "text": "We''re going to go slow."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Shame."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not guilt. Guilt says: I did something wrong."
      },
      {
        "speaker": "luno",
        "text": "Shame says: I AM something wrong."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Shame is not a moral judgment."
      },
      {
        "speaker": "luno",
        "text": "It is a biological signal."
      },
      {
        "speaker": "luno",
        "text": "It evolved to keep you connected to your group."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "When you did something the group didn''t accept —"
      },
      {
        "speaker": "luno",
        "text": "shame was the signal that said: fix this or you''ll be cast out."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That signal had a purpose."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But for a lot of people, shame stopped being a signal."
      },
      {
        "speaker": "luno",
        "text": "It became a state."
      },
      {
        "speaker": "luno",
        "text": "A way of being."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The feeling of being fundamentally wrong."
      },
      {
        "speaker": "luno",
        "text": "Not because of what you did."
      },
      {
        "speaker": "luno",
        "text": "But because of who you are."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s chronic shame."
      },
      {
        "speaker": "luno",
        "text": "And it lives in your body."
      },
      {
        "speaker": "luno",
        "text": "In your chest. In your gut. In the way you can''t hold eye contact."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Shame is not the truth about you."
      },
      {
        "speaker": "luno",
        "text": "It is a feeling in your body."
      },
      {
        "speaker": "luno",
        "text": "And feelings can change."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Nine minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, let shame be present."
      },
      {
        "speaker": "luno",
        "text": "Not to process it. Just to sit beside it."
      },
      {
        "speaker": "luno",
        "text": "The breath holds both of you."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Nine minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, let shame be present."
      },
      {
        "speaker": "luno",
        "text": "Not to process it. Just to sit beside it."
      },
      {
        "speaker": "luno",
        "text": "The breath holds both of you."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In... and out. If shame showed up — let it be here. You don''t have to do anything with it.",
      "Where do you feel it? In your chest? Your gut? Your face?",
      "That feeling is not a verdict. It is a sensation. And sensations move.",
      "Shame says you are wrong. The breath says you are here. Both are talking. Listen to the breath.",
      "Eighteen sessions of showing up. That is not what a broken person does.",
      "Shame is losing power right now. Because you''re looking at it.",
      "It doesn''t like being seen. That''s how you know it''s not the truth.",
      "The truth doesn''t hide from your attention. Shame does."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just sat with shame."
      },
      {
        "speaker": "luno",
        "text": "For nine minutes."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It''s still here. But it''s not as loud."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s what happens when shame is witnessed."
      },
      {
        "speaker": "luno",
        "text": "It doesn''t disappear."
      },
      {
        "speaker": "luno",
        "text": "It just stops running the show."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Shame is not the truth about you."
      },
      {
        "speaker": "luno",
        "text": "It is a feeling in your body."
      },
      {
        "speaker": "luno",
        "text": "And feelings can change."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You just proved that."
      }
    ]
  }
}'::jsonb WHERE session_number = 18;

-- ── SESSION 19: The Patterns I Inherited ── (source: ASCEN_Sessions_S16-S30_Enhanced_Narrative_Spec.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Nineteen sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Let the room hold you."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The way you respond to stress —"
      },
      {
        "speaker": "luno",
        "text": "to conflict, to love, to silence —"
      },
      {
        "speaker": "luno",
        "text": "you learned it by watching."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Someone in your life modeled how to handle anger."
      },
      {
        "speaker": "luno",
        "text": "Someone modeled what love looks like."
      },
      {
        "speaker": "luno",
        "text": "Someone modeled whether trust is safe."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You didn''t choose those models."
      },
      {
        "speaker": "luno",
        "text": "You inherited them."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And now — years later — you catch yourself"
      },
      {
        "speaker": "luno",
        "text": "responding exactly like they did."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The same jaw clench. The same silence."
      },
      {
        "speaker": "luno",
        "text": "The same explosion. The same withdrawal."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is not blame."
      },
      {
        "speaker": "luno",
        "text": "It is a map."
      },
      {
        "speaker": "luno",
        "text": "And maps can be redrawn."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Naming where your patterns came from can feel like betrayal."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Like you''re blaming the people who raised you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This isn''t blame."
      },
      {
        "speaker": "luno",
        "text": "They inherited their patterns too."
      },
      {
        "speaker": "luno",
        "text": "From people who inherited theirs."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The chain goes back generations."
      },
      {
        "speaker": "luno",
        "text": "You didn''t start it."
      },
      {
        "speaker": "luno",
        "text": "But you might be the one who sees it."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Nine and a half minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, notice one pattern you recognize."
      },
      {
        "speaker": "luno",
        "text": "And notice where you first saw it."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In... and out. What pattern do you recognize in yourself?",
      "Where did you first see it? Who was doing it before you?",
      "They didn''t choose it either. They learned it the same way you did.",
      "The chain goes back. But you are the one who is aware of it.",
      "Awareness is the first line on a new map.",
      "You are not your patterns. You are the one who can see them.",
      "Nineteen sessions. You are redrawing the map.",
      "What pattern are you choosing to break?"
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just saw the inheritance."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not to blame anyone."
      },
      {
        "speaker": "luno",
        "text": "To understand where the map came from."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now you can draw a new one."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Patterns are inherited."
      },
      {
        "speaker": "luno",
        "text": "Maps can be redrawn."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are not your patterns."
      },
      {
        "speaker": "luno",
        "text": "You are the one who can see them."
      }
    ]
  }
}'::jsonb WHERE session_number = 19;

-- ── SESSION 20: The First Bridge ── (source: ASCEN_Sessions_S16-S30_Enhanced_Narrative_Spec.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Halfway through the Integration Arc."
      },
      {
        "speaker": "luno",
        "text": "You''ve been doing this work. And someone in your life is waiting."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "This work has been solo."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You. The breath. The room."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But healing doesn''t finish in isolation."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Somewhere in your life — maybe close, maybe far away —"
      },
      {
        "speaker": "luno",
        "text": "there is someone who has shown up for you."
      },
      {
        "speaker": "luno",
        "text": "Imperfectly. Maybe inconsistently."
      },
      {
        "speaker": "luno",
        "text": "But they showed up."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "A friend. A partner. A counselor. A cellmate who had your back."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Trust is the hardest thing."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "When trust has been broken — over and over —"
      },
      {
        "speaker": "luno",
        "text": "reaching toward someone feels like putting your hand on a hot stove."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''re not wrong to be cautious."
      },
      {
        "speaker": "luno",
        "text": "But caution and connection can exist at the same time."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The bridge doesn''t have to carry everything."
      },
      {
        "speaker": "luno",
        "text": "It just has to hold one step."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Ten minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, think of one person."
      },
      {
        "speaker": "luno",
        "text": "One person who showed up."
      },
      {
        "speaker": "luno",
        "text": "Hold them in your mind while you breathe."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In... and out. Who comes to mind? One person.",
      "What did their presence mean to you? Don''t overthink it. Just feel it.",
      "Even imperfect connection changes the nervous system.",
      "Your body was designed for connection. It''s not weakness. It''s biology.",
      "The bridge doesn''t have to be perfect. It just has to hold one step.",
      "Twenty sessions of breath. You''re building something to stand on.",
      "The person you''re thinking of — they''re part of this.",
      "Connection is not a reward for healing. It is part of the healing."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just built a bridge."
      },
      {
        "speaker": "luno",
        "text": "In your mind. In your body."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "One person. One connection."
      },
      {
        "speaker": "luno",
        "text": "That''s where it starts."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Connection is not a reward for healing."
      },
      {
        "speaker": "luno",
        "text": "It is part of the healing."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your breath today was strong."
      }
    ]
  }
}'::jsonb WHERE session_number = 20;

-- ── SESSION 21: The Archaeology Arc Begins ── (source: ASCEN_Sessions_S16-S30_Enhanced_Narrative_Spec.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-one sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The deepest dig starts now."
      },
      {
        "speaker": "luno",
        "text": "You are the archaeologist. You hold the brush."
      },
      {
        "speaker": "luno",
        "text": "You decide how deep to go."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "What is the earliest memory you have of feeling unsafe?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You don''t need to go into detail."
      },
      {
        "speaker": "luno",
        "text": "You don''t need to name anyone."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Just notice where that memory lives in your body."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "There''s a place in your tissue that holds it."
      },
      {
        "speaker": "luno",
        "text": "A tightness. A coldness. A weight."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "We are not going in to relive it."
      },
      {
        "speaker": "luno",
        "text": "We are going in to understand where it sits."
      },
      {
        "speaker": "luno",
        "text": "And to breathe while we''re there."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Ten and a half minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Let the memory be present if it comes."
      },
      {
        "speaker": "luno",
        "text": "If it doesn''t — just breathe."
      },
      {
        "speaker": "luno",
        "text": "Both are the right answer."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Ten and a half minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Let the memory be present if it comes."
      },
      {
        "speaker": "luno",
        "text": "If it doesn''t — just breathe."
      },
      {
        "speaker": "luno",
        "text": "Both are the right answer."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In... and out. Whatever comes — let it come. Whatever doesn''t — let it not.",
      "If a memory surfaced — notice where it lives in your body. Don''t chase it. Just notice.",
      "You are not reliving it. You are witnessing it. From here. With the breath.",
      "The person in that memory didn''t have what you have now.",
      "Twenty-one sessions of practice. That''s what you have that they didn''t.",
      "The breath is the brush. Gentle. Patient. Not forcing anything loose.",
      "You decide how deep. The breath follows.",
      "You just touched something important. The breath will hold you.",
      "You are safe. In this room. Right now."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You went somewhere."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Maybe deep. Maybe just a step."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Either way — you went there with the breath."
      },
      {
        "speaker": "luno",
        "text": "And you came back."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The archaeology is not about going back to live there."
      },
      {
        "speaker": "luno",
        "text": "It''s about going back to understand."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And you can always come back to the breath."
      }
    ]
  }
}'::jsonb WHERE session_number = 21;

-- ── SESSION 22: The Body Map ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-two sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we go into the body."
      },
      {
        "speaker": "luno",
        "text": "Not to fix it. To listen."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your body has been keeping the score."
      },
      {
        "speaker": "luno",
        "text": "Long before you knew the game was being played."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Every hard thing that happened left a mark."
      },
      {
        "speaker": "luno",
        "text": "Not a scar you can see."
      },
      {
        "speaker": "luno",
        "text": "A sensation you can feel."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Tightness in the chest. Weight in the stomach."
      },
      {
        "speaker": "luno",
        "text": "A jaw that never fully unclenches."
      },
      {
        "speaker": "luno",
        "text": "Shoulders that sit an inch too high."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "These aren''t random."
      },
      {
        "speaker": "luno",
        "text": "They''re the body''s account of the story."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we listen to that account."
      },
      {
        "speaker": "luno",
        "text": "Not the events. Not who did what."
      },
      {
        "speaker": "luno",
        "text": "Just the sensations."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The body doesn''t always want to be listened to."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It held this stuff for a reason."
      },
      {
        "speaker": "luno",
        "text": "Quiet. Hidden. Below the surface."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Listening doesn''t mean forcing it to talk."
      },
      {
        "speaker": "luno",
        "text": "It means being present. With what''s already there."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Eleven minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, scan your body."
      },
      {
        "speaker": "luno",
        "text": "Not looking for problems. Just noticing what''s there."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Start at your head. Is there tension? Heat? Weight? Just notice.",
      "Move to your jaw. Your neck. Your shoulders. What are they holding?",
      "Your chest. Is it open? Tight? Heavy? Light? No judgment. Just notice.",
      "Your stomach. Your gut. What lives there? What does it feel like?",
      "Your hands. Open or closed? Relaxed or ready?",
      "Your legs. Your feet. Are they grounded? Restless? Numb?",
      "Now feel the whole body at once. Where is the weight? Where is the lightness?",
      "The body does not lie. And it does not need to be fixed. It needs to be heard.",
      "You just listened. That changes everything."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just made a body map."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not on paper. In your attention."
      },
      {
        "speaker": "luno",
        "text": "You know where the weight sits now."
      },
      {
        "speaker": "luno",
        "text": "That''s not nothing. That''s awareness."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The body keeps the score."
      },
      {
        "speaker": "luno",
        "text": "Today you listened to the account."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It doesn''t need to be fixed."
      },
      {
        "speaker": "luno",
        "text": "It needs to be heard."
      }
    ]
  }
}'::jsonb WHERE session_number = 22;

-- ── SESSION 23: The Origin Story ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-three."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today goes deeper than anything so far."
      },
      {
        "speaker": "luno",
        "text": "Your body is ready. Twenty-three sessions says so."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Every person has an origin story."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not the story of what they did."
      },
      {
        "speaker": "luno",
        "text": "The story of what was done to them."
      },
      {
        "speaker": "luno",
        "text": "And around them."
      },
      {
        "speaker": "luno",
        "text": "Before they had any choice."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The house you grew up in had a temperature."
      },
      {
        "speaker": "luno",
        "text": "Not the thermostat. The emotional temperature."
      },
      {
        "speaker": "luno",
        "text": "Warm or cold. Predictable or chaotic. Safe or on edge."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That temperature shaped everything."
      },
      {
        "speaker": "luno",
        "text": "How you learned to attach. How you learned to protect yourself."
      },
      {
        "speaker": "luno",
        "text": "What you learned to expect from love."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Understanding the origin is not an excuse."
      },
      {
        "speaker": "luno",
        "text": "It is a map."
      },
      {
        "speaker": "luno",
        "text": "And maps give you options."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Going back to the origin can feel dangerous."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Like opening a door you locked for a reason."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You don''t have to walk through the whole house."
      },
      {
        "speaker": "luno",
        "text": "Just stand in the doorway."
      },
      {
        "speaker": "luno",
        "text": "And notice what temperature it was."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Eleven and a half minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Let the conditions come to mind. Not the events."
      },
      {
        "speaker": "luno",
        "text": "Just the conditions."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What were the conditions? Not blame. Just conditions.",
      "What was the temperature of the house? Warm? Cold? Unpredictable?",
      "Who was safe? Who wasn''t? Who was supposed to be?",
      "The child in those conditions did the best they could.",
      "You are not that child anymore. But you carry what they learned.",
      "Understanding the origin doesn''t change it. It gives you a map.",
      "The map is not the territory. You are not trapped there.",
      "You did not choose your origin. You can choose your next chapter.",
      "Twenty-three sessions. You are drawing a new map."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just stood in the doorway."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You felt the temperature."
      },
      {
        "speaker": "luno",
        "text": "And you didn''t break."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Every person has an origin story."
      },
      {
        "speaker": "luno",
        "text": "Now you know the temperature of yours."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You did not choose your origin."
      },
      {
        "speaker": "luno",
        "text": "You can choose your next chapter."
      }
    ]
  }
}'::jsonb WHERE session_number = 23;

-- ── SESSION 24: The Turning Points ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-four sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Settle in."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your story is not a straight line."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It bends."
      },
      {
        "speaker": "luno",
        "text": "At certain points, the whole path shifted."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Some of those points were chosen."
      },
      {
        "speaker": "luno",
        "text": "A decision you made. A risk you took. A door you opened."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Some were not."
      },
      {
        "speaker": "luno",
        "text": "Something happened TO you. A loss. An arrest. A betrayal."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Both kinds are turning points."
      },
      {
        "speaker": "luno",
        "text": "Both brought you here."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Some turning points are hard to look at."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Because you can see where the path could have gone differently."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This isn''t about regret."
      },
      {
        "speaker": "luno",
        "text": "It''s about seeing the whole map. Not just the last turn."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, let the turning points come."
      },
      {
        "speaker": "luno",
        "text": "Not all of them. Just the ones that feel heaviest."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What are the turning points? The moments where the path bent?",
      "Not just the hard ones. The moments of grace too.",
      "Someone who showed up. A decision you made. A door that opened.",
      "Your story bends at these points. Feel where they sit in your body.",
      "Some turning points were forced on you. Those are real.",
      "Some you chose. Even when it was hard. Those are real too.",
      "All of them brought you here. To this room. To this breath.",
      "What do you notice about those moments now? From here?",
      "You are still turning. The story isn''t over.",
      "Twenty-four sessions. That''s a turning point right there."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just saw the bends in your path."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "From here, you can see how each one led to the next."
      },
      {
        "speaker": "luno",
        "text": "And how all of them led here."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your story is not a straight line."
      },
      {
        "speaker": "luno",
        "text": "It bends. And you are still turning."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your breath today was strong."
      }
    ]
  }
}'::jsonb WHERE session_number = 24;

-- ── SESSION 25: The Strengths in the Scars ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-five sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today is different."
      },
      {
        "speaker": "luno",
        "text": "Today we talk about what you built."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Survival required something of you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Intelligence. Adaptability. Endurance."
      },
      {
        "speaker": "luno",
        "text": "The ability to read a room in half a second."
      },
      {
        "speaker": "luno",
        "text": "The ability to stay calm when everything is falling apart."
      },
      {
        "speaker": "luno",
        "text": "The ability to keep going when most people would stop."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Those are not small things."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The scars are real."
      },
      {
        "speaker": "luno",
        "text": "And so are the muscles you built to carry them."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "It might feel strange to call these strengths."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Because they came from pain."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But the fact that they came from pain doesn''t make them less real."
      },
      {
        "speaker": "luno",
        "text": "It makes them harder to see."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, name what you built."
      },
      {
        "speaker": "luno",
        "text": "Not what was done to you. What you built because of it."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What did survival demand of you? What skills did you build?",
      "Reading people. Staying calm under fire. Thinking fast.",
      "Those are strengths. Not damage. Strengths.",
      "The scars are real. And so are the muscles you built to carry them.",
      "What do you know how to do because of what you went through?",
      "That is not something that happened to you. That is something you built.",
      "Twenty-five sessions. You are turning survival into something more.",
      "The scars don''t disappear. The strengths don''t either.",
      "Feel the strength in your breath right now. That''s you.",
      "You are stronger than you know. And now you''re starting to know it."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just named something."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not the wound."
      },
      {
        "speaker": "luno",
        "text": "The muscle that grew around it."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The scars are real."
      },
      {
        "speaker": "luno",
        "text": "So are the strengths they built."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are the foundation of who you are becoming."
      }
    ]
  }
}'::jsonb WHERE session_number = 25;

-- ── SESSION 26: The Cycle Breaker ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-six."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today is about what you leave behind."
      },
      {
        "speaker": "luno",
        "text": "Not in this room. In the world."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Every generation has a chance to break a cycle."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not because the previous generation was evil."
      },
      {
        "speaker": "luno",
        "text": "Because they didn''t have the tools."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your grandparents passed patterns to your parents."
      },
      {
        "speaker": "luno",
        "text": "Your parents passed them to you."
      },
      {
        "speaker": "luno",
        "text": "Not by choice. By repetition."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The anger that runs in your family."
      },
      {
        "speaker": "luno",
        "text": "The silence. The distance. The way love shows up as control."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "None of that started with you."
      },
      {
        "speaker": "luno",
        "text": "But it can end with you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are building the tools right now."
      },
      {
        "speaker": "luno",
        "text": "In this breath."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Breaking a cycle feels like betrayal."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Like you''re saying: what they did was wrong."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''re not saying that."
      },
      {
        "speaker": "luno",
        "text": "You''re saying: I have something they didn''t."
      },
      {
        "speaker": "luno",
        "text": "And I''m going to use it."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "What cycle do you most want to break?"
      },
      {
        "speaker": "luno",
        "text": "Hold it while you breathe."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What cycle do you most want to break? In your family? In your community?",
      "That cycle didn''t start with you. It started before you were born.",
      "But you''re the one who sees it. That''s not a burden. That''s a gift.",
      "The tools your parents had were the tools they were given.",
      "You are building new tools. Twenty-six sessions of new tools.",
      "Breaking a cycle doesn''t mean erasing the past.",
      "It means choosing differently in the present.",
      "What would it mean for the people who come after you?",
      "You are the one who changes the story.",
      "For everyone who comes next."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just held the cycle in your hands."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And you didn''t pass it on."
      },
      {
        "speaker": "luno",
        "text": "That''s what breaking looks like."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Every generation has a chance."
      },
      {
        "speaker": "luno",
        "text": "You are the chance."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are the one who changes the story."
      },
      {
        "speaker": "luno",
        "text": "For everyone who comes next."
      }
    ]
  }
}'::jsonb WHERE session_number = 26;

-- ── SESSION 27: The Identity I Chose ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-seven."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today is about you. Not the version of you other people see."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You have been given many labels."
      },
      {
        "speaker": "luno",
        "text": ""
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Some labels feel true."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not because they''re accurate."
      },
      {
        "speaker": "luno",
        "text": "Because you''ve worn them so long they feel like skin."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Peeling a label off doesn''t erase what happened."
      },
      {
        "speaker": "luno",
        "text": "It just reveals that you''re more than one word."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, notice the labels."
      },
      {
        "speaker": "luno",
        "text": "And notice what''s underneath."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What labels have you been given? Don''t judge them. Just list them.",
      "Which ones were given by people who knew you? Which by people who didn''t?",
      "Which ones did you start to believe?",
      "A label is not an identity. It''s a shortcut someone else used.",
      "If every label was removed — what would remain?",
      "There is a you underneath all of it.",
      "Twenty-seven sessions of breath built something no label can touch.",
      "You are more than every label you have ever been given.",
      "Who are you choosing to be?",
      "That''s the identity that matters."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just felt the space underneath the labels."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That space is you."
      },
      {
        "speaker": "luno",
        "text": "Not the label. You."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You are more than every label you have ever been given."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are the one who chooses now."
      }
    ]
  }
}'::jsonb WHERE session_number = 27;

-- ── SESSION 28: The Letter ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-eight."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today is quiet."
      },
      {
        "speaker": "luno",
        "text": "Let it be."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "There is a younger version of you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Who went through everything you''ve been describing."
      },
      {
        "speaker": "luno",
        "text": "In these sessions. In the vault. In the quiet moments after."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "They didn''t have what you have now."
      },
      {
        "speaker": "luno",
        "text": "They didn''t have twenty-eight sessions of breath."
      },
      {
        "speaker": "luno",
        "text": "They didn''t have the words for what was happening."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "They did the best they could."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today, you write them a letter."
      },
      {
        "speaker": "luno",
        "text": "Not on paper. In your body."
      },
      {
        "speaker": "luno",
        "text": "With the breath."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You don''t have to say everything."
      },
      {
        "speaker": "luno",
        "text": "Just what they needed to hear."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes. Mostly silence."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Let the letter write itself."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Picture the younger version of you. Whatever age comes to mind.",
      "What were they carrying?",
      "What do you want them to know?",
      "Not advice. Not a lecture. Just — what do you wish someone had said?",
      "That child is still in your body. They can hear this.",
      "Tell them.",
      "You just offered your younger self something they needed. That is healing."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just wrote the letter."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not with words."
      },
      {
        "speaker": "luno",
        "text": "With breath."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The younger version of you heard it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Because they live in your body."
      },
      {
        "speaker": "luno",
        "text": "And the breath reaches everywhere."
      }
    ]
  }
}'::jsonb WHERE session_number = 28;

-- ── SESSION 29: The Legacy Vault Entry ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twenty-nine."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Almost at the end of the Integration Arc."
      },
      {
        "speaker": "luno",
        "text": "Today — you leave something behind."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You''ve spent the Integration Arc digging."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Survival strategies. Shame. Patterns."
      },
      {
        "speaker": "luno",
        "text": "The origin story. The turning points. The scars and the strengths."
      },
      {
        "speaker": "luno",
        "text": "The cycle. The labels. The letter."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we look forward."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The Legacy Vault is a record."
      },
      {
        "speaker": "luno",
        "text": "Not of who you were."
      },
      {
        "speaker": "luno",
        "text": "Of who you are becoming."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "What you put in the vault today — your family can hear it."
      },
      {
        "speaker": "luno",
        "text": "Your children. Your partner. The people you love."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is your timestamp."
      },
      {
        "speaker": "luno",
        "text": "Proof that you were here. Doing this work. Choosing differently."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You might not feel ready to make a statement about who you''re becoming."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s okay."
      },
      {
        "speaker": "luno",
        "text": "The vault doesn''t need a finished product."
      },
      {
        "speaker": "luno",
        "text": "It needs the truth. Right now. Today."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes. Your pattern."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "As you breathe, ask: who am I becoming?"
      },
      {
        "speaker": "luno",
        "text": "Not who you were told to be. Who you''re choosing."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Who are you becoming?",
      "Not who you were told to be. Not who the blueprint made. Who you are choosing.",
      "What do you want the people you love to know?",
      "This is your Legacy Vault entry. A record. A timestamp.",
      "Twenty-nine sessions in. This is who I am right now.",
      "The vault isn''t a finish line. It''s a marker.",
      "Proof that you were here. Doing this work. Choosing differently.",
      "Your breath today carries everything you''ve built.",
      "What you write today — the people who matter will hear it.",
      "Make it true."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just felt who you''re becoming."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now write it down."
      },
      {
        "speaker": "luno",
        "text": "In the vault."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The Legacy Vault is a record of who you are becoming."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your breath today was strong."
      }
    ]
  }
}'::jsonb WHERE session_number = 29;

-- ── SESSION 30: The Bridge ── (source: ASCEN_Sessions_S22-S30_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s a number."
      },
      {
        "speaker": "luno",
        "text": "Let it land."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The body. The mind. The story."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You learned to breathe."
      },
      {
        "speaker": "luno",
        "text": "Then you learned why it works."
      },
      {
        "speaker": "luno",
        "text": "Then you turned it on your own story."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And you didn''t break."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are standing on a bridge."
      },
      {
        "speaker": "luno",
        "text": "Behind you — the work you''ve done."
      },
      {
        "speaker": "luno",
        "text": "Ahead — the work you''re ready for."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You might not feel ready for what''s next."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Thirty sessions and the voice still says: not enough."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your body says otherwise."
      },
      {
        "speaker": "luno",
        "text": "Trust the body."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes. The last breath of the Integration Arc."
      },
      {
        "speaker": "luno",
        "text": "Let it be deep."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What has changed in you since Session 1?",
      "In your body. In your mind. In how you see yourself.",
      "The person who walked into this room thirty sessions ago —",
      "— is not the person breathing right now.",
      "You learned to breathe. Then you learned why it works.",
      "Then you turned it on your own story. And you didn''t break.",
      "You are standing on a bridge. The foundation is behind you.",
      "Ahead — the Repatterning Arc. Deeper work. Harder work.",
      "You are ready.",
      "Thirty sessions. Your body said so."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You built a foundation."
      },
      {
        "speaker": "luno",
        "text": "Now we build on it."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The Integration Arc is complete."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You know your body. Your story. Your patterns."
      },
      {
        "speaker": "luno",
        "text": "You know the strengths inside the scars."
      },
      {
        "speaker": "luno",
        "text": "You wrote a letter to the child who survived it."
      },
      {
        "speaker": "luno",
        "text": "And you sealed a record of who you''re becoming."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "What comes next is different."
      },
      {
        "speaker": "luno",
        "text": "The Repatterning Arc."
      },
      {
        "speaker": "luno",
        "text": "We stop mapping the patterns."
      },
      {
        "speaker": "luno",
        "text": "And start changing them."
      }
    ]
  }
}'::jsonb WHERE session_number = 30;

-- ── SESSION 31: The First Pattern ── (source: ASCEN_Sessions_S31-S40_Enhanced_Narrative_Spec.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Something changes today."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "For thirty sessions, you built safety."
      },
      {
        "speaker": "luno",
        "text": "Learned your system. Excavated your story."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now the work shifts."
      },
      {
        "speaker": "luno",
        "text": "We''re not just understanding the patterns anymore."
      },
      {
        "speaker": "luno",
        "text": "We''re practicing new ones."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "When you were young and the world felt dangerous —"
      },
      {
        "speaker": "luno",
        "text": "your brain did something intelligent."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It scanned the environment for the person who seemed safest."
      },
      {
        "speaker": "luno",
        "text": "Strongest. Most protected."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And you started to model yourself after them."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not consciously. Not by choice."
      },
      {
        "speaker": "luno",
        "text": "Your nervous system chose for you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is called Survival Modeling."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The way you walk. The way you talk."
      },
      {
        "speaker": "luno",
        "text": "The way you hold yourself in a room."
      },
      {
        "speaker": "luno",
        "text": "The mask you wear when you feel small."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Some of that came from you."
      },
      {
        "speaker": "luno",
        "text": "And some of it came from the person you modeled."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we look at who you chose."
      },
      {
        "speaker": "luno",
        "text": "And why."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The person you modeled might be someone you love."
      },
      {
        "speaker": "luno",
        "text": "Or someone you hate."
      },
      {
        "speaker": "luno",
        "text": "Or both."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Looking at this doesn''t mean rejecting them."
      },
      {
        "speaker": "luno",
        "text": "It means seeing what your nervous system borrowed."
      },
      {
        "speaker": "luno",
        "text": "And deciding what''s still yours."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Today the breath changes."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "We''re going to do something new. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Here''s how it works."
      },
      {
        "speaker": "luno",
        "text": "First — sixty seconds of calm breathing. Anchor phase."
      },
      {
        "speaker": "luno",
        "text": "Then — fifteen seconds where Luno asks you to briefly touch the pattern."
      },
      {
        "speaker": "luno",
        "text": "Then — thirty seconds of breath to come back."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Touch and return. Three times."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You will not stay in the hard thing."
      },
      {
        "speaker": "luno",
        "text": "You will touch it and come back."
      },
      {
        "speaker": "luno",
        "text": "The breath will bring you back every time."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just did something your nervous system has never done."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You touched the pattern."
      },
      {
        "speaker": "luno",
        "text": "And you came back."
      },
      {
        "speaker": "luno",
        "text": "Three times."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That is repatterning."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Survival Modeling kept you alive."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You modeled what you needed to survive."
      },
      {
        "speaker": "luno",
        "text": "Now you get to choose what to keep."
      },
      {
        "speaker": "luno",
        "text": "And what to put down."
      }
    ]
  }
}'::jsonb WHERE session_number = 31;

-- ── SESSION 32: The Honor Defense ── (source: ASCEN_Sessions_S31-S40_Enhanced_Narrative_Spec.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty-two sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we go into the Honor Defense."
      },
      {
        "speaker": "luno",
        "text": "This one hits close."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "For some people, disrespect is not an insult."
      },
      {
        "speaker": "luno",
        "text": "It is a threat."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not a social threat. A survival threat."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "When you grew up in an environment where losing respect"
      },
      {
        "speaker": "luno",
        "text": "meant losing safety — your nervous system wired them together."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Disrespect became a physical trigger."
      },
      {
        "speaker": "luno",
        "text": "The same activation as a punch. Or a threat on your life."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is called the Honor Defense."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It is not a character flaw."
      },
      {
        "speaker": "luno",
        "text": "It is a survival strategy."
      },
      {
        "speaker": "luno",
        "text": "Born from a time and a place where it was necessary."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The Honor Defense kept you safe."
      },
      {
        "speaker": "luno",
        "text": "The question is: is it still keeping you safe?"
      },
      {
        "speaker": "luno",
        "text": "Or is it costing you?"
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Part of you might be thinking: if I let the Honor Defense go —"
      },
      {
        "speaker": "luno",
        "text": "people will disrespect me."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Nobody is asking you to let it go."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "We''re asking: can you choose WHEN to use it?"
      },
      {
        "speaker": "luno",
        "text": "Instead of it choosing for you?"
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Three rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "During the touch — we''re going to briefly contact"
      },
      {
        "speaker": "luno",
        "text": "the feeling of being disrespected."
      },
      {
        "speaker": "luno",
        "text": "Fifteen seconds. Then the breath brings you back."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''ve done this before. You can do it again."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just touched the fire three times."
      },
      {
        "speaker": "luno",
        "text": "And came back three times."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The Honor Defense kept you safe."
      },
      {
        "speaker": "luno",
        "text": "Now you get to decide when to use it."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The Honor Defense is not the enemy."
      },
      {
        "speaker": "luno",
        "text": "It was the solution."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now you have a choice."
      },
      {
        "speaker": "luno",
        "text": "That''s the difference."
      }
    ]
  }
}'::jsonb WHERE session_number = 32;

-- ── SESSION 33: The First Map ── (source: ASCEN_Sessions_S33-S40_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty-three."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we talk about places."
      },
      {
        "speaker": "luno",
        "text": "The ones your body still remembers."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Pain doesn''t just live in your body."
      },
      {
        "speaker": "luno",
        "text": "It lives in places."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The smell of a house."
      },
      {
        "speaker": "luno",
        "text": "The sound of a street."
      },
      {
        "speaker": "luno",
        "text": "The color of a wall."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your body filed those things along with what happened there."
      },
      {
        "speaker": "luno",
        "text": "The place itself became part of the threat."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "So when you go back to a place like that —"
      },
      {
        "speaker": "luno",
        "text": "even years later —"
      },
      {
        "speaker": "luno",
        "text": "your body acts like it''s still happening."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s not you being weak."
      },
      {
        "speaker": "luno",
        "text": "That''s your body trying to keep you safe."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Some places still have a hold on you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s okay."
      },
      {
        "speaker": "luno",
        "text": "Today we just touch it."
      },
      {
        "speaker": "luno",
        "text": "And come back."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Three rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "During the touch — bring a place to mind."
      },
      {
        "speaker": "luno",
        "text": "A place that still fires your body up."
      },
      {
        "speaker": "luno",
        "text": "Fifteen seconds. Then the breath brings you back."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just went to a place."
      },
      {
        "speaker": "luno",
        "text": "And you came back."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The place is still there."
      },
      {
        "speaker": "luno",
        "text": "But you''re not trapped in it."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The map is not the place."
      },
      {
        "speaker": "luno",
        "text": "And you are not stuck there."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You just made the first map."
      }
    ]
  }
}'::jsonb WHERE session_number = 33;

-- ── SESSION 34: The Felt Minus ── (source: ASCEN_Sessions_S33-S40_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty-four."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today is quiet and deep."
      },
      {
        "speaker": "luno",
        "text": "We go underneath."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Under the Honor Defense."
      },
      {
        "speaker": "luno",
        "text": "Under all the armor."
      },
      {
        "speaker": "luno",
        "text": "There is a feeling."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The feeling of being small."
      },
      {
        "speaker": "luno",
        "text": "Of not being enough."
      },
      {
        "speaker": "luno",
        "text": "Of being out in the open with nothing to hide behind."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is called the Felt Minus."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It''s not a flaw."
      },
      {
        "speaker": "luno",
        "text": "Every person on earth knows this feeling."
      },
      {
        "speaker": "luno",
        "text": "Every person has built armor to cover it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The armor was built to protect it."
      },
      {
        "speaker": "luno",
        "text": "But the armor is not you."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Three rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "During the touch — feel what''s under the armor."
      },
      {
        "speaker": "luno",
        "text": "Fifteen seconds. Then back."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Three rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "During the touch — feel what''s under the armor."
      },
      {
        "speaker": "luno",
        "text": "Fifteen seconds. Then back."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just looked under the armor."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The Felt Minus is real."
      },
      {
        "speaker": "luno",
        "text": "But it is not the truth about you."
      },
      {
        "speaker": "luno",
        "text": "It is a feeling. And feelings change."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The armor was built to cover the Felt Minus."
      },
      {
        "speaker": "luno",
        "text": "Now you''ve seen what''s underneath."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are not the feeling."
      },
      {
        "speaker": "luno",
        "text": "You are the one who can see it."
      }
    ]
  }
}'::jsonb WHERE session_number = 34;

-- ── SESSION 35: The Internal Heckler ── (source: ASCEN_Sessions_S33-S40_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty-five."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we meet the voice."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "There is a voice in your head."
      },
      {
        "speaker": "luno",
        "text": "You know the one."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It says you''ll fail."
      },
      {
        "speaker": "luno",
        "text": "That people are judging you."
      },
      {
        "speaker": "luno",
        "text": "That you''re not worth it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That voice is not your voice."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It''s the voice of someone whose approval used to mean your safety."
      },
      {
        "speaker": "luno",
        "text": "A parent. A teacher. A person who held power over you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You took their voice inside."
      },
      {
        "speaker": "luno",
        "text": "And it''s been running ever since."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is the Internal Heckler."
      },
      {
        "speaker": "luno",
        "text": "It was trying to protect you from shame."
      },
      {
        "speaker": "luno",
        "text": "By predicting it first."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The Heckler feels like the truth."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Because it''s been talking so long."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But truth doesn''t hide from your attention."
      },
      {
        "speaker": "luno",
        "text": "The Heckler does."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Four rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "During the touch — listen to the Heckler."
      },
      {
        "speaker": "luno",
        "text": "Not to believe it. To hear it."
      },
      {
        "speaker": "luno",
        "text": "Then come back."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You heard the voice."
      },
      {
        "speaker": "luno",
        "text": "And you didn''t follow it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s the beginning of turning down the volume."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The Internal Heckler was trying to help."
      },
      {
        "speaker": "luno",
        "text": "But it''s been running the show too long."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now you know its voice."
      },
      {
        "speaker": "luno",
        "text": "And you know it''s not yours."
      }
    ]
  }
}'::jsonb WHERE session_number = 35;

-- ── SESSION 36: The Body Remembers the Place ── (source: ASCEN_Sessions_S33-S40_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty-six."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Back to places today."
      },
      {
        "speaker": "luno",
        "text": "Deeper this time."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "When you walk back into a place where something bad happened —"
      },
      {
        "speaker": "luno",
        "text": "even years later —"
      },
      {
        "speaker": "luno",
        "text": "your body acts like it''s still happening."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your heart speeds up."
      },
      {
        "speaker": "luno",
        "text": "Your muscles tighten."
      },
      {
        "speaker": "luno",
        "text": "Your stomach drops."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s not weakness."
      },
      {
        "speaker": "luno",
        "text": "That''s your body doing what it learned."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The problem is — your body doesn''t know that time passed."
      },
      {
        "speaker": "luno",
        "text": "It thinks the threat is still there."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we teach the body the difference between then and now."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Some places still own a piece of you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s not a failure."
      },
      {
        "speaker": "luno",
        "text": "It''s a sign that the body is still protecting you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "We''re not taking away the protection."
      },
      {
        "speaker": "luno",
        "text": "We''re updating it."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Four rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "Touch the place. Feel what the body does."
      },
      {
        "speaker": "luno",
        "text": "Then come back to right now."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You went to the place four times."
      },
      {
        "speaker": "luno",
        "text": "And came back four times."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The body is learning."
      },
      {
        "speaker": "luno",
        "text": "Then is then. Now is now."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your body holds the memory of every place."
      },
      {
        "speaker": "luno",
        "text": "But it can learn the difference between then and now."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s what you just practiced."
      }
    ]
  }
}'::jsonb WHERE session_number = 36;

-- ── SESSION 37: The Survivorship Mindset ── (source: ASCEN_Sessions_S33-S40_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty-seven."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we talk about the scanning."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The scanning."
      },
      {
        "speaker": "luno",
        "text": "The guarding."
      },
      {
        "speaker": "luno",
        "text": "The part of you that never fully relaxes."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Always reading the room."
      },
      {
        "speaker": "luno",
        "text": "Always watching the door."
      },
      {
        "speaker": "luno",
        "text": "Always ready."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s not a problem with you."
      },
      {
        "speaker": "luno",
        "text": "That''s a smart response to a world that was truly dangerous."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The issue is — your body can''t tell the difference"
      },
      {
        "speaker": "luno",
        "text": "between the dangerous past and the possibly safe present."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The scanning was the answer."
      },
      {
        "speaker": "luno",
        "text": "Now it''s become the problem."
      },
      {
        "speaker": "luno",
        "text": "And the breath is the tool that teaches the body the difference."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Turning off the scanner feels like dropping your guard."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Nobody is asking you to turn it off."
      },
      {
        "speaker": "luno",
        "text": "Just to notice that it''s running."
      },
      {
        "speaker": "luno",
        "text": "And to ask — right now — is it needed?"
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Four rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "We touch the scanning. And come back."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Did you feel it?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That moment where the scanning stopped?"
      },
      {
        "speaker": "luno",
        "text": "Even for a second?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s what the other side feels like."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The scanning kept you alive."
      },
      {
        "speaker": "luno",
        "text": "Now you get to choose when it runs."
      }
    ]
  }
}'::jsonb WHERE session_number = 37;

-- ── SESSION 38: The Emotional Hoard ── (source: ASCEN_Sessions_S33-S40_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty-eight."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we talk about why small things feel so big."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Have you ever gone off about something small?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Someone says one thing. And the reaction is ten times bigger than it should be."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s not you being crazy."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "When something painful happens — a put-down, a rejection, a betrayal —"
      },
      {
        "speaker": "luno",
        "text": "your body stores it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And the next time something similar happens —"
      },
      {
        "speaker": "luno",
        "text": "the body doesn''t just feel THIS moment."
      },
      {
        "speaker": "luno",
        "text": "It feels every moment like it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is called Emotional Hoarding."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "A small slight feels like the end of the world"
      },
      {
        "speaker": "luno",
        "text": "because it''s not just this one."
      },
      {
        "speaker": "luno",
        "text": "It''s every one."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "People told you that you overreact."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You don''t."
      },
      {
        "speaker": "luno",
        "text": "You react to the whole stack."
      },
      {
        "speaker": "luno",
        "text": "That''s different."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Four rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "During the touch — feel the stack."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just felt the difference."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Between this moment and every moment like it."
      },
      {
        "speaker": "luno",
        "text": "That''s how the hoard gets sorted."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Small things feel big because the body stacks them."
      },
      {
        "speaker": "luno",
        "text": "Now you can see the stack."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And start pulling them apart."
      }
    ]
  }
}'::jsonb WHERE session_number = 38;

-- ── SESSION 39: The Pattern Interrupt ── (source: ASCEN_Sessions_S33-S40_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Thirty-nine."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''ve mapped all the patterns."
      },
      {
        "speaker": "luno",
        "text": "Today you practice stopping one."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You know the patterns now."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Survival Modeling. The Honor Defense."
      },
      {
        "speaker": "luno",
        "text": "The Felt Minus. The Heckler."
      },
      {
        "speaker": "luno",
        "text": "The Emotional Hoard."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now we practice something new."
      },
      {
        "speaker": "luno",
        "text": "The Pattern Interrupt."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "A pattern interrupt is a choice."
      },
      {
        "speaker": "luno",
        "text": "Made in the moment."
      },
      {
        "speaker": "luno",
        "text": "To respond differently."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not by pushing the feeling down."
      },
      {
        "speaker": "luno",
        "text": "By making a gap between the feeling and the reaction."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''ve been practicing that gap since Session 10."
      },
      {
        "speaker": "luno",
        "text": "Now you use it."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You might think: the pattern is too strong."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It was."
      },
      {
        "speaker": "luno",
        "text": "Before thirty-nine sessions of breath."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now you have a tool it doesn''t."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Four rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "Feel the pattern pull. And don''t follow it."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just interrupted the pattern."
      },
      {
        "speaker": "luno",
        "text": "Four times."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Every time you choose the breath over the reaction —"
      },
      {
        "speaker": "luno",
        "text": "the pattern gets weaker."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The Pattern Interrupt is a choice."
      },
      {
        "speaker": "luno",
        "text": "Made in the moment."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You practiced it today."
      },
      {
        "speaker": "luno",
        "text": "Now take it outside this room."
      }
    ]
  }
}'::jsonb WHERE session_number = 39;

-- ── SESSION 40: The Patterns in Relationships ── (source: ASCEN_Sessions_S33-S40_Full_Dialogue_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Forty."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Last session of the Repatterning Arc."
      },
      {
        "speaker": "luno",
        "text": "Today we bring it home."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Every pattern we''ve looked at —"
      },
      {
        "speaker": "luno",
        "text": "the modeling, the defense, the hoard, the heckler —"
      },
      {
        "speaker": "luno",
        "text": "they don''t just live inside you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "They show up in your relationships."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "In how you trust. Or don''t."
      },
      {
        "speaker": "luno",
        "text": "In how you fight. Or go quiet."
      },
      {
        "speaker": "luno",
        "text": "In how you love. Or hold back."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The patterns were built in relationships."
      },
      {
        "speaker": "luno",
        "text": "They can only be healed in relationships."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The work ahead is not just about healing yourself."
      },
      {
        "speaker": "luno",
        "text": "It''s about learning to be with people in a new way."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Changing a pattern by yourself is hard enough."
      },
      {
        "speaker": "luno",
        "text": "Changing it in a relationship is harder."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Because the other person has patterns too."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You can only change your side."
      },
      {
        "speaker": "luno",
        "text": "But your side is enough to shift the whole thing."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Four rounds. Anchor. Touch. Return."
      },
      {
        "speaker": "luno",
        "text": "Think of one relationship where the patterns show up most."
      }
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You just saw the patterns in a relationship."
      },
      {
        "speaker": "luno",
        "text": "And you saw the choice."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s what forty sessions builds."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The Repatterning Arc is complete."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You mapped every pattern."
      },
      {
        "speaker": "luno",
        "text": "Survival Modeling. The Honor Defense. The Felt Minus."
      },
      {
        "speaker": "luno",
        "text": "The Heckler. The Emotional Hoard. The Pattern Interrupt."
      },
      {
        "speaker": "luno",
        "text": "And now — the patterns in relationships."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The work ahead is not just about healing yourself."
      },
      {
        "speaker": "luno",
        "text": "It''s about learning to be with people in a new way."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Forty sessions."
      },
      {
        "speaker": "luno",
        "text": "You are not the same person who walked in."
      }
    ]
  }
}'::jsonb WHERE session_number = 40;

