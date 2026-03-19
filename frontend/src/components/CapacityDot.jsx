const COLORS = {
  full: '#5ffce0',
  steady: '#5ffce0',
  drawing_down: '#f0b860',
  low: '#f07050',
  depleted: '#888',
  private: '#334',
  unknown: '#334'
};

export default function CapacityDot({ state = 'unknown', size = 16, label = false }) {
  const color = COLORS[state] || COLORS.unknown;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color, boxShadow: `0 0 ${size/2}px ${color}40`
      }} />
      {label && <span style={{ fontSize: '14px', color, fontWeight: 500, textTransform: 'capitalize' }}>
        {state === 'drawing_down' ? 'Drawing Down' : state}
      </span>}
    </div>
  );
}
