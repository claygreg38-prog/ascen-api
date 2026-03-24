import { useEffect, useRef } from 'react';

/**
 * Waves — Animated horizontal wave lines at the bottom
 */
export default function Waves({ character = 'luno' }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const h = 120;

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = h * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = h + 'px';
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    const isLuna = character === 'luna';
    const colors = isLuna
      ? ['rgba(244,180,196,0.06)', 'rgba(200,140,170,0.04)', 'rgba(180,120,150,0.03)']
      : ['rgba(79,209,197,0.06)', 'rgba(99,179,237,0.04)', 'rgba(160,196,232,0.03)'];

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, h);
      const t = Date.now() / 1000;
      const w = window.innerWidth;

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 4) {
          const y = h - 30 - i * 15 + Math.sin(x * 0.008 + t * (0.3 + i * 0.15) + i) * (8 + i * 4);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [character]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        bottom: 60,
        left: 0,
        width: '100%',
        height: 120,
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
}
