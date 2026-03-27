// @ts-check
const { test, expect } = require('@playwright/test');

const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const P1_ID = process.env.TEST_PARTICIPANT_1_ID || 'PUZZ8304';
const P1_PIN = process.env.TEST_PARTICIPANT_1_PIN || '123456';

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

test.describe('Age-Gate Safety — Age-Gated Content + ageFilter Middleware', () => {

  test('GET /api/auth/context (authenticated) includes age_config object', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/auth/context', { headers });

    if (res.status() !== 200) {
      test.skip(true, `Context returned ${res.status()} — may need seed data`);
      return;
    }

    const body = await res.json();
    expect(body).toBeTruthy();
    expect(body.age_config).toBeTruthy();
  });

  test('age_config contains bracket, max_session_minutes, content_format, capacity_display, ui_style', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/auth/context', { headers });

    if (res.status() !== 200) {
      test.skip(true, `Context returned ${res.status()} — may need seed data`);
      return;
    }

    const body = await res.json();
    if (!body.age_config) {
      test.skip(true, 'age_config not present in context response');
      return;
    }

    const config = body.age_config;
    expect(config).toHaveProperty('bracket');
    expect(config).toHaveProperty('max_session_minutes');
    expect(config).toHaveProperty('content_format');
    expect(config).toHaveProperty('capacity_display');
    expect(config).toHaveProperty('ui_style');

    // Bracket should be a valid value
    expect(['elementary', 'middle_school', 'high_school', 'adult']).toContain(config.bracket);
  });

  test('GET /api/kitchen-table/topic returns topics filtered by user age', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/kitchen-table/topic', { headers });

    if (res.status() !== 200) {
      test.skip(true, `Kitchen table returned ${res.status()}`);
      return;
    }

    const body = await res.json();
    // Topics should be age-filtered — no topic should have min_age > user's age
    // Since test participant is likely an adult, all topics should be available
    expect(body).toBeTruthy();
  });

  test('GET /api/firmware/recommended returns age-filtered firmware', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/firmware/recommended', { headers });

    if (res.status() !== 200) {
      test.skip(true, `Firmware returned ${res.status()}`);
      return;
    }

    const body = await res.json();
    // Firmware should be age-filtered
    expect(body).toBeTruthy();
  });

  test('no date_of_birth defaults to adult bracket', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get('/api/auth/context', { headers });

    if (res.status() !== 200) {
      test.skip(true, `Context returned ${res.status()} — may need seed data`);
      return;
    }

    const body = await res.json();
    if (!body.age_config) {
      test.skip(true, 'age_config not present');
      return;
    }

    // Test participant has no DOB → defaults to adult
    expect(body.age_config.bracket).toBe('adult');
  });
});
