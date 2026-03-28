import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import SurfaceOcean from '../components/SurfaceOcean';
import MiniLuno from '../components/MiniLuno';
import CoherenceRings from '../components/CoherenceRings';

// ═══════════════════════════════════════════════════════════════
// HomeScreen — Sunny Surface (Depth Metaphor v5)
// Surface = sunny. Deep = dark. Weather = biofeedback.
// Cards: sky zone (white/transparent, dark text) above waterline
//        water zone (dark, light text) below waterline
// "Dive In" not "Begin." Language signals the descent.
// ═══════════════════════════════════════════════════════════════

const CAP = {
  full:         { label: 'Full',         color: '#5CE0D0', glow: 'rgba(92,224,208,0.35)',  desc: 'Your system is thriving' },
  steady:       { label: 'Steady',       color: '#A8CCE8', glow: 'rgba(168,204,232,0.25)', desc: 'Your system is steady' },
  drawing_down: { label: 'Drawing Down', color: '#E8BE6A', glow: 'rgba(232,190,106,0.25)', desc: 'Your system is working harder today' },
  low:          { label: 'Low',          color: '#E09878', glow: 'rgba(224,152,120,0.2)',  desc: 'Your body needs gentleness' },
  depleted:     { label: 'Depleted',     color: '#D88AA0', glow: 'rgba(216,138,160,0.18)', desc: 'Your body needs rest' },
};

export default function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [lightBridge, setLightBridge] = useState(null);
  const [coBreathSuggestion, setCoBreathSuggestion] = useState(null);
  const [recentArt, setRecentArt] = useState([]);
  const [coherence, setCoherence] = useState(0.3);
  const [crisis, setCrisis] = useState(null);

  const lunoTapRef = useRef({ count: 0, timeout: null });
  const [devVisible, setDevVisible] = useState(false);
  const user = getUser();

  const loadContext = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/context');
      setContext(res.data);

      try {
        const capRes = await api.get(`/api/capacity/balance/${res.data.user_id}`);
        if (capRes.data?.coherence) setCoherence(capRes.data.coherence);
      } catch {}

      if (res.data.features?.family_hub && res.data.family_unit_id) {
        try {
          const famRes = await api.get(`/api/family/unit/${res.data.family_unit_id}`);
          setFamilyMembers(famRes.data?.members || []);
          setCoBreathSuggestion(famRes.data?.co_breath_suggestion || null);
        } catch {}

        if (res.data.features?.lightbridge) {
          try {
            const lbRes = await api.get('/api/lightbridge/state');
            setLightBridge(lbRes.data);
          } catch {}
        }
      }

      try {
        const artRes = await api.get(`/api/art/gallery/${res.data.user_id}?limit=2`);
        setRecentArt((artRes.data?.gallery || []).slice(0, 2));
      } catch {}

      try {
        const crisisRes = await api.get('/api/crisis/status');
        setCrisis(crisisRes.data);
      } catch {}
    } catch (err) {
      console.error('[HOME] Failed to load context:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    if (location.state?.sessionCompleted) {
      setShowComplete(true);
      loadContext();
      const timer = setTimeout(() => setShowComplete(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state, loadContext]);

  function handleLunoTap() {
    const t = lunoTapRef.current;
    t.count++;
    clearTimeout(t.timeout);
    t.timeout = setTimeout(() => { t.count = 0; }, 500);
    if (t.count >= 3) {
      t.count = 0;
      if (user && ['facilitator', 'admin', 'clinician'].includes(user.role)) {
        setDevVisible(v => !v);
      }
    }
  }

  const character = context?.tenant?.luno_variant === 'spiritual_companion' ? 'luna' : 'luno';
  const isL = character === 'luno';
  const capState = context?.capacity_state || 'steady';
  const cap = CAP[capState] || CAP.steady;

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function handleDiveIn() {
    // Children get the Air Dancer instead of the adult descent/session flow
    const bracket = context?.age_config?.bracket;
    if (bracket === 'elementary' || bracket === 'middle_school') {
      navigate('/app/child-breathe');
      return;
    }
    if (context?.next_session?.number) {
      navigate(`/app/session?s=${context.next_session.number}`);
    } else {
      navigate('/app/session');
    }
  }

  // Text colors adapt: dark on sky (top cards), light on water (bottom cards)
  const skyText = capState === 'depleted' ? 'rgba(60,50,65,0.75)' : 'rgba(50,40,30,0.85)';
  const skySub = capState === 'depleted' ? 'rgba(80,70,85,0.55)' : 'rgba(70,60,50,0.6)';
  const waterText = 'rgba(210,220,235,0.88)';
  const waterSub = 'rgba(160,180,210,0.5)';

  // Loading
  if (loading || !context) {
    return (
      <div style={S.container}>
        <SurfaceOcean coherence={0.1} capState="steady" character="luno" sessionCount={0} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(160,196,232,0.4)', fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Crisis mode
  if (crisis?.inCrisis) {
    return (
      <div style={S.container}>
        <SurfaceOcean coherence={0.1} capState={capState} character={character} sessionCount={context.total_sessions || 0} />
        <div style={{ textAlign: 'center', padding: '60px 20px', position: 'relative', zIndex: 1 }}>
          <p style={{ color: isL ? '#5ffce0' : '#f4b4c4', fontSize: 22, fontWeight: 300, lineHeight: 1.6, fontFamily: 'Outfit, sans-serif' }}>
            You're here.<br />That's enough.
          </p>
          <button onClick={handleDiveIn} style={S.crisisBtn}>Breathe</button>
        </div>
      </div>
    );
  }

  // LightBridge message
  let lightBridgeMsg = null;
  if (lightBridge?.family_states) {
    const warm = lightBridge.family_states.find(s => s.state === 'full' || s.state === 'steady');
    if (warm) lightBridgeMsg = `${warm.first_name}'s light is warm. They breathed today.`;
  }

  return (
    <div style={S.container}>
      <SurfaceOcean coherence={coherence} capState={capState} character={character} sessionCount={context.total_sessions || 0} />

      <div style={S.content}>
        {/* Session complete banner */}
        {showComplete && (
          <div style={S.completeBanner}>
            <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif' }}>
              Session complete. You showed up. That matters.
            </span>
          </div>
        )}

        {/* ═══ SKY ZONE (above waterline — light cards, dark text) ═══ */}

        {/* Greeting */}
        <div style={{ paddingTop: 48, marginBottom: 14 }}>
          <Card zone="sky">
            <p style={{ fontSize: 10, fontWeight: 300, letterSpacing: 2.5, color: skySub, textTransform: 'uppercase', margin: '0 0 3px' }}>
              {context.persona === 'FCLT' ? 'Facilitator' : context.persona === 'ELDR' ? 'Elder' : context.persona === 'AFAM' ? 'Family' : 'Welcome back'}
            </p>
            <h1 style={{ fontSize: 23, fontWeight: 200, color: skyText, letterSpacing: 0.5, margin: 0, fontFamily: 'Outfit, sans-serif' }}>
              {getGreeting()}, {context.first_name || user?.first_name || 'there'}.
            </h1>
          </Card>
        </div>

        {/* Capacity state */}
        <Card zone="sky" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 2, background: `linear-gradient(90deg,transparent,${cap.color}55,transparent)`, borderRadius: 2 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: cap.color, boxShadow: `0 0 10px ${cap.glow}`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: cap.color, letterSpacing: 0.8 }}>{cap.label}</div>
              <div style={{ fontSize: 11, fontWeight: 300, color: skySub, marginTop: 2 }}>{cap.desc}</div>
            </div>
            <CoherenceRings coherence={coherence} size={40} character={character} />
          </div>
          {context.streak > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 300, color: skySub, lineHeight: 1.7 }}>
                {context.streak} day streak · Your consistency is building something.
              </div>
            </div>
          )}
        </Card>

        {/* ═══ WATERLINE — MiniLuno sits here ═══ */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}>
          <MiniLuno size={48} character={character} coherence={coherence} onClick={handleLunoTap} />
        </div>

        {/* ═══ WATER ZONE (below waterline — dark cards, light text) ═══ */}

        {/* Next session — Dive In */}
        <Card zone="water" onClick={handleDiveIn}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <MiniLuno size={44} character={character} coherence={coherence} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 2, color: waterSub, textTransform: 'uppercase', marginBottom: 3 }}>Next Session</div>
              <div style={{ fontSize: 15, fontWeight: 300, color: waterText }}>
                {context.next_session ? `Session ${context.next_session.number} — ${context.next_session.title || ''}` : 'Session available'}
              </div>
              {context.next_session && (
                <div style={{ fontSize: 10, fontWeight: 300, color: 'rgba(160,180,210,0.35)', marginTop: 3 }}>
                  {context.next_session.arc || ''} · ~{context.next_session.duration_minutes || 12} min
                </div>
              )}
            </div>
          </div>
          <div style={{
            marginTop: 14, padding: '9px 0', textAlign: 'center',
            background: isL ? 'rgba(78,205,196,0.07)' : 'rgba(210,140,160,0.07)',
            border: `1px solid ${isL ? 'rgba(78,205,196,0.16)' : 'rgba(210,140,160,0.16)'}`,
            borderRadius: 22, fontSize: 12, fontWeight: 400, letterSpacing: 1.5,
            color: isL ? 'rgba(92,224,210,0.75)' : 'rgba(220,150,170,0.75)',
          }}>Dive In</div>
        </Card>

        {/* Recent art */}
        {recentArt.length > 0 && (
          <Card zone="water" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 2, color: waterSub, textTransform: 'uppercase', marginBottom: 10 }}>Recent Art</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {recentArt.map((a, i) => (
                <div key={i} onClick={() => navigate('/app/gallery')} style={S.artThumb}>
                  {a.ipfs_hash ? (
                    <img src={`https://gateway.pinata.cloud/ipfs/${a.ipfs_hash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0a2540, #112d4a)' }} />
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Gate 1 message */}
        {context.gate_state !== null && context.gate_state < 1 && (
          <Card zone="water" style={{ background: 'rgba(14,28,50,0.3)' }}>
            <p style={{ fontSize: 13, color: waterSub, margin: 0, fontFamily: 'Outfit, sans-serif' }}>
              Complete individual sessions to unlock family features
            </p>
          </Card>
        )}

        {/* Family pulse */}
        {context.features?.family_hub && familyMembers.length > 0 && (
          <Card zone="water">
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 2, color: waterSub, textTransform: 'uppercase', marginBottom: 11 }}>Family</div>
            <div style={{ display: 'flex', gap: 18, overflowX: 'auto', paddingBottom: 4 }}>
              {familyMembers.map((m, i) => {
                const mc = CAP[m.capacity_state] || CAP.steady;
                return (
                  <div key={i} style={{ textAlign: 'center', minWidth: 54 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      border: `1.5px solid ${mc.color}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 300, color: mc.color,
                      margin: '0 auto 5px', boxShadow: `0 0 8px ${mc.glow}`,
                      background: 'rgba(14,28,50,0.3)',
                    }}>{(m.firstName || m.first_name || '?')[0]}</div>
                    <div style={{ fontSize: 10, fontWeight: 300, color: 'rgba(210,220,235,0.55)' }}>{m.firstName || m.first_name}</div>
                    <div style={{ fontSize: 8, color: 'rgba(160,180,210,0.25)', marginTop: 1 }}>{mc.label}</div>
                  </div>
                );
              })}
            </div>

            {lightBridgeMsg && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(160,180,210,0.05)', fontSize: 11, fontWeight: 300, color: 'rgba(160,180,210,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF5E0', boxShadow: '0 0 6px rgba(255,245,224,0.45)' }} />
                {lightBridgeMsg}
              </div>
            )}
          </Card>
        )}

        {/* Co-breath suggestion */}
        {coBreathSuggestion && (
          <Card zone="water" style={{ background: 'rgba(14,28,50,0.3)', border: '1px solid rgba(160,180,210,0.05)' }}>
            <div style={{ fontSize: 12, fontWeight: 300, color: 'rgba(200,215,230,0.5)', lineHeight: 1.7, fontStyle: 'italic' }}>
              You and {coBreathSuggestion.partner_name} co-regulate best
              {coBreathSuggestion.best_day ? ` on ${coBreathSuggestion.best_day}` : ''}
              {coBreathSuggestion.best_time ? ` ${coBreathSuggestion.best_time}` : ''}.
              {' '}Want to invite them to breathe together?
            </div>
            <button onClick={() => navigate('/app/family')} style={S.coBreatheBtn}>
              Suggest a co-breath
            </button>
          </Card>
        )}

        {/* Dev controls */}
        {devVisible && (
          <div style={S.devPanel}>
            <p style={{ fontSize: 11, color: '#4fd1c5', marginBottom: 8 }}>Dev Panel</p>
            <p style={{ fontSize: 10, color: 'rgba(160,196,232,0.4)' }}>
              Persona: {context.persona} | Capacity: {capState} | Gate: {context.gate_state}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(160,196,232,0.4)' }}>
              Next: S{context.next_session?.number} | Streak: {context.streak} | Sessions: {context.total_sessions}
            </p>
          </div>
        )}

        <div style={{ height: 90 }} />
      </div>
    </div>
  );
}

function Card({ children, style, onClick, zone = 'water' }) {
  return (
    <div onClick={onClick} style={{
      background: zone === 'sky' ? 'rgba(255,255,255,0.15)' : 'rgba(14,28,50,0.45)',
      border: zone === 'sky' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(160,180,210,0.08)',
      borderRadius: 18, padding: '16px 18px', marginBottom: 12,
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.3s',
      ...style,
    }}>{children}</div>
  );
}

const S = {
  container: {
    minHeight: '100vh',
    background: '#0A1828',
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 2,
    padding: '0 20px',
    maxWidth: 430,
    margin: '0 auto',
    overflowY: 'auto',
    height: '100vh',
    WebkitOverflowScrolling: 'touch',
  },
  completeBanner: {
    background: 'rgba(79,209,197,0.1)',
    border: '1px solid rgba(79,209,197,0.2)',
    borderRadius: 12, padding: '12px 16px',
    marginBottom: 16, color: '#4fd1c5', textAlign: 'center',
  },
  artThumb: {
    width: 90, height: 90, borderRadius: 12, overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
  },
  coBreatheBtn: {
    marginTop: 10, padding: '8px 16px', borderRadius: 10,
    border: '1px solid rgba(79,209,197,0.2)', background: 'rgba(79,209,197,0.08)',
    color: 'rgba(79,209,197,0.7)', fontSize: 12, fontFamily: 'Outfit, sans-serif', cursor: 'pointer',
  },
  crisisBtn: {
    background: 'rgba(79,209,197,0.25)', color: '#4fd1c5', border: 'none',
    padding: '14px 36px', borderRadius: 14, fontSize: 16,
    fontFamily: 'Outfit, sans-serif', cursor: 'pointer', marginTop: 40,
  },
  devPanel: {
    background: 'rgba(10,22,40,0.8)', borderRadius: 12, padding: 12,
    border: '1px solid rgba(79,209,197,0.2)', marginBottom: 12,
  },
};
