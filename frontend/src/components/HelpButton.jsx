import { useNavigate } from 'react-router-dom';

export default function HelpButton() {
  const nav = useNavigate();
  return (
    <button onClick={() => nav('/app/crisis')} style={{
      position: 'fixed', bottom: '80px', right: '16px', zIndex: 90,
      background: '#2a1a1a', color: '#f07050', border: '1px solid #3a2a2a',
      borderRadius: '50%', width: '44px', height: '44px', fontSize: '12px',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, letterSpacing: '0.5px'
    }}>
      SOS
    </button>
  );
}
