import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// SessionScreen — v8 Iframe Container
//
// The v8 engine (/breathe) handles ALL session visuals and phases:
//   landing → 30s baseline → settle (descent) → breathing →
//   ascent → art → vagal journey → vault
//
// The PWA only:
//   1. Shows "Preparing your session..." until iframe_ready
//   2. Displays the iframe fullscreen
//   3. Listens for postMessage events
//
// NO animations, NO descent, NO breathing UI in the PWA layer.
// ═══════════════════════════════════════════════════════════════

export default function SessionScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const iframeRef = useRef(null);

  const [iframeReady, setIframeReady] = useState(false);

  const sessionNumber = searchParams.get('s') || null;
  const apiBase = import.meta.env.VITE_API_URL || '';

  // Build iframe URL — v8 engine handles everything
  let breatheUrl = `${apiBase}/breathe?embedded=true`;
  if (sessionNumber) breatheUrl += `&session=${sessionNumber}`;

  // ── Listen for postMessage events from v8 iframe ──────────
  useEffect(() => {
    const breatheOrigin = apiBase ? new URL(apiBase).origin : window.location.origin;

    function handleMessage(event) {
      // Accept messages from API origin or same origin
      if (event.origin !== window.location.origin && event.origin !== breatheOrigin) return;
      const { type, data } = event.data || {};

      switch (type) {
        case 'iframe_ready':
          // Send auth to iframe via postMessage (NEVER via URL params)
          iframeRef.current?.contentWindow?.postMessage({
            type: 'auth',
            token: localStorage.getItem('ascen_jwt'),
            apiKey: localStorage.getItem('ascen_api_key') || '',
          }, breatheOrigin);
          setIframeReady(true);
          break;

        case 'session_complete':
          // v8 handles its own art/vagal/vault flow.
          // When user clicks Done in vault, we return to home.
          navigate('/app/');
          break;

        case 'session_exit':
          navigate('/app/');
          break;

        case 'view_gallery':
          navigate('/app/gallery');
          break;

        case 'open_vault':
          navigate('/app/vault', { state: { fromSession: true, sessionNumber } });
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, sessionNumber, apiBase]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#020812' }}>
      {/* Loading state until iframe signals ready */}
      {!iframeReady && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 101,
        }}>
          <div style={{
            color: 'rgba(160,196,232,0.5)',
            fontSize: 14,
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 300,
          }}>
            Preparing your session...
          </div>
        </div>
      )}

      {/* v8 iframe — handles ALL session phases */}
      <iframe
        ref={iframeRef}
        src={breatheUrl}
        style={{
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          border: 'none',
          background: '#020812',
          opacity: iframeReady ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
        allow="bluetooth; microphone"
        title="ASCEN Session"
      />
    </div>
  );
}
