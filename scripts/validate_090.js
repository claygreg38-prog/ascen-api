// ============================================================
// Migration 090 validation — one open co-breath session per partnership
// Requires (env): DATABASE_URL = staging public proxy.
//   A) raw concurrent double-INSERT -> exactly one succeeds, one 23505 (the index)
//   B) concurrent startSession x2  -> both same token, exactly one open (graceful)
//   C) normal single mint          -> one open session, fresh (no regression)
// ============================================================
'use strict';
const { Pool } = require('pg');
const pe = require('../src/abi/partnershipEngine'); // engine pool reads DATABASE_URL at require
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS  ' + m); } else { fail++; console.log('  FAIL  ' + m); } };

async function openCount(pid) {
  return (await pool.query('SELECT count(*)::int n FROM partnership_sessions WHERE partnership_id=$1 AND completed_at IS NULL AND abandoned_at IS NULL', [pid])).rows[0].n;
}
async function clean(pid) { await pool.query('DELETE FROM partnership_sessions WHERE partnership_id=$1 AND completed_at IS NULL AND abandoned_at IS NULL', [pid]); }

(async () => {
  console.log('=== Migration 090 validation (staging) ===');
  const u = async x => (await pool.query('SELECT id FROM users WHERE user_id=$1', [x])).rows[0]?.id;
  const aId = await u('cobreath_cap_a'), bId = await u('cobreath_cap_b');
  const lo = Math.min(aId, bId), hi = Math.max(aId, bId);
  const pid = (await pool.query('SELECT id FROM partnership_practices WHERE partner_a_id=$1 AND partner_b_id=$2', [lo, hi])).rows[0].id;
  await pool.query(`UPDATE partnership_practices SET dv_screening_status='pass' WHERE id=$1`, [pid]);

  // A) raw concurrent double-INSERT — directly proves the partial unique index.
  await clean(pid);
  const rawInsert = () => pool.query(
    `INSERT INTO partnership_sessions (partnership_id, session_type, breath_params) VALUES ($1,'co_breath','{}') RETURNING id`, [pid]);
  const settled = await Promise.allSettled([rawInsert(), rawInsert()]);
  const okN = settled.filter(s => s.status === 'fulfilled').length;
  const rej = settled.filter(s => s.status === 'rejected');
  ok(okN === 1, 'A. raw concurrent double-INSERT: exactly ONE open INSERT succeeds (got ' + okN + ')');
  ok(rej.length === 1 && rej[0].reason && rej[0].reason.code === '23505', 'A. the loser is rejected with unique_violation 23505 (' + (rej[0] && rej[0].reason && rej[0].reason.code) + ')');
  ok(await openCount(pid) === 1, 'A. DB ends with exactly ONE open session');

  // B) concurrent startSession x2 — proves graceful end-to-end (catch -> reuse).
  await clean(pid);
  const [r1, r2] = await Promise.all([pe.startSession(pid, 'co_breath'), pe.startSession(pid, 'co_breath')]);
  ok(r1.session_id && r2.session_id && r1.session_id === r2.session_id,
    'B. concurrent startSession x2 -> BOTH callers get the SAME token (' + r1.session_id + ')');
  ok(await openCount(pid) === 1, 'B. exactly ONE open session row exists');
  ok(r1.reused === true || r2.reused === true, 'B. the losing caller resolved via reuse (reused:true), not an error');

  // C) normal single mint — no regression.
  await clean(pid);
  const c = await pe.startSession(pid, 'co_breath');
  ok(c.session_id && !c.reused, 'C. normal single mint -> fresh session, no reuse flag');
  ok(await openCount(pid) === 1, 'C. exactly ONE open session after a normal mint');

  await clean(pid);
  console.log(`\n=== ${fail === 0 ? 'ALL 090 VALIDATION CHECKS PASSED' : '090 FAILURES: ' + fail} (pass=${pass}, fail=${fail}) ===`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
})().catch(async e => { console.error('090 VALIDATION ERROR:', e.stack || e.message); try { await pool.end(); } catch (x) {} process.exit(2); });
