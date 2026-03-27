// ============================================================
// ASCEN Gallery Harmonics Engine
// File: src/abi/galleryHarmonicsEngine.js
//
// Aesthetic layer ONLY. Wraps the biometric thread from
// breathArtEngine in sacred geometry frames, color washes,
// and container shapes that evolve over the participant's
// lifetime. NEVER reads or modifies metadataJSON.
//
// The input pngBuffer from breathArtEngine may contain a
// family secondary orb for family sessions. Harmonics treats
// single-thread and multi-thread PNGs identically — the
// thread PNG is composited as-is regardless of content.
//
// Pipeline: breathArtEngine → galleryHarmonicsEngine → IPFS
// ============================================================

let sharp;
let canvasModule;
try {
  sharp = require('sharp');
} catch (_sharpErr) {
  // sharp native binary may fail on some platforms (e.g. Railway).
  // Fall back to node-canvas if available.
  try {
    canvasModule = require('canvas');
    console.warn('[GalleryHarmonics] sharp unavailable, using node-canvas fallback');
  } catch (_canvasErr) {
    // Neither available — applyHarmonics will throw, orchestrator falls back to raw thread
    console.error('[GalleryHarmonics] Neither sharp nor canvas available. Harmonics will be skipped.');
  }
}
const fs = require('fs');
const path = require('path');
const Sentry = require('../instrument');

// ── SACRED GEOMETRY FRAME MAP ────────────────────────────────

const FRAME_MAP = {
  seed:   'seed_of_life.svg',
  root:   'flower_of_life.svg',
  branch: 'metatrons_cube.svg',
  crown:  'sri_yantra.svg',
};

const CROWNS_DIR = path.join(__dirname, '..', 'assets', 'crowns');

// ── LIFECYCLE PHASES ─────────────────────────────────────────

function getLifecyclePhase(sessionNumber) {
  if (sessionNumber <= 50)  return 'seed';
  if (sessionNumber <= 150) return 'root';
  if (sessionNumber <= 300) return 'branch';
  return 'crown';
}

// ── HARMONIC PROGRESSION ─────────────────────────────────────
// Golden ratio-based oscillation. Pure function of sessionNumber.
// Zero randomness — fully deterministic.

function getProgressionIndex(sessionNumber) {
  const phi = 1.6180339887;
  return (Math.sin(sessionNumber / (50 * phi)) + 1) / 2;
}

// ── COLOR WASH ───────────────────────────────────────────────
// Encodes NS3 Zone (color family) + Lifecycle Phase (saturation).
// Max opacity 0.40 — thread is always the visual hero.

const COLOR_MAP = {
  flow:         { primary: '#3eebc2', secondary: '#5ffce0' },
  approaching:  { primary: '#c8943e', secondary: '#daa84e' },
  below_window: { primary: '#d45030', secondary: '#e86040' },
  regulated:    { primary: '#1a2848', secondary: '#304878' },
};

function getColorWash(ns3Zone, lifecyclePhase, progressionIndex) {
  const base = COLOR_MAP[ns3Zone] || COLOR_MAP.regulated;
  const opacity = Math.min(0.40, 0.28 + progressionIndex * 0.14);
  return { ...base, opacity };
}

// ── CONTAINER SHAPE SVG CLIP PATHS ───────────────────────────

function getClipPathSvg(shape) {
  switch (shape) {
    case 'square':
      return '<clipPath id="container"><rect x="0" y="0" width="800" height="800" rx="24" ry="24"/></clipPath>';
    case 'oval':
      return '<clipPath id="container"><ellipse cx="400" cy="400" rx="350" ry="400"/></clipPath>';
    case 'triangle': {
      const h = 800 * (Math.sqrt(3) / 2);
      const yOffset = (800 - h) / 2;
      const top = `400,${yOffset}`;
      const bottomLeft = `0,${yOffset + h}`;
      const bottomRight = `800,${yOffset + h}`;
      return `<clipPath id="container"><polygon points="${top} ${bottomRight} ${bottomLeft}"/></clipPath>`;
    }
    case 'circle':
    default:
      return '<clipPath id="container"><circle cx="400" cy="400" r="400"/></clipPath>';
  }
}

// ── FRAME COLOR ──────────────────────────────────────────────

function getFrameColor(ns3Zone) {
  return ['flow', 'regulated'].includes(ns3Zone) ? '#5ffce0' : '#daa84e';
}

// ── COMPOSITE RENDERING (sharp) ──────────────────────────────

async function renderCompositeSharp({ wash, thread, shape, frameSvgContent, frameOpacity, frameRotation, frameColor }) {
  // Build color wash background SVG
  const washSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <defs>
    <linearGradient id="wash" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${wash.primary}" stop-opacity="${wash.opacity}"/>
      <stop offset="100%" stop-color="${wash.secondary}" stop-opacity="${wash.opacity}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#wash)"/>
</svg>`);

  // Recolor and transform the frame SVG
  const recoloredFrame = frameSvgContent
    .replace(/stroke="#[0-9a-fA-F]{6}"/g, `stroke="${frameColor}"`)
    .replace(/fill="#[0-9a-fA-F]{6}"/g, `fill="${frameColor}"`)
    .replace(/opacity="[^"]*"/, `opacity="${frameOpacity.toFixed(3)}"`)
    .replace('<svg ', `<svg style="transform: rotate(${frameRotation.toFixed(1)}deg); transform-origin: center;" `);

  const frameSvgBuffer = Buffer.from(recoloredFrame);

  // Render wash SVG to PNG
  const washPng = await sharp(washSvg).resize(800, 800).png().toBuffer();

  // Render frame SVG to PNG
  const framePng = await sharp(frameSvgBuffer).resize(800, 800).png().toBuffer();

  // Composite: wash → thread → frame
  const unclipped = await sharp(washPng)
    .composite([
      { input: thread, blend: 'over' },
      { input: framePng, blend: 'over' },
    ])
    .png()
    .toBuffer();

  // Apply container shape clip mask via alpha channel
  const maskSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <rect width="800" height="800" fill="black"/>
  ${getShapeMaskElement(shape)}
</svg>`);

  const maskPng = await sharp(maskSvg).resize(800, 800).extractChannel('red').toBuffer();

  const clipped = await sharp(unclipped)
    .ensureAlpha()
    .joinChannel(maskPng)
    .png()
    .toBuffer();

  return await sharp(clipped).resize(800, 800).png().toBuffer();
}

// Generate the white fill shape element for the alpha mask
function getShapeMaskElement(shape) {
  switch (shape) {
    case 'square':
      return '<rect x="0" y="0" width="800" height="800" rx="24" ry="24" fill="white"/>';
    case 'oval':
      return '<ellipse cx="400" cy="400" rx="350" ry="400" fill="white"/>';
    case 'triangle': {
      const h = 800 * (Math.sqrt(3) / 2);
      const yOffset = (800 - h) / 2;
      return `<polygon points="400,${yOffset} 800,${yOffset + h} 0,${yOffset + h}" fill="white"/>`;
    }
    case 'circle':
    default:
      return '<circle cx="400" cy="400" r="400" fill="white"/>';
  }
}

// ── COMPOSITE RENDERING (canvas fallback) ────────────────────

async function renderCompositeCanvas({ wash, thread, shape, frameSvgContent, frameOpacity, frameRotation, frameColor }) {
  const { createCanvas, loadImage } = canvasModule;
  const canvas = createCanvas(800, 800);
  const ctx = canvas.getContext('2d');

  // 1. Draw color wash gradient
  const gradient = ctx.createLinearGradient(0, 0, 800, 800);
  gradient.addColorStop(0, hexToRgba(wash.primary, wash.opacity));
  gradient.addColorStop(1, hexToRgba(wash.secondary, wash.opacity));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 800);

  // 2. Draw thread PNG (hero layer)
  const threadImage = await loadImage(thread);
  ctx.drawImage(threadImage, 0, 0, 800, 800);

  // 3. Draw sacred geometry frame (recolored, rotated)
  ctx.save();
  ctx.translate(400, 400);
  ctx.rotate((frameRotation * Math.PI) / 180);
  ctx.translate(-400, -400);
  ctx.globalAlpha = frameOpacity;
  const recoloredFrame = frameSvgContent
    .replace(/stroke="#[0-9a-fA-F]{6}"/g, `stroke="${frameColor}"`)
    .replace(/fill="#[0-9a-fA-F]{6}"/g, `fill="${frameColor}"`)
    .replace(/opacity="[^"]*"/, 'opacity="1"');
  const frameSvgDataUri = 'data:image/svg+xml;base64,' + Buffer.from(recoloredFrame).toString('base64');
  const frameImage = await loadImage(frameSvgDataUri);
  ctx.drawImage(frameImage, 0, 0, 800, 800);
  ctx.restore();
  ctx.globalAlpha = 1.0;

  // 4. Apply container shape clip mask
  const maskCanvas = createCanvas(800, 800);
  const maskCtx = maskCanvas.getContext('2d');
  applyShapePath(maskCtx, shape);
  maskCtx.fillStyle = 'white';
  maskCtx.fill();

  // Apply mask: keep only pixels inside the shape
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  return canvas.toBuffer('image/png');
}

function applyShapePath(ctx, shape) {
  switch (shape) {
    case 'square':
      roundRect(ctx, 0, 0, 800, 800, 24);
      break;
    case 'oval':
      ctx.ellipse(400, 400, 350, 400, 0, 0, Math.PI * 2);
      break;
    case 'triangle': {
      const h = 800 * (Math.sqrt(3) / 2);
      const yOffset = (800 - h) / 2;
      ctx.beginPath();
      ctx.moveTo(400, yOffset);
      ctx.lineTo(800, yOffset + h);
      ctx.lineTo(0, yOffset + h);
      ctx.closePath();
      break;
    }
    case 'circle':
    default:
      ctx.beginPath();
      ctx.arc(400, 400, 400, 0, Math.PI * 2);
      ctx.closePath();
      break;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// ── RENDER DISPATCHER ────────────────────────────────────────

async function renderComposite(opts) {
  if (sharp) return renderCompositeSharp(opts);
  if (canvasModule) return renderCompositeCanvas(opts);
  throw new Error('No image renderer available (neither sharp nor canvas)');
}

// ── MAIN EXPORT ──────────────────────────────────────────────

async function applyHarmonics(threadResult, sessionContext) {
  const phase = getLifecyclePhase(sessionContext.sessionNumber);
  const progression = getProgressionIndex(sessionContext.sessionNumber);
  const colorWash = getColorWash(sessionContext.ns3Zone, phase, progression);
  const frameFile = FRAME_MAP[phase];
  const coherencePeak = Math.max(0, Math.min(1, sessionContext.coherencePeak || 0));
  // Frame opacity: progression-driven oscillation × coherence multiplier
  // Higher coherence = slightly more visible frame. Range: ~0.20–0.42
  const frameOpacity = Math.min(0.42, (0.28 + progression * 0.14) * (0.7 + coherencePeak * 0.3));
  const frameRotation = progression * 15; // 0–15 degree rotation range

  // Load sacred geometry frame SVG
  const framePath = path.join(CROWNS_DIR, frameFile);
  const frameSvgContent = fs.readFileSync(framePath, 'utf8');

  // CRITICAL: Never read threadResult.metadataJSON
  // Input pngBuffer may contain family secondary orb — treated identically.
  // Composite: wash → thread → frame → clip (frame inside container shape)
  try {
    const compositePngBuffer = await renderComposite({
      wash: colorWash,
      thread: threadResult.pngBuffer,
      shape: sessionContext.containerShape || 'circle',
      frameSvgContent,
      frameOpacity,
      frameRotation,
      frameColor: getFrameColor(sessionContext.ns3Zone),
    });

    return {
      compositePngBuffer,
      harmonicsMeta: {
        lifecyclePhase: phase,
        frameGeometry: frameFile,
        containerShape: sessionContext.containerShape || 'circle',
        colorWash,
        progressionIndex: progression,
      },
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err; // re-throw so orchestrator can fall back to raw thread
  }
}

module.exports = {
  applyHarmonics,
  getLifecyclePhase,
  getProgressionIndex,
  getColorWash,
  getFrameColor,
};
