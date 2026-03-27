// ============================================================
// [ABI] Clinical Coaching Engine — Sonnet Trigger-Based Coaching
// File: src/abi/clinicalCoachingEngine.js
//
// Monitors kitchen table biometric stream and fires Sonnet at
// trigger moments. Coaching cards visible ONLY to clinician.
//
// Correction #5: 30-second Sonnet cooldown per member.
// Correction #6: Sentry in all catch blocks.
//
// Uses aiRouter for model selection + cost tracking + fallback.
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');
const aiRouter = require('../services/aiRouter');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Correction #5: Sonnet cooldown — minimum 30s between Sonnet calls per member
const SONNET_COOLDOWN_MS = 30000;
const sonnetCooldowns = new Map(); // `${sessionId}:${memberId}` → last call timestamp

// ── TRIGGER CONDITIONS ────────────────────────────────────────

const TRIGGERS = {
  dysregulation: {
    check: (member, baseline) => {
      const hrSpike = member.hr - baseline.hr > 15;
      const hrvDrop = baseline.hrv > 0 && (baseline.hrv - member.hrv) / baseline.hrv > 0.3;
      const rrShift = Math.abs(member.rr - baseline.rr) > 4;
      return hrSpike || hrvDrop || rrShift;
    },
    classify: (member, baseline) => {
      if (member.hr > baseline.hr + 15 && member.engagement_active) return 'fight';
      if (member.hr > baseline.hr + 10 && !member.engagement_active) return 'flight';
      if (member.hr < baseline.hr - 5 && member.hrv < baseline.hrv * 0.5) return 'freeze';
      return 'activated';
    }
  },
  cascade: {
    check: (members, baselines) => {
      const recentDrops = members.filter((m, i) =>
        baselines[i] && baselines[i].hrv > 0 &&
        (baselines[i].hrv - m.hrv) / baselines[i].hrv > 0.2
      );
      return recentDrops.length >= 2;
    }
  },
  breakthrough: {
    check: (member, baseline, engagementDuration) => {
      const activated = baseline.hrv > 0 && (baseline.hrv - member.hrv) / baseline.hrv > 0.2;
      return activated && engagementDuration > 90;
    }
  },
  withdrawal: {
    check: (member, engagementGap) => {
      return engagementGap > 60 && member.hrv_trend === 'declining';
    }
  },
  co_regulation: {
    check: (memberA, memberB) => {
      return Math.abs(memberA.rr - memberB.rr) < 1 && memberA.rr_sync_duration > 30;
    }
  }
};

// ── HAIKU: Fast pattern classification ────────────────────────

async function classifyPattern(biometricData, triggerType) {
  try {
    const result = await aiRouter.route(
      'clinical_biometric_classification',
      `Classify this biometric pattern. Trigger: ${triggerType}. Data: ${JSON.stringify(biometricData)}`,
      {
        systemPrompt: 'You classify biometric patterns for a family therapy session. Respond with JSON only: { "type": "fight|flight|freeze|activated|settling|co_regulating", "severity": "low|medium|high", "member_state": "brief description" }',
        maxTokens: 200,
        _forceTier: 'haiku'
      }
    );

    if (result && result.content) {
      try {
        const text = result.content.replace(/```json|```/g, '').trim();
        return JSON.parse(text);
      } catch {
        return { type: 'activated', severity: 'medium', member_state: 'Pattern detected but unclassified' };
      }
    }
    return { type: 'activated', severity: 'medium', member_state: 'Classification unavailable' };
  } catch (err) {
    Sentry.captureException(err);
    return { type: 'activated', severity: 'medium', member_state: 'Classification error' };
  }
}

// ── SONNET: Coaching card generation ──────────────────────────

async function generateCoachingCard(sessionContext, triggerType, memberName, familyProfile) {
  try {
    const systemPrompt = `You are Luno, the clinical coaching assistant for ASCEN BreathWorx family therapy sessions. You observe biometric data and provide coaching suggestions to the treating clinician.

RULES:
- You coach the clinician, never the family. Your output appears on the clinician's private dashboard only.
- Voice: Warm, direct, clinically precise. No jargon.
- Use HOS vocabulary: Armor (not diagnosis), Firmware (not treatment), System Code (not pathology).
- Format: Respond with JSON only: { "observed": "biometric fact, 1 sentence", "likely": "clinical interpretation, 1 sentence", "consider": "dialogue suggestion, 1-2 sentences the clinician can use or adapt" }
- Cultural context: Honor the family's background. Dialogue suggestions must be culturally appropriate.
- The family member's name is ${memberName}.`;

    const result = await aiRouter.route(
      'clinical_coaching_card',
      `Trigger: ${triggerType}\nSession context: ${JSON.stringify(sessionContext)}\nFamily profile: ${JSON.stringify(familyProfile)}`,
      {
        systemPrompt,
        maxTokens: 500,
        _forceTier: 'sonnet'
      }
    );

    if (result && result.content) {
      try {
        const text = result.content.replace(/```json|```/g, '').trim();
        return JSON.parse(text);
      } catch {
        return buildFallbackCard(memberName, triggerType);
      }
    }
    return buildFallbackCard(memberName, triggerType);
  } catch (err) {
    Sentry.captureException(err);
    return buildFallbackCard(memberName, triggerType);
  }
}

function buildFallbackCard(memberName, triggerType) {
  return {
    observed: `${memberName}'s system shifted during this topic.`,
    likely: 'This topic touches something important.',
    consider: `"${memberName}, I notice this topic carries weight. What does your body want you to know right now?"`
  };
}

// ── COOLDOWN CHECK ────────────────────────────────────────────

function checkSonnetCooldown(sessionId, memberId) {
  const key = `${sessionId}:${memberId || 'all'}`;
  const lastCall = sonnetCooldowns.get(key);
  if (lastCall && Date.now() - lastCall < SONNET_COOLDOWN_MS) {
    return false; // Cooldown active
  }
  return true; // OK to fire
}

function recordSonnetCall(sessionId, memberId) {
  const key = `${sessionId}:${memberId || 'all'}`;
  sonnetCooldowns.set(key, Date.now());
}

// ── BIOMETRIC TICK PROCESSING ─────────────────────────────────

async function processBiometricTick(sessionId, members, baselines, engagementStates, familyProfile) {
  const alerts = [];

  try {
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const baseline = baselines[i];
      const engagement = engagementStates[i];

      // Check dysregulation
      if (TRIGGERS.dysregulation.check(member, baseline)) {
        const type = TRIGGERS.dysregulation.classify(member, baseline);
        const classification = await classifyPattern(member, type);

        if (classification.severity !== 'low') {
          // Correction #5: Check Sonnet cooldown before firing
          if (checkSonnetCooldown(sessionId, member.user_id)) {
            const card = await generateCoachingCard(
              { members, activeTopic: engagement.activeTopic, elapsed: engagement.elapsed },
              `dysregulation_${type}`,
              member.name,
              familyProfile
            );
            recordSonnetCall(sessionId, member.user_id);

            await logCoachingCard(sessionId, 'dysregulation', member.user_id, card);
            alerts.push({ type: 'coaching_card', trigger: 'dysregulation', member_id: member.user_id, card });
          } else {
            // Cooldown active — log alert without Sonnet call
            alerts.push({ type: 'dysregulation_alert', member_id: member.user_id, dysregulation_type: type, severity: classification.severity, cooldown_active: true });
          }
        } else {
          alerts.push({ type: 'dysregulation_alert', member_id: member.user_id, dysregulation_type: type, severity: 'low' });
        }
      }

      // Check breakthrough
      if (TRIGGERS.breakthrough.check(member, baseline, engagement.active_duration || 0)) {
        if (checkSonnetCooldown(sessionId, member.user_id)) {
          const card = await generateCoachingCard(
            { members, activeTopic: engagement.activeTopic, elapsed: engagement.elapsed },
            'breakthrough_proximity',
            member.name,
            familyProfile
          );
          recordSonnetCall(sessionId, member.user_id);

          await logCoachingCard(sessionId, 'breakthrough', member.user_id, card);
          alerts.push({ type: 'coaching_card', trigger: 'breakthrough', member_id: member.user_id, card });
        }
      }

      // Check withdrawal
      if (TRIGGERS.withdrawal.check(member, engagement.last_active_gap || 0)) {
        if (checkSonnetCooldown(sessionId, member.user_id)) {
          const card = await generateCoachingCard(
            { members, activeTopic: engagement.activeTopic, elapsed: engagement.elapsed },
            'sustained_withdrawal',
            member.name,
            familyProfile
          );
          recordSonnetCall(sessionId, member.user_id);

          await logCoachingCard(sessionId, 'withdrawal', member.user_id, card);
          alerts.push({ type: 'coaching_card', trigger: 'withdrawal', member_id: member.user_id, card });
        }
      }
    }

    // Check cascade (all members)
    if (TRIGGERS.cascade.check(members, baselines)) {
      if (checkSonnetCooldown(sessionId, null)) {
        const card = await generateCoachingCard(
          { members, activeTopic: engagementStates[0]?.activeTopic, elapsed: engagementStates[0]?.elapsed },
          'cascade_detected',
          'the family',
          familyProfile
        );
        recordSonnetCall(sessionId, null);

        await logCoachingCard(sessionId, 'cascade', null, card);
        alerts.push({ type: 'coaching_card', trigger: 'cascade', card });
      }
    }

    // Check co-regulation (pairwise)
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (TRIGGERS.co_regulation.check(members[i], members[j])) {
          if (checkSonnetCooldown(sessionId, null)) {
            const card = await generateCoachingCard(
              { members: [members[i], members[j]], elapsed: engagementStates[0]?.elapsed },
              'co_regulation',
              `${members[i].name} and ${members[j].name}`,
              familyProfile
            );
            recordSonnetCall(sessionId, null);

            await logCoachingCard(sessionId, 'co_regulation', null, card);
            alerts.push({ type: 'coaching_card', trigger: 'co_regulation', member_ids: [members[i].user_id, members[j].user_id], card });
          }
        }
      }
    }
  } catch (err) {
    console.error('[ClinicalCoaching] processBiometricTick failed:', err.message);
    Sentry.captureException(err);
  }

  return alerts;
}

// ── ON-DEMAND COACH ME ────────────────────────────────────────

async function coachMe(sessionId, members, baselines, engagementStates, familyProfile, sessionHistory) {
  try {
    const card = await generateCoachingCard(
      {
        members,
        baselines,
        engagementStates,
        sessionHistory: (sessionHistory || []).slice(-5),
        elapsed: engagementStates[0]?.elapsed
      },
      'coach_me_request',
      'the family',
      familyProfile
    );

    await logCoachingCard(sessionId, 'coach_me', null, card);
    return card;
  } catch (err) {
    console.error('[ClinicalCoaching] coachMe failed:', err.message);
    Sentry.captureException(err);
    return buildFallbackCard('the family', 'coach_me');
  }
}

// ── LOG COACHING CARD ─────────────────────────────────────────

async function logCoachingCard(sessionId, triggerType, memberId, card) {
  try {
    await pool.query(`
      INSERT INTO kitchen_table_coaching_logs (session_id, trigger_type, member_id, coaching_card)
      VALUES ($1, $2, $3, $4)
    `, [sessionId, triggerType, memberId, JSON.stringify(card)]);
  } catch (err) {
    console.error('[ClinicalCoaching] logCoachingCard failed:', err.message);
    Sentry.captureException(err);
  }
}

module.exports = { processBiometricTick, coachMe, classifyPattern, generateCoachingCard, TRIGGERS };
