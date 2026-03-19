import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../services/auth';
import api from '../services/api';
import CapacityDot from '../components/CapacityDot';
import FacilitatedChat from '../components/FacilitatedChat';

const TABS = ['Members', 'Co-Breath', 'Messages', 'Kitchen Table'];

export default function FamilyScreen() {
  const [tab, setTab] = useState(0);
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [topic, setTopic] = useState(null);
  const [coBreathMode, setCoBreathMode] = useState('sync');
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

  async function startCoBreath(partnerId) {
    try {
      const { data } = await api.post('/api/cobreath/initiate', {
        partner_user_id: partnerId,
        family_unit_id: family?.family_unit_id,
        mode: coBreathMode
      });
      if (data.roomCode) nav(`/app/cobreath/${data.roomCode}`);
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
          <button key={t} onClick={() => { setTab(i); if (i === 3) loadTopic(); }}
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

      {/* CO-BREATH */}
      {tab === 1 && (
        <div>
          <div style={S.modeSelect}>
            {[['sync', 'Same rhythm together'], ['adaptive', 'Your own rhythm, start together'], ['silent', 'Same time, own pace']].map(([m, desc]) => (
              <label key={m} style={{ ...S.modeLabel, borderColor: coBreathMode === m ? '#5ffce0' : '#1a2a3a' }}
                onClick={() => setCoBreathMode(m)}>
                <strong style={{ color: coBreathMode === m ? '#5ffce0' : '#8899aa' }}>{m}</strong>
                <span style={S.modeDesc}>{desc}</span>
              </label>
            ))}
          </div>
          {members.filter(m => m.user_id !== user?.id).map((m, i) => (
            <div key={i} style={S.member}>
              <CapacityDot state={m.state || 'unknown'} size={14} />
              <span style={{ flex: 1 }}>{m.first_name || m.name}</span>
              <button onClick={() => startCoBreath(m.user_id)} style={S.btnSm}>Breathe Together</button>
            </div>
          ))}
        </div>
      )}

      {/* MESSAGES */}
      {tab === 2 && (
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
      {tab === 3 && (
        <div>
          {topic ? (
            <div style={S.card}>
              <span style={S.topicBadge}>{topic.category}</span>
              <h3 style={{ fontSize: '16px', margin: '8px 0' }}>{topic.title}</h3>
              <p style={{ color: '#8899aa', fontSize: '14px', lineHeight: 1.5 }}>{topic.prompt_text || topic.description}</p>
              <button onClick={() => nav('/app/session')} style={{ ...S.btn, marginTop: '12px' }}>Proceed to Breathing</button>
            </div>
          ) : (
            <div style={S.card}>
              <p style={S.dim}>Loading topic...</p>
              <button onClick={loadTopic} style={S.btnSec}>Get Topic</button>
            </div>
          )}
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
  modeSelect: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  modeLabel: { display: 'flex', flexDirection: 'column', padding: '12px', borderRadius: '12px', border: '1px solid', cursor: 'pointer', background: '#0a2540' },
  modeDesc: { fontSize: '12px', color: '#8899aa', marginTop: '2px' },
  topicBadge: { fontSize: '11px', color: '#f0b860', textTransform: 'uppercase', letterSpacing: '1px' },
  locked: { textAlign: 'center', padding: '24px', color: '#556677' },
  input: { background: '#112d4a', border: '1px solid #1a3a5a', color: '#fff', padding: '12px 16px', borderRadius: '12px', fontSize: '15px', width: '100%', maxWidth: '280px', outline: 'none', marginBottom: '12px' },
  btn: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontSize: '15px', cursor: 'pointer' },
  btnSec: { background: 'transparent', color: '#5ffce0', border: '1px solid #1a3a5a', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', marginTop: '12px', display: 'block', width: '100%' },
  btnSm: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  dim: { color: '#556677', textAlign: 'center' }
};
