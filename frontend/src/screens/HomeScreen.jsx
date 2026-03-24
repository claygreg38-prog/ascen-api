import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import Plankton from '../components/Plankton';
import MiniLuno from '../components/MiniLuno';
import AuroraHint from '../components/AuroraHint';
import Waves from '../components/Waves';
import CapacityCard from '../components/CapacityCard';
import SessionCard from '../components/SessionCard';
import SessionLauncher from '../components/SessionLauncher';

export default function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLauncher, setShowLauncher] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [lightBridge, setLightBridge] = useState(null);
  const [recentArt, setRecentArt] = useState([]);
  const [coherence, setCoherence] = useState(0.3);
  const [crisis, setCrisis] = useState(null);

  // Dev controls (hidden by default)
  const lunoTapRef = useRef({ count: 0, timeout: null });
  const [devVisible, setDevVisible] = useState(false);

  const user = getUser();

  const loadContext = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/context');
      setContext(res.data);

      // Load capacity coherence from recent balance
      try {
        const capRes = await api.get(`/api/capacity/balance/${res.data.user_id}`);
        if (capRes.data?.coherence) setCoherence(capRes.data.coherence);
      } catch {}

      // Load family members if feature enabled
      if (res.data.features?.family_hub && res.data.family_unit_id) {
        try {
          const famRes = await api.get(`/api/family/unit/${res.data.family_unit_id}`);
          setFamilyMembers(famRes.data?.members || []);
        } catch {}

        // Load LightBridge state
        if (res.data.features?.lightbridge) {
          try {
            const lbRes = await api.get('/api/lightbridge/state');
            setLightBridge(lbRes.data);
          } catch {}
        }
      }

      // Load recent art
      try {
        const artRes = await api.get(`/api/art/gallery/${res.data.user_id}?limit=2`);
        setRecentArt((artRes.data?.gallery || []).slice(0, 2));
      } catch {}

      // Check crisis status
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

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  // Handle return from session
  useEffect(() => {
    if (location.state?.sessionCompleted) {
      setShowComplete(true);
      loadContext(); // Re-fetch for fresh data
      const timer = setTimeout(() => setShowComplete(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state, loadContext]);

  // Triple-tap on MiniLuno for dev controls
  function handleLunoTap() {
    const t = lunoTapRef.current;
    t.count++;
    clearTimeout(t.timeout);
    t.timeout = setTimeout(() => { t.count = 0; }, 500);
    if (t.count >= 3) {
      t.count = 0;
      // Only facilitator/admin/clinician
      if (user && ['facilitator', 'admin', 'clinician'].includes(user.role)) {
        setDevVisible(v => !v);
      }
    }
  }

  // Determine character from tenant config
  const character = context?.tenant?.luno_variant === 'spiritual_companion' ? 'luna' : 'luno';

  // Greeting
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function handleBeginSession() {
    if (context?.next_session?.number) {
      navigate(`/app/session?s=${context.next_session.number}`);
    } else {
      navigate('/app/session');
    }
  }

  // Loading
  if (loading || !context) {
    return (
      <div style={S.container}>
        <Plankton coherence={0.1} sessionCount={0} character="luno" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <p style={{ color: 'rgba(160,196,232,0.4)', fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Crisis mode: minimal UI
  if (crisis?.inCrisis) {
    return (
      <div style={S.container}>
        <Plankton coherence={0.1} sessionCount={context.total_sessions || 0} character={character} />
        <div style={{ textAlign: 'center', padding: '60px 20px', position: 'relative', zIndex: 1 }}>
          <p style={{
            color: character === 'luna' ? '#f4b4c4' : '#5ffce0',
            fontSize: 22, fontWeight: 300, lineHeight: 1.6,
            fontFamily: 'Outfit, sans-serif'
          }}>
            You're here.<br />That's enough.
          </p>
          <button onClick={handleBeginSession} style={{ ...S.btn, marginTop: 40 }}>
            Breathe
          </button>
        </div>
      </div>
    );
  }

  // LightBridge message
  let lightBridgeMsg = null;
  if (lightBridge?.family_states) {
    const warm = lightBridge.family_states.find(s => s.state === 'full' || s.state === 'steady');
    if (warm) lightBridgeMsg = `${warm.first_name}'s light is warm`;
  }

  return (
    <div style={S.container}>
      {/* Background layers */}
      <Plankton coherence={coherence} sessionCount={context.total_sessions || 0} character={character} />
      <AuroraHint coherence={coherence} character={character} />
      <Waves character={character} />

      {/* Session launcher overlay */}
      {showLauncher && (
        <SessionLauncher
          nextSession={context.next_session}
          character={character}
          coherence={coherence}
          sessionCount={context.total_sessions || 0}
          onBegin={handleBeginSession}
          onClose={() => setShowLauncher(false)}
        />
      )}

      {/* Content */}
      <div style={S.content}>
        {/* Session complete banner */}
        {showComplete && (
          <div style={S.completeBanner}>
            <span style={{ fontSize: 13, fontFamily: 'Outfit, sans-serif' }}>
              Session complete. You showed up. That matters.
            </span>
          </div>
        )}

        {/* Greeting */}
        <div style={{ marginBottom: 8 }}>
          <h1 style={S.greeting}>
            {getGreeting()}, {context.first_name || user?.first_name || 'there'}
          </h1>
          <p style={{
            fontSize: 12, color: 'rgba(160,196,232,0.35)',
            fontFamily: 'Outfit, sans-serif', textTransform: 'capitalize',
            margin: 0
          }}>
            {context.persona === 'FCLT' ? 'Facilitator' :
             context.persona === 'ELDR' ? 'Elder' :
             context.persona === 'AFAM' ? 'Family' : ''}
            {context.streak > 0 && ` · ${context.streak} day streak`}
          </p>
        </div>

        {/* Capacity state */}
        <div style={{ marginBottom: 12 }}>
          <CapacityCard
            state={context.capacity_state}
            coherence={coherence}
            character={character}
          />
        </div>

        {/* Next session */}
        <div style={{ marginBottom: 16 }}>
          <SessionCard
            nextSession={context.next_session}
            character={character}
            coherence={coherence}
            onBegin={handleBeginSession}
          />
        </div>

        {/* Gate 1 message */}
        {context.gate_state !== null && context.gate_state < 1 && (
          <div style={S.gateCard}>
            <p style={{ fontSize: 13, color: 'rgba(160,196,232,0.5)', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
              Complete individual sessions to unlock family features
            </p>
          </div>
        )}

        {/* Family pulse — only if features.family_hub */}
        {context.features?.family_hub && familyMembers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={S.sectionLabel}>Family Pulse</p>
            <div style={S.familyRow}>
              {familyMembers.map((m, i) => (
                <div key={i} style={S.familyMember}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(79,209,197,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: '#4fd1c5', fontFamily: 'Outfit, sans-serif'
                  }}>
                    {(m.first_name || '?')[0]}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(160,196,232,0.5)', marginTop: 4, fontFamily: 'Outfit, sans-serif' }}>
                    {m.first_name}
                  </span>
                  <CapDot state={m.capacity_state || 'steady'} />
                </div>
              ))}
            </div>

            {/* LightBridge indicator */}
            {lightBridgeMsg && (
              <p style={{
                fontSize: 12, color: 'rgba(160,196,232,0.4)',
                fontStyle: 'italic', marginTop: 8,
                fontFamily: 'Outfit, sans-serif'
              }}>
                {lightBridgeMsg}
              </p>
            )}

            {/* Co-breath suggestion for ELDR */}
            {context.features?.co_breath && context.persona === 'ELDR' && familyMembers.length > 1 && (
              <button
                onClick={() => navigate('/app/family')}
                style={S.coBreatheBtn}
              >
                Suggest a co-breath
              </button>
            )}
          </div>
        )}

        {/* Recent art */}
        {recentArt.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={S.sectionLabel}>Recent</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {recentArt.map((a, i) => (
                <div
                  key={i}
                  onClick={() => navigate('/app/gallery')}
                  style={S.artThumb}
                >
                  {a.ipfs_hash ? (
                    <img
                      src={`https://gateway.pinata.cloud/ipfs/${a.ipfs_hash}`}
                      alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: 'linear-gradient(135deg, #0a2540, #112d4a)'
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MiniLuno (triple-tap for dev) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: 16 }}>
          <MiniLuno
            size={32}
            character={character}
            coherence={coherence}
            onClick={handleLunoTap}
          />
        </div>

        {/* Dev controls — hidden by default */}
        {devVisible && (
          <div style={S.devPanel}>
            <p style={{ fontSize: 11, color: '#4fd1c5', marginBottom: 8 }}>Dev Panel</p>
            <p style={{ fontSize: 10, color: 'rgba(160,196,232,0.4)' }}>
              Persona: {context.persona} | Capacity: {context.capacity_state} | Gate: {context.gate_state}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(160,196,232,0.4)' }}>
              Next: S{context.next_session?.number} | Streak: {context.streak} | Sessions: {context.total_sessions}
            </p>
          </div>
        )}

        {/* Spacer for bottom nav */}
        <div style={{ height: 90 }} />
      </div>
    </div>
  );
}

function CapDot({ state }) {
  const colors = {
    full: '#68d391', steady: '#4fd1c5', drawing_down: '#f6ad55',
    low: '#fc8181', depleted: '#e53e3e', private: '#718096'
  };
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%',
      background: colors[state] || colors.steady,
      marginTop: 3
    }} />
  );
}

const S = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #020812 0%, #061a2a 40%, #0a1628 100%)',
    position: 'relative',
    overflow: 'hidden'
  },
  content: {
    position: 'relative',
    zIndex: 1,
    padding: '24px 20px',
    maxWidth: 420,
    margin: '0 auto'
  },
  greeting: {
    fontSize: 26,
    fontWeight: 300,
    color: '#e2e8f0',
    margin: 0,
    fontFamily: 'Outfit, sans-serif'
  },
  completeBanner: {
    background: 'rgba(79,209,197,0.1)',
    border: '1px solid rgba(79,209,197,0.2)',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 16,
    color: '#4fd1c5',
    textAlign: 'center'
  },
  sectionLabel: {
    fontSize: 11,
    color: 'rgba(160,196,232,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 8,
    fontFamily: 'Outfit, sans-serif'
  },
  familyRow: {
    display: 'flex',
    gap: 16,
    overflowX: 'auto',
    paddingBottom: 4
  },
  familyMember: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2
  },
  gateCard: {
    background: 'rgba(10,22,40,0.5)',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 12,
    border: '1px solid rgba(255,255,255,0.04)'
  },
  artThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer'
  },
  coBreatheBtn: {
    marginTop: 10,
    padding: '8px 16px',
    borderRadius: 10,
    border: '1px solid rgba(79,209,197,0.2)',
    background: 'rgba(79,209,197,0.08)',
    color: 'rgba(79,209,197,0.7)',
    fontSize: 12,
    fontFamily: 'Outfit, sans-serif',
    cursor: 'pointer'
  },
  btn: {
    background: 'rgba(79,209,197,0.25)',
    color: '#4fd1c5',
    border: 'none',
    padding: '14px 36px',
    borderRadius: 14,
    fontSize: 16,
    fontFamily: 'Outfit, sans-serif',
    cursor: 'pointer'
  },
  devPanel: {
    background: 'rgba(10,22,40,0.8)',
    borderRadius: 12,
    padding: 12,
    border: '1px solid rgba(79,209,197,0.2)',
    marginBottom: 12
  }
};
