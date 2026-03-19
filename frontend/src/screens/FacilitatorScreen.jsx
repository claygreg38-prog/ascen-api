import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

const TABS = ['Enrollment', 'Participants', 'Crises', 'Disclosures'];

export default function FacilitatorScreen() {
  const [tab, setTab] = useState('Enrollment');
  const user = getUser();
  const role = user?.role;

  if (role !== 'facilitator' && role !== 'admin') {
    return (
      <div style={S.container}>
        <h2 style={S.title}>Not Allowed</h2>
        <p style={S.sub}>This page is only for facilitators.</p>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>Facilitator Dashboard</h2>

      <div style={S.tabRow}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...S.tabBtn, ...(tab === t ? S.tabActive : {}) }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Enrollment' && <EnrollmentTab />}
      {tab === 'Participants' && <ParticipantsTab />}
      {tab === 'Crises' && <CrisesTab />}
      {tab === 'Disclosures' && <DisclosuresTab />}

      <div style={{ height: '80px' }} />
    </div>
  );
}

function EnrollmentTab() {
  const [codes, setCodes] = useState([]);
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadCodes(); }, []);

  async function loadCodes() {
    try {
      const { data } = await api.get('/api/auth/codes');
      setCodes(data?.codes || data || []);
    } catch {}
  }

  async function generate() {
    setGenerating(true);
    try {
      await api.post('/api/auth/codes/generate', { count });
      loadCodes();
    } catch {}
    setGenerating(false);
  }

  async function revoke(codeId) {
    try {
      await api.post(`/api/auth/codes/revoke`, { code_id: codeId });
      loadCodes();
    } catch {}
  }

  return (
    <div>
      <div style={S.card}>
        <p style={S.cardLabel}>Generate Enrollment Codes</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={count} onChange={e => setCount(Number(e.target.value))} style={S.select}>
            {[1, 5, 10, 20].map(n => <option key={n} value={n}>{n} code{n > 1 ? 's' : ''}</option>)}
          </select>
          <button onClick={generate} disabled={generating} style={S.actionBtn}>
            {generating ? '...' : 'Generate'}
          </button>
        </div>
      </div>

      {codes.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <p style={S.cardLabel}>Active Codes</p>
          {codes.map(c => (
            <div key={c.code_id || c.code} style={S.codeRow}>
              <span style={S.codeText}>{c.code}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ ...S.statusDot, background: c.used ? '#8899aa' : '#5ffce0' }} />
                <span style={S.dim}>{c.used ? 'Used' : 'Available'}</span>
                {!c.used && (
                  <button onClick={() => revoke(c.code_id || c.id)} style={S.revokeBtn}>Revoke</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ParticipantsTab() {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/admin/participants');
        setParticipants(data?.participants || data || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <p style={S.dim}>Loading...</p>;

  return (
    <div>
      {participants.map(p => (
        <div key={p.user_id || p.participant_id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={S.pName}>{p.first_name || p.display_name || 'Participant'}</p>
              <p style={S.dim}>{p.session_count || 0} sessions</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {p.capacity_state && <span style={S.capBadge(p.capacity_state)}>{p.capacity_state}</span>}
              {p.last_active && <p style={{ ...S.dim, marginTop: '4px' }}>Last: {new Date(p.last_active).toLocaleDateString()}</p>}
            </div>
          </div>
        </div>
      ))}
      {participants.length === 0 && <p style={S.dim}>No participants yet.</p>}
    </div>
  );
}

function CrisesTab() {
  const [crises, setCrises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCrises(); }, []);

  async function loadCrises() {
    try {
      const { data } = await api.get('/api/crisis/active');
      setCrises(data?.crises || data || []);
    } catch {}
    setLoading(false);
  }

  async function declare() {
    const name = window.prompt('Participant ID or name:');
    if (!name) return;
    try {
      await api.post('/api/crisis/declare', { participant_identifier: name });
      loadCrises();
    } catch {}
  }

  async function resolve(crisisId) {
    if (!window.confirm('Mark this as resolved?')) return;
    try {
      await api.post(`/api/crisis/resolve`, { crisis_id: crisisId });
      loadCrises();
    } catch {}
  }

  if (loading) return <p style={S.dim}>Loading...</p>;

  return (
    <div>
      <button onClick={declare} style={{ ...S.actionBtn, marginBottom: '16px' }}>Declare a Concern</button>

      {crises.map(c => (
        <div key={c.crisis_id} style={{ ...S.card, borderLeft: '4px solid #ff6b6b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={S.pName}>{c.participant_name || c.participant_id}</p>
              <p style={S.dim}>Phase: {c.phase || 'active'}</p>
              {c.created_at && <p style={S.dim}>Started: {new Date(c.created_at).toLocaleDateString()}</p>}
            </div>
            <button onClick={() => resolve(c.crisis_id)} style={S.resolveBtn}>Resolve</button>
          </div>
        </div>
      ))}

      {crises.length === 0 && <p style={{ ...S.dim, marginTop: '16px' }}>No active concerns.</p>}
    </div>
  );
}

function DisclosuresTab() {
  const [disclosures, setDisclosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewId, setReviewId] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => { loadDisclosures(); }, []);

  async function loadDisclosures() {
    try {
      const { data } = await api.get('/api/clinical/disclosures');
      setDisclosures(data?.disclosures || data || []);
    } catch {}
    setLoading(false);
  }

  async function submitReview(disclosureId) {
    try {
      await api.post(`/api/clinical/disclosures/${disclosureId}/review`, { notes: reviewNote });
      setReviewId(null);
      setReviewNote('');
      loadDisclosures();
    } catch {}
  }

  if (loading) return <p style={S.dim}>Loading...</p>;

  return (
    <div>
      {disclosures.map(d => (
        <div key={d.disclosure_id} style={{ ...S.card, borderLeft: `4px solid ${d.classification === 'CRITICAL' ? '#ff6b6b' : '#f0b860'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={S.pName}>{d.participant_name || d.participant_id}</p>
              {d.classification && <span style={{ ...S.classBadge, background: d.classification === 'CRITICAL' ? '#ff6b6b' : '#f0b860' }}>{d.classification}</span>}
              {d.summary && <p style={{ color: '#aabbcc', fontSize: '14px', marginTop: '8px', lineHeight: '1.4' }}>{d.summary}</p>}
              {d.created_at && <p style={S.dim}>Reported: {new Date(d.created_at).toLocaleDateString()}</p>}
            </div>
          </div>

          {d.reviewed ? (
            <p style={{ color: '#5ffce0', fontSize: '13px', marginTop: '8px' }}>Reviewed</p>
          ) : reviewId === d.disclosure_id ? (
            <div style={{ marginTop: '12px' }}>
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                placeholder="Review notes..." style={S.textarea} rows={3} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => submitReview(d.disclosure_id)} style={S.actionBtn}>Submit Review</button>
                <button onClick={() => setReviewId(null)} style={S.cancelBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setReviewId(d.disclosure_id); setReviewNote(''); }} style={{ ...S.actionBtn, marginTop: '12px' }}>
              Review
            </button>
          )}
        </div>
      ))}

      {disclosures.length === 0 && <p style={S.dim}>No disclosures to review.</p>}
    </div>
  );
}

const S = {
  container: { padding: '24px', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 600, color: '#5ffce0', marginBottom: '16px' },
  sub: { color: '#8899aa', fontSize: '15px' },
  dim: { color: '#8899aa', fontSize: '13px', margin: 0 },
  tabRow: { display: 'flex', gap: '4px', marginBottom: '20px', overflowX: 'auto' },
  tabBtn: { padding: '10px 14px', borderRadius: '8px 8px 0 0', border: 'none', background: '#0a2540', color: '#8899aa', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  tabActive: { background: '#1a7a6d', color: '#fff' },
  card: { background: '#0a2540', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
  cardLabel: { color: '#5ffce0', fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0' },
  select: { padding: '12px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '14px', flex: 1 },
  actionBtn: { padding: '12px 20px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '12px 20px', borderRadius: '8px', border: '1px solid #1a3a5c', background: 'transparent', color: '#8899aa', fontSize: '14px', cursor: 'pointer' },
  codeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#0a2540', borderRadius: '8px', marginBottom: '6px' },
  codeText: { color: '#f0b860', fontFamily: 'monospace', fontSize: '15px', letterSpacing: '2px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' },
  revokeBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #ff6b6b', background: 'transparent', color: '#ff6b6b', fontSize: '12px', cursor: 'pointer' },
  pName: { color: '#e0e0e0', fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' },
  capBadge: (state) => {
    const colors = { full: '#5ffce0', steady: '#5fb8fc', drawing_down: '#f0b860', low: '#ff8c42', depleted: '#ff6b6b' };
    return { padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: colors[state] || '#556677', color: state === 'drawing_down' ? '#061a2a' : '#fff' };
  },
  resolveBtn: { padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  classBadge: { padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: '#fff', display: 'inline-block', marginTop: '4px' },
  textarea: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'sans-serif' },
};
