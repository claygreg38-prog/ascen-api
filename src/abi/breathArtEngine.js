// ============================================================
// [ABI] Breath Art Engine — Deterministic Sacred Geometry Generator
// File: src/abi/breathArtEngine.js
//
// Generates deterministic SVG art from NS3 session data + packetHash.
// Clinical signals ALWAYS override seed values.
// Same inputs → identical output. No Math.random(), no Date.now().
//
// Exports: generate(summary, packetHash, options)
//          decode(tokenId, clinicalKey)
// ============================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── COLOR PALETTES BY NS3 ZONE ────────────────────────────────
const PALETTES = {
  optimal:    ['#1a7a6d', '#2dd4a8', '#3eebc2', '#5ffce0', '#aafce8'],
  approaching: ['#c8943e', '#daa84e', '#e8a84a', '#f0b860', '#fad49a'],
  below_window: ['#d45030', '#e86040', '#f07050', '#f09080', '#f0b0a0'],
  regulated:  ['#1a2848', '#304878', '#4068b0', '#5090c0', '#80b8e0'],
  warrior:    ['#060d18', '#2040a0', '#c8943e', '#506090', '#8090a0'],
  fr_session: ['#c8943e', '#daa84e', '#e8a84a', '#f0b860', '#fad49a'],
};

const BACKGROUND = '#061a2a';

// ── SEEDED PRNG ───────────────────────────────────────────────
// Deterministic pseudo-random using seed. No Math.random().
function seededRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

// ── CLINICAL SIGNAL MAPPING ───────────────────────────────────

function resolveNS3Zone(summary) {
  const mean = summary?.ns3?.mean ?? 50;
  if (mean >= 56) return 'optimal';
  if (mean >= 36) return 'approaching';
  if (mean <= 35) return 'below_window';
  return 'regulated';
}

function resolvePalette(zone, options = {}) {
  if (options.court_day_flag) return PALETTES.warrior;
  if (options.is_fr_session) return PALETTES.fr_session;
  return PALETTES[zone] || PALETTES.optimal;
}

function resolveSaturation(ns3Peak) {
  if (ns3Peak >= 71) return 1.0;   // full vivid
  if (ns3Peak >= 41) return 0.7;   // mid
  return 0.4;                       // muted
}

function resolveShapeComplexity(track) {
  const t = (track || 'standard').toLowerCase();
  if (t === 'advanced') return 'complex';
  if (t === 'minimal') return 'simple';
  return 'layered';
}

function resolveSymmetryFactor(coherencePeak) {
  // >0.7 = near-perfect radial. Low = asymmetric organic
  return coherencePeak > 0.7 ? 0.95 : Math.max(0.3, coherencePeak);
}

function resolveLineSmoothness(trajectory) {
  if (trajectory === 'improving') return 'smooth';
  if (trajectory === 'declining') return 'jagged';
  return 'consistent';
}

function resolveCenterBrightness(ns3Peak, sustainedOptimal) {
  const base = Math.min(1.0, ns3Peak / 100);
  return { brightness: base, pulsing: sustainedOptimal === true };
}

function resolvePatternDensity(sessionCount) {
  if (sessionCount >= 76) return 'complex';
  if (sessionCount >= 31) return 'layered';
  return 'sparse';
}

function resolveArcRings(timeToRegulationSec) {
  if (timeToRegulationSec === null || timeToRegulationSec === undefined) return { count: 0, spacing: 0 };
  if (timeToRegulationSec < 180) return { count: 5, spacing: 12 };  // tight
  if (timeToRegulationSec < 360) return { count: 4, spacing: 20 };
  return { count: 3, spacing: 30 };  // wide
}

function resolveEdgeTreatment(somaticResetUsed) {
  return somaticResetUsed ? 'sharp' : 'soft';
}

function resolveParticleOrder(breathAccuracy) {
  // High accuracy = ordered constellation. Low = scattered
  return Math.max(0, Math.min(1, (breathAccuracy || 0) / 100));
}

// ── SVG GENERATION ────────────────────────────────────────────

function applySaturation(hexColor, saturation) {
  // Parse hex and lerp toward grey based on saturation
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const grey = Math.round((r + g + b) / 3);
  const nr = Math.round(grey + (r - grey) * saturation);
  const ng = Math.round(grey + (g - grey) * saturation);
  const nb = Math.round(grey + (b - grey) * saturation);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function generateParticleField(rng, count, order, palette, saturation) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = order > 0.7
      ? (i / count) * Math.PI * 2   // ordered constellation
      : rng() * Math.PI * 2;         // scattered
    const baseRadius = 150 + rng() * 180;
    const radius = order > 0.7
      ? baseRadius
      : baseRadius + (rng() - 0.5) * 100 * (1 - order);
    const x = 400 + Math.cos(angle) * radius;
    const y = 400 + Math.sin(angle) * radius;
    const r = 1.5 + rng() * 1.0;  // 1.5–2.5px
    const color = applySaturation(palette[Math.floor(rng() * palette.length)], saturation);
    particles.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.8"/>`);
  }
  return particles.join('\n  ');
}

function generateSymmetryForms(rng, complexity, symmetryFactor, palette, saturation) {
  const forms = [];
  const numArms = symmetryFactor > 0.8 ? 8 : (symmetryFactor > 0.5 ? 6 : 4);
  const numLayers = complexity === 'complex' ? 5 : (complexity === 'layered' ? 3 : 2);

  for (let layer = 0; layer < numLayers; layer++) {
    const layerRadius = 60 + layer * 45;
    const color = applySaturation(palette[layer % palette.length], saturation);
    const opacity = 0.85 + layer * 0.03;

    for (let arm = 0; arm < numArms; arm++) {
      const baseAngle = (arm / numArms) * Math.PI * 2;
      // Symmetry: high = precise angles, low = offset
      const jitter = (1 - symmetryFactor) * (rng() - 0.5) * 0.3;
      const angle = baseAngle + jitter;

      if (complexity === 'simple') {
        // Simple circles
        const x = 400 + Math.cos(angle) * layerRadius;
        const y = 400 + Math.sin(angle) * layerRadius;
        forms.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(8 + layer * 4).toFixed(1)}" stroke="${color}" fill="none" stroke-width="1.2" opacity="${opacity.toFixed(2)}"/>`);
      } else {
        // Bezier curves for layered/complex
        const x1 = 400 + Math.cos(angle) * (layerRadius * 0.4);
        const y1 = 400 + Math.sin(angle) * (layerRadius * 0.4);
        const cpAngle = angle + (rng() - 0.5) * 0.5 * symmetryFactor;
        const cpR = layerRadius * (0.6 + rng() * 0.3);
        const cx1 = 400 + Math.cos(cpAngle) * cpR;
        const cy1 = 400 + Math.sin(cpAngle) * cpR;
        const x2 = 400 + Math.cos(angle) * layerRadius;
        const y2 = 400 + Math.sin(angle) * layerRadius;
        forms.push(`<path d="M${x1.toFixed(2)},${y1.toFixed(2)} Q${cx1.toFixed(2)},${cy1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}" stroke="${color}" fill="none" stroke-width="1.1" opacity="${opacity.toFixed(2)}"/>`);
      }
    }
  }
  return forms.join('\n  ');
}

function generateArcRings(arcConfig, palette, saturation, smoothness) {
  if (!arcConfig.count) return '';
  const rings = [];
  const dashArray = smoothness === 'jagged' ? '4,3' : (smoothness === 'consistent' ? '8,2' : 'none');
  for (let i = 0; i < arcConfig.count; i++) {
    const r = 100 + i * arcConfig.spacing;
    const color = applySaturation(palette[i % palette.length], saturation);
    const da = dashArray === 'none' ? '' : ` stroke-dasharray="${dashArray}"`;
    rings.push(`<circle cx="400" cy="400" r="${r}" stroke="${color}" fill="none" stroke-width="0.8" opacity="0.7"${da}/>`);
  }
  return rings.join('\n  ');
}

function generateCenterOrb(brightness, palette, saturation) {
  const orb = [];
  const outerColor = applySaturation(palette[0] || '#1a7a6d', saturation);
  const midColor = applySaturation(palette[2] || '#3eebc2', saturation);
  const innerColor = applySaturation(palette[4] || '#aafce8', saturation);
  const outerOpacity = 0.3 + brightness * 0.4;
  const midOpacity = 0.4 + brightness * 0.4;
  const innerOpacity = 0.6 + brightness * 0.4;
  orb.push(`<circle cx="400" cy="400" r="35" fill="${outerColor}" opacity="${outerOpacity.toFixed(2)}"/>`);
  orb.push(`<circle cx="400" cy="400" r="22" fill="${midColor}" opacity="${midOpacity.toFixed(2)}"/>`);
  orb.push(`<circle cx="400" cy="400" r="10" fill="${innerColor}" opacity="${innerOpacity.toFixed(2)}"/>`);
  return orb.join('\n  ');
}

function generateGoldenSpiral(rng, palette, saturation) {
  // Golden spiral at center for sustained_optimal
  const points = [];
  const goldenAngle = 2.39996; // radians
  for (let i = 0; i < 80; i++) {
    const angle = i * goldenAngle;
    const r = 2 + i * 1.8;
    const x = 400 + Math.cos(angle) * r;
    const y = 400 + Math.sin(angle) * r;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const color = applySaturation(palette[3] || '#f0b860', saturation);
  return `<polyline points="${points.join(' ')}" stroke="${color}" fill="none" stroke-width="1.2" opacity="0.85"/>`;
}

function generateMilestoneHalos(tier, palette, saturation) {
  if (!tier) return '';
  const halos = [];
  for (let i = 0; i < tier; i++) {
    const r = 250 + i * 25;
    const color = applySaturation(palette[i % palette.length], saturation);
    halos.push(`<circle cx="400" cy="400" r="${r}" stroke="${color}" fill="none" stroke-width="1.5" opacity="${(0.5 - i * 0.1).toFixed(2)}" stroke-dasharray="12,4"/>`);
  }
  return halos.join('\n  ');
}

function generateSecondaryOrb(rng, palette, saturation) {
  // Family unit secondary orb
  const x = 400 + (rng() - 0.5) * 120;
  const y = 400 + (rng() - 0.5) * 120;
  const color = applySaturation(palette[2] || '#3eebc2', saturation);
  return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="18" fill="${color}" opacity="0.3"/>
  <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="10" fill="${color}" opacity="0.5"/>`;
}

function generateLightbridgeThread(rng, palette, saturation) {
  const color = applySaturation(palette[3] || '#5ffce0', saturation);
  const y1 = 300 + rng() * 50;
  const y2 = 450 + rng() * 50;
  return `<line x1="200" y1="${y1.toFixed(0)}" x2="600" y2="${y2.toFixed(0)}" stroke="${color}" stroke-width="1.5" opacity="0.6" stroke-dasharray="6,3"/>`;
}

function generateDropoutReturn(rng, palette, saturation) {
  // Interrupted ring with continuation
  const color = applySaturation(palette[1] || '#2dd4a8', saturation);
  return `<path d="M400,200 A200,200 0 1,1 350,598" stroke="${color}" fill="none" stroke-width="1.8" opacity="0.6" stroke-dasharray="15,8"/>
  <path d="M350,598 A200,200 0 0,1 400,200" stroke="${color}" fill="none" stroke-width="1.2" opacity="0.8"/>`;
}

function generatePanicRecovery(rng, palette, saturation) {
  // Turbulence-to-calm pattern
  const segments = [];
  const color1 = applySaturation(palette[0] || '#d45030', saturation);
  const color2 = applySaturation(palette[4] || '#aafce8', saturation);
  // Turbulent section (left)
  for (let i = 0; i < 8; i++) {
    const x = 150 + i * 30;
    const y = 400 + (rng() - 0.5) * 100;
    const r = 5 + rng() * 10;
    segments.push(`<circle cx="${x}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" stroke="${color1}" fill="none" stroke-width="0.8" opacity="0.5"/>`);
  }
  // Calm section (right)
  for (let i = 0; i < 8; i++) {
    const x = 410 + i * 30;
    const r = 15 + i * 3;
    segments.push(`<circle cx="${x}" cy="400" r="${r}" stroke="${color2}" fill="none" stroke-width="0.6" opacity="${(0.3 + i * 0.05).toFixed(2)}"/>`);
  }
  return segments.join('\n  ');
}

function generateEdgeFlourishes(rng, treatment, palette, saturation) {
  const flourishes = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 330 + rng() * 40;
    const x = 400 + Math.cos(angle) * r;
    const y = 400 + Math.sin(angle) * r;
    const color = applySaturation(palette[i % palette.length], saturation);

    if (treatment === 'sharp') {
      // Sharp angular edges
      const x2 = x + (rng() - 0.5) * 30;
      const y2 = y + (rng() - 0.5) * 30;
      flourishes.push(`<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="1.2" opacity="0.5"/>`);
    } else {
      // Soft curved edges
      const cpx = x + (rng() - 0.5) * 40;
      const cpy = y + (rng() - 0.5) * 40;
      const ex = x + (rng() - 0.5) * 20;
      const ey = y + (rng() - 0.5) * 20;
      flourishes.push(`<path d="M${x.toFixed(2)},${y.toFixed(2)} Q${cpx.toFixed(2)},${cpy.toFixed(2)} ${ex.toFixed(2)},${ey.toFixed(2)}" stroke="${color}" fill="none" stroke-width="1.0" opacity="0.4"/>`);
    }
  }
  return flourishes.join('\n  ');
}

function getBackgroundTint(zone) {
  const tints = {
    optimal: 'rgba(26,122,109,0.08)',
    approaching: 'rgba(200,148,62,0.06)',
    below_window: 'rgba(212,80,48,0.05)',
    regulated: 'rgba(26,40,72,0.1)',
  };
  return tints[zone] || tints.optimal;
}

// ── MAIN GENERATE ─────────────────────────────────────────────

/**
 * Generate deterministic breath art from session data.
 *
 * @param {Object} summary - NS3SessionAggregator.summarize() output
 * @param {string} packetHash - SHA-256 hex string (64 chars) from buildSessionDataPacket
 * @param {Object} options - Additional context flags
 * @param {boolean} options.family_unit_active - Secondary orb
 * @param {boolean} options.lightbridge_active - Luminous thread
 * @param {boolean} options.court_day_flag - Warrior palette
 * @param {boolean} options.is_dropout_return - Interrupted ring
 * @param {number}  options.milestone_session - 10/30/50 tier
 * @param {boolean} options.is_fr_session - FR warm palette
 * @param {boolean} options.panic_recovery - Turbulence-to-calm
 * @param {number}  options.session_count - Total sessions completed
 * @param {string}  options.track - breath track
 * @param {number}  options.time_to_regulation_sec - Time to regulation
 * @param {number}  options.breath_accuracy - 0–100
 * @returns {{ svgString: string, metadataJSON: Object }}
 */
function generate(summary, packetHash, options = {}) {
  if (!packetHash || packetHash.length < 32) {
    throw new Error('packetHash must be at least 32 hex characters');
  }

  // ── 1. Segment packetHash for seeding ──
  const seedColor    = parseInt(packetHash.slice(0, 8), 16);
  const seedShape    = parseInt(packetHash.slice(8, 16), 16);
  const seedSymmetry = parseInt(packetHash.slice(16, 24), 16);
  const seedDensity  = parseInt(packetHash.slice(24, 32), 16);

  // Combined seed for general randomness
  const masterSeed = (seedColor ^ seedShape ^ seedSymmetry ^ seedDensity) >>> 0;
  const rng = seededRandom(masterSeed);

  // ── 2. Clinical signal mapping (CLINICAL ALWAYS OVERRIDES SEED) ──
  const zone = resolveNS3Zone(summary);
  const palette = resolvePalette(zone, options);
  const saturation = resolveSaturation(summary?.ns3?.peak ?? 50);
  const complexity = resolveShapeComplexity(options.track);
  const coherencePeak = summary?.verificationPayload?.peakCoherence ?? 0.5;
  const symmetryFactor = resolveSymmetryFactor(coherencePeak);
  const trajectory = summary?.clinical?.regulatoryTrajectory ?? 'stable';
  const smoothness = resolveLineSmoothness(trajectory);
  const centerConfig = resolveCenterBrightness(summary?.ns3?.peak ?? 50, summary?.clinical?.sustainedOptimal);
  const density = resolvePatternDensity(options.session_count || 1);
  const arcConfig = resolveArcRings(options.time_to_regulation_sec ?? null);
  const edgeTreatment = resolveEdgeTreatment(options.somatic_reset_used || false);
  const particleOrder = resolveParticleOrder(options.breath_accuracy ?? 50);

  // ── 3. Particle count based on density ──
  const particleCounts = { sparse: 40, layered: 80, complex: 140 };
  const particleCount = particleCounts[density] || 60;

  // ── 4. Build SVG layers ──
  const bgTint = getBackgroundTint(zone);

  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">`);
  svgParts.push(`  <!-- Background -->`);
  svgParts.push(`  <rect width="800" height="800" fill="${BACKGROUND}"/>`);
  svgParts.push(`  <rect width="800" height="800" fill="${bgTint}"/>`);

  // Layer: Arc rings (time to regulation)
  const arcRingsStr = generateArcRings(arcConfig, palette, saturation, smoothness);
  if (arcRingsStr) {
    svgParts.push(`  <!-- Arc Rings -->`);
    svgParts.push(`  ${arcRingsStr}`);
  }

  // Layer: Symmetry forms (clinical layer)
  svgParts.push(`  <!-- Symmetry Forms -->`);
  svgParts.push(`  ${generateSymmetryForms(rng, complexity, symmetryFactor, palette, saturation)}`);

  // Layer: Center orb
  svgParts.push(`  <!-- Center Orb -->`);
  svgParts.push(`  ${generateCenterOrb(centerConfig.brightness, palette, saturation)}`);

  // Special: Golden spiral (sustained_optimal)
  if (summary?.clinical?.sustainedOptimal === true) {
    svgParts.push(`  <!-- Golden Spiral (Victory Lap) -->`);
    svgParts.push(`  ${generateGoldenSpiral(rng, palette, saturation)}`);
  }

  // Special: Family unit secondary orb
  if (options.family_unit_active) {
    svgParts.push(`  <!-- Family Orb -->`);
    svgParts.push(`  ${generateSecondaryOrb(rng, palette, saturation)}`);
  }

  // Special: Lightbridge thread
  if (options.lightbridge_active) {
    svgParts.push(`  <!-- Lightbridge Thread -->`);
    svgParts.push(`  ${generateLightbridgeThread(rng, palette, saturation)}`);
  }

  // Special: Dropout return
  if (options.is_dropout_return) {
    svgParts.push(`  <!-- Dropout Return -->`);
    svgParts.push(`  ${generateDropoutReturn(rng, palette, saturation)}`);
  }

  // Special: Milestone halos
  if (options.milestone_session) {
    let tier = 0;
    if (options.milestone_session >= 50) tier = 3;
    else if (options.milestone_session >= 30) tier = 2;
    else if (options.milestone_session >= 10) tier = 1;
    if (tier > 0) {
      svgParts.push(`  <!-- Milestone Halos (tier ${tier}) -->`);
      svgParts.push(`  ${generateMilestoneHalos(tier, palette, saturation)}`);
    }
  }

  // Special: Panic recovery pattern
  if (options.panic_recovery) {
    svgParts.push(`  <!-- Panic Recovery -->`);
    svgParts.push(`  ${generatePanicRecovery(rng, palette, saturation)}`);
  }

  // Layer: Particle field (breath accuracy)
  svgParts.push(`  <!-- Particle Field -->`);
  svgParts.push(`  ${generateParticleField(rng, particleCount, particleOrder, palette, saturation)}`);

  // Layer: Edge flourishes
  svgParts.push(`  <!-- Edge Flourishes -->`);
  svgParts.push(`  ${generateEdgeFlourishes(rng, edgeTreatment, palette, saturation)}`);

  // Pulsing rings for sustained optimal
  if (centerConfig.pulsing) {
    svgParts.push(`  <!-- Pulsing Rings -->`);
    const pulseColor = applySaturation(palette[3] || '#5ffce0', saturation);
    svgParts.push(`  <circle cx="400" cy="400" r="50" stroke="${pulseColor}" fill="none" stroke-width="0.6" opacity="0.4"/>`);
    svgParts.push(`  <circle cx="400" cy="400" r="65" stroke="${pulseColor}" fill="none" stroke-width="0.4" opacity="0.3"/>`);
    svgParts.push(`  <circle cx="400" cy="400" r="80" stroke="${pulseColor}" fill="none" stroke-width="0.3" opacity="0.2"/>`);
  }

  svgParts.push(`</svg>`);

  const svgString = svgParts.join('\n');

  // ── 5. Build metadata ──
  const metadataJSON = {
    name: `Breath #${options.session_count || 1}`,
    description: `A permanent record of healing. Session ${options.session_count || 1} completed.`,
    attributes: [
      { trait_type: 'Session', value: options.session_count || 1 },
      { trait_type: 'Arc', value: options.arc_name || 'standard' },
      { trait_type: 'Tier', value: options.track || 'standard' },
      { trait_type: 'Zone', value: zone },
      { trait_type: 'Trajectory', value: trajectory },
      { trait_type: 'Density', value: density },
    ],
  };

  return { svgString, metadataJSON };
}

// ── RENDER SVG TO PNG ─────────────────────────────────────────

/**
 * Render SVG string to 800x800 PNG buffer using sharp.
 * Separated from generate() so generate() stays pure/deterministic.
 *
 * @param {string} svgString
 * @returns {Promise<Buffer>} PNG buffer
 */
async function renderToPNG(svgString) {
  const sharp = require('sharp');
  return sharp(Buffer.from(svgString))
    .resize(800, 800)
    .png()
    .toBuffer();
}

// ── DECODE ────────────────────────────────────────────────────

/**
 * Decode a session's encrypted clinical payload.
 *
 * @param {string} encryptedPayload - iv:ciphertext from IPFS metadata
 * @param {string} clinicalKey - AES-256 hex key
 * @returns {{ clinicalReadout: Object }}
 */
function decode(encryptedPayload, clinicalKey) {
  const { decryptClinicalPayload } = require('../services/ipfsService');
  const clinicalReadout = decryptClinicalPayload(encryptedPayload, clinicalKey);
  return { clinicalReadout };
}

// ── CROWN LOADING ─────────────────────────────────────────────

const CROWN_DIR = path.join(__dirname, '..', 'assets', 'crowns');
const VALID_CROWNS = ['flower_of_life', 'metatrons_cube', 'sri_yantra', 'seed_of_life', 'vesica_piscis'];

/**
 * Load a crown SVG and return its inner content for compositing.
 * @param {string} crownId - One of the 5 valid crown IDs
 * @returns {string|null} SVG inner content or null
 */
function loadCrown(crownId) {
  if (!crownId || !VALID_CROWNS.includes(crownId)) return null;
  try {
    const filePath = path.join(CROWN_DIR, `${crownId}.svg`);
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[BreathArt] Crown load failed for ${crownId}:`, err.message);
    return null;
  }
}

module.exports = {
  generate,
  renderToPNG,
  decode,
  loadCrown,
  VALID_CROWNS,
  // Exported for testing
  _seededRandom: seededRandom,
  _resolveNS3Zone: resolveNS3Zone,
};
