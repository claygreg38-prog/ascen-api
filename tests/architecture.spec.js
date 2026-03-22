// @ts-check
const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const FAC_EMAIL = process.env.TEST_FACILITATOR_EMAIL || 'facilitator@test.ascen.dev';
const FAC_PASSWORD = process.env.TEST_FACILITATOR_PASSWORD || 'Facilitate123!';
const P1_ID = process.env.TEST_PARTICIPANT_1_ID || 'PUZZ8304';
const P1_PIN = process.env.TEST_PARTICIPANT_1_PIN || '123456';

async function loginAs(request, role) {
  if (role === 'facilitator') {
    const res = await request.post('/api/auth/login/email', {
      data: { email: FAC_EMAIL, password: FAC_PASSWORD },
    });
    const body = await res.json();
    return body.jwt;
  }
  if (role === 'participant') {
    const res = await request.post('/api/auth/login/facility', {
      data: { participant_id: P1_ID, pin: P1_PIN },
    });
    const body = await res.json();
    return body.jwt;
  }
  return null;
}

test.describe('Architecture — Auth Required on Protected Routes', () => {

  // Routes that MUST return 401 without any auth headers
  const protectedRoutes = [
    { method: 'GET', path: '/api/auth/verify' },
    { method: 'POST', path: '/api/abi/session/start' },
    { method: 'POST', path: '/api/abi/session/tick' },
    { method: 'POST', path: '/api/abi/session/complete' },
    { method: 'GET', path: `/api/art/gallery/${P1_ID}` },
    { method: 'GET', path: `/api/capacity/balance/${P1_ID}` },
    { method: 'GET', path: '/api/subscription/tiers' },
    { method: 'GET', path: '/api/family/unit' },
    { method: 'GET', path: '/api/admin/system-health' },
    { method: 'GET', path: '/api/admin/migration-count' },
  ];

  for (const route of protectedRoutes) {
    test(`${route.method} ${route.path} returns 401 without auth`, async ({ request }) => {
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

test.describe('Architecture — Facilitator Routes Reject Participant Role', () => {

  test('POST /api/auth/codes/generate returns 403 for participant JWT', async ({ request }) => {
    const jwt = await loginAs(request, 'participant');
    const res = await request.post('/api/auth/codes/generate', {
      headers: { Authorization: `Bearer ${jwt}` },
      data: { program_name: 'Should Fail', count: 1 },
    });
    // Production auth routes don't have auth middleware — req.user is undefined
    // with Bearer token, so role check fails → 403
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('GET /api/auth/codes/list returns 403 for participant JWT', async ({ request }) => {
    const jwt = await loginAs(request, 'participant');
    const res = await request.get('/api/auth/codes/list', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Architecture — Admin Route Access Control', () => {
  // NOTE: The authenticateOrApiKey('admin') middleware on /api/admin only sets
  // the DEFAULT ROLE for API key users — it does NOT enforce a minimum role.
  // adminRoutes.js has no internal role checks. This means ANY authenticated
  // user can access admin routes. This is documented as a finding.

  test('GET /api/admin/system-health is accessible with participant JWT (known gap)', async ({ request }) => {
    const jwt = await loginAs(request, 'participant');
    const res = await request.get('/api/admin/system-health', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    // Current behavior: 200 (no role enforcement in adminRoutes)
    // Expected behavior: should be 403
    // Documenting actual behavior — this is an access control gap
    expect(res.status()).toBe(200);
  });

  test('GET /api/admin/migration-count is accessible with participant JWT (known gap)', async ({ request }) => {
    const jwt = await loginAs(request, 'participant');
    const res = await request.get('/api/admin/migration-count', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(res.status()).toBe(200);
  });

  test('admin routes still require some form of auth', async ({ request }) => {
    const res = await request.get('/api/admin/system-health');
    expect(res.status()).toBe(401);
  });
});
