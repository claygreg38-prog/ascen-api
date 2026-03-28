import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser } from '../services/auth';
import api from '../services/api';
import BioRing, { BioDetailPanel } from '../components/BioRing';
import SessionTimeline from '../components/SessionTimeline';

// ═══════════════════════════════════════════════════════════════
// ClinicianDashboardScreen — The Nervous System Orchestra
// Route: /app/clinician/session/:id
// Requires clinician role. NEVER shown to families.
// 4-zone grid: NS Map | Prompt+Engagement | Timeline | Alerts
// WebSocket connection to co-breath room for live biometrics.
// ═══════════════════════════════════════════════════════════════

const CAP_COLORS = {
  full:         '#5CE0D0',
  steady:       '#A8CCE8',
  drawing_down: '#E8BE6A',
  low:          '#E09878',
  depleted:     '#D88AA0',
};

const SENSITIVITY_COLORS = { high: '#E8BE6A', medium: '#A8CCE8', low: '#5CE0D0' };

const ALERT_STYLES = {
  coaching:       { border: 'rgba(232,190,106,0.3)', bg: 'rgba(232,190,106,0.04)' },
  co_regulation:  { border: 'rgba(92,224,208,0.3)',  bg: 'rgba(92,224,208,0.04)' },
  dysregulation:  { border: 'rgba(224,152,120,0.4)', bg: 'rgba(224,152,120,0.05)' },
};

const COACH_ME_COOLDOWN = 30000; // 30 seconds

export default function ClinicianDashboardScreen() {
  const { id: sessionId } = useParams();
  const nav = useNavigate();
  const user = getUser();

  // ── Core state ──
  const [sessionInfo, setSessionInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [wearableCount, setWearableCount] = useState(0);

  // ── Prompt + Engagement state ──
  const [currentTopic, setCurrentTopic] = useState(null);
  const [topics, setTopics] = useState([]);
  const [activeTopicIdx, setActiveTopicIdx] = useState(-1);
  const [engagement, setEngagement] = useState({}); // userId → { status }
  const [paused, setPaused] = useState(false);

  // ── Timeline state (ref-based data accumulation) ──
  const biometricHistoryRef = useRef([]);
  const [biometricHistory, setBiometricHistory] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const sessionStartRef = useRef(Date.now());

  // ── Alerts + Coaching state ──
  const [alerts, setAlerts] = useState([]);
  const [coachMeResult, setCoachMeResult] = useState(null);
  const [coachMeLoading, setCoachMeLoading] = useState(false);
  const lastCoachMeRef = useRef(0);

  // ── WebSocket ──
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);
  const reconnectRef = useRef(null);
  const reconnectDelayRef = useRef(1000);

  // ── Auth guard ──
  useEffect(() => {
    if (!user || !['clinician', 'admin'].includes(user.role)) {
      nav('/app/login');
    }
  }, [user, nav]);

  // ── Load session info ──
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/kitchen-table/clinical/session/report/${sessionId}`);
        setSessionInfo(data);
        if (data.coaching_cards?.length) {
          setAlerts(data.coaching_cards.map(c => ({
            id: c.id, type: 'coaching', member: c.member_name || '',
            title: c.title || 'Coaching card', body: c.body || c.observed || '',
            observed: c.observed, likely: c.likely, consider: c.consider,
            timestamp: c.created_at ? new Date(c.created_at).getTime() - sessionStartRef.current : 0,
          })));
        }
      } catch {}
    })();
  }, [sessionId]);

  // ── Elapsed timer ──
  useEffect(() => {
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // ── WebSocket connection ──
  const connectWS = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = localStorage.getItem('ascen_jwt');
    const ws = new WebSocket(`${proto}//${host}/ws/cobreath?room=${sessionId}&token=${token}&role=clinician`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      reconnectDelayRef.current = 1000;
      // Join as clinician observer
      ws.send(JSON.stringify({ type: 'join', roomCode: sessionId, userId: user?.userId || user?.participant_id, role: 'clinician' }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        handleWSMessage(msg);
      } catch {}
    };

    ws.onclose = () => {
      setWsConnected(false);
      // Exponential backoff reconnect
      const delay = reconnectDelayRef.current;
      reconnectRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(delay * 2, 30000);
        connectWS();
      }, delay);
    };

    ws.onerror = () => {};
  }, [sessionId, user]);

  function handleWSMessage(msg) {
    const now = Date.now() - sessionStartRef.current;

    switch (msg.type) {
      case 'biometric_update': {
        const m = msg;
        // Update member biometrics
        setMembers(prev => {
          const idx = prev.findIndex(p => (p.user_id || p.userId) === m.user_id);
          const updated = {
            user_id: m.user_id, first_name: m.first_name || m.firstName,
            hr: m.hr, hrv: m.hrv, coherence: m.coherence, rr: m.rr, ns3: m.ns3,
            capacity_state: m.capacity_state,
          };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...updated };
            return next;
          }
          return [...prev, updated];
        });

        // Update selected member if it matches
        setSelectedMember(prev => {
          if (prev && (prev.user_id === m.user_id || prev.userId === m.user_id)) {
            return { ...prev, hr: m.hr, hrv: m.hrv, coherence: m.coherence, rr: m.rr, ns3: m.ns3, capacity_state: m.capacity_state };
          }
          return prev;
        });

        // Accumulate for timeline
        biometricHistoryRef.current.push({ user_id: m.user_id, hrv: m.hrv, capacity_state: m.capacity_state, timestamp: now });
        setBiometricHistory([...biometricHistoryRef.current]);

        // Count wearables (unique members with hr > 0)
        setWearableCount(prev => {
          const ids = new Set(biometricHistoryRef.current.filter(t => t.user_id).map(t => t.user_id));
          return ids.size;
        });
        break;
      }

      case 'engagement_changed': {
        setEngagement(prev => ({
          ...prev,
          [msg.user_id]: { status: msg.status, name: msg.first_name || msg.firstName },
        }));
        break;
      }

      case 'coaching_card': {
        const card = {
          id: msg.id || Date.now(),
          type: 'coaching',
          member: msg.member_name || msg.first_name || '',
          title: msg.title || 'Coaching insight',
          body: msg.body || '',
          observed: msg.observed, likely: msg.likely, consider: msg.consider,
          timestamp: now,
        };
        setAlerts(prev => [card, ...prev]);
        setTimelineEvents(prev => [...prev, { type: 'coaching_card', timestamp: now, label: 'Coaching' }]);
        break;
      }

      case 'dysregulation_alert': {
        const alert = {
          id: msg.id || Date.now(),
          type: 'dysregulation',
          member: msg.member_name || msg.first_name || '',
          title: 'Activation detected',
          body: msg.body || `${msg.member_name || 'Member'} showing sustained activation`,
          observed: msg.observed, likely: msg.likely, consider: msg.consider,
          timestamp: now,
        };
        setAlerts(prev => [alert, ...prev]);
        setTimelineEvents(prev => [...prev, { type: 'dysregulation', timestamp: now, label: msg.member_name || 'Alert' }]);
        break;
      }

      case 'co_regulation_detected': {
        const coReg = {
          id: msg.id || Date.now(),
          type: 'co_regulation',
          member: msg.members_involved || '',
          title: 'Co-regulation emerging',
          body: msg.body || 'Multiple family members synchronizing',
          timestamp: now,
        };
        setAlerts(prev => [coReg, ...prev]);
        break;
      }

      case 'prompt_activated': {
        setCurrentTopic(msg.topic);
        if (msg.topics) setTopics(msg.topics);
        setActiveTopicIdx(msg.active_index ?? -1);
        setTimelineEvents(prev => [...prev, { type: 'topic_activated', timestamp: now, label: msg.topic?.title || 'Topic' }]);
        break;
      }
    }
  }

  useEffect(() => {
    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connectWS]);

  // ── Session controls ──
  async function handleCoBreath() {
    try {
      await api.post('/api/kitchen-table/co-breath/start', { session_id: sessionId });
      setTimelineEvents(prev => [...prev, { type: 'co_breath', timestamp: Date.now() - sessionStartRef.current, label: 'Co-Breath' }]);
    } catch (err) {
      console.error('[Dashboard] Co-breath start failed:', err.message);
    }
  }

  async function handleNextPrompt() {
    try {
      const nextIdx = activeTopicIdx + 1;
      const nextTopic = topics[nextIdx];
      if (!nextTopic) return;
      await api.post('/api/kitchen-table/clinical/prompt/activate', {
        session_id: sessionId,
        topic_id: nextTopic.id,
        member_ids: members.map(m => m.user_id || m.userId),
      });
      setActiveTopicIdx(nextIdx);
      setCurrentTopic(nextTopic);
    } catch (err) {
      console.error('[Dashboard] Next prompt failed:', err.message);
    }
  }

  async function handlePause() {
    try {
      await api.post('/api/abi/session/pause', { session_id: sessionId });
      setPaused(p => !p);
    } catch (err) {
      console.error('[Dashboard] Pause failed:', err.message);
    }
  }

  // ── Coach Me ──
  async function handleCoachMe() {
    const now = Date.now();
    if (now - lastCoachMeRef.current < COACH_ME_COOLDOWN) return;
    lastCoachMeRef.current = now;
    setCoachMeLoading(true);

    try {
      const baselines = {};
      members.forEach(m => {
        baselines[m.user_id || m.userId] = { hr: m.hr, hrv: m.hrv, coherence: m.coherence };
      });

      const { data } = await api.post('/api/kitchen-table/clinical/coach-me', {
        session_id: sessionId,
        members: members.map(m => ({
          user_id: m.user_id || m.userId,
          first_name: m.first_name || m.firstName,
          hr: m.hr, hrv: m.hrv, coherence: m.coherence, rr: m.rr, ns3: m.ns3,
          capacity_state: m.capacity_state,
        })),
        baselines,
        engagement_states: engagement,
      });

      setCoachMeResult(data.card || data);
    } catch (err) {
      if (err.response?.status === 429) {
        setCoachMeResult({ observed: 'Rate limited. Wait 30 seconds.', likely: '', consider: '' });
      } else {
        console.error('[Dashboard] Coach Me failed:', err.message);
      }
    } finally {
      setCoachMeLoading(false);
    }
  }

  // ── Family Engagement (child Air Dancer data) ──
  const [familyEngagement, setFamilyEngagement] = useState(null);
  const [familyEngagementLoading, setFamilyEngagementLoading] = useState(false);

  // Load child engagement when session info is available
  useEffect(() => {
    if (!sessionInfo?.family_unit_id) return;
    setFamilyEngagementLoading(true);
    api.get(`/api/child-session/family/${sessionInfo.family_unit_id}`)
      .then(({ data }) => setFamilyEngagement(data))
      .catch(() => setFamilyEngagement(null))
      .finally(() => setFamilyEngagementLoading(false));
  }, [sessionInfo?.family_unit_id]);

  const trendIndicator = (t) => {
    if (t === 'increasing') return '\u2191';
    if (t === 'decreasing') return '\u2193';
    if (t === 'steady') return '\u2192';
    return '\uD83C\uDF31'; // seedling for 'new'
  };

  // ── Breath Bridge status ──
  const [breathBridge, setBreathBridge] = useState(null);
  const [bbPauseInput, setBbPauseInput] = useState('');
  const [bbPausing, setBbPausing] = useState(false);

  useEffect(() => {
    if (!sessionInfo?.family_unit_id) return;
    api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}`)
      .then(({ data }) => setBreathBridge(data))
      .catch(() => setBreathBridge(null));
  }, [sessionInfo?.family_unit_id]);

  async function handleBbPause() {
    if (!bbPauseInput.trim() || !sessionInfo?.family_unit_id) return;
    setBbPausing(true);
    try {
      await api.post(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/pause`, { reason: bbPauseInput.trim() });
      setBbPauseInput('');
      const { data } = await api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}`);
      setBreathBridge(data);
    } catch (err) {
      console.error('[Dashboard] BB pause failed:', err.message);
    } finally {
      setBbPausing(false);
    }
  }

  async function handleBbResume() {
    if (!sessionInfo?.family_unit_id) return;
    try {
      await api.post(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/resume`);
      const { data } = await api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}`);
      setBreathBridge(data);
    } catch (err) {
      console.error('[Dashboard] BB resume failed:', err.message);
    }
  }

  async function handleBbCadence(cap) {
    if (!sessionInfo?.family_unit_id) return;
    try {
      await api.put(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/cadence`, { weekly_message_cap: cap });
      const { data } = await api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}`);
      setBreathBridge(data);
    } catch (err) {
      console.error('[Dashboard] BB cadence failed:', err.message);
    }
  }

  // ── Coaching progress ──
  const [coachingProgress, setCoachingProgress] = useState(null);

  useEffect(() => {
    if (!sessionInfo?.family_unit_id) return;
    api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/coaching-progress`)
      .then(({ data }) => setCoachingProgress(data))
      .catch(() => setCoachingProgress(null));
  }, [sessionInfo?.family_unit_id]);

  async function handleGateOverride(gate) {
    if (!sessionInfo?.family_unit_id) return;
    try {
      await api.post(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/gate-override`, { gate });
      const { data } = await api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/coaching-progress`);
      setCoachingProgress(data);
    } catch (err) { console.error('[Dashboard] Gate override failed:', err.message); }
  }

  async function handleEmphasis(domain) {
    if (!sessionInfo?.family_unit_id) return;
    try {
      await api.put(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/emphasis`, { domain: domain || null });
      const { data } = await api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/coaching-progress`);
      setCoachingProgress(data);
    } catch (err) { console.error('[Dashboard] Emphasis update failed:', err.message); }
  }

  async function handlePostRelease() {
    if (!sessionInfo?.family_unit_id) return;
    try {
      await api.post(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/post-release`);
      const { data } = await api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/coaching-progress`);
      setCoachingProgress(data);
    } catch (err) { console.error('[Dashboard] Post-release failed:', err.message); }
  }

  async function handleEnableCoaching() {
    if (!sessionInfo?.family_unit_id) return;
    try {
      await api.post(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/enable-coaching`);
      const { data } = await api.get(`/api/breath-bridge/family/${sessionInfo.family_unit_id}/coaching-progress`);
      setCoachingProgress(data);
    } catch (err) { console.error('[Dashboard] Enable coaching failed:', err.message); }
  }

  // ── Dismiss alert ──
  async function dismissAlert(alertId) {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    try {
      await api.post('/api/kitchen-table/clinical/coaching/feedback', { card_id: alertId, was_seen: true });
    } catch {}
  }

  // ── Format elapsed ──
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Engagement dot color ──
  const engDot = (status) => {
    if (status === 'reflecting') return '#E8BE6A';
    if (status === 'listening') return '#5CE0D0';
    return '#E09878'; // disengaged/withdrawn
  };

  const sensColor = (sens) => SENSITIVITY_COLORS[sens] || SENSITIVITY_COLORS.low;

  return (
    <div style={S.root}>
      {/* ── Header bar ── */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.logo}>ASCEN</span>
          <span style={S.sessionName}>{sessionInfo?.session_id ? `Session ${sessionId}` : 'Loading...'}</span>
        </div>
        <div style={S.headerRight}>
          <span style={S.elapsed}>{fmtTime(elapsed)}</span>
          <span style={S.wearables}>{wearableCount} wearable{wearableCount !== 1 ? 's' : ''}</span>
          {!wsConnected && <span style={S.reconnecting}>reconnecting...</span>}
        </div>
      </div>

      {/* ── 4-Zone Grid ── */}
      <div style={S.grid}>

        {/* Zone 1: Family Nervous System Map (top-left) */}
        <div style={S.zone}>
          <div style={S.zoneLabel}>NERVOUS SYSTEM MAP</div>
          <div style={S.ringRow}>
            {members.map((m, i) => (
              <BioRing
                key={m.user_id || m.userId || i}
                member={m}
                isSelected={selectedMember && (selectedMember.user_id === m.user_id || selectedMember.userId === m.userId)}
                onSelect={setSelectedMember}
              />
            ))}
            {members.length === 0 && (
              <div style={S.placeholder}>Waiting for family members to connect...</div>
            )}
          </div>
          <BioDetailPanel member={selectedMember} />
        </div>

        {/* Zone 2: Active Prompt + Engagement (top-right, 340px) */}
        <div style={S.zone}>
          <div style={S.zoneLabel}>PROMPT + ENGAGEMENT</div>

          {/* Current topic */}
          {currentTopic && (
            <div style={{ ...S.topicCard, borderLeftColor: sensColor(currentTopic.sensitivity_level || currentTopic.sensitivity) }}>
              <div style={S.topicText}>{currentTopic.prompt_text || currentTopic.title}</div>
              <div style={S.topicMeta}>
                {currentTopic.dimension || currentTopic.category}{' '}
                <span style={{ color: sensColor(currentTopic.sensitivity_level || currentTopic.sensitivity) }}>
                  {currentTopic.sensitivity_level || currentTopic.sensitivity || 'medium'}
                </span>
              </div>
            </div>
          )}

          {/* Progress dots */}
          {topics.length > 0 && (
            <div style={S.dotRow}>
              {topics.map((t, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: i < activeTopicIdx ? 'rgba(200,210,225,0.5)'
                    : i === activeTopicIdx ? '#E8BE6A'
                    : 'rgba(200,210,225,0.15)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
          )}

          {/* Engagement status */}
          <div style={{ marginTop: 12 }}>
            {Object.entries(engagement).map(([uid, eng]) => {
              const isWithdrawn = eng.status === 'disengaged' || eng.status === 'withdrawn';
              return (
                <div key={uid} style={{
                  ...S.engRow,
                  background: isWithdrawn ? 'rgba(224,152,120,0.08)' : 'transparent',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: engDot(eng.status), flexShrink: 0 }} />
                  <span style={S.engName}>{eng.name || uid}</span>
                  <span style={S.engStatus}>{eng.status}</span>
                </div>
              );
            })}
          </div>

          {/* Family Engagement — child Air Dancer data */}
          {familyEngagement && (
            <div style={S.famEngPanel}>
              <div style={S.famEngTitle}>FAMILY ENGAGEMENT</div>
              {familyEngagement.summary.total_sessions === 0 ? (
                <div style={S.famEngEmpty}>Not yet started</div>
              ) : (
                <div style={S.famEngGrid}>
                  <div style={S.famEngStat}>
                    <span style={S.famEngValue}>{familyEngagement.summary.sessions_this_week}</span>
                    <span style={S.famEngLabel}>This Week</span>
                  </div>
                  <div style={S.famEngStat}>
                    <span style={S.famEngValue}>{trendIndicator(familyEngagement.summary.trend)}</span>
                    <span style={S.famEngLabel}>Engagement Rhythm</span>
                  </div>
                  <div style={S.famEngStat}>
                    <span style={S.famEngValue}>{familyEngagement.summary.avg_breaths_completed}</span>
                    <span style={S.famEngLabel}>Avg Breaths</span>
                  </div>
                  <div style={S.famEngStat}>
                    <span style={S.famEngValue}>{Math.round(familyEngagement.summary.early_quit_rate * 100)}%</span>
                    <span style={S.famEngLabel}>Early Quit</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {familyEngagementLoading && (
            <div style={S.famEngEmpty}>Loading engagement rhythm...</div>
          )}

          {/* Breath Bridge status */}
          {breathBridge && breathBridge.config && (
            <div style={S.bbPanel}>
              <div style={S.bbTitle}>BREATH BRIDGE</div>
              <div style={S.bbStatusRow}>
                <span style={{ fontSize: 10, color: breathBridge.config.paused_at ? 'rgba(224,152,120,0.7)' : breathBridge.config.active ? 'rgba(74,222,128,0.7)' : 'rgba(160,180,210,0.3)' }}>
                  {breathBridge.config.paused_at ? 'Paused' : breathBridge.config.active ? 'Active' : 'Not Enrolled'}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(200,210,225,0.3)' }}>
                  {breathBridge.deliveredThisWeek}/{breathBridge.config.weekly_message_cap} this week
                </span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(200,210,225,0.25)', marginBottom: 4 }}>
                Guardian consent: {breathBridge.config.guardian_consent_at ? '\u2705 Recorded' : '\u26A0\uFE0F Pending'}
              </div>
              {/* Cadence control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 8, color: 'rgba(200,210,225,0.25)' }}>Cadence:</span>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => handleBbCadence(n)} style={{
                    width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: n <= breathBridge.config.weekly_message_cap ? 'rgba(92,224,208,0.15)' : 'rgba(14,28,50,0.5)',
                    color: n <= breathBridge.config.weekly_message_cap ? 'rgba(92,224,208,0.7)' : 'rgba(160,180,210,0.15)',
                    fontSize: 8, fontFamily: 'Outfit, sans-serif',
                  }}>{n}</button>
                ))}
              </div>
              {/* Pause/Resume */}
              {breathBridge.config.paused_at ? (
                <button onClick={handleBbResume} style={S.btnTeal}>Resume Channel</button>
              ) : (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={bbPauseInput} onChange={e => setBbPauseInput(e.target.value)} placeholder="Pause reason..." style={S.bbInput} />
                  <button onClick={handleBbPause} disabled={bbPausing || !bbPauseInput.trim()} style={S.btnOrange}>Pause</button>
                </div>
              )}
              {/* Message log */}
              {breathBridge.messages?.length > 0 && (
                <div style={{ marginTop: 6, maxHeight: 80, overflowY: 'auto' }}>
                  {breathBridge.messages.slice(0, 10).map(m => (
                    <div key={m.id} style={{
                      fontSize: 9, padding: '3px 6px', marginBottom: 2, borderRadius: 4,
                      background: m.delivery_status === 'held' ? 'rgba(224,152,120,0.06)' : 'rgba(255,255,255,0.02)',
                      color: m.delivery_status === 'held' ? 'rgba(224,152,120,0.5)' : 'rgba(200,210,225,0.35)',
                    }}>
                      {m.delivery_status === 'held' && <span style={{ color: 'rgba(224,152,120,0.6)', marginRight: 4 }}>[{m.held_reason}]</span>}
                      {m.content?.slice(0, 60)}{m.content?.length > 60 ? '...' : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Coaching Progress (Phase 3) */}
          {coachingProgress && (
            <div style={S.bbPanel}>
              <div style={S.bbTitle}>COACHING FIRMWARE</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(200,210,225,0.6)' }}>
                  Gate: <span style={{ color: 'rgba(92,224,208,0.7)' }}>{coachingProgress.current_gate?.replace('_', ' ')}</span>
                </span>
                <span style={{ fontSize: 9, color: 'rgba(200,210,225,0.3)' }}>
                  {coachingProgress.entries_delivered} delivered
                </span>
              </div>
              {/* Domains covered */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 4, flexWrap: 'wrap' }}>
                {['showing_up', 'emotional_vocabulary', 'co_regulation', 'letting_go', 'repair'].map(d => (
                  <span key={d} style={{
                    fontSize: 7, padding: '2px 5px', borderRadius: 4,
                    background: coachingProgress.domains_covered?.includes(d) ? 'rgba(92,224,208,0.1)' : 'rgba(14,28,50,0.5)',
                    color: coachingProgress.domains_covered?.includes(d) ? 'rgba(92,224,208,0.6)' : 'rgba(160,180,210,0.15)',
                    border: `1px solid ${coachingProgress.domains_covered?.includes(d) ? 'rgba(92,224,208,0.15)' : 'rgba(160,180,210,0.04)'}`,
                  }}>{d.replace(/_/g, ' ')}</span>
                ))}
              </div>
              {/* Gate override */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                <span style={{ fontSize: 8, color: 'rgba(200,210,225,0.2)' }}>Gate:</span>
                {['gate_1', 'gate_2', 'gate_3', 'gate_4'].map(g => (
                  <button key={g} onClick={() => handleGateOverride(g)} style={{
                    padding: '2px 6px', fontSize: 7, borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: g === coachingProgress.current_gate ? 'rgba(92,224,208,0.15)' : 'rgba(14,28,50,0.5)',
                    color: g === coachingProgress.current_gate ? 'rgba(92,224,208,0.7)' : 'rgba(160,180,210,0.15)',
                    fontFamily: 'Outfit, sans-serif',
                  }}>{g.replace('gate_', '')}</button>
                ))}
              </div>
              {/* Emphasis selector */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, color: 'rgba(200,210,225,0.2)' }}>Emphasis:</span>
                {['none', 'showing_up', 'emotional_vocabulary', 'co_regulation', 'letting_go', 'repair'].map(d => (
                  <button key={d} onClick={() => handleEmphasis(d === 'none' ? null : d)} style={{
                    padding: '2px 5px', fontSize: 6, borderRadius: 3, border: 'none', cursor: 'pointer',
                    background: (d === 'none' && !coachingProgress.clinician_emphasis_domain) || d === coachingProgress.clinician_emphasis_domain ? 'rgba(232,190,106,0.12)' : 'rgba(14,28,50,0.4)',
                    color: (d === 'none' && !coachingProgress.clinician_emphasis_domain) || d === coachingProgress.clinician_emphasis_domain ? 'rgba(232,190,106,0.7)' : 'rgba(160,180,210,0.15)',
                    fontFamily: 'Outfit, sans-serif',
                  }}>{d === 'none' ? 'auto' : d.replace(/_/g, ' ')}</button>
                ))}
              </div>
              {/* Enable coaching / Post-release */}
              <div style={{ display: 'flex', gap: 4 }}>
                {!coachingProgress.coaching_active && (
                  <button onClick={handleEnableCoaching} style={S.btnTeal}>Enable Coaching</button>
                )}
                {!coachingProgress.post_release_mode && (
                  <button onClick={handlePostRelease} style={S.btnAmber}>Post-Release Transition</button>
                )}
                {coachingProgress.post_release_mode && (
                  <span style={{ fontSize: 9, color: 'rgba(74,222,128,0.5)', padding: '4px 0' }}>Post-release active</span>
                )}
              </div>
            </div>
          )}

          {/* Session controls */}
          <div style={S.controlRow}>
            <button onClick={handleCoBreath} style={S.btnTeal}>Co-Breath</button>
            <button onClick={handleNextPrompt} style={S.btnAmber}>Next Prompt</button>
            <button onClick={handlePause} style={S.btnOrange}>{paused ? 'Resume' : 'Pause'}</button>
          </div>
        </div>

        {/* Zone 3: Session Timeline (bottom-left) */}
        <div style={{ ...S.zone, padding: 0, overflow: 'hidden' }}>
          <div style={{ ...S.zoneLabel, padding: '8px 12px 0' }}>SESSION TIMELINE</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <SessionTimeline
              biometricHistory={biometricHistory}
              events={timelineEvents}
              members={members}
              elapsedMs={(elapsed || 0) * 1000}
              sessionStartTime={sessionStartRef.current}
            />
          </div>
        </div>

        {/* Zone 4: Alerts + Coaching (bottom-right, 340px) */}
        <div style={{ ...S.zone, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={S.zoneLabel}>ALERTS + COACHING</div>
            <button onClick={handleCoachMe} disabled={coachMeLoading} style={S.coachMeBtn}>
              {coachMeLoading ? '...' : 'Coach Me'}
            </button>
          </div>

          {/* Coach Me expanded result */}
          {coachMeResult && (
            <div style={S.coachMePanel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={S.coachMeTitle}>On-Demand Analysis</div>
                <button onClick={() => setCoachMeResult(null)} style={S.dismissLink}>dismiss</button>
              </div>
              {coachMeResult.observed && <div style={S.coachSection}><span style={S.coachLabel}>OBSERVED</span> {coachMeResult.observed}</div>}
              {coachMeResult.likely && <div style={S.coachSection}><span style={S.coachLabel}>LIKELY</span> {coachMeResult.likely}</div>}
              {coachMeResult.consider && <div style={S.coachSection}><span style={S.coachLabel}>CONSIDER</span> {coachMeResult.consider}</div>}
            </div>
          )}

          {/* Alert cards */}
          <div style={S.alertScroll}>
            {alerts.map(a => {
              const aStyle = ALERT_STYLES[a.type] || ALERT_STYLES.coaching;
              return (
                <div key={a.id} style={{ ...S.alertCard, borderColor: aStyle.border, background: aStyle.bg }}>
                  <div style={S.alertTop}>
                    <span style={S.alertTime}>{a.member} {a.timestamp != null ? `${Math.floor(a.timestamp / 60000)}m` : ''}</span>
                    <button onClick={() => dismissAlert(a.id)} style={S.dismissLink}>dismiss</button>
                  </div>
                  <div style={S.alertTitle}>{a.title}</div>
                  {a.observed && <div style={S.alertSection}><span style={S.alertLabel}>OBSERVED</span> {a.observed}</div>}
                  {a.likely && <div style={S.alertSection}><span style={S.alertLabel}>LIKELY</span> {a.likely}</div>}
                  {a.consider && <div style={S.alertSection}><span style={S.alertLabel}>CONSIDER</span> {a.consider}</div>}
                  {!a.observed && a.body && <div style={S.alertBody}>{a.body}</div>}
                </div>
              );
            })}
            {alerts.length === 0 && (
              <div style={S.placeholder}>No alerts yet. Cards appear as the session unfolds.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════
const S = {
  root: {
    width: '100vw', height: '100vh', overflow: 'hidden',
    background: 'linear-gradient(135deg, #0A1220, #0E1828, #0A1420)',
    fontFamily: "'Outfit', -apple-system, sans-serif", color: '#c8d2e1',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    height: 40, flexShrink: 0,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 16px',
    background: 'rgba(10,18,32,0.6)', borderBottom: '1px solid rgba(200,210,225,0.06)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 14 },
  logo: { fontSize: 12, fontWeight: 600, letterSpacing: 3, color: '#5CE0D0' },
  sessionName: { fontSize: 12, fontWeight: 400, color: 'rgba(200,210,225,0.6)' },
  elapsed: { fontSize: 13, fontWeight: 500, color: 'rgba(200,210,225,0.8)', fontVariantNumeric: 'tabular-nums' },
  wearables: { fontSize: 10, color: 'rgba(200,210,225,0.4)' },
  reconnecting: { fontSize: 10, color: '#E09878', animation: 'blink 1.5s infinite' },

  grid: {
    flex: 1, display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gridTemplateRows: '1fr 1fr',
    gap: 1, minHeight: 0,
  },
  zone: {
    padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    background: 'rgba(255,255,255,0.015)',
    borderRight: '1px solid rgba(200,210,225,0.04)',
    borderBottom: '1px solid rgba(200,210,225,0.04)',
  },
  zoneLabel: {
    fontSize: 8, fontWeight: 600, letterSpacing: 2, color: 'rgba(200,210,225,0.25)',
    textTransform: 'uppercase', marginBottom: 8,
  },

  // Zone 1: NS Map
  ringRow: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', padding: '8px 0' },

  // Zone 2: Prompt + Engagement
  topicCard: {
    padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(200,210,225,0.06)',
    borderLeft: '3px solid #E8BE6A', borderRadius: 8,
  },
  topicText: { fontSize: 13, fontWeight: 400, color: 'rgba(230,220,205,0.85)', lineHeight: 1.6 },
  topicMeta: { fontSize: 9, color: 'rgba(200,210,225,0.35)', marginTop: 4, textTransform: 'capitalize' },
  dotRow: { display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' },
  engRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, marginBottom: 2 },
  engName: { fontSize: 11, color: 'rgba(200,210,225,0.6)', flex: 1 },
  engStatus: { fontSize: 9, color: 'rgba(200,210,225,0.35)', textTransform: 'capitalize' },

  controlRow: { display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 10 },
  btnTeal: {
    flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid rgba(92,224,208,0.3)',
    background: 'rgba(92,224,208,0.08)', color: '#5CE0D0',
    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
  },
  btnAmber: {
    flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid rgba(232,190,106,0.3)',
    background: 'rgba(232,190,106,0.08)', color: '#E8BE6A',
    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
  },
  btnOrange: {
    flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid rgba(224,152,120,0.3)',
    background: 'rgba(224,152,120,0.08)', color: '#E09878',
    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
  },

  // Zone 4: Alerts
  coachMeBtn: {
    padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(232,190,106,0.3)',
    background: 'rgba(232,190,106,0.08)', color: '#E8BE6A',
    fontSize: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
  },
  coachMePanel: {
    padding: '10px 12px', marginBottom: 8,
    background: 'rgba(232,190,106,0.06)', border: '1px solid rgba(232,190,106,0.2)',
    borderRadius: 8,
  },
  coachMeTitle: { fontSize: 11, fontWeight: 600, color: '#E8BE6A', marginBottom: 6 },
  coachSection: { fontSize: 11, color: 'rgba(230,220,205,0.7)', lineHeight: 1.5, marginBottom: 4 },
  coachLabel: { fontSize: 8, fontWeight: 600, letterSpacing: 1, color: '#E8BE6A', marginRight: 4 },

  alertScroll: { flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 2 },
  alertCard: {
    padding: '8px 10px', marginBottom: 6, borderRadius: 8,
    border: '1px solid rgba(232,190,106,0.3)', background: 'rgba(232,190,106,0.04)',
  },
  alertTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  alertTime: { fontSize: 8, color: 'rgba(200,210,225,0.35)' },
  alertTitle: { fontSize: 12, fontWeight: 600, color: 'rgba(230,220,205,0.85)', marginBottom: 4 },
  alertSection: { fontSize: 10, color: 'rgba(230,220,205,0.6)', lineHeight: 1.5, marginBottom: 2 },
  alertLabel: { fontSize: 7, fontWeight: 600, letterSpacing: 1, color: 'rgba(232,190,106,0.8)', marginRight: 3 },
  alertBody: { fontSize: 10, color: 'rgba(230,220,205,0.6)', lineHeight: 1.5 },
  dismissLink: {
    background: 'none', border: 'none', fontSize: 9, color: 'rgba(200,210,225,0.3)',
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: 0,
  },

  placeholder: { fontSize: 11, color: 'rgba(200,210,225,0.2)', textAlign: 'center', padding: 20 },

  // Family Engagement panel
  famEngPanel: {
    marginTop: 10, padding: '8px 10px', borderRadius: 8,
    background: 'rgba(92,224,208,0.04)', border: '1px solid rgba(92,224,208,0.15)',
  },
  famEngTitle: {
    fontSize: 8, fontWeight: 600, letterSpacing: 2, color: 'rgba(92,224,208,0.6)',
    textTransform: 'uppercase', marginBottom: 6,
  },
  famEngGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  famEngStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  famEngValue: { fontSize: 16, fontWeight: 600, color: 'rgba(200,210,225,0.85)' },
  famEngLabel: { fontSize: 8, color: 'rgba(200,210,225,0.35)', textTransform: 'uppercase' },
  famEngEmpty: { fontSize: 10, color: 'rgba(200,210,225,0.25)', textAlign: 'center', padding: 8 },

  // Breath Bridge panel
  bbPanel: {
    marginTop: 10, padding: '8px 10px', borderRadius: 8,
    background: 'rgba(232,190,106,0.03)', border: '1px solid rgba(232,190,106,0.1)',
  },
  bbTitle: {
    fontSize: 8, fontWeight: 600, letterSpacing: 2, color: 'rgba(232,190,106,0.5)',
    textTransform: 'uppercase', marginBottom: 4,
  },
  bbStatusRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bbInput: {
    flex: 1, padding: '4px 8px', fontSize: 9, borderRadius: 6,
    background: 'rgba(14,28,50,0.5)', border: '1px solid rgba(160,180,210,0.08)',
    color: 'rgba(200,210,225,0.6)', fontFamily: 'Outfit, sans-serif', outline: 'none',
  },
};
