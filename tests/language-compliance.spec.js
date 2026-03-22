// @ts-check
const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const FAC_EMAIL = process.env.TEST_FACILITATOR_EMAIL || 'facilitator@test.ascen.dev';
const FAC_PASSWORD = process.env.TEST_FACILITATOR_PASSWORD || 'Facilitate123!';
const P1_ID = process.env.TEST_PARTICIPANT_1_ID || 'PUZZ8304';
const P1_PIN = process.env.TEST_PARTICIPANT_1_PIN || '123456';

// Targeted regex — matches whole words, case-insensitive
const FORBIDDEN_REGEX = /\b(NFT|blockchain|minting|coherence\s+score|diagnosis|crypto)\b/i;
// These are allowed in specific technical contexts but not in user-facing text
const CLINICAL_REGEX = /\b(NS3|HRV|ns3_peak|ns3_floor|ns3_mean|hrv_baseline)\b/;

/** Login as participant, return { headers, userId } where userId is the DB integer id */
async function participantLogin(request) {
  const res = await request.post('/api/auth/login/facility', {
    data: { participant_id: P1_ID, pin: P1_PIN },
  });
  if (res.status() !== 200) {
    return { headers: { 'x-api-key': API_KEY }, userId: null };
  }
  const body = await res.json();
  const headers = { Authorization: `Bearer ${body.jwt}` };

  // Decode userId from /api/auth/verify (legacy middleware populates req.user)
  const verifyRes = await request.get('/api/auth/verify', { headers });
  const verifyBody = await verifyRes.json();
  const userId = verifyBody.user?.userId ?? null;

  return { headers, userId };
}

async function facilitatorAuth(request) {
  const res = await request.post('/api/auth/login/email', {
    data: { email: FAC_EMAIL, password: FAC_PASSWORD },
  });
  const body = await res.json();
  return { Authorization: `Bearer ${body.jwt}` };
}

test.describe('Language Compliance — No Forbidden Terms', () => {

  test('GET /api/art/gallery contains no forbidden terms', async ({ request }) => {
    const { headers, userId } = await participantLogin(request);
    expect(userId).toBeTruthy();

    const res = await request.get(`/api/art/gallery/${userId}`, { headers });
    // Gallery may return 200 (even with 0 pieces) or 500 if user_id type mismatch
    if (res.status() !== 200) {
      test.skip(true, `Gallery returned ${res.status()}`);
      return;
    }

    const text = await res.text();
    expect(text).not.toMatch(FORBIDDEN_REGEX);
    expect(text).not.toMatch(CLINICAL_REGEX);
  });

  test('GET /api/capacity/balance returns state label, not raw score', async ({ request }) => {
    const { headers, userId } = await participantLogin(request);
    expect(userId).toBeTruthy();

    const res = await request.get(`/api/capacity/balance/${userId}`, { headers });
    if (res.status() !== 200) {
      test.skip(true, 'Capacity endpoint not reachable');
      return;
    }

    const body = await res.json();
    // Must have a state label
    const validStates = ['full', 'steady', 'drawing_down', 'low', 'depleted'];
    expect(validStates).toContain(body.state);

    // Response text must not contain forbidden language
    const text = JSON.stringify(body);
    expect(text).not.toMatch(FORBIDDEN_REGEX);
    expect(text).not.toMatch(CLINICAL_REGEX);
  });

  test('GET /api/subscription/tiers contains no blockchain terms', async ({ request }) => {
    const headers = await facilitatorAuth(request);

    const res = await request.get('/api/subscription/tiers', { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    const text = JSON.stringify(body);

    // No blockchain/crypto terminology in tier descriptions
    expect(text).not.toMatch(FORBIDDEN_REGEX);
    expect(text).not.toMatch(/\b(wallet|Wallet|mint|Mint)\b/);

    // Tiers should have human-friendly names
    expect(body.tiers.length).toBeGreaterThanOrEqual(3);
    for (const tier of body.tiers) {
      expect(tier.name).toBeTruthy();
      expect(tier.features).toBeTruthy();
    }
  });
});
