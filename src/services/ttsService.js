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
  console.log('[TTS] generateOrCache called:', { character, phase, textLen: text?.length, tenantId, elevenLabsAvailable });

  if (!elevenLabsAvailable) {
    console.warn('[TTS] ElevenLabs not available — ELEVENLABS_API_KEY missing?');
    return { audio_url: null, cached: false, fallback: 'text_only' };
  }

  // Get voice config from tenant, with env var fallback
  // ELEVENLABS_LUNO_VOICE_ID / ELEVENLABS_LUNA_VOICE_ID override tenant config
  let voiceId = null;
  let charConfig = {};

  // 1. Check env var override (fastest path, no DB query)
  const envVoiceId = character === 'luna'
    ? process.env.ELEVENLABS_LUNA_VOICE_ID
    : process.env.ELEVENLABS_LUNO_VOICE_ID;
  console.log('[TTS] Env voice_id for', character, ':', envVoiceId ? envVoiceId.substring(0, 8) + '...' : 'NOT SET');
  if (envVoiceId) {
    voiceId = envVoiceId;
    charConfig = { stability: 0.75, similarity_boost: 0.8, style: 0.3 };
  }

  // 2. Check tenant config (if env var not set)
  // voice_config column may not exist until migration 056
  if (!voiceId && tenantId) {
    try {
      const tenant = await pool.query('SELECT voice_config FROM tenants WHERE id = $1', [tenantId]);
      const voiceConfig = tenant.rows[0]?.voice_config || {};
      charConfig = voiceConfig[character] || voiceConfig.luno || {};
      voiceId = charConfig.voice_id || null;
    } catch { /* column may not exist — non-blocking */ }
  }

  // 3. Final fallback: check default ASCEN tenant
  if (!voiceId) {
    try {
      const ascen = await pool.query("SELECT voice_config FROM tenants WHERE slug = 'ascen' LIMIT 1");
      const vc = ascen.rows[0]?.voice_config || {};
      charConfig = vc[character] || vc.luno || {};
      voiceId = charConfig.voice_id || null;
    } catch { /* column may not exist — non-blocking */ }
  }

  if (!voiceId) {
    console.warn(`[TTS] No voice_id configured for ${character}. Set ELEVENLABS_LUNO_VOICE_ID env var or update tenants.voice_config.`);
    return { audio_url: null, cached: false, fallback: 'no_voice_configured' };
  }

  // Generate cache key
  const cacheKey = crypto.createHash('sha256')
    .update(JSON.stringify({ text, voiceId, character, phase }))
    .digest('hex')
    .slice(0, 32);

  // Check file cache first (survives missing DB table)
  const cachedFile = path.join(AUDIO_DIR, `${cacheKey}.mp3`);
  if (fs.existsSync(cachedFile)) {
    console.log('[TTS] File cache hit:', cacheKey.substring(0, 8));
    return { audio_url: `/audio/tts/${cacheKey}.mp3`, cached: true };
  }

  // Check DB cache (graceful — table may not exist yet)
  try {
    const cached = await pool.query(
      'SELECT audio_url, audio_duration_ms FROM tts_cache WHERE cache_key = $1',
      [cacheKey]
    );
    if (cached.rows.length) {
      pool.query(
        'UPDATE tts_cache SET last_used_at = NOW(), use_count = use_count + 1 WHERE cache_key = $1',
        [cacheKey]
      ).catch(() => {});
      return { audio_url: cached.rows[0].audio_url, duration_ms: cached.rows[0].audio_duration_ms, cached: true };
    }
  } catch (cacheErr) {
    // tts_cache table may not exist — proceed to generate without cache
    console.warn('[TTS] Cache lookup skipped (table may not exist):', cacheErr.message);
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

    // Store in DB cache (non-blocking — table may not exist yet)
    pool.query(`
      INSERT INTO tts_cache (cache_key, tenant_id, voice_id, text_content, phase, session_number, character, audio_url, audio_duration_ms, generated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, [cacheKey, tenantId, voiceId, text, phase, sessionNumber, character, audioUrl, durationMs])
      .catch(err => console.warn('[TTS] Cache write skipped:', err.message));

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

  // Get session template — luno_arrival/luno_close may be top-level columns
  // or inside yaml_data JSONB (depends on migration state)
  let luno_arrival = null, luno_close = null;
  try {
    const session = await pool.query(
      `SELECT
        COALESCE(luno_arrival, yaml_data->>'luno_arrival') as luno_arrival,
        COALESCE(luno_close, yaml_data->>'luno_close') as luno_close
       FROM session_templates WHERE session_number = $1 LIMIT 1`,
      [sessionNumber]
    );
    if (!session.rows.length) return;
    luno_arrival = session.rows[0].luno_arrival;
    luno_close = session.rows[0].luno_close;
  } catch {
    // Columns may not exist — try yaml_data only
    try {
      const session = await pool.query(
        "SELECT yaml_data->>'luno_arrival' as luno_arrival, yaml_data->>'luno_close' as luno_close FROM session_templates WHERE session_number = $1 LIMIT 1",
        [sessionNumber]
      );
      if (!session.rows.length) return;
      luno_arrival = session.rows[0].luno_arrival;
      luno_close = session.rows[0].luno_close;
    } catch (e) {
      console.warn('[TTS] Prewarm: could not read session template:', e.message);
      return;
    }
  }

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
