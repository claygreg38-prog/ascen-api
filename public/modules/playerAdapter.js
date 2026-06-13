/* ============================================================================
   PartnerPlayer — PlayerAdapter for partner content (Port 3, ContentDelivery)
   ----------------------------------------------------------------------------
   Scenario A (host-and-pull): partner content (Hopefull via Lightcast) plays in
   ASCEN'S OWN <video> element via hls.js. The MediaFeedbackLayer talks ONLY
   through this adapter interface:
       { mount(container), play(), pause(), setVolume(0-1),
         getOverlayTarget() → DOMElement, isPaused(), destroy() }

   GO-LIVE = CONFIG SWAP ONLY: set STREAM_URL to the Lightcast m3u8 (plus auth
   via hlsConfig.xhrSetup if Lightcast signs requests) and flip
   ENABLE_PARTNER_FEEDBACK to true. No code changes.

   INVARIANTS (Rev 2/3.1 — enforced by tests):
   - Volume duck via native video.volume ONLY. NEVER a
     MediaElementAudioSourceNode on this element.
   - NEVER CSS/WebGL filters on the video element. Visual feedback mounts as
     overlays in getOverlayTarget(), composited ABOVE the video.

   hls.js (vendored: public/vendor/hls.min.js, v1.6.16): loadSource → attachMedia,
   MANIFEST_PARSED to resolve, ERROR with fatal recovery (network → startLoad,
   media → recoverMediaError), destroy() on teardown. Safari plays natively via
   canPlayType('application/vnd.apple.mpegurl').
   ============================================================================ */
var PartnerPlayer = (function () {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────────────────────
  var CONFIG = {
    // Master switch. STAYS false in production until Lightcast go-live.
    ENABLE_PARTNER_FEEDBACK: false,
    // Public test stream (Mux HLS test asset). Swap for the Lightcast m3u8.
    STREAM_URL: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    // Passed to `new Hls(...)`. Lightcast auth goes here at go-live, e.g.
    //   xhrSetup: function (xhr) { xhr.setRequestHeader('Authorization', ...); }
    hlsConfig: {},
    MAX_FATAL_RETRIES: 3
  };

  function configure(opts) {
    opts = opts || {};
    for (var k in CONFIG) { if (Object.prototype.hasOwnProperty.call(opts, k)) CONFIG[k] = opts[k]; }
  }
  function isEnabled() { return CONFIG.ENABLE_PARTNER_FEEDBACK === true; }

  // ── SCENARIO A ADAPTER ─────────────────────────────────────────────────────
  function createScenarioAAdapter(opts) {
    if (!isEnabled()) {
      console.log('[PPA] ENABLE_PARTNER_FEEDBACK=false — adapter not created');
      return null;
    }
    opts = opts || {};
    var streamUrl = opts.streamUrl || CONFIG.STREAM_URL;

    var _wrap = null, _video = null, _hls = null;
    var _fatalRetries = 0, _mode = null; // 'hls.js' | 'native'

    function mount(container) {
      if (!container) return Promise.reject(new Error('[PPA] mount: container required'));
      _wrap = document.createElement('div');
      _wrap.className = 'ppa-wrap';
      _wrap.style.cssText = 'position:relative;width:100%;height:100%;background:#000;overflow:hidden;';
      _video = document.createElement('video');
      _video.setAttribute('playsinline', '');
      _video.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;';
      // No controls — playback is orchestrated (Port 3); the session UI decides.
      _wrap.appendChild(_video);
      container.appendChild(_wrap);

      return new Promise(function (resolve, reject) {
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
          _mode = 'hls.js';
          _hls = new Hls(CONFIG.hlsConfig);
          _hls.on(Hls.Events.MANIFEST_PARSED, function (e, data) {
            console.log('[PPA] manifest parsed —', data.levels.length, 'quality level(s) | mode: hls.js');
            resolve({ mode: _mode, levels: data.levels.length });
          });
          _hls.on(Hls.Events.ERROR, function (e, data) {
            if (!data.fatal) return;
            console.warn('[PPA] fatal hls error:', data.type, data.details);
            if (_fatalRetries >= CONFIG.MAX_FATAL_RETRIES) {
              console.error('[PPA] retry budget exhausted — destroying');
              destroy();
              reject(new Error('hls fatal: ' + data.details));
              return;
            }
            _fatalRetries++;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) _hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) _hls.recoverMediaError();
            else { destroy(); reject(new Error('hls fatal: ' + data.details)); }
          });
          _hls.loadSource(streamUrl);
          _hls.attachMedia(_video);
        } else if (_video.canPlayType('application/vnd.apple.mpegurl')) {
          _mode = 'native';
          _video.addEventListener('loadedmetadata', function onMeta() {
            _video.removeEventListener('loadedmetadata', onMeta);
            console.log('[PPA] metadata loaded | mode: native HLS');
            resolve({ mode: _mode, levels: 1 });
          });
          _video.addEventListener('error', function () {
            reject(new Error('native HLS load failed'));
          });
          _video.src = streamUrl;
        } else {
          reject(new Error('[PPA] no HLS support (hls.js missing and no native HLS)'));
        }
      });
    }

    function destroy() {
      if (_hls) { try { _hls.destroy(); } catch (e) {} _hls = null; }
      if (_video) { try { _video.pause(); _video.removeAttribute('src'); _video.load(); } catch (e) {} }
      if (_wrap && _wrap.parentNode) _wrap.parentNode.removeChild(_wrap);
      _wrap = null; _video = null; _mode = null;
    }

    return {
      mount: mount,
      play: function () { return _video ? _video.play() : Promise.reject(new Error('not mounted')); },
      pause: function () { if (_video) _video.pause(); },
      // Native element volume ONLY — the DRM-safe duck path.
      setVolume: function (v) { if (_video) _video.volume = Math.max(0, Math.min(1, v)); },
      getOverlayTarget: function () { return _wrap; },
      isPaused: function () { return _video ? _video.paused : true; },
      destroy: destroy,
      // diagnostics (harness/tests)
      _getVideoEl: function () { return _video; },
      _getMode: function () { return _mode; }
    };
  }

  return {
    configure: configure,
    isEnabled: isEnabled,
    create: createScenarioAAdapter,
    getConfig: function () { return CONFIG; }
  };
})();
if (typeof window !== 'undefined') window.PartnerPlayer = PartnerPlayer;
