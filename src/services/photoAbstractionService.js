// ============================================================
// [ABI] Photo Abstraction Service
// File: src/services/photoAbstractionService.js
//
// Extracts a 6x6 grid color palette from uploaded images.
// Original image is NEVER stored — only the palette.
// ============================================================

const sharp = require('sharp');

/**
 * Extract a 6x6 grid color palette from an image buffer.
 * @param {Buffer} imageBuffer - Raw image bytes
 * @returns {Promise<{palette: string[]}>} - Array of 36 hex color strings
 */
async function extractPalette(imageBuffer) {
  // Resize to 600x600
  const resized = await sharp(imageBuffer)
    .resize(600, 600, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const cellW = 100; // 600 / 6
  const cellH = 100;
  const palette = [];

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      let rSum = 0, gSum = 0, bSum = 0;
      let count = 0;

      for (let y = row * cellH; y < (row + 1) * cellH; y++) {
        for (let x = col * cellW; x < (col + 1) * cellW; x++) {
          const idx = (y * info.width + x) * 3;
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }

      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);
      palette.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
    }
  }

  return { palette };
}

module.exports = { extractPalette };
