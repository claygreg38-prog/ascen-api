import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

export default function LightBridgeScreen() {
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simMode, setSimMode] = useState(false);
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const user = getUser();
  const userId = user?.participant_id || user?.userId;

  useEffect(() => { loadDevices(); }, []);

  async function loadDevices() {
    try {
      const { data } = await api.get(`/api/lightbridge/devices/${userId}`);
      setDevices(data?.devices || []);
      setEvents(data?.recent_events || []);
      setSimMode(data?.simulation_mode || false);
    } catch {}
    setLoading(false);
  }

  async function addDevice() {
    if (!addName.trim()) return;
    setAdding(true);
    try {
      await api.post('/api/lightbridge/register', {
        participant_id: userId,
        device_name: addName,
        provider: 'lifx'
      });
      setAddName('');
      loadDevices();
    } catch {}
    setAdding(false);
  }

  async function testDevice(deviceId) {
    setTestingId(deviceId);
    try {
      await api.post(`/api/lightbridge/test/${deviceId}`);
    } catch {}
    setTimeout(() => setTestingId(null), 2000);
  }

  function stateColor(state) {
    const colors = { full: '#5ffce0', steady: '#5fb8fc', drawing_down: '#f0b860', low: '#ff8c42', depleted: '#ff6b6b' };
    return colors[state] || '#556677';
  }

  return (
    <div style={S.container}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <h2 style={S.title}>Light Bridge</h2>
        {simMode && <span style={S.simBadge}>Simulation</span>}
      </div>
      <p style={S.sub}>Your lights reflect how you are doing.</p>

      {/* Add device */}
      <div style={S.card}>
        <p style={S.cardTitle}>Add a Light</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={addName} onChange={e => setAddName(e.target.value)}
            placeholder="Light name" style={{ ...S.input, flex: 1 }} />
          <button onClick={addDevice} disabled={adding} style={S.addBtn}>
            {adding ? '...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Devices */}
      {loading && <p style={S.dim}>Loading...</p>}

      {devices.map(d => (
        <div key={d.device_id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: `radial-gradient(circle, ${stateColor(d.current_state)}, transparent)`,
                border: `2px solid ${stateColor(d.current_state)}`,
                boxShadow: `0 0 12px ${stateColor(d.current_state)}40`
              }} />
              <div>
                <p style={{ color: '#e0e0e0', fontWeight: 600, margin: 0, fontSize: '15px' }}>{d.device_name}</p>
                <p style={S.dim}>{d.current_state || 'unknown'}</p>
              </div>
            </div>
            <button onClick={() => testDevice(d.device_id)}
              style={{ ...S.testBtn, background: testingId === d.device_id ? '#f0b860' : '#1a7a6d' }}>
              {testingId === d.device_id ? 'Sent!' : 'Test'}
            </button>
          </div>
        </div>
      ))}

      {!loading && devices.length === 0 && (
        <p style={{ ...S.dim, textAlign: 'center', marginTop: '24px' }}>No lights added yet.</p>
      )}

      {/* Recent events */}
      {events.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={S.sectionTitle}>Recent Activity</h3>
          {events.map((ev, i) => (
            <div key={i} style={S.eventRow}>
              <span style={S.eventDot(stateColor(ev.state || 'steady'))} />
              <div>
                <p style={{ color: '#e0e0e0', margin: 0, fontSize: '14px' }}>{ev.event_type || ev.description || 'Light changed'}</p>
                <p style={S.dim}>{ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { padding: '24px', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 600, color: '#5ffce0', margin: 0 },
  sub: { color: '#8899aa', marginBottom: '20px', fontSize: '15px' },
  dim: { color: '#8899aa', fontSize: '13px', margin: 0 },
  simBadge: { background: '#f0b860', color: '#061a2a', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 },
  card: { background: '#0a2540', borderRadius: '12px', padding: '16px', marginTop: '12px' },
  cardTitle: { color: '#5ffce0', fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0' },
  input: { padding: '12px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '15px' },
  addBtn: { padding: '12px 20px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  testBtn: { padding: '10px 16px', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  sectionTitle: { color: '#5ffce0', fontSize: '15px', fontWeight: 600, marginBottom: '12px' },
  eventRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #112d4a' },
  eventDot: (color) => ({ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }),
};
