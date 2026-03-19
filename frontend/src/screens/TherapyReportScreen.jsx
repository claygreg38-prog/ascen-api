import { useState } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

const CHANNELS = [
  { key: 'parent_child', label: 'Parent and child' },
  { key: 'partner', label: 'Partner' },
  { key: 'coparent', label: 'Co-parent' },
];

export default function TherapyReportScreen() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [consent, setConsent] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const user = getUser();
  const familyUnitId = user?.familyUnitId || user?.family_unit_id;

  function toggleConsent(key) {
    setConsent(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function generate() {
    const channels = Object.keys(consent).filter(k => consent[k]);
    if (!channels.length) return;
    setLoading(true);
    setReport(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      channels.forEach(c => params.append('channels', c));
      const { data } = await api.get(`/api/premium/therapy-report/${familyUnitId}?${params.toString()}`);
      setReport(data);
    } catch {}
    setLoading(false);
  }

  async function sendReport() {
    if (!sendEmail.trim() || !report?.report_id) return;
    setSending(true);
    try {
      await api.post(`/api/premium/therapy-report/${report.report_id}/send`, { email: sendEmail });
      setSent(true);
    } catch {}
    setSending(false);
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>Therapy Report</h2>
      <p style={S.sub}>Create a summary you can share with your therapist. You choose what to include.</p>

      {/* Period selector */}
      <div style={S.card}>
        <p style={S.label}>Time Period</p>
        <div style={S.dateRow}>
          <div style={{ flex: 1 }}>
            <p style={S.dim}>From</p>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={S.dim}>To</p>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={S.input} />
          </div>
        </div>
      </div>

      {/* Channel consent */}
      <div style={S.card}>
        <p style={S.label}>What can be included?</p>
        <p style={S.hint}>Check only what you are okay sharing.</p>
        {CHANNELS.map(ch => (
          <label key={ch.key} style={S.checkRow}>
            <input type="checkbox" checked={!!consent[ch.key]}
              onChange={() => toggleConsent(ch.key)} style={S.check} />
            <span>{ch.label}</span>
          </label>
        ))}
      </div>

      <button onClick={generate} disabled={loading || !Object.values(consent).some(Boolean)} style={S.btn}>
        {loading ? 'Building report...' : 'Build Report'}
      </button>

      {/* Report preview */}
      {report && (
        <div style={{ marginTop: '24px' }}>
          <div style={S.reportCard}>
            <h3 style={S.reportTitle}>Report Preview</h3>
            {report.period && <p style={S.dim}>{report.period}</p>}
            {report.summary && <p style={S.reportSummary}>{report.summary}</p>}
            {report.analysis && <p style={S.reportBody}>{report.analysis}</p>}
            {report.highlights && (
              <ul style={S.highlights}>
                {report.highlights.map((h, i) => <li key={i} style={S.highlightItem}>{h}</li>)}
              </ul>
            )}
          </div>

          <div style={S.disclaimer}>
            <p style={S.disclaimerText}>
              This report is a summary of self-reported activity and does not replace professional evaluation.
              It is meant to support conversations with your provider.
              By sending this, you consent to share the selected information with the email address you enter below.
            </p>
          </div>

          {/* Send */}
          {!sent ? (
            <div style={S.card}>
              <p style={S.label}>Send to Your Therapist</p>
              <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                placeholder="therapist@example.com" style={S.input} />
              <button onClick={sendReport} disabled={sending || !sendEmail.trim()} style={{ ...S.btn, marginTop: '12px' }}>
                {sending ? 'Sending...' : 'Send Report'}
              </button>
            </div>
          ) : (
            <div style={{ ...S.card, borderLeft: '4px solid #5ffce0' }}>
              <p style={{ color: '#5ffce0', fontSize: '15px', margin: 0 }}>Report sent to {sendEmail}.</p>
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
  dim: { color: '#8899aa', fontSize: '13px', margin: '0 0 4px 0' },
  hint: { color: '#556677', fontSize: '13px', margin: '0 0 12px 0' },
  label: { color: '#5ffce0', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0' },
  card: { background: '#0a2540', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  dateRow: { display: 'flex', gap: '12px' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '15px', boxSizing: 'border-box' },
  checkRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#112d4a', borderRadius: '8px', marginBottom: '8px', color: '#e0e0e0', fontSize: '15px', cursor: 'pointer' },
  check: { accentColor: '#5ffce0', width: '18px', height: '18px' },
  btn: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
  reportCard: { background: '#0a2540', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #f0b860' },
  reportTitle: { color: '#f0b860', fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' },
  reportSummary: { color: '#e0e0e0', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' },
  reportBody: { color: '#aabbcc', fontSize: '14px', lineHeight: '1.6', margin: '8px 0' },
  highlights: { listStyle: 'none', padding: 0, margin: '12px 0 0 0' },
  highlightItem: { color: '#ccdde0', fontSize: '14px', padding: '6px 0', paddingLeft: '16px', borderLeft: '2px solid #5ffce0', marginBottom: '4px' },
  disclaimer: { background: '#0a2540', borderRadius: '8px', padding: '16px', marginTop: '16px', marginBottom: '16px' },
  disclaimerText: { color: '#667788', fontSize: '12px', lineHeight: '1.6', margin: 0 },
};
