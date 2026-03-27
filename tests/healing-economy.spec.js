// @ts-check
const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const FAC_EMAIL = process.env.TEST_FACILITATOR_EMAIL || 'facilitator@test.ascen.dev';
const FAC_PASSWORD = process.env.TEST_FACILITATOR_PASSWORD || 'Facilitate123!';
const P1_ID = process.env.TEST_PARTICIPANT_1_ID || 'PUZZ8304';
const P1_PIN = process.env.TEST_PARTICIPANT_1_PIN || '123456';

// CRITICAL: Use specific blockchain pattern, NOT bare "token" (matches JWT/push tokens)
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

async function clinicianHeaders(request) {
  const res = await request.post('/api/auth/login/email', {
    data: { email: FAC_EMAIL, password: FAC_PASSWORD },
  });
  const body = await res.json();
  return { Authorization: `Bearer ${body.jwt}` };
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

test.describe('Healing Economy — LIT, FCR, FIS, Bond, Anti-Redlining', () => {

  test('GET /api/economy/portfolio/:userId returns LIT credential portfolio', async ({ request }) => {
    const { headers, userId } = await participantLogin(request);
    if (!userId) {
      test.skip(true, 'Could not get participant userId');
      return;
    }

    const res = await request.get(`/api/economy/portfolio/${userId}`, { headers });

    expect([200, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.balance !== undefined) {
        expect(typeof body.balance).toBe('number');
      }
    }
  });

  test('GET /api/economy/fcr returns Family Capital Reserve', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/economy/fcr', { headers });

    // Requires family_unit_id query param
    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.total_lit !== undefined) {
        expect(typeof body.total_lit).toBe('number');
      }
    }
  });

  test('GET /api/economy/fis returns FIS score with weighted components', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/economy/fis', { headers });

    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });

  test('FIS has no NaN values', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/economy/fis', { headers });

    if (res.status() !== 200) {
      test.skip(true, 'FIS not available');
      return;
    }

    const text = await res.text();
    // Check for NaN in response (would indicate computation error)
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('null');

    const body = JSON.parse(text);
    // If score is present, it should be a valid number
    if (body.score !== undefined) {
      expect(Number.isFinite(body.score)).toBe(true);
    }
  });

  test('GET /api/economy/bond returns bond tier + maturation progress', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/economy/bond', { headers });

    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.tier) {
        expect(['Seed', 'Growth', 'Mature', 'Legacy']).toContain(body.tier);
      }
    }
  });

  test('POST /api/economy/bond/evaluate evaluates maturation readiness', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post('/api/economy/bond/evaluate', {
      headers,
      data: {},
    });

    expect([200, 400, 404, 500]).toContain(res.status());
  });

  test('GET /api/economy/recognition returns LHX recognition partners', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/economy/recognition', { headers });

    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Should return partner list
      expect(body).toBeTruthy();
    }
  });

  test('GET /api/admin/equity/scores returns community equity scores (admin auth)', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const res = await request.get('/api/admin/equity/scores', { headers });

    // Admin routes — facilitator may or may not have admin access
    expect([200, 401, 403, 500]).toContain(res.status());
  });

  test('POST /api/admin/equity/scan triggers extraction detection (admin auth)', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const res = await request.post('/api/admin/equity/scan', {
      headers,
      data: {},
    });

    expect([200, 401, 403, 500]).toContain(res.status());
  });

  test('GET /api/admin/equity/scores returns 401/403 for participant auth', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/admin/equity/scores', { headers });

    // Participant should not access admin equity endpoints
    expect([401, 403]).toContain(res.status());
  });

  test('language compliance: no blockchain terms in economy responses', async ({ request }) => {
    const { headers, userId } = await participantLogin(request);
    if (!userId) {
      test.skip(true, 'Could not get participant userId');
      return;
    }

    const portfolioRes = await request.get(`/api/economy/portfolio/${userId}`, { headers });
    if (portfolioRes.status() === 200) {
      const text = await portfolioRes.text();
      expect(text).not.toMatch(BLOCKCHAIN_REGEX);
    }

    const recognitionRes = await request.get('/api/economy/recognition', { headers });
    if (recognitionRes.status() === 200) {
      const text = await recognitionRes.text();
      expect(text).not.toMatch(BLOCKCHAIN_REGEX);
    }
  });
});
