import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { connectDevice, isBleSupported } from '../services/ble';

// ═══════════════════════════════════════════════════════════════
// WearableSyncScreen — BLE Wearable Connection
// Pre-session wearable sync with ocean depth color progression.
// Reuses deployed ble.js service (Polar H10 + Kyto2935).
// ═══════════════════════════════════════════════════════════════

const OCEAN = {
  scanning:  { top: [120,210,220], mid: [80,190,200], bot: [55,160,175], ring: 'rgba(140,230,225,', label: 'Shallow Waters', func: 'Searching' },
  found:     { top: [45,145,165],  mid: [30,120,145], bot: [20,95,120],  ring: 'rgba(78,205,196,',  label: 'The Lagoon',      func: 'Device Found' },
  connected: { top: [18,90,115],   mid: [12,70,95],   bot: [8,55,78],    ring: 'rgba(74,222,128,',  label: 'Coral Reef',      func: 'Connected' },
  failed:    { top: [35,50,68],    mid: [25,38,55],    bot: [18,28,42],   ring: 'rgba(140,150,165,', label: 'Deep Water',      func: 'No Device' },
};

// ── OCEAN CANVAS ──────────────────────────────────────────────

function OceanCanvas({ state, hr }) {
  const ref = useRef(null);
  const rafRef = useRef(null);
  const dynRef = useRef({ state, hr });
  dynRef.current = { state, hr };
  const reducedMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let w, h;
    let cTop = [...OCEAN.scanning.top], cMid = [...OCEAN.scanning.mid], cBot = [...OCEAN.scanning.bot];

    function resize() {
      w = cv.offsetWidth; h = cv.offsetHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }
      const t = Date.now() * 0.001;
      const d = dynRef.current;
      const oc = OCEAN[d.state] || OCEAN.scanning;
      const rm = reducedMotion.current;

      // Lerp colors
      for (let i = 0; i < 3; i++) {
        cTop[i] += (oc.top[i] - cTop[i]) * 0.02;
        cMid[i] += (oc.mid[i] - cMid[i]) * 0.02;
        cBot[i] += (oc.bot[i] - cBot[i]) * 0.02;
      }
      ctx.clearRect(0, 0, w, h);

      // Ocean gradient
      const sg = ctx.createLinearGradient(0, 0, 0, h);
      sg.addColorStop(0, `rgb(${cTop[0]|0},${cTop[1]|0},${cTop[2]|0})`);
      sg.addColorStop(0.45, `rgb(${cMid[0]|0},${cMid[1]|0},${cMid[2]|0})`);
      sg.addColorStop(1, `rgb(${cBot[0]|0},${cBot[1]|0},${cBot[2]|0})`);
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);

      // Light rays
      const rayAlpha = d.state === 'scanning' ? 0.08 : d.state === 'found' ? 0.05 : d.state === 'connected' ? 0.03 : 0.01;
      if (!rm) {
        for (let i = 0; i < 5; i++) {
          const rx = w * (0.15 + i * 0.18) + Math.sin(t * 0.15 + i * 1.2) * 15;
          ctx.beginPath();
          ctx.moveTo(rx - 8, 0); ctx.lineTo(rx - 25, h * 0.7); ctx.lineTo(rx + 25, h * 0.7); ctx.lineTo(rx + 8, 0);
          ctx.closePath();
          const rg = ctx.createLinearGradient(rx, 0, rx, h * 0.7);
          rg.addColorStop(0, `rgba(200,240,235,${rayAlpha})`);
          rg.addColorStop(1, 'rgba(200,240,235,0)');
          ctx.fillStyle = rg; ctx.fill();
        }
      }

      // Fish (reduced count for budget devices)
      const fishCount = rm ? 2 : (d.state === 'connected' ? 7 : d.state === 'scanning' ? 5 : d.state === 'found' ? 4 : 2);
      const fishSpeed = d.state === 'scanning' ? 25 : d.state === 'found' ? 18 : d.state === 'connected' ? 15 : 8;
      const fishSize = d.state === 'scanning' ? 8 : d.state === 'connected' ? 12 : 10;

      for (let i = 0; i < fishCount; i++) {
        const seed = i * 73.7;
        const dir = i % 2 === 0 ? 1 : -1;
        const sz = fishSize + Math.sin(seed) * 3;
        const swimY = h * (0.25 + ((seed * 0.37) % 1) * 0.55);
        const wobbleY = Math.sin(t * 1.2 + seed) * 8;
        const swimX = dir > 0
          ? ((t * fishSpeed + seed * 13) % (w + sz * 8)) - sz * 4
          : w + sz * 4 - ((t * fishSpeed + seed * 13) % (w + sz * 8));
        const alpha = d.state === 'failed' ? 0.06 : d.state === 'connected' ? 0.2 : 0.15;

        ctx.save();
        ctx.translate(swimX, swimY + wobbleY);
        ctx.scale(dir, 1);
        // Body
        ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,210,225,${alpha})`; ctx.fill();
        // Tail
        ctx.beginPath(); ctx.moveTo(-sz * 0.8, 0); ctx.lineTo(-sz * 1.4, -sz * 0.35); ctx.lineTo(-sz * 1.4, sz * 0.35); ctx.closePath();
        ctx.fillStyle = `rgba(180,210,225,${alpha * 0.8})`; ctx.fill();
        // Eye
        if (d.state !== 'failed') {
          ctx.beginPath(); ctx.arc(sz * 0.5, -sz * 0.05, sz * 0.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha * 1.5})`; ctx.fill();
        }
        // Stripe (connected reef fish)
        if (d.state === 'connected' && i % 2 === 0) {
          ctx.beginPath(); ctx.moveTo(sz * 0.1, -sz * 0.35); ctx.lineTo(sz * 0.1, sz * 0.35);
          ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
      }

      // Coral (connected only, skip if reduced motion)
      if (d.state === 'connected' && !rm) {
        const coralY = h * 0.88;
        for (let i = 0; i < 6; i++) {
          const cx2 = w * (0.08 + i * 0.17);
          const ch = 20 + Math.sin(i * 2.8) * 12;
          ctx.beginPath();
          ctx.moveTo(cx2, coralY);
          ctx.quadraticCurveTo(cx2 - 6 + Math.sin(t * 0.3 + i) * 2, coralY - ch * 0.6, cx2 - 3, coralY - ch);
          ctx.strokeStyle = `rgba(255,130,100,${0.08 + Math.sin(i * 1.5) * 0.03})`;
          ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
        }
      }

      // Sandy floor (scanning only)
      if (d.state === 'scanning') {
        const sandY = h * 0.9;
        const sandG = ctx.createLinearGradient(0, sandY, 0, h);
        sandG.addColorStop(0, `rgba(${cBot[0]+30|0},${cBot[1]+20|0},${cBot[2]+15|0},0.3)`);
        sandG.addColorStop(1, `rgba(${cBot[0]+15|0},${cBot[1]+10|0},${cBot[2]+5|0},0.5)`);
        ctx.beginPath(); ctx.moveTo(0, sandY);
        for (let x = 0; x <= w; x += 3) ctx.lineTo(x, sandY + Math.sin(x * 0.02 + t * 0.3) * 2);
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = sandG; ctx.fill();
      }

      // Sync ring
      const cx3 = w / 2, cy3 = h * 0.38;
      const baseR = Math.min(w, h) * 0.22;

      if (d.state === 'scanning') {
        for (let i = 0; i < 3; i++) {
          const phase = ((t * 0.7 + i * 0.33) % 1);
          const ringR = baseR * 0.5 + phase * baseR * 0.8;
          ctx.beginPath(); ctx.arc(cx3, cy3, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = oc.ring + `${(1 - phase) * 0.25})`; ctx.lineWidth = 2.5; ctx.stroke();
        }
      } else if (d.state === 'found') {
        const bright = 0.45 + Math.sin(t * 1.8) * 0.15;
        ctx.beginPath(); ctx.arc(cx3, cy3, baseR * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = oc.ring + `${bright})`; ctx.lineWidth = 3; ctx.stroke();
      } else if (d.state === 'connected') {
        const bps = d.hr > 0 ? 60 / d.hr : 1;
        const beatPhase = (t % bps) / bps;
        const beatScale = 1 + Math.max(0, Math.sin(beatPhase * Math.PI * 2)) * 0.05;
        ctx.beginPath(); ctx.arc(cx3, cy3, baseR * 0.7 * beatScale, 0, Math.PI * 2);
        ctx.strokeStyle = oc.ring + '0.55)'; ctx.lineWidth = 3; ctx.stroke();
        // Coral glow on beat
        const beatGlow = Math.max(0, Math.sin(beatPhase * Math.PI * 2));
        const glow = ctx.createRadialGradient(cx3, cy3, 0, cx3, cy3, baseR * 0.7 * 1.3);
        glow.addColorStop(0, `rgba(255,150,120,${beatGlow * 0.06})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx3 - baseR, cy3 - baseR, baseR * 2, baseR * 2);
      } else {
        ctx.beginPath(); ctx.arc(cx3, cy3, baseR * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = oc.ring + '0.12)'; ctx.lineWidth = 2; ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

// ── MEMBER SYNC ROW (group mode) ──────────────────────────────

function MemberRow({ name, role, state, deviceName, hr }) {
  const dotColor = state === 'connected' ? '#4ADE80' : state === 'found' ? '#4ECDC4' : state === 'scanning' ? 'rgba(140,230,225,0.5)' : 'rgba(120,135,155,0.3)';
  const statusText = state === 'connected' ? `${deviceName} \u00B7 ${hr} BPM`
    : state === 'found' ? `${deviceName} found...`
    : state === 'scanning' ? 'Scanning...' : 'No device';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      background: state === 'connected' ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${state === 'connected' ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 14, marginBottom: 8,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%', background: dotColor,
        boxShadow: state === 'connected' ? `0 0 8px ${dotColor}66` : 'none',
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(220,235,240,0.85)' }}>{name}</div>
        <div style={{ fontSize: 9, color: 'rgba(180,210,220,0.4)' }}>{role}</div>
      </div>
      <div style={{ fontSize: 10, color: state === 'connected' ? 'rgba(74,222,128,0.75)' : 'rgba(180,195,210,0.35)' }}>
        {statusText}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────

export default function WearableSyncScreen() {
  const nav = useNavigate();
  const location = useLocation();
  const mode = location.state?.mode || 'solo';
  const members = location.state?.members || [];
  const nextRoute = location.state?.nextRoute || '/app/session';

  const [state, setState] = useState('scanning');
  const [deviceName, setDeviceName] = useState('');
  const [hr, setHr] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [bleConnection, setBleConnection] = useState(null);
  const [memberStates, setMemberStates] = useState(
    members.map(m => ({ ...m, state: 'scanning', deviceName: '', hr: 0 }))
  );

  // Timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // BLE disconnect cleanup on unmount
  useEffect(() => {
    return () => {
      if (bleConnection?.disconnect) {
        try { bleConnection.disconnect(); } catch {}
      }
    };
  }, [bleConnection]);

  // BLE scan (solo mode)
  const startScan = useCallback(async () => {
    if (!isBleSupported()) {
      setState('failed');
      return;
    }

    try {
      const conn = await connectDevice();
      setDeviceName(conn.name || 'BLE Device');
      setState('found');

      conn.onData((data) => {
        if (data.disconnected) {
          setState('failed');
          setBleConnection(null);
          return;
        }
        if (data.hr > 0) {
          setHr(data.hr);
          setState('connected');
        }
      });

      setBleConnection(conn);
    } catch (err) {
      console.warn('[WearableSync] BLE scan failed:', err.message);
      setState('failed');
    }
  }, []);

  useEffect(() => {
    if (mode === 'solo') startScan();
  }, [mode, startScan]);

  // Timeout (30s)
  useEffect(() => {
    if (elapsed >= 30 && state === 'scanning') {
      setState('failed');
    }
  }, [elapsed, state]);

  function handleContinue() {
    // Pass BLE connection to next screen via location state
    nav(nextRoute, {
      state: {
        bleConnection: bleConnection ? { name: deviceName, hr } : null,
        sessionCompleted: location.state?.sessionCompleted,
      }
    });
  }

  const oc = OCEAN[state] || OCEAN.scanning;
  const anyConnected = state === 'connected' || memberStates.some(m => m.state === 'connected');
  const allResolved = state !== 'scanning' || elapsed >= 30;

  const statusMessage = state === 'scanning' ? 'Looking for your device...'
    : state === 'found' ? `${deviceName} found. Reading heart rate...`
    : state === 'connected' ? `Connected. HR: ${hr} BPM`
    : 'No device found.';

  return (
    <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', height: '100vh', position: 'relative', overflow: 'hidden', fontFamily: "'Outfit',-apple-system,sans-serif", color: '#fff' }}>
      <OceanCanvas state={state} hr={hr} />

      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ paddingTop: 48, textAlign: 'center', marginBottom: 4, width: '100%' }}>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 2.5, color: 'rgba(220,240,235,0.4)', textTransform: 'uppercase' }}>
            Wearable Sync
          </div>
          <div style={{ fontSize: 20, fontWeight: 200, color: 'rgba(230,245,240,0.88)', marginTop: 6 }}>
            {mode === 'solo' ? 'Connecting Your Device' : 'Connecting Devices'}
          </div>
          {/* Depth label + functional text */}
          <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: 1.5, color: 'rgba(200,230,225,0.3)', marginTop: 6, textTransform: 'uppercase' }}>
            {oc.label}
            <span style={{ color: 'rgba(200,230,225,0.15)', margin: '0 6px' }}>{'\u00B7'}</span>
            <span style={{ color: state === 'connected' ? 'rgba(74,222,128,0.4)' : 'rgba(200,230,225,0.25)' }}>{oc.func}</span>
          </div>
        </div>

        {/* Solo status */}
        {mode === 'solo' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <div style={{ height: 220 }} />
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <div style={{
                fontSize: 15, fontWeight: 300, marginBottom: 8,
                color: state === 'connected' ? 'rgba(74,222,128,0.85)'
                  : state === 'found' ? 'rgba(78,205,196,0.75)'
                  : state === 'failed' ? 'rgba(180,195,210,0.45)'
                  : 'rgba(140,230,225,0.6)',
              }}>
                {statusMessage}
              </div>
              {state === 'connected' && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 22px', background: 'rgba(74,222,128,0.08)',
                  border: '1px solid rgba(74,222,128,0.18)', borderRadius: 14,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 6px rgba(74,222,128,0.5)' }} />
                  <div style={{ fontSize: 26, fontWeight: 300, color: 'rgba(74,222,128,0.85)', fontVariantNumeric: 'tabular-nums' }}>{hr}</div>
                  <div style={{ fontSize: 11, color: 'rgba(74,222,128,0.45)' }}>BPM</div>
                </div>
              )}
              {state === 'connected' && deviceName && (
                <div style={{ fontSize: 10, color: 'rgba(200,230,225,0.3)', marginTop: 10 }}>{deviceName}</div>
              )}
            </div>
          </div>
        )}

        {/* Group member list */}
        {mode === 'group' && (
          <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'rgba(220,235,240,0.65)' }}>
                {memberStates.filter(m => m.state === 'connected').length} of {memberStates.length} wearables connected
              </div>
            </div>
            {memberStates.map((m, i) => (
              <MemberRow key={i} name={m.name} role={m.role} state={m.state} deviceName={m.deviceName} hr={m.hr} />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ width: '100%', paddingBottom: 30 }}>
          {(allResolved || state === 'connected') && (
            <button onClick={handleContinue} style={{
              width: '100%', padding: '16px 0', textAlign: 'center',
              background: anyConnected ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${anyConnected ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 18, cursor: 'pointer', marginBottom: 10, color: '#fff',
              fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 400, letterSpacing: 1,
            }}>
              <span style={{ color: anyConnected ? 'rgba(74,222,128,0.88)' : 'rgba(220,235,240,0.5)' }}>
                {anyConnected ? 'Start Session' : 'Continue Without Device'}
              </span>
            </button>
          )}

          {state === 'scanning' && elapsed > 5 && elapsed < 30 && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={handleContinue} style={{ background: 'none', border: 'none', fontSize: 11, color: 'rgba(200,230,225,0.2)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                Continue without wearable
              </button>
            </div>
          )}

          {state === 'scanning' && elapsed <= 30 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'rgba(200,230,225,0.2)', fontVariantNumeric: 'tabular-nums' }}>
                Scanning... {30 - elapsed}s
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
