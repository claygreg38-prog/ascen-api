import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// DriftingWord — Float in, pulse, dissolve
// Used during descent, breathing, and ascent.
// Font: Outfit weight 200, rgba(255,255,255,0.7)
// ═══════════════════════════════════════════════════════════════

export default function DriftingWord({ text, duration = 2500, delay = 0 }) {
  const [opacity, setOpacity] = useState(0);
  const [y, setY] = useState(8);

  useEffect(() => {
    const delayTimer = setTimeout(() => {
      // Fade in
      requestAnimationFrame(() => { setOpacity(1); setY(0); });
      // Fade out
      const fadeOut = setTimeout(() => { setOpacity(0); setY(-12); }, duration - 500);
      return () => clearTimeout(fadeOut);
    }, delay);
    return () => clearTimeout(delayTimer);
  }, [duration, delay]);

  // Slight random horizontal offset
  const offsetX = ((text.length * 7) % 21) - 10;

  return (
    <div style={{
      position: 'absolute', top: '55%', left: `calc(50% + ${offsetX}px)`,
      transform: `translate(-50%, ${y}px)`,
      fontSize: 22, fontWeight: 200, letterSpacing: 3,
      color: `rgba(200,220,240,${opacity * 0.7})`,
      textShadow: `0 0 20px rgba(120,180,220,${opacity * 0.3})`,
      transition: 'all 1.8s cubic-bezier(0.25, 0.1, 0.25, 1)',
      pointerEvents: 'none', fontFamily: "'Outfit', sans-serif",
      fontStyle: 'italic', zIndex: 20,
    }}>
      {text}
    </div>
  );
}

// Coherence-gated word bank for breathing phase
const WORD_BANK = {
  low:    ['Breathe.', 'Here.', 'Safe.'],
  medium: ['Safe here.', 'Feel that.', 'Going deeper.'],
  high:   ['Your light.', 'Still waters.', 'The ocean listens.'],
  // peak (0.85+): no words — system trusts the nervous system
};

export function getCoherenceWord(coherence) {
  if (coherence >= 0.85) return null; // Words disappear at peak
  let pool;
  if (coherence < 0.3) pool = WORD_BANK.low;
  else if (coherence < 0.6) pool = WORD_BANK.medium;
  else pool = WORD_BANK.high;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getCoherenceInterval(coherence) {
  if (coherence >= 0.85) return null;
  if (coherence < 0.3) return 15000 + Math.random() * 5000;
  if (coherence < 0.6) return 20000 + Math.random() * 10000;
  return 30000 + Math.random() * 15000;
}
