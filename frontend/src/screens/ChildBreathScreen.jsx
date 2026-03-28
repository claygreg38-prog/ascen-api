import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════
// ChildBreathScreen — Air Dancer Breathing
// Bright sky, no depth metaphor, no clinical terms.
// Color picker, belly-first inflation teaching, progressive
// encouragement. For CHLD-E (elementary) and CHLD-M (middle school).
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
  if (bracket === 'middle_school') {
    return { inhaleMs: 4000, exhaleMs: 5000, maxBreaths: 50, bracket };
  }
  // elementary (default)
  return { inhaleMs: 3000, exhaleMs: 5000, maxBreaths: 30, bracket };
}

export default function ChildBreathScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('pick');     // pick → teach → breathe → done
  const [color, setColor] = useState(COLORS[0]);
  const [ageConfig, setAgeConfig] = useState(null);
  const [breathCount, setBreathCount] = useState(0);
  const [breathPhase, setBreathPhase] = useState('idle');  // idle, inhale, exhale
  const [inflate, setInflate] = useState(0);       // 0-1 inflation amount
  const [encourageText, setEncourageText] = useState('');
  const [encourageOpacity, setEncourageOpacity] = useState(0);
  const [teachStep, setTeachStep] = useState(0);
  const animRef = useRef(null);
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

  // Breathing loop
  const runBreathCycle = useCallback(() => {
    const c = configRef.current;
    if (!c || !breathRef.current.running) return;

    // Inhale
    setBreathPhase('inhale');
    setInflate(0);
    const inhaleStart = Date.now();

    function animateInhale() {
      if (!breathRef.current.running) return;
      const elapsed = Date.now() - inhaleStart;
      const progress = Math.min(elapsed / c.inhaleMs, 1);
      setInflate(progress);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animateInhale);
      } else {
        // Start exhale
        setBreathPhase('exhale');
        const exhaleStart = Date.now();
        function animateExhale() {
          if (!breathRef.current.running) return;
          const elapsed = Date.now() - exhaleStart;
          const progress = Math.min(elapsed / c.exhaleMs, 1);
          setInflate(1 - progress);
          if (progress < 1) {
            animRef.current = requestAnimationFrame(animateExhale);
          } else {
            // Breath complete
            breathRef.current.count++;
            setBreathCount(breathRef.current.count);

            // Show encouragement every 3-5 breaths
            if (breathRef.current.count % (c.bracket === 'elementary' ? 3 : 5) === 0) {
              const msgs = ENCOURAGE[c.bracket] || ENCOURAGE.elementary;
              setEncourageText(msgs[Math.floor(Math.random() * msgs.length)]);
              setEncourageOpacity(1);
              setTimeout(() => setEncourageOpacity(0), 1800);
            }

            // Check if done
            if (breathRef.current.count >= c.maxBreaths) {
              breathRef.current.running = false;
              setPhase('done');
            } else {
              // Small pause then next cycle
              setTimeout(() => runBreathCycle(), 300);
            }
          }
        }
        animRef.current = requestAnimationFrame(animateExhale);
      }
    }
    animRef.current = requestAnimationFrame(animateInhale);
  }, []);

  function startBreathing() {
    breathRef.current = { count: 0, running: true };
    setBreathCount(0);
    setPhase('breathe');
    runBreathCycle();
  }

  function stopBreathing() {
    breathRef.current.running = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setPhase('done');
  }

  useEffect(() => {
    return () => {
      breathRef.current.running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

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
          <AirDancer color={color} inflate={0.3} size={120} />
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
      { text: "Breathe in through your nose — fill your belly first.", icon: '🫁' },
      { text: "Now breathe out slowly through your mouth.", icon: '💨' },
      { text: "Your dancer fills up when you breathe in, and shrinks when you breathe out.", icon: '🎈' },
    ] : [
      { text: "Put your hand on your belly!", icon: '✋' },
      { text: "Breathe in BIG — make your belly push your hand out!", icon: '🎈' },
      { text: "Now breathe out slooowly — like blowing a bubble!", icon: '🫧' },
      { text: "Watch your dancer do it with you!", icon: '🤩' },
    ];

    return (
      <div style={S.container}>
        <div style={S.sky}>
          <AirDancer color={color} inflate={teachStep >= 1 ? 0.8 : 0.2} size={160} />
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

  // Active breathing
  if (phase === 'breathe') {
    const total = cfg?.maxBreaths || 30;
    const progress = breathCount / total;
    const label = breathPhase === 'inhale' ? 'Breathe In...' : breathPhase === 'exhale' ? 'Breathe Out...' : '';

    return (
      <div style={S.container}>
        <div style={S.sky}>
          {/* Progress clouds */}
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${progress * 100}%` }} />
          </div>
          <p style={S.breathLabel}>{label}</p>
          <AirDancer color={color} inflate={inflate} size={220} />

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
          <AirDancer color={color} inflate={0.5} size={180} />
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
// AIR DANCER COMPONENT — Tube man with breath-driven inflation
// ═══════════════════════════════════════════════════════════════

function AirDancer({ color, inflate = 0, size = 200 }) {
  const w = size;
  const h = size * 1.8;
  const cx = w / 2;
  const baseY = h * 0.92;

  // Body inflation: wider + taller when inflated
  const bodyWidth = 20 + inflate * 30;
  const bodyHeight = h * 0.45 + inflate * (h * 0.15);
  const bodyTop = baseY - bodyHeight;

  // Arms wave with inflation
  const armAngle = -30 - inflate * 60;  // arms go higher when inflated
  const armLen = size * 0.28 + inflate * (size * 0.08);

  // Head bobs up
  const headR = size * 0.09 + inflate * (size * 0.02);
  const headY = bodyTop - headR - 2;

  // Gentle sway
  const sway = Math.sin(Date.now() / 400) * (3 + inflate * 5);

  // Re-render for sway animation
  const [, setTick] = useState(0);
  useEffect(() => {
    let running = true;
    function loop() {
      if (!running) return;
      setTick(t => t + 1);
      requestAnimationFrame(loop);
    }
    loop();
    return () => { running = false; };
  }, []);

  const armLX = cx - bodyWidth * 0.4;
  const armRX = cx + bodyWidth * 0.4;
  const armY = bodyTop + bodyHeight * 0.15;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Base / fan */}
      <ellipse cx={cx} cy={baseY + 4} rx={bodyWidth * 0.8} ry={8} fill="#888" />
      <rect x={cx - bodyWidth * 0.5} y={baseY - 2} width={bodyWidth} height={10} rx={3} fill="#999" />

      {/* Body — tapered tube */}
      <g transform={`rotate(${sway}, ${cx}, ${baseY})`}>
        <path
          d={`
            M ${cx - bodyWidth * 0.5} ${baseY}
            Q ${cx - bodyWidth * 0.6} ${bodyTop + bodyHeight * 0.5}
              ${cx - bodyWidth * 0.3} ${bodyTop}
            L ${cx + bodyWidth * 0.3} ${bodyTop}
            Q ${cx + bodyWidth * 0.6} ${bodyTop + bodyHeight * 0.5}
              ${cx + bodyWidth * 0.5} ${baseY}
            Z
          `}
          fill={color.body}
        />

        {/* Belly stripe */}
        <ellipse
          cx={cx} cy={bodyTop + bodyHeight * 0.55}
          rx={bodyWidth * 0.25} ry={bodyHeight * 0.12 + inflate * bodyHeight * 0.06}
          fill={color.accent} opacity={0.5}
        />

        {/* Left arm */}
        <line
          x1={armLX} y1={armY}
          x2={armLX + Math.cos((armAngle - 20) * Math.PI / 180) * armLen}
          y2={armY + Math.sin((armAngle - 20) * Math.PI / 180) * armLen}
          stroke={color.body} strokeWidth={5} strokeLinecap="round"
        />

        {/* Right arm */}
        <line
          x1={armRX} y1={armY}
          x2={armRX + Math.cos((180 - armAngle + 20) * Math.PI / 180) * armLen}
          y2={armY + Math.sin((180 - armAngle + 20) * Math.PI / 180) * armLen}
          stroke={color.body} strokeWidth={5} strokeLinecap="round"
        />

        {/* Head */}
        <circle cx={cx} cy={headY} r={headR} fill={color.body} />
        {/* Eyes */}
        <circle cx={cx - headR * 0.35} cy={headY - headR * 0.1} r={headR * 0.15} fill="#fff" />
        <circle cx={cx + headR * 0.35} cy={headY - headR * 0.1} r={headR * 0.15} fill="#fff" />
        {/* Smile */}
        <path
          d={`M ${cx - headR * 0.3} ${headY + headR * 0.2} Q ${cx} ${headY + headR * 0.5} ${cx + headR * 0.3} ${headY + headR * 0.2}`}
          fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round"
        />
      </g>
    </svg>
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
