import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';
import CapacityDot from '../components/CapacityDot';

export default function FamilyScreen() {
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteCode, setInviteCode] = useState('');
  const user = getUser();

  useEffect(() => { loadFamily(); }, []);

  async function loadFamily() {
    try {
      const { data } = await api.get(`/api/family/unit/${user?.familyUnitId || 'mine'}`);
      setFamily(data);
      if (data?.members) setMembers(data.members);
    } catch {}
  }

  async function joinFamily() {
    if (!inviteCode) return;
    try {
      await api.post('/api/family/accept', { invitation_code: inviteCode });
      loadFamily();
    } catch {}
  }

  if (!family || !family.family_unit_id) {
    return (
      <div style={S.container}>
        <h2 style={S.title}>Family</h2>
        <p style={S.dim}>Not part of a family unit yet.</p>
        <div style={{ marginTop: '24px' }}>
          <input value={inviteCode} onChange={e => setInviteCode(e.target.value)}
            placeholder="Enter invite code" style={S.input} />
          <button onClick={joinFamily} style={S.btn}>Join Family</button>
        </div>
        <div style={{ height: '80px' }} />
      </div>
    );
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>Family</h2>
      <p style={{ color: '#8899aa', marginBottom: '16px' }}>{family.name || 'Your family'}</p>

      <div style={S.card}>
        <p style={{ color: '#556677', fontSize: '13px', marginBottom: '12px' }}>Members</p>
        {members.map((m, i) => (
          <div key={i} style={S.member}>
            <CapacityDot state={m.state || 'unknown'} size={14} />
            <span style={{ flex: 1 }}>{m.first_name || m.name || 'Member'}</span>
            <span style={{ color: '#556677', fontSize: '12px' }}>{m.role}</span>
          </div>
        ))}
      </div>

      {family.gate_state && (
        <div style={S.card}>
          <p style={{ color: '#556677', fontSize: '13px', marginBottom: '8px' }}>Family Gates</p>
          {['gate_1', 'gate_2', 'gate_3'].map((g, i) => (
            <div key={g} style={S.gate}>
              <span style={{ fontSize: '14px' }}>Gate {i + 1}</span>
              <span style={{ color: family.gate_state[g] ? '#5ffce0' : '#334455' }}>
                {family.gate_state[g] ? 'Unlocked' : 'Locked'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', padding: '24px 20px', background: '#061a2a' },
  title: { fontSize: '22px', fontWeight: 300, color: '#5ffce0', marginBottom: '8px' },
  dim: { color: '#556677' },
  card: { background: '#0a2540', borderRadius: '16px', padding: '20px', marginBottom: '12px' },
  member: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #112d4a' },
  gate: { display: 'flex', justifyContent: 'space-between', padding: '8px 0' },
  input: { background: '#112d4a', border: '1px solid #1a3a5a', color: '#fff', padding: '12px 16px', borderRadius: '12px', fontSize: '15px', width: '100%', maxWidth: '280px', outline: 'none', marginBottom: '12px' },
  btn: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '12px 36px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer' }
};
