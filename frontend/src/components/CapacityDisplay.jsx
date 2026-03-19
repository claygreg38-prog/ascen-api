import { useState, useEffect } from 'react';
import api from '../services/api';
import CapacityDot from './CapacityDot';

const STATE_INFO = {
  full: { label: "You're in a good place", color: '#5ffce0' },
  steady: { label: 'Normal operations', color: '#5ffce0' },
  drawing_down: { label: 'Take it easy', color: '#f0b860' },
  low: { label: 'Protect your energy', color: '#f07050' },
  depleted: { label: 'Rest is work right now', color: '#888' },
  private: { label: 'Private', color: '#334' },
  unknown: { label: '', color: '#334' }
};

export default function CapacityDisplay({ userId, showTransactions = false, showSleep = false }) {
  const [data, setData] = useState(null);

  useEffect(() => { if (userId) load(); }, [userId]);

  async function load() {
    try {
      const { data: d } = await api.get(`/api/capacity/balance/${userId}`);
      setData(d);
    } catch {}
  }

  async function saveSleep(val) {
    try { await api.post('/api/capacity/sleep', { quality: val }); } catch {}
  }

  if (!data) return null;

  const info = STATE_INFO[data.state] || STATE_INFO.unknown;

  return (
    <div style={S.container}>
      <div style={S.stateRow}>
        <div style={{ ...S.circle, borderColor: info.color, boxShadow: `0 0 20px ${info.color}30` }}>
          <CapacityDot state={data.state} size={28} />
        </div>
        <div>
          <p style={{ ...S.stateLabel, color: info.color }}>{data.state === 'drawing_down' ? 'Drawing Down' : data.state?.charAt(0).toUpperCase() + data.state?.slice(1)}</p>
          <p style={S.stateDesc}>{info.label}</p>
        </div>
      </div>

      {data.savings_trend && (
        <p style={S.trend}>
          Your resilience is {data.savings_trend === 'growing' ? '↑ growing' : data.savings_trend === 'declining' ? '↓ drawing down' : '→ stable'}
        </p>
      )}

      {showTransactions && data.recent_transactions?.length > 0 && (
        <div style={S.txList}>
          {data.recent_transactions.slice(0, 5).map((tx, i) => (
            <p key={i} style={S.tx}>{tx.description || tx.source} ({tx.amount > 0 ? '+' : ''}{tx.amount})</p>
          ))}
        </div>
      )}

      {showSleep && (
        <div style={S.sleepRow}>
          <p style={S.sleepLabel}>How did you sleep?</p>
          <input type="range" min="0" max="100" defaultValue="50"
            onChange={e => saveSleep(parseInt(e.target.value))}
            style={S.slider} />
        </div>
      )}
    </div>
  );
}

export function FamilyCapacityRow({ members }) {
  if (!members?.length) return null;
  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      {members.map((m, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <CapacityDot state={m.privacy_mode ? 'private' : m.state || 'unknown'} size={18} />
          <p style={{ fontSize: '11px', color: '#8899aa', marginTop: '4px' }}>{m.first_name || m.name}</p>
        </div>
      ))}
    </div>
  );
}

const S = {
  container: { padding: '4px 0' },
  stateRow: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' },
  circle: { width: '56px', height: '56px', borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stateLabel: { fontSize: '18px', fontWeight: 500, textTransform: 'capitalize' },
  stateDesc: { fontSize: '13px', color: '#8899aa', marginTop: '2px' },
  trend: { fontSize: '13px', color: '#556677', marginTop: '4px' },
  txList: { marginTop: '12px', borderTop: '1px solid #112d4a', paddingTop: '8px' },
  tx: { fontSize: '12px', color: '#8899aa', padding: '3px 0' },
  sleepRow: { marginTop: '12px' },
  sleepLabel: { fontSize: '13px', color: '#556677', marginBottom: '4px' },
  slider: { width: '100%', accentColor: '#5ffce0' }
};
