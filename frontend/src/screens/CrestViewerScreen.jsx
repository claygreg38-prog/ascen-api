import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════
// CrestViewerScreen — Family Crest Living Document
// Route: /app/family/crest
// Data from GET /api/crest (deployed familyCrestEngine.js)
//
// Diamond shield with 4 quadrants. Tree evolution at center.
// Quadrants illuminate as data populates.
// ═══════════════════════════════════════════════════════════════

const STAGES = [
  { id: 'seed',   ver: 'v1.0', name: 'The Inventory',     desc: 'Your crest is planted.' },
  { id: 'root',   ver: 'v1.5', name: 'The First Release',  desc: 'Roots are growing.' },
  { id: 'trunk',  ver: 'v2.0', name: 'The Demonstration',  desc: 'The trunk is forming.' },
  { id: 'branch', ver: 'v2.5', name: 'The Expansion',      desc: 'Branches are reaching.' },
  { id: 'canopy', ver: 'v3.0', name: 'The Pattern Break',  desc: 'Your family tree is alive.' },
];

function versionToStage(ver) {
  const v = parseFloat(ver || '1.0');
  if (v >= 3.0) return 4;
  if (v >= 2.5) return 3;
  if (v >= 2.0) return 2;
  if (v >= 1.5) return 1;
  return 0;
}

// ── CREST CANVAS ──────────────────────────────────────────────

function CrestCanvas({ stageIdx, quadrantData }) {
  const ref = useRef(null);
  const rafRef = useRef(null);
  const dynRef = useRef({ stageIdx, quadrantData });
  dynRef.current = { stageIdx, quadrantData };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let w, h;

    function resize() {
      w = cv.offsetWidth; h = cv.offsetHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }
      const t = Date.now() * 0.001;
      const d = dynRef.current;
      const si = d.stageIdx;
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.5;
      const r = Math.min(w, h) * 0.42;

      // Shield glow
      const glowR = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.3);
      glowR.addColorStop(0, `rgba(92,224,208,${0.02 + si * 0.01})`);
      glowR.addColorStop(1, 'rgba(92,224,208,0)');
      ctx.fillStyle = glowR;
      ctx.fillRect(0, 0, w, h);

      // Shield diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.85, cy);
      ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.85, cy);
      ctx.closePath();
      ctx.fillStyle = 'rgba(14,22,35,0.5)';
      ctx.fill();
      ctx.strokeStyle = `rgba(160,180,210,${0.12 + si * 0.04})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cross lines
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.75, cy); ctx.lineTo(cx + r * 0.75, cy);
      ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx, cy + r * 0.85);
      ctx.strokeStyle = 'rgba(160,180,210,0.06)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Quadrant fills
      const quads = [
        { key: 'inheritance', pts: [[cx, cy - r], [cx + r * 0.85, cy], [cx, cy]], color: 'rgba(232,190,106,' },
        { key: 'release',     pts: [[cx + r * 0.85, cy], [cx, cy + r], [cx, cy]], color: 'rgba(168,204,232,' },
        { key: 'keepers',     pts: [[cx, cy + r], [cx - r * 0.85, cy], [cx, cy]], color: 'rgba(92,224,208,' },
        { key: 'promise',     pts: [[cx - r * 0.85, cy], [cx, cy - r], [cx, cy]], color: 'rgba(200,160,230,' },
      ];
      quads.forEach(q => {
        const active = d.quadrantData?.[q.key];
        if (active) {
          ctx.beginPath();
          ctx.moveTo(q.pts[0][0], q.pts[0][1]);
          ctx.lineTo(q.pts[1][0], q.pts[1][1]);
          ctx.lineTo(q.pts[2][0], q.pts[2][1]);
          ctx.closePath();
          const gx = (q.pts[0][0] + q.pts[1][0] + cx) / 3;
          const gy = (q.pts[0][1] + q.pts[1][1] + cy) / 3;
          const glow = ctx.createRadialGradient(gx, gy, 0, cx, cy, r * 0.7);
          glow.addColorStop(0, q.color + '0.12)');
          glow.addColorStop(1, q.color + '0.02)');
          ctx.fillStyle = glow;
          ctx.fill();
        }
      });

      // Tree at center
      const treeX = cx, treeBase = cy + r * 0.15;

      // Seed (always)
      ctx.beginPath();
      ctx.arc(treeX, treeBase, 4 + si * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,140,80,${0.4 + si * 0.12})`;
      ctx.fill();

      if (si >= 1) {
        for (let i = 0; i < 3; i++) {
          const rx = treeX + (i - 1) * 12;
          ctx.beginPath();
          ctx.moveTo(treeX, treeBase);
          ctx.quadraticCurveTo(rx + Math.sin(t * 0.3 + i) * 2, treeBase + 15, rx + (i - 1) * 8, treeBase + 25);
          ctx.strokeStyle = `rgba(140,100,60,${0.25 + si * 0.05})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      if (si >= 2) {
        const trunkH = 35 + (si - 2) * 15;
        ctx.beginPath();
        ctx.moveTo(treeX - 3, treeBase); ctx.lineTo(treeX - 2, treeBase - trunkH);
        ctx.lineTo(treeX + 2, treeBase - trunkH); ctx.lineTo(treeX + 3, treeBase);
        ctx.closePath();
        ctx.fillStyle = `rgba(120,85,50,${0.4 + si * 0.08})`;
        ctx.fill();

        if (si >= 3) {
          const branchY = treeBase - trunkH;
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI - Math.PI * 0.5 + Math.sin(t * 0.2 + i) * 0.05;
            const len = 18 + Math.sin(i * 2.3) * 6;
            ctx.beginPath();
            ctx.moveTo(treeX, branchY + i * 4);
            ctx.lineTo(treeX + Math.cos(angle) * len, branchY + i * 4 + Math.sin(angle) * len * 0.3);
            ctx.strokeStyle = `rgba(120,85,50,${0.3 + si * 0.06})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          if (si >= 4) {
            // Canopy — deterministic positions (golden ratio, no Math.random)
            const canopyY = branchY - 10;
            for (let i = 0; i < 12; i++) {
              const seed = i * 2.618;
              const lx = treeX + Math.sin(seed * 3.7) * 0.5 * 40 + Math.sin(t * 0.5 + i * 0.7) * 3;
              const ly = canopyY + Math.cos(seed * 2.3) * 0.5 * 20 + Math.cos(t * 0.4 + i * 0.9) * 2;
              const ls = 4 + Math.sin(seed * 5.1) * 2 + 2;
              ctx.beginPath();
              ctx.arc(lx, ly, ls, 0, Math.PI * 2);
              const leafG = ctx.createRadialGradient(lx, ly, 0, lx, ly, ls);
              leafG.addColorStop(0, `rgba(80,180,100,${0.2 + Math.sin(t + i) * 0.08})`);
              leafG.addColorStop(1, 'rgba(50,140,70,0.05)');
              ctx.fillStyle = leafG;
              ctx.fill();
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />;
}

// ── MAIN SCREEN ───────────────────────────────────────────────

const QUAD_META = [
  { key: 'inheritance', label: 'Heritage',  icon: '\uD83C\uDF3F', color: 'rgba(232,190,106,' },
  { key: 'release',     label: 'Release',   icon: '\uD83D\uDEE1\uFE0F', color: 'rgba(168,204,232,' },
  { key: 'keepers',     label: 'Keepers',   icon: '\u26A1',       color: 'rgba(92,224,208,' },
  { key: 'promise',     label: 'Promise',   icon: '\uD83D\uDD2D', color: 'rgba(200,160,230,' },
];

export default function CrestViewerScreen() {
  const nav = useNavigate();
  const [crest, setCrest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ceremonyGlow, setCeremonyGlow] = useState(false);

  useEffect(() => {
    api.get('/api/crest')
      .then(({ data }) => {
        setCrest(data);
        // Brief glow pulse on load if crest has evolved beyond seed
        if (parseFloat(data?.current_version || '1.0') > 1.0) {
          setCeremonyGlow(true);
          setTimeout(() => setCeremonyGlow(false), 2000);
        }
      })
      .catch(err => {
        if (err.response?.status === 404) setError('no_crest');
        else setError('failed');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={S.root}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <p style={{ color: 'rgba(200,210,225,0.3)', fontSize: 13 }}>Loading your family crest...</p>
        </div>
      </div>
    );
  }

  if (error === 'no_crest') {
    return (
      <div style={S.root}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, padding: 24 }}>
          <p style={{ color: 'rgba(200,210,225,0.4)', fontSize: 14, textAlign: 'center' }}>Your family crest will appear after your LACE assessment is complete.</p>
          <button onClick={() => nav('/app/family')} style={S.backBtn}>Back to Family</button>
        </div>
      </div>
    );
  }

  if (error || !crest) {
    return (
      <div style={S.root}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
          <p style={{ color: 'rgba(200,210,225,0.3)', fontSize: 13 }}>Could not load crest.</p>
          <button onClick={() => nav('/app/family')} style={S.backBtn}>Back to Family</button>
        </div>
      </div>
    );
  }

  const stageIdx = versionToStage(crest.current_version);
  const stageObj = STAGES[stageIdx] || STAGES[0];
  const familyName = crest.family_name || 'Family';

  // Determine which quadrants have content
  const quadrantData = {
    inheritance: !!(crest.quadrants?.inheritance?.armors?.length || crest.quadrants?.inheritance?.domains?.length),
    release: !!(crest.quadrants?.release?.patterns?.length),
    keepers: !!(crest.quadrants?.keepers?.strengths?.length),
    promise: !!(crest.quadrants?.promise?.blueprint_visions || crest.quadrants?.promise?.family_declaration),
  };

  // Build content lines for each quadrant
  function getQuadrantLines(key) {
    const q = crest.quadrants?.[key];
    if (!q) return null;
    switch (key) {
      case 'inheritance': {
        const lines = [];
        if (q.domains?.length) lines.push(`${q.domains.length} generational patterns identified`);
        if (q.armors?.length) lines.push(q.armors.join(' \u00B7 '));
        return lines.length ? lines : null;
      }
      case 'release': {
        if (!q.patterns?.length) return null;
        return q.patterns.map(p => `${p.pattern_name} (released)`);
      }
      case 'keepers': {
        if (!q.strengths?.length) return null;
        return q.strengths.map(s => `${s.armor}: ${s.strength}`);
      }
      case 'promise': {
        const lines = [];
        if (q.blueprint_visions) lines.push('Blueprint designed');
        if (q.family_declaration) lines.push(`"${q.family_declaration}"`);
        return lines.length ? lines : null;
      }
      default: return null;
    }
  }

  const hasDeclaration = !!crest.quadrants?.promise?.family_declaration;

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <button onClick={() => nav('/app/family')} style={S.backLink}>&larr; Family</button>
        <div style={S.headerLabel}>FAMILY CREST</div>
      </div>
      <div style={S.familyName}>The {familyName} Family</div>
      {crest.family_code_name && (
        <div style={S.codeName}>{crest.family_code_name}</div>
      )}

      {/* Crest canvas */}
      <div style={{
        ...S.crestContainer,
        ...(ceremonyGlow ? { filter: 'brightness(1.3)', transition: 'filter 2s ease-out' } : { transition: 'filter 0.5s ease' }),
      }}>
        <CrestCanvas stageIdx={stageIdx} quadrantData={quadrantData} />
        {/* Quadrant labels overlaid */}
        {[
          { pos: { top: '8%', left: '50%', transform: 'translateX(-50%)' }, q: QUAD_META[0] },
          { pos: { top: '45%', right: '2%', transform: 'translateY(-50%)' }, q: QUAD_META[1] },
          { pos: { bottom: '8%', left: '50%', transform: 'translateX(-50%)' }, q: QUAD_META[2] },
          { pos: { top: '45%', left: '2%', transform: 'translateY(-50%)' }, q: QUAD_META[3] },
        ].map(({ pos, q }, i) => (
          <div key={i} style={{
            position: 'absolute', ...pos,
            fontSize: 9, fontWeight: 500, letterSpacing: 1,
            color: quadrantData[q.key] ? q.color + '0.6)' : 'rgba(160,180,210,0.2)',
            textTransform: 'uppercase', textAlign: 'center',
          }}>
            <span style={{ fontSize: 14 }}>{q.icon}</span>
            <div style={{ marginTop: 2 }}>{q.label}</div>
          </div>
        ))}
      </div>

      {/* Evolution stage */}
      <div style={S.stageSection}>
        <div style={S.stageDots}>
          {STAGES.map((s, i) => (
            <div key={s.id} style={{
              width: i <= stageIdx ? 10 : 6, height: i <= stageIdx ? 10 : 6,
              borderRadius: '50%',
              background: i <= stageIdx ? 'rgba(92,224,208,0.5)' : 'rgba(160,180,210,0.1)',
              border: i === stageIdx ? '2px solid rgba(92,224,208,0.6)' : 'none',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
        <div style={S.stageLabel}>{stageObj.name}</div>
        <div style={S.stageDesc}>{stageObj.desc}</div>
        <div style={S.stageVer}>{stageObj.ver}</div>
      </div>

      {/* Quadrant detail cards */}
      {QUAD_META.map(q => {
        const lines = getQuadrantLines(q.key);
        const active = !!lines;
        return (
          <div key={q.key} style={{
            ...S.quadCard,
            background: active ? 'rgba(14,28,50,0.4)' : 'rgba(14,28,50,0.2)',
            border: `1px solid ${active ? q.color + '0.12)' : 'rgba(160,180,210,0.04)'}`,
            borderLeft: `3px solid ${active ? q.color + '0.35)' : 'rgba(160,180,210,0.06)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: active ? 8 : 0 }}>
              <span style={{ fontSize: 16 }}>{q.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: active ? q.color + '0.7)' : 'rgba(160,180,210,0.25)' }}>{q.label}</span>
              {!active && <span style={{ fontSize: 10, color: 'rgba(160,180,210,0.15)', fontStyle: 'italic', marginLeft: 'auto' }}>not yet started</span>}
            </div>
            {active && (
              <div style={{ paddingLeft: 24 }}>
                {lines.map((line, li) => (
                  <div key={li} style={{ fontSize: 11, fontWeight: 300, color: 'rgba(200,210,225,0.5)', lineHeight: 1.7 }}>{line}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Family Declaration */}
      {hasDeclaration && (
        <div style={S.declarationBanner}>
          <div style={S.declarationLabel}>FAMILY DECLARATION</div>
          <div style={S.declarationText}>
            "{crest.quadrants.promise.family_declaration}"
          </div>
        </div>
      )}

      {/* Participating members */}
      {crest.participating_members?.length > 0 && (
        <div style={S.membersSection}>
          <div style={S.sectionLabel}>FAMILY MEMBERS</div>
          <div style={S.memberRow}>
            {crest.participating_members.map((m, i) => (
              <div key={i} style={S.memberChip}>
                <span style={{ fontSize: 11, color: 'rgba(200,210,225,0.6)' }}>{m.name}</span>
                <span style={{ fontSize: 8, color: 'rgba(160,180,210,0.3)' }}>{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Absent members */}
      {crest.absent_members?.length > 0 && (
        <div style={S.membersSection}>
          {crest.absent_members.map((m, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(160,180,210,0.25)', fontStyle: 'italic', marginBottom: 4 }}>
              {m.name} — {m.note || 'Honored in absence. Welcomed when ready.'}
            </div>
          ))}
        </div>
      )}

      {/* Version history */}
      {crest.version_history?.length > 0 && (
        <div style={S.historySection}>
          <div style={S.sectionLabel}>VERSION HISTORY</div>
          <div style={S.timeline}>
            {crest.version_history.map((v, i) => (
              <div key={i} style={S.timelineDot}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(92,224,208,0.4)' }} />
                <div>
                  <span style={{ fontSize: 10, color: 'rgba(200,210,225,0.5)' }}>v{v.version}</span>
                  <span style={{ fontSize: 8, color: 'rgba(160,180,210,0.2)', marginLeft: 6 }}>
                    {new Date(v.triggered_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next version progress */}
      {crest.next_versions?.length > 0 && (
        <div style={S.historySection}>
          <div style={S.sectionLabel}>NEXT VERSION</div>
          {crest.next_versions.map((nv, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'rgba(200,210,225,0.4)', marginBottom: 4 }}>v{nv.target}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {nv.progress?.met?.map((c, j) => (
                  <span key={j} style={{ fontSize: 8, color: 'rgba(92,224,208,0.5)', padding: '2px 6px', borderRadius: 4, background: 'rgba(92,224,208,0.08)' }}>{'\u2713'}</span>
                ))}
                {nv.progress?.missing?.map((c, j) => (
                  <span key={j} style={{ fontSize: 8, color: 'rgba(160,180,210,0.15)', padding: '2px 6px', borderRadius: 4, background: 'rgba(14,28,50,0.4)' }}>{'\u25CB'}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}

const S = {
  root: {
    width: '100%', maxWidth: 430, margin: '0 auto', minHeight: '100vh',
    background: 'linear-gradient(180deg, #0A1828 0%, #0E1420 50%, #0A1828 100%)',
    fontFamily: "'Outfit',-apple-system,sans-serif", color: '#fff',
    padding: '0 20px',
  },
  header: { paddingTop: 44, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 },
  headerLabel: { fontSize: 9, fontWeight: 500, letterSpacing: 2.5, color: 'rgba(160,180,210,0.35)', textTransform: 'uppercase' },
  backLink: { background: 'none', border: 'none', color: 'rgba(92,224,208,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: 0 },
  familyName: { fontSize: 24, fontWeight: 200, color: 'rgba(210,220,235,0.88)', textAlign: 'center', marginBottom: 2 },
  codeName: { fontSize: 11, fontWeight: 400, color: 'rgba(160,180,210,0.3)', textAlign: 'center', marginBottom: 8 },
  crestContainer: { width: '100%', aspectRatio: '1', maxWidth: 340, margin: '0 auto 16px', position: 'relative' },
  stageSection: { textAlign: 'center', marginBottom: 20 },
  stageDots: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 },
  stageLabel: { fontSize: 14, fontWeight: 400, color: 'rgba(92,224,208,0.6)' },
  stageDesc: { fontSize: 11, color: 'rgba(160,180,210,0.35)', marginTop: 2 },
  stageVer: { fontSize: 9, color: 'rgba(160,180,210,0.18)', marginTop: 3, letterSpacing: 1 },
  quadCard: { borderRadius: 14, padding: '14px 18px', marginBottom: 10 },
  declarationBanner: {
    background: 'rgba(255,245,230,0.04)', border: '1px solid rgba(210,185,150,0.08)',
    borderRadius: 16, padding: '18px 22px', marginTop: 10, marginBottom: 10, textAlign: 'center',
  },
  declarationLabel: { fontSize: 8, letterSpacing: 2, color: 'rgba(210,180,130,0.35)', textTransform: 'uppercase', marginBottom: 8 },
  declarationText: { fontSize: 13, fontWeight: 300, color: 'rgba(220,210,195,0.55)', lineHeight: 1.8, fontStyle: 'italic' },
  membersSection: { marginBottom: 12 },
  sectionLabel: { fontSize: 8, fontWeight: 600, letterSpacing: 2, color: 'rgba(160,180,210,0.25)', textTransform: 'uppercase', marginBottom: 6 },
  memberRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  memberChip: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', borderRadius: 10, background: 'rgba(14,28,50,0.4)', border: '1px solid rgba(160,180,210,0.06)' },
  historySection: { marginBottom: 16 },
  timeline: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  timelineDot: { display: 'flex', alignItems: 'center', gap: 6 },
  backBtn: { padding: '10px 24px', borderRadius: 12, border: '1px solid rgba(92,224,208,0.2)', background: 'rgba(92,224,208,0.08)', color: 'rgba(92,224,208,0.7)', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
};
