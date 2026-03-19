import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerWithCode } from '../services/auth';

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async () => {
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    setLoading(true); setError('');
    try {
      await registerWithCode(code, pin, firstName);
      nav('/app/onboarding');
    } catch (e) {
      setError(e.response?.data?.error || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div style={S.container}>
      <h1 style={S.logo}>ASCEN</h1>

      {step === 1 && <>
        <p style={S.label}>Enter your enrollment code</p>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="8-character code" maxLength={8} style={S.input} />
        <p style={S.label}>Your first name</p>
        <input value={firstName} onChange={e => setFirstName(e.target.value)}
          placeholder="First name" style={S.input} />
        <button disabled={code.length < 6 || !firstName} onClick={() => setStep(2)} style={S.btn}>Next</button>
      </>}

      {step === 2 && <>
        <p style={S.label}>Create a 6-digit PIN</p>
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
          type="password" placeholder="6 digits" maxLength={6} style={S.input} inputMode="numeric" />
        <p style={S.label}>Confirm PIN</p>
        <input value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,'').slice(0,6))}
          type="password" placeholder="Confirm" maxLength={6} style={S.input} inputMode="numeric" />
        <button disabled={pin.length !== 6 || confirmPin.length !== 6 || loading}
          onClick={submit} style={S.btn}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </>}

      {error && <p style={{ color: '#f07050', marginTop: '8px' }}>{error}</p>}
      <button onClick={() => nav('/app/login')} style={S.link}>Back to login</button>
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#061a2a' },
  logo: { fontSize: '36px', fontWeight: 300, color: '#5ffce0', letterSpacing: '8px', marginBottom: '32px' },
  label: { color: '#8899aa', fontSize: '14px', marginBottom: '6px', marginTop: '16px' },
  input: { background: '#112d4a', border: '1px solid #1a3a5a', color: '#fff', padding: '14px 20px', borderRadius: '12px', fontSize: '16px', width: '100%', maxWidth: '280px', textAlign: 'center', outline: 'none' },
  btn: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '14px 48px', borderRadius: '12px', fontSize: '16px', marginTop: '24px', cursor: 'pointer' },
  link: { background: 'none', border: 'none', color: '#556677', fontSize: '13px', marginTop: '16px', cursor: 'pointer' }
};
