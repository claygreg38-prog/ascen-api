// ============================================================
// Background Mode — Keep BLE Alive During Sessions
//
// Android: foreground service notification.
// iOS: BLE background mode (configured in Info.plist).
// Only active during breathing sessions, not persistent.
// ============================================================

import { Capacitor } from '@capacitor/core';

export async function enableBackgroundMode() {
  if (!Capacitor.isNativePlatform()) return;

  if (Capacitor.getPlatform() === 'android') {
    try {
      const { BackgroundMode } = await import('@capacitor-community/background-mode');
      await BackgroundMode.enable();
      await BackgroundMode.setSettings({
        title: 'ASCEN Session Active',
        text: 'Your breathing session is in progress',
        color: '#1a7a6d'
      });
    } catch (err) {
      console.log('[BG] Background mode not available:', err.message);
    }
  }
}

export async function disableBackgroundMode() {
  if (!Capacitor.isNativePlatform()) return;

  if (Capacitor.getPlatform() === 'android') {
    try {
      const { BackgroundMode } = await import('@capacitor-community/background-mode');
      await BackgroundMode.disable();
    } catch {}
  }
}
