import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../services/auth';
import api from '../services/api';
import OceanPatio from '../components/OceanPatio';
import MiniLuno from '../components/MiniLuno';

// ═══════════════════════════════════════════════════════════════
// KitchenTableScreen — Golden Hour Patio
// Own visual world. NOT the ocean dashboard.
// Solo mode first, then co-present (locked decision).
// Capacity-gated topics. Biometric monitoring invisible.
// Auto-transition to breath if sustained dysregulation >3 min.
// ═══════════════════════════════════════════════════════════════

const CAP = {
  full:         { label: 'Full',         color: '#5CE0D0' },
  steady:       { label: 'Steady',       color: '#A8CCE8' },
  drawing_down: { label: 'Drawing Down', color: '#E8BE6A' },
  low:          { label: 'Low',          color: '#E09878' },
  depleted:     { label: 'Depleted',     color: '#D88AA0' },
};

export default function KitchenTableScreen() {
  const nav = useNavigate();
  const user = getUser();

  const [mode, setMode] = useState('solo'); // solo | virtual | in_person
  const [capState, setCapState] = useState('steady');
  const [character, setCharacter] = useState('luno');
  const [coherence, setCoherence] = useState(0.5);
  const [sessionKey, setSessionKey] = useState(null);

  // Topic state
  const [topic, setTopic] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [activePrompt, setActivePrompt] = useState(-1);
  const [responses, setResponses] = useState({});

  // Session state
  const [elapsed, setElapsed] = useState(0);
  const [dysTimer, setDysTimer] = useState(0);
  const [showBreathe, setShowBreathe] = useState(false);

  // Co-present state
  const [members, setMembers] = useState([]);
  const [speakingMember, setSpeakingMember] = useState(null);

  const isL = character === 'luno';

  // Load context + topic
  useEffect(() => {
    (async () => {
      try {
        const ctx = await api.get('/api/auth/context');
        setCapState(ctx.data.capacity_state || 'steady');
        setCharacter(ctx.data.tenant?.luno_variant === 'spiritual_companion' ? 'luna' : 'luno');

        // Load topic (capacity-filtered by backend)
        const topicRes = await api.get('/api/kitchen-table/topic');
        if (topicRes.data) {
          setTopic(topicRes.data);
          // Build prompts array from topic data
          const p = [];
          if (topicRes.data.prompt_text) p.push({ text: topicRes.data.prompt_text, sens: 'medium' });
          if (topicRes.data.prompts) p.push(...topicRes.data.prompts);
          if (topicRes.data.follow_up_prompts) p.push(...topicRes.data.follow_up_prompts.map(t => ({ text: t, sens: 'low' })));
          setPrompts(p);
        }

        // Load family members for co-present
        if (ctx.data.family_unit_id) {
          try {
            const famRes = await api.get(`/api/family/unit/${ctx.data.family_unit_id}`);
            setMembers(famRes.data?.members || []);
          } catch {}
        }
      } catch (err) {
        console.error('[KT] Failed to load:', err);
      }
    })();
  }, []);

  // Start kitchen table session
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post('/api/kitchen-table/start', {
          topic_id: topic?.id,
          mode,
        });
        if (res.data?.session_key) setSessionKey(res.data.session_key);
      } catch {}
    })();
  }, [topic?.id]);

  // Elapsed timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Dysregulation timer — invisible to user
  useEffect(() => {
    if (capState === 'low' || capState === 'depleted') {
      const iv = setInterval(() => setDysTimer(t => {
        if (t >= 180) { setShowBreathe(true); return 180; }
        return t + 1;
      }), 1000);
      return () => clearInterval(iv);
    } else {
      setDysTimer(0);
    }
  }, [capState]);

  // Biometric tick (invisible monitoring)
  useEffect(() => {
    if (!sessionKey) return;
    const iv = setInterval(async () => {
      try {
        await api.post('/api/kitchen-table/tick', {
          session_key: sessionKey,
          biometrics: { coherence, capacity_state: capState },
        });
      } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [sessionKey, coherence, capState]);

  // Co-present speaking simulation
  useEffect(() => {
    if (mode === 'solo') return;
    const iv = setInterval(() => setSpeakingMember(s => s === 0 ? 1 : s === 1 ? null : 0), 4000);
    return () => clearInterval(iv);
  }, [mode]);

  async function handleComplete() {
    try {
      await api.post('/api/kitchen-table/complete', { session_key: sessionKey });
    } catch {}
    nav('/app/family');
  }

  function handleTransitionToBreath() {
    handleComplete();
    nav('/app/session');
  }

  const isTogether = mode !== 'solo';

  // ── BREATH TRANSITION OVERLAY ──
  if (showBreathe) {
    return (
      <div style={S.container}>
        <OceanPatio coherence={coherence} capState={capState} character={character} />
        <div style={{ ...S.overlay, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <MiniLuno size={80} character={character} coherence={coherence} />
          <p style={{ marginTop: 28, fontSize: 13, fontWeight: 300, color: 'rgba(160,90,50,0.85)', lineHeight: 1.7, textAlign: 'center', maxWidth: 280, fontFamily: 'Outfit, sans-serif' }}>
            Your body is telling us it's time to breathe.
          </p>
          <button onClick={handleTransitionToBreath} style={S.breathBtn}>
            Let's breathe
          </button>
          <button onClick={() => setShowBreathe(false)} style={S.backLink}>
            stay at the table
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <OceanPatio coherence={coherence} capState={capState} character={character} />

      <div style={S.content}>
        {/* Header */}
        <div style={{ paddingTop: 44, marginBottom: 4 }}>
          <div style={S.headerLabel}>
            Kitchen Table{mode === 'solo' ? ' · Solo' : mode === 'virtual' ? ' · Virtual' : ' · In Person'}
          </div>
        </div>

        {topic && (
          <h2 style={S.title}>{topic.title || topic.category || 'Discussion'}</h2>
        )}

        {/* Co-present members */}
        {isTogether && members.length > 0 && (
          <div style={S.presenceRow}>
            <div style={S.presenceLabel}>{mode === 'virtual' ? 'Connected' : 'Present'}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
              {members.slice(0, 4).map((m, i) => {
                const mc = CAP[m.capacity_state || m.state] || CAP.steady;
                const isSpeaking = speakingMember === i;
                return (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      border: `2.5px solid ${mc.color}${isSpeaking ? 'aa' : '44'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 300, color: mc.color,
                      background: 'rgba(40,32,24,0.5)',
                      boxShadow: isSpeaking ? `0 0 16px ${mc.color}44` : `0 0 6px ${mc.color}22`,
                      transition: 'all 0.5s',
                    }}>
                      {(m.first_name || m.firstName || '?')[0]}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(220,210,195,0.6)', marginTop: 4 }}>
                      {m.first_name || m.firstName}
                    </div>
                    <div style={{ fontSize: 8, color: mc.color, fontWeight: 500, marginTop: 1 }}>{mc.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, paddingLeft: 3 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: mode === 'virtual' ? '#5CE0D0' : '#E8BE6A' }} />
              <div style={{ fontSize: 8, color: 'rgba(200,185,165,0.25)' }}>
                {mode === 'virtual' ? 'All members connected' : 'Facilitator present · Wearables synced'}
              </div>
            </div>
          </div>
        )}

        {/* Introduction */}
        {topic && (
          <div style={S.introCard}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ paddingTop: 4 }}>
                <MiniLuno size={30} character={character} coherence={coherence} />
              </div>
              <p style={S.introText}>
                {topic.description || topic.prompt_text || 'Take a moment. Breathe. When you are ready, explore the prompts below.'}
              </p>
            </div>
          </div>
        )}

        {/* Prompts */}
        {prompts.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {prompts.map((pr, i) => {
              const isAct = activePrompt === i;
              const sc = pr.sens === 'high' ? '#D4A44C' : pr.sens === 'medium' ? '#8BAFC8' : '#6CB8B0';
              return (
                <div key={i} onClick={() => setActivePrompt(isAct ? -1 : i)} style={{
                  background: isAct ? 'rgba(40,32,24,0.72)' : 'rgba(40,32,24,0.55)',
                  border: `1px solid ${isAct ? 'rgba(210,185,150,0.16)' : 'rgba(160,140,110,0.06)'}`,
                  borderRadius: 16, padding: '18px 20px', marginBottom: 12, cursor: 'pointer',
                  transition: 'all 0.3s', boxShadow: isAct ? '0 4px 20px rgba(0,0,0,0.12)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc, marginTop: 7, flexShrink: 0, boxShadow: `0 0 5px ${sc}44` }} />
                    <p style={{ fontSize: 14.5, fontWeight: 300, color: 'rgba(230,220,205,0.88)', lineHeight: 1.8, flex: 1, margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                      {pr.text}
                    </p>
                  </div>

                  {isAct && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }} onClick={e => e.stopPropagation()}>
                      {isTogether && members.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
                          {members.slice(0, 2).map((m, mi) => {
                            const mc = CAP[m.capacity_state || m.state] || CAP.steady;
                            return (
                              <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${mc.color}22` }}>
                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: mc.color }} />
                                <span style={{ fontSize: 8, color: 'rgba(220,210,195,0.35)' }}>{m.first_name || m.firstName} reflecting...</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <textarea
                        placeholder="What comes up for you..."
                        value={responses[i] || ''}
                        onChange={e => setResponses({ ...responses, [i]: e.target.value })}
                        style={S.textarea}
                      />
                      <p style={{ fontSize: 8, color: 'rgba(200,190,170,0.2)', marginTop: 7 }}>
                        Your words are yours. The system reads only that you engaged, not what you wrote.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No topic loaded */}
        {!topic && (
          <div style={S.introCard}>
            <p style={{ ...S.introText, textAlign: 'center' }}>Loading today's topic...</p>
          </div>
        )}

        {/* Bottom bar: timer + breathe button */}
        <div style={S.bottomBar}>
          <span style={S.timer}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          <button onClick={handleTransitionToBreath} style={S.readyBtn}>
            {isTogether ? "We're ready to breathe" : "I'm ready to breathe"}
          </button>
        </div>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 100 }}>
          <button onClick={handleComplete} style={S.backLink}>back to family</button>
        </div>
      </div>

      {/* Biometric edge pulse — invisible to user, shows system is monitoring */}
      {(capState === 'low' || capState === 'depleted') && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5,
          border: `2px solid ${CAP[capState].color}15`,
          borderRadius: 0,
          animation: 'edgePulse 3s ease-in-out infinite',
        }} />
      )}

      {/* Mode switcher (dev) */}
      <div style={S.devBar}>
        {['solo', 'virtual', 'in_person'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            ...S.devBtn,
            background: mode === m ? 'rgba(210,180,130,0.12)' : 'rgba(30,25,20,0.6)',
            borderColor: mode === m ? 'rgba(210,180,130,0.22)' : 'rgba(120,100,80,0.06)',
            color: mode === m ? 'rgba(230,200,150,0.85)' : 'rgba(160,145,125,0.28)',
          }}>{m.replace('_', ' ')}</button>
        ))}
        {Object.keys(CAP).map(s => (
          <button key={s} onClick={() => setCapState(s)} style={{
            ...S.devBtn, fontSize: 6, padding: '2px 5px',
            background: capState === s ? `${CAP[s].color}15` : 'rgba(30,25,20,0.6)',
            borderColor: capState === s ? CAP[s].color + '25' : 'rgba(120,100,80,0.05)',
            color: capState === s ? CAP[s].color : 'rgba(160,145,125,0.22)',
          }}>{s.split('_')[0]}</button>
        ))}
      </div>

      <style>{`
        @keyframes edgePulse {
          0%, 100% { border-color: transparent; }
          50% { border-color: rgba(224,152,120,0.08); }
        }
      `}</style>
    </div>
  );
}

const S = {
  container: {
    width: '100%', maxWidth: 430, margin: '0 auto', minHeight: '100vh',
    position: 'relative', overflow: 'hidden', fontFamily: "'Outfit',-apple-system,sans-serif",
  },
  overlay: {
    position: 'relative', zIndex: 2, height: '100vh', padding: '0 32px',
  },
  content: {
    position: 'relative', zIndex: 2, height: '100vh', overflowY: 'auto',
    WebkitOverflowScrolling: 'touch', padding: '0 24px',
  },
  headerLabel: {
    fontSize: 9, fontWeight: 500, letterSpacing: 2.5, color: 'rgba(80,60,40,0.5)', textTransform: 'uppercase',
  },
  title: {
    fontSize: 22, fontWeight: 200, color: 'rgba(55,40,25,0.88)', marginBottom: 16, lineHeight: 1.3, fontFamily: 'Outfit, sans-serif',
  },
  presenceRow: {
    marginBottom: 20, padding: '15px 14px 11px', background: 'rgba(40,32,24,0.42)',
    border: '1px solid rgba(200,180,150,0.08)', borderRadius: 18, position: 'relative',
  },
  presenceLabel: {
    position: 'absolute', top: 4, left: 11, fontSize: 7, letterSpacing: 1.5,
    color: 'rgba(200,185,165,0.16)', textTransform: 'uppercase',
  },
  introCard: {
    background: 'rgba(255,245,230,0.1)', border: '1px solid rgba(210,185,150,0.1)',
    borderRadius: 18, padding: '20px 22px', marginBottom: 20,
  },
  introText: {
    fontSize: 14, fontWeight: 300, color: 'rgba(55,42,28,0.78)', lineHeight: 1.85,
    fontStyle: 'italic', flex: 1, margin: 0, fontFamily: 'Outfit, sans-serif',
  },
  textarea: {
    width: '100%', minHeight: 80, padding: 14, background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)', borderRadius: 11,
    color: 'rgba(220,210,195,0.7)', fontSize: 13, fontFamily: "'Outfit',sans-serif",
    fontWeight: 300, lineHeight: 1.7, resize: 'none', outline: 'none',
  },
  bottomBar: {
    marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 14, borderTop: '1px solid rgba(200,185,165,0.05)',
  },
  timer: {
    fontSize: 9, color: 'rgba(200,185,165,0.2)', fontVariantNumeric: 'tabular-nums',
  },
  readyBtn: {
    padding: '11px 28px', background: 'rgba(78,205,196,0.08)',
    border: '1px solid rgba(78,205,196,0.2)', borderRadius: 24,
    fontSize: 12, fontWeight: 400, letterSpacing: 1.5,
    color: 'rgba(70,195,185,0.85)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
  },
  breathBtn: {
    marginTop: 20, padding: '11px 28px', background: 'rgba(78,205,196,0.1)',
    border: '1px solid rgba(78,205,196,0.25)', borderRadius: 22,
    fontSize: 11, fontWeight: 400, letterSpacing: 1.5,
    color: 'rgba(50,180,170,0.9)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
  },
  backLink: {
    background: 'none', border: 'none', fontSize: 11, color: 'rgba(200,185,165,0.2)',
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: '8px 12px',
  },
  devBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300, maxWidth: 430,
    margin: '0 auto', padding: '5px 10px 8px', background: 'rgba(25,20,15,0.94)',
    borderTop: '1px solid rgba(200,185,165,0.06)', display: 'flex', gap: 3, flexWrap: 'wrap',
  },
  devBtn: {
    padding: '2px 8px', fontSize: 7, border: '1px solid', borderRadius: 6,
    cursor: 'pointer', fontFamily: 'Outfit',
  },
};
