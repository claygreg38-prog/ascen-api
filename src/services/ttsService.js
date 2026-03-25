// ============================================================
// src/services/ttsService.js — ElevenLabs TTS with per-variant caching
//
// TTS is ENHANCEMENT, not dependency. Every feature works without voice.
// Drifting words carry the load when voice is unavailable.
//
// Cache key = SHA-256(text + voice_id + character + phase).
// Same inputs = same audio forever. Never regenerate.
// ============================================================

const Sentry = require('../instrument');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

const AUDIO_DIR = path.join(__dirname, '../../public/audio/tts');
let elevenLabsAvailable = false;

function initTTS() {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('[TTS] No ELEVENLABS_API_KEY — voice narration unavailable. Drifting words carry the load.');
    return false;
  }

  // Ensure audio directory exists
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  elevenLabsAvailable = true;
  console.log('[TTS] ElevenLabs initialized');
  return true;
}

function isAvailable() {
  return elevenLabsAvailable;
}

/**
 * Generate or retrieve cached TTS audio
 *
 * Cache key = SHA-256 of (text + voice_id + character + phase)
 * Same text + same voice = same audio. Never regenerate.
 */
async function generateOrCache({ text, tenantId, character, phase, sessionNumber }) {
  if (!elevenLabsAvailable) {
    return { audio_url: null, cached: false, fallback: 'text_only' };
  }

  // Get voice config from tenant
  const tenant = await pool.query(
    'SELECT voice_config FROM tenants WHERE id = $1',
    [tenantId]
  );

  const voiceConfig = tenant.rows[0]?.voice_config || {};
  const charConfig = voiceConfig[character] || voiceConfig.luno || {};
  const voiceId = charConfig.voice_id;

  if (!voiceId) {
    return { audio_url: null, cached: false, fallback: 'no_voice_configured' };
  }

  // Generate cache key
  const cacheKey = crypto.createHash('sha256')
    .update(JSON.stringify({ text, voiceId, character, phase }))
    .digest('hex')
    .slice(0, 32);

  // Check cache
  const cached = await pool.query(
    'SELECT audio_url, audio_duration_ms FROM tts_cache WHERE cache_key = $1',
    [cacheKey]
  );

  if (cached.rows.length) {
    // Update usage stats
    await pool.query(
      'UPDATE tts_cache SET last_used_at = NOW(), use_count = use_count + 1 WHERE cache_key = $1',
      [cacheKey]
    );
    return {
      audio_url: cached.rows[0].audio_url,
      duration_ms: cached.rows[0].audio_duration_ms,
      cached: true
    };
  }

  // Generate new audio via ElevenLabs
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: charConfig.stability || 0.75,
          similarity_boost: charConfig.similarity_boost || 0.8,
          style: charConfig.style || 0.3,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TTS] ElevenLabs error:', response.status, errorText);
      Sentry.captureMessage(`TTS generation failed: ${response.status}`, 'error');
      return { audio_url: null, cached: false, fallback: 'generation_failed' };
    }

    // Save audio file
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const filename = `${cacheKey}.mp3`;
    const filepath = path.join(AUDIO_DIR, filename);
    fs.writeFileSync(filepath, audioBuffer);

    const audioUrl = `/audio/tts/${filename}`;

    // Estimate duration (rough: MP3 at 128kbps, ~16KB per second)
    const durationMs = Math.round((audioBuffer.length / 16000) * 1000);

    // Store in cache
    await pool.query(`
      INSERT INTO tts_cache (cache_key, tenant_id, voice_id, text_content, phase, session_number, character, audio_url, audio_duration_ms, generated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, [cacheKey, tenantId, voiceId, text, phase, sessionNumber, character, audioUrl, durationMs]);

    console.log(`[TTS] Generated: ${phase} for session ${sessionNumber} (${durationMs}ms)`);

    return { audio_url: audioUrl, duration_ms: durationMs, cached: false };
  } catch (err) {
    console.error('[TTS] Generation error:', err.message);
    Sentry.captureException(err);
    return { audio_url: null, cached: false, fallback: 'error' };
  }
}

/**
 * Pre-warm cache for a session
 * Generates arrival + closing audio ahead of time
 */
async function prewarmSession(sessionNumber, tenantId, character) {
  if (!elevenLabsAvailable) return;

  // Get session template
  const session = await pool.query(
    'SELECT luno_arrival, luno_close FROM session_templates WHERE session_number = $1',
    [sessionNumber]
  );

  if (!session.rows.length) return;

  const { luno_arrival, luno_close } = session.rows[0];

  // Pre-generate arrival voice
  if (luno_arrival) {
    await generateOrCache({ text: luno_arrival, tenantId, character, phase: 'arrival', sessionNumber });
  }

  // Pre-generate closing voice
  if (luno_close) {
    await generateOrCache({ text: luno_close, tenantId, character, phase: 'closing', sessionNumber });
  }
}

/**
 * Clean up unused cache entries (older than 90 days, never used more than once)
 */
async function cleanupCache() {
  const result = await pool.query(`
    DELETE FROM tts_cache
    WHERE last_used_at < NOW() - INTERVAL '90 days' AND use_count <= 1
    RETURNING cache_key, audio_url
  `);

  // Delete audio files
  for (const row of result.rows) {
    const filepath = path.join(__dirname, '../../public', row.audio_url);
    try { fs.unlinkSync(filepath); } catch (e) { /* file may already be gone */ }
  }

  if (result.rows.length > 0) {
    console.log(`[TTS] Cleaned up ${result.rows.length} unused cache entries`);
  }
}

module.exports = { initTTS, isAvailable, generateOrCache, prewarmSession, cleanupCache };
