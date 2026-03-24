import Plankton from './Plankton';
import MiniLuno from './MiniLuno';

/**
 * SessionLauncher — Full-screen overlay before session begins
 */
export default function SessionLauncher({ nextSession, character = 'luno', coherence = 0.3, sessionCount = 0, onBegin, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'rgba(2,8,18,0.95)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <Plankton coherence={coherence} sessionCount={sessionCount} character={character} />

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'none', border: 'none',
          color: 'rgba(160,196,232,0.4)', fontSize: 24,
          cursor: 'pointer', zIndex: 91
        }}
      >
        &#x2715;
      </button>

      <div style={{ zIndex: 1, textAlign: 'center' }}>
        <MiniLuno size={80} character={character} coherence={coherence} />

        <h2 style={{
          fontSize: 24, fontWeight: 300, color: '#e2e8f0',
          marginTop: 32, fontFamily: 'Outfit, sans-serif'
        }}>
          {nextSession?.title || `Session ${nextSession?.number || 1}`}
        </h2>

        {nextSession?.arc && (
          <p style={{
            fontSize: 14, color: 'rgba(160,196,232,0.5)',
            marginTop: 8, fontFamily: 'Outfit, sans-serif',
            textTransform: 'capitalize'
          }}>
            {nextSession.arc} arc · {nextSession.duration_minutes || 12} min
          </p>
        )}

        <button
          onClick={onBegin}
          style={{
            marginTop: 40,
            padding: '16px 48px',
            borderRadius: 16,
            border: 'none',
            background: character === 'luna'
              ? 'linear-gradient(135deg, rgba(244,180,196,0.4), rgba(200,140,170,0.25))'
              : 'linear-gradient(135deg, rgba(79,209,197,0.4), rgba(99,179,237,0.25))',
            color: character === 'luna' ? '#f4b4c4' : '#4fd1c5',
            fontSize: 18,
            fontWeight: 500,
            fontFamily: 'Outfit, sans-serif',
            cursor: 'pointer',
            letterSpacing: '0.03em'
          }}
        >
          Begin Breathing
        </button>
      </div>
    </div>
  );
}
