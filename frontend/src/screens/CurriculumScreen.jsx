import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

const MILESTONES = [4, 8, 12];

export default function CurriculumScreen() {
  const [curriculum, setCurriculum] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Complete flow
  const [completing, setCompleting] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assessment, setAssessment] = useState(null);

  const user = getUser();
  const familyUnitId = user?.familyUnitId || user?.family_unit_id;

  useEffect(() => { loadCurriculum(); }, []);

  async function loadCurriculum() {
    try {
      const { data } = await api.get(`/api/compass/curriculum/${familyUnitId}`);
      setCurriculum(data?.curriculum || data);
      setAssignments(data?.assignments || data?.curriculum?.assignments || []);
    } catch {}
    setLoading(false);
  }

  async function generateCurriculum() {
    setGenerating(true);
    try {
      await api.post('/api/compass/curriculum/generate', { family_unit_id: familyUnitId });
      loadCurriculum();
    } catch {}
    setGenerating(false);
  }

  function startComplete(assignment) {
    setCompleting(assignment);
    setFeedback('');
    setAssessment(null);
  }

  async function submitComplete() {
    if (!completing) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/api/compass/curriculum/assignment/${completing.assignment_id}/complete`, {
        feedback
      });
      setAssessment(data?.assessment || data?.sonnet_assessment || data);
      loadCurriculum();
    } catch {}
    setSubmitting(false);
  }

  const currentWeek = curriculum?.current_week || 1;
  const theme = curriculum?.theme || curriculum?.current_theme || '';
  const isMilestone = MILESTONES.includes(currentWeek);
  const progress = Math.min((currentWeek / 12) * 100, 100);

  if (loading) {
    return <div style={S.container}><p style={S.dim}>Loading...</p></div>;
  }

  // No curriculum yet
  if (!curriculum || !curriculum.curriculum_id) {
    return (
      <div style={S.container}>
        <h2 style={S.title}>12-Week Curriculum</h2>
        <p style={S.sub}>A step-by-step guide built just for your family.</p>
        <div style={S.emptyCard}>
          <p style={{ color: '#aabbcc', fontSize: '15px', marginBottom: '16px' }}>
            You do not have an active curriculum yet. Ready to start?
          </p>
          <button onClick={generateCurriculum} disabled={generating} style={S.btn}>
            {generating ? 'Building your plan...' : 'Start My Curriculum'}
          </button>
        </div>
      </div>
    );
  }

  // Assessment view
  if (assessment) {
    return (
      <div style={S.container}>
        <h2 style={S.title}>Nice work!</h2>
        <div style={{ ...S.card, borderLeft: '4px solid #5ffce0' }}>
          <p style={S.assessLabel}>What we noticed</p>
          <p style={S.assessText}>{assessment.feedback || assessment.assessment || assessment}</p>
          {assessment.encouragement && <p style={S.encourage}>{assessment.encouragement}</p>}
        </div>
        <button onClick={() => { setAssessment(null); setCompleting(null); }} style={S.btn}>Continue</button>
      </div>
    );
  }

  // Complete flow
  if (completing) {
    return (
      <div style={S.container}>
        <button onClick={() => setCompleting(null)} style={S.back}>&larr; Back</button>
        <h2 style={S.title}>Finish Assignment</h2>
        <div style={S.card}>
          <p style={{ color: '#e0e0e0', fontSize: '15px', marginBottom: '4px' }}>{completing.title}</p>
          <p style={S.dim}>{completing.description}</p>
        </div>
        <p style={{ ...S.sub, marginTop: '20px' }}>How did it go? Share a few thoughts.</p>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
          placeholder="Write a little about your experience..." style={S.textarea} rows={4} />
        <button onClick={submitComplete} disabled={submitting} style={S.btn}>
          {submitting ? 'Saving...' : 'Mark as Done'}
        </button>
      </div>
    );
  }

  // Main view
  return (
    <div style={S.container}>
      <h2 style={S.title}>Your Curriculum</h2>

      {/* Week + progress */}
      <div style={{ ...S.card, ...(isMilestone ? S.milestoneCard : {}) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={S.weekLabel}>Week {currentWeek} of 12</span>
          {isMilestone && <span style={S.milestoneBadge}>Milestone</span>}
        </div>
        {theme && <p style={S.theme}>{theme}</p>}
        <div style={S.progressTrack}>
          <div style={{ ...S.progressBar, width: `${progress}%` }} />
        </div>
        <p style={S.dim}>{Math.round(progress)}% complete</p>
      </div>

      {/* Assignments */}
      <h3 style={S.sectionTitle}>This Week</h3>

      {assignments.filter(a => a.week === currentWeek || !a.completed_at).map(a => (
        <div key={a.assignment_id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                {a.type && <span style={S.typeBadge}>{a.type}</span>}
                <p style={{ color: '#e0e0e0', fontSize: '15px', fontWeight: 600, margin: 0 }}>{a.title}</p>
              </div>
              {a.description && <p style={S.dim}>{a.description}</p>}
            </div>
            {a.completed_at && <span style={S.doneBadge}>Done</span>}
          </div>
          {!a.completed_at && (
            <button onClick={() => startComplete(a)} style={{ ...S.btnSmall, marginTop: '12px' }}>Complete</button>
          )}
        </div>
      ))}

      {assignments.filter(a => a.week === currentWeek || !a.completed_at).length === 0 && (
        <p style={{ ...S.dim, textAlign: 'center', marginTop: '20px' }}>All caught up this week!</p>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { padding: '24px', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 600, color: '#5ffce0', marginBottom: '8px' },
  sub: { color: '#8899aa', fontSize: '15px', lineHeight: '1.5' },
  dim: { color: '#8899aa', fontSize: '13px', margin: 0 },
  card: { background: '#0a2540', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
  milestoneCard: { border: '2px solid #f0b860' },
  emptyCard: { background: '#0a2540', borderRadius: '12px', padding: '32px', textAlign: 'center', marginTop: '24px' },
  weekLabel: { color: '#5ffce0', fontSize: '16px', fontWeight: 600 },
  theme: { color: '#f0b860', fontSize: '15px', margin: '0 0 12px 0' },
  milestoneBadge: { background: '#f0b860', color: '#061a2a', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 },
  progressTrack: { height: '8px', background: '#112d4a', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' },
  progressBar: { height: '100%', background: 'linear-gradient(to right, #1a7a6d, #5ffce0)', borderRadius: '4px', transition: 'width 0.5s ease' },
  sectionTitle: { color: '#5ffce0', fontSize: '15px', fontWeight: 600, margin: '20px 0 12px 0' },
  typeBadge: { background: '#112d4a', color: '#5ffce0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' },
  doneBadge: { background: '#1a7a6d', color: '#fff', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, flexShrink: 0 },
  btn: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: '16px' },
  btnSmall: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#1a7a6d', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  back: { background: 'none', border: 'none', color: '#5ffce0', fontSize: '14px', cursor: 'pointer', padding: '8px 0', marginBottom: '12px' },
  textarea: { width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #1a3a5c', background: '#112d4a', color: '#e0e0e0', fontSize: '15px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'sans-serif' },
  assessLabel: { color: '#5ffce0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px 0' },
  assessText: { color: '#e0e0e0', fontSize: '15px', lineHeight: '1.6', margin: '0 0 8px 0' },
  encourage: { color: '#f0b860', fontSize: '14px', lineHeight: '1.5', margin: 0 },
};
