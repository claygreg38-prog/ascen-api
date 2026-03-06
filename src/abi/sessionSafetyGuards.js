const pool = require('../db/pool');

async function checkProvisionalTrack(userId, biometrics) {
  const { respiratory_rate } = biometrics;
  if (!respiratory_rate) return { track: 'standard', provisional: false };
  if (respiratory_rate > 22) return { track: 'minimal', provisional: true, reason: 'high_rr' };
  if (respiratory_rate > 16) return { track: 'gentle', provisional: true, reason: 'elevated_rr' };
  return { track: 'standard', provisional: false };
}

function applyGraduationBridge(user, session) {
  if (user.onboarding_source === 'capacity_track' && (session.session_number || 0) <= 5) return { apply: true, ratio: '3:5', reason: 'graduation_bridge' };
  return { apply: false };
}

function weightCoherenceForAdvancement(recentSessions, currentTrack) {
  if (!recentSessions || recentSessions.length < 5) return { ready: false, reason: 'insufficient_sessions' };
  const avgC = recentSessions.reduce((s, r) => s + (r.coherence_score || 0), 0) / recentSessions.length;
  const avgComp = recentSessions.reduce((s, r) => s + (r.cycle_completion_rate || 0), 0) / recentSessions.length;
  const t = { minimal: { coherence: 0.35, completion: 0.6 }, gentle: { coherence: 0.5, completion: 0.7 } }[currentTrack];
  if (!t) return { ready: false, reason: 'standard_track' };
  return { ready: avgC >= t.coherence && avgComp >= t.completion, avg_coherence: avgC, avg_completion: avgComp };
}

async function checkGapAndStepBack(userId) {
  if (!pool) return { gap_detected: false };
  try {
    const r = await pool.query(`SELECT completed_at FROM session_completions WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1`, [userId]);
    if (r.rows.length === 0) return { gap_detected: false };
    const days = (Date.now() - new Date(r.rows[0].completed_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days > 14) return { gap_detected: true, days: Math.round(days), luno_message: "It's been a while. Your body remembers the rhythm. Let's find it again together." };
    if (days > 7) return { gap_detected: true, days: Math.round(days), luno_message: "Welcome back. No need to rush. We'll start where your body wants to start." };
    return { gap_detected: false };
  } catch (err) { return { gap_detected: false }; }
}

function checkPanicSignals(biometrics, panicState) {
  const { heart_rate, respiratory_rate } = biometrics;
  if (heart_rate > 140 || respiratory_rate > 28) panicState.panic_seconds = (panicState.panic_seconds || 0) + 1;
  else panicState.panic_seconds = Math.max(0, (panicState.panic_seconds || 0) - 2);
  return { panic_detected: panicState.panic_seconds >= 10, panic_seconds: panicState.panic_seconds, action: panicState.panic_seconds >= 10 ? 'pause_and_ground' : 'continue' };
}

function getBiometricFallback(user) {
  if (!user.has_ble_device && !user.has_camera_consent) return { fallback_track: 'gentle', reason: 'no_biometric_source' };
  return { fallback_track: null };
}

function checkSpiralGate(user, sessionNumber) {
  if (sessionNumber > 120 && user.breath_track !== 'standard') return { gate_held: true, reason: 'spiral_gate', luno_message: 'Your body is still building capacity. These sessions will deepen where you are.', redirect_to: 101 };
  return { gate_held: false };
}

module.exports = { checkProvisionalTrack, applyGraduationBridge, weightCoherenceForAdvancement, checkGapAndStepBack, checkPanicSignals, getBiometricFallback, checkSpiralGate };
