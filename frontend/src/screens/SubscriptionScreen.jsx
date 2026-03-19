import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

const TIERS = [
  { id: 'base', name: 'Base', price: 'Free', desc: 'Breathing, art, and your personal gallery. Always yours.', features: ['Guided breathing', 'Personal art', 'Gallery', 'Capacity tracking'] },
  { id: 'guided_bridge', name: 'Guided Bridge', price: '$14.99/mo', desc: 'Deeper tools for growth and connection.', trial: '14-day free trial', features: ['Everything in Base', 'Family messaging', 'Conflict tools', 'Letter writing', 'Kitchen table topics'] },
  { id: 'family_compass', name: 'Family Compass', price: '$29.99/mo', desc: 'Full family support and insights.', requires: 'Requires Guided Bridge', features: ['Everything in Guided Bridge', '12-week curriculum', 'Healing map', 'Weekly insights', 'Therapy reports'] },
];

export default function SubscriptionScreen() {
  const [current, setCurrent] = useState(null);
  const [trialDays, setTrialDays] = useState(null);
  const [history, setHistory] = useState([]);
  const [pilotMode, setPilotMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const user = getUser();
  const familyUnitId = user?.familyUnitId || user?.family_unit_id;

  useEffect(() => { loadSubscription(); }, []);

  async function loadSubscription() {
    try {
      const { data } = await api.get(`/api/subscription/status/${familyUnitId || 'mine'}`);
      setCurrent(data);
      setTrialDays(data?.trial_days_remaining ?? null);
      setPilotMode(data?.pilot_mode || false);
    } catch {}
    if (familyUnitId) {
      try {
        const { data } = await api.get(`/api/subscription/history/${familyUnitId}`);
        setHistory(data?.history || data || []);
      } catch {}
    }
    setLoading(false);
  }

  async function startTrial() {
    setActing(true);
    try {
      await api.post('/api/subscription/trial/start', { family_unit_id: familyUnitId });
      loadSubscription();
    } catch {}
    setActing(false);
  }

  async function subscribe(tier) {
    setActing(true);
    try {
      await api.post('/api/subscription/create', { family_unit_id: familyUnitId, tier });
      loadSubscription();
    } catch {}
    setActing(false);
  }

  async function upgrade(tier) {
    setActing(true);
    try {
      await api.post('/api/subscription/upgrade', { family_unit_id: familyUnitId, tier });
      loadSubscription();
    } catch {}
    setActing(false);
  }

  async function downgrade(tier) {
    setActing(true);
    try {
      await api.post('/api/subscription/downgrade', { family_unit_id: familyUnitId, tier });
      loadSubscription();
    } catch {}
    setActing(false);
  }

  async function cancel() {
    if (!window.confirm('Are you sure you want to cancel? Your data stays safe and you keep read access.')) return;
    setActing(true);
    try {
      await api.post('/api/subscription/cancel', { family_unit_id: familyUnitId });
      loadSubscription();
    } catch {}
    setActing(false);
  }

  const currentTier = current?.tier || current?.premium_tier || 'base';

  function tierAction(tier) {
    const tierOrder = ['base', 'guided_bridge', 'family_compass'];
    const ci = tierOrder.indexOf(currentTier);
    const ti = tierOrder.indexOf(tier.id);
    if (tier.id === currentTier) return null;
    if (ti > ci) {
      if (tier.id === 'guided_bridge' && currentTier === 'base' && !current?.had_trial) {
        return <button onClick={startTrial} disabled={acting} style={S.trialBtn}>Start Free Trial</button>;
      }
      return <button onClick={() => (ci < ti ? upgrade(tier.id) : subscribe(tier.id))} disabled={acting} style={S.actionBtn}>
        {ci >= 0 ? 'Upgrade' : 'Subscribe'}
      </button>;
    }
    return <button onClick={() => downgrade(tier.id)} disabled={acting} style={S.downBtn}>Downgrade</button>;
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>Your Plan</h2>

      {pilotMode && <div style={S.pilotBadge}>Pilot Mode</div>}

      {trialDays != null && trialDays > 0 && (
        <div style={S.trialBanner}>
          <span style={S.trialText}>Trial: {trialDays} day{trialDays !== 1 ? 's' : ''} left</span>
        </div>
      )}

      {loading && <p style={S.dim}>Loading...</p>}

      {TIERS.map(t => {
        const isCurrent = t.id === currentTier;
        return (
          <div key={t.id} style={{ ...S.card, border: isCurrent ? '2px solid #5ffce0' : '1px solid #1a3a5c' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={S.tierName}>{t.name}</h3>
              {isCurrent && <span style={S.currentBadge}>Current</span>}
            </div>
            <p style={S.price}>{t.price}</p>
            <p style={S.tierDesc}>{t.desc}</p>
            {t.trial && !isCurrent && <p style={S.trialNote}>{t.trial}</p>}
            {t.requires && <p style={S.reqNote}>{t.requires}</p>}
            <ul style={S.featureList}>
              {t.features.map((f, i) => <li key={i} style={S.featureItem}>{f}</li>)}
            </ul>
            {tierAction(t)}
          </div>
        );
      })}

      {currentTier !== 'base' && (
        <button onClick={cancel} disabled={acting} style={S.cancelBtn}>Cancel Plan</button>
      )}

      {/* Payment history */}
      {history.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={S.sectionTitle}>Payment History</h3>
          {history.map((h, i) => (
            <div key={i} style={S.histRow}>
              <span style={{ color: '#e0e0e0', fontSize: '14px' }}>{h.description || h.event_type || 'Payment'}</span>
              <div style={{ textAlign: 'right' }}>
                {h.amount != null && <span style={S.amount}>${(h.amount / 100).toFixed(2)}</span>}
                <p style={S.dim}>{h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}</p>
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
  title: { fontSize: '22px', fontWeight: 600, color: '#5ffce0', marginBottom: '16px' },
  dim: { color: '#8899aa', fontSize: '13px', margin: 0 },
  card: { background: '#0a2540', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  tierName: { color: '#e0e0e0', fontSize: '18px', fontWeight: 700, margin: 0 },
  price: { color: '#f0b860', fontSize: '20px', fontWeight: 700, margin: '4px 0 8px 0' },
  tierDesc: { color: '#aabbcc', fontSize: '14px', lineHeight: '1.4', margin: '0 0 8px 0' },
  trialNote: { color: '#5ffce0', fontSize: '13px', margin: '0 0 4px 0' },
  reqNote: { color: '#f0b860', fontSize: '12px', margin: '0 0 8px 0' },
  featureList: { listStyle: 'none', padding: 0, margin: '12px 0' },
  featureItem: { color: '#ccdde0', fontSize: '14px', padding: '4px 0', paddingLeft: '16px', position: 'relative' },
  currentBadge: { background: '#5ffce0', color: '#061a2a', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 },
  pilotBadge: { background: '#f0b860', color: '#061a2a', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, display: 'inline-block', marginBottom: '16px' },
  trialBanner: { background: '#0a2540', borderRadius: '8px', padding: '12px', marginBottom: '16px', borderLeft: '4px solid #5ffce0' },
  trialText: { color: '#5ffce0', fontSize: '15px', fontWeight: 600 },
  actionBtn: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' },
  trialBtn: { width: '100%', padding: '14px', borderRadius: '8px', border: '2px solid #5ffce0', background: 'transparent', color: '#5ffce0', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' },
  downBtn: { width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #1a3a5c', background: 'transparent', color: '#8899aa', fontSize: '15px', cursor: 'pointer', marginTop: '8px' },
  cancelBtn: { width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #ff6b6b', background: 'transparent', color: '#ff6b6b', fontSize: '15px', cursor: 'pointer', marginTop: '24px' },
  sectionTitle: { color: '#5ffce0', fontSize: '15px', fontWeight: 600, marginBottom: '12px' },
  histRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #112d4a' },
  amount: { color: '#f0b860', fontSize: '15px', fontWeight: 600 },
};
