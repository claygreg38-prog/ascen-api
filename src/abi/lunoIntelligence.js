// lunoIntelligence.js — Luno's personality engine
// FIXED: model ID, online retry, clinical flags not sent to third-party API

class LunoIntelligence {
  constructor(userId, pool, contextPacket = null) {
    this.userId = userId;
    this.pool = pool;
    this.context = contextPacket;
    this.online = true;
    this.lastApiFailure = null;
    this.dialogueCache = {};
  }

  async loadSessionFromPacket(contextPacket) { this.context = contextPacket; }

  async getPhaseDialogue(phase) {
    // Reset online flag after 30s cooldown (FIXED: was permanent disable)
    if (!this.online && this.lastApiFailure && (Date.now() - this.lastApiFailure) > 30000) {
      this.online = true;
    }

    const base = {
      arrival: { text: "Luno's checking in with you.\nYou don't have to do anything yet.\nJust land.", type: 'arrival' },
      pre_breathing: { text: "When you're ready, your breath will lead.", type: 'pre_breathing' },
      mid_session: { text: "You're here. That's the practice.", type: 'mid_session' },
      mirror: { text: "Look at what you just did.", type: 'mirror' },
      closing: { text: "Your body remembers this now.", type: 'closing' }
    };

    // If API available and context exists, try personalized dialogue
    if (this.online && this.context && process.env.ANTHROPIC_API_KEY) {
      try {
        const personalized = await this._callAPI(phase);
        if (personalized) return { text: personalized, type: phase, personalized: true };
      } catch (err) {
        console.warn(`Luno API failed for ${phase}: ${err.message}`);
        this.lastApiFailure = Date.now();
        this.online = false;
      }
    }

    return base[phase] || base.arrival;
  }

  async _callAPI(phase) {
    // Model ID: FIXED from non-existent 'claude-haiku-4-5-20251001'
    const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-3-5-20241022';

    // FIXED: clinical flags translated to behavioral instructions only
    // Raw clinical data (trend_flags, avoid_topics) NOT sent to third-party API
    let toneAdjustment = '';
    if (this.context && this.context.trend_flags && this.context.trend_flags.length > 0) {
      toneAdjustment = 'Tone adjustment: User may be in a fragile state. Keep dialogue especially gentle and grounding.';
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
          max_tokens: 150,
          messages: [{ role: 'user', content: `Generate a brief, warm ${phase} dialogue for a breathwork session. ${toneAdjustment}` }]
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
  return { user_id: userId, generated_at: new Date().toISOString(), optimal_ratio: axisData?.optimal_ratio || null, track_trajectory: axisData?.track_trajectory || 'stable', coaching_bias: axisData?.coaching_bias || 'neutral', session_notes: [] };
}

module.exports = { LunoIntelligence, generateContextPacket };
