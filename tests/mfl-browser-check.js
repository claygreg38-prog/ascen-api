/* Browser check for MediaFeedbackLayer via the harness page.
   Run: node tests/mfl-browser-check.js
   Drives the REAL harness: start session → drift drop → assert dim overlay
   rises + adapter volume ducks + ambient gain target rises; then coherent
   climb → assert recovery. Screenshots before/after into test-results/. */
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
  page.on('console', m => { if (m.type() === 'error') console.log('  [page error]', m.text()); });

  const url = 'file:///' + path.join(__dirname, 'harness', 'mediaFeedback.harness.html').replace(/\\/g, '/');
  await page.goto(url);

  // Self-contained test content: drive the <video> from a canvas captureStream
  // so the check has zero network dependency (remote sample may not load headless).
  await page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 640; cv.height = 360;
    const cx = cv.getContext('2d');
    let h = 0;
    (function paint() {
      h = (h + 1) % 360;
      const g = cx.createLinearGradient(0, 0, 640, 360);
      g.addColorStop(0, 'hsl(' + h + ',60%,40%)');
      g.addColorStop(1, 'hsl(' + ((h + 120) % 360) + ',60%,25%)');
      cx.fillStyle = g; cx.fillRect(0, 0, 640, 360);
      cx.fillStyle = '#fff'; cx.font = '28px monospace';
      cx.fillText('TEST CONTENT ' + h, 40, 180);
      requestAnimationFrame(paint);
    })();
    const v = document.getElementById('testVideo');
    v.removeAttribute('src');
    v.srcObject = cv.captureStream(24);
  });

  await page.click('#btnStart');
  await page.waitForTimeout(2500);

  const initial = await page.evaluate(() => ({
    mfl: MediaFeedbackLayer.getState(),
    ffe: FeedbackFilterEngine.getState(),
    vol: document.getElementById('testVideo').volume,
    overlays: {
      dim: !!document.querySelector('#playerBox .mfl-dim'),
      grain: !!document.querySelector('#playerBox .mfl-grain')
    },
    videoFilter: getComputedStyle(document.getElementById('testVideo')).filter
  }));
  check('overlay elements mounted above video', initial.overlays.dim && initial.overlays.grain);
  check('HARD CONSTRAINT: no CSS filter on video element', initial.videoFilter === 'none', initial.videoFilter);
  check('audio bed initialized', initial.mfl.audioReady === true);
  check('at baseline: clarity 1, no dim', initial.ffe.clarity === 1 && initial.mfl.dimOpacity === 0,
    'clarity=' + initial.ffe.clarity + ' dim=' + initial.mfl.dimOpacity);
  check('at baseline: full partner volume', initial.vol === 1, 'vol=' + initial.vol);
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'test-results', 'mfl-coherent.png') });

  // Drift: coherence falls 0.03-0.05/tick from 0.25 → deep drift within ~8 ticks
  await page.click('button.mode[data-mode=drop]');
  await page.waitForTimeout(12000);

  const drifted = await page.evaluate(() => ({
    mfl: MediaFeedbackLayer.getState(),
    ffe: FeedbackFilterEngine.getState(),
    vol: document.getElementById('testVideo').volume,
    dimCss: parseFloat(document.querySelector('#playerBox .mfl-dim').style.opacity)
  }));
  check('drift: clarity fell to 0', drifted.ffe.clarity === 0, 'clarity=' + drifted.ffe.clarity);
  check('drift: dim overlay at MAX_DIM', Math.abs(drifted.dimCss - 0.78) < 0.001, 'dim=' + drifted.dimCss);
  check('drift: partner volume ducked to MIN_VOL via adapter', Math.abs(drifted.vol - 0.15) < 0.001, 'vol=' + drifted.vol);
  check('drift: ambient bed gain target at MAX_AMBIENT', Math.abs(drifted.mfl.ambientGainTarget - 0.35) < 0.001,
    'amb=' + drifted.mfl.ambientGainTarget);
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'test-results', 'mfl-drift.png') });

  // Recovery
  await page.click('button.mode[data-mode=climb]');
  await page.waitForTimeout(16000);
  const recovered = await page.evaluate(() => ({
    mfl: MediaFeedbackLayer.getState(),
    ffe: FeedbackFilterEngine.getState(),
    vol: document.getElementById('testVideo').volume
  }));
  check('recovery: clarity back to 1', recovered.ffe.clarity === 1, 'clarity=' + recovered.ffe.clarity);
  check('recovery: dim cleared + volume restored', recovered.mfl.dimOpacity === 0 && recovered.vol === 1,
    'dim=' + recovered.mfl.dimOpacity + ' vol=' + recovered.vol);
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'test-results', 'mfl-recovered.png') });

  // Gate: deterministic drive — stop the synthetic ticker and feed clarity
  // directly so the 12s-hold / 3s-resume windows are exact, not driver-dependent.
  await page.click('#btnStop');
  await page.check('#chkGate');
  await page.evaluate(() => {
    document.getElementById('testVideo').play();
    window.__gateDrive = setInterval(() => MediaFeedbackLayer.setClarity(0.05), 500);
  });
  await page.waitForTimeout(14000); // GATE_HOLD_S = 12
  const gated = await page.evaluate(() => ({
    paused: document.getElementById('testVideo').paused,
    gatePaused: MediaFeedbackLayer.getState().gatePaused,
    readyState: document.getElementById('testVideo').readyState
  }));
  check('gate: sustained low clarity paused playback via player API',
    gated.paused && gated.gatePaused, JSON.stringify(gated));

  await page.evaluate(() => {
    clearInterval(window.__gateDrive);
    window.__gateDrive = setInterval(() => MediaFeedbackLayer.setClarity(1), 500);
  });
  await page.waitForTimeout(6000); // GATE_RESUME_S = 3
  const ungated = await page.evaluate(() => {
    clearInterval(window.__gateDrive);
    return {
      paused: document.getElementById('testVideo').paused,
      gatePaused: MediaFeedbackLayer.getState().gatePaused
    };
  });
  check('gate: recovery resumed playback', !ungated.paused && !ungated.gatePaused, JSON.stringify(ungated));

  await browser.close();
  console.log(failures ? failures + ' FAILURE(S)' : 'ALL BROWSER CHECKS PASSED');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
