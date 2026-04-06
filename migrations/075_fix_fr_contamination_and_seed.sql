-- Migration 075: Fix FR contamination + seed FR from corrected source
-- Step 1: Clear contaminated foundation dialogue from FR rows
UPDATE session_templates SET dialogue_phases = NULL WHERE track = 'fr_apprentice';

-- Step 2: Seed FR-specific dialogue from fr_sessions_rewritten_corrected.zip

-- ── FR01: fr_session_01_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "One."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Welcome."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This is for you."
      },
      {
        "speaker": "guide",
        "text": "Not for the person you love. Not for their process."
      },
      {
        "speaker": "guide",
        "text": "For you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Sit however feels right."
      },
      {
        "speaker": "guide",
        "text": "You are here. That is the start."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Most people think being a supporter means waiting."
      },
      {
        "speaker": "guide",
        "text": "Waiting for the call. Waiting for news. Waiting to be needed."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the old story."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Here is what is actually happening."
      },
      {
        "speaker": "guide",
        "text": "Your body is running its own program right now."
      },
      {
        "speaker": "guide",
        "text": "Heart rate. Breath speed. Tension in your shoulders."
      },
      {
        "speaker": "guide",
        "text": "Your system set all of that before you sat down."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When the person you love is hurting — you feel it."
      },
      {
        "speaker": "guide",
        "text": "Your chest gets tight. Your jaw locks. Your stomach drops."
      },
      {
        "speaker": "guide",
        "text": "That is not weakness. That is your armor doing its job."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But here is the part nobody tells you."
      },
      {
        "speaker": "guide",
        "text": "Your calm changes their calm."
      },
      {
        "speaker": "guide",
        "text": "When your breathing steadies — the room steadies."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are not on the sidelines."
      },
      {
        "speaker": "guide",
        "text": "You are in the water."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today you learn what that means."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you might be thinking — why do I need this?"
      },
      {
        "speaker": "guide",
        "text": "I am not the one with the problem."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That thought is normal."
      },
      {
        "speaker": "guide",
        "text": "And it is the exact reason you are here."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Supporting someone is hard work."
      },
      {
        "speaker": "guide",
        "text": "It changes your sleep. Your mood. The way you hold your body."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You do not need to be broken to deserve a place to breathe."
      },
      {
        "speaker": "guide",
        "text": "You just need to be here."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "We are going to breathe together now."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "I will find the right rhythm for you."
      },
      {
        "speaker": "guide",
        "text": "You do not need to do anything special. Just follow along."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your only job is to stay with me."
      },
      {
        "speaker": "guide",
        "text": "When your mind drifts — come back to the breath."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Let it come in easy.",
      "Let it go.",
      "You are doing it. That is all there is.",
      "Your only job right now is this rhythm.",
      "That is enough.",
      "Notice what slowed down.",
      "Stay here.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Something just shifted."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You might not have words for it yet."
      },
      {
        "speaker": "guide",
        "text": "That is fine."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What you just did — following a rhythm you did not choose — that is the work."
      },
      {
        "speaker": "guide",
        "text": "Not thinking about helping. Actually helping."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your body just practiced being the calm in someone else''s storm."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You came here today."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not small."
      },
      {
        "speaker": "guide",
        "text": "That is everything."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are not a spectator."
      },
      {
        "speaker": "guide",
        "text": "You are part of the system."
      },
      {
        "speaker": "guide",
        "text": "And when you breathe — it changes the system."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Tomorrow — or whenever you come back — we go deeper."
      },
      {
        "speaker": "guide",
        "text": "But today was the first step. And it counted."
      }
    ]
  }
}'::jsonb WHERE session_number = 1 AND track = 'fr_apprentice';

-- ── FR02: fr_session_02_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Two."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You came back."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you learned you are in the water — not on the sidelines."
      },
      {
        "speaker": "guide",
        "text": "Today you learn why that matters."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about the science of safety."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Some people seem calm no matter what."
      },
      {
        "speaker": "guide",
        "text": "You might think they were born that way."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "They were not."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Calm is not a personality."
      },
      {
        "speaker": "guide",
        "text": "It is a skill. Like riding a bike or throwing a ball."
      },
      {
        "speaker": "guide",
        "text": "Your body can learn it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Here is the part most people never hear."
      },
      {
        "speaker": "guide",
        "text": "When your body learns calm — it does not just help you."
      },
      {
        "speaker": "guide",
        "text": "It helps every person near you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Think about a baby."
      },
      {
        "speaker": "guide",
        "text": "A baby cannot calm itself down. It borrows calm from the person holding it."
      },
      {
        "speaker": "guide",
        "text": "The holder breathes slow. The baby''s heart rate drops. The crying stops."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not magic. That is how bodies work."
      },
      {
        "speaker": "guide",
        "text": "And it does not stop when you grow up."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When someone you love is spinning — your calm is not background noise."
      },
      {
        "speaker": "guide",
        "text": "It is a signal. Your body sends it. Their body receives it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the science of safety."
      },
      {
        "speaker": "guide",
        "text": "And you are about to practice it."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you might be thinking — I cannot even calm myself down."
      },
      {
        "speaker": "guide",
        "text": "How am I supposed to calm someone else?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That thought makes sense."
      },
      {
        "speaker": "guide",
        "text": "And it is backwards."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You do not have to be perfect at this."
      },
      {
        "speaker": "guide",
        "text": "You just have to practice."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Every time you slow your breath down — even a little — you are installing a new program."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "We are going to breathe now."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Same as last time — I will find your rhythm."
      },
      {
        "speaker": "guide",
        "text": "You follow. That is it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This time — notice what happens in your chest when the rhythm settles."
      },
      {
        "speaker": "guide",
        "text": "That is the signal your body is learning to send."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In through the nose. Easy.",
      "Out through the mouth. Slow.",
      "Your heart rate is already changing.",
      "You might not feel it yet. But it is.",
      "This rhythm is doing something real.",
      "It is sending a signal of safety to your own system.",
      "And to anyone near you.",
      "Stay with it.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Feel that."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Something in your chest just opened."
      },
      {
        "speaker": "guide",
        "text": "Maybe a little. Maybe a lot."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not relaxation."
      },
      {
        "speaker": "guide",
        "text": "That is your system switching from armor to safety."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And if someone you love were sitting next to you right now — they would feel it too."
      },
      {
        "speaker": "guide",
        "text": "That is how close the science is to the skin."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You are learning the science of connection."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It starts here. In your own body."
      },
      {
        "speaker": "guide",
        "text": "Not in a book. Not in advice. In the breath."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Every time you practice this — you are building something."
      },
      {
        "speaker": "guide",
        "text": "New program. Stronger signal."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — we talk about timing."
      },
      {
        "speaker": "guide",
        "text": "When to jump in. When to wait. And how your body already knows the difference."
      }
    ]
  }
}'::jsonb WHERE session_number = 2 AND track = 'fr_apprentice';

-- ── FR03: fr_session_03_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Three."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you learned something about your body."
      },
      {
        "speaker": "guide",
        "text": "Your calm is not just for you. It travels."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about timing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When to move. When to wait. And why the wait matters more than you think."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You ever watch kids jump double dutch?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Two ropes turning. Fast."
      },
      {
        "speaker": "guide",
        "text": "The kid on the side does not just run in."
      },
      {
        "speaker": "guide",
        "text": "They watch. They feel the rhythm. They lean forward a little. They pull back."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And then — at the right moment — they step in."
      },
      {
        "speaker": "guide",
        "text": "And the ropes do not even break."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Connection works the same way."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When someone you love is hurting — everything in you says jump in."
      },
      {
        "speaker": "guide",
        "text": "Fix it. Say something. Do something."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But sometimes the most powerful thing you can do is watch the ropes first."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Read the room. Feel the rhythm."
      },
      {
        "speaker": "guide",
        "text": "Notice if they need you to step in — or if they need you to stand right there."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The kid who watches the ropes is not doing nothing."
      },
      {
        "speaker": "guide",
        "text": "They are doing the hardest part."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today you are going to practice that."
      },
      {
        "speaker": "guide",
        "text": "You are going to watch before you jump."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And you are going to feel what happens in your body during the wait."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Waiting is hard."
      },
      {
        "speaker": "guide",
        "text": "Especially when you love someone."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The armor that says jump in now — that armor is trying to protect you."
      },
      {
        "speaker": "guide",
        "text": "It says if you wait, you are failing them."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But armor does not know how to read the ropes."
      },
      {
        "speaker": "guide",
        "text": "Armor just swings."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today you practice a different program."
      },
      {
        "speaker": "guide",
        "text": "Watch first. Feel first. Then move."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today is different."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "I am going to start the rhythm — but you are not going to join yet."
      },
      {
        "speaker": "guide",
        "text": "You are going to watch."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Just watch the rhythm move. Feel it. Notice what your body does while it waits."
      },
      {
        "speaker": "guide",
        "text": "Do not try to breathe with it. Not yet."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When I tell you — then you step in."
      },
      {
        "speaker": "guide",
        "text": "Like the kid watching the ropes."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Step in.",
      "Match the rhythm.",
      "You waited. Now you are in.",
      "Notice how different it feels when you watched first.",
      "Your body found the rhythm faster because it was already listening.",
      "Stay with it.",
      "You are in the ropes now.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You waited."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That was harder than jumping in. And you did it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "During the wait — did you feel the pull?"
      },
      {
        "speaker": "guide",
        "text": "The tightness in your chest. The voice that said just go."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That pull is your armor."
      },
      {
        "speaker": "guide",
        "text": "What you just practiced — watching the ropes — that is the new program."
      },
      {
        "speaker": "guide",
        "text": "And it will change how you show up for the people you love."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You just practiced the Double Dutch."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Watch the ropes. Feel the rhythm. Step in when it is right."
      },
      {
        "speaker": "guide",
        "text": "Not when your armor says go. When the moment says go."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This week — try it."
      },
      {
        "speaker": "guide",
        "text": "When someone you love is struggling — give yourself ten seconds before you speak."
      },
      {
        "speaker": "guide",
        "text": "See what happens when you let the wait do the work."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — your nervous system. How it talks to you."
      },
      {
        "speaker": "guide",
        "text": "Not what you think. What your body actually says."
      }
    ]
  }
}'::jsonb WHERE session_number = 3 AND track = 'fr_apprentice';

-- ── FR04: fr_session_04_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Four."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you practiced the Double Dutch."
      },
      {
        "speaker": "guide",
        "text": "Watch the ropes. Wait. Then step in."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today we go inside."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about the program your body is running right now."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Your body has three modes."
      },
      {
        "speaker": "guide",
        "text": "You have been in all three. You just never had the words."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Mode one. Revved up."
      },
      {
        "speaker": "guide",
        "text": "Heart pounding. Muscles tight. Mind racing."
      },
      {
        "speaker": "guide",
        "text": "Your body is saying — something is coming. Get ready."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Mode two. Settled."
      },
      {
        "speaker": "guide",
        "text": "Breathing slow. Shoulders down. Thinking clear."
      },
      {
        "speaker": "guide",
        "text": "Your body is saying — I am safe right now. I can rest."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Mode three. Shut down."
      },
      {
        "speaker": "guide",
        "text": "Numb. Flat. Cannot think. Cannot move. Cannot feel."
      },
      {
        "speaker": "guide",
        "text": "Your body is saying — this is too much. I am going offline."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Here is what matters."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "None of these modes are broken."
      },
      {
        "speaker": "guide",
        "text": "None of them are character flaws."
      },
      {
        "speaker": "guide",
        "text": "They are all smart moves your body learned to keep you safe."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Revved up kept you alive when things were dangerous."
      },
      {
        "speaker": "guide",
        "text": "Shut down protected you when it was too much to feel."
      },
      {
        "speaker": "guide",
        "text": "Settled is where your body wants to go when it feels safe enough."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The breath is how you learn to move between them on purpose."
      },
      {
        "speaker": "guide",
        "text": "Not by force. By practice."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You might be thinking — I know which mode I am stuck in."
      },
      {
        "speaker": "guide",
        "text": "And I do not know how to get out."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is normal."
      },
      {
        "speaker": "guide",
        "text": "The armor you built was good armor. It kept you going."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But armor that was built for a war does not always fit a kitchen table."
      },
      {
        "speaker": "guide",
        "text": "Or a phone call. Or a visit."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You do not have to take the armor off today."
      },
      {
        "speaker": "guide",
        "text": "You just have to notice you are wearing it."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Right now — which mode are you in?"
      },
      {
        "speaker": "guide",
        "text": "Do not answer out loud. Just notice."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Revved up. Settled. Shut down."
      },
      {
        "speaker": "guide",
        "text": "Whatever it is — that is where we start."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The breath will do the rest."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In.",
      "Out.",
      "Notice your chest.",
      "Is it tight? Open? Somewhere in between?",
      "Notice your jaw.",
      "Notice your shoulders.",
      "Whatever you find — let it be there.",
      "Your body is talking to you right now.",
      "The breath is how you learn to listen.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Where are you now?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not where you started. Where you are right now."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "If something shifted — even a little — that is your body moving between modes."
      },
      {
        "speaker": "guide",
        "text": "You did not think your way there. You breathed your way there."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not a small thing."
      },
      {
        "speaker": "guide",
        "text": "That is your system learning a new program."
      },
      {
        "speaker": "guide",
        "text": "And a program that is practiced becomes automatic."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Three modes."
      },
      {
        "speaker": "guide",
        "text": "Revved up. Settled. Shut down."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "None of them are wrong."
      },
      {
        "speaker": "guide",
        "text": "All of them kept you alive."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But now you know you can move between them."
      },
      {
        "speaker": "guide",
        "text": "Not by fighting yourself. By breathing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This week — try to notice which mode you are in before you react."
      },
      {
        "speaker": "guide",
        "text": "You do not have to change it. Just name it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — the small moments. The ones that matter more than you think."
      }
    ]
  }
}'::jsonb WHERE session_number = 4 AND track = 'fr_apprentice';

-- ── FR05: fr_session_05_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Five."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This is the last session in your first chapter."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You have been here four times before this."
      },
      {
        "speaker": "guide",
        "text": "Each time you learned something about who you are in this."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today we look at what you built."
      },
      {
        "speaker": "guide",
        "text": "And we name the small things that hold it all together."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Think about the last time something good happened between you and someone you love."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not a big thing. Not a holiday or a birthday."
      },
      {
        "speaker": "guide",
        "text": "A small thing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "A moment where you felt — okay. Right now, this is okay."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That moment left something behind."
      },
      {
        "speaker": "guide",
        "text": "A warmth. A softness in your chest. A feeling that stayed."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the afterglow."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Most people miss it."
      },
      {
        "speaker": "guide",
        "text": "They are so busy looking for the big moments — the breakthrough, the turning point — that they walk right past the small ones."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But the small ones are the foundation."
      },
      {
        "speaker": "guide",
        "text": "A calm voice on the phone. A steady breath in a hard room. A hand that stayed instead of pulling away."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Every one of those moments sent a signal."
      },
      {
        "speaker": "guide",
        "text": "And every signal left an afterglow."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not nothing."
      },
      {
        "speaker": "guide",
        "text": "That is everything."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today you learn to notice it."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you might be thinking — the small moments are not enough."
      },
      {
        "speaker": "guide",
        "text": "I need the big change. The real breakthrough."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That thought is the armor talking."
      },
      {
        "speaker": "guide",
        "text": "The armor says if it is not dramatic, it does not count."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But the program you have been building — session by session — it knows better."
      },
      {
        "speaker": "guide",
        "text": "The small moments are where the real work lives."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And you have already been doing it."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath is a little different."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you breathe in — just breathe in calm."
      },
      {
        "speaker": "guide",
        "text": "When you breathe out — say thank you. In your head. Not out loud."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Thank you for the small moment. Whatever it was."
      },
      {
        "speaker": "guide",
        "text": "Let it come back to you while you breathe."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In. Calm.",
      "Out. Thank you.",
      "Let that small moment come back.",
      "Feel the warmth of it.",
      "That warmth is real. Your body remembers it.",
      "In. Calm.",
      "Out. Thank you.",
      "Stay with it.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "That warmth you feel right now."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the afterglow."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It was already there — from that small moment you remembered."
      },
      {
        "speaker": "guide",
        "text": "The breath just turned the volume up."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You did not create it. You noticed it."
      },
      {
        "speaker": "guide",
        "text": "And that is a skill you now own."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Five sessions."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In session one — you learned you are not a spectator. You are in the water."
      },
      {
        "speaker": "guide",
        "text": "In session two — you learned your calm travels. It changes the room."
      },
      {
        "speaker": "guide",
        "text": "In session three — you learned to watch the ropes before you jump."
      },
      {
        "speaker": "guide",
        "text": "In session four — you learned your body has three modes. And none of them are flaws."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And today — you learned that the small moments are not small."
      },
      {
        "speaker": "guide",
        "text": "They are the whole foundation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You built something real."
      },
      {
        "speaker": "guide",
        "text": "You built a program that your body can use — not just your mind."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your first chapter is done."
      },
      {
        "speaker": "guide",
        "text": "What comes next is deeper."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next — you learn to read the signals. Not just yours. Theirs."
      },
      {
        "speaker": "guide",
        "text": "How the person you love tells you what they need — without words."
      }
    ]
  }
}'::jsonb WHERE session_number = 5 AND track = 'fr_apprentice';

-- ── FR06: fr_session_06_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Six."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "New chapter."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the first five sessions you learned about your system."
      },
      {
        "speaker": "guide",
        "text": "Your modes. Your signals. Your breath."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Now we turn the lens."
      },
      {
        "speaker": "guide",
        "text": "Today you learn to read theirs."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The person you love has the same three modes you do."
      },
      {
        "speaker": "guide",
        "text": "Revved up. Settled. Shut down."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But they look different on them than they look on you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Revved up on them might look like a sharp voice. A clenched jaw. Eyes that dart."
      },
      {
        "speaker": "guide",
        "text": "It might look like pushing you away or picking a fight over nothing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Shut down on them might look like flat eyes. One-word answers. Leaving the room."
      },
      {
        "speaker": "guide",
        "text": "It might look like they are right in front of you but they are not really there."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And settled — that is the one you are looking for."
      },
      {
        "speaker": "guide",
        "text": "Settled looks like open eyes. A voice that is not rushing."
      },
      {
        "speaker": "guide",
        "text": "It looks like they can hear you. Really hear you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Here is the thing nobody told you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When they are revved up — that is not about you."
      },
      {
        "speaker": "guide",
        "text": "When they shut down — that is not about you either."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Those are their system''s old armor."
      },
      {
        "speaker": "guide",
        "text": "Programs that got written a long time ago."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you can see the armor instead of taking it personal — everything changes."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you might be saying — but it feels personal."
      },
      {
        "speaker": "guide",
        "text": "When they snap at me or shut me out — it hurts."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is true."
      },
      {
        "speaker": "guide",
        "text": "It does hurt. And the hurt is real."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But knowing it is their armor — not their heart — does not erase your pain."
      },
      {
        "speaker": "guide",
        "text": "It gives you a place to stand while you feel it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That place is what we are building."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "We are going to breathe now."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "While you breathe — I want you to hold an image of the person you love."
      },
      {
        "speaker": "guide",
        "text": "Not a hard moment. Not a fight."
      },
      {
        "speaker": "guide",
        "text": "Just their face. However you see them most often."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Hold that image. Breathe with me."
      },
      {
        "speaker": "guide",
        "text": "Let yourself see them without needing to fix anything."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "See their face.",
      "Breathe.",
      "What mode are they in — the last time you saw them?",
      "Notice what your body does when you see them that way.",
      "You do not have to fix it.",
      "Just see it. And breathe.",
      "Their armor is not your fault.",
      "Stay with them. Stay with the breath.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You just held them in your mind."
      },
      {
        "speaker": "guide",
        "text": "And you stayed calm."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not nothing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Usually — when you think about them in a hard moment — your system matches theirs."
      },
      {
        "speaker": "guide",
        "text": "They get revved up. You get revved up. They shut down. You panic."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But you just held their image and stayed in your own breath."
      },
      {
        "speaker": "guide",
        "text": "That is the skill. Seeing their state without catching it."
      },
      {
        "speaker": "guide",
        "text": "That is the new program."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Three modes. On them."
      },
      {
        "speaker": "guide",
        "text": "Revved up. Settled. Shut down."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Same modes as yours. Different armor."
      },
      {
        "speaker": "guide",
        "text": "When you can see the mode — you stop reacting to the surface."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This week — watch for the signals."
      },
      {
        "speaker": "guide",
        "text": "Not what they say. What their body says."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — we turn the lens on you again."
      },
      {
        "speaker": "guide",
        "text": "The three states as you live them. Not as a lesson. As your life."
      }
    ]
  }
}'::jsonb WHERE session_number = 6 AND track = 'fr_apprentice';

-- ── FR07: fr_session_07_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Seven."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you learned to read their signals."
      },
      {
        "speaker": "guide",
        "text": "Their face. Their voice. Their body."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today we turn that lens around."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about your first sign."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You know how to read their modes now."
      },
      {
        "speaker": "guide",
        "text": "Revved up. Settled. Shut down."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But here is the question nobody asks the supporter."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What is your first sign?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not the moment you break."
      },
      {
        "speaker": "guide",
        "text": "The moment before."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "For some people — the first sign is in the chest."
      },
      {
        "speaker": "guide",
        "text": "A tightening. A closing. Like someone put a hand on your ribs."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "For some — it is behind the eyes."
      },
      {
        "speaker": "guide",
        "text": "A sharpness. Everything gets a little too clear. A little too fast."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "For others — it is the legs."
      },
      {
        "speaker": "guide",
        "text": "The urge to leave the room. To walk away. To get out."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Every person has a first sign."
      },
      {
        "speaker": "guide",
        "text": "Most people do not know theirs."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Because by the time they notice — they are already past it."
      },
      {
        "speaker": "guide",
        "text": "Today you go looking for it."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "This might feel strange."
      },
      {
        "speaker": "guide",
        "text": "Looking inward when you have been focused outward for so long."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The armor says — I do not have time for this."
      },
      {
        "speaker": "guide",
        "text": "They need me. I need to be ready for them."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But you cannot offer a settled state you do not have."
      },
      {
        "speaker": "guide",
        "text": "And knowing your first sign is how you keep it."
      },
      {
        "speaker": "guide",
        "text": ""
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today we do a body scan."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "While you breathe — I will name a part of your body."
      },
      {
        "speaker": "guide",
        "text": "Your job is to notice what is there. Not change it. Just notice."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Whatever you find — tight, loose, numb, warm, nothing — that is data."
      },
      {
        "speaker": "guide",
        "text": "Your body is talking. Today you listen."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Breathe. And notice your jaw.",
      "Is it clenched? Open? Somewhere in between?",
      "Now your shoulders.",
      "Are they up near your ears? Or down where they belong?",
      "Now your chest.",
      "Open or tight? Does the breath go all the way down?",
      "Now your stomach.",
      "Heavy? Knotted? Calm? Just notice.",
      "Now your hands.",
      "Fists? Open? Gripping something that is not there?",
      "Where is your first sign? Which place spoke the loudest?",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You found it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe it was the jaw. Maybe the chest. Maybe the stomach."
      },
      {
        "speaker": "guide",
        "text": "Whatever spoke the loudest — that is your early warning system."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Most supporters never learn this."
      },
      {
        "speaker": "guide",
        "text": "They push through until they break. Then they wonder why."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You just found the moment before the break."
      },
      {
        "speaker": "guide",
        "text": "That is not weakness. That is the most prepared you have ever been."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Two sessions. Two lenses."
      },
      {
        "speaker": "guide",
        "text": "Their signals. Your signals."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are building a map."
      },
      {
        "speaker": "guide",
        "text": "Their modes. Your modes. Where they touch."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This week — watch for your first sign."
      },
      {
        "speaker": "guide",
        "text": "Not to fix it. Just to catch it before it catches you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — what makes someone feel safe."
      },
      {
        "speaker": "guide",
        "text": "Not what you think makes them safe. What their body actually responds to."
      }
    ]
  }
}'::jsonb WHERE session_number = 7 AND track = 'fr_apprentice';

-- ── FR08: fr_session_08_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Eight."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you found your first sign."
      },
      {
        "speaker": "guide",
        "text": "The place in your body that speaks before your mouth does."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about what makes people feel safe."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And it is not what most people think."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Think about someone who makes you feel safe."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not someone who protects you. Someone whose presence changes the room."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What is it about them?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It is probably not what they say."
      },
      {
        "speaker": "guide",
        "text": "It is how their face looks when they see you."
      },
      {
        "speaker": "guide",
        "text": "Their eyes are soft. Not scanning. Not judging. Just open."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Their voice is low. Not loud. Not sharp."
      },
      {
        "speaker": "guide",
        "text": "It moves at the speed of a slow exhale."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Their body is not braced. Not leaning away."
      },
      {
        "speaker": "guide",
        "text": "They are just — there."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your body read all of that before they said a single word."
      },
      {
        "speaker": "guide",
        "text": "That is how fast safety travels."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And here is what matters for you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You can become that person."
      },
      {
        "speaker": "guide",
        "text": "The one whose presence changes the room."
      },
      {
        "speaker": "guide",
        "text": "And it starts with your face."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You might be thinking — I cannot control my face."
      },
      {
        "speaker": "guide",
        "text": "When I am stressed, it shows."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is honest."
      },
      {
        "speaker": "guide",
        "text": "And it is exactly why we practice."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You do not have to fake a smile."
      },
      {
        "speaker": "guide",
        "text": "You just have to soften what is braced."
      },
      {
        "speaker": "guide",
        "text": ""
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today we try something new."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you breathe out — I want you to let your face soften."
      },
      {
        "speaker": "guide",
        "text": "Just a little. The corners of your mouth. The muscles around your eyes."
      },
      {
        "speaker": "guide",
        "text": "Not a big smile. Not a performed smile."
      },
      {
        "speaker": "guide",
        "text": "Just — a softening."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Something happens when your face lets go."
      },
      {
        "speaker": "guide",
        "text": "Your body follows. Every time."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In.",
      "Out. Soften your face.",
      "The corners of your mouth.",
      "In.",
      "Out. The muscles around your eyes.",
      "Notice what happens in your chest when your face lets go.",
      "The face leads. The body follows.",
      "In.",
      "Out. Soft face. Soft signal.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Did you feel it?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When your face softened — something in your chest opened."
      },
      {
        "speaker": "guide",
        "text": "Maybe your shoulders dropped. Maybe your jaw unclenched."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your face just told your body it was safe."
      },
      {
        "speaker": "guide",
        "text": "No words. Just a signal."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And if someone were sitting across from you right now — they would have felt it too."
      },
      {
        "speaker": "guide",
        "text": "You just practiced being a cue of safety."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Connection does not start with words."
      },
      {
        "speaker": "guide",
        "text": "It starts with signals."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Soft eyes. A calm voice. An open face."
      },
      {
        "speaker": "guide",
        "text": "Your body sends these whether you know it or not."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Now you know it."
      },
      {
        "speaker": "guide",
        "text": "And you can practice it on purpose."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This week — try the soft face before you speak."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — the other side. Cues of distress."
      },
      {
        "speaker": "guide",
        "text": "What the body says when it is not safe. And what you do when you see it."
      }
    ]
  }
}'::jsonb WHERE session_number = 8 AND track = 'fr_apprentice';

-- ── FR09: fr_session_09_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Nine."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you learned how safety travels."
      },
      {
        "speaker": "guide",
        "text": "A soft face. An open signal."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is the other side."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about distress. And how to read it without getting pulled under."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "There are two kinds of distress signals."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The first one says — come closer."
      },
      {
        "speaker": "guide",
        "text": "It reaches toward you. A hand out. A voice cracking. Eyes that look for yours."
      },
      {
        "speaker": "guide",
        "text": "That is the reach."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The second one says — give me space."
      },
      {
        "speaker": "guide",
        "text": "It turns away. A door closing. A voice going flat. Eyes that look at the floor."
      },
      {
        "speaker": "guide",
        "text": "That is the warning shot."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "They look completely different."
      },
      {
        "speaker": "guide",
        "text": "But most supporters treat them the same way — by rushing in."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The reach wants you closer."
      },
      {
        "speaker": "guide",
        "text": "The warning shot needs you close — but not closer."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You know this in your own life."
      },
      {
        "speaker": "guide",
        "text": "Think about when your child reaches for you — arms up, eyes searching."
      },
      {
        "speaker": "guide",
        "text": "That is different from when your child turns away and goes still."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The reach says — I need you."
      },
      {
        "speaker": "guide",
        "text": "The warning shot says — I need you to be here, but not here."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Learning the difference changes everything."
      },
      {
        "speaker": "guide",
        "text": "And your body already knows. You just have to slow down enough to listen."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "This is a hard one."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Because when someone you love is hurting — every part of you says go."
      },
      {
        "speaker": "guide",
        "text": "The armor says if you do not fix it now, you are failing them."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But sometimes the person in pain is saying — not yet."
      },
      {
        "speaker": "guide",
        "text": "And hearing that — really hearing it — takes more strength than rushing in."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The breath is how you hold still long enough to hear it."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today we anchor."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "While you breathe — put all of your attention on one spot."
      },
      {
        "speaker": "guide",
        "text": "The place where the air enters your nose. Or the rise of your chest. Or the drop of your belly."
      },
      {
        "speaker": "guide",
        "text": "Pick one spot. Stay there."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When your mind goes somewhere else — and it will — come back to the spot."
      },
      {
        "speaker": "guide",
        "text": "That is the anchor. Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Find your spot.",
      "Stay there.",
      "When your mind drifts — come back.",
      "The anchor is not the thought. It is the feeling.",
      "Air in. Air out. One spot.",
      "This is what it feels like to stay present when someone else is in pain.",
      "You do not leave. You do not rush in. You hold your anchor.",
      "Come back to the spot.",
      "Stay.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Your mind left. You brought it back."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the skill."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not never drifting. Always returning."
      },
      {
        "speaker": "guide",
        "text": "That is what an anchor does."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And that is what you do when someone you love is in distress."
      },
      {
        "speaker": "guide",
        "text": "You do not get pulled into their current."
      },
      {
        "speaker": "guide",
        "text": "You hold your spot. You read the signal. Then you move."
      },
      {
        "speaker": "guide",
        "text": "Reach — come closer. Warning shot — stay close but hold."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Two signals. The reach and the warning shot."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You do not have to read them perfectly every time."
      },
      {
        "speaker": "guide",
        "text": "You just have to be paying attention."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That attention is itself a form of love."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This week — watch for it."
      },
      {
        "speaker": "guide",
        "text": "When they reach — step in. When they warn — hold your ground and stay close."
      },
      {
        "speaker": "guide",
        "text": "With your partner. With your family. With your child."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — how much your body can hold."
      },
      {
        "speaker": "guide",
        "text": "There is a limit. And knowing it is not weakness. It is wisdom."
      }
    ]
  }
}'::jsonb WHERE session_number = 9 AND track = 'fr_apprentice';

-- ── FR10: fr_session_10_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Ten."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This is the last session of your second chapter."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You learned to read their signals. You learned to read yours."
      },
      {
        "speaker": "guide",
        "text": "You learned the difference between a reach and a warning shot."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today — we find the edges."
      },
      {
        "speaker": "guide",
        "text": "How much you can hold. And what happens when you cannot."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Your body has a window."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Inside the window — you can think. You can feel. You can connect."
      },
      {
        "speaker": "guide",
        "text": "Inside the window — you are present."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Above the window — flooded."
      },
      {
        "speaker": "guide",
        "text": "Heart pounding. Mind racing. Saying things you do not mean."
      },
      {
        "speaker": "guide",
        "text": "You went past the top edge."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Below the window — shut down."
      },
      {
        "speaker": "guide",
        "text": "Numb. Flat. Staring at a wall. Cannot cry. Cannot think."
      },
      {
        "speaker": "guide",
        "text": "You dropped below the bottom edge."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Here is the thing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Everyone leaves their window."
      },
      {
        "speaker": "guide",
        "text": "That is not failure. That is being human."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The goal is not to stay inside forever."
      },
      {
        "speaker": "guide",
        "text": "The goal is to know where your edges are."
      },
      {
        "speaker": "guide",
        "text": "And to have a way back."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The breath is the way back."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you does not want a window."
      },
      {
        "speaker": "guide",
        "text": "Part of you wants to be the person who can hold everything."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The armor says — if you have limits, you are not strong enough."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But think about the strongest people you know."
      },
      {
        "speaker": "guide",
        "text": "They are not the ones who never break."
      },
      {
        "speaker": "guide",
        "text": "They are the ones who know their edges — and still show up."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is what you are learning."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath has an edge."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you breathe in — notice the moment it fills up. The top."
      },
      {
        "speaker": "guide",
        "text": "When you breathe out — notice the moment it empties. The bottom."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The top and the bottom. Those are the edges of your breath."
      },
      {
        "speaker": "guide",
        "text": "Today you practice feeling them without going past them."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In. Feel the top.",
      "Out. Feel the bottom.",
      "The moment it fills up. The moment it lets go.",
      "Those edges are not walls.",
      "They are information.",
      "Top. Bottom. You can feel both without going past either one.",
      "This is what staying inside your window feels like.",
      "Not forcing. Not fleeing. Just — here.",
      "Stay.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You just stayed inside your window."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You felt the edges. And you did not go past them."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That might sound simple."
      },
      {
        "speaker": "guide",
        "text": "But for someone who has been living past their edges for years — it is everything."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your window is not a weakness."
      },
      {
        "speaker": "guide",
        "text": "It is the most honest map of what you can hold right now."
      },
      {
        "speaker": "guide",
        "text": "And it grows. Every time you practice — it stretches a little wider."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Ten sessions."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Two chapters."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the first chapter — you learned you are in the water."
      },
      {
        "speaker": "guide",
        "text": "Your calm travels. Your timing matters. Your body has three modes."
      },
      {
        "speaker": "guide",
        "text": "And the small moments are the whole foundation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the second chapter — you learned to read the map."
      },
      {
        "speaker": "guide",
        "text": "Their signals. Your signals. Safety cues. Distress cues."
      },
      {
        "speaker": "guide",
        "text": "And today — the window. How much you can hold."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You have mapped two systems now."
      },
      {
        "speaker": "guide",
        "text": "Yours and theirs."
      },
      {
        "speaker": "guide",
        "text": "That map is the foundation of everything that comes next."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What comes next is the hardest chapter."
      },
      {
        "speaker": "guide",
        "text": "Holding space."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not fixing. Not fleeing. Just — being there."
      },
      {
        "speaker": "guide",
        "text": "When it hurts and you cannot make it stop."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are ready."
      }
    ]
  }
}'::jsonb WHERE session_number = 10 AND track = 'fr_apprentice';

-- ── FR11: fr_session_11_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Eleven."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "New chapter."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You have learned to read the map. Your system. Theirs."
      },
      {
        "speaker": "guide",
        "text": "Now — what do you do with what you see?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This chapter is the hardest one."
      },
      {
        "speaker": "guide",
        "text": "This chapter is about holding space."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Think about a time someone was truly there for you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not someone who gave you advice."
      },
      {
        "speaker": "guide",
        "text": "Not someone who tried to fix it."
      },
      {
        "speaker": "guide",
        "text": "Someone who just — sat with you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe they did not say a word."
      },
      {
        "speaker": "guide",
        "text": "Maybe they just looked at you and you could feel it."
      },
      {
        "speaker": "guide",
        "text": "They were not going anywhere."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is presence."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Most people think being present means having the right words."
      },
      {
        "speaker": "guide",
        "text": "It does not."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Presence is not silence."
      },
      {
        "speaker": "guide",
        "text": "It is attention."
      },
      {
        "speaker": "guide",
        "text": "The kind of attention that says — I see you. I am here. I am not trying to change you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the hardest kind of attention there is."
      },
      {
        "speaker": "guide",
        "text": "Because your armor wants to fix. Your armor wants to help."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today you practice putting the armor down."
      },
      {
        "speaker": "guide",
        "text": "And just being there."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "This will feel uncomfortable."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Sitting with someone''s pain without fixing it goes against everything in you."
      },
      {
        "speaker": "guide",
        "text": "Your body will say — do something."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But today — doing something means staying."
      },
      {
        "speaker": "guide",
        "text": "Not leaving. Not solving. Not running."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Just — here."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath is simple."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Breathe. And watch."
      },
      {
        "speaker": "guide",
        "text": "Watch whatever comes up. Thoughts. Feelings. Tension. Nothing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Do not judge it. Do not try to change it."
      },
      {
        "speaker": "guide",
        "text": "Just witness. Like you are sitting with someone."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Breathe. Watch.",
      "Whatever comes up — let it be there.",
      "You are not fixing. You are witnessing.",
      "Notice the urge to change what you see.",
      "Let the urge be there. And keep breathing.",
      "This is what it feels like to hold space.",
      "Present. Not passive. Just — here.",
      "Stay.",
      "Whatever is here — you can hold it.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You just sat with yourself."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Whatever came up — you did not run from it."
      },
      {
        "speaker": "guide",
        "text": "You did not fix it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You witnessed it."
      },
      {
        "speaker": "guide",
        "text": "And you kept breathing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the most healing thing one person can offer another."
      },
      {
        "speaker": "guide",
        "text": "Full, calm, steady attention. Without an agenda."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Presence is not a trick."
      },
      {
        "speaker": "guide",
        "text": "It is not something you perform."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It is the quality of attention you bring when words are not enough."
      },
      {
        "speaker": "guide",
        "text": "And sometimes — words are never enough."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You just practiced offering something better."
      },
      {
        "speaker": "guide",
        "text": "You. Steady. Here."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — the fixer and the holder."
      },
      {
        "speaker": "guide",
        "text": "Two roles. One of them you know by heart. The other one will change everything."
      }
    ]
  }
}'::jsonb WHERE session_number = 11 AND track = 'fr_apprentice';

-- ── FR12: fr_session_12_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twelve."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you practiced being present without an agenda."
      },
      {
        "speaker": "guide",
        "text": "Today goes deeper."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about two roles."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The fixer. And the holder."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You know the fixer."
      },
      {
        "speaker": "guide",
        "text": "The fixer is the part of you that says — I need to make this better."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When someone you love is hurting — the fixer wakes up."
      },
      {
        "speaker": "guide",
        "text": "It gives advice. It makes plans. It solves problems."
      },
      {
        "speaker": "guide",
        "text": "It cannot sit still when someone is in pain."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The fixer comes from love."
      },
      {
        "speaker": "guide",
        "text": "That is real."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But here is the part that is hard to hear."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Sometimes fixing is not about them."
      },
      {
        "speaker": "guide",
        "text": "Sometimes fixing is about your discomfort with their pain."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Think about a child crying."
      },
      {
        "speaker": "guide",
        "text": "Your whole body says — make it stop."
      },
      {
        "speaker": "guide",
        "text": "But sometimes the child does not need you to fix it."
      },
      {
        "speaker": "guide",
        "text": "Sometimes they just need you to stay."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the holder."
      },
      {
        "speaker": "guide",
        "text": "The holder does not fix. The holder stays."
      },
      {
        "speaker": "guide",
        "text": "The holder says — I am here. The pain can be here too."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Both roles come from love."
      },
      {
        "speaker": "guide",
        "text": "But only one of them lets the pain say what it needs to say."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "If fixing is your identity — this session might feel like an attack."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It is not."
      },
      {
        "speaker": "guide",
        "text": "The fixer in you kept things together. It is good armor."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But armor that never comes off becomes a cage."
      },
      {
        "speaker": "guide",
        "text": "The holder is not a replacement for the fixer."
      },
      {
        "speaker": "guide",
        "text": "It is a partner."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today you practice having both."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "This one is harder."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "While you breathe — I want you to bring up an image."
      },
      {
        "speaker": "guide",
        "text": "Someone you love. In pain."
      },
      {
        "speaker": "guide",
        "text": "Not the worst moment. Just a hard one."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Hold the image. Keep your breath steady."
      },
      {
        "speaker": "guide",
        "text": "The image can be there. And your rhythm can hold."
      },
      {
        "speaker": "guide",
        "text": "Both at the same time. That is the practice."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "See them.",
      "Hold your rhythm.",
      "Feel the urge to fix.",
      "Let it be there. Do not act on it.",
      "The pain is there. And your breath is steady.",
      "Both can be true at the same time.",
      "This is what a holder does.",
      "Stays steady while the storm is real.",
      "Stay.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You held the image."
      },
      {
        "speaker": "guide",
        "text": "And you kept breathing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The fixer in you wanted to move. To act. To solve."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But you stayed."
      },
      {
        "speaker": "guide",
        "text": "The flame did not go out."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not passivity."
      },
      {
        "speaker": "guide",
        "text": "That is the strongest form of support there is."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Two roles."
      },
      {
        "speaker": "guide",
        "text": "The fixer makes the pain stop. The holder lets the pain speak."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You need both."
      },
      {
        "speaker": "guide",
        "text": "But the holder is the one most people never learn."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You just practiced it."
      },
      {
        "speaker": "guide",
        "text": "And your breath held."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — when to step back."
      },
      {
        "speaker": "guide",
        "text": "Because sometimes holding space means leaving the room."
      }
    ]
  }
}'::jsonb WHERE session_number = 12 AND track = 'fr_apprentice';

-- ── FR13: fr_session_13_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Thirteen."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you met the fixer and the holder."
      },
      {
        "speaker": "guide",
        "text": "Today goes one step further."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about the hardest move a supporter can make."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Stepping back."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Remember the warning shot."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In session nine you learned there are two distress signals."
      },
      {
        "speaker": "guide",
        "text": "The reach says — come closer."
      },
      {
        "speaker": "guide",
        "text": "The warning shot says — I need you here, but not closer."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about what you do when you see the warning shot."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You step back."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not because you gave up."
      },
      {
        "speaker": "guide",
        "text": "Because you understood."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Stepping back is not leaving."
      },
      {
        "speaker": "guide",
        "text": "It is making room."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Room for them to come to you when they are ready."
      },
      {
        "speaker": "guide",
        "text": "Room for the pain to move through without being cornered."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The supporter who can step back is the one who will still be standing."
      },
      {
        "speaker": "guide",
        "text": "When they are ready — you will be there."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "This feels wrong."
      },
      {
        "speaker": "guide",
        "text": "Stepping back when someone is hurting feels like betrayal."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The armor says — if you leave now, they will think you do not care."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But think about it from their side."
      },
      {
        "speaker": "guide",
        "text": "When you needed space — and someone pushed through it — how did that feel?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Stepping back is not about you."
      },
      {
        "speaker": "guide",
        "text": "It is about honoring what their body is asking for."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today we practice letting go."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you breathe in — hold what matters."
      },
      {
        "speaker": "guide",
        "text": "When you breathe out — release the grip."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The need to control. The need to help. The need to be needed."
      },
      {
        "speaker": "guide",
        "text": "Let it go with the breath."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In. Hold what matters.",
      "Out. Release the grip.",
      "The need to control.",
      "Let it go.",
      "The need to fix.",
      "Let it go.",
      "The need to be needed.",
      "Let it go.",
      "What is left when you release?",
      "Love. Still here. Without the grip.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You let go."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And you are still here."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the discovery."
      },
      {
        "speaker": "guide",
        "text": "You can release the grip — and the love does not leave."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The love was never in the grip."
      },
      {
        "speaker": "guide",
        "text": "The love was underneath it."
      },
      {
        "speaker": "guide",
        "text": "And it is still there."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Stepping back is not giving up."
      },
      {
        "speaker": "guide",
        "text": "It is making room."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Room for them to breathe."
      },
      {
        "speaker": "guide",
        "text": "Room for the pain to move."
      },
      {
        "speaker": "guide",
        "text": "Room for you to still be standing when they need you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This week — if you see the warning shot — honor it."
      },
      {
        "speaker": "guide",
        "text": "You are not abandoning them. You are trusting them."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — the language of validation."
      },
      {
        "speaker": "guide",
        "text": "What to say when there is nothing to fix."
      }
    ]
  }
}'::jsonb WHERE session_number = 13 AND track = 'fr_apprentice';

-- ── FR14: fr_session_14_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Fourteen."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you practiced stepping back."
      },
      {
        "speaker": "guide",
        "text": "Today — what to say when you step forward."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about the words that heal."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And the ones that erase."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Think about a time you told someone how you felt."
      },
      {
        "speaker": "guide",
        "text": "And they said — I understand, but..."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What happened in your body when you heard that word?"
      },
      {
        "speaker": "guide",
        "text": "But."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Everything before it disappeared."
      },
      {
        "speaker": "guide",
        "text": "Your feeling got erased."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Now think about a time someone said — that makes sense."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "No but. No fix. No redirect."
      },
      {
        "speaker": "guide",
        "text": "Just — that makes sense."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What happened in your body then?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Something opened."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is validation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Validation does not mean you agree."
      },
      {
        "speaker": "guide",
        "text": "It means you see."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You can disagree with someone''s choice and still honor their feeling."
      },
      {
        "speaker": "guide",
        "text": "You can say — I see why you feel that way. And also hold your own truth."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Both can live in the same room."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The armor says — if I validate their feeling, they will think I agree with their bad decision."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is a real fear."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But think about what happens when you skip the validation and go straight to the correction."
      },
      {
        "speaker": "guide",
        "text": "They stop talking."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And the next time they are hurting — they do not come to you."
      },
      {
        "speaker": "guide",
        "text": "Because last time, you erased them."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath is about rhythm."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "I am going to set a pace. Your job is to match it."
      },
      {
        "speaker": "guide",
        "text": "Not force it. Match it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you are in rhythm with someone — something happens in your body."
      },
      {
        "speaker": "guide",
        "text": "A settling. An opening. That is what validation feels like."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Match the rhythm.",
      "Not forcing. Joining.",
      "This is what it feels like to be in sync.",
      "When someone validates you — this is what happens inside.",
      "A settling.",
      "This is what you give someone when you say — that makes sense.",
      "Stay in the rhythm.",
      "You are not agreeing. You are joining.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "That settling you felt."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is what you give someone when you validate them."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not agreement. Not approval."
      },
      {
        "speaker": "guide",
        "text": "Rhythm."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You just felt what it is like to be joined."
      },
      {
        "speaker": "guide",
        "text": "Now you know what you are offering."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Three words that change everything."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That makes sense."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not — I understand, but."
      },
      {
        "speaker": "guide",
        "text": "Not — have you tried."
      },
      {
        "speaker": "guide",
        "text": "Not — at least you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Just — that makes sense."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — everything comes together."
      },
      {
        "speaker": "guide",
        "text": "The halfway point. What you built. Where you are going."
      }
    ]
  }
}'::jsonb WHERE session_number = 14 AND track = 'fr_apprentice';

-- ── FR15: fr_session_15_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Fifteen."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Halfway."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Fifteen times you chose to show up."
      },
      {
        "speaker": "guide",
        "text": "For yourself. For the person you love."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not small."
      },
      {
        "speaker": "guide",
        "text": "That is a pattern. And patterns become who you are."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "I am not going to teach you something new today."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about seeing what already changed."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not what you learned. What shifted."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Think about the person who opened this app for the first time."
      },
      {
        "speaker": "guide",
        "text": "That person thought supporting someone meant waiting on the sidelines."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are not that person anymore."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Think about how your body felt before a visit or a phone call — fifteen sessions ago."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Something moved."
      },
      {
        "speaker": "guide",
        "text": "Maybe your jaw is less tight. Maybe your breath comes easier."
      },
      {
        "speaker": "guide",
        "text": "Maybe you catch yourself before you fix."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not nothing."
      },
      {
        "speaker": "guide",
        "text": "That is fifteen sessions of practice."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you might say — I am not good enough at this yet."
      },
      {
        "speaker": "guide",
        "text": "I still lose my temper. I still jump in too fast. I still shut down."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Good."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are not supposed to be perfect."
      },
      {
        "speaker": "guide",
        "text": "You are supposed to keep showing up."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And you did. Fifteen times."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "No special instruction today."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Just breathe."
      },
      {
        "speaker": "guide",
        "text": "You know how to do this now."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your body knows the rhythm."
      },
      {
        "speaker": "guide",
        "text": "Trust it."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In.",
      "Out.",
      "You know this.",
      "Your body learned this.",
      "Stay.",
      "Halfway home.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "That breath was different from your first one."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Fifteen sessions ago — you followed me."
      },
      {
        "speaker": "guide",
        "text": "Just now — your body led."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not practice anymore."
      },
      {
        "speaker": "guide",
        "text": "That is the program working."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It lives in your body now. It does not need instructions."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Fifteen sessions."
      },
      {
        "speaker": "guide",
        "text": "Three chapters."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the first — you learned you are in the water."
      },
      {
        "speaker": "guide",
        "text": "Your calm travels. Your timing matters."
      },
      {
        "speaker": "guide",
        "text": "Your body has three modes. And small moments are the foundation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the second — you learned to read the map."
      },
      {
        "speaker": "guide",
        "text": "Their signals. Your signals. Safety. Distress. The window."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the third — you learned to hold space."
      },
      {
        "speaker": "guide",
        "text": "Presence without fixing. The fixer and the holder."
      },
      {
        "speaker": "guide",
        "text": "When to step back. How to validate without agreeing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are not the same person who started."
      },
      {
        "speaker": "guide",
        "text": "And you do not have to be perfect to prove it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The second half goes deeper."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Into your own story."
      },
      {
        "speaker": "guide",
        "text": "Where your armor was built. Where your patterns were written."
      },
      {
        "speaker": "guide",
        "text": "The places where your capacity to hold space was shaped — or broken."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It will be harder."
      },
      {
        "speaker": "guide",
        "text": "And you are ready."
      }
    ]
  }
}'::jsonb WHERE session_number = 15 AND track = 'fr_apprentice';

-- ── FR16: fr_session_16_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Sixteen."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "New chapter. The deepest one."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The first three chapters were about them — and about the space between you."
      },
      {
        "speaker": "guide",
        "text": "This chapter is about you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Where your armor was built."
      },
      {
        "speaker": "guide",
        "text": "Where your patterns were first written."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The way you support people — you did not choose it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Someone taught you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe it was a parent who needed you to be the strong one."
      },
      {
        "speaker": "guide",
        "text": "Maybe it was a house where feelings were not safe."
      },
      {
        "speaker": "guide",
        "text": "Maybe it was a role you were given — oldest child, peacekeeper, the one who holds it together."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Whatever it was — it shaped you."
      },
      {
        "speaker": "guide",
        "text": "It built your armor. It wrote your first patterns."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "[trauma_pathway_adjustment — see block above]"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Looking at this is not about blame."
      },
      {
        "speaker": "guide",
        "text": "It is about seeing the blueprint."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Because once you can see it — you can choose what stays."
      },
      {
        "speaker": "guide",
        "text": "And what gets rewritten."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "This might feel like too much."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Looking at where you come from can feel like opening a door you closed for a reason."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You do not have to open it all the way."
      },
      {
        "speaker": "guide",
        "text": "You just have to stand near it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And breathe."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Something new today."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You get to choose your rhythm."
      },
      {
        "speaker": "guide",
        "text": "I will show you the options your body is ready for."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Pick the one that feels right. Not the hardest. Not the easiest."
      },
      {
        "speaker": "guide",
        "text": "The one that feels like yours."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Then we go."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Your rhythm. Your choice.",
      "While you breathe — let the origin come back.",
      "The person. The moment. The role you were given.",
      "Do not judge it. Just see it.",
      "What did it teach you?",
      "What did it cost?",
      "Stay with it.",
      "Your breath holds you here. The memory cannot pull you under.",
      "You survived it then. You can hold it now.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You went back."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And you came back."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the difference between being trapped in your history and looking at it."
      },
      {
        "speaker": "guide",
        "text": "You looked at it. And you are still here."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your history is not your destiny."
      },
      {
        "speaker": "guide",
        "text": "But it is your starting point."
      },
      {
        "speaker": "guide",
        "text": "And now you can see it."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You found your origin story."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The person. The moment. The role."
      },
      {
        "speaker": "guide",
        "text": "It built your armor. It wrote your first code."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Some of that code still runs."
      },
      {
        "speaker": "guide",
        "text": "Some of it served you. Some of it costs you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Now you know where the code came from."
      },
      {
        "speaker": "guide",
        "text": "And that is the first step to choosing what gets updated."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — what carrying someone else''s weight does to your body."
      },
      {
        "speaker": "guide",
        "text": "The weight you have been holding that nobody sees."
      }
    ]
  }
}'::jsonb WHERE session_number = 16 AND track = 'fr_apprentice';

-- ── FR17: fr_session_17_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Seventeen."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you found your origin story."
      },
      {
        "speaker": "guide",
        "text": "Where your armor was built. What it cost."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about a different cost."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The cost of carrying someone else''s weight."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You did not go through what they went through."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But your body has been responding to it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Think about it."
      },
      {
        "speaker": "guide",
        "text": "Has your sleep changed?"
      },
      {
        "speaker": "guide",
        "text": "Do you dream about their problems? Wake up already tired?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Has your mood shifted?"
      },
      {
        "speaker": "guide",
        "text": "Are you shorter with people? Quicker to anger? Harder to reach?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Does the world feel less safe than it used to?"
      },
      {
        "speaker": "guide",
        "text": "Not because something happened to you — but because you watched it happen to them?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is real."
      },
      {
        "speaker": "guide",
        "text": "That is what caring does to a body."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "[trauma_pathway_adjustment — see block above]"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It is not a sign that you are weak."
      },
      {
        "speaker": "guide",
        "text": "It is a sign that you have been carrying weight that was never yours to hold alone."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The armor says — I should be able to handle this."
      },
      {
        "speaker": "guide",
        "text": "They went through the hard thing. Not me."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But your body does not know the difference."
      },
      {
        "speaker": "guide",
        "text": "When you love someone who is hurting — your system takes on the weight."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Naming that is not selfish."
      },
      {
        "speaker": "guide",
        "text": "It is the first step to putting it down."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today we breathe a boundary."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "On each exhale — imagine a circle of calm forming around you."
      },
      {
        "speaker": "guide",
        "text": "Not a wall. Not armor."
      },
      {
        "speaker": "guide",
        "text": "A boundary. The kind that says — I can care about you without drowning in your pain."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The boundary is not to keep them out."
      },
      {
        "speaker": "guide",
        "text": "It is to keep you whole."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In. Fill yourself up.",
      "Out. The boundary forms.",
      "Not a wall. A circle of calm.",
      "Their weight is real. But it does not have to live inside this circle.",
      "You can see the weight. You can name it.",
      "But you do not have to carry it.",
      "In. You are whole.",
      "Out. The boundary holds.",
      "Caring does not mean drowning.",
      "Stay inside the circle.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Feel the circle."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It held."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You did not push them away."
      },
      {
        "speaker": "guide",
        "text": "You drew a line around yourself."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not selfish."
      },
      {
        "speaker": "guide",
        "text": "That is the only way you survive caring this much."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You have been carrying weight that nobody sees."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Their pain. Their fear. Their anger."
      },
      {
        "speaker": "guide",
        "text": "It lives in your sleep. Your mood. Your body."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today you named it."
      },
      {
        "speaker": "guide",
        "text": "And you breathed a boundary around it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That boundary does not make you love them less."
      },
      {
        "speaker": "guide",
        "text": "It makes sure you are still here to love them at all."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — your grief."
      },
      {
        "speaker": "guide",
        "text": "The thing you lost in this that nobody asked about."
      }
    ]
  }
}'::jsonb WHERE session_number = 17 AND track = 'fr_apprentice';

-- ── FR18: fr_session_18_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Eighteen."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you named the weight you carry."
      },
      {
        "speaker": "guide",
        "text": "Today goes underneath it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about your grief."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not theirs. Yours."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Nobody asks the supporter what they lost."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Everyone is focused on the person who went through it."
      },
      {
        "speaker": "guide",
        "text": "And they should be."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But you lost things too."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Time."
      },
      {
        "speaker": "guide",
        "text": "Certainty."
      },
      {
        "speaker": "guide",
        "text": "The relationship you thought you had."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The future you imagined."
      },
      {
        "speaker": "guide",
        "text": "The family holidays that did not happen."
      },
      {
        "speaker": "guide",
        "text": "The version of your child''s life that you carried in your head."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is grief."
      },
      {
        "speaker": "guide",
        "text": "Real grief. For real losses."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And nobody asked you about it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today I am asking."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you is saying — I do not have the right to grieve."
      },
      {
        "speaker": "guide",
        "text": "They went through the hard thing. Not me."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That thought keeps your grief underground."
      },
      {
        "speaker": "guide",
        "text": "And underground grief does not disappear."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It shows up as anger. As numbness. As exhaustion that sleep does not fix."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your grief is not less important than theirs."
      },
      {
        "speaker": "guide",
        "text": "It is different. And it is allowed to exist."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath makes room."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you breathe in — let your lungs fill all the way."
      },
      {
        "speaker": "guide",
        "text": "Make room for the grief."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you breathe out — let it go gently."
      },
      {
        "speaker": "guide",
        "text": "Not erasing it. Just letting it breathe."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You do not have to let go of what you lost."
      },
      {
        "speaker": "guide",
        "text": "You just have to stop holding it so tight."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In. All the way.",
      "Out. Gently.",
      "What did you lose?",
      "Let it come.",
      "It is allowed to be here.",
      "In. Make room.",
      "Out. Release. Not erase.",
      "Your grief is real.",
      "And it does not make theirs less.",
      "Both can live in the same room.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You named it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe for the first time."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your grief."
      },
      {
        "speaker": "guide",
        "text": "Not theirs. Not the family''s. Yours."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It does not need to be earned."
      },
      {
        "speaker": "guide",
        "text": "It does not need permission."
      },
      {
        "speaker": "guide",
        "text": "It just needs to breathe."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Honoring your grief does not take from theirs."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It makes you more whole."
      },
      {
        "speaker": "guide",
        "text": "And a whole supporter is a present one."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You do not have to fix the grief."
      },
      {
        "speaker": "guide",
        "text": "You just have to stop pretending it is not there."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — your anger."
      },
      {
        "speaker": "guide",
        "text": "The thing under the grief that nobody gave you permission to feel."
      }
    ]
  }
}'::jsonb WHERE session_number = 18 AND track = 'fr_apprentice';

-- ── FR19: fr_session_19_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Nineteen."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time you named your grief."
      },
      {
        "speaker": "guide",
        "text": "Today — the thing under it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today is about your anger."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The one nobody gave you permission to feel."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Good supporters are not supposed to be angry."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the rule. The unspoken one."
      },
      {
        "speaker": "guide",
        "text": "Be patient. Be kind. Be understanding."
      },
      {
        "speaker": "guide",
        "text": "Do not be angry."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But you are."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe you are angry at what happened to them."
      },
      {
        "speaker": "guide",
        "text": "Maybe you are angry at them."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe you are angry at yourself."
      },
      {
        "speaker": "guide",
        "text": "For not doing enough. For doing too much. For still being here."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "All of that is real."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Anger is not a problem."
      },
      {
        "speaker": "guide",
        "text": "Anger is information."
      },
      {
        "speaker": "guide",
        "text": "It tells you where a line was crossed. Where a need went unmet."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Pushing it down does not make it go away."
      },
      {
        "speaker": "guide",
        "text": "It just makes it show up sideways."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The armor says — if I let the anger out, I will lose control."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the fear underneath."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But there is a difference between letting anger out and letting anger speak."
      },
      {
        "speaker": "guide",
        "text": "One is an explosion. The other is a conversation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today — we let it speak."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath has fire in it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you breathe out — push it out hard. Through your nose. Sharp."
      },
      {
        "speaker": "guide",
        "text": "Like you are clearing smoke."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you breathe in — slow. Steady. Rebuild."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The exhale is the forge. The inhale is the rebuild."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Sharp out.",
      "Slow in.",
      "Let the heat out.",
      "What are you angry about?",
      "Not what you should be angry about. What you actually are.",
      "Name it.",
      "Sharp out. Let it go.",
      "Slow in. Rebuild.",
      "The anger does not own you.",
      "You own it.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You let it speak."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And nothing broke."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Your anger came up. Your breath held."
      },
      {
        "speaker": "guide",
        "text": "That is the difference between an explosion and a conversation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Anger that is heard becomes information."
      },
      {
        "speaker": "guide",
        "text": "Anger that is buried becomes damage."
      },
      {
        "speaker": "guide",
        "text": "You just chose information."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You are allowed to be angry."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "At what happened. At them. At yourself. At the unfairness."
      },
      {
        "speaker": "guide",
        "text": "All of it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The anger does not make you a bad supporter."
      },
      {
        "speaker": "guide",
        "text": "Pretending it is not there — that is what costs you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — we refill what all of this has drained."
      },
      {
        "speaker": "guide",
        "text": "What restores you. What fills your well. The chapter closes there."
      }
    ]
  }
}'::jsonb WHERE session_number = 19 AND track = 'fr_apprentice';

-- ── FR20: fr_session_20_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Four sessions of honest work."
      },
      {
        "speaker": "guide",
        "text": "Your history. Your weight. Your grief. Your anger."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That took courage."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today — we refill what all of that drained."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "What restores you?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not what you think should restore you."
      },
      {
        "speaker": "guide",
        "text": "What actually does."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe it is a walk with nobody talking."
      },
      {
        "speaker": "guide",
        "text": "Maybe it is music. Cooking. The gym. A bath. Driving with the windows down."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Whatever it is — you know."
      },
      {
        "speaker": "guide",
        "text": "Your body knows."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The problem is not that you do not know what fills the well."
      },
      {
        "speaker": "guide",
        "text": "The problem is you stopped filling it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Because filling your own well felt selfish."
      },
      {
        "speaker": "guide",
        "text": "Because they need you. Because the situation is urgent."
      },
      {
        "speaker": "guide",
        "text": "Because putting yourself first — even for an hour — felt wrong."
      },
      {
        "speaker": "guide",
        "text": ""
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The armor says — they are suffering and I am taking a bath?"
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Yes."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Because a supporter who runs on empty breaks."
      },
      {
        "speaker": "guide",
        "text": "And a broken supporter cannot support anyone."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Filling your well is not about you."
      },
      {
        "speaker": "guide",
        "text": "It is about making sure there is something left to give."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath fills you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not just your lungs. Your whole system."
      },
      {
        "speaker": "guide",
        "text": "Breathe like you are filling a well. Slow. Full. Deliberate."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are allowed to take up this much space."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "In. Fill.",
      "Out. Settle.",
      "You are allowed to take up space.",
      "Think about the thing that restores you.",
      "Let it come back. The feeling. The place. The quiet.",
      "That is not selfish.",
      "That is the well.",
      "In. Fill.",
      "Out. Settle.",
      "The well is filling.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Feel that."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Something filled."
      },
      {
        "speaker": "guide",
        "text": "Maybe a little. Maybe a lot."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not magic."
      },
      {
        "speaker": "guide",
        "text": "That is what happens when you let yourself be the one who receives."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You have been giving for twenty sessions."
      },
      {
        "speaker": "guide",
        "text": "Today you received."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty sessions."
      },
      {
        "speaker": "guide",
        "text": "Four chapters."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the first — you learned you are in the water. Your calm matters."
      },
      {
        "speaker": "guide",
        "text": "In the second — you learned to read the map. Their signals and yours."
      },
      {
        "speaker": "guide",
        "text": "In the third — you learned to hold space. Presence over fixing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And in this chapter — you looked at yourself."
      },
      {
        "speaker": "guide",
        "text": "Your origin. Your weight. Your grief. Your anger."
      },
      {
        "speaker": "guide",
        "text": "And today — what fills you back up."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You did not skip the hard parts."
      },
      {
        "speaker": "guide",
        "text": "You went through them."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What comes next is the final chapter."
      },
      {
        "speaker": "guide",
        "text": "The long game. Repair. Legacy."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And at the end — the bridge."
      },
      {
        "speaker": "guide",
        "text": "Where you stop being an apprentice."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But that is for then."
      },
      {
        "speaker": "guide",
        "text": "Right now — this week — fill your well."
      },
      {
        "speaker": "guide",
        "text": "The one thing you named. Do it. You earned it."
      }
    ]
  }
}'::jsonb WHERE session_number = 20 AND track = 'fr_apprentice';

-- ── FR21: fr_session_21_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty-one."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Final chapter."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "This is not about learning something new."
      },
      {
        "speaker": "guide",
        "text": "This is about becoming someone."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The bridge starts here."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty sessions behind you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Part of you might be looking for the finish line."
      },
      {
        "speaker": "guide",
        "text": "The moment when you are done. When you have learned enough."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "There is no finish line."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not bad news."
      },
      {
        "speaker": "guide",
        "text": "That is the truth about loving someone well."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It does not end. It evolves."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The long game is not about enduring."
      },
      {
        "speaker": "guide",
        "text": "It is about choosing — every day — to show up as the person you have been building."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not the fixer. Not the armor."
      },
      {
        "speaker": "guide",
        "text": "The holder. The reader. The one who stays."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The armor says — I cannot do this forever."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are right. You cannot do what you were doing before — forever."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But you are not the same person who started."
      },
      {
        "speaker": "guide",
        "text": "The long game is different when you are built for it."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath is slow."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not because you need to calm down."
      },
      {
        "speaker": "guide",
        "text": "Because you are practicing patience."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Breathe like someone who has time."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Slow.",
      "You have time.",
      "This breath is not for today.",
      "It is for the person you are becoming.",
      "Stay.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "That was the longest breath yet."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And you did not rush it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the long game."
      },
      {
        "speaker": "guide",
        "text": "Not faster. Not harder. Just — steady. Over time."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You are in this for the long game."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not a burden."
      },
      {
        "speaker": "guide",
        "text": "It is a commitment."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And commitments made consciously — with open eyes — are one of the most powerful things a person can hold."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — rupture and repair."
      },
      {
        "speaker": "guide",
        "text": "What happens when the connection breaks. And how it comes back stronger."
      }
    ]
  }
}'::jsonb WHERE session_number = 21 AND track = 'fr_apprentice';

-- ── FR22: fr_session_22_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty-two."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time — the long game. No finish line."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today — what happens when it breaks."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And how it comes back stronger."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Every relationship breaks."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not might break. Breaks."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "A wrong word. A missed signal. A moment where you were too tired or too angry or too scared to show up the way you wanted to."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is a rupture."
      },
      {
        "speaker": "guide",
        "text": "And it feels like the end."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But it is not."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What matters is not whether it breaks."
      },
      {
        "speaker": "guide",
        "text": "What matters is what you do next."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Repair is not pretending it did not happen."
      },
      {
        "speaker": "guide",
        "text": "Repair is going back. Naming what broke. And choosing to reconnect."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That takes more courage than getting it right the first time."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The armor says — if I was good enough, it would not break."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the lie."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Relationships do not break because you failed."
      },
      {
        "speaker": "guide",
        "text": "They break because they are real. Because two people are human."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The repair is where the strength comes from."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Think of a rupture."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not the worst one. Just one that still has weight."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "While you breathe — hold it. Do not fix it. Do not run from it."
      },
      {
        "speaker": "guide",
        "text": "Just stay with the discomfort."
      },
      {
        "speaker": "guide",
        "text": "That is the practice."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Hold the rupture.",
      "Feel what your body does when it remembers.",
      "Do not run.",
      "What would repair look like?",
      "Stay.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You stayed with the break."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You did not pretend it was not there."
      },
      {
        "speaker": "guide",
        "text": "You did not run."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the first step of repair."
      },
      {
        "speaker": "guide",
        "text": "Being willing to look at what broke."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Rupture is not failure."
      },
      {
        "speaker": "guide",
        "text": "It is the place where the relationship gets real."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Repair is going back."
      },
      {
        "speaker": "guide",
        "text": "Saying — that happened. I see it. I am still here."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are building a repair toolkit."
      },
      {
        "speaker": "guide",
        "text": "Not for when things go wrong. For when they go human."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — the letter you never sent."
      },
      {
        "speaker": "guide",
        "text": "The words that have been sitting in you. Waiting."
      }
    ]
  }
}'::jsonb WHERE session_number = 22 AND track = 'fr_apprentice';

-- ── FR23: fr_session_23_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty-three."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time — rupture and repair. The crack that lets the light in."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today — the words that have been waiting."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The letter you never sent."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "There are things you carry that were never meant to be carried alone."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Things you never said."
      },
      {
        "speaker": "guide",
        "text": "Things that were never said to you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe it is something you need to say to the person you love."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe it is something you need to say to yourself."
      },
      {
        "speaker": "guide",
        "text": "A past version of you. The one who made a choice you still carry."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Maybe it is to someone who is gone."
      },
      {
        "speaker": "guide",
        "text": "A parent. A friend. A child you never got to hold."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The letter does not have to be sent."
      },
      {
        "speaker": "guide",
        "text": "It does not have to be read by anyone."
      },
      {
        "speaker": "guide",
        "text": "It just has to be written."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Because the words that stay inside do not go quiet."
      },
      {
        "speaker": "guide",
        "text": "They get louder."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you does not want to write this."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Because writing it makes it real."
      },
      {
        "speaker": "guide",
        "text": "And real is harder than carrying."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But you have been carrying it."
      },
      {
        "speaker": "guide",
        "text": "And it has not gotten lighter."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Before you write — breathe."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Let the breath hold the space that the words are about to fill."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "When you write — breathe between sentences."
      },
      {
        "speaker": "guide",
        "text": "When you finish — breathe after."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The breath is the container. The words are what goes inside."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Who is the letter for?",
      "Let them come to mind.",
      "What is the first thing you want to say?",
      "Hold it. Do not write yet. Just hold it in your body.",
      "The breath holds the space.",
      "Now write."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You wrote it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Or you sat with it. Both count."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The words that were inside are somewhere now."
      },
      {
        "speaker": "guide",
        "text": "On a page. Or closer to the surface than they were before."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is not small."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "You do not have to send it."
      },
      {
        "speaker": "guide",
        "text": "You do not have to share it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You just had to let it out."
      },
      {
        "speaker": "guide",
        "text": "And you did."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The words that stay inside get louder."
      },
      {
        "speaker": "guide",
        "text": "The ones that find a page get quieter."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Next time — what you are passing on."
      },
      {
        "speaker": "guide",
        "text": "What ends with you. And what travels forward."
      }
    ]
  }
}'::jsonb WHERE session_number = 23 AND track = 'fr_apprentice';

-- ── FR24: fr_session_24_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty-four."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Last time — the letter. The words that were waiting."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today — what travels forward."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What you are passing on."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The work you have done is not just for you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Think about what was passed to you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not just stories. Not just habits."
      },
      {
        "speaker": "guide",
        "text": "States."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The way your mother held her jaw. The way your father breathed when he was angry."
      },
      {
        "speaker": "guide",
        "text": "The way the house felt before anyone said a word."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is what bodies pass down."
      },
      {
        "speaker": "guide",
        "text": "Hurt travels through families. Through generations."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But here is the part nobody tells you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Healing travels the same way."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The regulated system you have been building — that is not just a program for you."
      },
      {
        "speaker": "guide",
        "text": "It is an inheritance."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "What pattern ends with you?"
      },
      {
        "speaker": "guide",
        "text": "What begins with you?"
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "The armor says — that is too big."
      },
      {
        "speaker": "guide",
        "text": "I am just trying to get through the week."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But you are already doing it."
      },
      {
        "speaker": "guide",
        "text": "Every breath you practiced. Every time you held space instead of fixing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is already traveling."
      },
      {
        "speaker": "guide",
        "text": "You just did not know it had a destination."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Today the breath is a legacy."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Breathe knowing that this moment does not end here."
      },
      {
        "speaker": "guide",
        "text": "It travels forward."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are breathing for more than yourself."
      },
      {
        "speaker": "guide",
        "text": "Follow me."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "This breath travels.",
      "What pattern ends with you?",
      "What begins with you?",
      "Breathe for them.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "That breath was not just for you."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "It was for everyone who will ever be loved by someone you changed."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You will never meet most of them."
      },
      {
        "speaker": "guide",
        "text": "But they will breathe easier because of what you did here."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "What you are passing on is not a story."
      },
      {
        "speaker": "guide",
        "text": "It is a state."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "A regulated, connected, present state."
      },
      {
        "speaker": "guide",
        "text": "That is the most powerful inheritance a person can leave."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Tomorrow — or whenever you come back — it is time."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The bridge."
      },
      {
        "speaker": "guide",
        "text": "Where you stop being an apprentice."
      },
      {
        "speaker": "guide",
        "text": "And become what you have been building."
      }
    ]
  }
}'::jsonb WHERE session_number = 24 AND track = 'fr_apprentice';

-- ── FR25: fr_session_25_ff.yml ──
UPDATE session_templates SET dialogue_phases = '{
  "arrival": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty-five."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The last one."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Twenty-five times you chose to show up."
      },
      {
        "speaker": "guide",
        "text": "Twenty-five times you chose to breathe, to reflect, to stay."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You came here as a supporter."
      },
      {
        "speaker": "guide",
        "text": "You are leaving as something more."
      }
    ]
  },
  "opening": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Think about the person who opened this app for the first time."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That person thought their job was to wait on the sidelines."
      },
      {
        "speaker": "guide",
        "text": "To fix. To endure. To be strong enough."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That person did not know their calm could change a room."
      },
      {
        "speaker": "guide",
        "text": "Did not know how to read the signals."
      },
      {
        "speaker": "guide",
        "text": "Did not know the difference between a reach and a warning shot."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That person had never named their grief."
      },
      {
        "speaker": "guide",
        "text": "Had never let their anger speak."
      },
      {
        "speaker": "guide",
        "text": "Had never written the letter."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are not that person anymore."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not because you learned the right things."
      },
      {
        "speaker": "guide",
        "text": "Because you did the hard things."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Today you cross the bridge."
      }
    ]
  },
  "resistance": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Part of you does not believe it."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The armor says — I am not ready."
      },
      {
        "speaker": "guide",
        "text": "The armor says — I still do not know enough."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "But the program knows."
      },
      {
        "speaker": "guide",
        "text": "Your body knows. It has been showing you for twenty-five sessions."
      }
    ]
  },
  "before_the_breath": {
    "lines": [
      {
        "speaker": "guide",
        "text": "One last breath together."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "No instruction."
      },
      {
        "speaker": "guide",
        "text": "No focus. No special technique."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Just you. And the rhythm you built."
      },
      {
        "speaker": "guide",
        "text": "I will be here. But this one is yours."
      }
    ]
  },
  "breathing": {
    "round_cues": [
      "Yours.",
      "I am still here.",
      "Good."
    ]
  },
  "shift_moment": {
    "lines": [
      {
        "speaker": "guide",
        "text": "That was yours."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "I did not lead it. You did."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "That is the bridge."
      },
      {
        "speaker": "guide",
        "text": "You just crossed it."
      }
    ]
  },
  "close": {
    "lines": [
      {
        "speaker": "guide",
        "text": "Twenty-five sessions."
      },
      {
        "speaker": "guide",
        "text": "Five chapters."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the first — you learned you are in the water."
      },
      {
        "speaker": "guide",
        "text": "Your calm travels. Your timing matters. Small moments are the foundation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the second — you learned to read the map."
      },
      {
        "speaker": "guide",
        "text": "Their signals. Your signals. The window."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the third — you learned to hold space."
      },
      {
        "speaker": "guide",
        "text": "Presence. The fixer and the holder. When to step back. The language of validation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "In the fourth — you looked at yourself."
      },
      {
        "speaker": "guide",
        "text": "Your origin. The weight you carry. Your grief. Your anger. What fills the well."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And in the fifth — you found the long game."
      },
      {
        "speaker": "guide",
        "text": "Rupture and repair. The letter. What you are passing on."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "And today — the bridge."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You came here as a supporter."
      },
      {
        "speaker": "guide",
        "text": "Someone on the sidelines. Watching. Waiting. Hoping."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "You are not on the sidelines anymore."
      },
      {
        "speaker": "guide",
        "text": "You are in the water."
      },
      {
        "speaker": "guide",
        "text": "You did your own work."
      },
      {
        "speaker": "guide",
        "text": "You built your own foundation."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "The next session you open will be session twenty-six."
      },
      {
        "speaker": "guide",
        "text": "You will not be starting over."
      },
      {
        "speaker": "guide",
        "text": "You will be continuing."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Not as an apprentice."
      },
      {
        "speaker": "guide",
        "text": "As someone who crossed the bridge."
      },
      {
        "speaker": "guide",
        "text": ""
      },
      {
        "speaker": "guide",
        "text": "Welcome."
      }
    ]
  }
}'::jsonb WHERE session_number = 25 AND track = 'fr_apprentice';

