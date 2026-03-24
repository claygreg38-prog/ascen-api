import { useEffect, useRef } from 'react';

/**
 * CoherenceRings — Three concentric alignment rings
 * Drift when low coherence, align and pulse when high.
 */
export default function CoherenceRings({ coherence = 0.3, size = 80, character = 'luno' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rings = el.children;
    let frame;

    function animate() {
      const t = Date.now() / 1000;
      const drift = Math.max(0, 1 - coherence * 2); // 0 at high coherence, 1 at low

      for (let i = 0; i < 3; i++) {
        const ring = rings[i];
        const offset = (i + 1) * 2;
        const dx = Math.sin(t * (0.5 + i * 0.3)) * drift * offset;
        const dy = Math.cos(t * (0.4 + i * 0.2)) * drift * offset;
        const scale = 1 + Math.sin(t * 1.5 + i) * 0.03 * (coherence > 0.5 ? 1 : 0);
        ring.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      }

      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(frame);
  }, [coherence]);

  const c = character === 'luna' ? '244,180,196' : '79,209,197';
  const ringStyle = (i) => ({
    position: 'absolute',
    inset: i * 6,
    borderRadius: '50%',
    border: `1px solid rgba(${c},${0.15 + coherence * 0.2 - i * 0.05})`,
    transition: 'border-color 1s'
  });

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: size,
        height: size
      }}
    >
      <div style={ringStyle(0)} />
      <div style={ringStyle(1)} />
      <div style={ringStyle(2)} />
    </div>
  );
}
