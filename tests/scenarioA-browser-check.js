/* Browser check for Scenario A: PartnerPlayer (hls.js) + MFL through the
   adapter interface, against the REAL public test stream.
   Run: node tests/scenarioA-browser-check.js   (needs network)
   Invariants instrumented: createMediaElementSource must NEVER be called;
   video element computed filter must stay 'none'. */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));

(async () => {
  let failures = 0;
  const check = (name, cond, detail) => {
    console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  [' + detail + ']' : ''));
    if (!cond) failures++;
  };

  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // INVARIANT instrumentation: count any MediaElementAudioSourceNode creation.
  await page.addInitScript(() => {
    window.__mediaElementSourceCalls = 0;
    const wrap = (Ctor) => {
      if (!Ctor) return;
      const orig = Ctor.prototype.createMediaElementSource;
      Ctor.prototype.createMediaElementSource = function () {
        window.__mediaElementSourceCalls++;
        return orig.apply(this, arguments);
      };
    };
    wrap(window.AudioContext); wrap(window.webkitAudioContext);
  });
  page.on('console', m => { if (m.type() === 'error') console.log('  [page error]', m.text()); });

  const url = 'file:///' + path.join(__dirname, 'harness', 'scenarioA.harness.html').replace(/\\/g, '/');
  await page.goto(url);

  // Flag discipline: module default OFF, create() refuses while off.
  const flagState = await page.evaluate(() => ({
    defaultFlag: PartnerPlayer.getConfig().ENABLE_PARTNER_FEEDBACK,
    refusedAdapter: PartnerPlayer.create()
  }));
  check('ENABLE_PARTNER_FEEDBACK defaults to false', flagState.defaultFlag === false);
  check('create() returns null while flag is off', flagState.refusedAdapter === null);

  // Start: mounts hls.js stream, wires MFL adapter-first, starts contract ticks.
  await page.click('#btnStart');
  try {
    await page.waitForFunction(() => {
      const a = window.__adapter; const v = a && a._getVideoEl();
      return v && v.readyState >= 2 && v.currentTime > 1;
    }, { timeout: 45000 });
  } catch (e) {
    check('test stream playing (currentTime advancing)', false, 'timeout — network/stream unreachable?');
    await browser.close(); process.exitCode = 1; return;
  }

  const initial = await page.evaluate(() => {
    const a = window.__adapter, v = a._getVideoEl(), wrap = a.getOverlayTarget();
    return {
      mode: a._getMode(),
      currentTime: v.currentTime,
      clarity: FeedbackFilterEngine.getState().clarity,
      vol: v.volume,
      dim: MediaFeedbackLayer.getState().dimOpacity,
      overlaysInTarget: !!wrap.querySelector('.mfl-dim') && !!wrap.querySelector('.mfl-grain'),
      videoFilter: getComputedStyle(v).filter,
      audioReady: MediaFeedbackLayer.getState().audioReady
    };
  });
  check('hls.js mode active in our own player', initial.mode === 'hls.js', initial.mode);
  check('test stream playing (currentTime advancing)', initial.currentTime > 1, initial.currentTime.toFixed(1) + 's');
  check('MFL overlays mounted inside adapter.getOverlayTarget()', initial.overlaysInTarget);
  check('ambient bed initialized', initial.audioReady === true);
  check('at baseline: clarity 1, dim 0, native volume 1',
    initial.clarity === 1 && initial.dim === 0 && initial.vol === 1,
    'clarity=' + initial.clarity + ' dim=' + initial.dim + ' vol=' + initial.vol);
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'test-results', 'scenarioA-coherent.png') });

  // Drift → all feedback channels engage against the live stream
  await page.click('button.mode[data-mode=drop]');
  await page.waitForTimeout(12000);
  const drifted = await page.evaluate(() => {
    const a = window.__adapter, v = a._getVideoEl();
    return {
      clarity: FeedbackFilterEngine.getState().clarity,
      dim: parseFloat(a.getOverlayTarget().querySelector('.mfl-dim').style.opacity),
      vol: v.volume,
      amb: MediaFeedbackLayer.getState().ambientGainTarget,
      playing: !v.paused && v.currentTime > 0
    };
  });
  check('drift: clarity 0', drifted.clarity === 0, 'clarity=' + drifted.clarity);
  check('drift: dim overlay at MAX_DIM over live stream', Math.abs(drifted.dim - 0.78) < 0.001, 'dim=' + drifted.dim);
  check('drift: native volume ducked to MIN_VOL', Math.abs(drifted.vol - 0.15) < 0.001, 'vol=' + drifted.vol);
  check('drift: ambient bed at MAX_AMBIENT', Math.abs(drifted.amb - 0.35) < 0.001, 'amb=' + drifted.amb);
  check('drift: stream still playing (dim is overlay, not interruption)', drifted.playing);
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'test-results', 'scenarioA-drift.png') });

  // Recovery
  await page.click('button.mode[data-mode=climb]');
  await page.waitForTimeout(16000);
  const recovered = await page.evaluate(() => {
    const a = window.__adapter, v = a._getVideoEl();
    return { clarity: FeedbackFilterEngine.getState().clarity, vol: v.volume,
             dim: MediaFeedbackLayer.getState().dimOpacity };
  });
  check('recovery: clarity 1, dim cleared, volume restored',
    recovered.clarity === 1 && recovered.dim === 0 && recovered.vol === 1,
    'clarity=' + recovered.clarity + ' dim=' + recovered.dim + ' vol=' + recovered.vol);
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'test-results', 'scenarioA-recovered.png') });

  // Gate via adapter (deterministic clarity drive). Detach the live engine
  // first — its 1 Hz clarity-1 ticks would keep resetting the gate hold timer.
  await page.check('#chkGate');
  await page.evaluate(() => {
    MediaFeedbackLayer.attachEngine({ on: function () { return function () {}; } });
    window.__gd = setInterval(() => MediaFeedbackLayer.setClarity(0.05), 500);
  });
  await page.waitForTimeout(14000);
  const gated = await page.evaluate(() => ({
    paused: window.__adapter.isPaused(), gatePaused: MediaFeedbackLayer.getState().gatePaused
  }));
  check('gate: paused via adapter.pause()', gated.paused && gated.gatePaused, JSON.stringify(gated));
  await page.evaluate(() => { clearInterval(window.__gd); window.__gd = setInterval(() => MediaFeedbackLayer.setClarity(1), 500); });
  await page.waitForTimeout(6000);
  const ungated = await page.evaluate(() => {
    clearInterval(window.__gd);
    return { paused: window.__adapter.isPaused(), gatePaused: MediaFeedbackLayer.getState().gatePaused };
  });
  check('gate: resumed via adapter.play()', !ungated.paused && !ungated.gatePaused, JSON.stringify(ungated));

  // FINAL INVARIANTS
  const inv = await page.evaluate(() => ({
    mediaElementSourceCalls: window.__mediaElementSourceCalls,
    videoFilter: getComputedStyle(window.__adapter._getVideoEl()).filter
  }));
  check('INVARIANT: createMediaElementSource never called', inv.mediaElementSourceCalls === 0,
    'calls=' + inv.mediaElementSourceCalls);
  check('INVARIANT: no CSS filter on video element', inv.videoFilter === 'none', inv.videoFilter);

  await browser.close();
  console.log(failures ? failures + ' FAILURE(S)' : 'ALL SCENARIO A CHECKS PASSED');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
