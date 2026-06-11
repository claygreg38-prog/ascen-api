/**
 * NVE C2 step-2 headless smoke test (plain node, no test framework).
 * Loads the REAL module in a vm sandbox with DOM/canvas/RAF shims and
 * exercises the field engine + gap_reveal against a mock DepthEngine
 * carrying the four hooks. Exit 0 = all pass, 1 = failure.
 *
 *   node tests/harness/nveC2Smoke.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const MODULE = path.join(__dirname, '..', '..', 'public', 'modules', 'narrativeVisualsEngine.js');

/* ── RAF shim: manual frame pump ── */
let rafQueue = [];
let rafId = 0;
function requestAnimationFrame(cb) { const id = ++rafId; rafQueue.push({ id, cb }); return id; }
function cancelAnimationFrame(id) { rafQueue = rafQueue.filter(f => f.id !== id); }
function pumpFrames(n) {
  for (let i = 0; i < n; i++) {
    const batch = rafQueue; rafQueue = [];
    batch.forEach(f => { try { f.cb(performance.now()); } catch (e) { fail('RAF cb threw: ' + e.message); } });
    if (rafQueue.length === 0) break;
  }
}

/* ── DOM shims ── */
const ctxStub = {
  setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {},
  arc() {}, fill() {}, fillStyle: '', globalAlpha: 1, shadowColor: '', shadowBlur: 0,
};
function fakeEl(tag) {
  return {
    tagName: tag, id: '', className: '', dataset: {}, children: [],
    style: { cssText: '', setProperty() {}, getPropertyValue() { return ''; } },
    offsetWidth: 1280, offsetHeight: 800, width: 0, height: 0,
    appendChild(c) { this.children.push(c); return c; },
    getContext() { return ctxStub; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 4, height: 4 }; },
    querySelector() { return null; },
    parentNode: null,
  };
}
const body = fakeEl('body');
const sandbox = {
  window: {
    addEventListener() {}, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
    getComputedStyle() { return { opacity: '1', animationPlayState: 'running' }; },
  },
  document: {
    body,
    getElementById() { return null; },          // no #immersiveView → host falls back to body
    createElement(tag) { return fakeEl(tag); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
  },
  navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
  screen: { width: 1920 },
  getComputedStyle() { return { opacity: '1', animationPlayState: 'running' }; },
  requestAnimationFrame, cancelAnimationFrame,
  setTimeout, clearTimeout, setInterval, clearInterval,
  console, Math, JSON, Date, performance,
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(MODULE, 'utf8'), sandbox, { filename: 'narrativeVisualsEngine.js' });
const NVE = sandbox.NarrativeVisualsEngine;

/* ── Mock DepthEngine with the four hooks (call spies) ── */
const calls = { freeze: 0, unfreeze: 0, snap: 0, restore: 0 };
let depthFrozen = false;
const MockDepth = {
  freeze() { depthFrozen = true; calls.freeze++; },
  unfreeze() { depthFrozen = false; calls.unfreeze++; },
  getParticleSnapshot() { calls.snap++; return [{ x: 1, y: 2, vx: 0, vy: 0, ph: 0, sz: 2, isLuno: true, dp: 1, id: 0 }]; },
  restoreParticleSnapshot(snap, ease) { calls.restore++; },
};

/* ── Test runner ── */
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!ok) failures++;
}
function fail(msg) { console.log('  FAIL ' + msg); failures++; }

(async function main() {
  console.log('NVE C2 step-2 headless smoke');
  console.log('module:', MODULE);

  // init + wiring
  NVE.init();
  NVE.connectToDepthEngine(MockDepth);
  check('init() ok, tier=full on 8-core shim', NVE.getState().performanceTier === 'full');

  // surfaces created on body (canvas + bg overlay)
  const created = body.children.map(c => c.id);
  check('surfaces created at init (#nveBgOverlay, #nveCanvas)',
    created.includes('nveBgOverlay') && created.includes('nveCanvas'), created.join(','));

  // A2 — idle zero cost
  check('A2 idle: RAF stopped + field empty',
    !NVE.nveField.isRunning() && NVE.nveField.count() === 0,
    'isRunning=' + NVE.nveField.isRunning() + ' count=' + NVE.nveField.count());

  // A1 — spawn via test trigger
  NVE.trigger('field_test', { duration_seconds: 0.3 });
  const c1 = NVE.nveField.count();
  check('A1 spawn: count in (0, full-budget] + RAF running',
    NVE.nveField.isRunning() && c1 > 0 && c1 <= 44, 'count=' + c1);
  pumpFrames(5);
  const snapAlpha = NVE.nveField.snapshot()[0].alpha;
  check('A1 draw: alphas fading in after 5 frames', snapAlpha > 0, 'alpha[0]=' + snapAlpha.toFixed(3));

  // A5 — tier budgets
  check('A5 full budget 40-48', NVE.nveField.budget() >= 40 && NVE.nveField.budget() <= 48, 'budget=' + NVE.nveField.budget());
  NVE.nveField.setTierForTest('reduced');
  NVE.trigger('field_test', { duration_seconds: 0.3 });
  const rc = NVE.nveField.count();
  check('A5 reduced budget 16-20 applied on spawn', rc >= 16 && rc <= 20, 'count=' + rc);
  NVE.nveField.setTierForTest('full');
  NVE.trigger('field_test', { duration_seconds: 0.3 });

  // A3 — gap_reveal freeze/restore against mock DepthEngine
  NVE.trigger('gap_reveal', { duration_ms: 120, resume_duration_ms: 50, duration_seconds: 0.3 });
  check('A3a freeze: DepthEngine.freeze + snapshot called, field RAF stopped',
    calls.freeze === 1 && calls.snap === 1 && depthFrozen && !NVE.nveField.isRunning(),
    JSON.stringify(calls) + ' fieldRAF=' + NVE.nveField.isRunning());
  await new Promise(r => setTimeout(r, 200));
  check('A3b restore: unfreeze + restoreParticleSnapshot called, field RAF resumed',
    calls.unfreeze === 1 && calls.restore === 1 && !depthFrozen && NVE.nveField.isRunning(),
    JSON.stringify(calls) + ' fieldRAF=' + NVE.nveField.isRunning());

  // A1b — reset() dissolves field back to empty + RAF stops
  NVE.reset(100);
  pumpFrames(60);
  check('A1b reset(100): field empty + RAF stopped (empty-by-default)',
    NVE.nveField.count() === 0 && !NVE.nveField.isRunning(),
    'count=' + NVE.nveField.count() + ' isRunning=' + NVE.nveField.isRunning());

  // ── E series: environment_sync re-map (C2 step 3a go/no-go) ──
  // Spy ambient particles: any style mutation during breath frames = violation.
  let ambientMutations = 0;
  function spyParticle() {
    const style = { getPropertyValue: () => '0', left: '50%', top: '50%' };
    style.setProperty = function() { ambientMutations++; };
    let _op = '0.4';
    Object.defineProperty(style, 'opacity', {
      get() { return _op; }, set(v) { ambientMutations++; _op = v; },
    });
    Object.defineProperty(style, 'animationPlayState', {
      get() { return 'running'; }, set() { ambientMutations++; },
    });
    return { style, dataset: {}, getBoundingClientRect: () => ({ left: 10, top: 10, width: 4, height: 4 }) };
  }
  const spies = [spyParticle(), spyParticle(), spyParticle()];
  sandbox.document.querySelectorAll = sel => (sel === '.particle' ? spies : []);

  NVE.trigger('environment_sync_begin', { duration_seconds: 0.5 });
  const ec = NVE.nveField.count();
  check('E1 environment_sync spawns NVE field + RAF', ec > 0 && NVE.nveField.isRunning(), 'count=' + ec);

  // Bounded-displacement model: rendered positions (probe), not home positions.
  // Baseline at neutral, contract at full inhale, expand past home at full exhale.
  NVE.onBreathFrame({ phase: 'exhale', progress: 0, cycle_count: 1 });   // v=1? no: exhale p0 -> v=1
  NVE.onBreathFrame({ phase: 'inhale', progress: 0, cycle_count: 1 });   // v=0 -> disp=-0.04 (near-home)
  pumpFrames(3);
  const dNeutral = NVE.nveField.lastRenderMeanDist();
  NVE.onBreathFrame({ phase: 'inhale', progress: 1, cycle_count: 1 });   // v=1 -> disp=+0.12 inward
  pumpFrames(3);
  const dIn = NVE.nveField.lastRenderMeanDist();
  check('E2 full inhale: field renders INWARD vs near-home (bounded disp +12%)', dIn < dNeutral,
    dNeutral.toFixed(1) + ' -> ' + dIn.toFixed(1));
  NVE.onBreathFrame({ phase: 'exhale', progress: 1, cycle_count: 1 });   // v=0 -> disp=-0.04 outward
  pumpFrames(3);
  const dOut = NVE.nveField.lastRenderMeanDist();
  check('E3 full exhale: field renders OUTWARD past home (bounded disp -4%)', dOut > dIn && dOut >= dNeutral * 0.98,
    dIn.toFixed(1) + ' -> ' + dOut.toFixed(1) + ' (neutral ' + dNeutral.toFixed(1) + ')');
  // E3b — boundedness: 240 frames of held full-inhale must NOT collapse the field
  NVE.onBreathFrame({ phase: 'inhale', progress: 1, cycle_count: 2 });
  pumpFrames(240);
  const dHeld = NVE.nveField.lastRenderMeanDist();
  check('E3b bounded: 240 frames at full inhale stays ~12% (no collapse)', dHeld > dNeutral * 0.7,
    'after 240f: ' + dHeld.toFixed(1) + ' vs neutral ' + dNeutral.toFixed(1));
  check('E4 ambient plankton untouched during breath frames (spy mutations = 0)',
    ambientMutations === 0, 'mutations=' + ambientMutations);
  NVE.reset(100);
  pumpFrames(80);
  check('E5 reset clears breath-sync field back to empty',
    NVE.nveField.count() === 0 && !NVE.nveField.isRunning(),
    'count=' + NVE.nveField.count());
  sandbox.document.querySelectorAll = () => [];

  // A4 — locked-separation greps on the NEW field code only
  const src = fs.readFileSync(MODULE, 'utf8');
  const fieldStart = src.indexOf('── NVE FIELD STATE');
  const fieldEnd = src.indexOf('── SNAPSHOT / RESTORE FOR gap_reveal');
  const stateBlock = src.slice(fieldStart, src.indexOf('── PERFORMANCE TIER DETECTION'));
  const engineStart = src.indexOf('── NVE FIELD — surfaces');
  const engineBlock = src.slice(engineStart, fieldEnd);
  const newCode = stateBlock + engineBlock;
  check('A4 new field code: zero .particle refs', !/\.particle/.test(newCode.replace(/narrative-particle/g, '')));
  check('A4 new field code: zero oceanBg refs', !/oceanBg/.test(newCode));

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECK(S) FAILED');
  process.exit(failures === 0 ? 0 : 1);
})();
