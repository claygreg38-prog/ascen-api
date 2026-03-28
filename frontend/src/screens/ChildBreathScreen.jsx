import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════
// ChildBreathScreen — Air Dancer Breathing
// Bright sky, no depth metaphor, child-safe language only.
// Color picker, belly-first inflation teaching, progressive
// encouragement. For CHLD-E (elementary) and CHLD-M (middle school).
//
// Animation: single RAF loop, inflation in ref (no per-frame re-render).
// React re-render throttled to ~5fps for UI label updates only.
// ═══════════════════════════════════════════════════════════════

const SKY_GRADIENT = 'linear-gradient(180deg, #87CEEB 0%, #B0E0FF 40%, #E0F4FF 100%)';
const GROUND_COLOR = '#7EC850';

const COLORS = [
  { name: 'Red',    body: '#E84040', accent: '#FF6B6B' },
  { name: 'Blue',   body: '#4080E8', accent: '#6BA5FF' },
  { name: 'Green',  body: '#40B860', accent: '#6BDB8B' },
  { name: 'Purple', body: '#9050D0', accent: '#B07BF0' },
  { name: 'Orange', body: '#E88030', accent: '#FFa060' },
  { name: 'Pink',   body: '#E060A0', accent: '#FF8BC5' },
];

const ENCOURAGE = {
  elementary: [
    'You did it!', 'Great job!', 'Look at you go!', 'So brave!',
    'Your dancer loves that!', 'Keep going!', 'Amazing!',
    'Wow!', 'You rock!', 'That was perfect!',
  ],
  middle_school: [
    'Nice rhythm.', 'Steady.', 'You got this.', 'Smooth.',
    'Good flow.', 'On point.', 'Easy does it.', 'Clean.',
    'Locked in.', 'Solid.',
  ],
};

function getBracketConfig(ageConfig) {
  const bracket = ageConfig?.bracket || 'elementary';
  // Read from age_config if server provides breath timing, fallback to defaults
  const inhaleMs = ageConfig?.inhale_ms || (bracket === 'middle_school' ? 4000 : 3000);
  const exhaleMs = ageConfig?.exhale_ms || 5000;
  const maxBreaths = bracket === 'middle_school' ? 50 : 30;
  return { inhaleMs, exhaleMs, maxBreaths, bracket };
}

export default function ChildBreathScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('pick');     // pick → teach → breathe → done
  const [color, setColor] = useState(COLORS[0]);
  const [ageConfig, setAgeConfig] = useState(null);
  const [breathCount, setBreathCount] = useState(0);
  const [breathPhase, setBreathPhase] = useState('idle');  // idle, inhale, exhale
  const [encourageText, setEncourageText] = useState('');
  const [encourageOpacity, setEncourageOpacity] = useState(0);
  const [teachStep, setTeachStep] = useState(0);
  const breathRef = useRef({ count: 0, running: false });
  const configRef = useRef(null);

  // Load age config
  useEffect(() => {
    api.get('/api/auth/context')
      .then(res => setAgeConfig(res.data?.age_config || { bracket: 'elementary', max_session_minutes: 5 }))
      .catch(() => setAgeConfig({ bracket: 'elementary', max_session_minutes: 5 }));
  }, []);

  const cfg = ageConfig ? getBracketConfig(ageConfig) : null;
  configRef.current = cfg;

  // Breathing loop — clock-driven, inflate lives in ref, React updated at breath boundaries only
  const runBreathCycle = useCallback(() => {
    const c = configRef.current;
    if (!c || !breathRef.current.running) return;

    setBreathPhase('inhale');
    const inhaleStart = Date.now();

    function tick() {
      if (!breathRef.current.running) return;
      const now = Date.now();
      const inhaleElapsed = now - inhaleStart;

      if (inhaleElapsed < c.inhaleMs) {
        // Still inhaling
        breathRef.current.inflate = Math.min(inhaleElapsed / c.inhaleMs, 1);
        requestAnimationFrame(tick);
      } else if (!breathRef.current.exhaleStart) {
        // Transition to exhale
        breathRef.current.inflate = 1;
        breathRef.current.exhaleStart = now;
        setBreathPhase('exhale');
        requestAnimationFrame(tick);
      } else {
        // Exhaling
        const exhaleElapsed = now - breathRef.current.exhaleStart;
        if (exhaleElapsed < c.exhaleMs) {
          breathRef.current.inflate = 1 - Math.min(exhaleElapsed / c.exhaleMs, 1);
          requestAnimationFrame(tick);
        } else {
          // Breath complete
          breathRef.current.inflate = 0;
          breathRef.current.exhaleStart = null;
          breathRef.current.count++;
          setBreathCount(breathRef.current.count);

          // Show encouragement every 3 breaths (elementary) or 5 breaths (middle school)
          if (breathRef.current.count % (c.bracket === 'elementary' ? 3 : 5) === 0) {
            const msgs = ENCOURAGE[c.bracket] || ENCOURAGE.elementary;
            setEncourageText(msgs[Math.floor(Math.random() * msgs.length)]);
            setEncourageOpacity(1);
            setTimeout(() => setEncourageOpacity(0), 1800);
          }

          // Check if done
          if (breathRef.current.count >= c.maxBreaths) {
            breathRef.current.running = false;
            logChildSession(breathRef.current.count);
            setPhase('done');
          } else {
            // Small pause then next cycle
            setTimeout(() => runBreathCycle(), 300);
          }
        }
      }
    }
    requestAnimationFrame(tick);
  }, []);

  function startBreathing() {
    breathRef.current = { count: 0, running: true, inflate: 0, exhaleStart: null };
    sessionStartRef.current = Date.now();
    setBreathCount(0);
    setPhase('breathe');
    runBreathCycle();
  }

  function stopBreathing() {
    breathRef.current.running = false;
    logChildSession(breathRef.current.count);
    setPhase('done');
  }

  useEffect(() => {
    return () => { breathRef.current.running = false; };
  }, []);

  // Log session to server (fire-and-forget — never block the celebration)
  const sessionStartRef = useRef(null);

  function logChildSession(finalBreathCount) {
    const c = configRef.current;
    if (!c) return;
    const durationSeconds = sessionStartRef.current
      ? Math.round((Date.now() - sessionStartRef.current) / 1000)
      : 0;
    (async () => {
      try {
        await api.post('/api/child-session', {
          breaths_completed: finalBreathCount,
          breaths_available: c.maxBreaths,
          duration_seconds: durationSeconds,
        });
      } catch (err) {
        console.warn('[ChildSession] Log failed:', err.message);
        // Silent failure — never interrupt the child's celebration
      }
    })();
  }

  function handleFinish() {
    navigate('/app/', { state: { sessionCompleted: true } });
  }

  // ── RENDER PHASES ──────────────────────────────────────────

  // Color picker
  if (phase === 'pick') {
    return (
      <div style={S.container}>
        <div style={S.sky}>
          <h1 style={S.title}>Pick Your Dancer!</h1>
          <p style={S.subtitle}>Tap a color to choose</p>
          <div style={S.colorGrid}>
            {COLORS.map(c => (
              <button
                key={c.name}
                onClick={() => setColor(c)}
                style={{
                  ...S.colorBtn,
                  background: c.body,
                  border: color.name === c.name ? '3px solid #fff' : '3px solid transparent',
                  transform: color.name === c.name ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                <span style={S.colorLabel}>{c.name}</span>
              </button>
            ))}
          </div>
          <AirDancer color={color} inflateRef={{ current: 0.3 }} size={120} />
          <button onClick={() => setPhase('teach')} style={S.bigBtn}>
            {cfg?.bracket === 'middle_school' ? "Let's Go" : "That's My Dancer!"}
          </button>
        </div>
        <div style={S.ground} />
      </div>
    );
  }

  // Teach belly breathing
  if (phase === 'teach') {
    const steps = cfg?.bracket === 'middle_school' ? [
      { text: "Breathe in through your nose — fill your belly first.", icon: '\u{1FAC1}' },
      { text: "Now breathe out slowly through your mouth.", icon: '\u{1F4A8}' },
      { text: "Your dancer fills up when you breathe in, and shrinks when you breathe out.", icon: '\u{1F388}' },
    ] : [
      { text: "Put your hand on your belly!", icon: '\u270B' },
      { text: "Breathe in BIG — make your belly push your hand out!", icon: '\u{1F388}' },
      { text: "Now breathe out slooowly — like blowing a bubble!", icon: '\u{1FAE7}' },
      { text: "Watch your dancer do it with you!", icon: '\u{1F929}' },
    ];

    const teachInflate = useRef(teachStep >= 1 ? 0.8 : 0.2);
    teachInflate.current = teachStep >= 1 ? 0.8 : 0.2;

    return (
      <div style={S.container}>
        <div style={S.sky}>
          <AirDancer color={color} inflateRef={teachInflate} size={160} />
          <div style={S.teachCard}>
            <span style={{ fontSize: 40 }}>{steps[teachStep].icon}</span>
            <p style={S.teachText}>{steps[teachStep].text}</p>
          </div>
          <div style={S.teachNav}>
            {teachStep > 0 && (
              <button onClick={() => setTeachStep(s => s - 1)} style={S.teachBtn}>Back</button>
            )}
            {teachStep < steps.length - 1 ? (
              <button onClick={() => setTeachStep(s => s + 1)} style={S.teachBtnPrimary}>Next</button>
            ) : (
              <button onClick={startBreathing} style={S.teachBtnPrimary}>Start Breathing!</button>
            )}
          </div>
        </div>
        <div style={S.ground} />
      </div>
    );
  }

  // Active breathing — inflate read from ref by AirDancer's own RAF loop
  if (phase === 'breathe') {
    const total = cfg?.maxBreaths || 30;
    const progress = breathCount / total;
    const label = breathPhase === 'inhale' ? 'Breathe In...' : breathPhase === 'exhale' ? 'Breathe Out...' : '';

    return (
      <div style={S.container}>
        <div style={S.sky}>
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${progress * 100}%` }} />
          </div>
          <p style={S.breathLabel}>{label}</p>
          <AirDancer color={color} inflateRef={breathRef} size={220} />

          {/* Encouragement */}
          <p style={{ ...S.encourage, opacity: encourageOpacity }}>{encourageText}</p>

          <p style={S.counter}>{breathCount} / {total}</p>

          <button onClick={stopBreathing} style={S.stopBtn}>
            {cfg?.bracket === 'middle_school' ? "I'm Done" : 'All Done!'}
          </button>
        </div>
        <div style={S.ground} />
      </div>
    );
  }

  // Done
  if (phase === 'done') {
    const great = cfg?.bracket === 'middle_school'
      ? `${breathCount} breaths. Solid work.`
      : `${breathCount} breaths! Your dancer is SO proud of you!`;

    return (
      <div style={S.container}>
        <div style={S.sky}>
          <AirDancer color={color} inflateRef={{ current: 0.5 }} size={180} />
          <h1 style={S.doneTitle}>
            {cfg?.bracket === 'middle_school' ? 'Nice.' : 'Amazing Job!'}
          </h1>
          <p style={S.doneText}>{great}</p>
          <button onClick={handleFinish} style={S.bigBtn}>Go Home</button>
        </div>
        <div style={S.ground} />
      </div>
    );
  }

  // Fallback (loading)
  return (
    <div style={S.container}>
      <div style={{ ...S.sky, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#555', fontSize: 16 }}>Loading...</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AIR DANCER COMPONENT
//
// Single RAF loop reads inflate from ref (no React re-render per frame).
// Progressive inflation: belly → chest → arms → head (diaphragmatic teaching).
// Sway DECREASES with inflation (dancer stabilizes when full).
// Streamers appear at peak inflation (visual reward).
// Face appears progressively (eyes at 30% head, smile at 60% head).
// ═══════════════════════════════════════════════════════════════

function AirDancer({ color, inflateRef, size = 200 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = size;
    const h = size * 1.8;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const baseY = h * 0.88;

    // Pre-parse color for gradient use
    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    }

    const bodyRgb = hexToRgb(color.body);
    const accentRgb = hexToRgb(color.accent);

    function draw() {
      const now = Date.now();
      const inf = typeof inflateRef.current === 'object'
        ? (inflateRef.current.inflate || 0)
        : (inflateRef.current || 0);

      ctx.clearRect(0, 0, w, h);

      // ── Progressive inflation zones (belly-first teaching) ──
      const bellyInf = Math.min(1, inf * 2.5);           // belly fills 0–40%
      const chestInf = Math.max(0, Math.min(1, (inf - 0.3) * 2.5));  // chest fills 30–70%
      const armInf = Math.max(0, Math.min(1, (inf - 0.4) * 2.5));    // arms fill 40–80%
      const headInf = Math.max(0, Math.min(1, (inf - 0.5) * 2));     // head fills 50–100%

      // ── Sway (decreases with inflation — stabilize when full) ──
      const sway = (1 - inf) * Math.sin(now / 500 * 1.8) * 8;

      // Dimensions
      const bodyW = 18 + bellyInf * 28;
      const chestW = 14 + chestInf * 16;
      const bodyH = h * 0.42 + inf * (h * 0.12);
      const bodyTop = baseY - bodyH;
      const headR = size * 0.08 + headInf * (size * 0.03);
      const headY = bodyTop - headR - 2;
      const armLen = size * 0.22 + armInf * (size * 0.14);
      const armAngle = -20 - armInf * 70;

      ctx.save();
      ctx.translate(cx, baseY);
      ctx.rotate(sway * Math.PI / 180);
      ctx.translate(-cx, -baseY);

      // ── Base / blower ──
      ctx.fillStyle = '#999';
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 5, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 12, baseY - 1, 24, 8);

      // Air lines during inhale
      if (inf > 0.05 && inf < 0.95) {
        ctx.strokeStyle = `rgba(200,200,200,${0.3 + inf * 0.3})`;
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          const lineX = cx + i * 6;
          ctx.beginPath();
          ctx.moveTo(lineX, baseY - 2);
          ctx.lineTo(lineX + Math.sin(now / 200 + i) * 3, baseY - 12 - inf * 8);
          ctx.stroke();
        }
      }

      // ── Body — tapered tube with belly bulge ──
      ctx.fillStyle = color.body;
      ctx.beginPath();
      ctx.moveTo(cx - 10, baseY);
      // Left side — belly bulges more than chest
      ctx.quadraticCurveTo(cx - bodyW * 0.6, baseY - bodyH * 0.3, cx - bodyW * 0.5, baseY - bodyH * 0.5);
      ctx.quadraticCurveTo(cx - chestW * 0.6, baseY - bodyH * 0.7, cx - chestW * 0.35, bodyTop);
      // Top
      ctx.lineTo(cx + chestW * 0.35, bodyTop);
      // Right side
      ctx.quadraticCurveTo(cx + chestW * 0.6, baseY - bodyH * 0.7, cx + bodyW * 0.5, baseY - bodyH * 0.5);
      ctx.quadraticCurveTo(cx + bodyW * 0.6, baseY - bodyH * 0.3, cx + 10, baseY);
      ctx.closePath();
      ctx.fill();

      // ── Belly highlight (grows with bellyInf) ──
      const bellyY = baseY - bodyH * 0.35;
      const bellyRx = bodyW * 0.22 + bellyInf * bodyW * 0.08;
      const bellyRy = bodyH * 0.08 + bellyInf * bodyH * 0.06;
      ctx.fillStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.45)`;
      ctx.beginPath();
      ctx.ellipse(cx, bellyY, bellyRx, bellyRy, 0, 0, Math.PI * 2);
      ctx.fill();

      // ── Arms ──
      const armY = bodyTop + bodyH * 0.15;
      const armLX = cx - chestW * 0.35;
      const armRX = cx + chestW * 0.35;
      ctx.strokeStyle = color.body;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      // Left arm
      const lAngle = (armAngle - 15) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(armLX, armY);
      ctx.lineTo(armLX + Math.cos(lAngle) * armLen, armY + Math.sin(lAngle) * armLen);
      ctx.stroke();

      // Right arm
      const rAngle = (180 - armAngle + 15) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(armRX, armY);
      ctx.lineTo(armRX + Math.cos(rAngle) * armLen, armY + Math.sin(rAngle) * armLen);
      ctx.stroke();

      // ── Head ──
      ctx.fillStyle = color.body;
      ctx.beginPath();
      ctx.arc(cx, headY, headR, 0, Math.PI * 2);
      ctx.fill();

      // Eyes — appear at headInf > 0.3
      if (headInf > 0.3) {
        const eyeOpacity = Math.min(1, (headInf - 0.3) * 3);
        ctx.fillStyle = `rgba(255,255,255,${eyeOpacity})`;
        const eyeR = headR * 0.15;
        ctx.beginPath();
        ctx.arc(cx - headR * 0.32, headY - headR * 0.08, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + headR * 0.32, headY - headR * 0.08, eyeR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Smile — appears at headInf > 0.6
      if (headInf > 0.6) {
        const smileOpacity = Math.min(1, (headInf - 0.6) * 2.5);
        ctx.strokeStyle = `rgba(255,255,255,${smileOpacity})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, headY + headR * 0.05, headR * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }

      // ── Streamers at peak inflation (inf > 0.85) ──
      if (inf > 0.85) {
        const streamerOpacity = Math.min(1, (inf - 0.85) * 6);
        for (let i = 0; i < 3; i++) {
          const sx = cx + (i - 1) * headR * 0.6;
          const sPhase = now / 300 + i * 2.1;
          ctx.strokeStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${streamerOpacity * 0.7})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, headY - headR);
          for (let j = 1; j <= 4; j++) {
            const sy = headY - headR - j * 6;
            const swx = Math.sin(sPhase + j * 0.8) * 5;
            ctx.lineTo(sx + swx, sy);
          }
          ctx.stroke();
        }
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [color, size, inflateRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', margin: '0 auto' }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const S = {
  container: {
    position: 'fixed', inset: 0, zIndex: 100,
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Outfit', 'Nunito', sans-serif",
  },
  sky: {
    flex: 1, background: SKY_GRADIENT,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px', gap: 12, overflow: 'hidden',
  },
  ground: {
    height: 60, background: GROUND_COLOR,
    borderTop: '3px solid #6AB040',
  },
  title: {
    fontSize: 28, fontWeight: 700, color: '#2A4A6B',
    margin: 0, textAlign: 'center',
  },
  subtitle: {
    fontSize: 16, color: '#5A7A9B', margin: 0,
  },
  colorGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 12,
    justifyContent: 'center', maxWidth: 280,
  },
  colorBtn: {
    width: 70, height: 70, borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  colorLabel: {
    color: '#fff', fontWeight: 700, fontSize: 13,
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  },
  bigBtn: {
    background: '#4080E8', color: '#fff',
    border: 'none', borderRadius: 24, padding: '14px 40px',
    fontSize: 18, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(64,128,232,0.4)',
    marginTop: 8,
  },
  teachCard: {
    background: 'rgba(255,255,255,0.85)', borderRadius: 20,
    padding: '24px 20px', maxWidth: 300, textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  },
  teachText: {
    fontSize: 18, color: '#2A4A6B', margin: 0, lineHeight: 1.5,
    fontWeight: 600,
  },
  teachNav: {
    display: 'flex', gap: 12,
  },
  teachBtn: {
    background: 'rgba(255,255,255,0.7)', color: '#4080E8',
    border: '2px solid #4080E8', borderRadius: 20, padding: '10px 24px',
    fontSize: 16, fontWeight: 600, cursor: 'pointer',
  },
  teachBtnPrimary: {
    background: '#4080E8', color: '#fff',
    border: 'none', borderRadius: 20, padding: '10px 28px',
    fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(64,128,232,0.35)',
  },
  breathLabel: {
    fontSize: 22, fontWeight: 700, color: '#2A4A6B',
    margin: 0, minHeight: 32,
  },
  progressBar: {
    width: '80%', maxWidth: 280, height: 12, borderRadius: 6,
    background: 'rgba(255,255,255,0.5)', overflow: 'hidden',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
  },
  progressFill: {
    height: '100%', borderRadius: 6,
    background: 'linear-gradient(90deg, #5CE0D0, #4080E8)',
    transition: 'width 0.3s ease',
  },
  encourage: {
    fontSize: 24, fontWeight: 800, color: '#E88030',
    margin: 0, minHeight: 36, transition: 'opacity 0.4s ease',
    textShadow: '0 1px 4px rgba(0,0,0,0.1)',
  },
  counter: {
    fontSize: 14, color: '#5A7A9B', margin: 0,
  },
  stopBtn: {
    background: 'rgba(255,255,255,0.7)', color: '#E84040',
    border: '2px solid #E84040', borderRadius: 20, padding: '8px 24px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4,
  },
  doneTitle: {
    fontSize: 32, fontWeight: 800, color: '#2A4A6B',
    margin: 0, textAlign: 'center',
  },
  doneText: {
    fontSize: 18, color: '#5A7A9B', margin: 0, textAlign: 'center',
    maxWidth: 280,
  },
};
