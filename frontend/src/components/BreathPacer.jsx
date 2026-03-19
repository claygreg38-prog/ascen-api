import { useState, useEffect, useRef } from 'react';

export default function BreathPacer({ inhaleSeconds = 4, exhaleSeconds = 6, isActive = false, onCycle }) {
  const [phase, setPhase] = useState('inhale');
  const [scale, setScale] = useState(0.4);
  const frameRef = useRef(null);
  const startRef = useRef(Date.now());
  const cycleRef = useRef(0);

  useEffect(() => {
    if (!isActive) { setScale(0.4); setPhase('inhale'); return; }
    startRef.current = Date.now();
    cycleRef.current = 0;

    const total = inhaleSeconds + exhaleSeconds;

    function animate() {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const pos = elapsed % total;
      const currentCycle = Math.floor(elapsed / total);

      if (currentCycle > cycleRef.current) {
        cycleRef.current = currentCycle;
        if (onCycle) onCycle(currentCycle);
      }

      if (pos < inhaleSeconds) {
        setPhase('inhale');
        setScale(0.4 + (pos / inhaleSeconds) * 0.6);
      } else {
        setPhase('exhale');
        setScale(1.0 - ((pos - inhaleSeconds) / exhaleSeconds) * 0.6);
      }

      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [inhaleSeconds, exhaleSeconds, isActive, onCycle]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div style={{
        width: '200px', height: '200px', borderRadius: '50%',
        background: `radial-gradient(circle, rgba(95,252,224,0.3), rgba(95,252,224,0.08), transparent)`,
        border: '2px solid rgba(95,252,224,0.4)',
        transform: `scale(${scale})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <span style={{ fontSize: '18px', fontWeight: 300, color: '#5ffce0', letterSpacing: '2px' }}>
          {phase === 'inhale' ? 'Breathe in' : 'Breathe out'}
        </span>
      </div>
      <span style={{ fontSize: '13px', color: '#556677', letterSpacing: '3px' }}>
        {inhaleSeconds} : {exhaleSeconds}
      </span>
    </div>
  );
}
