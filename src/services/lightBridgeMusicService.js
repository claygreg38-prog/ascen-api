// ============================================================
// LightBridge Music Service — Track Selection by NS3 State
// File: src/services/lightBridgeMusicService.js
//
// Selects ambient music by NS3 zone. Family preferences override defaults.
// Music informs, never manipulates. Families choose tracks.
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getMusicTrack(familyUnitId, ns3State) {
  try {
    // Check family preference first
    const pref = await pool.query(
      `SELECT lp.track_id, lp.custom_file_url, lm.file_url, lm.title
       FROM lightbridge_family_music_prefs lp
       LEFT JOIN lightbridge_music_library lm ON lm.id = lp.track_id
       WHERE lp.family_unit_id = $1 AND lp.ns3_state = $2`,
      [familyUnitId, ns3State]
    );

    if (pref.rows.length > 0) {
      return {
        url: pref.rows[0].custom_file_url || pref.rows[0].file_url,
        title: pref.rows[0].title || 'Custom Track'
      };
    }

    // Fall back to default track
    const defaultTrack = await pool.query(
      `SELECT file_url, title FROM lightbridge_music_library
       WHERE ns3_state = $1 AND is_default = true AND is_active = true LIMIT 1`,
      [ns3State]
    );

    if (defaultTrack.rows.length > 0) {
      return { url: defaultTrack.rows[0].file_url, title: defaultTrack.rows[0].title };
    }

    return null;
  } catch (err) {
    return null;
  }
}

async function playTrack(device, track) {
  if (!track || !device.speaker_endpoint) return;

  if (process.env.LIGHTBRIDGE_SIMULATE === 'true') {
    console.log(`[LIGHTBRIDGE MUSIC] Playing "${track.title}" on ${device.device_name || device.id}: ${track.url}`);
    return;
  }

  // Real speaker integration placeholder
  // Echo: Alexa API, Google Home: Google Cast, Bluetooth: client-side via WebSocket
  console.log(`[LIGHTBRIDGE MUSIC] Would play "${track.title}" on speaker ${device.id}`);
}

async function getAllTracks() {
  try {
    const result = await pool.query(
      'SELECT id, title, ns3_state, tempo_bpm, duration_s, is_default FROM lightbridge_music_library WHERE is_active = true ORDER BY ns3_state, is_default DESC'
    );
    return result.rows;
  } catch (err) {
    return [];
  }
}

async function setFamilyPreference(familyUnitId, ns3State, trackId, customFileUrl) {
  try {
    await pool.query(
      `INSERT INTO lightbridge_family_music_prefs (family_unit_id, ns3_state, track_id, custom_file_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (family_unit_id, ns3_state) DO UPDATE SET track_id = $3, custom_file_url = $4`,
      [familyUnitId, ns3State, trackId || null, customFileUrl || null]
    );
    return { saved: true };
  } catch (err) {
    return { error: true, message: 'Failed to save preference' };
  }
}

module.exports = { getMusicTrack, playTrack, getAllTracks, setFamilyPreference };
