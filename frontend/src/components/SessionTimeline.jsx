import { useRef, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// SessionTimeline — Ref-Based Canvas HRV Traces
// Clinician-only. Renders HRV traces for all family members on a
// shared timeline with event markers and playhead.
// Canvas is ref-based — NEVER restarts on data updates.
// ═══════════════════════════════════════════════════════════════

const CAP_COLORS = {
  full:         '#5CE0D0',
  steady:       '#A8CCE8',
  drawing_down: '#E8BE6A',
  low:          '#E09878',
  depleted:     '#D88AA0',
};

const EVENT_STYLES = {
  topic_activated:   { color: '#E8BE6A', dash: [6, 4] },
  dysregulation:     { color: '#E09878', dash: [4, 4] },
  co_breath:         { color: '#5CE0D0', dash: [6, 4] },
  coaching_card:     { color: '#E8BE6A', dash: [] },  // dot, not line
};

const MIN_DURATION_MS = 10 * 60 * 1000; // 10 minutes minimum
const HRV_MIN = 0;
const HRV_MAX = 70;
const PADDING = { top: 20, right: 70, bottom: 30, left: 40 };

export default function SessionTimeline({ biometricHistory, events, members, elapsedMs, sessionStartTime }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Store data in refs so draw loop reads latest without re-mounting
  const dataRef = useRef({ biometricHistory: [], events: [], members: [], elapsedMs: 0 });

  useEffect(() => {
    dataRef.current = { biometricHistory: biometricHistory || [], events: events || [], members: members || [], elapsedMs: elapsedMs || 0 };
  }, [biometricHistory, events, members, elapsedMs]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { biometricHistory: hist, events: evts, members: mbrs, elapsedMs: elapsed } = dataRef.current;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    const plotW = w - PADDING.left - PADDING.right;
    const plotH = h - PADDING.top - PADDING.bottom;
    const duration = Math.max(MIN_DURATION_MS, elapsed);

    // Helper: time → x
    const tx = (t) => PADDING.left + (t / duration) * plotW;
    // Helper: hrv → y (inverted — higher HRV = higher on screen)
    const ty = (v) => PADDING.top + plotH - ((Math.min(Math.max(v, HRV_MIN), HRV_MAX) - HRV_MIN) / (HRV_MAX - HRV_MIN)) * plotH;

    // ── Background grid ──
    ctx.strokeStyle = 'rgba(200,210,225,0.06)';
    ctx.lineWidth = 0.5;

    // Horizontal lines at HRV intervals (every 10ms)
    for (let v = 0; v <= HRV_MAX; v += 10) {
      const y = ty(v);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(w - PADDING.right, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(200,210,225,0.25)';
      ctx.font = '8px Outfit, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${v}`, PADDING.left - 4, y + 3);
    }

    // Vertical lines at minute markers
    const totalMin = Math.ceil(duration / 60000);
    for (let m = 0; m <= totalMin; m++) {
      const x = tx(m * 60000);
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, h - PADDING.bottom);
      ctx.stroke();

      // Time label
      ctx.fillStyle = 'rgba(200,210,225,0.25)';
      ctx.font = '8px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${m}m`, x, h - PADDING.bottom + 12);
    }

    // ── Event markers ──
    for (const evt of evts) {
      const style = EVENT_STYLES[evt.type] || EVENT_STYLES.topic_activated;
      const x = tx(evt.timestamp);

      if (evt.type === 'coaching_card') {
        // Dot marker
        ctx.fillStyle = style.color;
        ctx.beginPath();
        ctx.arc(x, PADDING.top + 8, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Dashed vertical line
        ctx.strokeStyle = style.color + '60';
        ctx.lineWidth = 1;
        ctx.setLineDash(style.dash);
        ctx.beginPath();
        ctx.moveTo(x, PADDING.top);
        ctx.lineTo(x, h - PADDING.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        if (evt.label) {
          ctx.fillStyle = style.color + '80';
          ctx.font = '7px Outfit, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(evt.label, x + 3, PADDING.top + 10);
        }
      }
    }

    // ── HRV traces per member ──
    // Group history by user_id
    const grouped = {};
    for (const tick of hist) {
      const uid = tick.user_id || tick.userId;
      if (!grouped[uid]) grouped[uid] = [];
      grouped[uid].push(tick);
    }

    for (const uid of Object.keys(grouped)) {
      const ticks = grouped[uid];
      if (ticks.length < 2) continue;

      // Use the most recent capacity state for color
      const lastState = ticks[ticks.length - 1].capacity_state || 'steady';
      const color = CAP_COLORS[lastState] || CAP_COLORS.steady;

      ctx.strokeStyle = color + 'cc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < ticks.length; i++) {
        const x = tx(ticks[i].timestamp);
        const y = ty(ticks[i].hrv || 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── Playhead ──
    const px = tx(elapsed);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(px, PADDING.top);
    ctx.lineTo(px, h - PADDING.bottom);
    ctx.stroke();

    // ── Legend (top-right) ──
    let ly = PADDING.top + 4;
    for (const m of mbrs) {
      const mName = m.first_name || m.firstName || '?';
      const mColor = CAP_COLORS[m.capacity_state] || CAP_COLORS.steady;
      ctx.fillStyle = mColor;
      ctx.fillRect(w - PADDING.right + 8, ly, 8, 8);
      ctx.fillStyle = 'rgba(200,210,225,0.5)';
      ctx.font = '8px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(mName, w - PADDING.right + 20, ly + 7);
      ly += 14;
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
