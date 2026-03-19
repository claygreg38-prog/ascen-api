import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

const THREAD_COLORS = { active: '#ff6b6b', breaking: '#f0b860', broken: '#5ffce0' };

export default function HealingMapScreen() {
  const [map, setMap] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add genealogy form
  const [showForm, setShowForm] = useState(false);
  const [genName, setGenName] = useState('');
  const [genRelation, setGenRelation] = useState('');
  const [genPatterns, setGenPatterns] = useState('');
  const [genGen, setGenGen] = useState('1');
  const [saving, setSaving] = useState(false);

  const user = getUser();
  const familyUnitId = user?.familyUnitId || user?.family_unit_id;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [mapRes, predRes] = await Promise.all([
        api.get(`/api/compass/healing-map/${familyUnitId}`),
        api.get(`/api/compass/prediction/${familyUnitId}`)
      ]);
      setMap(mapRes.data);
      setPredictions(predRes.data);
    } catch {}
    setLoading(false);
  }

  async function addGenealogy() {
    if (!genName.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/compass/healing-map/${familyUnitId}/genealogy`, {
        name: genName,
        relationship: genRelation,
        patterns: genPatterns.split(',').map(p => p.trim()).filter(Boolean),
        generation: parseInt(genGen) || 1
      });
      setGenName(''); setGenRelation(''); setGenPatterns(''); setGenGen('1');
      setShowForm(false);
      loadData();
    } catch {}
    setSaving(false);
  }

  function riskColor(score) {
    if (score <= 30) return '#5ffce0';
    if (score <= 60) return '#f0b860';
    return '#ff6b6b';
  }

  if (loading) {
    return <div style={S.container}><p style={S.dim}>Loading...</p></div>;
  }

  const generations = map?.generations || [];
  const threads = map?.pattern_threads || [];
  const risk = predictions?.risk_score ?? null;
  const direction = predictions?.direction;
  const warnings = predictions?.early_warnings || [];
  const positives = predictions?.positive_signals || [];
  const recs = predictions?.recommendations || [];

  return (
    <div style={S.container}>
      <h2 style={S.title}>Healing Map</h2>
      <p style={S.sub}>See where patterns started and how your family is changing them.</p>

      {/* Family tree */}
      {generations.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={S.sectionTitle}>Family Tree</h3>
          {generations.map((gen, gi) => (
            <div key={gi} style={S.genRow}>
              <p style={S.genLabel}>Generation {gen.generation || gi + 1}</p>
              <div style={S.genNodes}>
                {(gen.members || []).map((m, mi) => (
                  <div key={mi} style={S.genNode}>
                    <p style={S.nodeName}>{m.name}</p>
                    <p style={S.nodeRel}>{m.relationship}</p>
                    {m.patterns && m.patterns.length > 0 && (
                      <div style={S.patternList}>
                        {m.patterns.map((p, pi) => {
                          const status = typeof p === 'object' ? p.status : 'active';
                          const label = typeof p === 'object' ? p.name : p;
                          return (
                            <span key={pi} style={{ ...S.patternTag, background: THREAD_COLORS[status] || '#ff6b6b', color: status === 'breaking' ? '#061a2a' : '#fff' }}>
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pattern threads legend */}
      {threads.length > 0 && (
        <div style={S.card}>
          <p style={S.cardLabel}>Pattern Threads</p>
          {threads.map((t, i) => (
            <div key={i} style={S.threadRow}>
              <span style={{ ...S.threadDot, background: THREAD_COLORS[t.status] || '#ff6b6b' }} />
              <span style={{ color: '#e0e0e0', fontSize: '14px' }}>{t.name || t.pattern}</span>
              <span style={{ color: '#8899aa', fontSize: '12px', marginLeft: 'auto' }}>{t.status}</span>
            </div>
          ))}
          <div style={S.legendRow}>
            <span style={S.legendItem}><span style={{ ...S.legendDot, background: '#ff6b6b' }} /> Active</span>
            <span style={S.legendItem}><span style={{ ...S.legendDot, background: '#f0b860' }} /> Breaking</span>
            <span style={S.legendItem}><span style={{ ...S.legendDot, background: '#5ffce0' }} /> Broken</span>
          </div>
        </div>
      )}

      {/* Add genealogy */}
      <button onClick={() => setShowForm(!showForm)} style={S.addBtn}>
        {showForm ? 'Cancel' : '+ Add Family Member'}
      </button>

      {showForm && (
        <div style={S.card}>
          <input value={genName} onChange={e => setGenName(e.target.value)} placeholder="Name" style={S.input} />
          <input value={genRelation} onChange={e => setGenRelation(e.target.value)} placeholder="Relationship (e.g. grandmother)" style={{ ...S.input, marginTop: '8px' }} />
          <input value={genPatterns} onChange={e => setGenPatterns(e.target.value)} placeholder="Patterns (comma separated)" style={{ ...S.input, marginTop: '8px' }} />
          <select value={genGen} onChange={e => setGenGen(e.target.value)} style={{ ...S.input, marginTop: '8px' }}>
            <option value="1">Generation 1 (parents)</option>
            <option value="2">Generation 2 (grandparents)</option>
            <option value="3">Generation 3 (great-grandparents)</option>
          </select>
          <button onClick={addGenealogy} disabled={saving} style={S.btn}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {/* Predictions */}
      {predictions && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={S.sectionTitle}>Insights</h3>

          {/* Risk gauge */}
          {risk != null && (
            <div style={S.gaugeCard}>
              <div style={S.gaugeCircle(riskColor(risk))}>
                <span style={S.gaugeNum}>{risk}</span>
              </div>
              <div>
                <p style={{ color: '#e0e0e0', fontSize: '15px', fontWeight: 600, margin: '0 0 2px 0' }}>
                  Risk Score
                  {direction && <span style={{ marginLeft: '8px', fontSize: '18px' }}>
                    {direction === 'improving' ? '\u2193' : direction === 'worsening' ? '\u2191' : '\u2192'}
                  </span>}
                </p>
                <p style={S.dim}>
                  {risk <= 30 ? 'Looking good.' : risk <= 60 ? 'Some things to watch.' : 'Needs attention.'}
                </p>
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div style={S.card}>
              <p style={{ ...S.cardLabel, color: '#f0b860' }}>Things to Watch</p>
              {warnings.map((w, i) => (
                <p key={i} style={S.listItem}>{w}</p>
              ))}
            </div>
          )}

          {/* Positives */}
          {positives.length > 0 && (
            <div style={S.card}>
              <p style={{ ...S.cardLabel, color: '#5ffce0' }}>Good Signs</p>
              {positives.map((p, i) => (
                <p key={i} style={S.listItem}>{p}</p>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <div style={S.card}>
              <p style={S.cardLabel}>What Might Help</p>
              {recs.map((r, i) => (
                <p key={i} style={S.listItem}>{r}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { padding: '24px', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 600, color: '#5ffce0', marginBottom: '4px' },
  sub: { color: '#8899aa', marginBottom: '20px', fontSize: '15px', lineHeight: '1.5' },
  dim: { color: '#8899aa', fontSize: '13px', margin: 0 },
  sectionTitle: { color: '#5ffce0', fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0' },
  card: { background: '#0a2540', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
  cardLabel: { color: '#e0e0e0', fontSize: '14px', fontWeight: 600, margin: '0 0 10px 0' },
  genRow: { marginBottom: '16px' },
  genLabel: { color: '#f0b860', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' },
  genNodes: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  genNode: { background: '#0a2540', borderRadius: '10px', padding: '12px 16px', minWidth: '120px', flex: '1 1 auto' },
  nodeName: { color: '#e0e0e0', fontWeight: 600, fontSize: '14px', margin: '0 0 2px 0' },
  nodeRel: { color: '#8899aa', fontSize: '12px', margin: '0 0 6px 0' },
  patternList: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  patternTag: { padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 },
  threadRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' },
  threadDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  legendRow: { display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #112d4a' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '4px', color: '#8899aa', fontSize: '12px' },
  legendDot: { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' },
  gaugeCard: { background: '#0a2540', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '12px' },
  gaugeCircle: (color) => ({
    width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
    border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 0 16px ${color}30`
  }),
  gaugeNum: { fontSize: '22px', fontWeight: 700, color: '#e0e0e0' },
  listItem: { color: '#ccdde0', fontSize: '14px', lineHeight: '1.5', padding: '4px 0', margin: 0 },
  addBtn: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px dashed #1a3a5c', background: 'transparent', color: '#5ffce0', fontSize: '14px', cursor: 'pointer', marginBottom: '12px' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '15px', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '12px' },
};
