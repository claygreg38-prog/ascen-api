import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// BioRing — Clinician-Only Biometric Ring Component
// Renders a pulsing ring per family member driven by live biometrics.
// Color = capacity state, pulse = respiratory rate, thickness = coherence.
// CSS animation only — no requestAnimationFrame (tablet CPU).
// ═══════════════════════════════════════════════════════════════

const CAP_COLORS = {
  full:         '#5CE0D0',
  steady:       '#A8CCE8',
  drawing_down: '#E8BE6A',
  low:          '#E09878',
  depleted:     '#D88AA0',
};

export default function BioRing({ member, onSelect, isSelected }) {
  const {
    first_name, firstName,
    hr = 0, hrv = 0, coherence = 0, rr = 0, ns3 = 0,
    capacity_state = 'steady',
  } = member;

  const name = first_name || firstName || '?';
  const color = CAP_COLORS[capacity_state] || CAP_COLORS.steady;

  // Pulse speed: faster breathing = faster pulse
  const pulseSpeed = Math.max(0.5, 3 + (20 - rr) * 0.2);

  // Ring thickness: more coherent = thicker
  const thickness = 2 + coherence * 4;

  // Glow intensity: more coherent = brighter
  const glowIntensity = coherence * 0.4;

  const animName = `bioRingPulse_${name.replace(/\W/g, '')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
         onClick={() => onSelect?.(member)}>
      <div style={{ position: 'relative', width: 105, height: 105 }}>
        {/* Ring */}
        <div style={{
          width: 105, height: 105, borderRadius: '50%',
          border: `${thickness}px solid ${color}`,
          boxShadow: `0 0 ${12 + glowIntensity * 30}px ${color}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')}`,
          animation: `${animName} ${pulseSpeed}s ease-in-out infinite`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isSelected ? `${color}12` : 'transparent',
          transition: 'border-width 0.5s, border-color 0.5s, box-shadow 0.5s',
        }}>
          <span style={{ fontSize: 22, fontWeight: 300, color, fontFamily: 'Outfit, sans-serif' }}>
            {name[0].toUpperCase()}
          </span>
        </div>

        {/* HR badge — top right */}
        <div style={{
          position: 'absolute', top: -2, right: -2,
          background: 'rgba(10,18,32,0.85)', border: '1px solid rgba(224,152,120,0.3)',
          borderRadius: 8, padding: '1px 5px',
          fontSize: 9, fontWeight: 500, color: 'rgba(224,152,120,0.9)',
          fontVariantNumeric: 'tabular-nums', fontFamily: 'Outfit, sans-serif',
        }}>
          {hr}
        </div>

        {/* HRV badge — top left */}
        <div style={{
          position: 'absolute', top: -2, left: -2,
          background: 'rgba(10,18,32,0.85)', border: '1px solid rgba(168,204,232,0.3)',
          borderRadius: 8, padding: '1px 5px',
          fontSize: 9, fontWeight: 500, color: 'rgba(168,204,232,0.9)',
          fontVariantNumeric: 'tabular-nums', fontFamily: 'Outfit, sans-serif',
        }}>
          {hrv}
        </div>
      </div>

      {/* Name */}
      <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(200,210,225,0.7)', fontFamily: 'Outfit, sans-serif' }}>
        {name}
      </span>

      {/* Keyframe injection */}
      <style>{`
        @keyframes ${animName} {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

// ── Detail panel shown below rings when a member is tapped ──
export function BioDetailPanel({ member }) {
  if (!member) return null;

  const { hr = 0, hrv = 0, coherence = 0, rr = 0, ns3 = 0, capacity_state = 'steady' } = member;
  const color = CAP_COLORS[capacity_state] || CAP_COLORS.steady;

  const items = [
    { label: 'HR', value: `${hr} bpm`, color: 'rgba(224,152,120,0.9)' },
    { label: 'HRV', value: `${hrv} ms`, color: 'rgba(168,204,232,0.9)' },
    { label: 'Coherence', value: coherence.toFixed(2), color: 'rgba(92,224,208,0.9)' },
    { label: 'RR', value: `${rr} brpm`, color: 'rgba(200,210,225,0.7)' },
    { label: 'NS3', value: ns3, color: 'rgba(232,190,106,0.9)' },
  ];

  return (
    <div style={{
      display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
      padding: '10px 16px', marginTop: 8,
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}20`,
      borderRadius: 12,
    }}>
      {items.map(it => (
        <div key={it.label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: 1, color: 'rgba(200,210,225,0.4)', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif' }}>
            {it.label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 400, color: it.color, fontVariantNumeric: 'tabular-nums', fontFamily: 'Outfit, sans-serif' }}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
