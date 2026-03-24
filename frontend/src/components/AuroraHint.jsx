import { useEffect, useRef } from 'react';

/**
 * AuroraHint — Subtle aurora bands visible when coherence > 0.3
 * Character determines color palette.
 */
export default function AuroraHint({ coherence = 0.3, character = 'luno' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame;

    function animate() {
      const t = Date.now() / 1000;
      const opacity = Math.max(0, (coherence - 0.3) * 1.4) * 0.4;
      const shift = Math.sin(t * 0.2) * 20;
      el.style.opacity = opacity;
      el.style.transform = `translateY(${shift}px)`;
      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(frame);
  }, [coherence]);

  const isLuna = character === 'luna';
  const gradient = isLuna
    ? 'linear-gradient(180deg, transparent 0%, rgba(244,180,196,0.08) 30%, rgba(200,140,170,0.05) 60%, transparent 100%)'
    : 'linear-gradient(180deg, transparent 0%, rgba(79,209,197,0.08) 30%, rgba(99,179,237,0.05) 60%, transparent 100%)';

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: 0,
        left: '-10%',
        width: '120%',
        height: '40vh',
        background: gradient,
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0
      }}
    />
  );
}
