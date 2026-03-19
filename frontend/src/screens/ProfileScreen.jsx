import { getUser, logout } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useState, useEffect } from 'react';

export default function ProfileScreen() {
  const user = getUser();
  const nav = useNavigate();
  const [sub, setSub] = useState(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      const { data } = await api.get('/api/subscription/tiers');
      setSub(data);
    } catch {}
  }

  async function selfReport() {
    if (!confirm('This will let your clinical team know you need support. Continue?')) return;
    try {
      await api.post('/api/crisis/self-report');
      alert('Your team has been notified. Take whatever time you need.');
    } catch {}
  }

  async function togglePrivacy() {
    try {
      await api.post('/api/crisis/privacy-mode/enable');
    } catch {}
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>{user?.first_name || user?.firstName || 'Profile'}</h2>
      <p style={{ color: '#556677', marginBottom: '24px' }}>
        {user?.participant_id || user?.userId}
      </p>

      <div style={S.card}>
        <button onClick={selfReport} style={S.helpBtn}>
          I need help
        </button>
        <p style={{ color: '#556677', fontSize: '12px', marginTop: '8px' }}>
          This notifies your clinical team. No questions asked.
        </p>
      </div>

      <div style={S.card}>
        <p style={{ color: '#556677', fontSize: '13px', marginBottom: '8px' }}>Privacy</p>
        <button onClick={togglePrivacy} style={S.optionBtn}>
          Enable Privacy Mode
        </button>
        <p style={{ color: '#445566', fontSize: '11px', marginTop: '4px' }}>
          Hides your state from family members
        </p>
      </div>

      {sub && (
        <div style={S.card}>
          <p style={{ color: '#556677', fontSize: '13px', marginBottom: '8px' }}>Subscription</p>
          {(sub.tiers || []).map(t => (
            <div key={t.id} style={S.tierRow}>
              <span>{t.name}</span>
              <span style={{ color: '#5ffce0', fontSize: '13px' }}>{t.price}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={logout} style={S.logoutBtn}>Sign Out</button>

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', padding: '24px 20px', background: '#061a2a' },
  title: { fontSize: '22px', fontWeight: 300, color: '#5ffce0', marginBottom: '4px' },
  card: { background: '#0a2540', borderRadius: '16px', padding: '20px', marginBottom: '12px' },
  helpBtn: { background: '#3a1a1a', color: '#f07050', border: '1px solid #5a2a2a', padding: '14px 32px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', width: '100%' },
  optionBtn: { background: '#112d4a', color: '#8899aa', border: 'none', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', width: '100%', textAlign: 'left' },
  tierRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #112d4a', fontSize: '14px' },
  logoutBtn: { background: 'transparent', color: '#556677', border: '1px solid #1a2a3a', padding: '12px 32px', borderRadius: '12px', fontSize: '14px', cursor: 'pointer', marginTop: '24px', width: '100%' }
};
