import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../services/auth';
import api from '../services/api';
import CapacityDot from '../components/CapacityDot';

export default function HomeScreen() {
  const [capacity, setCapacity] = useState(null);
  const [nextSession, setNextSession] = useState(null);
  const [crisis, setCrisis] = useState(null);
  const [recentArt, setRecentArt] = useState([]);
  const user = getUser();
  const nav = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [capRes, crisisRes] = await Promise.all([
        api.get(`/api/capacity/balance/${user?.userId || user?.participant_id}`).catch(() => null),
        api.get('/api/crisis/status').catch(() => null)
      ]);
      if (capRes?.data) setCapacity(capRes.data);
      if (crisisRes?.data) setCrisis(crisisRes.data);

      // Load recent art
      try {
        const artRes = await api.get(`/api/art/gallery/${user?.participant_id || user?.userId}?limit=3`);
        if (artRes.data?.gallery) setRecentArt(artRes.data.gallery.slice(0, 3));
      } catch {}

      // Determine next session
      if (capRes?.data?.sessionCount !== undefined) {
        setNextSession({ number: (capRes.data.sessionCount || 0) + 1 });
      }
    } catch {}
  }

  // Crisis mode: minimal UI
  if (crisis?.inCrisis) {
    return (
      <div style={S.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: '#5ffce0', fontSize: '22px', fontWeight: 300, lineHeight: 1.6 }}>
            You're here.<br />That's enough.
          </p>
          <button onClick={() => nav('/app/session')} style={{ ...S.btn, marginTop: '40px' }}>
            Breathe
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      {/* Greeting */}
      <h1 style={S.greeting}>Hey {user?.first_name || user?.firstName || 'there'}</h1>

      {/* Capacity */}
      {capacity && (
        <div style={S.card}>
          <CapacityDot state={capacity.state} size={20} label />
        </div>
      )}

      {/* Next session */}
      <div style={S.card}>
        <p style={{ color: '#8899aa', fontSize: '13px', marginBottom: '8px' }}>Next session</p>
        <p style={{ fontSize: '18px', fontWeight: 500 }}>
          Session {nextSession?.number || '1'}
        </p>
        <button onClick={() => nav('/app/session')} style={S.btn}>Begin</button>
      </div>

      {/* Recent art */}
      {recentArt.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <p style={{ color: '#556677', fontSize: '13px', marginBottom: '8px' }}>Recent</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {recentArt.map((a, i) => (
              <div key={i} onClick={() => nav('/app/gallery')} style={{
                width: '90px', height: '90px', borderRadius: '12px',
                background: '#0a2540', border: '1px solid #1a2a3a',
                cursor: 'pointer', overflow: 'hidden'
              }}>
                {a.ipfs_hash && <img src={`https://gateway.pinata.cloud/ipfs/${a.ipfs_hash}`}
                  alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacer for bottom nav */}
      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', padding: '24px 20px', background: '#061a2a' },
  greeting: { fontSize: '28px', fontWeight: 300, color: '#fff', marginBottom: '20px' },
  card: { background: '#0a2540', borderRadius: '16px', padding: '20px', marginBottom: '12px' },
  btn: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '12px 36px', borderRadius: '12px', fontSize: '16px', marginTop: '12px', cursor: 'pointer', width: '100%' }
};
