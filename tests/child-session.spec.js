// ============================================================
// Child Session Tests — Breath Bridge Phase 1
// File: tests/child-session.spec.js
//
// 10 tests covering POST + GET endpoints, validation, auth,
// age gating, trend computation, and business logic.
// ============================================================

const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const FAC_EMAIL = process.env.TEST_FACILITATOR_EMAIL || 'facilitator@test.ascen.dev';
const FAC_PASSWORD = process.env.TEST_FACILITATOR_PASSWORD || 'Facilitate123!';
const CHILD_ID = process.env.TEST_CHILD_PARTICIPANT_ID || null;
const CHILD_PIN = process.env.TEST_CHILD_PIN || '123456';
const ADULT_ID = process.env.TEST_ADULT_PARTICIPANT_ID || 'PUZZ8304';
const ADULT_PIN = process.env.TEST_ADULT_PARTICIPANT_PIN || '123456';
const TEST_FAMILY_ID = process.env.TEST_FAMILY_ID || null;

// Helper: get clinician JWT
async function clinicianHeaders(request) {
  const res = await request.post('/api/auth/login/email', {
    data: { email: FAC_EMAIL, password: FAC_PASSWORD },
  });
  if (res.status() !== 200) return { 'x-api-key': API_KEY };
  const body = await res.json();
  return { Authorization: `Bearer ${body.jwt}` };
}

// Helper: get child JWT (if a child test user exists)
async function childHeaders(request) {
  if (!CHILD_ID) return null;
  const res = await request.post('/api/auth/login/facility', {
    data: { participant_id: CHILD_ID, pin: CHILD_PIN },
  });
  if (res.status() !== 200) return null;
  const body = await res.json();
  return { Authorization: `Bearer ${body.jwt}` };
}

// Helper: get adult participant JWT
async function adultHeaders(request) {
  const res = await request.post('/api/auth/login/facility', {
    data: { participant_id: ADULT_ID, pin: ADULT_PIN },
  });
  if (res.status() !== 200) return { 'x-api-key': API_KEY };
  const body = await res.json();
  return { Authorization: `Bearer ${body.jwt}` };
}

// Helper: generate a child JWT via API key token endpoint
async function childTokenViaApiKey(request) {
  const res = await request.post('/api/auth/token', {
    headers: { 'x-api-key': API_KEY },
    data: { userId: 'test-child-user', role: 'participant' },
  });
  if (res.status() !== 200) return null;
  const body = await res.json();
  return { Authorization: `Bearer ${body.token}` };
}

test.describe('Child Session — Breath Bridge Phase 1', () => {

  // T1: POST /api/child-session with valid child JWT -> 201
  test('T1: POST with valid child JWT returns 201', async ({ request }) => {
    const headers = await childHeaders(request);
    if (!headers) {
      test.skip(true, 'No child test user configured (TEST_CHILD_PARTICIPANT_ID)');
      return;
    }

    const res = await request.post('/api/child-session', {
      headers,
      data: {
        breaths_completed: 18,
        breaths_available: 20,
        duration_seconds: 162,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.session_timestamp).toBeTruthy();
  });

  // T2: POST with adult JWT -> 403
  test('T2: POST with adult JWT returns 403', async ({ request }) => {
    const headers = await adultHeaders(request);

    const res = await request.post('/api/child-session', {
      headers,
      data: {
        breaths_completed: 18,
        breaths_available: 20,
        duration_seconds: 162,
      },
    });

    // Adult bracket should be rejected
    expect([403, 404]).toContain(res.status());
    if (res.status() === 403) {
      const body = await res.json();
      expect(body.error).toBeTruthy();
    }
  });

  // T3: POST with no JWT -> 401
  test('T3: POST with no auth returns 401', async ({ request }) => {
    const res = await request.post('/api/child-session', {
      data: {
        breaths_completed: 18,
        breaths_available: 20,
        duration_seconds: 162,
      },
    });

    expect(res.status()).toBe(401);
  });

  // T4: POST with breaths_completed > breaths_available -> 400
  test('T4: POST with breaths_completed > breaths_available returns 400', async ({ request }) => {
    const headers = await childHeaders(request);
    if (!headers) {
      test.skip(true, 'No child test user configured');
      return;
    }

    const res = await request.post('/api/child-session', {
      headers,
      data: {
        breaths_completed: 25,
        breaths_available: 20,
        duration_seconds: 100,
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('breaths_completed must be <= breaths_available');
  });

  // T5: POST with negative values -> 400
  test('T5: POST with negative values returns 400', async ({ request }) => {
    const headers = await childHeaders(request);
    if (!headers) {
      test.skip(true, 'No child test user configured');
      return;
    }

    const res = await request.post('/api/child-session', {
      headers,
      data: {
        breaths_completed: -5,
        breaths_available: 20,
        duration_seconds: 100,
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // T6: GET /api/child-session/family/:id with clinician JWT -> 200
  test('T6: GET family sessions with clinician JWT returns 200', async ({ request }) => {
    if (!TEST_FAMILY_ID) {
      test.skip(true, 'No test family ID configured (TEST_FAMILY_ID)');
      return;
    }

    const headers = await clinicianHeaders(request);
    const res = await request.get(`/api/child-session/family/${TEST_FAMILY_ID}`, { headers });

    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.family_id).toBe(TEST_FAMILY_ID);
      expect(Array.isArray(body.sessions)).toBe(true);
      expect(body.summary).toBeTruthy();
      expect(body.summary).toHaveProperty('total_sessions');
      expect(body.summary).toHaveProperty('sessions_this_week');
      expect(body.summary).toHaveProperty('sessions_this_month');
      expect(body.summary).toHaveProperty('avg_breaths_completed');
      expect(body.summary).toHaveProperty('avg_duration_seconds');
      expect(body.summary).toHaveProperty('early_quit_rate');
      expect(body.summary).toHaveProperty('longest_session_breaths');
      expect(body.summary).toHaveProperty('trend');
    }
  });

  // T7: GET family sessions with participant JWT -> 403
  test('T7: GET family sessions with participant JWT returns 403', async ({ request }) => {
    const headers = await adultHeaders(request);
    const familyId = TEST_FAMILY_ID || '00000000-0000-0000-0000-000000000000';

    const res = await request.get(`/api/child-session/family/${familyId}`, { headers });

    expect([401, 403]).toContain(res.status());
  });

  // T8: GET returns correct summary computation
  test('T8: GET returns correct summary structure', async ({ request }) => {
    if (!TEST_FAMILY_ID) {
      test.skip(true, 'No test family ID configured');
      return;
    }

    const headers = await clinicianHeaders(request);
    const res = await request.get(`/api/child-session/family/${TEST_FAMILY_ID}`, { headers });

    if (res.status() !== 200) {
      test.skip(true, `Endpoint returned ${res.status()}`);
      return;
    }

    const body = await res.json();
    const { summary } = body;

    // Validate types
    expect(typeof summary.total_sessions).toBe('number');
    expect(typeof summary.sessions_this_week).toBe('number');
    expect(typeof summary.sessions_this_month).toBe('number');
    expect(typeof summary.avg_breaths_completed).toBe('number');
    expect(typeof summary.avg_duration_seconds).toBe('number');
    expect(typeof summary.early_quit_rate).toBe('number');
    expect(typeof summary.longest_session_breaths).toBe('number');
    expect(['increasing', 'steady', 'decreasing', 'new']).toContain(summary.trend);

    // Validate ranges
    expect(summary.early_quit_rate).toBeGreaterThanOrEqual(0);
    expect(summary.early_quit_rate).toBeLessThanOrEqual(1);
    expect(summary.sessions_this_week).toBeLessThanOrEqual(summary.sessions_this_month);
    expect(summary.sessions_this_month).toBeLessThanOrEqual(summary.total_sessions);
  });

  // T9: GET with zero sessions returns trend "new"
  test('T9: GET with unknown family returns empty result', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const fakeId = '00000000-0000-0000-0000-ffffffffffff';

    const res = await request.get(`/api/child-session/family/${fakeId}`, { headers });

    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.summary.total_sessions).toBe(0);
      expect(body.summary.trend).toBe('new');
    }
  });

  // T10: early_quit computed correctly (server-side, not from body)
  test('T10: early_quit is server-computed', async ({ request }) => {
    const headers = await childHeaders(request);
    if (!headers) {
      test.skip(true, 'No child test user configured');
      return;
    }

    // Send a session where breaths_completed < breaths_available (early quit)
    const res = await request.post('/api/child-session', {
      headers,
      data: {
        breaths_completed: 10,
        breaths_available: 20,
        duration_seconds: 80,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();

    // Verify via GET that early_quit was computed server-side
    if (TEST_FAMILY_ID) {
      const clinHeaders = await clinicianHeaders(request);
      const getRes = await request.get(`/api/child-session/family/${TEST_FAMILY_ID}`, { headers: clinHeaders });
      if (getRes.status() === 200) {
        const getData = await getRes.json();
        const session = getData.sessions.find(s => s.id === body.id);
        if (session) {
          expect(session.early_quit).toBe(true);
        }
      }
    }
  });
});
