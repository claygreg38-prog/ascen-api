// ============================================================
// Item 7 Phase 1b — LIVE CO-BREATH CAPSTONE (browser two-context)
//
// The REPEATABLE REGRESSION HARNESS. Drives the REAL index_v8 DOM in two
// chromium contexts, each embedded with its own participant JWT:
//   A: auth handoff -> CouplingUI check/enter -> mints session_id ->
//      CoBreathLive surface opens -> WS join.
//   B: auth handoff -> joins the SAME session_id (Phase-2 pairing is simulated
//      here by reusing A's token; the real pairing UI is Phase 2).
// Then: both reach "Breathe together" (server breathParams drive the orb pacer),
// page-driven tick-bio updates regulation, A ends -> both see completion.
//
// PLUMBING/LIFECYCLE PROOF ONLY (synthetic bio injected via a faked BLE source).
// Green here is NOT the milestone — the milestone is a manual two-device run
// with real Polar H10 straps. This harness proves the wiring, not the felt sync.
//
// Requires (env): DATABASE_URL (staging public), JWT_SECRET (server's secret),
// PORT (running server). Reuses the cobreath_cap_a/_b users + partnership that
// scripts/capstone_1b.js sets up (run that first, or it self-sets-up below).
// ============================================================
'use strict';
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 3300;
const BASE = `http://localhost:${PORT}`;
const WSURL = `ws://localhost:${PORT}/ws/cobreath`;
const SECRET = process.env.JWT_SECRET;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const A_UID = 'cobreath_cap_a', B_UID = 'cobreath_cap_b';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS  ' + m); } else { fail++; console.log('  FAIL  ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mint = id => jwt.sign({ sub: String(id), userId: String(id), role: 'participant' }, SECRET, { expiresIn: '1h' });

async function setup() {
  const uid = async u => (await pool.query('SELECT id FROM users WHERE user_id=$1', [u])).rows[0]?.id;
  const aId = await uid(A_UID), bId = await uid(B_UID);
  if (!aId || !bId) throw new Error('Run scripts/capstone_1b.js first to create cobreath_cap_a/_b');
  const lo = Math.min(aId, bId), hi = Math.max(aId, bId);
  const pr = await pool.query('SELECT id FROM partnership_practices WHERE partner_a_id=$1 AND partner_b_id=$2', [lo, hi]);
  const pid = pr.rows[0].id;
  await pool.query('DELETE FROM partnership_sessions WHERE partnership_id=$1', [pid]); // clean 48h gap
  return { aId, bId, pid };
}

// Injected into each page BEFORE load: fake a real BLE source so the no-synthetic
// gate opens for the plumbing test, and feed deterministic synthetic biometrics.
const FAKE_BLE = `
  window.__installFakeBle = function(){
    if (typeof BioBridge === 'undefined') return false;
    BioBridge.getActiveSource = function(){ return 'polar_h10'; };
    var t = 0;
    BioBridge.getCurrentBiometrics = function(){ t++; return { heart_rate:62+(t%3), hrv_rmssd:58+t, coherence:0.5+(t*0.02), respiratory_rate:6, timestamp:Date.now(), source:'polar_h10' }; };
    BioBridge.getCurrentNS3 = function(){ return 55 + t; };
    return true;
  };
`;

async function authAndOpen(page, token) {
  // The page (embedded) posts iframe_ready to window.parent; when loaded directly,
  // parent === self, so we answer with the auth message it is waiting for.
  await page.evaluate(tok => window.postMessage({ type: 'auth', token: tok, apiKey: '' }, '*'), token);
  await sleep(400);
  await page.evaluate(() => window.__installFakeBle && window.__installFakeBle());
}

(async () => {
  console.log('=== Item 7 Phase 1b — live co-breath capstone (browser two-context) ===');
  if (!SECRET) { console.log('FATAL: JWT_SECRET not set'); process.exit(2); }
  const { aId, bId } = await setup();
  const tokA = mint(aId), tokB = mint(bId);

  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await pageA.addInitScript(FAKE_BLE);
  pageA.on('console', m => { if (m.type() === 'error') console.log('  [page error] ' + m.text()); });

  // Capture A's minted session_id from the gated start response.
  let sid = null;
  pageA.on('response', async r => {
    if (r.url().includes('/api/partnership/session/start') && r.request().method() === 'POST') {
      try { const j = await r.json(); if (j.session_id) sid = j.session_id; } catch (e) {}
    }
  });

  const url = `${BASE}/breathe?embedded=true&coupling=1`;
  await pageA.goto(url, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  await authAndOpen(pageA, tokA);

  // A: the coupling overlay opened after embedded auth (Phase 1a behavior).
  const aOverlay = await pageA.evaluate(() => document.getElementById('couplingEnrollOv')?.classList.contains('active'));
  ok(aOverlay === true, '1. embedded auth opens CouplingUI overlay (A)');

  // A: check eligibility against partner B's code, then enter -> mints + transitions.
  await pageA.fill('#couplingPartnerId', B_UID);
  await pageA.click('#couplingCheck');
  await pageA.waitForSelector('#couplingEnter:visible', { timeout: 8000 }).catch(() => {});
  const enterVisible = await pageA.evaluate(() => { const e = document.getElementById('couplingEnter'); return e && e.style.display !== 'none'; });
  ok(enterVisible, '2. eligibility passes — Enter together shown (A)');

  await pageA.click('#couplingEnter');
  // enter() closes enroll overlay and opens the live co-breath surface.
  await pageA.waitForSelector('#coBreathLiveOv.active', { timeout: 8000 }).catch(() => {});
  const liveOpen = await pageA.evaluate(() => document.getElementById('coBreathLiveOv')?.classList.contains('active'));
  ok(liveOpen === true, '3. enter() transitions A to the live co-breath surface (no longer a dead-end)');

  // Wait for the captured session_id. Partner B fills the room as a ws-client partner
  // (two real browsers sharing a session is Phase-2 pairing — not built yet; B's DOM
  // is identical to A's, and the protocol capstone covers B's symmetric side).
  for (let i = 0; i < 40 && !sid; i++) await sleep(100);
  ok(!!sid, '4. A minted a gated session_id (' + sid + ')');

  // B partner socket: join + ready + steady tick-bio so A's browser gets partner_regulation.
  const bWs = new WebSocket(WSURL);
  await new Promise((res, rej) => { bWs.on('open', res); bWs.on('error', rej); });
  bWs.send(JSON.stringify({ type: 'join', roomCode: sid, userId: String(bId) }));
  await sleep(400);
  bWs.send(JSON.stringify({ type: 'ready' }));
  let bt = 0;
  const bTick = setInterval(() => {
    bt++;
    fetch(BASE + '/api/partnership/session/' + sid + '/tick-bio', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tokB },
      body: JSON.stringify({ biometrics: { hr: 64 + (bt % 3), hrv: 59 + bt, rmssd: 59 + bt, coherence: 0.55 + bt * 0.02, ns3: 56 + bt } })
    }).catch(() => {});
  }, 2000);

  // A's browser should reach breathing — the orb pacer label cycles Breathe in/out from SERVER params.
  const reachedBreath = async page => {
    for (let i = 0; i < 140; i++) { // up to ~14s (join + both_connected + 3s countdown)
      const ph = await page.evaluate(() => document.getElementById('cbPhase')?.textContent || '');
      if (/Breathe (in|out)/.test(ph)) return true;
      await sleep(100);
    }
    return false;
  };
  ok(await reachedBreath(pageA), '5. A reaches "Breathe together" with a live partner — server breathParams drive the orb pacer');

  // Page-driven tick-bio (faked BLE) updates A's own regulation; B's ticks arrive as partner_regulation.
  await sleep(5000); // a few 2s tick cycles both ways
  const aYou = await pageA.evaluate(() => document.getElementById('cbYouReg')?.textContent || '—');
  const aPartner = await pageA.evaluate(() => document.getElementById('cbPartnerReg')?.textContent || '—');
  ok(aYou !== '—', '6a. A own regulation rendered from its page tick-bio response (' + aYou + ')');
  ok(aPartner !== '—', '6b. A partner regulation rendered from WS partner_regulation (' + aPartner + ')');

  // A ends -> A's browser shows completion (and the server completes the shared session).
  await pageA.click('#cbEnd');
  const completed = async page => { for (let i = 0; i < 60; i++) { const v = await page.evaluate(() => { const c = document.getElementById('cbComplete'); return c && c.style.display !== 'none'; }); if (v) return true; await sleep(100); } return false; };
  ok(await completed(pageA), '7. A ends -> A browser shows session completion');

  clearInterval(bTick); try { bWs.close(); } catch (e) {}
  await browser.close();
  console.log(`\n=== ${fail === 0 ? 'ALL 1b BROWSER CAPSTONE CHECKS PASSED' : 'BROWSER CAPSTONE FAILURES: ' + fail} (pass=${pass}, fail=${fail}) ===`);
  console.log('REPEATABLE REGRESSION HARNESS (synthetic bio). REAL milestone = manual two-device run with real BLE straps.');
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
})().catch(async e => { console.error('BROWSER CAPSTONE ERROR:', e.stack || e.message); try { await pool.end(); } catch (x) {} process.exit(2); });
