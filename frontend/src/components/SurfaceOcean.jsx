import { useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// SurfaceOcean — Single continuous canvas: sky + horizon + water
// Weather = biofeedback. Capacity state → clouds + warmth + calm.
// Canvas NEVER restarts on prop changes. All refs, all smooth.
// Weather never storms. Depleted = overcast, never threatening.
// ═══════════════════════════════════════════════════════════════

const WEATHER = {
  full:         { clouds: 0.05, warm: 1.0,  calm: 1.0,  skyTint: [0,0,0],     waterDim: 0    },
  steady:       { clouds: 0.25, warm: 0.7,  calm: 0.75, skyTint: [0,0,0],     waterDim: 0    },
  drawing_down: { clouds: 0.60, warm: 0.4,  calm: 0.45, skyTint: [10,10,15],  waterDim: 0.1  },
  low:          { clouds: 0.82, warm: 0.18, calm: 0.25, skyTint: [20,15,25],  waterDim: 0.25 },
  depleted:     { clouds: 0.96, warm: 0.05, calm: 0.12, skyTint: [35,20,40],  waterDim: 0.45 },
};

function lunoC(t) { return [14+t*90, 50+t*170, 80+t*175]; }
function lunaC(t) { return [120+t*110, 60+t*100, 80+t*90]; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpC(a, b, t) { return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]; }

export default function SurfaceOcean({ coherence = 0.5, capState = 'steady', character = 'luno', sessionCount = 7 }) {
  const ref = useRef(null);
  const parts = useRef([]);
  const raf = useRef(null);
  const initd = useRef(false);
  const dyn = useRef({ coherence, capState, character, sessionCount });
  dyn.current = { coherence, capState, character, sessionCount };

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
    resize();
    window.addEventListener('resize', resize);

    // Init 70 plankton particles once — below waterline only
    const iW = w || 430, iH = h || 800;
    for (let i = 0; i < 70; i++) {
      parts.current.push({
        x: Math.random() * iW,
        y: iH * 0.44 + Math.random() * iH * 0.56,
        sz: 1.2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.07,
        ph: Math.random() * Math.PI * 2,
        ps: 0.003 + Math.random() * 0.006,
        isLuno: Math.random() < 0.55,
        dp: 0.3 + Math.random() * 0.7,
      });
    }

    // Smooth interpolation targets (never snap)
    let sClouds = 0.25, sWarm = 0.7, sCalm = 0.75, sDim = 0, sTint = [0, 0, 0];

    function draw() {
      if (!w || !h) { raf.current = requestAnimationFrame(draw); return; }
      const d = dyn.current;
      const wth = WEATHER[d.capState] || WEATHER.steady;
      const isL = d.character === 'luno';
      const co = d.coherence;
      const t = Date.now() * 0.001;

      // Smooth interpolate weather — 2% per frame (~2 second transitions)
      sClouds += (wth.clouds - sClouds) * 0.02;
      sWarm += (wth.warm - sWarm) * 0.02;
      sCalm += (wth.calm - sCalm) * 0.02;
      sDim += (wth.waterDim - sDim) * 0.02;
      sTint[0] += (wth.skyTint[0] - sTint[0]) * 0.02;
      sTint[1] += (wth.skyTint[1] - sTint[1]) * 0.02;
      sTint[2] += (wth.skyTint[2] - sTint[2]) * 0.02;

      ctx.clearRect(0, 0, w, h);
      const skyH = h * 0.44;

      // ── SKY ──
      const skyTop = lerpC([135-sTint[0], 206-sTint[1]*2, 250-sTint[2]], [140-sTint[0], 150-sTint[1], 165-sTint[2]], sClouds);
      const skyMid = lerpC([255, 218-sTint[1], 160-sTint[2]], [185-sTint[0], 180-sTint[1], 190-sTint[2]], sClouds);
      const skyBot = lerpC([255, 200-sTint[1], 140-sTint[2]], [170-sTint[0], 168-sTint[1], 178-sTint[2]], sClouds);
      const sg = ctx.createLinearGradient(0, 0, 0, skyH);
      sg.addColorStop(0, `rgb(${Math.max(0,skyTop[0])|0},${Math.max(0,skyTop[1])|0},${Math.max(0,skyTop[2])|0})`);
      sg.addColorStop(0.5, `rgb(${Math.max(0,skyMid[0])|0},${Math.max(0,skyMid[1])|0},${Math.max(0,skyMid[2])|0})`);
      sg.addColorStop(1, `rgb(${Math.max(0,skyBot[0])|0},${Math.max(0,skyBot[1])|0},${Math.max(0,skyBot[2])|0})`);
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, skyH);

      // ── SUN ──
      if (sWarm > 0.08) {
        const sx = w * 0.62, sy = skyH * 0.22, sr = 25 + sWarm * 30;
        const sunG = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.5);
        sunG.addColorStop(0, `rgba(255,242,205,${sWarm * 0.6})`);
        sunG.addColorStop(0.25, `rgba(255,225,165,${sWarm * 0.25})`);
        sunG.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = sunG; ctx.fillRect(0, 0, w, skyH);
        ctx.beginPath(); ctx.arc(sx, sy, sr * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,248,225,${sWarm * 0.7})`; ctx.fill();
      }

      // ── CLOUDS ──
      if (sClouds > 0.04) {
        const cn = Math.round(sClouds * 10);
        for (let i = 0; i < cn; i++) {
          const speed = 1.8 + ((i * 7 + 3) % 5) * 0.6;
          const baseY = skyH * (0.08 + ((i * 13 + 5) % 7) * 0.11);
          const cx = ((i * 127.3 + t * speed) % (w + 280)) - 140;
          const cy = baseY + Math.sin(t * 0.15 + i * 2.1) * 8;
          const cw = 65 + ((i * 17 + 11) % 6) * 30;
          const ch = 15 + ((i * 11 + 7) % 4) * 8;
          const a = Math.min(0.75, 0.2 + sClouds * 0.5);

          ctx.beginPath(); ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(230,234,240,${a})`; ctx.fill();
          ctx.beginPath(); ctx.ellipse(cx + cw * 0.3, cy - ch * 0.55, cw * 0.5, ch * 0.7, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(235,238,244,${a * 0.85})`; ctx.fill();
          ctx.beginPath(); ctx.ellipse(cx - cw * 0.25, cy - ch * 0.2, cw * 0.35, ch * 0.6, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(228,232,238,${a * 0.7})`; ctx.fill();
        }
      }

      // ── WATER SURFACE (wavy horizon) ──
      const wY = skyH;
      ctx.beginPath(); ctx.moveTo(0, wY);
      for (let x = 0; x <= w; x += 3) {
        const wH = 2 + (1 - sCalm) * 6;
        const freq1 = 0.016 + (0.004 * (1 - sCalm));
        ctx.lineTo(x, wY + Math.sin(x * freq1 + t * 0.6) * wH + Math.sin(x * 0.028 + t * 1.0) * wH * 0.35);
      }
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();

      const dimF = 1 - sDim;
      const wg = ctx.createLinearGradient(0, wY, 0, h);
      if (isL) {
        wg.addColorStop(0, `rgba(${(45*dimF)|0},${(185*dimF)|0},${(185*dimF)|0},${0.26+sWarm*0.16})`);
        wg.addColorStop(0.2, `rgba(${(18*dimF)|0},${(85*dimF)|0},${(115*dimF)|0},${0.46+sWarm*0.1})`);
        wg.addColorStop(0.55, `rgba(${(10*dimF)|0},${(45*dimF)|0},${(70*dimF)|0},0.82)`);
        wg.addColorStop(1, `rgba(${(4*dimF)|0},${(20*dimF)|0},${(40*dimF)|0},0.96)`);
      } else {
        wg.addColorStop(0, `rgba(${(145*dimF)|0},${(105*dimF)|0},${(125*dimF)|0},${0.2+sWarm*0.1})`);
        wg.addColorStop(0.2, `rgba(${(65*dimF)|0},${(38*dimF)|0},${(58*dimF)|0},${0.4+sWarm*0.1})`);
        wg.addColorStop(0.55, `rgba(${(32*dimF)|0},${(16*dimF)|0},${(30*dimF)|0},0.82)`);
        wg.addColorStop(1, `rgba(${(14*dimF)|0},${(7*dimF)|0},${(16*dimF)|0},0.96)`);
      }
      ctx.fillStyle = wg; ctx.fill();

      // ── LIGHT RAYS (underwater from surface) ──
      if (sWarm > 0.2) {
        const rc = Math.round(sWarm * 5);
        for (let i = 0; i < rc; i++) {
          const rx = w * (0.25 + i * 0.13) + Math.sin(t * 0.2 + i * 1.5) * 10;
          const rw = 5 + sWarm * 10;
          const rg = ctx.createLinearGradient(rx, wY, rx + 20, h * 0.7);
          rg.addColorStop(0, `rgba(255,232,175,${sWarm * 0.09})`);
          rg.addColorStop(1, 'rgba(255,232,175,0)');
          ctx.save(); ctx.beginPath();
          ctx.moveTo(rx - rw / 2, wY); ctx.lineTo(rx + rw * 1.3, h * 0.75); ctx.lineTo(rx + rw * 0.3, h * 0.75);
          ctx.closePath(); ctx.fillStyle = rg; ctx.fill(); ctx.restore();
        }
      }

      // ── PLANKTON (below waterline only) ──
      const visCount = Math.round(30 + co * 25 + Math.min(d.sessionCount / 80, 1) * 15);
      for (let i = 0; i < parts.current.length; i++) {
        const p = parts.current[i];
        p.ph += p.ps;
        p.x += p.vx + Math.sin(p.ph * 0.6) * 0.08;
        p.y += p.vy + Math.cos(p.ph * 0.4) * 0.04;
        if (p.x < -15) p.x = w + 15; if (p.x > w + 15) p.x = -15;
        if (p.y < wY + 8) p.y = h - 8; if (p.y > h + 10) p.y = wY + 15;
        if (i >= visCount) continue;

        const useL = isL ? p.isLuno : !p.isLuno;
        const col = useL ? lunoC(co) : lunaC(co * 0.75);
        const alpha = (0.12 + co * 0.46 + Math.sin(p.ph) * 0.14) * p.dp * (1 - sDim * 0.5);
        const sz = (p.sz + co * 2.5) * (0.5 + p.dp * 0.6);
        const glow = (3 + co * 12) * p.dp;

        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col[0]|0},${col[1]|0},${col[2]|0},${Math.max(0, alpha).toFixed(3)})`;
        if (glow > 1.5) {
          ctx.shadowColor = `rgba(${col[0]|0},${col[1]|0},${col[2]|0},${(alpha * 0.45).toFixed(3)})`;
          ctx.shadowBlur = glow;
        }
        ctx.fill(); ctx.shadowBlur = 0;
      }

      raf.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
