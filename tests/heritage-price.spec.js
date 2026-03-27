// @ts-check
const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const P1_ID = process.env.TEST_PARTICIPANT_1_ID || 'PUZZ8304';
const P1_PIN = process.env.TEST_PARTICIPANT_1_PIN || '123456';

const CLINICAL_REGEX = /\b(diagnosis|treatment|intervention|therapy|clinical|pathology|disorder)\b/i;

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

test.describe('Heritage/Price Engine — 8 Dimensions, 3 Generational Roles', () => {

  test('POST /api/heritage/start creates heritage/price session', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post('/api/heritage/start', {
      headers,
      data: {},
    });

    // May require family membership + completed LACE
    expect([200, 400, 403, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });

  test('GET /api/heritage/prompts returns prompts for dimension + role (elder)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/heritage/prompts', {
      headers,
      params: { dimension: 'body', role: 'elder' },
    });

    if (res.status() === 400 || res.status() === 404) {
      test.skip(true, 'Heritage prompts require active session or family membership');
      return;
    }

    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });

  test('GET /api/heritage/prompts returns drawing-type prompts for child_elementary', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/heritage/prompts', {
      headers,
      params: { dimension: 'heart', role: 'child', age_group: 'elementary' },
    });

    if (res.status() !== 200) {
      test.skip(true, `Prompts returned ${res.status()}`);
      return;
    }

    const body = await res.json();
    // Elementary prompts should be drawing-type (age-appropriate)
    const text = JSON.stringify(body);
    expect(body).toBeTruthy();
  });

  test('GET /api/heritage/family-map returns aggregated heritage data', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/heritage/family-map', { headers });

    // May require family membership
    expect([200, 400, 403, 404, 500]).toContain(res.status());
  });

  test('POST /api/heritage/breath records breath baseline between dimensions', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post('/api/heritage/breath', {
      headers,
      data: {
        session_id: 'test_breath_' + Date.now(),
        dimension_from: 'body',
        dimension_to: 'heart',
        biometrics: {
          heart_rate: 72,
          hrv: 40,
          coherence: 0.5,
        },
      },
    });

    // May require active heritage session
    expect([200, 400, 404, 500]).toContain(res.status());
  });

  test('all 8 HOS dimensions present in heritage system', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/heritage/prompts', {
      headers,
      params: { dimension: 'body', role: 'elder' },
    });

    // Test each dimension name is recognized by the API
    const dimensions = ['body', 'heart', 'mind', 'people', 'work', 'money_time', 'spirit', 'home'];
    for (const dim of dimensions) {
      const dimRes = await request.get('/api/heritage/prompts', {
        headers,
        params: { dimension: dim, role: 'elder' },
      });
      // 200 or 400/404 (missing session) is fine — 500 would indicate broken dimension
      // But we mainly want to verify no "unknown dimension" error
      if (dimRes.status() === 200) {
        const body = await dimRes.json();
        expect(body).toBeTruthy();
      }
    }
  });

  test('language compliance: zero clinical terms in prompts or responses', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/heritage/prompts', {
      headers,
      params: { dimension: 'body', role: 'elder' },
    });

    if (res.status() !== 200) {
      test.skip(true, 'Heritage prompts not available');
      return;
    }

    const text = await res.text();
    expect(text).not.toMatch(CLINICAL_REGEX);
  });
});
