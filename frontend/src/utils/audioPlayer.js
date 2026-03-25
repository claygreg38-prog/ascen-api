// ============================================================
// frontend/src/utils/audioPlayer.js — TTS audio playback
//
// Graceful fallback: if audio fails, drifting words carry the load.
// ============================================================

let currentAudio = null;

export async function playTTS(audioUrl) {
  if (!audioUrl) return false;

  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    currentAudio = new Audio(audioUrl);
    currentAudio.volume = 0.8;
    await currentAudio.play();
    return true;
  } catch (err) {
    console.warn('[TTS] Playback failed:', err.message);
    return false; // Fallback to text
  }
}

export function stopTTS() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
