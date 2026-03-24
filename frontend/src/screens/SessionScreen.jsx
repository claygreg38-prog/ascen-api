import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function SessionScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);

  const sessionNumber = searchParams.get('s') || null;

  // SECURITY: JWT passed via postMessage, NOT URL params.
  let breatheUrl = '/breathe?embedded=true';
  if (sessionNumber) breatheUrl += `&session=${sessionNumber}`;

  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      const { type, data } = event.data || {};

      switch (type) {
        case 'iframe_ready':
          // v8 loaded — send auth via postMessage (never URL)
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'auth',
              token: localStorage.getItem('ascen_jwt'),
              apiKey: localStorage.getItem('ascen_api_key') || ''
            },
            window.location.origin
          );
          setLoading(false);
          break;
        case 'session_complete':
          navigate('/app/', {
            state: { sessionCompleted: true, sessionNumber: data?.session_number }
          });
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
  }, [navigate]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, background: '#000'
    }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#020812', zIndex: 101
        }}>
          <div style={{
            color: 'rgba(160,196,232,0.5)', fontSize: 14,
            fontFamily: 'Outfit, sans-serif'
          }}>
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
          background: '#000'
        }}
        allow="bluetooth; microphone"
        title="ASCEN Session"
      />
    </div>
  );
}
