// NVE Band A regression test
// Run: node tests/nve-band-a-regression.test.js
//
// Scope: minimal regression net for the three Band A fixes.
// Per the verdict, full NVE test coverage is Band B work — this file only
// guards against silent-failure regression on:
//   1. lerp() utility being removed or renamed
//   2. getCurrentSample creeping back in (live H10 silent no-op)
//   3. NS3 gate being removed from _triggerFlash (clinical safety)

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const MODULE_PATH = path.join(__dirname, '..', 'public', 'modules', 'narrativeVisualsEngine.js');
const src = fs.readFileSync(MODULE_PATH, 'utf8');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('  PASS:', name);
  passed++;
}

console.log('NVE Band A regression checks');
console.log('Module:', MODULE_PATH);

// ── Fix 1: lerp utility ──
check('lerp function is defined inside the IIFE', () => {
  assert.match(src, /function\s+lerp\s*\(\s*a\s*,\s*b\s*,\s*t\s*\)\s*\{[^}]*return\s+a\s*\+\s*\(\s*b\s*-\s*a\s*\)\s*\*\s*t[^}]*\}/);
});

check('lerp produces correct outputs for known inputs', () => {
  // Extract the lerp body and execute it in a sandboxed Function.
  const m = src.match(/function\s+lerp\s*\(([^)]*)\)\s*\{([^}]*)\}/);
  assert.ok(m, 'lerp regex must match');
  const lerp = new Function(m[1], m[2]);
  assert.strictEqual(lerp(0, 10, 0), 0);
  assert.strictEqual(lerp(0, 10, 1), 10);
  assert.strictEqual(lerp(0, 10, 0.5), 5);
  assert.strictEqual(lerp(2, 18, 0.5), 10);  // matches actual usage at _applyBgState line 246
  assert.strictEqual(lerp(8, 12, 1), 12);
});

// ── Fix 2: getCurrentSample → getCurrentBiometrics ──
check('module does not call getCurrentSample (BioBridge does not export it)', () => {
  // Allow comment references explaining the rename, but no live call site.
  // Strip line comments first, then check.
  const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(stripped, /\bgetCurrentSample\s*[?(]/);
});

check('module calls getCurrentBiometrics on BioBridge', () => {
  assert.match(src, /_bioBridge\.getCurrentBiometrics\s*\(/);
});

// ── Fix 3: NS3 gate on _triggerFlash ──
check('_triggerFlash gates on isInRegulationWindow before scattering', () => {
  // Capture the function body up to its closing brace at column 2 (matches IIFE indent).
  const m = src.match(/function\s+_triggerFlash\s*\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(m, '_triggerFlash function should exist');
  const body = m[1];
  // The gate must reference isInRegulationWindow AND must come before
  // any DOM mutation (querySelectorAll). Check ordering.
  const gateIdx = body.indexOf('isInRegulationWindow');
  const domIdx = body.indexOf("querySelectorAll('.particle')");
  assert.notStrictEqual(gateIdx, -1, 'gate must be present');
  assert.notStrictEqual(domIdx, -1, 'DOM mutation must be present');
  assert.ok(gateIdx < domIdx, 'NS3 gate must execute before particle scatter');
});

check('NS3 gate uses early-return pattern (does not mutate before suppressing)', () => {
  const m = src.match(/function\s+_triggerFlash\s*\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
  const body = m[1];
  // Between the function open and isInRegulationWindow, there should be no
  // particle assignment, transition setup, or style mutation.
  const before = body.split('isInRegulationWindow')[0];
  assert.doesNotMatch(before, /\.style\./);
  assert.doesNotMatch(before, /querySelectorAll/);
});

console.log('\n' + passed + ' checks passed.');
