// ============================================================
// Background Geofencing — LightBridge Arrival Trigger
//
// Monitors home zone. Triggers LightBridge when user arrives.
// Uses phone GPS — works without watch. Battery-conscious.
// ============================================================

import { Capacitor } from '@capacitor/core';
import api from './api';

let homeLocation = null;

export async function initGeofencing() {
  if (!Capacitor.isNativePlatform()) return;
  const stored = localStorage.getItem('ascen_home_location');
  if (stored) {
    homeLocation = JSON.parse(stored);
    await startMonitoring();
  }
}

export async function setHomeFromCurrentLocation() {
  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000
    });
  });

  homeLocation = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    radius: 100
  };
  localStorage.setItem('ascen_home_location', JSON.stringify(homeLocation));
  await startMonitoring();
  return homeLocation;
}

async function startMonitoring() {
  if (!homeLocation || !Capacitor.isNativePlatform()) return;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

    await BackgroundGeolocation.addWatcher({
      backgroundMessage: 'ASCEN is monitoring your location for LightBridge.',
      backgroundTitle: 'ASCEN LightBridge',
      requestPermissions: true,
      stale: false,
      distanceFilter: 50
    }, async (location, error) => {
      if (error || !location || !homeLocation) return;

      const distance = haversine(
        location.latitude, location.longitude,
        homeLocation.latitude, homeLocation.longitude
      );

      if (distance <= homeLocation.radius) {
        if (localStorage.getItem('ascen_away') === 'true') {
          localStorage.setItem('ascen_away', 'false');
          const user = JSON.parse(localStorage.getItem('ascen_user') || '{}');
          if (user.familyUnitId) {
            try {
              await api.post('/api/lightbridge/arrival', { family_unit_id: user.familyUnitId });
            } catch {}
          }
        }
      } else {
        localStorage.setItem('ascen_away', 'true');
      }
    });
  } catch (err) {
    console.log('[GEO] Geofencing not available:', err.message);
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
