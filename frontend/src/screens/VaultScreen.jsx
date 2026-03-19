import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

const STEPS = { LIST: 'list', WRITE: 'write', SCHEDULE: 'schedule', DESIGNEE: 'designee', BACKUP: 'backup', PREVIEW: 'preview', SEALED: 'sealed', UNLOCK: 'unlock' };
const SCHEDULES = [
  { value: 'immediate', label: 'Right away' },
  { value: 'drip', label: 'A little at a time' },
  { value: 'date_locked', label: 'On a set date' },
  { value: 'on_request', label: 'When they ask for it' },
];

export default function VaultScreen() {
  const [step, setStep] = useState(STEPS.LIST);
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create flow
  const [affirmation, setAffirmation] = useState('');
  const [schedule, setSchedule] = useState('immediate');
  const [lockDate, setLockDate] = useState('');
  const [designeeName, setDesigneeName] = useState('');
  const [designeeRelation, setDesigneeRelation] = useState('');
  const [recoveryBackup, setRecoveryBackup] = useState(true);
  const [seedPhrase, setSeedPhrase] = useState([]);
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [sealedCapsule, setSealedCapsule] = useState(null);

  // Unlock flow
  const [unlockId, setUnlockId] = useState(null);
  const [unlockWords, setUnlockWords] = useState(Array(12).fill(''));
  const [unlockResult, setUnlockResult] = useState(null);
  const [unlockError, setUnlockError] = useState('');

  const user = getUser();
  const userId = user?.participant_id || user?.userId;

  useEffect(() => { loadCapsules(); }, []);

  async function loadCapsules() {
    try {
      const { data } = await api.get(`/api/legacy/available/${userId}`);
      setCapsules(data?.capsules || []);
    } catch {}
    setLoading(false);
  }

  function startCreate() {
    setAffirmation(''); setSchedule('immediate'); setLockDate('');
    setDesigneeName(''); setDesigneeRelation('');
    setRecoveryBackup(true); setSeedPhrase([]); setSeedConfirmed(false);
    setStep(STEPS.WRITE);
  }

  function toSchedule() {
    if (!affirmation.trim()) return;
    setStep(STEPS.SCHEDULE);
  }

  function toDesignee() { setStep(STEPS.DESIGNEE); }

  async function toBackup() {
    if (!designeeName.trim()) return;
    // Get seed phrase from API
    try {
      const { data } = await api.post('/api/legacy/capsule/prepare', { participant_id: userId });
      setSeedPhrase(data?.seed_phrase?.split(' ') || []);
    } catch {
      setSeedPhrase('unable to generate'.split(' '));
    }
    setStep(STEPS.BACKUP);
  }

  function toPreview() {
    if (!seedConfirmed) return;
    setStep(STEPS.PREVIEW);
  }

  async function sealCapsule() {
    setSealing(true);
    try {
      const { data } = await api.post('/api/legacy/capsule/create', {
        participant_id: userId,
        affirmation,
        release_schedule: schedule,
        lock_date: schedule === 'date_locked' ? lockDate : undefined,
        designee_name: designeeName,
        designee_relationship: designeeRelation,
        recovery_backup: recoveryBackup
      });
      setSealedCapsule(data);
      setStep(STEPS.SEALED);
      loadCapsules();
    } catch {}
    setSealing(false);
  }

  function startUnlock(capsule) {
    setUnlockId(capsule.capsule_id);
    setUnlockWords(Array(12).fill(''));
    setUnlockResult(null);
    setUnlockError('');
    setStep(STEPS.UNLOCK);
  }

  async function submitUnlock() {
    if (unlockWords.some(w => !w.trim())) { setUnlockError('Fill in all 12 words.'); return; }
    try {
      const { data } = await api.post(`/api/legacy/capsule/unlock`, {
        capsule_id: unlockId,
        seed_phrase: unlockWords.join(' ')
      });
      setUnlockResult(data);
      setUnlockError('');
    } catch {
      setUnlockError('Those words did not match. Please try again.');
    }
  }

  function setUnlockWord(i, val) {
    const copy = [...unlockWords];
    copy[i] = val.toLowerCase().trim();
    setUnlockWords(copy);
  }

  // --- LIST VIEW ---
  if (step === STEPS.LIST) {
    return (
      <div style={S.container}>
        <h2 style={S.title}>My Vault</h2>
        <p style={S.sub}>Messages you have saved for the people who matter.</p>

        <button onClick={startCreate} style={S.btn}>Create a New Capsule</button>

        {loading && <p style={S.dim}>Loading...</p>}

        {capsules.map(c => (
          <div key={c.capsule_id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={S.cardName}>For {c.designee_name}</p>
                <p style={S.dim}>{c.designee_relationship} &middot; {c.release_schedule}</p>
              </div>
              <span style={{ ...S.statusBadge, background: c.status === 'locked' ? '#1a7a6d' : '#f0b860' }}>
                {c.status === 'locked' ? 'Sealed' : 'Open'}
              </span>
            </div>
            {c.status !== 'locked' && (
              <button onClick={() => startUnlock(c)} style={{ ...S.btnSmall, marginTop: '12px' }}>Unlock</button>
            )}
          </div>
        ))}

        {!loading && capsules.length === 0 && (
          <p style={{ ...S.dim, marginTop: '32px' }}>You have not created any capsules yet.</p>
        )}
      </div>
    );
  }

  // --- WRITE STEP ---
  if (step === STEPS.WRITE) {
    return (
      <div style={S.container}>
        <button onClick={() => setStep(STEPS.LIST)} style={S.back}>&larr; Back</button>
        <h2 style={S.title}>Write Your Message</h2>
        <p style={S.sub}>Say something from the heart. Keep it short and real.</p>
        <textarea value={affirmation} onChange={e => setAffirmation(e.target.value.slice(0, 280))}
          placeholder="What do you want them to know?" style={S.textarea} rows={5} />
        <p style={S.charCount}>{affirmation.length} / 280</p>
        <button onClick={toSchedule} style={S.btn}>Next</button>
      </div>
    );
  }

  // --- SCHEDULE STEP ---
  if (step === STEPS.SCHEDULE) {
    return (
      <div style={S.container}>
        <button onClick={() => setStep(STEPS.WRITE)} style={S.back}>&larr; Back</button>
        <h2 style={S.title}>When should they get it?</h2>
        {SCHEDULES.map(s => (
          <label key={s.value} style={S.radioRow}>
            <input type="radio" name="schedule" checked={schedule === s.value}
              onChange={() => setSchedule(s.value)} style={S.radio} />
            <span>{s.label}</span>
          </label>
        ))}
        {schedule === 'date_locked' && (
          <input type="date" value={lockDate} onChange={e => setLockDate(e.target.value)} style={{ ...S.input, marginTop: '12px' }} />
        )}
        <button onClick={toDesignee} style={S.btn}>Next</button>
      </div>
    );
  }

  // --- DESIGNEE STEP ---
  if (step === STEPS.DESIGNEE) {
    return (
      <div style={S.container}>
        <button onClick={() => setStep(STEPS.SCHEDULE)} style={S.back}>&larr; Back</button>
        <h2 style={S.title}>Who is this for?</h2>
        <input value={designeeName} onChange={e => setDesigneeName(e.target.value)}
          placeholder="Their name" style={S.input} />
        <input value={designeeRelation} onChange={e => setDesigneeRelation(e.target.value)}
          placeholder="How are they related to you?" style={{ ...S.input, marginTop: '12px' }} />
        <button onClick={toBackup} style={S.btn}>Next</button>
      </div>
    );
  }

  // --- BACKUP / SEED STEP ---
  if (step === STEPS.BACKUP) {
    return (
      <div style={S.container}>
        <button onClick={() => setStep(STEPS.DESIGNEE)} style={S.back}>&larr; Back</button>
        <h2 style={S.title}>Recovery Backup</h2>
        <p style={S.sub}>Write these 12 words down and keep them safe. You will need them to open this capsule later.</p>

        <label style={S.radioRow}>
          <input type="checkbox" checked={recoveryBackup} onChange={e => setRecoveryBackup(e.target.checked)} style={S.radio} />
          <span>Keep a recovery backup</span>
        </label>

        <div style={S.seedBox}>
          {seedPhrase.map((w, i) => (
            <div key={i} style={S.seedWord}>
              <span style={S.seedNum}>{i + 1}</span>
              <span style={S.seedText}>{w}</span>
            </div>
          ))}
        </div>

        <label style={{ ...S.radioRow, marginTop: '20px' }}>
          <input type="checkbox" checked={seedConfirmed} onChange={e => setSeedConfirmed(e.target.checked)} style={S.radio} />
          <span>I have written down my seed phrase</span>
        </label>

        <button onClick={toPreview} style={{ ...S.btn, opacity: seedConfirmed ? 1 : 0.4 }}>Next</button>
      </div>
    );
  }

  // --- PREVIEW ---
  if (step === STEPS.PREVIEW) {
    return (
      <div style={S.container}>
        <button onClick={() => setStep(STEPS.BACKUP)} style={S.back}>&larr; Back</button>
        <h2 style={S.title}>Review Your Capsule</h2>
        <div style={S.card}>
          <p style={S.previewLabel}>Message</p>
          <p style={S.previewValue}>{affirmation}</p>
          <p style={S.previewLabel}>Delivery</p>
          <p style={S.previewValue}>{SCHEDULES.find(s => s.value === schedule)?.label}{schedule === 'date_locked' ? ` (${lockDate})` : ''}</p>
          <p style={S.previewLabel}>For</p>
          <p style={S.previewValue}>{designeeName} ({designeeRelation})</p>
          <p style={S.previewLabel}>Recovery backup</p>
          <p style={S.previewValue}>{recoveryBackup ? 'Yes' : 'No'}</p>
        </div>
        <button onClick={sealCapsule} disabled={sealing} style={S.btn}>
          {sealing ? 'Sealing...' : 'Seal This Capsule'}
        </button>
      </div>
    );
  }

  // --- SEALED ---
  if (step === STEPS.SEALED) {
    return (
      <div style={S.centerFull}>
        <div style={S.sealCircle} />
        <h2 style={S.title}>Capsule Sealed</h2>
        <p style={S.sub}>Your message for {designeeName} is safe.</p>
        <button onClick={() => setStep(STEPS.LIST)} style={S.btn}>Back to Vault</button>
      </div>
    );
  }

  // --- UNLOCK ---
  if (step === STEPS.UNLOCK) {
    return (
      <div style={S.container}>
        <button onClick={() => { setStep(STEPS.LIST); setUnlockResult(null); }} style={S.back}>&larr; Back</button>
        <h2 style={S.title}>Open Capsule</h2>

        {!unlockResult ? (
          <div>
            <p style={S.sub}>Enter your 12 recovery words to open this capsule.</p>
            <div style={S.seedGrid}>
              {unlockWords.map((w, i) => (
                <div key={i} style={S.unlockWordRow}>
                  <span style={S.seedNum}>{i + 1}</span>
                  <input value={w} onChange={e => setUnlockWord(i, e.target.value)}
                    style={S.unlockInput} autoCapitalize="none" autoCorrect="off" />
                </div>
              ))}
            </div>
            {unlockError && <p style={S.error}>{unlockError}</p>}
            <button onClick={submitUnlock} style={S.btn}>Unlock</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {unlockResult.art_url && (
              <img src={unlockResult.art_url} alt="Capsule art" style={S.artImg} />
            )}
            <div style={S.card}>
              <p style={{ color: '#f0b860', fontSize: '18px', lineHeight: '1.6' }}>{unlockResult.affirmation}</p>
            </div>
            <button onClick={() => { setStep(STEPS.LIST); setUnlockResult(null); }} style={S.btn}>Done</button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

const S = {
  container: { padding: '24px', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', fontFamily: 'sans-serif', paddingBottom: '100px' },
  centerFull: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', padding: '24px', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 600, color: '#5ffce0', marginBottom: '8px' },
  sub: { color: '#8899aa', marginBottom: '20px', fontSize: '15px', lineHeight: '1.5' },
  dim: { color: '#8899aa', fontSize: '13px' },
  card: { background: '#0a2540', borderRadius: '12px', padding: '20px', marginTop: '12px' },
  cardName: { color: '#e0e0e0', fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' },
  statusBadge: { padding: '4px 12px', borderRadius: '12px', fontSize: '12px', color: '#fff', fontWeight: 600 },
  btn: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: '20px' },
  btnSmall: { padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '14px', cursor: 'pointer' },
  back: { background: 'none', border: 'none', color: '#5ffce0', fontSize: '14px', cursor: 'pointer', padding: '8px 0', marginBottom: '12px' },
  input: { width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '16px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '16px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'sans-serif' },
  charCount: { color: '#556677', fontSize: '13px', textAlign: 'right', marginTop: '4px' },
  radioRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#0a2540', borderRadius: '8px', marginTop: '8px', color: '#e0e0e0', fontSize: '15px', cursor: 'pointer' },
  radio: { accentColor: '#5ffce0', width: '18px', height: '18px' },
  seedBox: { background: '#050e18', borderRadius: '12px', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '16px' },
  seedWord: { display: 'flex', alignItems: 'center', gap: '8px' },
  seedNum: { color: '#556677', fontSize: '12px', minWidth: '18px' },
  seedText: { color: '#f0b860', fontSize: '14px', fontFamily: 'monospace' },
  seedGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' },
  unlockWordRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  unlockInput: { flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '14px', fontFamily: 'monospace' },
  previewLabel: { color: '#5ffce0', fontSize: '12px', marginTop: '12px', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '1px' },
  previewValue: { color: '#e0e0e0', fontSize: '15px', lineHeight: '1.5', margin: '0' },
  sealCircle: { width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle, #5ffce0 0%, #1a7a6d 70%, transparent 100%)', marginBottom: '24px' },
  artImg: { width: '200px', height: '200px', borderRadius: '12px', objectFit: 'cover', marginBottom: '16px' },
  error: { color: '#ff6b6b', fontSize: '14px', marginTop: '8px' },
};
