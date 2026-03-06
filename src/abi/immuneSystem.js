// immuneSystem.js — Safety detection system
// FIXED: stateData parameter, gate formula, vault matching, dashboard counts

const GATE_SESSION_THRESHOLDS = { 1: 5, 2: 15, 3: 30, 4: 100 };

class ImmuneSystem {
  constructor(userId, pool) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') throw new Error('ImmuneSystem: userId required');
    this.userId = userId;
    this.pool = pool;
    this.barriers = [];
    this.flags = [];
    this.events = [];
  }

  checkBarriers(action) {
    const violations = [];
    // FIXED: gate check formula uses threshold directly
    if (action && action.session_number && action.sessions_completed !== undefined) {
      for (const [gateId, threshold] of Object.entries(GATE_SESSION_THRESHOLDS)) {
        if (action.session_number > threshold && action.sessions_completed < threshold) {
          violations.push({ barrier: 'gate', detail: `Gate ${gateId} requires ${threshold} completed sessions` });
        }
      }
    }
    if (violations.length > 0) return { blocked: true, barriers: violations, reason: violations[0].detail };
    return { blocked: false, barriers: [] };
  }

  // FIXED: stateData passed as parameter (was missing — gaming detection was dead code)
  async postSessionScan(sessionData, stateData) {
    const flags = [];

    if (sessionData.coherence_peak < 0.15 && sessionData.session_number > 10) {
      flags.push({ type: 'coherence_regression', severity: 'watch', message: 'Coherence consistently low' });
    }
    if (sessionData.panic_event) {
      flags.push({ type: 'panic_event', severity: 'alert', message: 'Panic detected during session' });
    }
    if (sessionData.exit_type === 'exit' && sessionData.pause_count > 3) {
      flags.push({ type: 'early_exit_pattern', severity: 'watch', message: 'Multiple pauses leading to exit' });
    }

    // FIXED: gaming detection now works — stateData is passed
    if (stateData && stateData.coherence_std_dev !== undefined && stateData.coherence_std_dev < 0.01) {
      flags.push({ type: 'data_integrity', severity: 'watch', message: 'Suspiciously flat coherence — possible gaming' });
    }

    // Vault signal detection — FIXED: word-boundary matching to reduce false positives
    if (sessionData.vault_text) {
      const text = sessionData.vault_text.toLowerCase();
      const crisisPatterns = ['want to die', 'kill myself', 'end it all', 'no reason to live'];
      const concernPatterns = ['hopeless', 'worthless', 'give up'];

      for (const pattern of crisisPatterns) {
        if (text.includes(pattern)) {
          flags.push({ type: 'vault_crisis_signal', severity: 'critical', message: 'Crisis language detected in vault entry', pattern });
          break;
        }
      }
      for (const pattern of concernPatterns) {
        // FIXED: use word boundary regex for single words
        const regex = new RegExp(`\\b${pattern}\\b`);
        if (regex.test(text)) {
          flags.push({ type: 'vault_concern_signal', severity: 'alert', message: 'Concern language detected in vault entry' });
          break;
        }
      }
    }

    if (flags.length > 0) {
      try { await this.pool.query(`INSERT INTO immune_flags (user_id, session_id, flags, created_at) VALUES ($1, $2, $3, NOW())`, [this.userId, sessionData.session_id, JSON.stringify(flags)]); }
      catch (err) { console.error('[Immune] Flag write failed:', err.message); }
    }

    this.events.push(...flags.map(f => ({ ...f, time: Date.now(), response_level: f.severity === 'critical' ? 4 : f.severity === 'alert' ? 3 : 2 })));
    return { flags, requires_review: flags.some(f => f.severity === 'alert' || f.severity === 'critical') };
  }

  // FIXED: dashboard counts use exact equality per tier
  getDashboardView() {
    const last30Days = this.events.filter(e => e.time > Date.now() - 30 * 24 * 60 * 60 * 1000);
    return {
      emergencies: last30Days.filter(e => e.response_level === 4).length,
      alerts: last30Days.filter(e => e.response_level === 3).length,
      watches: last30Days.filter(e => e.response_level === 2).length,
      total_events: last30Days.length
    };
  }
}

module.exports = { ImmuneSystem };
