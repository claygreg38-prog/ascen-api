import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════
// ChildHomeScreen — Bright surface home for CHLD-E and CHLD-M
// No depth metaphor. No clinical terms. Luno drives the experience.
// Energy bar wraps deployed capacityDisplay.js output.
// ═══════════════════════════════════════════════════════════════

const SKY = 'linear-gradient(180deg, #87CEEB 0%, #B0E0FF 50%, #E0F4FF 100%)';

// Maps capacity_state + capacity_display type to child-friendly config
const ENERGY = {
  energy_bar: { // CHLD-E (elementary)
    full:         { label: 'Full Energy!',   pct: 100, color: '#5CE0D0', emoji: '💪', lunoMood: 'bounce' },
    steady:       { label: 'Good Energy',    pct: 75,  color: '#A8CCE8', emoji: '😊', lunoMood: 'bounce' },
    drawing_down: { label: 'Getting Tired',  pct: 50,  color: '#E8BE6A', emoji: '😴', lunoMood: 'stretch' },
    low:          { label: 'Need Rest',      pct: 25,  color: '#E09878', emoji: '🫂', lunoMood: 'sit' },
    depleted:     { label: 'Resting',        pct: 10,  color: '#D88AA0', emoji: '🫂', lunoMood: 'sit' },
  },
  gaming: { // CHLD-M (middle school)
    full:         { label: 'Maxed Out!',     pct: 100, color: '#5CE0D0', emoji: '💪', lunoMood: 'bounce' },
    steady:       { label: 'Powered Up',     pct: 75,  color: '#A8CCE8', emoji: '😊', lunoMood: 'bounce' },
    drawing_down: { label: 'Using Energy',   pct: 50,  color: '#E8BE6A', emoji: '😴', lunoMood: 'stretch' },
    low:          { label: 'Recharging',     pct: 25,  color: '#E09878', emoji: '🫂', lunoMood: 'sit' },
    depleted:     { label: 'Rest Mode',      pct: 10,  color: '#D88AA0', emoji: '🫂', lunoMood: 'sit' },
  },
};

export default function ChildHomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [showBubble, setShowBubble] = useState(true);
  const [parentBreathed, setParentBreathed] = useState(null);

  const loadContext = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/context');
      setContext(res.data);

      // Check if parent breathed today (LightBridge)
      if (res.data.family_unit_id) {
        try {
          const famRes = await api.get(`/api/family/unit/${res.data.family_unit_id}`);
          const members = famRes.data?.members || [];
          const parent = members.find(m => m.role === 'parent' || m.role === 'founder' || m.role === 'elder');
          if (parent) {
            setParentBreathed(parent.last_session_today || false);
          }
        } catch {}
      }
    } catch (err) {
      console.error('[CHILD_HOME] Failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContext(); }, [loadContext]);

  // Session complete banner
  useEffect(() => {
    if (location.state?.sessionCompleted) {
      setShowComplete(true);
      loadContext();
      const timer = setTimeout(() => setShowComplete(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state, loadContext]);

  // Speech bubble disappears after 3s
  useEffect(() => {
    const timer = setTimeout(() => setShowBubble(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !context) {
    return (
      <div style={{ ...S.container, background: SKY }}>
        <div style={S.center}><p style={{ color: '#5A7A9B', fontSize: 16 }}>Loading...</p></div>
      </div>
    );
  }

  const displayType = context.age_config?.capacity_display || 'energy_bar';
  const capState = context.capacity_state || 'steady';
  const energyMap = ENERGY[displayType] || ENERGY.energy_bar;
  const energy = energyMap[capState] || energyMap.steady;
  const bracket = context.age_config?.bracket || 'elementary';
  const isMiddle = bracket === 'middle_school';
  const totalBreaths = (context.total_sessions || 0) * 25; // rough estimate
  const balloons = Math.floor(totalBreaths / 3);

  return (
    <div style={S.container}>
      {/* Session complete banner */}
      {showComplete && (
        <div style={S.banner}>You did it! Your dancer is proud of you!</div>
      )}

      <div style={S.scroll}>
        {/* Greeting + Luno */}
        <div style={S.greeting}>
          <PlayfulLuno mood={energy.lunoMood} color={energy.color} size={80} />
          {showBubble && (
            <div style={S.bubble}>
              Hey{context.first_name ? ` ${context.first_name}` : ''}! Ready to breathe? \u2728
            </div>
          )}
        </div>

        {/* Energy Bar */}
        <div style={S.card}>
          <p style={S.cardLabel}>{energy.emoji} {energy.label}</p>
          <div style={S.energyTrack}>
            <div style={{ ...S.energyFill, width: `${energy.pct}%`, background: energy.color }} />
          </div>
        </div>

        {/* Breathe Button */}
        <button onClick={() => navigate('/app/child-breathe')} style={S.breatheBtn}>
          {isMiddle ? "Let's Breathe" : "Let's Breathe! 🌊"}
        </button>
        {context.total_sessions > 0 && (
          <p style={S.lastTime}>
            Last time you breathed for {context.age_config?.max_session_minutes || 5} minutes
          </p>
        )}

        {/* Streak */}
        {(context.streak?.current || 0) > 0 && (
          <div style={S.card}>
            <p style={S.streakText}>
              {'\uD83D\uDD25'} {context.streak.current} day{context.streak.current > 1 ? 's' : ''} in a row! Keep it going!
            </p>
          </div>
        )}

        {/* LightBridge */}
        {context.family_unit_id && (
          <div style={S.card}>
            {parentBreathed ? (
              <p style={S.lightText}>
                <span style={S.sunGlow}>\u2728</span> Your family breathed today too! Your light is on \u2728
              </p>
            ) : (
              <p style={S.lightText}>
                Your family is thinking of you. Your light is always on for them 💛
              </p>
            )}
          </div>
        )}

        {/* Fun Stats */}
        {context.total_sessions > 0 && (
          <div style={{ ...S.card, ...S.statsRow }}>
            <div style={S.stat}>
              <span style={S.statNum}>{context.total_sessions}</span>
              <span style={S.statLabel}>times breathed</span>
            </div>
            <div style={S.stat}>
              <span style={S.statNum}>{balloons} 🎈</span>
              <span style={S.statLabel}>balloons filled</span>
            </div>
            <div style={S.stat}>
              <span style={S.statNum}>{context.streak?.best || 0}</span>
              <span style={S.statLabel}>best streak</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLAYFUL LUNO — 80px, animated, reacts to energy
// ═══════════════════════════════════════════════════════════════

function PlayfulLuno({ mood = 'bounce', color = '#5CE0D0', size = 80 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    let running = true;
    function draw() {
      if (!running) return;
      const t = Date.now() / 1000;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      let cy = size / 2;
      const r = size * 0.32;

      // Mood animations
      if (mood === 'bounce') {
        cy += Math.sin(t * 3) * 4;
      } else if (mood === 'stretch') {
        cy += Math.sin(t * 1.5) * 2;
      }
      // sit: no vertical movement

      // Glow
      const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.5);
      grad.addColorStop(0, color + '40');
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      const eyeY = cy - r * 0.15;
      const eyeSpread = r * 0.3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - eyeSpread, eyeY, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpread, eyeY, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      // Pupils
      ctx.fillStyle = '#2A4A6B';
      ctx.beginPath();
      ctx.arc(cx - eyeSpread, eyeY, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpread, eyeY, r * 0.05, 0, Math.PI * 2);
      ctx.fill();

      // Smile (bigger when bouncing)
      const smileWidth = mood === 'bounce' ? r * 0.35 : r * 0.2;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.05, smileWidth, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    return () => { running = false; };
  }, [mood, color, size]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const S = {
  container: {
    position: 'fixed', inset: 0, background: SKY,
    fontFamily: "'Outfit', 'Nunito', sans-serif",
    display: 'flex', flexDirection: 'column',
  },
  center: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  scroll: {
    flex: 1, overflowY: 'auto', padding: '24px 16px 100px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
  },
  banner: {
    background: '#5CE0D0', color: '#fff', textAlign: 'center',
    padding: '10px 16px', fontSize: 16, fontWeight: 700,
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
  },
  greeting: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    marginTop: 8,
  },
  bubble: {
    background: 'rgba(255,255,255,0.9)', borderRadius: 16, padding: '8px 16px',
    fontSize: 15, color: '#2A4A6B', fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    animation: 'fadeIn 0.3s ease',
  },
  card: {
    background: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: '16px 20px',
    width: '100%', maxWidth: 340, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  cardLabel: {
    fontSize: 18, fontWeight: 700, color: '#2A4A6B', margin: '0 0 8px',
    textAlign: 'center',
  },
  energyTrack: {
    width: '100%', height: 14, borderRadius: 7,
    background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  energyFill: {
    height: '100%', borderRadius: 7, transition: 'width 0.5s ease',
  },
  breatheBtn: {
    background: 'linear-gradient(135deg, #4fd1c5, #4080E8)', color: '#fff',
    border: 'none', borderRadius: 28, padding: '16px 48px',
    fontSize: 20, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(64,128,232,0.35)',
    marginTop: 4,
  },
  lastTime: {
    fontSize: 13, color: '#5A7A9B', margin: 0, textAlign: 'center',
  },
  streakText: {
    fontSize: 17, fontWeight: 700, color: '#E88030', margin: 0, textAlign: 'center',
  },
  lightText: {
    fontSize: 15, color: '#2A4A6B', margin: 0, textAlign: 'center', lineHeight: 1.5,
  },
  sunGlow: {
    fontSize: 20,
    textShadow: '0 0 12px rgba(232,190,106,0.6)',
  },
  statsRow: {
    display: 'flex', justifyContent: 'space-around', gap: 8,
  },
  stat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  statNum: {
    fontSize: 24, fontWeight: 800, color: '#4080E8',
  },
  statLabel: {
    fontSize: 11, color: '#5A7A9B', textAlign: 'center',
  },
};
