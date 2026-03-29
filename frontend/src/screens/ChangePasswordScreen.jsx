import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../services/auth';

export default function ChangePasswordScreen() {
  const nav = useNavigate();
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!current || !newPw || !confirm) { setError('All fields required.'); return; }
    if (newPw.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirm) { setError('Passwords do not match.'); return; }
    if (newPw === current) { setError('New password must be different from current password.'); return; }

    setLoading(true);
    try {
      await changePassword(current, newPw);
      nav('/app/');
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Password change failed.');
    }
    setLoading(false);
  };

  return (
    <div style={S.container}>
      <h1 style={S.logo}>ASCEN</h1>
      <p style={S.sub}>Set Your Password</p>
      <p style={S.note}>For security, please change your password before continuing.</p>

      <input type="password" placeholder="Current password" value={current}
        onChange={e => setCurrent(e.target.value)} style={S.input} />
      <input type="password" placeholder="New password (8+ characters)" value={newPw}
        onChange={e => setNewPw(e.target.value)} style={S.input} />
      <input type="password" placeholder="Confirm new password" value={confirm}
        onChange={e => setConfirm(e.target.value)} style={S.input} />

      {error && <p style={S.error}>{error}</p>}

      <button onClick={submit} disabled={loading} style={S.btn}>
        {loading ? 'Updating...' : 'Change Password'}
      </button>
    </div>
  );
}

const S = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#061a2a', padding: 24,
    fontFamily: "'Outfit',-apple-system,sans-serif", color: '#fff',
  },
  logo: { fontSize: 28, fontWeight: 200, letterSpacing: 6, color: '#5CE0D0', marginBottom: 4 },
  sub: { fontSize: 14, color: 'rgba(200,210,225,0.6)', marginBottom: 8 },
  note: { fontSize: 12, color: 'rgba(200,210,225,0.35)', marginBottom: 24, textAlign: 'center', maxWidth: 300 },
  input: {
    width: '100%', maxWidth: 300, padding: '14px 16px', marginBottom: 12,
    borderRadius: 12, border: '1px solid rgba(200,210,225,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 15,
    fontFamily: "'Outfit',sans-serif", outline: 'none',
  },
  error: { color: '#E09878', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  btn: {
    width: '100%', maxWidth: 300, padding: '14px 0', marginTop: 8,
    borderRadius: 14, border: 'none', cursor: 'pointer',
    background: 'rgba(92,224,208,0.15)', color: '#5CE0D0',
    fontSize: 15, fontWeight: 500, fontFamily: "'Outfit',sans-serif",
  },
};
