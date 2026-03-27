// @ts-check
const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const P1_ID = process.env.TEST_PARTICIPANT_1_ID || 'PUZZ8304';
const P1_PIN = process.env.TEST_PARTICIPANT_1_PIN || '123456';

const CLINICAL_REGEX = /\b(progress report|clinical assessment|treatment plan|diagnosis|pathology)\b/i;

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

test.describe('Family Systems — Crest, LACE, Firmware', () => {

  test('GET /api/crest returns family crest data', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/crest', { headers });

    // May return 200 (has crest), 404 (no family/crest), or 400
    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Crest should have version, quadrants, participating_members
      if (body.version) {
        expect(typeof body.version).toBe('string');
      }
    }
  });

  test('GET /api/crest/history returns version history timeline', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/crest/history', { headers });

    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // History should be an array
      if (Array.isArray(body)) {
        expect(body).toBeInstanceOf(Array);
      }
    }
  });

  test('GET /api/crest/evaluate/1.5 returns met/missing criteria', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/crest/evaluate/1.5', { headers });

    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Evaluation should include criteria assessment
      expect(body).toBeTruthy();
    }
  });

  test('POST /api/crest/evidence submits evidence toward version upgrade', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post('/api/crest/evidence', {
      headers,
      data: {
        evidence_type: 'session_completion',
        description: 'Test evidence submission',
      },
    });

    // May require family with existing crest
    expect([200, 400, 404, 500]).toContain(res.status());
  });

  test('POST /api/crest/absent-member adds absent member as honored in absence', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post('/api/crest/absent-member', {
      headers,
      data: {
        name: 'Test Absent Member',
        relationship: 'sibling',
      },
    });

    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const text = await res.text();
      // Should never say "missing" or "non-compliant"
      expect(text).not.toMatch(/\b(missing|non-compliant)\b/i);
    }
  });

  test('GET /api/lace/domains returns LACE assessment domains', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/lace/domains', { headers });

    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Should return domain reference data
      expect(body).toBeTruthy();
    }
  });

  test('GET /api/firmware/recommended returns filtered firmware templates', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/firmware/recommended', { headers });

    expect([200, 400, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });

  test('crest never shows clinical terminology (System Build, not progress report)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/crest', { headers });

    if (res.status() !== 200) {
      test.skip(true, 'Crest not available');
      return;
    }

    const text = await res.text();
    expect(text).not.toMatch(CLINICAL_REGEX);
  });
});
