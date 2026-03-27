// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Route Smoke Tests — Verify routes are mounted and middleware loads.
 * All requests are WITHOUT auth. Expected: 401, NOT 404 (unmounted) or 500 (crash).
 * Purpose: catch "module not found" deploy crashes before production.
 */
test.describe('Route Smoke — All Route Groups Return 401, Not 404 or 500', () => {

  const smokeRoutes = [
    { method: 'GET', path: '/api/heritage/current', label: 'Heritage' },
    { method: 'GET', path: '/api/monitor/session-stream', label: 'Session Monitoring SSE' },
    { method: 'GET', path: '/api/crest', label: 'Family Crest' },
    { method: 'GET', path: '/api/partnership/eligibility', label: 'Partnership' },
    { method: 'GET', path: '/api/quilting/gates', label: 'Quilting Gates' },
    { method: 'GET', path: '/api/prenatal/status', label: 'Prenatal Status' },
    { method: 'GET', path: '/api/economy/recognition', label: 'Economy Recognition' },
    { method: 'GET', path: '/api/admin/equity/scores', label: 'Admin Equity' },
    { method: 'GET', path: '/api/kitchen-table/clinical/session/report/test', label: 'Clinical Kitchen Table' },
    { method: 'GET', path: '/api/vault/recovery/history/1', label: 'Vault Recovery' },
    { method: 'GET', path: '/api/art/presets', label: 'Art Presets' },
    { method: 'GET', path: '/api/art/preferences', label: 'Art Preferences' },
    { method: 'GET', path: '/api/tts/available', label: 'TTS Available' },
  ];

  for (const route of smokeRoutes) {
    test(`${route.label}: ${route.method} ${route.path} → 401 (not 404/500)`, async ({ request }) => {
      let res;
      if (route.method === 'GET') {
        res = await request.get(route.path);
      } else {
        res = await request.post(route.path, { data: {} });
      }
      expect(res.status()).toBe(401);
    });
  }
});
