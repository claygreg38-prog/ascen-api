import { useEffect, useRef } from 'react';

/**
 * Plankton — Canvas particle system
 * Density driven by coherence level and session count.
 * Character determines color palette (teal for Luno, rose for Luna).
 */
export default function Plankton({ coherence = 0.3, sessionCount = 0, character = 'luno' }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    // Particle count scales with coherence + sessions
    const baseCount = 40 + Math.min(sessionCount, 50) * 2;
    const count = Math.round(baseCount * (0.5 + coherence * 0.5));

    const isLuna = character === 'luna';
    const colors = isLuna
      ? ['rgba(244,180,196,', 'rgba(255,200,220,', 'rgba(200,160,180,']
      : ['rgba(79,209,197,', 'rgba(99,179,237,', 'rgba(160,196,232,'];

    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2 - 0.1,
      alpha: 0.1 + Math.random() * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2
    }));

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const t = Date.now() / 1000;

      for (const p of particles.current) {
        p.x += p.vx + Math.sin(t * 0.5 + p.phase) * 0.15;
        p.y += p.vy + Math.cos(t * 0.3 + p.phase) * 0.1;

        // Wrap
        if (p.x < -5) p.x = window.innerWidth + 5;
        if (p.x > window.innerWidth + 5) p.x = -5;
        if (p.y < -5) p.y = window.innerHeight + 5;
        if (p.y > window.innerHeight + 5) p.y = -5;

        const flicker = 0.7 + Math.sin(t * 2 + p.phase) * 0.3;
        const a = p.alpha * flicker * (0.4 + coherence * 0.6);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + a.toFixed(3) + ')';
        ctx.fill();

        // Glow at higher coherence
        if (coherence > 0.4 && p.r > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = p.color + (a * 0.15).toFixed(3) + ')';
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [coherence, sessionCount, character]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
}
