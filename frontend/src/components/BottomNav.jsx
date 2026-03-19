import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/app/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { path: '/app/gallery', label: 'Gallery', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { path: '/app/family', label: 'Family', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { path: '/app/profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }
];

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#0a1628', borderTop: '1px solid #1a2a3a',
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 0 env(safe-area-inset-bottom, 8px)', zIndex: 100
    }}>
      {tabs.map(t => {
        const active = loc.pathname === t.path || (t.path === '/app/' && loc.pathname === '/app');
        return (
          <button key={t.path} onClick={() => nav(t.path)} style={{
            background: 'none', border: 'none', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '2px', padding: '8px 16px', cursor: 'pointer',
            color: active ? '#5ffce0' : '#556677', minWidth: '64px'
          }}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
