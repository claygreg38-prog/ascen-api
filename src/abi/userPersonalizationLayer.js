// ============================================================
// ASCEN User Personalization Layer — Stage 3 of Art Pipeline
// File: src/abi/userPersonalizationLayer.js
//
// NON-DESTRUCTIVE compositing on top of harmonics output.
// The thread (stage 1) and harmonics (stage 2) are never touched.
// Personalization applies hue shifts, filters, frame swaps,
// and overlay textures as a final composite pass.
//
// The original harmonics PNG is always recoverable —
// personalization is stored as settings, not baked destructively.
//
// Pipeline:
//   breathArtEngine (LOCKED) →
//   galleryHarmonicsEngine (LOCKED) →
//   userPersonalizationLayer (THIS)
// ============================================================

let sharp;
try {
  sharp = require('sharp');
} catch (_sharpErr) {
  try {
    sharp = null;
    console.warn('[Personalization] sharp unavailable');
  } catch (_) { /* no-op */ }
}
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Use global fetch (Node 18+) with safe fallback
const fetchFn = typeof fetch !== 'undefined' ? fetch : (() => {
  try { return require('node-fetch'); } catch (_) { return null; }
})();

// ── FILTER PRESETS ───────────────────────────────────────────
// CSS-like filter chains. Values are additive/multiplicative
// with manual adjustments via a single combined modulate() call.

const FILTER_PRESETS = {
  none:     { hueRotate: 0, saturate: 1.0, brightness: 1.0, contrast: 1.0 },
  warm:     { hueRotate: 15, saturate: 1.1, brightness: 1.05, contrast: 1.0 },
  cool:     { hueRotate: -20, saturate: 0.95, brightness: 1.0, contrast: 1.05 },
  midnight: { hueRotate: -40, saturate: 0.8, brightness: 0.7, contrast: 1.2 },
  golden:   { hueRotate: 30, saturate: 1.2, brightness: 1.1, contrast: 0.95 },
  muted:    { hueRotate: 0, saturate: 0.6, brightness: 1.0, contrast: 0.9 },
  vivid:    { hueRotate: 0, saturate: 1.5, brightness: 1.05, contrast: 1.1 },
  sepia:    { hueRotate: 35, saturate: 0.4, brightness: 1.05, contrast: 1.0 },
  frost:    { hueRotate: -30, saturate: 0.7, brightness: 1.15, contrast: 0.95 },
};

// ── EXTRA FRAMES (beyond sacred geometry) ────────────────────

const EXTRA_FRAMES = {
  minimal: 'frames/minimal_ring.svg',
  double_ring: 'frames/double_ring.svg',
  organic: 'frames/organic_flow.svg',
};

// Sacred geometry frames (available as overrides from harmonics)
const SACRED_FRAMES = {
  seed_of_life: 'crowns/seed_of_life.svg',
  flower_of_life: 'crowns/flower_of_life.svg',
  metatrons_cube: 'crowns/metatrons_cube.svg',
  sri_yantra: 'crowns/sri_yantra.svg',
};

// ── OVERLAY TEXTURES ─────────────────────────────────────────
// Max opacity 0.12 — textures whisper, never shout.

const OVERLAY_TEXTURES = {
  none: null,
  linen:      { file: 'textures/linen.png', opacity: 0.08, blend: 'overlay' },
  grain:      { file: 'textures/grain.png', opacity: 0.06, blend: 'overlay' },
  watercolor: { file: 'textures/watercolor.png', opacity: 0.12, blend: 'soft-light' },
  silk:       { file: 'textures/silk.png', opacity: 0.05, blend: 'overlay' },
  stone:      { file: 'textures/stone.png', opacity: 0.10, blend: 'multiply' },
  paper:      { file: 'textures/paper.png', opacity: 0.07, blend: 'overlay' },
};

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// ── APPLY PERSONALIZATION ────────────────────────────────────

/**
 * Apply personalization to a harmonics-composited PNG.
 * NON-DESTRUCTIVE: original input is not modified.
 *
 * @param {Buffer} harmonicsPng — 800x800 output from galleryHarmonicsEngine
 * @param {Object} settings — personalization settings
 * @returns {Promise<Buffer>} — personalized 800x800 PNG
 */
async function applyPersonalization(harmonicsPng, settings) {
  if (!sharp) throw new Error('sharp unavailable — cannot apply personalization');

  let pipeline = sharp(harmonicsPng);
  const composites = [];

  // 1. Combined hue/saturation/brightness — SINGLE modulate() call
  //    Manual adjustments + filter preset combined to avoid overwrite.
  const filter = (settings.filter_preset && settings.filter_preset !== 'none')
    ? (FILTER_PRESETS[settings.filter_preset] || FILTER_PRESETS.none)
    : FILTER_PRESETS.none;

  const totalHue = (settings.hue_shift || 0) + (filter.hueRotate || 0);
  const totalSat = (settings.saturation_adjust || 1.0) * (filter.saturate || 1.0);
  const totalBright = (settings.brightness_adjust || 1.0) * (filter.brightness || 1.0);

  const needsModulate = totalHue !== 0 || totalSat !== 1.0 || totalBright !== 1.0;
  if (needsModulate) {
    pipeline = pipeline.modulate({
      hue: totalHue,
      saturation: totalSat,
      brightness: totalBright,
    });
  }

  // 2. Container override (re-clip if different from harmonics)
  if (settings.container_override) {
    const maskSvg = generateClipMaskSvg(settings.container_override, 800, 800);
    if (maskSvg) {
      const maskPng = await sharp(Buffer.from(maskSvg))
        .resize(800, 800)
        .extractChannel('red')
        .toBuffer();

      // We need to apply modulate first, then re-clip
      const modulated = await pipeline.png().toBuffer();
      pipeline = sharp(modulated)
        .ensureAlpha()
        .joinChannel(maskPng);
    }
  }

  // 3. Frame override
  if (settings.frame_override !== undefined && settings.frame_override !== null) {
    if (settings.frame_override !== 'none') {
      const framePath = EXTRA_FRAMES[settings.frame_override]
        || SACRED_FRAMES[settings.frame_override];
      if (framePath) {
        try {
          const fullPath = path.join(ASSETS_DIR, framePath);
          const framePng = await sharp(fullPath)
            .resize(800, 800)
            .ensureAlpha()
            .png()
            .toBuffer();

          // Apply frame at 35% opacity by reducing alpha
          const framedWithAlpha = await sharp(framePng)
            .composite([{
              input: Buffer.from([0, 0, 0, Math.round(255 * 0.35)]),
              raw: { width: 1, height: 1, channels: 4 },
              tile: true,
              blend: 'dest-in',
            }])
            .png()
            .toBuffer();

          composites.push({ input: framedWithAlpha, blend: 'over' });
        } catch (e) {
          console.warn(`[Personalization] Frame not found: ${framePath}`);
        }
      }
    }
    // 'none' = no frame overlay (skip)
  }

  // 4. Overlay texture (max opacity 0.12 — textures whisper)
  if (settings.overlay_texture && settings.overlay_texture !== 'none') {
    const texture = OVERLAY_TEXTURES[settings.overlay_texture];
    if (texture && texture.file) {
      try {
        const texturePath = path.join(ASSETS_DIR, texture.file);
        const texturePng = await sharp(texturePath)
          .resize(800, 800)
          .ensureAlpha()
          .png()
          .toBuffer();

        // Apply texture at specified opacity
        const textureWithAlpha = await sharp(texturePng)
          .composite([{
            input: Buffer.from([255, 255, 255, Math.round(255 * texture.opacity)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: 'dest-in',
          }])
          .png()
          .toBuffer();

        composites.push({
          input: textureWithAlpha,
          blend: texture.blend || 'overlay',
        });
      } catch (e) {
        console.warn(`[Personalization] Texture not found: ${texture.file}`);
      }
    }
  }

  // Apply all composites
  if (composites.length > 0) {
    pipeline = pipeline.composite(composites);
  }

  return await pipeline.resize(800, 800).png().toBuffer();
}

// ── CONTAINER CLIP MASK ──────────────────────────────────────

function generateClipMaskSvg(shape, width, height) {
  const cx = width / 2, cy = height / 2;
  let inner;

  switch (shape) {
    case 'circle':
      inner = `<circle cx="${cx}" cy="${cy}" r="${Math.min(cx, cy)}" fill="white"/>`;
      break;
    case 'square':
      inner = `<rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="white"/>`;
      break;
    case 'oval':
      inner = `<ellipse cx="${cx}" cy="${cy}" rx="${cx * 0.875}" ry="${cy}" fill="white"/>`;
      break;
    case 'triangle': {
      const h = height * (Math.sqrt(3) / 2);
      const yOff = (height - h) / 2;
      inner = `<polygon points="${cx},${yOff} ${width},${yOff + h} 0,${yOff + h}" fill="white"/>`;
      break;
    }
    case 'hexagon': {
      const r = Math.min(cx, cy) - 20;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      }).join(' ');
      inner = `<polygon points="${pts}" fill="white"/>`;
      break;
    }
    case 'diamond':
      inner = `<polygon points="${cx},20 ${width - 20},${cy} ${cx},${height - 20} 20,${cy}" fill="white"/>`;
      break;
    default:
      return null;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="black"/>${inner}</svg>`;
}

// ── PERSONALIZE ART (full flow) ──────────────────────────────

/**
 * Fetch harmonics PNG from IPFS, apply personalization, re-upload.
 */
async function personalizeArt(sessionCompletionId, userId, settings) {
  // Get the IPFS metadata hash for this session
  const session = await pool.query(
    'SELECT id, art_ipfs_hash, harmonic_meta FROM session_completions WHERE id = $1 AND user_id = $2',
    [sessionCompletionId, userId]
  );

  if (!session.rows.length || !session.rows[0].art_ipfs_hash) {
    return { error: 'No art found for this session' };
  }

  // Fetch harmonics PNG from IPFS (metadata → image link → PNG)
  const harmonicsPng = await fetchArtPng(session.rows[0].art_ipfs_hash);
  if (!harmonicsPng) {
    return { error: 'Could not retrieve art from IPFS' };
  }

  // Apply personalization
  const personalizedPng = await applyPersonalization(harmonicsPng, settings);

  // Upload personalized version to IPFS (image only — no clinical payload)
  const ipfsService = require('../services/ipfsService');
  const { imageHash } = await ipfsService.upload(
    personalizedPng,
    { name: 'Personalized Breath Art', description: 'User-customized session art', attributes: [] },
    {},
    { sessionNumber: 0, firstName: 'Participant' }
  );

  // Upsert personalization record
  await pool.query(`
    INSERT INTO art_personalizations
    (session_completion_id, user_id, hue_shift, saturation_adjust, brightness_adjust,
     filter_preset, frame_override, overlay_texture, container_override, personalized_png_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT ON CONSTRAINT unique_personalization
    DO UPDATE SET
      hue_shift = $3, saturation_adjust = $4, brightness_adjust = $5,
      filter_preset = $6, frame_override = $7, overlay_texture = $8,
      container_override = $9, personalized_png_hash = $10,
      is_active = true, updated_at = NOW()
  `, [
    sessionCompletionId, userId,
    settings.hue_shift || 0,
    settings.saturation_adjust || 1.0,
    settings.brightness_adjust || 1.0,
    settings.filter_preset || 'none',
    settings.frame_override || null,
    settings.overlay_texture || 'none',
    settings.container_override || null,
    imageHash,
  ]);

  return {
    personalized: true,
    ipfs_hash: imageHash,
    settings_applied: settings,
  };
}

// ── PREVIEW (no IPFS upload, no save) ────────────────────────

async function previewPersonalization(sessionCompletionId, userId, settings) {
  const session = await pool.query(
    'SELECT id, art_ipfs_hash FROM session_completions WHERE id = $1 AND user_id = $2',
    [sessionCompletionId, userId]
  );

  if (!session.rows.length || !session.rows[0].art_ipfs_hash) {
    return { error: 'No art found for this session' };
  }

  const harmonicsPng = await fetchArtPng(session.rows[0].art_ipfs_hash);
  if (!harmonicsPng) {
    return { error: 'Could not retrieve art from IPFS' };
  }

  return await applyPersonalization(harmonicsPng, settings);
}

// ── REVERT ───────────────────────────────────────────────────

async function revertToOriginal(sessionCompletionId, userId) {
  await pool.query(
    'UPDATE art_personalizations SET is_active = false, updated_at = NOW() WHERE session_completion_id = $1 AND user_id = $2',
    [sessionCompletionId, userId]
  );
  return { reverted: true };
}

// ── USER PREFERENCES ─────────────────────────────────────────

async function savePreferences(userId, prefs) {
  await pool.query(`
    INSERT INTO art_preferences (user_id, default_hue_shift, default_saturation, default_brightness,
      default_filter, default_frame, default_overlay, default_container, auto_apply)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id) DO UPDATE SET
      default_hue_shift = $2, default_saturation = $3, default_brightness = $4,
      default_filter = $5, default_frame = $6, default_overlay = $7,
      default_container = $8, auto_apply = $9, updated_at = NOW()
  `, [
    userId,
    prefs.hue_shift || 0,
    prefs.saturation || 1.0,
    prefs.brightness || 1.0,
    prefs.filter || 'none',
    prefs.frame || null,
    prefs.overlay || 'none',
    prefs.container || null,
    prefs.auto_apply || false,
  ]);
}

async function getPreferences(userId) {
  const result = await pool.query(
    'SELECT * FROM art_preferences WHERE user_id = $1',
    [userId]
  );
  return result.rows.length ? result.rows[0] : null;
}

// ── IPFS FETCH HELPERS ───────────────────────────────────────

const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

/**
 * Fetch art PNG from IPFS. art_ipfs_hash is the metadata hash,
 * which contains an `image: ipfs://Qm...` field pointing to the PNG.
 */
async function fetchArtPng(metadataHash) {
  try {
    if (!fetchFn) throw new Error('No fetch implementation available');

    // Step 1: fetch metadata JSON
    const metaRes = await fetchFn(`${PINATA_GATEWAY}/${metadataHash}`);
    if (!metaRes.ok) return null;
    const metadata = await metaRes.json();

    // Step 2: extract image CID from metadata
    const imageUri = metadata.image; // "ipfs://QmXXX"
    if (!imageUri) return null;
    const imageCid = imageUri.replace('ipfs://', '');

    // Step 3: fetch PNG
    const imgRes = await fetchFn(`${PINATA_GATEWAY}/${imageCid}`);
    if (!imgRes.ok) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

// ── EXPORTS ──────────────────────────────────────────────────

module.exports = {
  applyPersonalization,
  personalizeArt,
  previewPersonalization,
  revertToOriginal,
  savePreferences,
  getPreferences,
  FILTER_PRESETS,
  OVERLAY_TEXTURES,
};
