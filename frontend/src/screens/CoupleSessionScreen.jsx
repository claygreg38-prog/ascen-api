import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// CoupleSessionScreen — embedded co-breath launcher (Item 7, Phase 1a)
//
// Mirrors SessionScreen: iframes the v8 engine at /breathe?embedded=true&coupling=1
// and hands the participant's JWT to it via postMessage (NEVER via URL). The v8
// CouplingUI (A2 entry) then runs with the REAL per-partner JWT — enroll/eligibility
// and (Phase 1b) the gated WS join + tick-bio carry that identity.
//
// Phase 1a = the auth handoff only (reach A2 entry embedded, holding the real JWT).
// Phase 1b adds the live co-breath surface inside index_v8.
// ═══════════════════════════════════════════════════════════════

export default function CoupleSessionScreen() {
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || '';
  const breatheUrl = `${apiBase}/breathe?embedded=true&coupling=1`;

  useEffect(() => {
    const breatheOrigin = apiBase ? new URL(apiBase).origin : window.location.origin;

    function handleMessage(event) {
      if (event.origin !== window.location.origin && event.origin !== breatheOrigin) return;
      const { type } = event.data || {};

      switch (type) {
        case 'iframe_ready':
          // Hand the participant's JWT to the v8 iframe (same mechanism as solo sessions).
          iframeRef.current?.contentWindow?.postMessage({
            type: 'auth',
            token: localStorage.getItem('ascen_jwt'),
            apiKey: localStorage.getItem('ascen_api_key') || '',
          }, breatheOrigin);
          setIframeReady(true);
          break;

        case 'session_complete':
        case 'session_exit':
          setTimeout(() => navigate('/app/', { state: { sessionCompleted: true } }), 500);
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, apiBase]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#020812' }}>
      {!iframeReady && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101 }}>
          <div style={{ color: 'rgba(160,196,232,0.5)', fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 300 }}>
            Preparing to breathe together...
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={breatheUrl}
        style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, border: 'none', background: '#020812', opacity: iframeReady ? 1 : 0, transition: 'opacity 0.5s ease' }}
        allow="bluetooth; microphone"
        title="ASCEN Coupling"
      />
    </div>
  );
}
