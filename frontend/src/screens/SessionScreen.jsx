import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import DescentAnimation from '../components/DescentAnimation';
import PullDownShade from '../components/PullDownShade';
import VagalJourneyScreen from './VagalJourneyScreen';

// ═══════════════════════════════════════════════════════════════
// SessionScreen — Full Depth Metaphor Flow
// descent → somatic → breathing (v8 iframe) → ascent → journey → vault → home
// The descent IS the first exercise. The transition and session are continuous.
// ═══════════════════════════════════════════════════════════════

const SOMATIC_EXERCISES = [
  { name: 'Grounding', instruction: 'Press your feet into the ground. Feel five things you can touch. Four you can hear. Three you can see.' },
  { name: 'Self-Holding', instruction: 'Place one hand on your chest. One on your belly. Feel your hands rise and fall. You are holding yourself.' },
  { name: 'Orienting', instruction: 'Look around slowly. Name one thing you see in each direction. Your body is finding its place.' },
];

export default function SessionScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const iframeRef = useRef(null);

  // Session state
  const [phase, setPhase] = useState('descent'); // descent | somatic | breathing | ascent | journey | vault
  const [sessionKey, setSessionKey] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [arrivalNs3, setArrivalNs3] = useState(null);
  const [landingNs3, setLandingNs3] = useState(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeVisible, setIframeVisible] = useState(false);
  const [somaticExercise, setSomaticExercise] = useState(null);
  const [somaticTimer, setSomaticTimer] = useState(0);

  const sessionNumber = searchParams.get('s') || null;
  const arrivalSamplesRef = useRef([]);
  const sampleIntervalRef = useRef(null);

  const user = getUser();
  const character = 'luno'; // Will be set from context in production

  // ── 1. DESCENT PHASE ────────────────────────────────────
  // On mount: start session + begin arrival sampling in background
  useEffect(() => {
    if (phase !== 'descent') return;

    async function startSession() {
      try {
        const startRes = await api.post('/api/abi/session/start', {
          session_number: sessionNumber ? parseInt(sessionNumber) : undefined,
        });
        const sk = startRes.data?.session_key;
        if (sk) setSessionKey(sk);
        if (startRes.data?.session_id) setSessionId(startRes.data.session_id);

        // Begin arrival sampling in background during descent (30 samples, 1/sec)
        let sampleCount = 0;
        sampleIntervalRef.current = setInterval(async () => {
          sampleCount++;
          if (sampleCount > 30) {
            clearInterval(sampleIntervalRef.current);
            return;
          }
          try {
            await api.post('/api/abi/session/arrival-sample', {
              session_key: sk,
              biometrics: {
                source: 'synthetic',
                timestamp: Date.now(),
              },
            });
          } catch {}
        }, 1000);
      } catch (err) {
        console.error('[SESSION] Failed to start:', err);
      }
    }
    startSession();

    return () => {
      if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);
    };
  }, [phase, sessionNumber]);

  // ── DESCENT COMPLETE → check somatic / load iframe ──────
  const handleDescentComplete = useCallback(async () => {
    if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);

    // Complete arrival
    try {
      const arrRes = await api.post('/api/abi/session/arrival-complete', {
        session_key: sessionKey,
      });
      const ns3 = arrRes.data?.arrival_ns3 || arrRes.data?.ns3_score || null;
      setArrivalNs3(ns3);

      // If NS3 < 25: somatic reset
      if (ns3 !== null && ns3 < 25) {
        setSomaticExercise(SOMATIC_EXERCISES[Math.floor(Math.random() * SOMATIC_EXERCISES.length)]);
        setPhase('somatic');
        return;
      }
    } catch {}

    // Otherwise: straight to breathing
    setPhase('breathing');
  }, [sessionKey]);

  // ── 2. SOMATIC PHASE (2 min max) ───────────────────────
  useEffect(() => {
    if (phase !== 'somatic') return;
    const iv = setInterval(() => {
      setSomaticTimer(t => {
        if (t >= 120) {
          clearInterval(iv);
          setPhase('breathing');
          return 120;
        }
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ── 3. BREATHING PHASE (v8 iframe) ─────────────────────
  useEffect(() => {
    if (phase !== 'breathing') return;

    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      const { type, data } = event.data || {};

      switch (type) {
        case 'iframe_ready':
          // SECURITY: JWT passed via postMessage, NOT URL params
          iframeRef.current?.contentWindow?.postMessage({
            type: 'auth',
            token: localStorage.getItem('ascen_jwt'),
            apiKey: localStorage.getItem('ascen_api_key') || '',
          }, window.location.origin);
          setIframeLoading(false);
          // Crossfade: show iframe after brief delay
          setTimeout(() => setIframeVisible(true), 200);
          break;
        case 'session_complete':
          setLandingNs3(data?.landing_ns3 || data?.ns3_mean || null);
          setSessionId(data?.session_id || sessionId);
          // Crossfade out
          setIframeVisible(false);
          setTimeout(() => setPhase('ascent'), 500);
          break;
        case 'session_exit':
          navigate('/app/');
          break;
        case 'view_gallery':
          navigate('/app/gallery');
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [phase, navigate, sessionId]);

  // ── 4. ASCENT COMPLETE ─────────────────────────────────
  const handleAscentComplete = useCallback(() => {
    setPhase('journey');
  }, []);

  // ── 5. JOURNEY COMPLETE → vault → home ─────────────────
  const handleJourneyContinue = useCallback(() => {
    // Go to vault if available, otherwise home
    navigate('/app/vault', { state: { fromSession: true, sessionNumber } });
  }, [navigate, sessionNumber]);

  // Build iframe URL with session key
  let breatheUrl = '/breathe?embedded=true';
  if (sessionNumber) breatheUrl += `&session=${sessionNumber}`;
  if (sessionKey) breatheUrl += `&sessionKey=${sessionKey}`;

  // Compute ascent weather boost based on NS3 improvement
  let ascentWeatherBoost = 0;
  if (arrivalNs3 !== null && landingNs3 !== null && landingNs3 > arrivalNs3) {
    ascentWeatherBoost = Math.min(1, (landingNs3 - arrivalNs3) / 30);
  }
  // Never punish: if NS3 declined, same weather (boost = 0)

  const isL = character === 'luno';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000' }}>

      {/* ── DESCENT ── */}
      {phase === 'descent' && (
        <DescentAnimation
          mode="descent"
          character={character}
          coherence={0.5}
          onComplete={handleDescentComplete}
        />
      )}

      {/* ── SOMATIC RESET ── */}
      {phase === 'somatic' && somaticExercise && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: isL ? 'linear-gradient(180deg, #020812, #061a2a)' : 'linear-gradient(180deg, #0f0610, #1a0c16)',
          fontFamily: "'Outfit', sans-serif", color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '0 32px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, color: isL ? 'rgba(78,205,196,0.6)' : 'rgba(210,140,160,0.6)', textTransform: 'uppercase', marginBottom: 16 }}>
              {somaticExercise.name}
            </div>
            <div style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8 }}>
              {somaticExercise.instruction}
            </div>
            <div style={{ marginTop: 20, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: isL ? 'rgba(78,205,196,0.5)' : 'rgba(210,140,160,0.5)',
                width: `${(somaticTimer / 120) * 100}%`, transition: 'width 1s linear',
              }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>
              {Math.floor(somaticTimer / 60)}:{String(somaticTimer % 60).padStart(2, '0')} / 2:00
            </div>
            <div
              onClick={() => setPhase('breathing')}
              style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }}
            >
              I'm ready to breathe now
            </div>
          </div>
        </div>
      )}

      {/* ── BREATHING (v8 iframe) ── */}
      {phase === 'breathing' && (
        <>
          {iframeLoading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#020812', zIndex: 101,
            }}>
              <div style={{ color: 'rgba(160,196,232,0.5)', fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>
                Preparing your session...
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={breatheUrl}
            style={{
              width: '100vw',
              height: 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
              position: 'fixed',
              top: 'env(safe-area-inset-top, 0px)',
              left: 0,
              border: 'none',
              background: '#000',
              opacity: iframeVisible ? 1 : 0,
              transition: 'opacity 0.5s ease',
            }}
            allow="bluetooth; microphone"
            title="ASCEN Session"
          />
          <PullDownShade phase="breathing" character={character} />
        </>
      )}

      {/* ── ASCENT ── */}
      {phase === 'ascent' && (
        <DescentAnimation
          mode="ascent"
          character={character}
          coherence={0.5}
          ascentWeatherBoost={ascentWeatherBoost}
          onComplete={handleAscentComplete}
        />
      )}

      {/* ── VAGAL JOURNEY ── */}
      {phase === 'journey' && (
        <VagalJourneyScreen
          sessionId={sessionId}
          character={character}
          onContinue={handleJourneyContinue}
        />
      )}

      {/* Pull-down shade during descent */}
      {phase === 'descent' && (
        <PullDownShade phase="descent" character={character} />
      )}
    </div>
  );
}
