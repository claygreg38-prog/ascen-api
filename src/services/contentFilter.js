// ============================================================
// [ABI] Content Filter — Caption Moderation
// File: src/services/contentFilter.js
//
// Simple keyword blocklist for showcase caption moderation.
// Focused on clear violations — not overly broad.
// These are healing-focused captions from justice-involved people.
// ============================================================

const BLOCKED_TERMS = [
  // Slurs
  'nigger', 'nigga', 'faggot', 'retard', 'spic', 'kike', 'chink', 'wetback',
  // Threats / violence
  'kill you', 'kill myself', 'gonna die', 'shoot you', 'stab you', 'blow up',
  'murder', 'suicide',
  // Explicit
  'fuck you', 'suck my', 'eat shit',
  // Drug references (these people are in recovery programs)
  'get high', 'smoke crack', 'shoot up', 'snort'
];

/**
 * Filter a caption for inappropriate content.
 * @param {string} caption
 * @returns {{ allowed: boolean, reason?: string }}
 */
function filterCaption(caption) {
  if (!caption || typeof caption !== 'string') {
    return { allowed: true };
  }

  const lower = caption.toLowerCase();
  for (const term of BLOCKED_TERMS) {
    if (lower.includes(term)) {
      return { allowed: false, reason: 'Caption contains inappropriate content' };
    }
  }

  return { allowed: true };
}

module.exports = { filterCaption };
