import { useState, useEffect, useRef } from 'react';
import DriftingWord from './DriftingWord';

// ═══════════════════════════════════════════════════════════════
// DescentAnimation — 10-second descent / 8-second ascent
// The descent IS the first exercise. Not a loading screen.
// "You descend past the world's light and discover you can
//  make your own."
// ═══════════════════════════════════════════════════════════════

const DESCENT_DURATION = 10000;
const ASCENT_DURATION = 8000;

// Luno depth zones (cool palette)
const DEPTH_ZONES = [
  { name: 'surface',   t: 0.0,  sky: [135,206,250], water: [45,185,185],  deep: [18,85,115],  sunStr: 1.0,  rayStr: 1.0,  planktonMul: 0.3 },
  { name: 'shallow',   t: 0.17, sky: [100,180,220], water: [30,160,170],  deep: [12,70,100],  sunStr: 0.7,  rayStr: 0.75, planktonMul: 0.45 },
  { name: 'upperBlue', t: 0.35, sky: [60,130,190],  water: [15,120,150],  deep: [8,55,85],    sunStr: 0.35, rayStr: 0.4,  planktonMul: 0.6 },
  { name: 'midBlue',   t: 0.55, sky: [30,70,130],   water: [8,60,100],    deep: [4,35,65],    sunStr: 0.1,  rayStr: 0.1,  planktonMul: 0.8 },
  { name: 'twilight',  t: 0.75, sky: [15,25,60],    water: [5,20,55],     deep: [3,12,35],    sunStr: 0.0,  rayStr: 0.0,  planktonMul: 0.95 },
  { name: 'midnight',  t: 1.0,  sky: [2,8,18],      water: [2,8,18],      deep: [2,8,18],     sunStr: 0.0,  rayStr: 0.0,  planktonMul: 1.0 },
];

// Luna depth zones (warm palette)
const DEPTH_ZONES_LUNA = [
  { name: 'surface',   t: 0.0,  sky: [220,180,190], water: [145,105,125], deep: [65,38,58],   sunStr: 1.0,  rayStr: 1.0,  planktonMul: 0.3 },
  { name: 'shallow',   t: 0.17, sky: [180,140,160], water: [120,80,100],  deep: [50,30,48],   sunStr: 0.7,  rayStr: 0.75, planktonMul: 0.45 },
  { name: 'upperBlue', t: 0.35, sky: [130,90,120],  water: [80,50,75],    deep: [35,20,38],   sunStr: 0.35, rayStr: 0.4,  planktonMul: 0.6 },
  { name: 'midBlue',   t: 0.55, sky: [70,40,65],    water: [40,20,40],    deep: [22,10,25],   sunStr: 0.1,  rayStr: 0.1,  planktonMul: 0.8 },
  { name: 'twilight',  t: 0.75, sky: [30,12,28],    water: [18,8,20],     deep: [10,4,12],    sunStr: 0.0,  rayStr: 0.0,  planktonMul: 0.95 },
  { name: 'midnight',  t: 1.0,  sky: [8,3,8],       water: [8,3,8],       deep: [8,3,8],      sunStr: 0.0,  rayStr: 0.0,  planktonMul: 1.0 },
];

const DRIFT_WORDS = [
  { t: 0.08, text: 'Breathe.', duration: 2500 },
  { t: 0.28, text: 'Deeper.', duration: 2500 },
  { t: 0.48, text: 'Safe here.', duration: 2800 },
  { t: 0.78, text: 'Your light.', duration: 3000 },
];

const ASCENT_WORDS = [
  { t: 0.2, text: 'Surfacing.', duration: 3000 },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpC(a, b, t) { return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]; }
function lunoC(t) { return [14+t*90, 50+t*170, 80+t*175]; }
function lunaC(t) { return [120+t*110, 60+t*100, 80+t*90]; }
function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

function getZoneValue(zones, progress, field) {
  let lo = zones[0], hi = zones[zones.length - 1];
  for (let i = 0; i < zones.length - 1; i++) {
    if (progress >= zones[i].t && progress <= zones[i + 1].t) {
      lo = zones[i]; hi = zones[i + 1]; break;
    }
  }
  const localT = (progress - lo.t) / (hi.t - lo.t || 1);
  const eased = easeInOut(Math.max(0, Math.min(1, localT)));
  if (Array.isArray(lo[field])) return lerpC(lo[field], hi[field], eased);
  return lerp(lo[field], hi[field], eased);
}

// ─── Descent Canvas (continuous, ref-based, never restarts) ───
function DescentCanvas({ progress, character = 'luno', coherence = 0.5 }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const parts = useRef([]);
  const initd = useRef(false);
  const dyn = useRef({ progress, character, coherence });
  dyn.current = { progress, character, coherence };

  useEffect(() => {
    if (initd.current) return;
    initd.current = true;
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let w, h;

    function resize() {
      w = c.offsetWidth; h = c.offsetHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize(); window.addEventListener('resize', resize);

    for (let i = 0; i < 90; i++) {
      parts.current.push({
        x: Math.random() * (w || 430), y: Math.random() * (h || 800),
        sz: 1 + Math.random() * 3.5, vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.06, ph: Math.random() * Math.PI * 2,
        ps: 0.003 + Math.random() * 0.005, isLuno: Math.random() < 0.55,
        dp: 0.2 + Math.random() * 0.8,
      });
    }

    function draw() {
      if (!w || !h) { raf.current = requestAnimationFrame(draw); return; }
      const d = dyn.current;
      const prog = d.progress;
      const isL = d.character === 'luno';
      const co = d.coherence;
      const zones = isL ? DEPTH_ZONES : DEPTH_ZONES_LUNA;
      const t = Date.now() * 0.001;

      ctx.clearRect(0, 0, w, h);

      const skyCol = getZoneValue(zones, prog, 'sky');
      const waterCol = getZoneValue(zones, prog, 'water');
      const deepCol = getZoneValue(zones, prog, 'deep');
      const sunStr = getZoneValue(zones, prog, 'sunStr');
      const rayStr = getZoneValue(zones, prog, 'rayStr');
      const planktonMul = getZoneValue(zones, prog, 'planktonMul');

      // Sky shrinks as we descend — scrolls up and disappears by ~second 4
      const skyH = h * Math.max(0, 0.44 * (1 - prog * 1.3));

      // ── SKY ──
      if (skyH > 2) {
        const sg = ctx.createLinearGradient(0, 0, 0, skyH);
        sg.addColorStop(0, `rgb(${skyCol[0]|0},${skyCol[1]|0},${skyCol[2]|0})`);
        const horizonCol = lerpC([255, 218, 160], [100, 100, 120], prog);
        sg.addColorStop(1, `rgb(${horizonCol[0]|0},${horizonCol[1]|0},${horizonCol[2]|0})`);
        ctx.fillStyle = sg; ctx.fillRect(0, 0, w, skyH);

        // Sun
        if (sunStr > 0.02) {
          const sx = w * 0.62, sy = skyH * 0.3, sr = 25 + sunStr * 28;
          const sunG = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
          sunG.addColorStop(0, `rgba(255,242,205,${sunStr * 0.6})`);
          sunG.addColorStop(0.3, `rgba(255,225,165,${sunStr * 0.25})`);
          sunG.addColorStop(1, 'rgba(255,200,120,0)');
          ctx.fillStyle = sunG; ctx.fillRect(0, 0, w, skyH);
          ctx.beginPath(); ctx.arc(sx, sy, sr * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,248,225,${sunStr * 0.7})`; ctx.fill();
        }

        // Clouds (fade with descent)
        const cloudOp = Math.max(0, 1 - prog * 2.5) * 0.5;
        if (cloudOp > 0.02) {
          for (let i = 0; i < 5; i++) {
            const cx = ((i * 127 + t * 2) % (w + 200)) - 100;
            const cy = skyH * (0.15 + (i % 3) * 0.2);
            ctx.beginPath();
            ctx.ellipse(cx, cy, 70 + i * 20, 16 + (i % 3) * 8, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(235,238,245,${cloudOp})`; ctx.fill();
          }
        }
      }

      // ── WATER ──
      const waterTop = Math.max(0, skyH);
      ctx.beginPath();
      const waveAmp = Math.max(0, 3 * (1 - prog * 1.5));
      if (waterTop > 0 && waveAmp > 0.1) {
        ctx.moveTo(0, waterTop);
        for (let x = 0; x <= w; x += 3) {
          ctx.lineTo(x, waterTop + Math.sin(x * 0.018 + t * 0.6) * waveAmp);
        }
      } else {
        ctx.moveTo(0, waterTop); ctx.lineTo(w, waterTop);
      }
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();

      const wg = ctx.createLinearGradient(0, waterTop, 0, h);
      wg.addColorStop(0, `rgb(${waterCol[0]|0},${waterCol[1]|0},${waterCol[2]|0})`);
      wg.addColorStop(0.5, `rgb(${deepCol[0]|0},${deepCol[1]|0},${deepCol[2]|0})`);
      wg.addColorStop(1, `rgb(${Math.max(0,deepCol[0]-5)|0},${Math.max(0,deepCol[1]-5)|0},${Math.max(0,deepCol[2]-5)|0})`);
      ctx.fillStyle = wg; ctx.fill();

      // ── LIGHT RAYS ──
      if (rayStr > 0.02) {
        const rayCount = Math.round(rayStr * 6);
        for (let i = 0; i < rayCount; i++) {
          const rx = w * (0.2 + i * 0.13) + Math.sin(t * 0.2 + i * 1.3) * 10;
          const rw = 5 + rayStr * 12;
          const rayLen = h * (0.3 + rayStr * 0.4);
          const rg = ctx.createLinearGradient(rx, waterTop, rx + 20, waterTop + rayLen);
          const rayColor = isL ? [255, 232, 175] : [240, 200, 190];
          rg.addColorStop(0, `rgba(${rayColor[0]},${rayColor[1]},${rayColor[2]},${rayStr * 0.12})`);
          rg.addColorStop(1, `rgba(${rayColor[0]},${rayColor[1]},${rayColor[2]},0)`);
          ctx.save(); ctx.beginPath();
          ctx.moveTo(rx - rw / 2, waterTop);
          ctx.lineTo(rx + rw * 1.2, waterTop + rayLen);
          ctx.lineTo(rx + rw * 0.3, waterTop + rayLen);
          ctx.closePath(); ctx.fillStyle = rg; ctx.fill(); ctx.restore();
        }
      }

      // ── PLANKTON ──
      const visCount = Math.round(planktonMul * 80);
      for (let i = 0; i < parts.current.length; i++) {
        const p = parts.current[i];
        p.ph += p.ps;
        p.x += p.vx + Math.sin(p.ph * 0.5) * 0.06;
        p.y += p.vy + Math.cos(p.ph * 0.3) * 0.03;
        if (p.x < -15) p.x = w + 15; if (p.x > w + 15) p.x = -15;
        if (p.y < waterTop + 5) p.y = h - 5; if (p.y > h + 10) p.y = waterTop + 10;
        if (i >= visCount) continue;

        const useL = isL ? p.isLuno : !p.isLuno;
        const col = useL ? lunoC(co) : lunaC(co * 0.75);
        const glowBoost = prog * 0.6;
        const alpha = (0.08 + co * 0.4 + glowBoost * 0.3 + Math.sin(p.ph) * 0.12) * p.dp;
        const sz = (p.sz + co * 2 + glowBoost * 1.5) * (0.5 + p.dp * 0.6);
        const glow = (2 + co * 10 + glowBoost * 10) * p.dp;

        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col[0]|0},${col[1]|0},${col[2]|0},${Math.max(0, alpha).toFixed(3)})`;
        if (glow > 1.5) {
          ctx.shadowColor = `rgba(${col[0]|0},${col[1]|0},${col[2]|0},${(alpha * 0.5).toFixed(3)})`;
          ctx.shadowBlur = glow;
        }
        ctx.fill(); ctx.shadowBlur = 0;
      }

      // ── LUNO GLOW (emerges as sole light source at depth) ──
      if (prog > 0.4) {
        const lunoStr = Math.max(0, (prog - 0.4) / 0.6);
        const lCol = isL ? lunoC(co) : lunaC(co);
        const cx = w / 2, cy = h * 0.72;
        const lr = 40 + lunoStr * 60 + co * 30;
        const lg = ctx.createRadialGradient(cx, cy, 0, cx, cy, lr);
        lg.addColorStop(0, `rgba(${lCol[0]|0},${lCol[1]|0},${lCol[2]|0},${lunoStr * 0.5})`);
        lg.addColorStop(0.4, `rgba(${lCol[0]|0},${lCol[1]|0},${lCol[2]|0},${lunoStr * 0.2})`);
        lg.addColorStop(1, `rgba(${lCol[0]|0},${lCol[1]|0},${lCol[2]|0},0)`);
        ctx.fillStyle = lg;
        ctx.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
      }

      raf.current = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener('resize', resize); if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

// ─── Luno Organism (glow-aware for descent) ───
function DescentLuno({ size = 60, coherence = 0.45, character = 'luno', glow = 1 }) {
  const c = coherence, isL = character === 'luno';
  const core = isL ? `rgba(${14+c*90},${50+c*170},${80+c*175},${(0.5+c*0.4)*glow})` : `rgba(${120+c*110},${60+c*100},${80+c*90},${(0.45+c*0.45)*glow})`;
  const mid = isL ? `rgba(${14+c*60},${50+c*120},${80+c*130},${(0.2+c*0.3)*glow})` : `rgba(${100+c*70},${50+c*65},${70+c*60},${(0.18+c*0.3)*glow})`;
  const outer = isL ? `rgba(${14+c*40},${50+c*70},${80+c*80},${(0.08+c*0.2)*glow})` : `rgba(${80+c*50},${40+c*45},${60+c*45},${(0.06+c*0.18)*glow})`;
  const gl = (4 + c * 16) * glow;
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', background: outer, boxShadow: `0 0 ${gl*2.5}px ${outer}` }} />
      <div style={{ position: 'absolute', width: size * 0.55, height: size * 0.55, borderRadius: '50%', background: mid, boxShadow: `0 0 ${gl*1.5}px ${mid}` }} />
      <div style={{ position: 'absolute', width: size * 0.2, height: size * 0.2, borderRadius: '50%', background: `radial-gradient(circle,${core},${mid})`, boxShadow: `0 0 ${gl}px ${core}` }} />
      <div style={{ position: 'absolute', width: 5, height: 5, borderRadius: '50%', background: '#fff', opacity: (0.25 + c * 0.6) * glow, boxShadow: `0 0 ${4+c*12}px rgba(255,255,255,${(0.2+c*0.5)*glow})` }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Export: DescentAnimation
// Props:
//   mode: 'descent' | 'ascent'
//   character: 'luno' | 'luna'
//   coherence: 0-1
//   ascentWeatherBoost: 0-1 (how much clearer the sky should be on return)
//   onComplete: () => void
// ═══════════════════════════════════════════════════════════════

export default function DescentAnimation({ mode = 'descent', character = 'luno', coherence = 0.5, ascentWeatherBoost = 0, onComplete }) {
  const [progress, setProgress] = useState(mode === 'descent' ? 0 : 1);
  const [activeWords, setActiveWords] = useState([]);
  const startTimeRef = useRef(null);
  const wordsFiredRef = useRef(new Set());
  const completedRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = Date.now();
    wordsFiredRef.current = new Set();
    completedRef.current = false;
    const duration = mode === 'descent' ? DESCENT_DURATION : ASCENT_DURATION;
    const words = mode === 'descent' ? DRIFT_WORDS : ASCENT_WORDS;

    function tick() {
      const elapsed = Date.now() - startTimeRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = easeInOut(t);

      setProgress(mode === 'descent' ? eased : 1 - eased);

      // Trigger drifting words
      for (const word of words) {
        if (t >= word.t && !wordsFiredRef.current.has(word.text)) {
          wordsFiredRef.current.add(word.text);
          // VOICE_HOOK: voice plays here when TTS available
          // For now: drifting word carries the load
          setActiveWords(prev => [...prev, { text: word.text, id: Date.now() }]);
          setTimeout(() => {
            setActiveWords(prev => prev.filter(w => w.text !== word.text));
          }, word.duration);
        }
      }

      if (t < 1) {
        requestAnimationFrame(tick);
      } else if (!completedRef.current) {
        completedRef.current = true;
        if (onComplete) onComplete();
      }
    }
    requestAnimationFrame(tick);
  }, [mode, onComplete]);

  const lunoGlow = mode === 'descent' ? 0.5 + progress * 1.5 : 0.5 + progress * 1.5;
  const lunoSize = 70 + progress * 30;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, overflow: 'hidden',
      fontFamily: "'Outfit', -apple-system, sans-serif", color: '#fff',
    }}>
      <DescentCanvas progress={progress} character={character} coherence={coherence} />

      {/* Luno grows and glows as we descend */}
      <div style={{
        position: 'absolute', zIndex: 10,
        left: '50%', top: '68%',
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.5s ease',
      }}>
        <DescentLuno size={lunoSize} coherence={coherence} character={character} glow={Math.min(2, lunoGlow)} />
      </div>

      {/* Drifting words */}
      {activeWords.map(w => (
        <DriftingWord key={w.id} text={w.text} />
      ))}

      {/* VOICE_HOOK: descent start voice plays here when TTS available */}
      {/* VOICE_HOOK: "Going deeper now." at progress ~0.05 */}
      {/* VOICE_HOOK: "You're here. Let's begin." at progress ~0.95 */}
    </div>
  );
}

export { DescentCanvas, DescentLuno };
