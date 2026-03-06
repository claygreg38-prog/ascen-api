// ============================================================
// microAffirmations.js — Track-aware session affirmations
// Never performative. Always earned. Body-first language.
// ============================================================

const AFFIRMATION_BANK = {
  session_complete: {
    minimal: [
      "You showed up. That's the whole thing.",
      "Your body just did something it couldn't do before.",
      "Two minutes of breathing. That's not small."
    ],
    gentle: [
      "Your breath found its own rhythm today.",
      "You stayed present. That's regulation.",
      "The body remembers what the mind forgets."
    ],
    standard: [
      "Your nervous system is learning a new language.",
      "That coherence wasn't given to you. You built it.",
      "The breath you just took is changing the story."
    ]
  },
  track_advanced: {
    default: "Your body told us it was ready. We listened."
  },
  high_coherence: {
    default: "Your heart and breath found each other today."
  },
  pause_recovery: {
    default: "You paused and came back. That's the practice."
  },
  companionship: {
    default: "Luno was here. That counts."
  }
};

function getAffirmation(track, type, context = {}) {
  const bank = AFFIRMATION_BANK[type];
  if (!bank) return null;

  const trackBank = bank[track] || bank.default;
  if (Array.isArray(trackBank)) {
    return { type, message: trackBank[Math.floor(Math.random() * trackBank.length)] };
  }
  if (typeof trackBank === 'string') {
    return { type, message: trackBank };
  }
  return null;
}

function getSessionAffirmations(sessionData, user) {
  const affirmations = [];
  const track = sessionData.track || user.breath_track || 'standard';

  // Always give completion affirmation
  const completion = getAffirmation(track, 'session_complete');
  if (completion) affirmations.push(completion);

  // High coherence bonus
  if (sessionData.coherence_peak > 0.7) {
    const coh = getAffirmation(track, 'high_coherence');
    if (coh) affirmations.push(coh);
  }

  // Pause recovery
  if (sessionData.pause_count > 0 && sessionData.cycle_completion_rate > 0.5) {
    const pr = getAffirmation(track, 'pause_recovery');
    if (pr) affirmations.push(pr);
  }

  return affirmations;
}

module.exports = { getAffirmation, getSessionAffirmations };
