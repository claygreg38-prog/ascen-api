import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../services/auth';
import api from '../services/api';
import CapacityDisplay from '../components/CapacityDisplay';

export default function ProfileScreen() {
  const user = getUser();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const { data } = await api.get('/api/auth/me');
      setStats(data);
    } catch {}
  }

  async function selfReport() {
    if (!confirm('This will let your support team know you need space. Continue?')) return;
    try {
      await api.post('/api/crisis/self-report');
      alert('Your team has been notified. Take whatever time you need.');
    } catch {}
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>{user?.first_name || user?.firstName || 'Profile'}</h2>
      <p style={{ color: '#556677', marginBottom: '20px' }}>{user?.participant_id || user?.userId}</p>

      {/* Crisis help */}
      <div style={S.card}>
        <button onClick={selfReport} style={S.helpBtn}>I need help</button>
        <p style={S.helpSub}>This notifies your clinical team. No questions asked.</p>
      </div>

      {/* Capacity */}
      <div style={S.card}>
        <CapacityDisplay userId={user?.userId || user?.participant_id} showTransactions showSleep />
      </div>

      {/* Journey */}
      <div style={S.card}>
        <p style={S.secTitle}>Your Journey</p>
        <p style={S.stat}>Sessions: {stats?.session_count || '—'}</p>
        <p style={{ color: '#556677', fontSize: '12px', marginTop: '4px' }}>Your healing record is permanent and yours.</p>
      </div>

      {/* Quick links */}
      <div style={S.card}>
        <p style={S.secTitle}>Features</p>
        {[
          ['Subscription', '/app/subscription'],
          ['Legacy Vault', '/app/vault'],
          ['LightBridge', '/app/lightbridge'],
          ['Showcase', '/app/showcase'],
        ].map(([label, path]) => (
          <button key={path} onClick={() => nav(path)} style={S.linkBtn}>{label}</button>
        ))}
      </div>

      {/* Privacy */}
      <div style={S.card}>
        <p style={S.secTitle}>Privacy</p>
        <button onClick={() => api.post('/api/crisis/privacy-mode/enable').catch(() => {})} style={S.optBtn}>
          Enable Privacy Mode
        </button>
        <p style={{ color: '#445566', fontSize: '11px', marginTop: '4px' }}>Hides your state from family members</p>
      </div>

      {/* Admin/Facilitator */}
      {(user?.role === 'admin' || user?.role === 'clinician' || user?.role === 'facilitator') && (
        <div style={S.card}>
          <p style={S.secTitle}>Clinical Tools</p>
          <button onClick={() => nav('/app/facilitator')} style={S.linkBtn}>Facilitator Dashboard</button>
        </div>
      )}

      {/* About */}
      <div style={{ textAlign: 'center', margin: '24px 0', color: '#334455', fontSize: '12px' }}>
        <p>ASCEN BreathWorx by Mettle Works Behavioral Health</p>
        <p style={{ marginTop: '4px' }}>Your breath. Your healing. Your art.</p>
      </div>

      <button onClick={logout} style={S.logoutBtn}>Sign Out</button>

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', padding: '24px 20px', background: '#061a2a' },
  title: { fontSize: '22px', fontWeight: 300, color: '#5ffce0', marginBottom: '4px' },
  card: { background: '#0a2540', borderRadius: '16px', padding: '20px', marginBottom: '12px' },
  secTitle: { color: '#556677', fontSize: '13px', marginBottom: '8px' },
  stat: { fontSize: '15px' },
  helpBtn: { background: '#2a1a1a', color: '#f07050', border: '1px solid #3a2a2a', padding: '14px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', width: '100%' },
  helpSub: { color: '#556677', fontSize: '12px', marginTop: '6px', textAlign: 'center' },
  linkBtn: { display: 'block', width: '100%', background: '#112d4a', color: '#8899aa', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', textAlign: 'left', marginBottom: '6px' },
  optBtn: { background: '#112d4a', color: '#8899aa', border: 'none', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', width: '100%', textAlign: 'left' },
  logoutBtn: { background: 'transparent', color: '#556677', border: '1px solid #1a2a3a', padding: '12px', borderRadius: '12px', fontSize: '14px', cursor: 'pointer', width: '100%' }
};
