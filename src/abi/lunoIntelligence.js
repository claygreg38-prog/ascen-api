// ============================================================
// lunoIntelligence.js — Luno's personality engine (enhanced)
// Voice tiers, outcome-aware mirror, coaching bias, prompt caching
// ============================================================

const VOICE_TIERS = {
  arrival: { max_tokens: 80, temperature: 0.6 },
  pre_breathing: { max_tokens: 60, temperature: 0.5 },
  mid_session: { max_tokens: 50, temperature: 0.4 },
  mirror: { max_tokens: 120, temperature: 0.7 },
  closing: { max_tokens: 80, temperature: 0.6 }
};

const BASE_DIALOGUES = {
  arrival: { text: "Luno's checking in with you.\nYou don't have to do anything yet.\nJust land.", type: 'arrival' },
  pre_breathing: { text: "When you're ready, your breath will lead.", type: 'pre_breathing' },
  mid_session: { text: "You're here. That's the practice.", type: 'mid_session' },
  mirror: { text: "Look at what you just did.", type: 'mirror' },
  closing: { text: "Your body remembers this now.", type: 'closing' }
};

// Simple in-memory prompt cache (TTL: 10 minutes)
const promptCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function getCacheKey(userId, phase, contextHash) {
  return `${userId}:${phase}:${contextHash || 'none'}`;
}

class LunoIntelligence {
  constructor(userId, pool, contextPacket = null) {
    this.userId = userId;
    this.pool = pool;
    this.context = contextPacket;
    this.online = true;
    this.lastApiFailure = null;
    this.dialogueCache = {};
    this.sessionOutcome = null;
  }

  async loadSessionFromPacket(contextPacket) { this.context = contextPacket; }

  setSessionOutcome(outcome) {
    this.sessionOutcome = outcome;
  }

  async getPhaseDialogue(phase) {
    // Reset online flag after 30s cooldown
    if (!this.online && this.lastApiFailure && (Date.now() - this.lastApiFailure) > 30000) {
      this.online = true;
    }

    // Check prompt cache first
    const contextHash = this.context ? JSON.stringify({
      track: this.context.track_trajectory,
      bias: this.context.coaching_bias,
      ratio: this.context.breath_ratio
    }) : null;
    const cacheKey = getCacheKey(this.userId, phase, contextHash);
    const cached = promptCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      return { ...cached.value, cached: true };
    }

    // If API available and context exists, try personalized dialogue
    if (this.online && this.context && process.env.ANTHROPIC_API_KEY) {
      try {
        const personalized = await this._callAPI(phase);
        if (personalized) {
          const result = { text: personalized, type: phase, personalized: true };
          promptCache.set(cacheKey, { value: result, ts: Date.now() });
          return result;
        }
      } catch (err) {
        console.warn(`Luno API failed for ${phase}: ${err.message}`);
        this.lastApiFailure = Date.now();
        this.online = false;
      }
    }

    return BASE_DIALOGUES[phase] || BASE_DIALOGUES.arrival;
  }

  /**
   * Outcome-aware mirror dialogue.
   * Uses session metrics to tailor the mirror phase response.
   */
  async getMirrorDialogue(sessionMetrics) {
    if (!sessionMetrics) return this.getPhaseDialogue('mirror');

    const coherenceEnd = sessionMetrics.coherence_end || 0;
    const exitType = sessionMetrics.exit_type || 'normal';
    const panicEvent = sessionMetrics.panic_event || false;

    // Outcome-aware base responses
    if (panicEvent) {
      return { text: "You stayed. Even when it was hard. That courage is yours.", type: 'mirror', outcome: 'panic_recovery' };
    }
    if (exitType === 'honorable_exit') {
      return { text: "Knowing when to stop is wisdom, not weakness.", type: 'mirror', outcome: 'honorable_exit' };
    }
    if (coherenceEnd > 0.7) {
      return { text: "Your nervous system found its rhythm today. Feel that.", type: 'mirror', outcome: 'high_coherence' };
    }
    if (coherenceEnd > 0.4) {
      return { text: "Look at what you just did. Your body is learning.", type: 'mirror', outcome: 'moderate_coherence' };
    }
    return { text: "You showed up. That is the practice.", type: 'mirror', outcome: 'building' };
  }

  async _callAPI(phase) {
    const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    const tier = VOICE_TIERS[phase] || VOICE_TIERS.arrival;

    // Clinical flags translated to behavioral instructions only
    let toneAdjustment = '';
    if (this.context?.trend_flags?.length > 0) {
      toneAdjustment = 'Tone adjustment: User may be in a fragile state. Keep dialogue especially gentle and grounding.';
    }

    // Coaching bias integration
    let coachingBias = '';
    if (this.context?.coaching_bias && this.context.coaching_bias !== 'neutral') {
      coachingBias = `Coaching direction: ${this.context.coaching_bias}.`;
    }

    // Breath context for arrival
    let breathContext = '';
    if (phase === 'arrival' && this.context?.breath_ratio) {
      breathContext = `The breathing rhythm has been set. Do not mention the specific ratio.`;
    }

    // Outcome context for mirror
    let outcomeContext = '';
    if (phase === 'mirror' && this.sessionOutcome) {
      const o = this.sessionOutcome;
      if (o.panic_event) outcomeContext = 'User experienced activation but completed the session. Acknowledge courage.';
      else if (o.coherence_end > 0.6) outcomeContext = 'Session went well. Acknowledge without being excessive.';
      else outcomeContext = 'Session was a building session. Acknowledge showing up.';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: tier.max_tokens,
          messages: [{
            role: 'user',
            content: `Generate a brief, warm ${phase} dialogue for a breathwork session. 2-3 sentences max. Speak as Luno — warm, grounded, never clinical. ${toneAdjustment} ${coachingBias} ${breathContext} ${outcomeContext}`.trim()
          }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      return data.content?.[0]?.text || null;
    } catch (err) {
      clearTimeout(timeout);
      this.lastApiFailure = Date.now();
      throw err;
    }
  }
}

function generateContextPacket(userId, axisData) {
  return {
    user_id: userId,
    generated_at: new Date().toISOString(),
    optimal_ratio: axisData?.optimal_ratio || null,
    track_trajectory: axisData?.track_trajectory || 'stable',
    coaching_bias: axisData?.coaching_bias || 'neutral',
    session_notes: [],
    trend_flags: axisData?.trend_flags || []
  };
}

module.exports = { LunoIntelligence, generateContextPacket };
