import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import { connectDevice, isBleSupported } from '../services/ble';
import BreathPacer from '../components/BreathPacer';

const PHASES = { ARRIVAL: 'arrival', BREATHING: 'breathing', MIRROR: 'mirror', ART: 'art', COMPLETE: 'complete' };

export default function SessionScreen() {
  const [phase, setPhase] = useState(PHASES.ARRIVAL);
  const [sessionData, setSessionData] = useState(null);
  const [ble, setBle] = useState(null);
  const [bleStatus, setBleStatus] = useState('disconnected');
  const [luno, setLuno] = useState('');
  const [breathParams, setBreathParams] = useState({ inhale: 4, exhale: 6 });
  const [cycles, setCycles] = useState(0);
  const [totalCycles, setTotalCycles] = useState(25);
  const [elapsed, setElapsed] = useState(0);
  const [mirror, setMirror] = useState(null);
  const [artData, setArtData] = useState(null);
  const [intention, setIntention] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const tickRef = useRef(null);
  const startTimeRef = useRef(null);
  const nav = useNavigate();
  const user = getUser();

  // Start session on mount
  useEffect(() => {
    startSession();
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  async function startSession() {
    try {
      const { data } = await api.post('/api/abi/session/start', {
        participant_id: user?.participant_id || user?.userId,
        device_type: 'pwa'
      });
      setSessionData(data);
      if (data.luno_dialogue) setLuno(data.luno_dialogue);
      if (data.breath_ratio) {
        const parts = data.breath_ratio.split(':').map(Number);
        setBreathParams({ inhale: parts[0] || 4, exhale: parts[1] || 6 });
      }
      if (data.total_cycles) setTotalCycles(data.total_cycles);
    } catch {}
  }

  async function connectBle() {
    if (!isBleSupported()) { setBleStatus('unsupported'); return; }
    try {
      setBleStatus('connecting');
      const device = await connectDevice();
      setBle(device);
      setBleStatus('connected');
      device.onData(d => {
        // Store latest reading for ticks
        window._lastBleReading = d;
      });
    } catch (e) {
      setBleStatus('failed');
    }
  }

  function beginBreathing() {
    setPhase(PHASES.BREATHING);
    startTimeRef.current = Date.now();

    // Send ticks every 5 seconds
    tickRef.current = setInterval(async () => {
      const reading = window._lastBleReading || {};
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      try {
        const { data } = await api.post('/api/abi/session/tick', {
          session_id: sessionData?.session_id,
          heart_rate: reading.hr || null,
          rr_intervals: reading.rr || [],
          timestamp: Date.now()
        });
        if (data?.coaching) setLuno(data.coaching);
      } catch {}
    }, 5000);
  }

  const onCycle = useCallback((c) => {
    setCycles(c);
    if (c >= totalCycles) completeBreathing();
  }, [totalCycles]);

  async function completeBreathing() {
    if (tickRef.current) clearInterval(tickRef.current);
    setPhase(PHASES.MIRROR);
    try {
      const { data } = await api.post('/api/abi/session/complete', {
        session_id: sessionData?.session_id,
        participant_id: user?.participant_id || user?.userId,
        duration_seconds: elapsed,
        cycles_completed: cycles
      });
      setMirror(data);
      if (data?.art_token_id || data?.art_ipfs_hash) {
        setArtData(data);
      }
    } catch {}
  }

  function showArt() { setPhase(PHASES.ART); }
  function done() { nav('/app/'); }

  const formatTime = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div style={S.container}>
      {/* Exit button */}
      {phase !== PHASES.COMPLETE && (
        <button onClick={() => setConfirmExit(true)} style={S.exit}>
          {confirmExit ? '' : '\u2715'}
        </button>
      )}

      {/* Exit confirmation */}
      {confirmExit && (
        <div style={S.overlay}>
          <div style={S.confirmCard}>
            <p style={{ marginBottom: '16px' }}>End this session?</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => nav('/app/')} style={S.btnDanger}>Leave</button>
              <button onClick={() => setConfirmExit(false)} style={S.btnSec}>Stay</button>
            </div>
          </div>
        </div>
      )}

      {/* ARRIVAL */}
      {phase === PHASES.ARRIVAL && (
        <div style={S.center}>
          {bleStatus === 'disconnected' && isBleSupported() && (
            <button onClick={connectBle} style={S.bleBtn}>Connect Heart Monitor</button>
          )}
          {bleStatus === 'connecting' && <p style={S.dim}>Connecting...</p>}
          {bleStatus === 'connected' && <p style={S.connected}>Connected</p>}
          {bleStatus === 'unsupported' && <p style={S.dim}>No Bluetooth — continuing without device</p>}
          {bleStatus === 'failed' && <p style={S.dim}>Connection failed — continuing without device</p>}

          {luno && <div style={S.luno}>{luno}</div>}

          <button onClick={beginBreathing} style={{ ...S.btn, marginTop: '32px' }}>
            Begin Breathing
          </button>
        </div>
      )}

      {/* BREATHING */}
      {phase === PHASES.BREATHING && (
        <div style={S.center}>
          <BreathPacer inhaleSeconds={breathParams.inhale} exhaleSeconds={breathParams.exhale}
            isActive={true} onCycle={onCycle} />

          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <p style={{ color: '#556677', fontSize: '14px' }}>
              {cycles} / {totalCycles} breaths
            </p>
            <p style={{ color: '#334455', fontSize: '13px', marginTop: '4px' }}>
              {formatTime(elapsed)}
            </p>
          </div>

          {luno && <div style={{ ...S.luno, marginTop: '24px', maxWidth: '280px' }}>{luno}</div>}
        </div>
      )}

      {/* MIRROR */}
      {phase === PHASES.MIRROR && (
        <div style={S.center}>
          <h2 style={{ color: '#5ffce0', fontWeight: 300, marginBottom: '24px' }}>Session Complete</h2>

          {mirror && (
            <div style={S.mirrorCard}>
              {mirror.coherence_peak && <Row label="Coherence Peak" value={mirror.coherence_peak?.toFixed(2)} />}
              {mirror.duration_seconds && <Row label="Duration" value={formatTime(mirror.duration_seconds || elapsed)} />}
              {cycles > 0 && <Row label="Breaths" value={cycles} />}
              {mirror.state && <Row label="State" value={mirror.state} />}
            </div>
          )}

          {mirror?.luno_dialogue && <div style={S.luno}>{mirror.luno_dialogue}</div>}

          <button onClick={showArt} style={{ ...S.btn, marginTop: '24px' }}>
            Reveal Your Art
          </button>
        </div>
      )}

      {/* ART REVEAL */}
      {phase === PHASES.ART && (
        <div style={S.center}>
          <div style={{
            width: '260px', height: '260px', borderRadius: '20px',
            background: '#0a2540', border: '1px solid #1a3a5a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', marginBottom: '16px'
          }}>
            {artData?.art_ipfs_hash
              ? <img src={`https://gateway.pinata.cloud/ipfs/${artData.art_ipfs_hash}`}
                  alt="Your breath art" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <p style={{ color: '#556677' }}>Your art</p>
            }
          </div>
          <p style={{ color: '#5ffce0', fontSize: '15px', fontWeight: 300 }}>
            Your breath just created this.
          </p>

          <input value={intention} onChange={e => setIntention(e.target.value)}
            placeholder="Set an intention (optional)"
            style={{ ...S.input, marginTop: '20px' }} />

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={() => nav('/app/gallery')} style={S.btnSec}>View Gallery</button>
            <button onClick={done} style={S.btn}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #112d4a' }}>
      <span style={{ color: '#8899aa', fontSize: '14px' }}>{label}</span>
      <span style={{ fontSize: '16px', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', background: '#061a2a', position: 'relative' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' },
  exit: { position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#334455', fontSize: '24px', cursor: 'pointer', zIndex: 10, padding: '8px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  confirmCard: { background: '#0a2540', borderRadius: '20px', padding: '28px', textAlign: 'center', color: '#fff' },
  luno: { background: '#0a2540', borderRadius: '16px', padding: '16px 20px', color: '#5ffce0', fontStyle: 'italic', fontSize: '15px', lineHeight: 1.5, maxWidth: '320px', textAlign: 'center' },
  mirrorCard: { background: '#0a2540', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '320px' },
  btn: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '14px 36px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer' },
  btnSec: { background: 'transparent', color: '#5ffce0', border: '1px solid #1a3a5a', padding: '14px 24px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer' },
  btnDanger: { background: '#3a1a1a', color: '#f07050', border: '1px solid #5a2a2a', padding: '12px 24px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer' },
  bleBtn: { background: '#112d4a', color: '#5ffce0', border: '1px solid #1a3a5a', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', cursor: 'pointer', marginBottom: '24px' },
  dim: { color: '#556677', fontSize: '14px', marginBottom: '16px' },
  connected: { color: '#5ffce0', fontSize: '14px', marginBottom: '16px' },
  input: { background: '#112d4a', border: '1px solid #1a3a5a', color: '#fff', padding: '12px 16px', borderRadius: '12px', fontSize: '15px', width: '100%', maxWidth: '280px', textAlign: 'center', outline: 'none' }
};
