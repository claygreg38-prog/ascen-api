import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithPin, loginWithEmail } from '../services/auth';

export default function LoginScreen() {
  const [participantId, setParticipantId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const addDigit = d => { if (pin.length < 6) setPin(pin + d); };
  const backspace = () => setPin(pin.slice(0, -1));

  // Email login state
  const [mode, setMode] = useState('pin'); // 'pin' | 'email'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      let result;
      if (mode === 'email') {
        if (!email || !password) { setError('Email and password required.'); setLoading(false); return; }
        result = await loginWithEmail(email, password);
      } else {
        if (!participantId || pin.length !== 6) { setLoading(false); return; }
        result = await loginWithPin(participantId, pin);
      }
      if (result.must_change_password) {
        nav('/app/change-password');
      } else {
        nav('/app/');
      }
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.message || "That didn't match. Try again.");
      setPin('');
    }
    setLoading(false);
  };

  // Auto-submit on 6th digit
  if (pin.length === 6 && !loading && participantId) {
    setTimeout(submit, 100);
  }

  return (
    <div style={S.container}>
      <h1 style={S.logo}>ASCEN</h1>
      <p style={S.sub}>BreathWorx</p>

      <input
        type="text" placeholder="Participant ID"
        value={participantId} onChange={e => setParticipantId(e.target.value)}
        style={S.input}
      />

      <div style={S.dots}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ ...S.dot, background: i < pin.length ? '#5ffce0' : '#1a2a3a' }} />
        ))}
      </div>

      {error && <p style={S.error}>{error}</p>}

      <div style={S.pad}>
        {[1,2,3,4,5,6,7,8,9,'',0,'<'].map((d, i) => (
          <button key={i} disabled={d === '' || loading}
            onClick={() => d === '<' ? backspace() : addDigit(String(d))}
            style={{ ...S.key, opacity: d === '' ? 0 : 1 }}>
            {d === '<' ? '\u232B' : d}
          </button>
        ))}
      </div>

      {mode === 'email' && (
        <>
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} style={S.input} />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} style={S.input} />
          <button onClick={submit} disabled={loading} style={{ ...S.key, width: '100%', maxWidth: 280, background: '#0a2540', marginTop: 8 }}>
            {loading ? '...' : 'Sign In'}
          </button>
        </>
      )}

      <button onClick={() => { setMode(mode === 'pin' ? 'email' : 'pin'); setError(''); }} style={S.link}>
        {mode === 'pin' ? 'Sign in with email instead' : 'Sign in with participant ID'}
      </button>
      <button onClick={() => nav('/app/register')} style={S.link}>
        I have an enrollment code
      </button>
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#061a2a' },
  logo: { fontSize: '36px', fontWeight: 300, color: '#5ffce0', letterSpacing: '8px', marginBottom: '4px' },
  sub: { fontSize: '14px', color: '#556677', marginBottom: '32px', letterSpacing: '4px' },
  input: { background: '#112d4a', border: '1px solid #1a3a5a', color: '#fff', padding: '14px 20px', borderRadius: '12px', fontSize: '16px', width: '100%', maxWidth: '280px', textAlign: 'center', outline: 'none', marginBottom: '24px' },
  dots: { display: 'flex', gap: '12px', marginBottom: '8px' },
  dot: { width: '14px', height: '14px', borderRadius: '50%', border: '1px solid #1a3a5a', transition: 'background 0.15s' },
  error: { color: '#f07050', fontSize: '14px', margin: '8px 0' },
  pad: { display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: '12px', marginTop: '16px' },
  key: { width: '72px', height: '56px', borderRadius: '12px', border: 'none', background: '#0a2540', color: '#fff', fontSize: '22px', cursor: 'pointer', fontWeight: 300 },
  link: { background: 'none', border: 'none', color: '#5ffce0', fontSize: '14px', marginTop: '24px', cursor: 'pointer', textDecoration: 'underline' }
};
