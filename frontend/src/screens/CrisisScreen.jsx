import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import BreathPacer from '../components/BreathPacer';

const PHASES = { INITIAL: 'initial', CONFIRM: 'confirm', SAFE: 'safe', PRIVACY: 'privacy', EXIT_CONFIRM: 'exit_confirm' };

export default function CrisisScreen() {
  const [phase, setPhase] = useState(PHASES.INITIAL);
  const [breathing, setBreathing] = useState(false);
  const [privacyOn, setPrivacyOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();
  const user = getUser();

  async function selfReport() {
    setSubmitting(true);
    try {
      await api.post('/api/crisis/self-report', {
        participant_id: user?.participant_id || user?.userId
      });
      setPhase(PHASES.SAFE);
    } catch {}
    setSubmitting(false);
  }

  async function togglePrivacy() {
    try {
      if (!privacyOn) {
        await api.post('/api/crisis/privacy-mode/enable', {
          participant_id: user?.participant_id || user?.userId
        });
        setPrivacyOn(true);
      } else {
        await api.post('/api/crisis/privacy-mode/disable', {
          participant_id: user?.participant_id || user?.userId
        });
        setPrivacyOn(false);
      }
    } catch {}
  }

  async function exitFamily() {
    try {
      await api.post('/api/crisis/exit-family', {
        participant_id: user?.participant_id || user?.userId
      });
      nav('/app/home');
    } catch {}
  }

  // --- INITIAL ---
  if (phase === PHASES.INITIAL) {
    return (
      <div style={S.centerFull}>
        <h2 style={S.title}>Are you okay?</h2>
        <p style={S.sub}>This is a safe place. Nothing you do here gets shared without your say-so.</p>

        <button onClick={() => setPhase(PHASES.CONFIRM)} style={S.helpBtn}>I need help</button>

        <div style={S.spacer} />

        <div style={S.optionRow}>
          <button onClick={() => setPhase(PHASES.PRIVACY)} style={S.optionBtn}>
            Privacy Mode {privacyOn ? '(on)' : ''}
          </button>
          <button onClick={() => setPhase(PHASES.EXIT_CONFIRM)} style={S.optionBtn}>
            Leave Family
          </button>
        </div>

        <button onClick={() => nav(-1)} style={S.backLink}>Go back</button>
      </div>
    );
  }

  // --- CONFIRM ---
  if (phase === PHASES.CONFIRM) {
    return (
      <div style={S.centerFull}>
        <h2 style={S.title}>You are not alone.</h2>
        <p style={S.sub}>
          Letting us know means we can check in on you. Your family will not see the details. Ready?
        </p>
        <button onClick={selfReport} disabled={submitting} style={S.helpBtn}>
          {submitting ? 'Sending...' : 'Yes, let someone know'}
        </button>
        <button onClick={() => setPhase(PHASES.INITIAL)} style={S.backLink}>Go back</button>
      </div>
    );
  }

  // --- SAFE ---
  if (phase === PHASES.SAFE) {
    return (
      <div style={S.centerFull}>
        <h2 style={S.safeTitle}>We hear you.</h2>
        <p style={S.safeText}>Take all the time you need.</p>

        <div style={S.spacer} />

        <BreathPacer inhaleSeconds={4} exhaleSeconds={6} isActive={breathing} />

        <button onClick={() => setBreathing(!breathing)} style={S.breatheBtn}>
          {breathing ? 'Pause' : 'Breathe'}
        </button>

        <button onClick={() => nav('/app/home')} style={{ ...S.backLink, marginTop: '40px' }}>
          Go home when ready
        </button>
      </div>
    );
  }

  // --- PRIVACY ---
  if (phase === PHASES.PRIVACY) {
    return (
      <div style={S.centerFull}>
        <h2 style={S.title}>Privacy Mode</h2>
        <p style={S.sub}>
          {privacyOn
            ? 'Privacy mode is on. Your family cannot see your state right now.'
            : 'Turn this on to hide your state from family members. No one gets told you did this.'}
        </p>
        <button onClick={togglePrivacy} style={{ ...S.helpBtn, background: privacyOn ? '#ff6b6b' : '#1a7a6d' }}>
          {privacyOn ? 'Turn Off Privacy Mode' : 'Turn On Privacy Mode'}
        </button>
        <button onClick={() => setPhase(PHASES.INITIAL)} style={S.backLink}>Go back</button>
      </div>
    );
  }

  // --- EXIT CONFIRM ---
  if (phase === PHASES.EXIT_CONFIRM) {
    return (
      <div style={S.centerFull}>
        <h2 style={S.title}>Leave Family</h2>
        <p style={S.sub}>
          You can leave your family unit at any time. Your personal data stays with you.
          You do not need anyone's permission.
        </p>
        <button onClick={exitFamily} style={{ ...S.helpBtn, background: '#ff6b6b' }}>Leave Family</button>
        <button onClick={() => setPhase(PHASES.INITIAL)} style={S.backLink}>Go back</button>
      </div>
    );
  }

  return null;
}

const S = {
  centerFull: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', padding: '32px', fontFamily: 'sans-serif', textAlign: 'center'
  },
  title: { fontSize: '24px', fontWeight: 600, color: '#5ffce0', marginBottom: '12px' },
  safeTitle: { fontSize: '28px', fontWeight: 600, color: '#5ffce0', marginBottom: '8px' },
  safeText: { color: '#aabbcc', fontSize: '18px', lineHeight: '1.5' },
  sub: { color: '#8899aa', fontSize: '16px', lineHeight: '1.6', maxWidth: '320px', marginBottom: '24px' },
  helpBtn: {
    padding: '16px 40px', borderRadius: '12px', border: 'none', background: '#1a7a6d',
    color: '#fff', fontSize: '18px', fontWeight: 600, cursor: 'pointer', minWidth: '200px'
  },
  breatheBtn: {
    padding: '16px 48px', borderRadius: '30px', border: '2px solid #5ffce0', background: 'transparent',
    color: '#5ffce0', fontSize: '18px', fontWeight: 600, cursor: 'pointer', marginTop: '24px'
  },
  spacer: { height: '40px' },
  optionRow: { display: 'flex', gap: '12px', marginTop: '32px' },
  optionBtn: {
    padding: '12px 20px', borderRadius: '8px', border: '1px solid #1a3a5c', background: 'transparent',
    color: '#8899aa', fontSize: '14px', cursor: 'pointer'
  },
  backLink: {
    background: 'none', border: 'none', color: '#556677', fontSize: '14px',
    cursor: 'pointer', marginTop: '20px', padding: '8px'
  },
};
