// ============================================================
// breathProtocolAdapter.js — Arc × Track breath transformation
// Maps the Master Curriculum Map's 9 arcs × 3 tracks into
// adapted breath configs per user.
// ============================================================

const ARC_CONFIG = {
  body:                  { mode: 'simple_pacer', standard: { ratio: '4:6', duration: [180, 300] }, gentle: { ratio: '3:5', duration: [120, 240] }, minimal: { ratio: '3:4', duration: [90, 180] } },
  awareness:             { mode: 'simple_pacer', standard: { ratio: '4:7', duration: [300, 480] }, gentle: { ratio: '3:6', duration: [240, 360] }, minimal: { ratio: '3:5', duration: [180, 300] } },
  integration:           { mode: 'user_chosen',  standard: { ratio: 'user_chosen', duration: [480, 720] }, gentle: { ratio: 'user_chosen', duration: [360, 600] }, minimal: { ratio: 'user_chosen', duration: [300, 480] } },
  repatterning:          { mode: 'pendulation_loop', standard: { ratio: '4:6', hold: 0, duration: [780, 900] }, gentle: { ratio: '3:5', hold: 0, duration: [600, 780] }, minimal: { ratio: '3:4', hold: 0, duration: [480, 600] } },
  grief:                 { mode: 'somatic_release',  standard: { ratio: '4:8', touch: 10, return: 30, duration: [600, 900] }, gentle: { ratio: '3:6', touch: 8, return: 25, duration: [480, 720] }, minimal: { ratio: '3:5', touch: 6, return: 20, duration: [360, 600] } },
  emotional_granularity: { mode: 'pendulation_loop', standard: { ratio: '4:2:6', hold: 2, duration: [600, 900] }, gentle: { ratio: '3:2:5', hold: 2, duration: [480, 720] }, minimal: { ratio: '3:2:4', hold: 2, duration: [360, 600] } },
  deeper_grief:          { mode: 'somatic_release',  standard: { ratio: '4:8', touch: 20, return: 40, duration: [600, 900] }, gentle: { ratio: '3:6', touch: 15, return: 30, duration: [480, 720] }, minimal: { ratio: '3:5', touch: 10, return: 25, duration: [360, 600] } },
  family_systems:        { mode: 'user_chosen',  standard: { ratio: 'user_chosen', duration: [600, 900] }, gentle: { ratio: 'user_chosen', duration: [480, 720] }, minimal: { ratio: 'user_chosen', duration: [360, 600] } },
  first_spiral:          { mode: 'coherence',    standard: { ratio: '6:6', duration: [600, 1200] }, gentle: null, minimal: null } // LOCKED — gate at S120
};

const SESSION_ARC_MAP = {
  1: 'body', 2: 'body', 3: 'body', 4: 'body', 5: 'body',
  6: 'awareness', 7: 'awareness', 8: 'awareness', 9: 'awareness', 10: 'awareness',
  11: 'awareness', 12: 'awareness', 13: 'awareness', 14: 'awareness', 15: 'awareness',
  16: 'integration', 17: 'integration', 18: 'integration', 19: 'integration', 20: 'integration',
  21: 'integration', 22: 'integration', 23: 'integration', 24: 'integration', 25: 'integration',
  26: 'integration', 27: 'integration', 28: 'integration', 29: 'integration', 30: 'integration',
  // S31-S60: repatterning
  // S61-S70: grief
  // S71-S80: emotional_granularity
  // S81-S100: deeper_grief
  // S101-S120: family_systems
  // S121-S150: first_spiral
};

function resolveArc(sessionNumber) {
  if (SESSION_ARC_MAP[sessionNumber]) return SESSION_ARC_MAP[sessionNumber];
  if (sessionNumber >= 121) return 'first_spiral';
  if (sessionNumber >= 101) return 'family_systems';
  if (sessionNumber >= 81) return 'deeper_grief';
  if (sessionNumber >= 71) return 'emotional_granularity';
  if (sessionNumber >= 61) return 'grief';
  if (sessionNumber >= 31) return 'repatterning';
  if (sessionNumber >= 16) return 'integration';
  if (sessionNumber >= 6) return 'awareness';
  return 'body';
}

function adaptBreathProtocol(session, user) {
  const sessNum = session.session_number || 1;
  const track = user.breath_track || 'standard';
  const arc = resolveArc(sessNum);
  const arcConfig = ARC_CONFIG[arc];

  if (!arcConfig) {
    return { ...session, _arc: arc, _breathwork_mode: 'simple_pacer', ratio: '4:6', duration_seconds: 300 };
  }

  // Graduation bridge: CT grads get 3:5 for S01-S05
  if (user._graduation_bridge && sessNum <= 5) {
    return {
      ...session, _arc: arc, _breathwork_mode: 'simple_pacer',
      ratio: '3:5', duration_seconds: 240,
      _suppress_biometric_mirror: false, _suppress_coherence_display: false
    };
  }

  const trackConfig = arcConfig[track] || arcConfig.standard;
  if (!trackConfig) {
    // Spiral gate — non-standard users shouldn't be here
    return { ...session, _arc: arc, _breathwork_mode: 'simple_pacer', ratio: '4:6', duration_seconds: 600, _spiral_gate_held: true };
  }

  const duration = Array.isArray(trackConfig.duration)
    ? trackConfig.duration[0] + Math.floor(Math.random() * (trackConfig.duration[1] - trackConfig.duration[0]))
    : trackConfig.duration;

  // Check if YAML session has adaptive_ratio: true (corrected sessions)
  const yamlAdaptive = session.yaml_data?.adaptive_ratio === true
    || session.adaptive_ratio === true;

  const yamlRatioRange = session.yaml_data?.ratio_range || session.ratio_range || null;
  const yamlDurationRange = session.yaml_data?.duration_range || session.duration_range || null;

  return {
    ...session,
    _arc: arc,
    _breathwork_mode: arcConfig.mode,
    // If YAML says adaptive, defer ratio to determineBreathParams at arrival
    adaptive_ratio: yamlAdaptive,
    ratio: yamlAdaptive ? null : trackConfig.ratio,
    ratio_range: yamlAdaptive ? yamlRatioRange : null,
    duration_range: yamlAdaptive ? yamlDurationRange : null,
    duration_seconds: yamlAdaptive ? null : duration,
    _hold_seconds: trackConfig.hold || 0,
    _touch_seconds: trackConfig.touch || 0,
    _return_seconds: trackConfig.return || 0,
    _suppress_biometric_mirror: false,
    _suppress_coherence_display: arc === 'body'
  };
}

/**
 * FR breath protocol — ABI-adaptive.
 *
 * Corrected FR sessions use adaptive_ratio: true with ratio_range
 * and duration_range from YAML. ABI determines the actual ratio
 * at arrival via determineBreathParams(). This function sets up
 * the config with ranges; the orchestrator resolves the final
 * ratio after baseline capture.
 *
 * Clinical Rule #10: FR sessions MUST use adaptive ratios.
 * Never hardcode breathwork_ratio in FR sessions.
 */
function adaptFRBreathProtocol(session, user) {
  const sessNum = session.session_number || 1;
  const frBlock = Math.ceil(sessNum / 5);

  // FR ABI Progression Map (from corrected YAML spec)
  const FR_BLOCKS = {
    1: { ratio_range: '2:3 → 4:7', duration_range: '120-240', coherence_target: 0.40, abi_mode: 'guided_coherence', detection: 'arrival_baseline' },
    2: { ratio_range: '2:3 → 4:8', duration_range: '150-300', coherence_target: 0.50, abi_mode: 'guided_coherence', detection: 'arrival_baseline' },
    3: { ratio_range: '2:4 → 5:7', duration_range: '180-360', coherence_target: 0.55, abi_mode: 'coherence_building', detection: 'arrival_baseline' },
    4: { ratio_range: '3:4 → 6:8', duration_range: '240-420', coherence_target: 0.60, abi_mode: 'user_chosen', detection: 'baseline_plus_history' },
    5: { ratio_range: '3:4 → 6:10', duration_range: '300-480', coherence_target: 0.65, abi_mode: 'user_chosen', detection: 'baseline_plus_history' }
  };

  const block = FR_BLOCKS[Math.min(frBlock, 5)] || FR_BLOCKS[1];

  return {
    ...session,
    _breathwork_mode: 'simple_pacer',
    _is_fr: true,
    _fr_block: frBlock,
    // ABI-adaptive: ratio resolved at arrival by determineBreathParams
    adaptive_ratio: true,
    ratio: null,
    ratio_range: block.ratio_range,
    duration_range: block.duration_range,
    duration_seconds: null,
    _coherence_target: block.coherence_target,
    _abi_mode: block.abi_mode,
    _detection_mode: block.detection
  };
}

module.exports = { adaptBreathProtocol, adaptFRBreathProtocol, resolveArc };
