import CoherenceRings from './CoherenceRings';

const CAPACITY_STATES = {
  full:         { label: 'Full',         color: '#68d391', desc: 'Your capacity is strong. A great day to invest.' },
  steady:       { label: 'Steady',       color: '#4fd1c5', desc: 'Balanced and present. Keep showing up.' },
  drawing_down: { label: 'Drawing Down', color: '#f6ad55', desc: 'Be gentle with yourself today.' },
  low:          { label: 'Low',          color: '#fc8181', desc: "Rest is not giving up. It\u2019s building back." },
  depleted:     { label: 'Depleted',     color: '#e53e3e', desc: "You\u2019re here. That matters most right now." }
};

export default function CapacityCard({ state = 'steady', coherence = 0.3, character = 'luno' }) {
  const cap = CAPACITY_STATES[state] || CAPACITY_STATES.steady;

  return (
    <div style={{
      background: 'rgba(10,22,40,0.7)',
      backdropFilter: 'blur(20px)',
      borderRadius: 20,
      padding: '20px 24px',
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <CoherenceRings coherence={coherence} size={56} character={character} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: cap.color,
              boxShadow: `0 0 6px ${cap.color}`
            }} />
            <span style={{
              fontSize: 15, fontWeight: 500,
              color: cap.color, fontFamily: 'Outfit, sans-serif'
            }}>
              {cap.label}
            </span>
          </div>
          <p style={{
            fontSize: 13, color: 'rgba(160,196,232,0.6)',
            lineHeight: 1.4, margin: 0,
            fontFamily: 'Outfit, sans-serif'
          }}>
            {cap.desc}
          </p>
        </div>
      </div>
    </div>
  );
}
