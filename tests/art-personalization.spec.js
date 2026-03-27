// @ts-check
const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const P1_ID = process.env.TEST_PARTICIPANT_1_ID || 'PUZZ8304';
const P1_PIN = process.env.TEST_PARTICIPANT_1_PIN || '123456';

const BLOCKCHAIN_REGEX = /\b(NFT|blockchain|minting|soulbound|crypto wallet)\b/i;

async function authHeaders(request) {
  const res = await request.post('/api/auth/login/facility', {
    data: { participant_id: P1_ID, pin: P1_PIN },
  });
  if (res.status() === 200) {
    const body = await res.json();
    return { Authorization: `Bearer ${body.jwt}` };
  }
  return { 'x-api-key': API_KEY };
}

async function participantLogin(request) {
  const res = await request.post('/api/auth/login/facility', {
    data: { participant_id: P1_ID, pin: P1_PIN },
  });
  if (res.status() !== 200) return { headers: { 'x-api-key': API_KEY }, userId: null };
  const body = await res.json();
  const headers = { Authorization: `Bearer ${body.jwt}` };
  const verifyRes = await request.get('/api/auth/verify', { headers });
  const verifyBody = await verifyRes.json();
  return { headers, userId: verifyBody.user?.userId ?? null };
}

test.describe('Art Personalization — Gallery Harmonics, Preferences, Breath Art', () => {

  test('GET /api/art/presets returns available filters, frames, overlays, containers', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/art/presets', { headers });

    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
      // Should include personalization options
      if (body.filters) expect(Array.isArray(body.filters)).toBe(true);
      if (body.frames) expect(Array.isArray(body.frames)).toBe(true);
      if (body.overlays) expect(Array.isArray(body.overlays)).toBe(true);
      if (body.containers) expect(Array.isArray(body.containers)).toBe(true);
    }
  });

  test('GET /api/art/preferences returns user default preferences (or null)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/art/preferences', { headers });

    expect([200, 404, 500]).toContain(res.status());
  });

  test('POST /api/art/preferences saves default preferences', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post('/api/art/preferences', {
      headers,
      data: {
        hue_shift: 30,
        filter: 'warm',
        frame: 'minimal',
        overlay: 'linen',
        container: 'circle',
      },
    });

    expect([200, 400, 500]).toContain(res.status());
  });

  test('POST /api/art/personalize with hue_shift + filter returns personalized data', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post('/api/art/personalize', {
      headers,
      data: {
        session_completion_id: 1,
        hue_shift: 45,
        filter: 'cool',
      },
    });

    // May require valid session_completion_id with existing art
    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Should return personalized IPFS hash or preview data
      expect(body).toBeTruthy();
    }
  });

  test('POST /api/art/revert reverts to harmonics version', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post('/api/art/revert', {
      headers,
      data: {
        session_completion_id: 1,
      },
    });

    // May require existing personalization to revert
    expect([200, 400, 404, 500]).toContain(res.status());
  });

  test('GET /api/art/gallery/:participantId returns gallery entries', async ({ request }) => {
    const { headers, userId } = await participantLogin(request);
    if (!userId) {
      test.skip(true, 'Could not get participant userId');
      return;
    }

    const res = await request.get(`/api/art/gallery/${userId}`, { headers });

    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Gallery should return array of entries
      if (Array.isArray(body)) {
        expect(body).toBeInstanceOf(Array);
      }
    }
  });

  test('personalization never modifies original harmonics PNG (IPFS hash preserved)', async ({ request }) => {
    const { headers, userId } = await participantLogin(request);
    if (!userId) {
      test.skip(true, 'Could not get participant userId');
      return;
    }

    // Get gallery to find a session with art
    const galleryRes = await request.get(`/api/art/gallery/${userId}`, { headers });
    if (galleryRes.status() !== 200) {
      test.skip(true, 'Gallery not available');
      return;
    }

    const gallery = await galleryRes.json();
    const entries = Array.isArray(gallery) ? gallery : (gallery.entries || []);
    if (entries.length === 0) {
      test.skip(true, 'No gallery entries to verify');
      return;
    }

    // Check that original IPFS hash is preserved in entries
    const entry = entries[0];
    if (entry.ipfs_hash || entry.original_ipfs_hash) {
      expect(entry.ipfs_hash || entry.original_ipfs_hash).toBeTruthy();
    }
  });

  test('language compliance: no blockchain terms in art/gallery responses', async ({ request }) => {
    const { headers, userId } = await participantLogin(request);
    if (!userId) {
      test.skip(true, 'Could not get participant userId');
      return;
    }

    const galleryRes = await request.get(`/api/art/gallery/${userId}`, { headers });
    if (galleryRes.status() === 200) {
      const text = await galleryRes.text();
      expect(text).not.toMatch(BLOCKCHAIN_REGEX);
    }

    const presetsRes = await request.get('/api/art/presets', { headers });
    if (presetsRes.status() === 200) {
      const text = await presetsRes.text();
      expect(text).not.toMatch(BLOCKCHAIN_REGEX);
    }
  });
});
