import MiniLuno from './MiniLuno';

export default function SessionCard({ nextSession, character = 'luno', coherence = 0.3, onBegin }) {
  return (
    <div style={{
      background: 'rgba(10,22,40,0.7)',
      backdropFilter: 'blur(20px)',
      borderRadius: 20,
      padding: '24px',
      border: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <MiniLuno size={40} character={character} coherence={coherence} />
        <div style={{ textAlign: 'left' }}>
          <p style={{
            fontSize: 11, color: 'rgba(160,196,232,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            margin: 0, fontFamily: 'Outfit, sans-serif'
          }}>
            Next Session
          </p>
          <p style={{
            fontSize: 18, fontWeight: 500, color: '#e2e8f0',
            margin: '2px 0 0', fontFamily: 'Outfit, sans-serif'
          }}>
            {nextSession?.title || `Session ${nextSession?.number || 1}`}
          </p>
          {nextSession?.arc && (
            <p style={{
              fontSize: 12, color: 'rgba(160,196,232,0.4)',
              margin: '2px 0 0', fontFamily: 'Outfit, sans-serif',
              textTransform: 'capitalize'
            }}>
              {nextSession.arc} · {nextSession.duration_minutes || 12} min
            </p>
          )}
        </div>
      </div>

      <button
        onClick={onBegin}
        style={{
          width: '100%',
          padding: '14px 36px',
          borderRadius: 14,
          border: 'none',
          background: character === 'luna'
            ? 'linear-gradient(135deg, rgba(244,180,196,0.3), rgba(200,140,170,0.2))'
            : 'linear-gradient(135deg, rgba(79,209,197,0.3), rgba(99,179,237,0.2))',
          color: character === 'luna' ? '#f4b4c4' : '#4fd1c5',
          fontSize: 16,
          fontWeight: 500,
          fontFamily: 'Outfit, sans-serif',
          cursor: 'pointer',
          transition: 'opacity 0.2s'
        }}
      >
        Begin
      </button>
    </div>
  );
}
