// ============================================================
// Item 7 Phase 1b — LIVE CO-BREATH CAPSTONE (protocol regression)
//
// Exercises the EXACT client protocol that public/index_v8.html's CoBreathLive
// module speaks: gated REST session/start -> two WS clients join/ready ->
// server breathing_start -> REST tick-bio (synthetic = plumbing proof only) ->
// partner_regulation forward -> end -> session_ended.
//
// PLUMBING PROOF ONLY. The REAL milestone is a manual two-device run with real
// BLE straps (two browsers, real Polar H10 x2). Green here != the milestone.
//
// Requires (env): DATABASE_URL (staging public proxy), JWT_SECRET (same secret
// the running server uses), PORT (the local server port).
// ============================================================
'use strict';
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3300;
const BASE = `http://localhost:${PORT}`;
const WSURL = `ws://localhost:${PORT}/ws/cobreath`;
const SECRET = process.env.JWT_SECRET;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const A_UID = 'cobreath_cap_a';
const B_UID = 'cobreath_cap_b';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  PASS  ' + m); } else { fail++; console.log('  FAIL  ' + m); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mint(id) { return jwt.sign({ sub: String(id), userId: String(id), role: 'participant' }, SECRET, { expiresIn: '1h' }); }

async function ensureUser(uid) {
  let r = await pool.query('SELECT id FROM users WHERE user_id=$1', [uid]);
  if (r.rows[0]) return r.rows[0].id;
  r = await pool.query(
    `INSERT INTO users (user_id,email,role,is_active,auth_method,password_hash,created_at,updated_at)
     VALUES ($1,$2,'participant',true,'password','x',NOW(),NOW()) RETURNING id`,
    [uid, uid + '@capstone.test']);
  return r.rows[0].id;
}
async function ensureS15(id) {
  const r = await pool.query('SELECT 1 FROM session_completions WHERE user_id=$1 AND session_number>=15 LIMIT 1', [String(id)]);
  if (r.rows[0]) return;
  await pool.query(
    `INSERT INTO session_completions (user_id,session_id,session_number,completed_at,created_at)
     VALUES ($1,$2,15,NOW(),NOW())`, [String(id), 's15_capstone_' + id]);
}
async function ensurePartnership(aId, bId) {
  const lo = Math.min(aId, bId), hi = Math.max(aId, bId);
  let r = await pool.query(
    'SELECT id FROM partnership_practices WHERE (partner_a_id=$1 AND partner_b_id=$2) OR (partner_a_id=$2 AND partner_b_id=$1)',
    [lo, hi]);
  let pid;
  if (r.rows[0]) {
    pid = r.rows[0].id;
    await pool.query(`UPDATE partnership_practices SET dv_screening_status='pass', status='active', enrolled_at=COALESCE(enrolled_at,NOW()), updated_at=NOW() WHERE id=$1`, [pid]);
  } else {
    r = await pool.query(
      `INSERT INTO partnership_practices (partner_a_id,partner_b_id,status,dv_screening_status,enrolled_at,created_at,updated_at)
       VALUES ($1,$2,'active','pass',NOW(),NOW(),NOW()) RETURNING id`, [lo, hi]);
    pid = r.rows[0].id;
  }
  // 48h gap gate: clear any prior sessions for a clean run
  await pool.query('DELETE FROM partnership_sessions WHERE partnership_id=$1', [pid]);
  return pid;
}

// minimal WS client wrapper
function wsClient(name) {
  const c = { name, ws: null, msgs: [], byType: {} };
  c.connect = () => new Promise((res, rej) => {
    c.ws = new WebSocket(WSURL);
    c.ws.on('open', res);
    c.ws.on('error', rej);
    c.ws.on('message', d => { const m = JSON.parse(d); c.msgs.push(m); (c.byType[m.type] = c.byType[m.type] || []).push(m); });
  });
  c.send = o => c.ws.send(JSON.stringify(o));
  c.waitFor = async (type, ms = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (c.byType[type] && c.byType[type].length) return c.byType[type][c.byType[type].length - 1]; await sleep(50); }
    return null;
  };
  return c;
}

async function rest(path, token, body) {
  const res = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  let d = {}; try { d = await res.json(); } catch (e) {}
  return { status: res.status, data: d };
}

(async () => {
  console.log('=== Item 7 Phase 1b — live co-breath capstone (protocol) ===');
  if (!SECRET) { console.log('FATAL: JWT_SECRET not set'); process.exit(2); }

  // ---- SETUP (staging) ----
  const aId = await ensureUser(A_UID), bId = await ensureUser(B_UID);
  await ensureS15(aId); await ensureS15(bId);
  const pid = await ensurePartnership(aId, bId);
  console.log(`setup: A=${aId} B=${bId} partnership=${pid}`);
  const tokA = mint(aId), tokB = mint(bId);

  // ---- 1. gated REST session/start (partner A) ----
  const st = await rest('/api/partnership/session/start', tokA, { session_type: 'co_breath' });
  ok(st.status === 200 && st.data.session_id, '1. gated session/start mints session_id (status ' + st.status + ')');
  const sid = st.data.session_id;
  if (!sid) { console.log('cannot continue without session_id; data=', JSON.stringify(st.data)); await cleanup(pid); process.exit(1); }

  // ---- 2. both partners join the gated room ----
  const A = wsClient('A'), B = wsClient('B');
  await A.connect(); A.send({ type: 'join', roomCode: sid, userId: String(aId) });
  const aJoined = await A.waitFor('joined');
  ok(aJoined && aJoined.role === 'initiator', '2a. partner A joins gated room (role=' + (aJoined && aJoined.role) + ')');

  await B.connect(); B.send({ type: 'join', roomCode: sid, userId: String(bId) });
  const bJoined = await B.waitFor('joined');
  ok(bJoined && bJoined.role === 'partner', '2b. partner B joins gated room (role=' + (bJoined && bJoined.role) + ')');

  const bothA = await A.waitFor('both_connected');
  ok(!!bothA, '2c. both_connected broadcast received');

  // ---- 3. ready -> server breathing_start with SERVER breathParams ----
  A.send({ type: 'ready' }); B.send({ type: 'ready' });
  const bs = await A.waitFor('breathing_start', 8000);
  ok(bs && bs.breathParams, '3a. breathing_start received');
  ok(bs && bs.breathParams && bs.breathParams.inhale_sec > 0 && bs.breathParams.exhale_sec > 0,
    '3b. SERVER breathParams present (inhale_sec/exhale_sec=' + (bs && bs.breathParams && (bs.breathParams.inhale_sec + '/' + bs.breathParams.exhale_sec)) + ')');

  // ---- 4. REST tick-bio (synthetic = plumbing) -> regulation + partner_regulation forward ----
  const synth = i => ({ hr: 62 + (i % 3), hrv: 60 + i, rmssd: 60 + i, coherence: 0.5 + i * 0.03, ns3: 55 + i });
  let lastRegA = null;
  for (let i = 0; i < 6; i++) {
    const ra = await rest('/api/partnership/session/' + sid + '/tick-bio', tokA, { biometrics: synth(i) });
    const rb = await rest('/api/partnership/session/' + sid + '/tick-bio', tokB, { biometrics: synth(i + 1) });
    if (ra.data && ra.data.regulation_category) lastRegA = ra.data.regulation_category;
    await sleep(120);
  }
  ok(!!lastRegA, '4a. tick-bio returns sender regulation_category (' + lastRegA + ')');
  const prA = await A.waitFor('partner_regulation', 3000);
  ok(!!prA && typeof prA.state === 'string', '4b. partner_regulation forwarded over WS (state=' + (prA && prA.state) + ', no raw HRV)');
  ok(!prA || (prA.hr === undefined && prA.hrv === undefined && prA.rmssd === undefined), '4c. partner_regulation carries NO raw biometrics');

  // ---- 5. end -> session_ended (idempotent completion) ----
  A.send({ type: 'end' });
  const endA = await A.waitFor('session_ended', 6000);
  const endB = await B.waitFor('session_ended', 6000);
  ok(!!endA && !!endB, '5a. session_ended delivered to BOTH partners');

  // completed_at stamped (real completion, not abandoned)
  const comp = await pool.query('SELECT completed_at, abandoned_at FROM partnership_sessions WHERE id=$1', [sid]);
  ok(comp.rows[0] && comp.rows[0].completed_at && !comp.rows[0].abandoned_at, '5b. session row stamped completed (not abandoned)');

  try { A.ws.close(); B.ws.close(); } catch (e) {}
  await cleanup(pid);

  console.log(`\n=== ${fail === 0 ? 'ALL 1b CAPSTONE CHECKS PASSED' : 'CAPSTONE FAILURES: ' + fail} (pass=${pass}, fail=${fail}) ===`);
  console.log('NOTE: synthetic bio = plumbing proof only. REAL milestone = manual two-device run with real BLE straps.');
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
})().catch(async e => { console.error('CAPSTONE ERROR:', e.stack || e.message); try { await pool.end(); } catch (x) {} process.exit(2); });

async function cleanup(pid) {
  // Keep the test users + partnership for repeatability; clear only the session rows.
  try { await pool.query('DELETE FROM partnership_sessions WHERE partnership_id=$1', [pid]); } catch (e) {}
}
