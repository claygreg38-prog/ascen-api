import { useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// OceanPatio — Kitchen Table visual world
// Golden hour patio overlooking the ocean. NOT the SurfaceOcean.
// Diamond tablecloth at 45°, candle with flickering flame,
// mug with steam, bread on plate, 3 empty place settings.
// Sky shifts by capacity state. Table is warm earth tones.
// ═══════════════════════════════════════════════════════════════

export default function OceanPatio({ coherence = 0.5, capState = 'steady', character = 'luno' }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const initd = useRef(false);
  const dyn = useRef({ coherence, capState, character });
  dyn.current = { coherence, capState, character };

  useEffect(() => {
    if (initd.current) return;
    initd.current = true;
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let w, h;

    function resize() {
      w = cv.offsetWidth; h = cv.offsetHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let sW = 0.7; // smooth warmth

    function draw() {
      if (!w || !h) { raf.current = requestAnimationFrame(draw); return; }
      const d = dyn.current;
      const isL = d.character === 'luno';
      const tw = d.capState === 'full' ? 1 : d.capState === 'steady' ? 0.75 : d.capState === 'drawing_down' ? 0.5 : 0.25;
      sW += (tw - sW) * 0.015;
      const t = Date.now() * 0.001;
      ctx.clearRect(0, 0, w, h);

      // ── SKY (top 38%) ──
      const skyH = h * 0.38;
      const sg = ctx.createLinearGradient(0, 0, 0, skyH);
      sg.addColorStop(0, `rgb(${140 + sW * 80 | 0},${162 + sW * 58 | 0},${202 + sW * 28 | 0})`);
      sg.addColorStop(0.45, `rgb(${232 + sW * 23 | 0},${182 + sW * 38 | 0},${132 + sW * 28 | 0})`);
      sg.addColorStop(0.88, `rgb(${252 + sW * 3 | 0},${196 + sW * 28 | 0},${142 + sW * 18 | 0})`);
      sg.addColorStop(1, `rgb(255,${188 + sW * 18 | 0},${122 + sW * 12 | 0})`);
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, skyH);

      // Sun
      if (sW > 0.12) {
        const sx = w * 0.30, sy = skyH * 0.76, sr = 30 + sW * 28;
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
        halo.addColorStop(0, `rgba(255,236,182,${sW * 0.3})`);
        halo.addColorStop(0.3, `rgba(255,212,142,${sW * 0.11})`);
        halo.addColorStop(1, 'rgba(255,182,102,0)');
        ctx.fillStyle = halo; ctx.fillRect(0, skyH * 0.3, w, skyH * 0.7);
        ctx.beginPath(); ctx.arc(sx, sy, sr * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,246,212,${sW * 0.6})`; ctx.fill();
      }

      // Clouds
      for (let i = 0; i < 3; i++) {
        const cx = ((i * 175 + t * 1.1) % (w + 260)) - 130;
        const cy = skyH * (0.16 + (i % 3) * 0.13);
        ctx.beginPath(); ctx.ellipse(cx, cy, 80 + i * 15, 7 + (i % 2) * 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,240,218,${sW * 0.17})`; ctx.fill();
      }

      // ── OCEAN (14%) ──
      const oTop = skyH, oH = h * 0.14;
      const og = ctx.createLinearGradient(0, oTop, 0, oTop + oH);
      if (isL) {
        og.addColorStop(0, `rgba(${62 + sW * 38 | 0},${142 + sW * 48 | 0},${172 + sW * 28 | 0},0.86)`);
        og.addColorStop(1, `rgba(${16 + sW * 8 | 0},${62 + sW * 18 | 0},${92 + sW * 12 | 0},1)`);
      } else {
        og.addColorStop(0, `rgba(${112 + sW * 28 | 0},${82 + sW * 22 | 0},${102 + sW * 18 | 0},0.86)`);
        og.addColorStop(1, `rgba(${42 + sW * 6 | 0},${24 + sW * 6 | 0},${36 + sW * 6 | 0},1)`);
      }
      ctx.beginPath(); ctx.moveTo(0, oTop);
      for (let x = 0; x <= w; x += 3) ctx.lineTo(x, oTop + Math.sin(x * 0.007 + t * 0.25) * 1.2 + Math.sin(x * 0.013 + t * 0.4) * 0.6);
      ctx.lineTo(w, oTop + oH); ctx.lineTo(0, oTop + oH); ctx.closePath();
      ctx.fillStyle = og; ctx.fill();

      // ── TABLE SURFACE (48%) ──
      const pTop = oTop + oH;
      const pH = h - pTop;
      const pg = ctx.createLinearGradient(0, pTop, 0, h);
      pg.addColorStop(0, `rgb(${52 + sW * 12 | 0},${42 + sW * 8 | 0},${34 + sW * 5 | 0})`);
      pg.addColorStop(0.18, `rgb(${44 + sW * 8 | 0},${36 + sW * 6 | 0},${28 + sW * 3 | 0})`);
      pg.addColorStop(1, `rgb(${28 + sW * 3 | 0},${24 + sW * 2 | 0},${20 + sW | 0})`);
      ctx.fillStyle = pg; ctx.fillRect(0, pTop, w, pH);
      // Railing
      ctx.beginPath(); ctx.moveTo(0, pTop); ctx.lineTo(w, pTop);
      ctx.strokeStyle = `rgba(88,72,56,${0.2 + sW * 0.1})`; ctx.lineWidth = 1.5; ctx.stroke();

      // ── DIAMOND TABLECLOTH ──
      const tCx = w * 0.50;
      const tCy = pTop + pH * 0.46;
      const dHalf = Math.min(w * 0.38, pH * 0.38);

      ctx.save();

      // Shadow
      ctx.fillStyle = `rgba(0,0,0,${0.04 + sW * 0.02})`;
      ctx.beginPath();
      ctx.moveTo(tCx + 3, tCy - dHalf * 0.92 + 3);
      ctx.lineTo(tCx + dHalf * 0.95 + 3, tCy + 3);
      ctx.lineTo(tCx + 3, tCy + dHalf * 0.95 + 3);
      ctx.lineTo(tCx - dHalf * 0.92 + 3, tCy + 3);
      ctx.closePath(); ctx.fill();

      // Cloth body
      const cg = ctx.createRadialGradient(tCx, tCy, 0, tCx, tCy, dHalf);
      cg.addColorStop(0, `rgba(${220 + sW * 14 | 0},${200 + sW * 10 | 0},${174 + sW * 6 | 0},0.9)`);
      cg.addColorStop(0.6, `rgba(${212 + sW * 12 | 0},${192 + sW * 8 | 0},${166 + sW * 5 | 0},0.87)`);
      cg.addColorStop(1, `rgba(${204 + sW * 10 | 0},${184 + sW * 7 | 0},${158 + sW * 4 | 0},0.84)`);
      ctx.beginPath();
      ctx.moveTo(tCx, tCy - dHalf * 0.92);
      ctx.lineTo(tCx + dHalf * 0.95, tCy);
      ctx.lineTo(tCx, tCy + dHalf * 0.95);
      ctx.lineTo(tCx - dHalf * 0.92, tCy);
      ctx.closePath();
      ctx.fillStyle = cg; ctx.fill();

      // Woven texture
      for (let i = 0; i < 9; i++) {
        const frac = (i + 1) / 10;
        ctx.beginPath();
        ctx.moveTo(tCx - dHalf * 0.92 * frac, tCy - dHalf * 0.92 * (1 - frac));
        ctx.lineTo(tCx + dHalf * 0.95 * (1 - frac), tCy + dHalf * 0.95 * frac);
        ctx.strokeStyle = `rgba(${190 + sW * 8 | 0},${170 + sW * 6 | 0},${144 + sW * 4 | 0},${0.04 + sW * 0.015})`;
        ctx.lineWidth = 0.3; ctx.stroke();
      }

      // Terracotta border trim
      const bIn = dHalf * 0.06;
      ctx.beginPath();
      ctx.moveTo(tCx, tCy - dHalf * 0.92 + bIn);
      ctx.lineTo(tCx + dHalf * 0.95 - bIn, tCy);
      ctx.lineTo(tCx, tCy + dHalf * 0.95 - bIn);
      ctx.lineTo(tCx - dHalf * 0.92 + bIn, tCy);
      ctx.closePath();
      ctx.strokeStyle = `rgba(${178 + sW * 10 | 0},${144 + sW * 6 | 0},${110 + sW * 4 | 0},${0.1 + sW * 0.05})`;
      ctx.lineWidth = 0.8; ctx.stroke();

      // Draping corners
      if (tCy - dHalf * 0.92 < pTop + 6) {
        const drapeG = ctx.createLinearGradient(tCx, pTop + 8, tCx, pTop - 12);
        drapeG.addColorStop(0, `rgba(${212 + sW * 12 | 0},${192 + sW * 8 | 0},${166 + sW * 5 | 0},0.7)`);
        drapeG.addColorStop(1, `rgba(${195 + sW * 8 | 0},${175 + sW * 6 | 0},${150 + sW * 3 | 0},0)`);
        ctx.beginPath();
        ctx.moveTo(tCx - dHalf * 0.2, pTop + 4);
        ctx.quadraticCurveTo(tCx, pTop - 14, tCx + dHalf * 0.2, pTop + 4);
        ctx.lineTo(tCx + dHalf * 0.15, pTop + 8);
        ctx.lineTo(tCx - dHalf * 0.15, pTop + 8);
        ctx.closePath();
        ctx.fillStyle = drapeG; ctx.fill();
      }
      if (tCy + dHalf * 0.95 > h - 10) {
        const drapeG2 = ctx.createLinearGradient(tCx, h - 8, tCx, h + 15);
        drapeG2.addColorStop(0, `rgba(${212 + sW * 12 | 0},${192 + sW * 8 | 0},${166 + sW * 5 | 0},0.6)`);
        drapeG2.addColorStop(1, `rgba(${195 + sW * 8 | 0},${175 + sW * 6 | 0},${150 + sW * 3 | 0},0)`);
        ctx.beginPath();
        ctx.moveTo(tCx - dHalf * 0.22, h - 2);
        ctx.quadraticCurveTo(tCx, h + 16, tCx + dHalf * 0.22, h - 2);
        ctx.fillStyle = drapeG2; ctx.fill();
      }

      // ── CANDLE ──
      const cdX = tCx, cdY = tCy - dHalf * 0.12;
      ctx.beginPath(); ctx.ellipse(cdX, cdY + 22, 16, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${165 + sW * 10 | 0},${150 + sW * 7 | 0},${130 + sW * 4 | 0},0.6)`; ctx.fill();
      ctx.fillStyle = `rgba(${230 + sW * 10 | 0},${220 + sW * 7 | 0},${202 + sW * 4 | 0},0.9)`;
      ctx.beginPath(); ctx.moveTo(cdX - 7, cdY + 20); ctx.lineTo(cdX - 6, cdY - 12); ctx.lineTo(cdX + 6, cdY - 12); ctx.lineTo(cdX + 7, cdY + 20); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cdX, cdY - 12, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${238 + sW * 8 | 0},${230 + sW * 5 | 0},${216 + sW * 3 | 0},0.85)`; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cdX, cdY - 12); ctx.lineTo(cdX, cdY - 20);
      ctx.strokeStyle = 'rgba(75,55,35,0.45)'; ctx.lineWidth = 0.8; ctx.stroke();
      // Flame
      const flk = Math.sin(t * 4.3) * 0.7 + Math.sin(t * 7) * 0.35 + Math.sin(t * 11.5) * 0.15;
      ctx.beginPath();
      ctx.moveTo(cdX + flk * 0.3, cdY - 30);
      ctx.quadraticCurveTo(cdX + 5 + flk * 0.2, cdY - 22, cdX + 3.5, cdY - 15);
      ctx.quadraticCurveTo(cdX, cdY - 13, cdX - 3.5, cdY - 15);
      ctx.quadraticCurveTo(cdX - 5 + flk * 0.15, cdY - 22, cdX + flk * 0.3, cdY - 30);
      const flG = ctx.createLinearGradient(cdX, cdY - 30, cdX, cdY - 14);
      flG.addColorStop(0, `rgba(255,245,190,${0.5 + sW * 0.18})`);
      flG.addColorStop(0.4, `rgba(255,215,110,${0.55 + sW * 0.15})`);
      flG.addColorStop(0.8, `rgba(255,175,55,${0.4 + sW * 0.1})`);
      flG.addColorStop(1, `rgba(255,140,30,${0.15 + sW * 0.05})`);
      ctx.fillStyle = flG; ctx.fill();
      // Glow
      const cgG = ctx.createRadialGradient(cdX, cdY - 8, 0, cdX, cdY - 8, 55);
      cgG.addColorStop(0, `rgba(255,225,155,${0.035 + sW * 0.015})`);
      cgG.addColorStop(1, 'rgba(255,225,155,0)');
      ctx.fillStyle = cgG; ctx.fillRect(cdX - 55, cdY - 50, 110, 90);

      // ── MUG ──
      const mX = tCx + dHalf * 0.3, mY = tCy + dHalf * 0.35;
      ctx.fillStyle = `rgba(${148 + sW * 16 | 0},${118 + sW * 10 | 0},${88 + sW * 6 | 0},0.82)`;
      ctx.beginPath(); ctx.moveTo(mX - 10, mY); ctx.lineTo(mX - 9, mY + 24); ctx.quadraticCurveTo(mX, mY + 27, mX + 9, mY + 24); ctx.lineTo(mX + 10, mY); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mX, mY, 10, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${155 + sW * 16 | 0},${125 + sW * 10 | 0},${95 + sW * 6 | 0},0.85)`; ctx.fill();
      ctx.beginPath(); ctx.ellipse(mX, mY + 2, 7, 2.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${75 + sW * 6 | 0},${52 + sW * 4 | 0},${32 + sW * 2 | 0},0.35)`; ctx.fill();
      ctx.beginPath(); ctx.arc(mX + 13, mY + 12, 7, -0.5 * Math.PI, 0.5 * Math.PI);
      ctx.strokeStyle = `rgba(${145 + sW * 14 | 0},${115 + sW * 8 | 0},${85 + sW * 5 | 0},0.6)`; ctx.lineWidth = 2.5; ctx.stroke();
      // Steam
      for (let i = 0; i < 3; i++) {
        const sx = mX - 3 + i * 3 + Math.sin(t + i * 1.6) * 2;
        const sy = mY - 5 - i * 6 + Math.sin(t * 0.65 + i) * 1.5;
        ctx.beginPath(); ctx.moveTo(sx, mY - 2);
        ctx.quadraticCurveTo(sx + Math.sin(t * 0.8 + i) * 2.5, sy, sx + Math.sin(t * 0.5 + i) * 1.5, sy - 4);
        ctx.strokeStyle = `rgba(222,218,208,${0.055 - 0.01 * i})`; ctx.lineWidth = 0.5; ctx.stroke();
      }

      // ── PLATE WITH BREAD ──
      const plX = tCx - dHalf * 0.28, plY = tCy + dHalf * 0.08;
      ctx.beginPath(); ctx.ellipse(plX, plY, 18, 7, -0.05, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${222 + sW * 8 | 0},${218 + sW * 6 | 0},${208 + sW * 4 | 0},0.7)`; ctx.fill();
      ctx.beginPath(); ctx.ellipse(plX + 1, plY - 4, 6, 4.5, 0.1, 0, Math.PI * 2);
      const brG = ctx.createRadialGradient(plX, plY - 5, 0, plX + 1, plY - 4, 6);
      brG.addColorStop(0, `rgba(${216 + sW * 12 | 0},${178 + sW * 8 | 0},${112 + sW * 5 | 0},0.8)`);
      brG.addColorStop(1, `rgba(${195 + sW * 8 | 0},${158 + sW * 5 | 0},${92 + sW * 3 | 0},0.65)`);
      ctx.fillStyle = brG; ctx.fill();

      // ── THREE PLACE SETTINGS ──
      const settings = [
        { x: tCx, y: pTop + pH * 0.12, r: -0.0 },
        { x: w * 0.08, y: tCy + pH * 0.05, r: -0.15 },
        { x: w * 0.92, y: tCy - pH * 0.02, r: 0.12 },
      ];
      for (const s of settings) {
        ctx.beginPath(); ctx.ellipse(s.x, s.y, 14, 5.5, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${195 + sW * 6 | 0},${190 + sW * 4 | 0},${180 + sW * 3 | 0},0.22)`; ctx.fill();
        ctx.beginPath(); ctx.ellipse(s.x, s.y, 10, 3.8, s.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${180 + sW * 5 | 0},${175 + sW * 3 | 0},${165 + sW * 2 | 0},0.1)`; ctx.lineWidth = 0.3; ctx.stroke();
      }

      ctx.restore();
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
