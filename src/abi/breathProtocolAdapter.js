// ============================================================
// breathProtocolAdapter.js — Arc × Track breath transformation
// Maps the Master Curriculum Map's 9 arcs × 3 tracks into
// adapted breath configs per user.
//
// Every arc × track now returns abi_config.adaptive_ratio: true
// with ratio_range arrays and duration_range. The ratio field
// is a reference ratio (design intent), not what gets served.
// determineBreathParams resolves the actual ratio at arrival.
//
// First Spiral (S121-S150) stays LOCKED at 6:6.
// ============================================================

const ARC_CONFIG = {
  body: {
    mode: 'simple_pacer',
    standard: {
      reference_ratio: '4:6',
      ratio_range: ['3:4', '3:5', '4:6', '4:7'],
      duration_range: { min_sec: 180, max_sec: 300 },
      detection_mode: 'arrival_baseline'
    },
    gentle: {
      reference_ratio: '3:5',
      ratio_range: ['2:3', '2:4', '3:4', '3:5', '4:6'],
      duration_range: { min_sec: 120, max_sec: 240 },
      detection_mode: 'arrival_baseline'
    },
    minimal: {
      reference_ratio: '3:4',
      ratio_range: ['2:3', '2:4', '3:4', '3:5'],
      duration_range: { min_sec: 90, max_sec: 180 },
      detection_mode: 'arrival_baseline'
    }
  },

  awareness: {
    mode: 'simple_pacer',
    standard: {
      reference_ratio: '4:7',
      ratio_range: ['3:5', '4:6', '4:7', '4:8'],
      duration_range: { min_sec: 300, max_sec: 480 },
      detection_mode: 'arrival_baseline'
    },
    gentle: {
      reference_ratio: '3:6',
      ratio_range: ['2:4', '3:4', '3:5', '3:6', '4:6'],
      duration_range: { min_sec: 240, max_sec: 360 },
      detection_mode: 'arrival_baseline'
    },
    minimal: {
      reference_ratio: '3:5',
      ratio_range: ['2:3', '2:4', '3:4', '3:5'],
      duration_range: { min_sec: 180, max_sec: 300 },
      detection_mode: 'arrival_baseline'
    }
  },

  integration: {
    mode: 'user_chosen',
    standard: {
      reference_ratio: '4:6',
      ratio_range: ['3:5', '4:6', '4:7', '4:8', '5:7'],
      duration_range: { min_sec: 480, max_sec: 720 },
      detection_mode: 'arrival_baseline_plus_history'
    },
    gentle: {
      reference_ratio: '3:5',
      ratio_range: ['2:4', '3:4', '3:5', '4:6'],
      duration_range: { min_sec: 360, max_sec: 600 },
      detection_mode: 'arrival_baseline'
    },
    minimal: {
      reference_ratio: '3:4',
      ratio_range: ['2:3', '2:4', '3:4', '3:5'],
      duration_range: { min_sec: 300, max_sec: 480 },
      detection_mode: 'arrival_baseline'
    }
  },

  repatterning: {
    mode: 'pendulation_loop',
    standard: {
      reference_ratio: '4:6',
      ratio_range: ['3:5', '4:6', '4:7', '4:8'],
      duration_range: { min_sec: 780, max_sec: 900 },
      hold: 0,
      detection_mode: 'arrival_baseline_plus_history'
    },
    gentle: {
      reference_ratio: '3:5',
      ratio_range: ['2:4', '3:4', '3:5', '4:6'],
      duration_range: { min_sec: 600, max_sec: 780 },
      hold: 0,
      detection_mode: 'arrival_baseline'
    },
    minimal: {
      reference_ratio: '3:4',
      ratio_range: ['2:3', '2:4', '3:4'],
      duration_range: { min_sec: 480, max_sec: 600 },
      hold: 0,
      detection_mode: 'arrival_baseline'
    }
  },

  grief: {
    mode: 'somatic_release',
    standard: {
      reference_ratio: '4:8',
      ratio_range: ['3:5', '3:6', '4:6', '4:7', '4:8'],
      duration_range: { min_sec: 600, max_sec: 900 },
      touch: 10, return: 30,
      detection_mode: 'arrival_baseline_plus_history'
    },
    gentle: {
      reference_ratio: '3:6',
      ratio_range: ['2:4', '3:4', '3:5', '3:6'],
      duration_range: { min_sec: 480, max_sec: 720 },
      touch: 8, return: 25,
      detection_mode: 'arrival_baseline'
    },
    minimal: {
      reference_ratio: '3:5',
      ratio_range: ['2:3', '2:4', '3:4', '3:5'],
      duration_range: { min_sec: 360, max_sec: 600 },
      touch: 6, return: 20,
      detection_mode: 'arrival_baseline'
    }
  },

  emotional_granularity: {
    mode: 'pendulation_loop',
    standard: {
      reference_ratio: '4:6',
      ratio_range: ['3:5', '4:6', '4:7', '4:8'],
      duration_range: { min_sec: 600, max_sec: 900 },
      hold: 2,
      detection_mode: 'arrival_baseline_plus_history'
    },
    gentle: {
      reference_ratio: '3:5',
      ratio_range: ['2:4', '3:4', '3:5', '3:6'],
      duration_range: { min_sec: 480, max_sec: 720 },
      hold: 2,
      detection_mode: 'arrival_baseline'
    },
    minimal: {
      reference_ratio: '3:4',
      ratio_range: ['2:3', '2:4', '3:4'],
      duration_range: { min_sec: 360, max_sec: 600 },
      hold: 2,
      detection_mode: 'arrival_baseline'
    }
  },

  deeper_grief: {
    mode: 'somatic_release',
    standard: {
      reference_ratio: '4:8',
      ratio_range: ['3:6', '4:6', '4:7', '4:8', '5:7'],
      duration_range: { min_sec: 600, max_sec: 900 },
      touch: 20, return: 40,
      detection_mode: 'arrival_baseline_plus_history'
    },
    gentle: {
      reference_ratio: '3:6',
      ratio_range: ['2:4', '3:4', '3:5', '3:6'],
      duration_range: { min_sec: 480, max_sec: 720 },
      touch: 15, return: 30,
      detection_mode: 'arrival_baseline'
    },
    minimal: {
      reference_ratio: '3:5',
      ratio_range: ['2:3', '2:4', '3:4', '3:5'],
      duration_range: { min_sec: 360, max_sec: 600 },
      touch: 10, return: 25,
      detection_mode: 'arrival_baseline'
    }
  },

  family_systems: {
    mode: 'user_chosen',
    standard: {
      reference_ratio: '4:6',
      ratio_range: ['3:5', '4:6', '4:7', '4:8', '5:7', '5:8'],
      duration_range: { min_sec: 600, max_sec: 900 },
      detection_mode: 'arrival_baseline_plus_history'
    },
    gentle: {
      reference_ratio: '3:5',
      ratio_range: ['2:4', '3:4', '3:5', '4:6'],
      duration_range: { min_sec: 480, max_sec: 720 },
      detection_mode: 'arrival_baseline'
    },
    minimal: {
      reference_ratio: '3:4',
      ratio_range: ['2:3', '2:4', '3:4', '3:5'],
      duration_range: { min_sec: 360, max_sec: 600 },
      detection_mode: 'arrival_baseline'
    }
  },

  // LOCKED — 6:6 ratio. Non-negotiable. Gate at S120.
  first_spiral: {
    mode: 'coherence',
    standard: {
      reference_ratio: '6:6',
      ratio_range: null,
      duration_range: { min_sec: 600, max_sec: 1200 },
      detection_mode: null,
      locked_ratio: '6:6'
    },
    gentle: null,
    minimal: null
  }
};

const SESSION_ARC_MAP = {
  1: 'body', 2: 'body', 3: 'body', 4: 'body', 5: 'body',
  6: 'awareness', 7: 'awareness', 8: 'awareness', 9: 'awareness', 10: 'awareness',
  11: 'awareness', 12: 'awareness', 13: 'awareness', 14: 'awareness', 15: 'awareness',
  16: 'integration', 17: 'integration', 18: 'integration', 19: 'integration', 20: 'integration',
  21: 'integration', 22: 'integration', 23: 'integration', 24: 'integration', 25: 'integration',
  26: 'integration', 27: 'integration', 28: 'integration', 29: 'integration', 30: 'integration'
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
    return {
      ...session, _arc: arc, _breathwork_mode: 'simple_pacer',
      adaptive_ratio: true,
      ratio: null,
      ratio_range: ['3:4', '3:5', '4:6'],
      duration_range: { min_sec: 180, max_sec: 300 },
      duration_seconds: null,
      detection_mode: 'arrival_baseline',
      abi_config: { adaptive_ratio: true }
    };
  }

  // Graduation bridge: CT grads get 3:5 for S01-S05
  if (user._graduation_bridge && sessNum <= 5) {
    return {
      ...session, _arc: arc, _breathwork_mode: 'simple_pacer',
      adaptive_ratio: true,
      ratio: null,
      ratio_range: ['2:4', '3:4', '3:5', '4:6'],
      duration_range: { min_sec: 180, max_sec: 240 },
      duration_seconds: null,
      detection_mode: 'arrival_baseline',
      _suppress_biometric_mirror: false, _suppress_coherence_display: false,
      abi_config: { adaptive_ratio: true, reference_ratio: '3:5' }
    };
  }

  const trackConfig = arcConfig[track] || arcConfig.standard;
  if (!trackConfig) {
    // Spiral gate — non-standard users shouldn't be here
    return {
      ...session, _arc: arc, _breathwork_mode: 'simple_pacer',
      ratio: '4:6', duration_seconds: 600, _spiral_gate_held: true,
      adaptive_ratio: false,
      abi_config: { adaptive_ratio: false }
    };
  }

  // First Spiral: LOCKED ratio, no adaptive
  if (trackConfig.locked_ratio) {
    const dur = trackConfig.duration_range;
    const duration = dur.min_sec + Math.floor(Math.random() * (dur.max_sec - dur.min_sec));
    return {
      ...session,
      _arc: arc,
      _breathwork_mode: arcConfig.mode,
      adaptive_ratio: false,
      ratio: trackConfig.locked_ratio,
      ratio_range: null,
      duration_range: trackConfig.duration_range,
      duration_seconds: duration,
      detection_mode: null,
      _hold_seconds: trackConfig.hold || 0,
      _touch_seconds: trackConfig.touch || 0,
      _return_seconds: trackConfig.return || 0,
      _suppress_biometric_mirror: false,
      _suppress_coherence_display: false,
      abi_config: { adaptive_ratio: false, locked_ratio: trackConfig.locked_ratio }
    };
  }

  // Check if YAML session has its own abi_config (overrides arc config)
  const yamlAbiConfig = session.yaml_data?.abi_config || null;
  const ratioRange = yamlAbiConfig?.ratio_range || trackConfig.ratio_range;
  const durationRange = yamlAbiConfig?.duration_range || trackConfig.duration_range;
  const detectionMode = yamlAbiConfig?.detection_mode || trackConfig.detection_mode || 'arrival_baseline';

  return {
    ...session,
    _arc: arc,
    _breathwork_mode: arcConfig.mode,
    adaptive_ratio: true,
    ratio: null,
    ratio_range: ratioRange,
    duration_range: durationRange,
    duration_seconds: null,
    detection_mode: detectionMode,
    _hold_seconds: trackConfig.hold || 0,
    _touch_seconds: trackConfig.touch || 0,
    _return_seconds: trackConfig.return || 0,
    _suppress_biometric_mirror: false,
    _suppress_coherence_display: arc === 'body',
    abi_config: {
      adaptive_ratio: true,
      reference_ratio: trackConfig.reference_ratio,
      ratio_range: ratioRange,
      duration_range: durationRange,
      detection_mode: detectionMode
    }
  };
}

/**
 * FR breath protocol — ABI-adaptive.
 *
 * Corrected FR sessions use adaptive_ratio: true with ratio_range
 * and duration_range from YAML. ABI determines the actual ratio
 * at arrival via determineBreathParams().
 */
function adaptFRBreathProtocol(session, user) {
  const sessNum = session.session_number || 1;
  const frBlock = Math.ceil(sessNum / 5);

  const FR_BLOCKS = {
    1: { ratio_range: ['2:3', '2:4', '3:4', '3:5', '4:6', '4:7'], duration_range: { min_sec: 120, max_sec: 240 }, coherence_target: 0.40, abi_mode: 'guided_coherence', detection: 'arrival_baseline' },
    2: { ratio_range: ['2:3', '2:4', '3:4', '3:5', '4:6', '4:7', '4:8'], duration_range: { min_sec: 150, max_sec: 300 }, coherence_target: 0.50, abi_mode: 'guided_coherence', detection: 'arrival_baseline' },
    3: { ratio_range: ['2:4', '3:4', '3:5', '3:6', '4:6', '4:7', '5:7'], duration_range: { min_sec: 180, max_sec: 360 }, coherence_target: 0.55, abi_mode: 'coherence_building', detection: 'arrival_baseline' },
    4: { ratio_range: ['3:4', '3:5', '3:6', '4:6', '4:7', '4:8', '6:8'], duration_range: { min_sec: 240, max_sec: 420 }, coherence_target: 0.60, abi_mode: 'user_chosen', detection: 'arrival_baseline_plus_history' },
    5: { ratio_range: ['3:4', '3:5', '3:6', '4:6', '4:7', '4:8', '5:7', '6:8', '6:10'], duration_range: { min_sec: 300, max_sec: 480 }, coherence_target: 0.65, abi_mode: 'user_chosen', detection: 'arrival_baseline_plus_history' }
  };

  const block = FR_BLOCKS[Math.min(frBlock, 5)] || FR_BLOCKS[1];

  // Check if YAML has its own abi_config
  const yamlAbiConfig = session.yaml_data?.abi_config || null;
  const ratioRange = yamlAbiConfig?.ratio_range || block.ratio_range;
  const durationRange = yamlAbiConfig?.duration_range || block.duration_range;
  const detectionMode = yamlAbiConfig?.detection_mode || block.detection;

  return {
    ...session,
    _breathwork_mode: 'simple_pacer',
    _is_fr: true,
    _fr_block: frBlock,
    _arc: 'fr_block_' + frBlock,
    adaptive_ratio: true,
    ratio: null,
    ratio_range: ratioRange,
    duration_range: durationRange,
    duration_seconds: null,
    detection_mode: detectionMode,
    _coherence_target: block.coherence_target,
    _abi_mode: block.abi_mode,
    _detection_mode: detectionMode,
    abi_config: {
      adaptive_ratio: true,
      ratio_range: ratioRange,
      duration_range: durationRange,
      detection_mode: detectionMode
    }
  };
}

module.exports = { adaptBreathProtocol, adaptFRBreathProtocol, resolveArc };
