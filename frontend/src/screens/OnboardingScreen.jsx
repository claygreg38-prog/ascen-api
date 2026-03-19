import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const STEPS = [
  {
    title: 'Welcome to ASCEN',
    body: 'ASCEN helps you heal through breathing. Every session creates a permanent record of your progress — your art, your journey, yours forever.'
  },
  {
    title: 'Your Choices',
    consents: true
  },
  {
    title: "You're Ready",
    body: 'Your first session is waiting. Take a breath.',
    final: true
  }
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [consents, setConsents] = useState({ art: true, gallery: true, clinical: true });
  const nav = useNavigate();

  const toggle = key => setConsents({ ...consents, [key]: !consents[key] });

  const complete = async () => {
    try { await api.post('/api/onboarding/consent', consents); } catch {}
    nav('/app/');
  };

  const s = STEPS[step];

  return (
    <div style={S.container}>
      <div style={S.dots}>
        {STEPS.map((_, i) => <div key={i} style={{ ...S.dot, background: i <= step ? '#5ffce0' : '#1a2a3a' }} />)}
      </div>

      <h2 style={S.title}>{s.title}</h2>

      {s.body && <p style={S.body}>{s.body}</p>}

      {s.consents && <div style={S.consentsBox}>
        {[
          ['art', 'Create art from your sessions'],
          ['gallery', 'Show your art in family gallery'],
          ['clinical', 'Share healing data with clinical team']
        ].map(([k, label]) => (
          <label key={k} style={S.toggle}>
            <span>{label}</span>
            <div onClick={() => toggle(k)} style={{
              ...S.switch, background: consents[k] ? '#1a7a6d' : '#1a2a3a'
            }}>
              <div style={{ ...S.knob, transform: consents[k] ? 'translateX(24px)' : 'translateX(2px)' }} />
            </div>
          </label>
        ))}
      </div>}

      <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
        {step > 0 && <button onClick={() => setStep(step - 1)} style={S.btnSec}>Back</button>}
        {s.final
          ? <button onClick={complete} style={S.btn}>Start First Session</button>
          : <button onClick={() => setStep(step + 1)} style={S.btn}>Next</button>
        }
      </div>
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#061a2a' },
  dots: { display: 'flex', gap: '8px', marginBottom: '32px' },
  dot: { width: '10px', height: '10px', borderRadius: '50%', transition: 'background 0.2s' },
  title: { fontSize: '24px', fontWeight: 400, color: '#5ffce0', marginBottom: '16px', textAlign: 'center' },
  body: { color: '#8899aa', fontSize: '16px', lineHeight: 1.6, textAlign: 'center', maxWidth: '320px' },
  consentsBox: { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '320px' },
  toggle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ccc', fontSize: '15px' },
  switch: { width: '50px', height: '28px', borderRadius: '14px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' },
  knob: { width: '24px', height: '24px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', transition: 'transform 0.2s' },
  btn: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '14px 40px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer' },
  btnSec: { background: 'transparent', color: '#556677', border: '1px solid #1a3a5a', padding: '14px 24px', borderRadius: '12px', fontSize: '16px', cursor: 'pointer' }
};
