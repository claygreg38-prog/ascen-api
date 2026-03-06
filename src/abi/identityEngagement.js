// ============================================================
// identityEngagement.js — Identity Gate + Companionship Mode
// Shared device verification + court-mandated non-engagement
// ============================================================

class IdentityGate {
  constructor(config = {}) {
    this.method = config.verification_method || 'pin';
    this.facilityMode = config.facility_mode || false;
  }

  getChallenge() {
    return {
      type: this.method,
      prompt: this.method === 'pin' ? 'Enter your 4-digit PIN' : 'Verify your identity',
      max_attempts: 3
    };
  }

  verify(input, stored) {
    return input === stored;
  }
}

class CompanionshipMode {
  constructor() {
    this.active = false;
    this.activatedAt = null;
  }

  static shouldActivate(recentSessions) {
    if (!recentSessions || recentSessions.length < 3) return { should_activate: false };
    const avgCompletion = recentSessions.reduce((s, r) => s + (r.cycle_completion_rate || 0), 0) / recentSessions.length;
    return { should_activate: avgCompletion < 0.15, avg_completion: avgCompletion };
  }

  activate() {
    this.active = true;
    this.activatedAt = Date.now();
  }

  getLunoMessage() {
    return "Luno is here. No expectations. This time counts.";
  }
}

module.exports = { IdentityGate, CompanionshipMode };
