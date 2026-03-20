// ============================================================
// Push Notifications — Capacitor Native (APNs + FCM)
//
// Registers device token, handles foreground/background push.
// Only runs on native platforms (iOS/Android).
// ============================================================

import { Capacitor } from '@capacitor/core';
import api from './api';

export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    console.log('[PUSH] Token:', token.value);
    try {
      await api.post('/api/notifications/register-device', {
        platform: Capacitor.getPlatform(),
        push_token: token.value
      });
    } catch (err) {
      console.error('[PUSH] Token registration failed:', err);
    }
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error('[PUSH] Registration error:', error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    window.dispatchEvent(new CustomEvent('ascen-notification', {
      detail: { title: notification.title, body: notification.body, data: notification.data }
    }));
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data || {};
    const routes = {
      crisis_checkin: '/app/crisis',
      family_message: '/app/family',
      co_breath_invite: '/app/family',
      trial_expiry: '/app/subscription',
      milestone: '/app/gallery'
    };
    const path = routes[data.type];
    if (path) window.location.href = path;
  });
}
