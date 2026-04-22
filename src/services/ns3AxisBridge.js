/**
 * NS3 → AXIS Integration Bridge
 * ASCEN BreathWorx | Mettle Works Behavioral Health
 *
 * Wires ns3Engine.js into the AXIS brain stem during a live
 * breath session. Called from sessionOrchestrator tick handler.
 */

'use strict';

const {
  computeNS3,
  NS3SessionAggregator,
} = require('./ns3Engine');


// ─────────────────────────────────────────────
// LIVE SESSION BIOMETRIC LOOP
// Called on every breathing-phase tick (~1 Hz). Aggregated in-memory
// across 5-tick windows; persisted to ns3_snapshots every 5 seconds.
// ─────────────────────────────────────────────

async function onBiometricWindowReceived(axisContext) {
  const {
    participantId,
    sessionId,
    rrBuffer,          // Last 30s of RR intervals from Polar H10 / Kyto
    spO2,              // From Kyto2935 finger clip — null if device doesn't measure
    hrHistory,         // HR readings accumulated this session
    sdnnHistory,       // SDNN readings accumulated this session
    deviceType,        // 'polar_h10' | 'kyto2935' | 'apple_watch'
    currentTrack,      // 'standard' | 'gentle' | 'minimal'
    belowWindowDuration,
    sessionMinute,
    aggregator,        // NS3SessionAggregator instance for this session
    arrivalComplete = true,
    breathMatchActive = false,
  } = axisContext;

  // ── 1. Compute NS3 ──
  const ns3Result = computeNS3(
    {
      rrIntervals: rrBuffer,
      spO2: spO2 || null,
      hrHistory,
      sdnnHistory,
      deviceType,
    },
    {
      currentTrack,
      belowWindowDuration,
      sessionMinute,
      participantId,
      sessionId,
      arrivalComplete,
      breathMatchActive,
    }
  );

  // ── 2. Feed into session aggregator ──
  aggregator.addReading(ns3Result);

  // ── 3. Route directives to AXIS subsystems ──
  await Promise.all([
    routeToBreathMatch(ns3Result.directives.breathMatch, sessionId),
    routeToLuno(ns3Result.directives.luno, sessionId),
    routeToTrackSelector(ns3Result.directives.trackSelector, sessionId),
    routeToLightBridge(ns3Result.directives.lightBridge, participantId),
    handleSafetyFlag(ns3Result.directives.safetyFlag, sessionId),
  ]);

  // ── 4. Log to AXIS vault (structured metadata only — no free text) ──
  await axisVaultLog({
    sessionId,
    participantId,
    ns3Score: ns3Result.ns3Score,
    zone: ns3Result.zone,
    dataQuality: ns3Result.dataQuality,
    timestamp: ns3Result.timestamp,
  });

  return ns3Result;
}


// ─────────────────────────────────────────────
// SESSION COMPLETION
// Called when participant ends session
// ─────────────────────────────────────────────

async function onSessionComplete(aggregator, sessionContext) {
  const summary = aggregator.summarize();
  if (!summary) return null;

  // Route to blockchain verification
  if (summary.clinical.reachedOptimal) {
    await submitBlockchainVerification({
      sessionId: sessionContext.sessionId,
      participantId: sessionContext.participantId,
      payload: summary.verificationPayload,
    });
  }

  // Route to CHOS for clinical documentation
  await submitToCHOS({
    sessionId: sessionContext.sessionId,
    regulatoryFingerprint: {
      meanNS3:         summary.ns3.mean,
      peakNS3:         summary.ns3.peak,
      optimalZonePct:  summary.zoneDuration.optimalPct,
      trajectory:      summary.clinical.regulatoryTrajectory,
      sustainedOptimal: summary.clinical.sustainedOptimal,
    },
  });

  // Victory Lap trigger — anchor the physiological high-point
  if (summary.clinical.sustainedOptimal) {
    await triggerVictoryLap({
      sessionId: sessionContext.sessionId,
      peakNS3: summary.ns3.peak,
      optimalDurationMs: summary.zoneDuration.optimalMs,
    });
  }

  return summary;
}


// ─────────────────────────────────────────────
// ROUTE HANDLERS — AXIS subsystem integration
// ─────────────────────────────────────────────

async function routeToBreathMatch(directive, sessionId) {
  if (!directive) return;
  console.log(`[NS3→BreathMatch] Session ${sessionId}:`, directive);
}

async function routeToLuno(directive, sessionId) {
  if (!directive) return;
  console.log(`[NS3→Luno] Session ${sessionId}:`, directive.tone, '|', directive.directive);
}

async function routeToTrackSelector(directive, sessionId) {
  if (!directive || directive.action === 'hold') return;
  console.log(`[NS3→TrackSelector] Session ${sessionId}: ${directive.from} → ${directive.to} (silent)`);
}

async function routeToLightBridge(directive, participantId) {
  if (!directive || directive.trigger === 'off') return;
  console.log(`[NS3→LightBridge] Participant ${participantId}:`, directive.trigger, directive.intensity);
}

async function handleSafetyFlag(flag, sessionId) {
  if (!flag) return;
  console.warn(`[NS3→Safety] Session ${sessionId}: ${flag.type} | SpO2: ${flag.value}%`);
}

async function axisVaultLog(entry) {
  // Structured metadata only — never logs free text or raw biometric values
  console.log('[NS3→AXIS Vault]', entry.sessionId, 'NS3:', entry.ns3Score, 'Zone:', entry.zone);
}

async function submitBlockchainVerification(data) {
  console.log('[NS3→Blockchain] Verification payload queued:', data.sessionId);
}

async function submitToCHOS(data) {
  console.log('[NS3→CHOS] Clinical documentation submitted:', data.sessionId);
}

async function triggerVictoryLap(data) {
  console.log('[NS3→VictoryLap] Triggered for session:', data.sessionId, '| Peak NS3:', data.peakNS3);
}


// ─────────────────────────────────────────────
// SESSION INITIALIZATION HELPER
// ─────────────────────────────────────────────

function initializeNS3Session(participantId, sessionId) {
  return {
    aggregator: new NS3SessionAggregator(participantId, sessionId),
    hrHistory: [],
    sdnnHistory: [],
    belowWindowDuration: 0,
    sessionMinute: 0,
  };
}


module.exports = {
  onBiometricWindowReceived,
  onSessionComplete,
  initializeNS3Session,
};
