import { useState, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// PullDownShade — Optional text during descent and breathing
// Hidden by default. Swipe down or tap chevron to reveal.
// Textless-first: this is opt-in. Never defaults to open.
// ═══════════════════════════════════════════════════════════════

export default function PullDownShade({ phase = 'descent', breathRatio, breathCount, coherenceDesc, reassurance, character = 'luno' }) {
  const [open, setOpen] = useState(false);
  const touchStartRef = useRef(0);
  const isL = character === 'luno';
  const accent = isL ? 'rgba(92,224,210,0.6)' : 'rgba(220,150,170,0.6)';

  function handleTouchStart(e) {
    touchStartRef.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    const dy = e.changedTouches[0].clientY - touchStartRef.current;
    if (!open && dy > 40) setOpen(true);
    if (open && dy < -30) setOpen(false);
  }

  let content = null;
  if (phase === 'descent' && breathRatio) {
    const [inhale, exhale] = breathRatio.split(':').map(Number);
    content = (
      <div style={{ textAlign: 'center' }}>
        <p style={S.heading}>Breath Guidance</p>
        <p style={S.main}>Breathe in for {inhale}. Out for {exhale}.</p>
      </div>
    );
  } else if (phase === 'breathing') {
    content = (
      <div style={{ textAlign: 'center' }}>
        {breathCount != null && (
          <p style={S.stat}>Breath {breathCount}</p>
        )}
        {coherenceDesc && (
          <p style={{ ...S.main, color: accent }}>{coherenceDesc}</p>
        )}
        {reassurance && (
          <p style={S.sub}>{reassurance}</p>
        )}
      </div>
    );
  } else if (phase === 'post') {
    content = (
      <div style={{ textAlign: 'center' }}>
        <p style={S.heading}>How Your Body Landed</p>
        <p style={S.sub}>
          Regulated means your body feels safe enough to connect.
          Settling means your body is finding its rhythm.
          Activated means your body is working — that's not wrong, it's information.
          Protected means your body chose safety. Honor that.
        </p>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 80, pointerEvents: 'auto' }}
    >
      {/* Chevron handle — always visible */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          textAlign: 'center', padding: '8px 0 4px',
          cursor: 'pointer', color: 'rgba(255,255,255,0.2)',
          fontSize: 18, transition: 'transform 0.3s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      >
        ▾
      </div>

      {/* Shade panel */}
      <div style={{
        background: 'rgba(2,8,18,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '0 0 16px 16px',
        padding: open ? '16px 24px 20px' : '0 24px',
        maxHeight: open ? 300 : 0,
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
        opacity: open ? 1 : 0,
      }}>
        {content}
        <p
          onClick={() => setOpen(false)}
          style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.15)', marginTop: 12, cursor: 'pointer' }}
        >
          tap to close
        </p>
      </div>
    </div>
  );
}

const S = {
  heading: { fontSize: 10, fontWeight: 500, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Outfit, sans-serif' },
  main: { fontSize: 16, fontWeight: 200, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, fontFamily: 'Outfit, sans-serif' },
  sub: { fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, fontFamily: 'Outfit, sans-serif', marginTop: 8 },
  stat: { fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, fontFamily: 'Outfit, sans-serif', marginBottom: 4 },
};
