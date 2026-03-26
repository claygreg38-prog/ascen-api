// ============================================================
// Quilting Monitor — Session 3 Active Monitoring
// File: src/abi/quiltingMonitor.js
//
// Sonnet reads parent and elder biometrics during child's sharing.
// This is the highest-stakes 15 minutes in the platform.
// Cost: ~$0.02-0.05 per session. Justified.
//
// The ONLY session where AI monitors biometrics in real-time
// during content delivery.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');
// FIX #8: Explicit cross-file import — convertToCoBreath is defined in quiltingEngine.js
const { convertToCoBreath } = require('./quiltingEngine');

const INTERVENTION_TRIGGERS = [
  {
    signal: 'parent_hrv_crash',
    description: 'Parent HRV drops below personal baseline by >20% for >60 seconds',
    check: (bio, baseline) => {
      return bio.hrv < baseline.mean_hrv * 0.8 && bio.sustained_below_seconds > 60;
    },
    action: 'co_breath_pause',
    luno_says: "Let's pause here and breathe together for a moment. There's no rush."
  },
  {
    signal: 'child_coherence_drop',
    description: 'Child coherence drops sharply during their own sharing',
    check: (bio) => {
      return bio.coherence < 0.15 && bio.coherence_delta < -0.3;
    },
    action: 'normalize',
    luno_says: "What you're sharing is important. Take a breath. We're listening."
  },
  {
    signal: 'elder_defensive',
    description: 'Elder shows defensive activation (elevated HR + increased respiratory rate)',
    check: (bio, baseline) => {
      return bio.hr > baseline.mean_hr * 1.2 && bio.respiratory_rate > 18;
    },
    action: 'room_breath',
    luno_says: "This is a lot to hold. Everyone breathe. Nobody has to respond right now."
  },
  {
    signal: 'any_below_window',
    description: 'Any member NS3 drops into below_window for >90 seconds',
    check: (bio) => {
      return bio.ns3 < 25 && bio.sustained_below_window_seconds > 90;
    },
    action: 'hard_stop',
    luno_says: "We've done powerful work today. Let's close with a long breath together."
  }
];

async function monitorSession3Tick(sessionId, memberBiometrics, baselines) {
  const interventions = [];

  for (const [userId, bio] of Object.entries(memberBiometrics)) {
    const baseline = baselines[userId] || {};
    const role = bio.role; // 'elder', 'parent', 'child'

    for (const trigger of INTERVENTION_TRIGGERS) {
      let shouldFire = false;

      if (trigger.signal === 'parent_hrv_crash' && role === 'parent') {
        shouldFire = trigger.check(bio, baseline);
      } else if (trigger.signal === 'child_coherence_drop' && role === 'child') {
        shouldFire = trigger.check(bio);
      } else if (trigger.signal === 'elder_defensive' && role === 'elder') {
        shouldFire = trigger.check(bio, baseline);
      } else if (trigger.signal === 'any_below_window') {
        shouldFire = trigger.check(bio);
      }

      if (shouldFire) {
        interventions.push({
          signal: trigger.signal,
          action: trigger.action,
          member: userId,
          role,
          luno_says: trigger.luno_says,
          timestamp: Date.now()
        });

        // Record intervention
        await pool.query(
          'UPDATE quilting_sessions SET interventions = interventions || $1::jsonb WHERE id = $2',
          [JSON.stringify([{ signal: trigger.signal, action: trigger.action, member: userId, timestamp: Date.now() }]), sessionId]
        );

        // Hard stop = session converts immediately. Non-negotiable.
        if (trigger.action === 'hard_stop') {
          await convertToCoBreath(sessionId, trigger.signal);
          return { intervention: trigger, hard_stop: true, luno_says: trigger.luno_says };
        }
      }
    }
  }

  // Log monitoring tick to Sonnet monitoring log
  await pool.query(`
    UPDATE quilting_sessions SET sonnet_monitoring_log = COALESCE(sonnet_monitoring_log, '[]'::jsonb) || $1::jsonb
    WHERE id = $2
  `, [JSON.stringify([{
    timestamp: Date.now(),
    member_count: Object.keys(memberBiometrics).length,
    interventions_fired: interventions.length,
    interventions: interventions.map(i => i.signal)
  }]), sessionId]);

  return { interventions, hard_stop: false };
}

module.exports = { monitorSession3Tick, INTERVENTION_TRIGGERS };
