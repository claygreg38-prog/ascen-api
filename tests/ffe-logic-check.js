/* One-shot logic check for FeedbackFilterEngine (run: node tests/ffe-logic-check.js)
   Exercises the engine through the SAME contract surface production uses:
   connectToBiometricBridge + bindUser + biometricTick/arrivalComplete events. */
const path = require('path');
const src = require('fs').readFileSync(path.join(__dirname, '../public/modules/feedbackFilterEngine.js'), 'utf8');
eval(src); // module guards `window`, exposes var FeedbackFilterEngine

const bus = {};
const MockBio = {
  on(userId, ev, cb) { (bus[userId + ':' + ev] = bus[userId + ':' + ev] || []).push(cb); return () => {}; },
  emit(userId, ev, data) { (bus[userId + ':' + ev] || []).forEach(cb => cb(data)); }
};

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  [' + detail + ']' : ''));
  if (!cond) failures++;
}

const events = [];
FeedbackFilterEngine.connectToBiometricBridge(MockBio);
FeedbackFilterEngine.bindUser('u1');
FeedbackFilterEngine.on('clarity', d => events.push(d));

function tick(coh, n = 1) {
  for (let i = 0; i < n; i++) {
    MockBio.emit('u1', 'biometricTick', { sample: { coherence: coh }, ns3: Math.round(coh * 100), coherence: coh, coherencePeak: 1, tickCount: 0 });
  }
  return events[events.length - 1];
}

// 1. Baseline via arrivalComplete; session starts fully clear
MockBio.emit('u1', 'arrivalComplete', { initial_coherence: 0.25, source: 'synthetic' });
let d = tick(0.25);
check('at-baseline coherence → clarity 1 (baseline never punished)', d.clarity === 1, 'clarity=' + d.clarity);
check('baseline captured from arrivalComplete', d.baseline === 0.25, 'baseline=' + d.baseline);

// 2. Drift below baseline → clarity falls toward 0 (relative reward)
d = tick(0.05, 20);
check('sustained deep drift → clarity 0', d.clarity === 0, 'clarity=' + d.clarity);
check('EMA converged near 0.05', Math.abs(d.ema - 0.05) < 0.01, 'ema=' + d.ema.toFixed(4));

// 3. Recovery above baseline → clarity returns to 1
d = tick(0.5, 20);
check('recovery above baseline → clarity 1', d.clarity === 1, 'clarity=' + d.clarity);

// 4. EMA smoothing: a single-tick spike must not slam clarity (anti-flicker)
FeedbackFilterEngine.reset();
MockBio.emit('u1', 'arrivalComplete', { initial_coherence: 0.25 });
tick(0.25, 5);
const before = events[events.length - 1].clarity;
d = tick(0.0); // one bad tick from clarity 1
check('single drop tick does not reach clarity 0 (EMA N=5)', d.clarity > 0.3, 'clarity=' + d.clarity.toFixed(3));

// 5. Hysteresis: micro-fluctuation inside dead-band holds output
FeedbackFilterEngine.reset();
FeedbackFilterEngine.setBaseline(0.25);
tick(0.17, 30); // settle mid-range (within transfer window 0.10–0.25)
const settled = events[events.length - 1].clarity;
d = tick(0.172); // tiny wiggle
check('micro-fluctuation held by dead-band', d.clarity === settled && d.moved === false, 'clarity=' + d.clarity.toFixed(3) + ' moved=' + d.moved);

// 6. Out-of-contract samples rejected
const countBefore = events.length;
MockBio.emit('u1', 'biometricTick', { coherence: 1.7 });
MockBio.emit('u1', 'biometricTick', { coherence: -0.2 });
MockBio.emit('u1', 'biometricTick', { coherence: 'x' });
check('out-of-range/non-numeric coherence rejected (0-1 contract)', events.length === countBefore);

// 7. Swappable transfer function
FeedbackFilterEngine.setTransferFunction(function () { return 0.42; });
d = tick(0.9, 10);
check('transfer function swappable', Math.abs(d.clarity - 0.42) < 1e-9, 'clarity=' + d.clarity);

// 8. Baseline clamp band
FeedbackFilterEngine.reset();
FeedbackFilterEngine.setBaseline(0.95);
check('noisy-high arrival baseline clamped to ceiling 0.60', FeedbackFilterEngine.getState().baseline === 0.6);

process.exitCode = failures ? 1 : 0;
console.log(failures ? failures + ' FAILURE(S)' : 'ALL CHECKS PASSED');
