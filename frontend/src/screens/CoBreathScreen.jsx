import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import BreathPacer from '../components/BreathPacer';

const PHASES = { WAITING: 'waiting', COUNTDOWN: 'countdown', BREATHING: 'breathing', COMPLETE: 'complete' };
const MODES = ['sync', 'adaptive', 'silent'];

export default function CoBreathScreen() {
  const [phase, setPhase] = useState(PHASES.WAITING);
  const [mode, setMode] = useState('sync');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [partnerName, setPartnerName] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [breathParams, setBreathParams] = useState({ inhale: 4, exhale: 6 });
  const [partnerScale, setPartnerScale] = useState(0.4);
  const [cycles, setCycles] = useState(0);
  const [totalCycles, setTotalCycles] = useState(15);
  const [result, setResult] = useState(null);
  const [coArt, setCoArt] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const wsRef = useRef(null);
  const countdownRef = useRef(null);
  const nav = useNavigate();
  const user = getUser();

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function connectWebSocket(code) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = localStorage.getItem('ascen_jwt');
    const ws = new WebSocket(`${proto}//${host}/ws/cobreath?room=${code}&token=${token}`);
    wsRef.current = ws;

    ws.onclose = () => {
      if (phase !== PHASES.COMPLETE) {
        setPartnerConnected(false);
        // Reconnect after brief pause
        setTimeout(() => { if (wsRef.current?.readyState !== WebSocket.OPEN) connectWebSocket(code); }, 3000);
      }
    };

    ws.onerror = () => {
      // Handled by onclose — no crash
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'partner_joined') {
          setPartnerConnected(true);
          setPartnerName(msg.partner_name || 'Partner');
        }
        if (msg.type === 'start') {
          if (msg.breath_ratio) {
            const parts = msg.breath_ratio.split(':').map(Number);
            setBreathParams({ inhale: parts[0] || 4, exhale: parts[1] || 6 });
          }
          if (msg.total_cycles) setTotalCycles(msg.total_cycles);
          startCountdown();
        }
        if (msg.type === 'partner_breath') {
          setPartnerScale(msg.scale || 0.4);
        }
        if (msg.type === 'complete') {
          setResult(msg);
          if (msg.co_art_url) setCoArt(msg.co_art_url);
          setPhase(PHASES.COMPLETE);
        }
      } catch {}
    };
  }

  async function initiateRoom() {
    try {
      const { data } = await api.post('/api/cobreath/initiate', {
        participant_id: user?.participant_id || user?.userId,
        mode
      });
      setRoomCode(data.room_code);
      setSessionId(data.session_id);
      connectWebSocket(data.room_code);
    } catch {}
  }

  async function joinRoom() {
    if (!joinCode) return;
    try {
      const { data } = await api.post('/api/cobreath/join', {
        room_code: joinCode,
        participant_id: user?.participant_id || user?.userId
      });
      setRoomCode(joinCode);
      setSessionId(data.session_id);
      setPartnerConnected(true);
      setPartnerName(data.partner_name || 'Partner');
      if (data.breath_ratio) {
        const parts = data.breath_ratio.split(':').map(Number);
        setBreathParams({ inhale: parts[0] || 4, exhale: parts[1] || 6 });
      }
      connectWebSocket(joinCode);
    } catch {}
  }

  function startCountdown() {
    setPhase(PHASES.COUNTDOWN);
    let c = 5;
    setCountdown(c);
    countdownRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(countdownRef.current);
        setPhase(PHASES.BREATHING);
      }
    }, 1000);
  }

  function onCycle(n) {
    setCycles(n);
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'cycle', cycle: n }));
    }
    if (n >= totalCycles) completeSession();
  }

  async function completeSession() {
    try {
      const { data } = await api.post('/api/cobreath/complete', { session_id: sessionId });
      setResult(data);
      if (data.co_art_ipfs_hash) {
        setCoArt(`https://gateway.pinata.cloud/ipfs/${data.co_art_ipfs_hash}`);
      }
      setPhase(PHASES.COMPLETE);
    } catch {
      setPhase(PHASES.COMPLETE);
    }
  }

  // --- WAITING ---
  if (phase === PHASES.WAITING) {
    return (
      <div style={S.container}>
        <h2 style={S.title}>Breathe Together</h2>
        <p style={S.sub}>Pick a mode and start a room, or join one.</p>

        <div style={S.modeRow}>
          {MODES.map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ ...S.modeBtn, ...(mode === m ? S.modeBtnActive : {}) }}>
              {m === 'sync' ? 'In Sync' : m === 'adaptive' ? 'Adaptive' : 'Silent'}
            </button>
          ))}
        </div>

        {!roomCode ? (
          <div>
            <button onClick={initiateRoom} style={S.btn}>Start a Room</button>
            <div style={S.divider}><span style={S.divText}>or join one</span></div>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code" style={S.input} maxLength={8} />
            <button onClick={joinRoom} style={{ ...S.btn, marginTop: '12px' }}>Join</button>
          </div>
        ) : (
          <div style={S.card}>
            <p style={S.dim}>Share this code with your partner:</p>
            <p style={S.roomCode}>{roomCode}</p>
            {partnerConnected ? (
              <div>
                <p style={S.teal}>{partnerName} is here!</p>
                <button onClick={startCountdown} style={S.btn}>Start Breathing</button>
              </div>
            ) : (
              <p style={S.dim}>Waiting for your partner to join...</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- COUNTDOWN ---
  if (phase === PHASES.COUNTDOWN) {
    return (
      <div style={S.centerFull}>
        <p style={S.countdownNum}>{countdown}</p>
        <p style={S.dim}>Get ready to breathe with {partnerName}</p>
      </div>
    );
  }

  // --- BREATHING ---
  if (phase === PHASES.BREATHING) {
    return (
      <div style={S.centerFull}>
        <p style={S.dim}>You</p>
        <BreathPacer inhaleSeconds={breathParams.inhale} exhaleSeconds={breathParams.exhale}
          isActive={true} onCycle={onCycle} />

        <div style={S.spacer} />

        <p style={S.dim}>{partnerName}</p>
        <div style={S.partnerCircle(partnerScale)} />

        {!partnerConnected && phase === PHASES.BREATHING && (
          <p style={{ color: '#f0b860', fontSize: '13px', marginTop: '8px' }}>Connection paused — reconnecting...</p>
        )}
        <p style={S.cycleText}>{cycles} / {totalCycles} breaths</p>
      </div>
    );
  }

  // --- COMPLETE ---
  return (
    <div style={S.centerFull}>
      <h2 style={S.title}>You did it together.</h2>

      {result?.connection_score != null && (
        <div style={S.scoreBox}>
          <p style={S.scoreNum}>{result.connection_score}</p>
          <p style={S.dim}>Connection Score</p>
        </div>
      )}

      <p style={S.warmth}>{
        result?.warmth_message ||
        (result?.connection_score >= 80 ? 'Your connection was strong today.' :
         result?.connection_score >= 60 ? 'You found your rhythm together.' :
         'Every shared breath builds connection.')
      }</p>

      {coArt && (
        <div style={{ marginTop: '24px' }}>
          <img src={coArt} alt="Art you made together" style={S.artImg} />
          <p style={S.dim}>Art you made together</p>
        </div>
      )}

      <button onClick={() => nav('/app/family')} style={{ ...S.btn, marginTop: '32px' }}>Done</button>
    </div>
  );
}

const S = {
  container: { padding: '24px', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', fontFamily: 'sans-serif' },
  centerFull: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', padding: '24px', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 600, color: '#5ffce0', marginBottom: '8px', textAlign: 'center' },
  sub: { color: '#8899aa', marginBottom: '24px', textAlign: 'center', fontSize: '15px' },
  dim: { color: '#8899aa', fontSize: '14px', textAlign: 'center' },
  teal: { color: '#5ffce0', fontSize: '16px', textAlign: 'center', marginBottom: '12px' },
  card: { background: '#0a2540', borderRadius: '12px', padding: '24px', marginTop: '16px', textAlign: 'center' },
  input: { width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '16px', textAlign: 'center', letterSpacing: '3px', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: '16px' },
  modeRow: { display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' },
  modeBtn: { padding: '10px 16px', borderRadius: '20px', border: '1px solid #1a3a5c', background: 'transparent', color: '#8899aa', fontSize: '14px', cursor: 'pointer' },
  modeBtnActive: { background: '#1a7a6d', color: '#fff', borderColor: '#1a7a6d' },
  divider: { textAlign: 'center', margin: '20px 0', borderTop: '1px solid #1a3a5c', position: 'relative' },
  divText: { background: '#061a2a', color: '#556677', padding: '0 12px', position: 'relative', top: '-10px', fontSize: '13px' },
  roomCode: { fontSize: '32px', fontWeight: 700, color: '#f0b860', letterSpacing: '6px', margin: '16px 0' },
  countdownNum: { fontSize: '72px', fontWeight: 700, color: '#5ffce0' },
  spacer: { height: '32px' },
  partnerCircle: (scale) => ({
    width: '120px', height: '120px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(240,184,96,0.3), rgba(240,184,96,0.08), transparent)',
    border: '2px solid rgba(240,184,96,0.4)',
    transform: `scale(${scale})`, transition: 'transform 0.3s ease'
  }),
  cycleText: { color: '#5ffce0', fontSize: '16px', marginTop: '24px' },
  scoreBox: { background: '#0a2540', borderRadius: '16px', padding: '24px 40px', marginTop: '24px', textAlign: 'center' },
  scoreNum: { fontSize: '48px', fontWeight: 700, color: '#5ffce0', margin: '0 0 4px 0' },
  warmth: { color: '#f0b860', fontSize: '16px', marginTop: '16px', textAlign: 'center', lineHeight: '1.5' },
  artImg: { width: '200px', height: '200px', borderRadius: '12px', objectFit: 'cover' },
};
