import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../services/auth';
import api from '../services/api';
import CapacityDot from '../components/CapacityDot';
import FacilitatedChat from '../components/FacilitatedChat';

const TABS = ['Members', 'Messages', 'Kitchen Table'];

export default function FamilyScreen() {
  const [tab, setTab] = useState(0);
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [topic, setTopic] = useState(null);
  const user = getUser();
  const nav = useNavigate();

  useEffect(() => { loadFamily(); }, []);

  async function loadFamily() {
    try {
      const { data } = await api.get(`/api/family/unit/${user?.familyUnitId || 'mine'}`);
      setFamily(data);
      if (data?.members) setMembers(data.members);
    } catch {}
  }

  async function invite() {
    try {
      const { data } = await api.post('/api/family/invite', { family_unit_id: family?.family_unit_id });
      setInviteCode(data.invitation_code || data.code || 'Generated');
    } catch {}
  }

  async function join() {
    if (!joinCode) return;
    try {
      await api.post('/api/family/accept', { invitation_code: joinCode });
      loadFamily();
    } catch {}
  }

  async function loadTopic() {
    try {
      const { data } = await api.get('/api/kitchen-table/topic');
      setTopic(data);
    } catch {}
  }

  if (!family || !family.family_unit_id) {
    return (
      <div style={S.container}>
        <h2 style={S.title}>Family</h2>
        <p style={S.dim}>Not part of a family unit yet.</p>
        <input value={joinCode} onChange={e => setJoinCode(e.target.value)}
          placeholder="Enter invite code" style={S.input} />
        <button onClick={join} style={S.btn}>Join Family</button>
        <div style={{ height: '80px' }} />
      </div>
    );
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>{family.name || 'Your Family'}</h2>

      <div style={S.tabs}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); if (i === 2) loadTopic(); }}
            style={{ ...S.tab, color: i === tab ? '#5ffce0' : '#556677', borderBottom: i === tab ? '2px solid #5ffce0' : 'none' }}>
            {t}
          </button>
        ))}
      </div>

      {/* MEMBERS */}
      {tab === 0 && (
        <div>
          {family.gate_state && (
            <div style={S.gates}>
              {['gate_1', 'gate_2', 'gate_3'].map((g, i) => (
                <span key={g} style={{ color: family.gate_state[g] ? '#5ffce0' : '#334455' }}>
                  Gate {i + 1} {family.gate_state[g] ? '✓' : '○'}
                </span>
              ))}
            </div>
          )}
          <button onClick={() => nav('/app/family/crest')} style={{ ...S.btn, marginBottom: 12, background: 'rgba(92,224,208,0.08)', border: '1px solid rgba(92,224,208,0.2)', color: '#5ffce0' }}>
            View Family Crest
          </button>
          {members.map((m, i) => (
            <div key={i} style={S.member}>
              <CapacityDot state={m.privacy_mode ? 'private' : m.state || 'unknown'} size={14} />
              <span style={{ flex: 1 }}>{m.first_name || m.name}</span>
              <span style={S.badge}>{m.role}</span>
            </div>
          ))}
          <button onClick={invite} style={S.btnSec}>Invite Family Member</button>
          {inviteCode && <p style={{ color: '#5ffce0', marginTop: '8px', textAlign: 'center' }}>Code: {inviteCode}</p>}
        </div>
      )}

      {/* MESSAGES */}
      {tab === 1 && (
        <div>
          {family.premium_tier === 'base' || (!family.premium_tier) ? (
            <div style={S.locked}>
              <p>Two-way messaging requires Guided Bridge</p>
              <button onClick={() => nav('/app/subscription')} style={S.btn}>Upgrade</button>
            </div>
          ) : (
            <FacilitatedChat familyUnitId={family.family_unit_id} channelType="parent_child" />
          )}
        </div>
      )}

      {/* KITCHEN TABLE */}
      {tab === 2 && (
        <div>
          <div style={S.card}>
            <p style={{ color: '#8899aa', fontSize: '14px', lineHeight: 1.7, marginBottom: 12 }}>
              The kitchen table is where healing starts. Not by talking about everything at once — but by learning to sit together differently.
            </p>
            <button onClick={() => nav('/app/family/kitchen-table')} style={S.btn}>Go to the Table</button>
          </div>
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', padding: '24px 16px', background: '#061a2a' },
  title: { fontSize: '22px', fontWeight: 300, color: '#5ffce0', marginBottom: '4px' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '16px', overflowX: 'auto' },
  tab: { background: 'none', border: 'none', padding: '10px 12px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  card: { background: '#0a2540', borderRadius: '16px', padding: '20px', marginBottom: '12px' },
  member: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #112d4a' },
  badge: { fontSize: '11px', color: '#556677', textTransform: 'capitalize' },
  gates: { display: 'flex', gap: '16px', padding: '12px 0', fontSize: '13px' },
  topicBadge: { fontSize: '11px', color: '#f0b860', textTransform: 'uppercase', letterSpacing: '1px' },
  locked: { textAlign: 'center', padding: '24px', color: '#556677' },
  input: { background: '#112d4a', border: '1px solid #1a3a5a', color: '#fff', padding: '12px 16px', borderRadius: '12px', fontSize: '15px', width: '100%', maxWidth: '280px', outline: 'none', marginBottom: '12px' },
  btn: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontSize: '15px', cursor: 'pointer' },
  btnSec: { background: 'transparent', color: '#5ffce0', border: '1px solid #1a3a5a', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', marginTop: '12px', display: 'block', width: '100%' },
  dim: { color: '#556677', textAlign: 'center' }
};
