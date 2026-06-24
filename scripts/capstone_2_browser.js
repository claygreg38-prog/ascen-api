// ============================================================
// Item 7 Phase 2 — TWO-BROWSER CAPSTONE (real auto-join)
//
// The genuine two-browser flow that Phase 2 unlocks. TWO chromium contexts,
// each embedded with its own participant JWT:
//   A: auth -> autoEntry -> (no open session) enroll UI -> check/enter -> MINTS.
//   B: auth -> autoEntry -> polls GET /active-session -> AUTO-JOINS A's token
//      with NO manual enter. Both land in the SAME gated room.
// Then both reach "Breathe together", page-driven tick-bio updates regulation
// both ways, A ends -> both see completion.
//
// Proves the Phase 2 contract: B obtains the same session_id A minted via
// /active-session (asserted equal), so two real browsers share one room.
//
// PLUMBING/LIFECYCLE PROOF ONLY (synthetic bio via a faked BLE source). Green
// here is NOT the milestone — the milestone is a manual two-device run with real
// Polar H10 straps. This proves the wiring, not the felt co-regulation.
//
// Requires (env): DATABASE_URL (staging public), JWT_SECRET (server's secret),
// PORT (running server).
// ============================================================
'use strict';
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 3300;
const BASE = `http://localhost:${PORT}`;
const SECRET = process.env.JWT_SECRET;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const A_UID = 'cobreath_cap_a', B_UID = 'cobreath_cap_b';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS  ' + m); } else { fail++; console.log('  FAIL  ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mint = id => jwt.sign({ sub: String(id), userId: String(id), role: 'participant' }, SECRET, { expiresIn: '1h' });

async function ensureUser(uid) {
  let r = await pool.query('SELECT id FROM users WHERE user_id=$1', [uid]);
  if (r.rows[0]) return r.rows[0].id;
  r = await pool.query(
    `INSERT INTO users (user_id,email,role,is_active,auth_method,password_hash,created_at,updated_at)
     VALUES ($1,$2,'participant',true,'password','x',NOW(),NOW()) RETURNING id`, [uid, uid + '@capstone.test']);
  return r.rows[0].id;
}
async function ensureS15(id) {
  const r = await pool.query('SELECT 1 FROM session_completions WHERE user_id=$1 AND session_number>=15 LIMIT 1', [String(id)]);
  if (!r.rows[0]) await pool.query(
    `INSERT INTO session_completions (user_id,session_id,session_number,completed_at,created_at) VALUES ($1,$2,15,NOW(),NOW())`,
    [String(id), 's15_cap_' + id]);
}
async function setup() {
  const aId = await ensureUser(A_UID), bId = await ensureUser(B_UID);
  await ensureS15(aId); await ensureS15(bId);
  const lo = Math.min(aId, bId), hi = Math.max(aId, bId);
  let r = await pool.query('SELECT id FROM partnership_practices WHERE partner_a_id=$1 AND partner_b_id=$2', [lo, hi]);
  let pid;
  if (r.rows[0]) { pid = r.rows[0].id; await pool.query(`UPDATE partnership_practices SET dv_screening_status='pass',status='active',updated_at=NOW() WHERE id=$1`, [pid]); }
  else { r = await pool.query(`INSERT INTO partnership_practices (partner_a_id,partner_b_id,status,dv_screening_status,enrolled_at,created_at,updated_at) VALUES ($1,$2,'active','pass',NOW(),NOW(),NOW()) RETURNING id`, [lo, hi]); pid = r.rows[0].id; }
  await pool.query('DELETE FROM partnership_sessions WHERE partnership_id=$1', [pid]); // clean 48h gap
  return { aId, bId, pid };
}

const FAKE_BLE = `
  window.__installFakeBle = function(){
    if (typeof BioBridge === 'undefined') return false;
    BioBridge.getActiveSource = function(){ return 'polar_h10'; };
    var t=0;
    BioBridge.getCurrentBiometrics = function(){ t++; return { heart_rate:62+(t%4), hrv_rmssd:58+t, coherence:0.5+(t*0.02), respiratory_rate:6, timestamp:Date.now(), source:'polar_h10' }; };
    BioBridge.getCurrentNS3 = function(){ return 55+t; };
    return true;
  };`;

async function authAndOpen(page, token) {
  await page.evaluate(tok => window.postMessage({ type: 'auth', token: tok, apiKey: '' }, '*'), token);
  await sleep(500);
  await page.evaluate(() => window.__installFakeBle && window.__installFakeBle());
}
const liveOpen = page => page.evaluate(() => document.getElementById('coBreathLiveOv')?.classList.contains('active'));
async function waitLive(page, ms) { for (let i = 0; i < ms / 100; i++) { if (await liveOpen(page)) return true; await sleep(100); } return false; }
async function waitBreath(page, ms) { for (let i = 0; i < ms / 100; i++) { const ph = await page.evaluate(() => document.getElementById('cbPhase')?.textContent || ''); if (/Breathe (in|out)/.test(ph)) return true; await sleep(100); } return false; }
async function waitComplete(page, ms) { for (let i = 0; i < ms / 100; i++) { const v = await page.evaluate(() => { const c = document.getElementById('cbComplete'); return c && c.style.display !== 'none'; }); if (v) return true; await sleep(100); } return false; }

(async () => {
  console.log('=== Item 7 Phase 2 — TWO-BROWSER capstone (real auto-join) ===');
  if (!SECRET) { console.log('FATAL: JWT_SECRET not set'); process.exit(2); }
  const { aId, bId } = await setup();
  const tokA = mint(aId), tokB = mint(bId);

  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const pageA = await ctxA.newPage(), pageB = await ctxB.newPage();
  for (const p of [pageA, pageB]) { await p.addInitScript(FAKE_BLE); p.on('console', m => { if (m.type() === 'error') console.log('  [page err] ' + m.text()); }); }

  // A's minted token + the token B learns from /active-session (must match).
  let aSid = null, bJoinSid = null;
  pageA.on('response', async r => { if (r.url().includes('/api/partnership/session/start') && r.request().method() === 'POST') { try { const j = await r.json(); if (j.session_id) aSid = j.session_id; } catch (e) {} } });
  pageB.on('response', async r => { if (r.url().includes('/api/partnership/active-session')) { try { const j = await r.json(); if (j.session_id) bJoinSid = j.session_id; } catch (e) {} } });

  const url = `${BASE}/breathe?embedded=true&coupling=1`;
  await pageA.goto(url, { waitUntil: 'domcontentloaded' });
  await pageB.goto(url, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  await authAndOpen(pageA, tokA);
  await authAndOpen(pageB, tokB);
  await sleep(600);

  // A: autoEntry found no open session -> enroll UI shown.
  ok(await pageA.evaluate(() => document.getElementById('couplingEnrollOv')?.classList.contains('active')) === true,
    '1. A autoEntry shows enroll UI (no open session yet)');

  // A: check eligibility + enter -> MINT.
  await pageA.fill('#couplingPartnerId', B_UID);
  await pageA.click('#couplingCheck');
  await pageA.waitForSelector('#couplingEnter:visible', { timeout: 8000 }).catch(() => {});
  await pageA.click('#couplingEnter');
  ok(await waitLive(pageA, 8000), '2. A enter() MINTS and opens the live co-breath surface');
  for (let i = 0; i < 40 && !aSid; i++) await sleep(100);
  ok(!!aSid, '3. A minted a gated session_id (' + aSid + ')');

  // B: NO manual interaction. autoEntry's poll should find A's session and auto-join.
  ok(await waitLive(pageB, 15000), '4. B AUTO-JOINS via /active-session poll (no manual enter) — opens live surface');
  ok(bJoinSid && bJoinSid === aSid, '5. B obtained the SAME session_id A minted (two browsers, one room): A=' + aSid + ' B=' + bJoinSid);

  // Both reach breathing from SERVER breathParams.
  const aBreath = await waitBreath(pageA, 14000), bBreath = await waitBreath(pageB, 14000);
  ok(aBreath && bBreath, '6. BOTH browsers reach "Breathe together" (same room -> breathing_start fired)');

  // Page-driven tick-bio (faked BLE) both ways: own + partner regulation rendered.
  await sleep(5000);
  const aYou = await pageA.evaluate(() => document.getElementById('cbYouReg')?.textContent || '—');
  const aPartner = await pageA.evaluate(() => document.getElementById('cbPartnerReg')?.textContent || '—');
  const bPartner = await pageB.evaluate(() => document.getElementById('cbPartnerReg')?.textContent || '—');
  ok(aYou !== '—', '7a. A own regulation rendered from tick-bio (' + aYou + ')');
  ok(aPartner !== '—' && bPartner !== '—', '7b. partner_regulation rendered in BOTH browsers (A:' + aPartner + ' B:' + bPartner + ')');

  // A ends -> both see completion.
  await pageA.click('#cbEnd');
  const aDone = await waitComplete(pageA, 6000), bDone = await waitComplete(pageB, 6000);
  ok(aDone && bDone, '8. A ends -> BOTH browsers see session completion');

  await browser.close();
  // cleanup: keep users+partnership, clear session rows for repeatability
  const pr = await pool.query('SELECT id FROM partnership_practices WHERE partner_a_id=$1 AND partner_b_id=$2', [Math.min(aId, bId), Math.max(aId, bId)]);
  if (pr.rows[0]) await pool.query('DELETE FROM partnership_sessions WHERE partnership_id=$1', [pr.rows[0].id]);

  console.log(`\n=== ${fail === 0 ? 'ALL PHASE 2 TWO-BROWSER CHECKS PASSED' : 'PHASE 2 FAILURES: ' + fail} (pass=${pass}, fail=${fail}) ===`);
  console.log('Two real browsers shared one gated room via /active-session auto-join.');
  console.log('PLUMBING PROOF ONLY (synthetic bio). REAL milestone = manual two-device run with real BLE straps.');
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
})().catch(async e => { console.error('PHASE2 CAPSTONE ERROR:', e.stack || e.message); try { await pool.end(); } catch (x) {} process.exit(2); });
