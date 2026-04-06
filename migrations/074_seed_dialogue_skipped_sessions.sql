-- Migration 074: Fill 29 previously-skipped sessions via updated parser
-- Sessions: 102, 103, 104, 105, 106, 107, 108, 109, 114, 115, 116, 117, 118, 119, 122, 123, 124, 125, 127, 128, 129, 130, 131, 132, 140, 141, 145, 146, 150

-- ── SESSION 102: The Invisible Rules ── (source: ASCEN_Sessions_S96-S110_Full_Expansion_v2.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and two."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the rules nobody says out loud."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Every family has rules nobody says out loud."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Don''t talk about that."
      },
      {
        "speaker": "luno",
        "text": "Don''t show weakness."
      },
      {
        "speaker": "luno",
        "text": "Always agree."
      },
      {
        "speaker": "luno",
        "text": "Never cry."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "These rules run the system."
      },
      {
        "speaker": "luno",
        "text": "Even when nobody says them."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we name them."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Naming the rules can feel like breaking them."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s the rule protecting itself."
      },
      {
        "speaker": "luno",
        "text": "But you can name a rule and still love the people who made it."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What rules did nobody say out loud? What was you told without words?",
      "Who enforced those rules? Not with punishment. With silence. With looks. With distance.",
      "Which rules do you still follow? Even now?",
      "A rule you can see is a rule you can choose. Keep it or change it."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The invisible rules ran the show."
      },
      {
        "speaker": "luno",
        "text": "Now you can see them."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And what you can see — you can choose."
      }
    ]
  }
}'::jsonb WHERE session_number = 102;

-- ── SESSION 103: The Ledger ── (source: ASCEN_Sessions_S96-S110_Full_Expansion_v2.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and three."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — who owes what."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Families keep a ledger."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Who owes what. Who gave up what."
      },
      {
        "speaker": "luno",
        "text": "Who got more. Who got less."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The ledger is never written down."
      },
      {
        "speaker": "luno",
        "text": "But everyone knows their balance."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we look at the family ledger."
      },
      {
        "speaker": "luno",
        "text": "And ask: is it fair?"
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The ledger was never fair."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But seeing it clearly changes what you accept."
      },
      {
        "speaker": "luno",
        "text": "And what you stop accepting."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes."
      },
      {
        "speaker": "luno",
        "text": "Look at the ledger. Feel if it''s fair."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What did you give to the family? What was expected? What was never paid back?",
      "What was given to you? Was it free? Or did it come with a bill?",
      "Is the ledger fair? Feel the answer in your body.",
      "You don''t owe what you think you owe. Feel what that means."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You saw the ledger."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And you saw it wasn''t fair."
      },
      {
        "speaker": "luno",
        "text": "Now you choose what you carry."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The ledger was never fair."
      },
      {
        "speaker": "luno",
        "text": "You don''t owe what you think you owe."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now you choose what you carry."
      }
    ]
  }
}'::jsonb WHERE session_number = 103;

-- ── SESSION 104: The Story They Tell About You ── (source: ASCEN_Sessions_S96-S110_Full_Expansion_v2.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and four."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — their version of you."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your family has a story about you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The one they tell at holidays."
      },
      {
        "speaker": "luno",
        "text": "The version of you they froze in time."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That story might not be who you are anymore."
      },
      {
        "speaker": "luno",
        "text": "But they keep telling it."
      },
      {
        "speaker": "luno",
        "text": "Because the old version was easier to manage."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we separate their story from your truth."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Their story about you might have been true once."
      },
      {
        "speaker": "luno",
        "text": "But you''ve changed."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "One hundred and four sessions of change."
      },
      {
        "speaker": "luno",
        "text": "Their story hasn''t caught up."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What story does your family tell about you?",
      "Is it still true? Or are they telling an old version?",
      "What''s the real story? The one you know?",
      "Their story is theirs. Your truth is yours."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Their story about you is not your truth."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are the author now."
      }
    ]
  }
}'::jsonb WHERE session_number = 104;

-- ── SESSION 105: Boundaries Are Not Betrayal ── (source: ASCEN_Sessions_S96-S110_Full_Expansion_v2.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and five."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the hardest thing you can do for the people you love."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Setting a boundary with family can feel like betrayal."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Like you''re saying: your love isn''t enough."
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
        "text": "You''re saying: I need space to be who I''m becoming."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Boundaries are not walls."
      },
      {
        "speaker": "luno",
        "text": "They''re doors you choose when to open."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The guilt is real."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But guilt is not evidence."
      },
      {
        "speaker": "luno",
        "text": "It''s the old system trying to pull you back."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "A boundary you need to set. Feel the guilt that comes with it.",
      "Is the guilt real? Or is it the system protecting itself?",
      "The boundary is for you. And it''s also for them. Even if they can''t see that yet.",
      "Boundaries are not betrayal. They''re the price of growth."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Boundaries are not walls."
      },
      {
        "speaker": "luno",
        "text": "They''re doors you choose when to open."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s not betrayal. That''s love with edges."
      }
    ]
  }
}'::jsonb WHERE session_number = 105;

-- ── SESSION 106: The Talk You've Been Putting Off ── (source: ASCEN_Sessions_S96-S110_Full_Expansion_v2.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and six."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the words you haven''t said."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "There is a conversation you''ve been putting off."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "With a parent. A sibling. A child."
      },
      {
        "speaker": "luno",
        "text": "The one that keeps circling but never lands."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we don''t have it."
      },
      {
        "speaker": "luno",
        "text": "We prepare for it."
      },
      {
        "speaker": "luno",
        "text": "We practice staying steady while we hold the words."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The conversation feels dangerous."
      },
      {
        "speaker": "luno",
        "text": "Because it was. Before."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But you have one hundred and six sessions of breath now."
      },
      {
        "speaker": "luno",
        "text": "That changes what dangerous means."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "The conversation. Who is it with? Feel what happens in your body when you picture it.",
      "What do you need to say? Hold the words. Don''t speak them. Just hold them.",
      "Can you hold the words and stay in the breath? Both at the same time?",
      "You just rehearsed the hardest talk of your life. In your body. With your breath."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You practiced holding the words."
      },
      {
        "speaker": "luno",
        "text": "Now you can deliver them."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "When you''re ready."
      }
    ]
  }
}'::jsonb WHERE session_number = 106;

-- ── SESSION 107: What They Gave You ── (source: ASCEN_Sessions_S96-S110_Full_Expansion_v2.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and seven."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the gifts."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Not everything from your family was damage."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "There are gifts too."
      },
      {
        "speaker": "luno",
        "text": "Strength. Humor. Faith."
      },
      {
        "speaker": "luno",
        "text": "Stubbornness that kept people alive."
      },
      {
        "speaker": "luno",
        "text": "A way of laughing that made hard days bearable."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we name what was given to you."
      },
      {
        "speaker": "luno",
        "text": "The good things. The things you want to keep."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "It can feel confusing to honor the gifts from a family that also caused pain."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Both are true."
      },
      {
        "speaker": "luno",
        "text": "The gifts are real. The damage is real."
      },
      {
        "speaker": "luno",
        "text": "You can hold both."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What did your family give you that was good? What strength came through the line?",
      "Where does that gift live in you? How does it show up?",
      "Can you honor the gift without honoring the damage? Both exist. But they''re separate.",
      "You inherited damage and gifts. The gifts are the ones you choose to carry forward."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You inherited damage and gifts."
      },
      {
        "speaker": "luno",
        "text": "Both are real. Both are yours."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Choose what you carry forward."
      }
    ]
  }
}'::jsonb WHERE session_number = 107;

-- ── SESSION 108: The Family You're Building ── (source: ASCEN_Sessions_S96-S110_Full_Expansion_v2.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and eight."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — looking forward."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You get to choose what your family looks like going forward."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not the family you came from."
      },
      {
        "speaker": "luno",
        "text": "The one you''re building."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "What rules will it have?"
      },
      {
        "speaker": "luno",
        "text": "What roles?"
      },
      {
        "speaker": "luno",
        "text": "What will the invisible rules say?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we vision the future family."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Building something new from something broken feels impossible."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But you''ve already started."
      },
      {
        "speaker": "luno",
        "text": "One hundred and eight sessions of building."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What does the family you''re building look like?",
      "What rules does it have? Rules you chose. Not rules you inherited.",
      "What roles? Not assigned — chosen.",
      "The family you''re building starts with the person you are right now."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The family you''re building starts with you."
      },
      {
        "speaker": "luno",
        "text": "Right now."
      },
      {
        "speaker": "luno",
        "text": "In this breath."
      }
    ]
  }
}'::jsonb WHERE session_number = 108;

-- ── SESSION 109: Repair Is Possible ── (source: ASCEN_Sessions_S96-S110_Full_Expansion_v2.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and nine."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the bridge."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Some breaks can be repaired."
      },
      {
        "speaker": "luno",
        "text": "Not all. But some."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Repair doesn''t mean going back to how it was."
      },
      {
        "speaker": "luno",
        "text": "It means building something new between you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we feel what repair would be like."
      },
      {
        "speaker": "luno",
        "text": "Not the repair itself. The possibility of it."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Repair is scary because it means being close to someone who hurt you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But closeness with boundaries is different from closeness without them."
      },
      {
        "speaker": "luno",
        "text": "You have boundaries now."
      },
      {
        "speaker": "luno",
        "text": "One hundred and nine sessions of them."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes."
      },
      {
        "speaker": "luno",
        "text": "Feel the possibility. Not the pressure."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "A relationship that broke. Is there a bridge? Feel if repair is possible.",
      "What would repair feel like? Not perfect. Just possible.",
      "Repair doesn''t erase the break. It builds across it.",
      "If repair is possible — feel that. If it''s not — feel that too. Both are honest."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You felt the possibility."
      },
      {
        "speaker": "luno",
        "text": "Or you felt the truth that it''s not possible."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Both are honest. Both are yours."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Repair doesn''t erase the break."
      },
      {
        "speaker": "luno",
        "text": "It builds a bridge across it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And if the bridge can''t be built — that''s honest too."
      }
    ]
  }
}'::jsonb WHERE session_number = 109;

-- ── SESSION 114: Community as Medicine ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and fourteen."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — why healing is faster together."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The body heals faster in community."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s not a nice idea. That''s how bodies work."
      },
      {
        "speaker": "luno",
        "text": "Steady bodies near each other make each other stronger."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You felt this in the Somatic Mastery Arc."
      },
      {
        "speaker": "luno",
        "text": "Your calm changes a room."
      },
      {
        "speaker": "luno",
        "text": "A room full of calm changes you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Community is not a luxury."
      },
      {
        "speaker": "luno",
        "text": "It''s a tool for healing."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You''ve survived alone."
      },
      {
        "speaker": "luno",
        "text": "That took strength."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But healing alone is the hard way."
      },
      {
        "speaker": "luno",
        "text": "Community is the shortcut your body already knows."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Think of a time you felt stronger because of the people around you.",
      "What did the body do in that moment? Did it ease? Open? Slow down?",
      "That easing is what happens when regulated bodies are near each other.",
      "Community is medicine. Your body already knows the prescription."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Community isn''t a luxury."
      },
      {
        "speaker": "luno",
        "text": "It''s a tool for healing."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And your body already knows how to use it."
      }
    ]
  }
}'::jsonb WHERE session_number = 114;

-- ── SESSION 115: The System That Failed You ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and fifteen."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the failure that wasn''t yours."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Some systems were supposed to help."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Schools. Courts. Programs. Foster care."
      },
      {
        "speaker": "luno",
        "text": "They were built to catch people."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "They didn''t catch you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That failure was real."
      },
      {
        "speaker": "luno",
        "text": "And it wasn''t your fault."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we hold that truth."
      },
      {
        "speaker": "luno",
        "text": "Without being crushed by it."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Talking about the system failing you can bring anger."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Good."
      },
      {
        "speaker": "luno",
        "text": "That anger is honest."
      },
      {
        "speaker": "luno",
        "text": "The system failed. You didn''t."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What system was supposed to help you? Feel what it was like when it didn''t.",
      "That failure wasn''t yours. Let that land.",
      "The anger about the failure is real. Hold it.",
      "The system failed. You survived anyway. Feel the strength in that."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The system failed."
      },
      {
        "speaker": "luno",
        "text": "You didn''t."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You survived what was supposed to help you and didn''t."
      },
      {
        "speaker": "luno",
        "text": "That took everything."
      }
    ]
  }
}'::jsonb WHERE session_number = 115;

-- ── SESSION 116: What You Owe the World ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and sixteen."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — nothing."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You don''t owe the world your healing story."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You don''t owe anyone your forgiveness journey."
      },
      {
        "speaker": "luno",
        "text": "You don''t owe a performance of being okay."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You owe yourself the truth."
      },
      {
        "speaker": "luno",
        "text": "That''s it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Everything else is optional."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "People expect your story."
      },
      {
        "speaker": "luno",
        "text": "They want the lesson. The moral. The ''I''m better now.''"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You don''t owe them that."
      },
      {
        "speaker": "luno",
        "text": "Your truth is for you."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes."
      },
      {
        "speaker": "luno",
        "text": "Feel what freedom from obligation is like."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What do you feel obligated to give the world? The story? The performance? The smile?",
      "What if you owe none of it? What would that feel like?",
      "You owe yourself the truth. Everything else is your choice.",
      "Free from obligation. Feel what that means in your body."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You felt the freedom."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The truth is for you. Everything else is optional."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You owe yourself the truth."
      },
      {
        "speaker": "luno",
        "text": "Everything else is optional."
      }
    ]
  }
}'::jsonb WHERE session_number = 116;

-- ── SESSION 117: Finding Your People ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and seventeen."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the ones who stay."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your people are out there."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not the ones who want something from you."
      },
      {
        "speaker": "luno",
        "text": "Not the ones who need you to perform."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The ones who see you."
      },
      {
        "speaker": "luno",
        "text": "And stay."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we feel what that would be like."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You might not believe your people exist."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s because you''ve been looking through old lenses."
      },
      {
        "speaker": "luno",
        "text": "One hundred and seventeen sessions changed the lenses."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "What would your people feel like? Not what they look like. What they feel like.",
      "Is there anyone in your life now who feels like that? Even a little?",
      "Your people are the ones who stay after they see you.",
      "You are worth staying for. One hundred and seventeen sessions say so."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your people are the ones who stay."
      },
      {
        "speaker": "luno",
        "text": "After they see you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You are worth staying for."
      }
    ]
  }
}'::jsonb WHERE session_number = 117;

-- ── SESSION 118: Giving From Full ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and eighteen."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the check before you give."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You can give to others."
      },
      {
        "speaker": "luno",
        "text": "But only from full."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Giving from empty is not kindness."
      },
      {
        "speaker": "luno",
        "text": "It''s self-harm wearing a mask."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we check: are you giving from full or from empty?"
      },
      {
        "speaker": "luno",
        "text": "The body knows the answer."
      },
      {
        "speaker": "luno",
        "text": "Even when the mind lies about it."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Saying no to others feels selfish."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But giving from empty doesn''t help them."
      },
      {
        "speaker": "luno",
        "text": "It just means two people are running on fumes."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes."
      },
      {
        "speaker": "luno",
        "text": "Check the tank. Be honest."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Check the tank right now. Full? Half? Empty? Be honest.",
      "When you give from empty — where do you feel it? Tired? Resentful? Hollow?",
      "What would giving from full feel like? Generous without draining.",
      "Give from full. Never from empty. The difference changes everything."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You checked the tank."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Full or empty — now you know."
      },
      {
        "speaker": "luno",
        "text": "And knowing changes what you give."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Give from full. Never from empty."
      },
      {
        "speaker": "luno",
        "text": "The difference changes everything."
      }
    ]
  }
}'::jsonb WHERE session_number = 118;

-- ── SESSION 119: The Ripple ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and nineteen."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — what you already give just by breathing."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "When you regulate — the people near you feel it."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your child."
      },
      {
        "speaker": "luno",
        "text": "Your partner."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You might not feel like you''re making a difference."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But the people near you feel it."
      },
      {
        "speaker": "luno",
        "text": "One hundred and nineteen sessions of calm in their world."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Who feels your calm? Even if they can''t name it.",
      "Your breath ripples outward. Into every room you enter.",
      "That''s the contribution. Not a performance. A presence.",
      "You''re already changing the world around you. One breath at a time."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your calm ripples."
      },
      {
        "speaker": "luno",
        "text": "You''re already changing the world around you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "One breath at a time."
      }
    ]
  }
}'::jsonb WHERE session_number = 119;

-- ── SESSION 122: Awareness Revisited ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and twenty-two."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the ladder. Again."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The ladder. Fight. Flight. Freeze."
      },
      {
        "speaker": "luno",
        "text": "You learned this at Session 7."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "One hundred and twenty-two sessions later —"
      },
      {
        "speaker": "luno",
        "text": "the ladder looks different."
      },
      {
        "speaker": "luno",
        "text": "Not because it changed."
      },
      {
        "speaker": "luno",
        "text": "Because you did."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today you climb it at a higher level."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You know this material."
      },
      {
        "speaker": "luno",
        "text": "That''s the point."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Knowing it from here is different from learning it at Session 7."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same ladder."
      },
      {
        "speaker": "luno",
        "text": "Higher rung."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s the spiral."
      }
    ]
  }
}'::jsonb WHERE session_number = 122;

-- ── SESSION 123: Story Revisited ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and twenty-three."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — your story. From here."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Your story. The origin. The turning points."
      },
      {
        "speaker": "luno",
        "text": "The scars and the strengths."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''ve lived with this knowledge for almost a hundred sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "What do you see now that you couldn''t see at Session 23?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The story didn''t change."
      },
      {
        "speaker": "luno",
        "text": "The eyes did."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Looking at the story again might feel unnecessary."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But you see different things from different heights."
      },
      {
        "speaker": "luno",
        "text": "The spiral proves that."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Twelve minutes. Six in. Six out."
      },
      {
        "speaker": "luno",
        "text": "Same story. Higher view."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Your story. Same events. What do you notice now that you missed before?",
      "The origin looks different from one hundred and twenty-three sessions up.",
      "The scars haven''t changed. But the strengths around them have grown.",
      "Same story. Sharper eyes.",
      "What do you understand now that you couldn''t understand then?",
      "The story is the same. You are not.",
      "Feel the difference between hearing your story and owning your story.",
      "Same story. Higher view. That''s the spiral."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same story."
      },
      {
        "speaker": "luno",
        "text": "But you own it now."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s the difference the spiral makes."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same story."
      },
      {
        "speaker": "luno",
        "text": "Sharper eyes."
      }
    ]
  }
}'::jsonb WHERE session_number = 123;

-- ── SESSION 124: Patterns Revisited ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and twenty-four."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — the patterns. From here."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The patterns you mapped."
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
        "text": "Are they weaker now?"
      },
      {
        "speaker": "luno",
        "text": "Louder? Different?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Feel them from here."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The patterns might still fire."
      },
      {
        "speaker": "luno",
        "text": "That''s normal."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But the grip is weaker."
      },
      {
        "speaker": "luno",
        "text": "And the choice is faster."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same patterns."
      },
      {
        "speaker": "luno",
        "text": "Weaker grip."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s the spiral."
      }
    ]
  }
}'::jsonb WHERE session_number = 124;

-- ── SESSION 125: Grief Revisited ── (source: ASCEN_Sessions_S111-S125_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and twenty-five."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — grief. From here."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The losses you held."
      },
      {
        "speaker": "luno",
        "text": "The goodbyes that never finished."
      },
      {
        "speaker": "luno",
        "text": "The weight of sadness."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "From here — one hundred and twenty-five sessions deep —"
      },
      {
        "speaker": "luno",
        "text": "how do they feel?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Not smaller."
      },
      {
        "speaker": "luno",
        "text": "Different."
      },
      {
        "speaker": "luno",
        "text": "Integrated."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Grief doesn''t get lighter."
      },
      {
        "speaker": "luno",
        "text": "Your shoulders get stronger."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Feel the difference."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same grief."
      },
      {
        "speaker": "luno",
        "text": "Stronger shoulders."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Both got bigger."
      }
    ]
  }
}'::jsonb WHERE session_number = 125;

-- ── SESSION 127: The Feeling Map Revisited ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and twenty-seven."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — feelings. From the spiral."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The Feeling Map. Named. Located. Tracked. Measured."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Your vocabulary is richer than most people''s will ever be."
      },
      {
        "speaker": "luno",
        "text": "Feel that precision from here."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "What do you name faster now? What do you catch that you used to miss?"
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Precision is a quiet skill."
      },
      {
        "speaker": "luno",
        "text": "Nobody sees it but you."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "And your body."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Name what you feel right now. How long did it take?",
      "Compare that to Session 71. The speed is the proof.",
      "Sharp words. Calm brain. Same principle. Deeper practice.",
      "What feelings can you name now that you couldn''t before?",
      "The map got richer. Your vocabulary grew.",
      "Same feelings. Sharper words.",
      "That''s the spiral.",
      "Precision at a higher level."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same feelings."
      },
      {
        "speaker": "luno",
        "text": "Sharper words."
      }
    ]
  }
}'::jsonb WHERE session_number = 127;

-- ── SESSION 128: Family Revisited ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and twenty-eight."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — family. From the spiral."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The family system. The roles. The rules. The ledger."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''ve been living with this knowledge."
      },
      {
        "speaker": "luno",
        "text": "How has your relationship with the system changed?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Self before system. That was the order."
      },
      {
        "speaker": "luno",
        "text": "Is it holding?"
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The system pulls."
      },
      {
        "speaker": "luno",
        "text": "It always does."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But your center is stronger than the pull."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "The family system. Feel the pull from here.",
      "Is the pull weaker? Or are you stronger?",
      "Self before system. Feel that order in your body.",
      "What has changed in the family since you changed?",
      "You can''t change the system. But you changed yourself.",
      "And that shifted everything.",
      "Same family. Different you.",
      "That''s the spiral."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same family."
      },
      {
        "speaker": "luno",
        "text": "Different you."
      }
    ]
  }
}'::jsonb WHERE session_number = 128;

-- ── SESSION 129: Community Revisited ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and twenty-nine."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today — belonging. From the spiral."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Belonging. Trust. Community as medicine."
      },
      {
        "speaker": "luno",
        "text": "The ripple effect."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "From one hundred and twenty-nine sessions —"
      },
      {
        "speaker": "luno",
        "text": "how has your place in the world shifted?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Are you more connected? More selective? More present?"
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Connection takes time."
      },
      {
        "speaker": "luno",
        "text": "You''ve been building it. Session by session."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Where do you belong now that you didn''t before?",
      "Who knows you now? Really knows you?",
      "The ripple your calm makes — can you feel it?",
      "Community isn''t a luxury. It''s medicine. Feel it working.",
      "Same world. Stronger roots.",
      "Belonging from the spiral.",
      "You don''t earn belonging. You allow it.",
      "And one hundred and twenty-nine sessions says you''ve earned the right to allow it."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same world."
      },
      {
        "speaker": "luno",
        "text": "Stronger roots."
      }
    ]
  }
}'::jsonb WHERE session_number = 129;

-- ── SESSION 130: Moderate Integration (Milestone) ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and thirty."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Moderate load complete."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Ten sessions of the Spiral at moderate load."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Every arc revisited."
      },
      {
        "speaker": "luno",
        "text": "Body. Awareness. Story. Patterns. Grief."
      },
      {
        "speaker": "luno",
        "text": "Feelings. Rooms. Family. Community."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You handled sixty percent activation without losing your center."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now we go higher."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Higher load means more pressure."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "But you''ve been building pressure tolerance for one hundred and thirty sessions."
      },
      {
        "speaker": "luno",
        "text": "You''re ready."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "One hundred and thirty sessions. Feel the weight of that number.",
      "Every arc. Every concept. Every pattern. Revisited from higher ground.",
      "Moderate load handled. You didn''t lose center.",
      "What does that tell you about what you can handle?",
      "The load goes up. Your capacity goes up with it.",
      "That''s the spiral. Same themes. Higher stakes. You hold.",
      "Moderate complete. Elevated next.",
      "You are ready."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Moderate load complete."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You handled it."
      },
      {
        "speaker": "luno",
        "text": "Now the load goes up."
      }
    ]
  }
}'::jsonb WHERE session_number = 130;

-- ── SESSION 131: Body Under Load ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and thirty-one."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Elevated load begins."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same body work. Higher load."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The activation ceiling is seventy percent now."
      },
      {
        "speaker": "luno",
        "text": "You''ll feel it."
      },
      {
        "speaker": "luno",
        "text": "The touch phases hit harder."
      },
      {
        "speaker": "luno",
        "text": "The returns take more effort."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s by design."
      },
      {
        "speaker": "luno",
        "text": "You''re proving something."
      },
      {
        "speaker": "luno",
        "text": "Not to Luno. To your body."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Higher load can feel like going backward."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It''s not."
      },
      {
        "speaker": "luno",
        "text": "It''s testing what you built at a higher level."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Feel the body at higher activation. What''s different?",
      "The same skills. More pressure. Does the breath still hold?",
      "Seventy percent. The body wants to react. The breath says no.",
      "You are proving something. To your own body.",
      "Higher load. Same center. That''s capacity.",
      "The skills work under pressure. That''s the test.",
      "One hundred and thirty-one sessions. The body holds.",
      "Elevated. And steady."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Higher load."
      },
      {
        "speaker": "luno",
        "text": "Same center."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s mastery under pressure."
      }
    ]
  }
}'::jsonb WHERE session_number = 131;

-- ── SESSION 132: Awareness Under Load ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and thirty-two."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The ladder. Under pressure."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The ladder at seventy percent."
      },
      {
        "speaker": "luno",
        "text": "Can you still climb it when the body is running hot?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Fight. Flight. Freeze."
      },
      {
        "speaker": "luno",
        "text": "Which one does the body reach for under pressure?"
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now — can you choose a different rung?"
      },
      {
        "speaker": "luno",
        "text": "Even at seventy percent?"
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Under load, the body defaults to what it knows."
      },
      {
        "speaker": "luno",
        "text": "But you know more now."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Seventy percent. Which rung does the body grab?",
      "Can you choose a different one? Even now?",
      "The ladder is the same. The load is higher. The choice is still yours.",
      "Under pressure, the old pattern fires. Can you catch it?",
      "Same ladder. Heavier steps. You still climbed.",
      "The skills hold under load. Feel that.",
      "One hundred and thirty-two sessions. The climb gets easier.",
      "Even at seventy percent."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Same ladder. Heavier steps."
      },
      {
        "speaker": "luno",
        "text": "You still climbed."
      }
    ]
  }
}'::jsonb WHERE session_number = 132;

-- ── SESSION 140: Elevated Integration (Milestone) ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and forty."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Elevated load complete."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Ten sessions at seventy percent."
      },
      {
        "speaker": "luno",
        "text": "Every theme tested under higher pressure."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You held."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now — the final tier."
      },
      {
        "speaker": "luno",
        "text": "High load."
      },
      {
        "speaker": "luno",
        "text": "The last five before the capstone."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The final tier is the hardest."
      },
      {
        "speaker": "luno",
        "text": "But one hundred and forty sessions says you''re ready."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Elevated complete. Feel what that means.",
      "Every skill tested at seventy percent. Every one held.",
      "The load goes higher. Eighty percent.",
      "But your capacity went higher too.",
      "That''s the spiral. The load rises. You rise with it.",
      "One hundred and forty sessions. You are not the same person.",
      "The final tier is ahead.",
      "You are ready."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Elevated load complete."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now the real test."
      },
      {
        "speaker": "luno",
        "text": "High load. The final five."
      }
    ]
  }
}'::jsonb WHERE session_number = 140;

-- ── SESSION 141: Full Body at Peak ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and forty-one."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Eighty percent."
      },
      {
        "speaker": "luno",
        "text": "This is the edge."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Eighty percent."
      },
      {
        "speaker": "luno",
        "text": "Your body is running hot."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The activation is real."
      },
      {
        "speaker": "luno",
        "text": "The skills are being tested at the edge of your window."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today we stay in the breath at the highest load you''ve faced."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Eighty percent feels like the body is about to break the rules."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It won''t."
      },
      {
        "speaker": "luno",
        "text": "One hundred and forty-one sessions of practice won''t let it."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Eighty percent. Feel the heat.",
      "The body is running hot. The breath is still here.",
      "The skills are at their edge. Do they hold?",
      "Higher load than anything before. Same breath.",
      "You are proving what one hundred and forty-one sessions built.",
      "The edge of the window. And you''re still breathing.",
      "Eighty percent. You held.",
      "That''s the ceiling they said you''d never reach."
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Eighty percent. You held."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s the ceiling they said you''d never reach."
      }
    ]
  }
}'::jsonb WHERE session_number = 141;

-- ── SESSION 145: High Load Integration ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and forty-five."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "High load complete."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Five sessions at eighty percent."
      },
      {
        "speaker": "luno",
        "text": "You held."
      },
      {
        "speaker": "luno",
        "text": "Every skill tested at the edge."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Now — the capstone."
      },
      {
        "speaker": "luno",
        "text": "Five sessions designed to break your regulation."
      },
      {
        "speaker": "luno",
        "text": "On purpose."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''ll recover."
      },
      {
        "speaker": "luno",
        "text": "That''s the whole point."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Breaking on purpose sounds wrong."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "It''s not."
      },
      {
        "speaker": "luno",
        "text": "The test isn''t staying perfect."
      },
      {
        "speaker": "luno",
        "text": "The test is coming back."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "High load complete."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The capstone is next."
      },
      {
        "speaker": "luno",
        "text": "It''s designed to break you."
      },
      {
        "speaker": "luno",
        "text": "On purpose."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You''ll come back."
      },
      {
        "speaker": "luno",
        "text": "That''s the whole point."
      }
    ]
  }
}'::jsonb WHERE session_number = 145;

-- ── SESSION 146: Decision Under Ambiguity ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and forty-six."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Today is different from anything so far."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You will be asked to decide."
      },
      {
        "speaker": "luno",
        "text": "Without enough information."
      },
      {
        "speaker": "luno",
        "text": "While doubt tells you that you''re wrong."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is a stress test."
      },
      {
        "speaker": "luno",
        "text": "Your regulation will be tested on purpose."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The goal is not to stay calm."
      },
      {
        "speaker": "luno",
        "text": "The goal is to come back."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "You decided without certainty."
      },
      {
        "speaker": "luno",
        "text": "Doubt showed up."
      },
      {
        "speaker": "luno",
        "text": "Information shifted."
      },
      {
        "speaker": "luno",
        "text": "You acted anyway."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That is decision stability."
      }
    ]
  }
}'::jsonb WHERE session_number = 146;

-- ── SESSION 150: Full System Overload ── (source: ASCEN_Sessions_S126-S150_Full_Expansion.md)
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "luno",
        "text": "One hundred and fifty."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The final session."
      },
      {
        "speaker": "luno",
        "text": "Everything at once."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Everything activates at once."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The regulation will fail."
      },
      {
        "speaker": "luno",
        "text": "On purpose."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The six-six breath will stop working."
      },
      {
        "speaker": "luno",
        "text": "You will need to change how you breathe."
      },
      {
        "speaker": "luno",
        "text": "Not the count. The depth."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "This is the master stress test."
      },
      {
        "speaker": "luno",
        "text": "Not survival. Adaptation."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "One hundred and fifty sessions built this moment."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "luno",
        "text": "The regulation will fail."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That''s not the test."
      },
      {
        "speaker": "luno",
        "text": "Recovering from the failure — that''s the test."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You will recover."
      },
      {
        "speaker": "luno",
        "text": "One hundred and fifty sessions guarantees it."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "luno",
        "text": "Everything activated."
      },
      {
        "speaker": "luno",
        "text": "Coordination broke."
      },
      {
        "speaker": "luno",
        "text": "Regulation failed."
      },
      {
        "speaker": "luno",
        "text": "Then recovered."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "You restored your own baseline."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "That is full system integration."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "One hundred and fifty sessions."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Revolution One is complete."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "The breath goes with you."
      },
      {
        "speaker": "luno",
        "text": "Into every room. Every talk. Every moment."
      },
      {
        "speaker": "luno",
        "text": ""
      },
      {
        "speaker": "luno",
        "text": "Luno will be here."
      },
      {
        "speaker": "luno",
        "text": "Whenever you come back."
      }
    ]
  }
}'::jsonb WHERE session_number = 150;

