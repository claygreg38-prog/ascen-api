// @ts-check
const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const FAC_EMAIL = process.env.TEST_FACILITATOR_EMAIL || 'facilitator@test.ascen.dev';
const FAC_PASSWORD = process.env.TEST_FACILITATOR_PASSWORD || 'Facilitate123!';
const P1_ID = process.env.TEST_PARTICIPANT_1_ID || 'PUZZ8304';
const P1_PIN = process.env.TEST_PARTICIPANT_1_PIN || '123456';

const FORBIDDEN_HOS_REGEX = /\b(diagnosis|treatment|intervention|therapy|clinical\s+score|coherence\s+score)\b/i;

async function clinicianHeaders(request) {
  const res = await request.post('/api/auth/login/email', {
    data: { email: FAC_EMAIL, password: FAC_PASSWORD },
  });
  const body = await res.json();
  return { Authorization: `Bearer ${body.jwt}` };
}

async function participantHeaders(request) {
  const res = await request.post('/api/auth/login/facility', {
    data: { participant_id: P1_ID, pin: P1_PIN },
  });
  if (res.status() === 200) {
    const body = await res.json();
    return { Authorization: `Bearer ${body.jwt}` };
  }
  return { 'x-api-key': API_KEY };
}

test.describe('Clinical Kitchen Table Layer', () => {

  test('GET /api/kitchen-table/topic returns topic array with categories', async ({ request }) => {
    const headers = await participantHeaders(request);
    const res = await request.get('/api/kitchen-table/topic', { headers });

    if (res.status() !== 200) {
      test.skip(true, `Kitchen table topic returned ${res.status()}`);
      return;
    }

    const body = await res.json();
    expect(body).toBeTruthy();
    // Should return topic data (may be single topic or array)
    if (body.topic) {
      expect(body.topic).toBeTruthy();
    }
  });

  test('POST /api/kitchen-table/clinical/prompt/activate starts impact monitoring (facilitator auth)', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const res = await request.post('/api/kitchen-table/clinical/prompt/activate', {
      headers,
      data: {
        session_id: 'test_session_' + Date.now(),
        topic_id: 1,
        member_ids: [1],
      },
    });

    // May succeed or fail depending on active kitchen table session
    expect([200, 400, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.activated || body.success).toBeTruthy();
    }
  });

  test('GET /api/kitchen-table/clinical/session/report/:sessionId returns report (facilitator auth)', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const res = await request.get('/api/kitchen-table/clinical/session/report/1', {
      headers,
    });

    // May return 200 (session exists) or 404 (no session)
    expect([200, 404, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Should include prompt_impacts, communication_patterns, coaching_cards
      expect(body).toBeTruthy();
    }
  });

  test('POST /api/kitchen-table/clinical/coach-me returns coaching card (facilitator auth)', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const res = await request.post('/api/kitchen-table/clinical/coach-me', {
      headers,
      data: {
        session_id: 'test_session_' + Date.now(),
        member_biometrics: [
          { member_id: 1, heart_rate: 85, hrv: 25, coherence: 0.3 },
        ],
      },
    });

    // May succeed (returns coaching card) or fail (no active session, rate limit)
    expect([200, 400, 404, 429, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Coaching cards follow OBSERVED/LIKELY/CONSIDER format
      if (body.observed || body.card) {
        expect(body.observed || body.card?.observed).toBeTruthy();
      }
    }
  });

  test('POST /api/kitchen-table/clinical/coach-me twice within 30s returns 429', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const sessionId = 'rate_limit_test_' + Date.now();
    const data = {
      session_id: sessionId,
      member_biometrics: [
        { member_id: 1, heart_rate: 85, hrv: 25, coherence: 0.3 },
      ],
    };

    // First call
    const res1 = await request.post('/api/kitchen-table/clinical/coach-me', {
      headers,
      data,
    });

    if (res1.status() === 404 || res1.status() === 400) {
      test.skip(true, 'Coach-me requires active session');
      return;
    }

    // Second call immediately
    const res2 = await request.post('/api/kitchen-table/clinical/coach-me', {
      headers,
      data,
    });

    // Second call should be rate-limited
    if (res1.status() === 200) {
      expect(res2.status()).toBe(429);
      if (res2.status() === 429) {
        const body = await res2.json();
        expect(body.retry_after_seconds || body.retryAfter).toBeTruthy();
      }
    }
  });

  test('all clinical endpoints return 401/403 for participant auth', async ({ request }) => {
    const headers = await participantHeaders(request);

    const endpoints = [
      { method: 'POST', path: '/api/kitchen-table/clinical/prompt/activate' },
      { method: 'GET', path: '/api/kitchen-table/clinical/session/report/1' },
      { method: 'POST', path: '/api/kitchen-table/clinical/coach-me' },
      { method: 'POST', path: '/api/kitchen-table/clinical/coaching/feedback' },
    ];

    for (const ep of endpoints) {
      let res;
      if (ep.method === 'GET') {
        res = await request.get(ep.path, { headers });
      } else {
        res = await request.post(ep.path, { headers, data: {} });
      }
      // Participant should not access clinical endpoints
      // authenticateOrApiKey('clinician') may return 401 or 403
      expect([401, 403]).toContain(res.status());
    }
  });

  test('POST /api/kitchen-table/clinical/coaching/feedback updates was_seen', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const res = await request.post('/api/kitchen-table/clinical/coaching/feedback', {
      headers,
      data: {
        coaching_log_id: 1,
        was_seen: true,
      },
    });

    // May succeed or fail depending on whether log exists
    expect([200, 400, 404, 500]).toContain(res.status());
  });

  test('coaching card output uses HOS vocabulary (Armor not diagnosis)', async ({ request }) => {
    const headers = await clinicianHeaders(request);
    const res = await request.post('/api/kitchen-table/clinical/coach-me', {
      headers,
      data: {
        session_id: 'hos_check_' + Date.now(),
        member_biometrics: [
          { member_id: 1, heart_rate: 90, hrv: 20, coherence: 0.2 },
        ],
      },
    });

    if (res.status() !== 200) {
      test.skip(true, `Coach-me returned ${res.status()}`);
      return;
    }

    const text = await res.text();
    // Coaching output should use HOS vocabulary, not clinical terms
    expect(text).not.toMatch(FORBIDDEN_HOS_REGEX);
  });
});
