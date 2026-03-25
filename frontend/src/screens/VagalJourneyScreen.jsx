import { useState, useEffect } from 'react';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════
// VagalJourneyScreen — Post-Session Vagal Journey Map
// HOS zones ONLY: Regulated, Settling, Activated, Protected
// No numbers. Visual position tells the story.
// ═══════════════════════════════════════════════════════════════

const ZONES = [
  { label: 'Regulated',  color: '#5CE0D0', bg: 'rgba(92,224,208,0.15)',  range: [71, 100] },
  { label: 'Settling',   color: '#A8CCE8', bg: 'rgba(168,204,232,0.12)', range: [41, 70]  },
  { label: 'Activated',  color: '#E8BE6A', bg: 'rgba(232,190,106,0.12)', range: [25, 40]  },
  { label: 'Protected',  color: '#D88AA0', bg: 'rgba(216,138,160,0.12)', range: [0, 24]   },
];

function ns3ToPosition(ns3) {
  // Map NS3 score (0-100) to vertical position (0=top, 1=bottom)
  if (ns3 === null || ns3 === undefined) return 0.5;
  return 1 - Math.max(0, Math.min(1, ns3 / 100));
}

function getZoneForNs3(ns3) {
  if (ns3 === null) return null;
  if (ns3 >= 71) return ZONES[0];
  if (ns3 >= 41) return ZONES[1];
  if (ns3 >= 25) return ZONES[2];
  return ZONES[3];
}

// ─── Journey Map (single session) ───
function JourneyMap({ arrivalNs3, landingNs3, character = 'luno' }) {
  const arrPos = ns3ToPosition(arrivalNs3);
  const landPos = ns3ToPosition(landingNs3);
  const arrZone = getZoneForNs3(arrivalNs3);
  const landZone = getZoneForNs3(landingNs3);
  const barHeight = 320;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 340, margin: '0 auto' }}>
      {/* 4-zone vertical bar */}
      <div style={{ position: 'relative', height: barHeight, borderRadius: 12, overflow: 'hidden', background: 'rgba(14,28,50,0.4)', border: '1px solid rgba(160,180,210,0.08)' }}>
        {ZONES.map((zone, i) => {
          const top = (1 - zone.range[1] / 100) * 100;
          const height = ((zone.range[1] - zone.range[0] + 1) / 100) * 100;
          return (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0,
              top: `${top}%`, height: `${height}%`,
              background: zone.bg,
              borderBottom: i < 3 ? '1px solid rgba(160,180,210,0.06)' : 'none',
              display: 'flex', alignItems: 'center', paddingLeft: 12,
            }}>
              <span style={{ fontSize: 10, fontWeight: 300, color: zone.color, opacity: 0.7, letterSpacing: 1, fontFamily: 'Outfit, sans-serif' }}>
                {zone.label}
              </span>
            </div>
          );
        })}

        {/* Connecting line */}
        {arrivalNs3 !== null && landingNs3 !== null && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <line
              x1="70%" y1={`${arrPos * 100}%`}
              x2="70%" y2={`${landPos * 100}%`}
              stroke={character === 'luno' ? 'rgba(92,224,210,0.3)' : 'rgba(220,150,170,0.3)'}
              strokeWidth="2" strokeDasharray="4,4"
            />
          </svg>
        )}

        {/* Arrival dot */}
        {arrivalNs3 !== null && (
          <div style={{
            position: 'absolute', right: '25%', top: `${arrPos * 100}%`,
            transform: 'translate(50%, -50%)',
            width: 14, height: 14, borderRadius: '50%',
            background: arrZone?.color || '#A8CCE8',
            boxShadow: `0 0 10px ${arrZone?.color || '#A8CCE8'}40`,
            border: '2px solid rgba(255,255,255,0.3)',
          }} />
        )}

        {/* Landing dot */}
        {landingNs3 !== null && (
          <div style={{
            position: 'absolute', right: '25%', top: `${landPos * 100}%`,
            transform: 'translate(50%, -50%)',
            width: 18, height: 18, borderRadius: '50%',
            background: landZone?.color || '#5CE0D0',
            boxShadow: `0 0 14px ${landZone?.color || '#5CE0D0'}55`,
            border: '2px solid rgba(255,255,255,0.5)',
          }} />
        )}
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '0 4px' }}>
        <div style={{ fontSize: 10, color: 'rgba(160,180,210,0.4)', fontFamily: 'Outfit, sans-serif' }}>
          {arrivalNs3 !== null ? `Arrived: ${arrZone?.label}` : ''}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(160,180,210,0.4)', fontFamily: 'Outfit, sans-serif' }}>
          {landingNs3 !== null ? `Landed: ${landZone?.label}` : ''}
        </div>
      </div>
    </div>
  );
}

// ─── 30-Day Pattern View ───
function PatternView({ data, character = 'luno' }) {
  if (!data || !data.sufficient) return null;

  const entries = data.entries || [];
  const isL = character === 'luno';
  const dotColor = isL ? '#5CE0D0' : '#f4b4c4';
  const lineColor = isL ? 'rgba(92,224,210,0.3)' : 'rgba(220,150,170,0.3)';

  // Trend message
  let trendText = '';
  if (data.trend_direction === 'improving') {
    trendText = "Your arrival point is moving up. You used to arrive activated. Now you arrive settling.";
  } else if (data.trend_direction === 'stable') {
    trendText = "Your system is holding steady. Consistency is building something.";
  } else if (data.trend_direction === 'declining') {
    trendText = "Your body is working harder lately. That's information, not failure.";
  }

  const validEntries = entries.filter(e => e.arrival_ns3 !== null);
  const svgW = 280, svgH = 120;

  return (
    <div style={{ marginTop: 28 }}>
      <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, color: 'rgba(160,180,210,0.4)', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>
        30-Day Pattern
      </p>

      {/* Dot chart */}
      {validEntries.length > 0 && (
        <div style={{ background: 'rgba(14,28,50,0.35)', borderRadius: 12, padding: '16px 12px', border: '1px solid rgba(160,180,210,0.06)', marginBottom: 14 }}>
          <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
            {/* Zone backgrounds */}
            {ZONES.map((zone, i) => {
              const y = (1 - zone.range[1] / 100) * svgH;
              const h = ((zone.range[1] - zone.range[0] + 1) / 100) * svgH;
              return <rect key={i} x={0} y={y} width={svgW} height={h} fill={zone.bg} />;
            })}

            {/* Connecting line */}
            {validEntries.length > 1 && (
              <polyline
                points={validEntries.map((e, i) => {
                  const x = (i / (validEntries.length - 1)) * (svgW - 20) + 10;
                  const y = (1 - e.arrival_ns3 / 100) * svgH;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none" stroke={lineColor} strokeWidth="1.5"
              />
            )}

            {/* Dots */}
            {validEntries.map((e, i) => {
              const x = validEntries.length === 1 ? svgW / 2 : (i / (validEntries.length - 1)) * (svgW - 20) + 10;
              const y = (1 - e.arrival_ns3 / 100) * svgH;
              return <circle key={i} cx={x} cy={y} r={3} fill={dotColor} opacity={0.7} />;
            })}
          </svg>
        </div>
      )}

      {/* Trend text */}
      {trendText && (
        <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(210,220,235,0.65)', lineHeight: 1.8, fontFamily: 'Outfit, sans-serif', fontStyle: 'italic' }}>
          {trendText}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════

export default function VagalJourneyScreen({ sessionId, character = 'luno', onContinue }) {
  const [journey, setJourney] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const isL = character === 'luno';

  useEffect(() => {
    async function load() {
      // Load journey for this session
      if (sessionId) {
        try {
          const res = await api.get(`/api/user/vagal-journey/${sessionId}`);
          setJourney(res.data);
        } catch {}
      }

      // Load 30-day pattern
      try {
        const res = await api.get('/api/user/vagal-pattern');
        setPattern(res.data);
      } catch {}

      setLoaded(true);
    }
    load();
  }, [sessionId]);

  if (!loaded) return null;

  // Skip if no data at all
  if (!journey && !pattern?.sufficient) {
    if (onContinue) onContinue();
    return null;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: isL
        ? 'linear-gradient(180deg, #020812, #061a2a, #0a1628)'
        : 'linear-gradient(180deg, #0f0610, #1a0c16, #120818)',
      fontFamily: "'Outfit', -apple-system, sans-serif", color: '#fff',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{ padding: '48px 24px 100px', maxWidth: 400, margin: '0 auto' }}>
        {/* Title */}
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2.5, color: 'rgba(160,180,210,0.35)', textTransform: 'uppercase', marginBottom: 24 }}>
          Your Journey
        </p>

        {/* Journey map */}
        {journey && journey.arrival_ns3 !== null && (
          <>
            <JourneyMap
              arrivalNs3={journey.arrival_ns3}
              landingNs3={journey.landing_ns3}
              character={character}
            />

            {/* Journey text — no numbers */}
            <p style={{
              fontSize: 14, fontWeight: 200, color: 'rgba(210,220,235,0.7)',
              lineHeight: 1.9, marginTop: 20, textAlign: 'center',
              fontFamily: 'Outfit, sans-serif',
            }}>
              {journey.journey_distance !== null && journey.journey_distance > 0
                ? "You arrived here. Your breath brought you here. That's the distance your system traveled today."
                : journey.journey_distance === 0
                  ? "Your system held steady throughout. Consistency is its own kind of strength."
                  : "Your body is working through something. That's not failure — it's the process."
              }
            </p>
          </>
        )}

        {/* 30-day pattern */}
        <PatternView data={pattern} character={character} />

        {/* Continue */}
        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <div
            onClick={onContinue}
            style={{
              display: 'inline-block', padding: '12px 40px',
              background: isL ? 'rgba(78,205,196,0.06)' : 'rgba(210,140,160,0.06)',
              border: `1px solid ${isL ? 'rgba(78,205,196,0.16)' : 'rgba(210,140,160,0.16)'}`,
              borderRadius: 24, fontSize: 13, fontWeight: 400, letterSpacing: 1.5,
              color: isL ? 'rgba(92,224,210,0.7)' : 'rgba(220,150,170,0.7)',
              cursor: 'pointer',
            }}
          >
            Continue
          </div>
        </div>
      </div>
    </div>
  );
}
