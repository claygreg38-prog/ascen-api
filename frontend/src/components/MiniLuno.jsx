import { useEffect, useRef } from 'react';

/**
 * MiniLuno — Small breathing organism
 * Pulses gently. Character determines color (teal for Luno, rose for Luna).
 */
export default function MiniLuno({ size = 48, character = 'luno', coherence = 0.3, onClick }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame;
    function animate() {
      const t = Date.now() / 1000;
      const scale = 1 + Math.sin(t * 1.2) * 0.08 * (0.5 + coherence * 0.5);
      const glow = 4 + coherence * 12;
      el.style.transform = `scale(${scale})`;
      const c = character === 'luna' ? '244,180,196' : '79,209,197';
      el.style.boxShadow = `0 0 ${glow}px rgba(${c},${0.3 + coherence * 0.4})`;
      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(frame);
  }, [coherence, character]);

  const isLuna = character === 'luna';
  const bg = isLuna
    ? 'radial-gradient(circle, rgba(244,180,196,0.6), rgba(200,140,170,0.3))'
    : 'radial-gradient(circle, rgba(79,209,197,0.6), rgba(50,130,160,0.3))';

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        border: `1px solid ${isLuna ? 'rgba(244,180,196,0.3)' : 'rgba(79,209,197,0.3)'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.3s'
      }}
    />
  );
}
