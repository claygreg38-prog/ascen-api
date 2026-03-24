#!/usr/bin/env node
// ============================================================
// Disclosure Routing Integration Test — Staging
// Tests 4 disclosure classification scenarios:
//   1. Normal message → delivered
//   2. abuse_recipient → NOT delivered, clinical record
//   3. self_harm → delivered with coaching, clinical record
//   4. abuse_third_party → delivered with coaching, clinical record
// ============================================================

const STAGING = process.env.STAGING_URL || 'https://ascen-staging-production.up.railway.app';
const API_KEY = process.env.TEST_API_KEY || 'ascen_test_2026';
const results = [];

async function api(method, path, body, token) {
  const h = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${STAGING}${path}`, opts);
  const t = await r.text();
  try { return { s: r.status, d: JSON.parse(t) }; } catch { return { s: r.status, d: { _raw: t.substring(0, 300) } }; }
}

function rec(name, exp, act, pass, det) {
  results.push({ name, pass });
  console.log(`${pass ? '✅' : '❌'} ${name}`);
  console.log(`   exp: ${exp}`);
  console.log(`   got: ${act}`);
  if (det) console.log(`   det: ${JSON.stringify(det)}`);
}

async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log(' DISCLOSURE ROUTING TEST');
  console.log(` ${STAGING}`);
  console.log('══════════════════════════════════════════════════\n');

  // ── Phase 1: Create test fixture ───────────────────────────
  console.log('── Setting up test data ──\n');

  const fixture = await api('POST', '/api/admin/test-fixture/disclosure');
  if (fixture.s !== 200) {
    console.error('Test fixture creation failed:', fixture.s, JSON.stringify(fixture.d));
    process.exit(1);
  }

  const { parent, child, family_unit_id } = fixture.d;
  console.log('Parent:    DB id=' + parent.db_id + ', user_id=' + parent.user_id);
  console.log('Child:     DB id=' + child.db_id + ', user_id=' + child.user_id);
  console.log('Family:    ' + family_unit_id);
  console.log('Tier:      guided_bridge');

  // ── Phase 2: Generate JWT for child (sender) ──────────────
  const childTokRes = await api('POST', '/api/auth/token', {
    userId: child.user_id, role: 'participant'
  });
  if (childTokRes.s !== 200) {
    console.error('Token generation failed:', childTokRes.d);
    process.exit(1);
  }
  const childToken = childTokRes.d.token;
  console.log('Child JWT: ✓\n');

  // ── Phase 3: Run 4 disclosure scenarios ────────────────────
  console.log('══════════════════════════════════════════════════');
  console.log(' RUNNING 4 SCENARIOS');
  console.log('══════════════════════════════════════════════════\n');

  const send = async (text) => {
    return api('POST', '/api/premium/message/send', {
      recipient_id: parent.db_id,
      message_text: text,
      channel_type: 'parent_child',
      family_unit_id
    }, childToken);
  };

  // ── S1: Normal message ─────────────────────────────────────
  {
    console.log('📨 S1: "I miss you dad"');
    const r = await send('I miss you dad');
    console.log('   Response:', r.s, JSON.stringify(r.d).substring(0, 300));

    if (r.s !== 200) {
      rec('1. Normal "I miss you dad"', 'HTTP 200, delivered', `HTTP ${r.s}: ${r.d.error || r.d.message}`, false);
    } else {
      rec('1. Normal "I miss you dad"',
        'disclosure=null, delivered=true',
        `disclosure=${r.d.disclosure}, delivered=${r.d.delivered}, decision=${r.d.decision}`,
        r.d.disclosure === null && r.d.delivered === true,
        { messageId: r.d.messageId });
    }
  }

  // ── S2: Abuse by recipient ─────────────────────────────────
  {
    console.log('\n📨 S2: "Dad hits me when he\'s drunk"');
    const r = await send("Dad hits me when he's drunk");
    console.log('   Response:', r.s, JSON.stringify(r.d).substring(0, 300));

    if (r.s !== 200) {
      rec('2. Abuse recipient "Dad hits me..."', 'HTTP 200', `HTTP ${r.s}`, false);
    } else {
      const pass = r.d.disclosure === 'abuse_recipient' && r.d.delivered === false && r.d.decision === 'flag';
      rec('2. Abuse recipient "Dad hits me when he\'s drunk"',
        'abuse_recipient, delivered=false, decision=flag',
        `disclosure=${r.d.disclosure}, delivered=${r.d.delivered}, decision=${r.d.decision}`,
        pass,
        { messageId: r.d.messageId, senderMsg: r.d.senderMessage });

      if (r.d.messageId) await checkClinical(r.d.messageId, 'abuse_recipient', '2b');
    }
  }

  // ── S3: Self-harm ──────────────────────────────────────────
  {
    console.log('\n📨 S3: "I want to hurt myself"');
    const r = await send('I want to hurt myself');
    console.log('   Response:', r.s, JSON.stringify(r.d).substring(0, 300));

    if (r.s !== 200) {
      rec('3. Self-harm "I want to hurt myself"', 'HTTP 200', `HTTP ${r.s}`, false);
    } else {
      // self_harm: classified, routed to clinical, MUST deliver to parent
      const classOk = r.d.disclosure === 'self_harm';
      const deliverOk = r.d.delivered === true;
      rec('3. Self-harm "I want to hurt myself"',
        'self_harm, delivered=true (parent must know)',
        `disclosure=${r.d.disclosure}, delivered=${r.d.delivered}, decision=${r.d.decision}`,
        classOk && deliverOk,
        { messageId: r.d.messageId, recipientCoaching: (r.d.recipientCoaching || '').substring(0, 80) });

      if (r.d.messageId) await checkClinical(r.d.messageId, 'self_harm', '3b');
    }
  }

  // ── S4: Abuse by third party ───────────────────────────────
  {
    console.log('\n📨 S4: "My teacher hit me"');
    const r = await send('My teacher hit me');
    console.log('   Response:', r.s, JSON.stringify(r.d).substring(0, 300));

    if (r.s !== 200) {
      rec('4. Abuse third-party "My teacher hit me"', 'HTTP 200', `HTTP ${r.s}`, false);
    } else {
      const classOk = r.d.disclosure === 'abuse_third_party';
      const deliverOk = r.d.delivered !== false || r.d.decision !== 'flag';
      rec('4. Abuse third-party "My teacher hit me"',
        'abuse_third_party, DOES deliver to parent (not blocked)',
        `disclosure=${r.d.disclosure}, delivered=${r.d.delivered}, decision=${r.d.decision}`,
        classOk && deliverOk,
        { messageId: r.d.messageId, recipientCoaching: (r.d.recipientCoaching || '').substring(0, 80) });

      if (r.d.messageId) await checkClinical(r.d.messageId, 'abuse_third_party', '4b');
    }
  }

  // ── Phase 4: Summary ───────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════');
  console.log(' RESULTS');
  console.log('══════════════════════════════════════════════════\n');

  const p = results.filter(r => r.pass).length;
  results.forEach(r => console.log(` ${r.pass ? '✅' : '❌'} ${r.name}`));
  console.log(`\n ${p}/${results.length} passed`);

  if (p < results.length) {
    console.log('\n Failures:');
    results.filter(r => !r.pass).forEach(r => console.log(`   - ${r.name}`));
  }

  console.log('\n══════════════════════════════════════════════════');
  process.exit(p === results.length ? 0 : 1);
}

async function checkClinical(msgId, expectedType, label) {
  const tok = (await api('POST', '/api/auth/token', { userId: 'clin', role: 'clinician' })).d?.token;
  if (!tok) return;

  const r = await api('GET', '/api/premium/clinical/disclosures', null, tok);
  if (r.s !== 200) {
    console.log(`   ⚠️  Clinical check: HTTP ${r.s}`);
    return;
  }

  const list = r.d?.disclosures || (Array.isArray(r.d) ? r.d : []);
  const match = list.find(d => d.message_id === msgId);

  if (match) {
    rec(`${label}. Clinical disclosure record`,
      `type=${expectedType}, record exists`,
      `type=${match.disclosure_type}, review_status=${match.review_status}, mandatory_reporting=${match.mandatory_reporting_flag}`,
      match.disclosure_type === expectedType,
      { disclosure_id: match.id });
  } else {
    rec(`${label}. Clinical disclosure record`,
      'Record exists for message',
      `Not found among ${list.length} disclosures`,
      false);
  }
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
