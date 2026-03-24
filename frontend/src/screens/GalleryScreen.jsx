import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

const MILESTONES = [10, 30, 50, 75, 100, 150];

export default function GalleryScreen() {
  const [gallery, setGallery] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => { loadGallery(); }, []);

  async function loadGallery() {
    try {
      const uid = user?.participant_id || user?.userId;
      const { data } = await api.get(`/api/art/gallery/${uid}`);
      setGallery(data?.gallery || []);
    } catch (err) {
      console.error('[GALLERY] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>Your Healing Gallery</h2>

      {loading && (
        <p style={{ color: 'rgba(160,196,232,0.4)', textAlign: 'center', marginTop: 40, fontFamily: 'Outfit, sans-serif' }}>
          Loading...
        </p>
      )}

      {!loading && gallery.length === 0 && (
        <p style={{ color: 'rgba(160,196,232,0.4)', textAlign: 'center', marginTop: 40, fontFamily: 'Outfit, sans-serif' }}>
          Complete a session to create your first piece.
        </p>
      )}

      <div style={S.grid}>
        {gallery.map((art, i) => {
          const isMilestone = MILESTONES.includes(art.session_number);
          return (
            <div key={i} onClick={() => setExpanded(art)} style={S.thumb}>
              {art.ipfs_hash ? (
                <img
                  src={`https://gateway.pinata.cloud/ipfs/${art.ipfs_hash}`}
                  alt="" style={S.img}
                />
              ) : (
                <div style={{
                  ...S.img,
                  background: 'linear-gradient(135deg, #0a2540, #112d4a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ color: 'rgba(160,196,232,0.3)', fontSize: 12 }}>S{art.session_number}</span>
                </div>
              )}
              {isMilestone && <div style={S.badge} />}
              <span style={S.label}>S{art.session_number}</span>
            </div>
          );
        })}
      </div>

      {/* Expanded view */}
      {expanded && (
        <div style={S.overlay} onClick={() => setExpanded(null)}>
          <div style={S.expandedCard} onClick={e => e.stopPropagation()}>
            <div style={S.artFrame}>
              {expanded.ipfs_hash ? (
                <img
                  src={`https://gateway.pinata.cloud/ipfs/${expanded.ipfs_hash}`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#112d4a', borderRadius: 16 }} />
              )}
            </div>
            <p style={{ color: 'rgba(160,196,232,0.5)', fontSize: 13, marginTop: 12, fontFamily: 'Outfit, sans-serif' }}>
              Session {expanded.session_number}
              {expanded.completed_at && ` — ${new Date(expanded.completed_at).toLocaleDateString()}`}
            </p>
            {expanded.intention && (
              <p style={{ color: '#4fd1c5', fontStyle: 'italic', marginTop: 8, fontFamily: 'Outfit, sans-serif' }}>
                {expanded.intention}
              </p>
            )}
            {MILESTONES.includes(expanded.session_number) && (
              <div style={{
                marginTop: 8, padding: '4px 12px', borderRadius: 20,
                background: 'rgba(240,184,96,0.15)', color: '#f0b860',
                fontSize: 11, display: 'inline-block', fontFamily: 'Outfit, sans-serif'
              }}>
                Milestone
              </div>
            )}
            <button onClick={() => setExpanded(null)} style={S.closeBtn}>Close</button>
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}

const S = {
  container: {
    minHeight: '100vh',
    padding: '24px 16px',
    background: 'linear-gradient(180deg, #020812, #061a2a)'
  },
  title: {
    fontSize: 22, fontWeight: 300, color: '#4fd1c5',
    marginBottom: 20, fontFamily: 'Outfit, sans-serif'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10
  },
  thumb: {
    position: 'relative', aspectRatio: '1',
    borderRadius: 14, overflow: 'hidden',
    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)'
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  badge: {
    position: 'absolute', top: 6, right: 6,
    width: 14, height: 14, borderRadius: '50%',
    background: '#f0b860',
    boxShadow: '0 0 8px rgba(240,184,96,0.6)'
  },
  label: {
    position: 'absolute', bottom: 6, left: 8,
    fontSize: 10, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
    fontFamily: 'Outfit, sans-serif'
  },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 20
  },
  expandedCard: {
    background: '#0a1628', borderRadius: 20,
    padding: 24, maxWidth: 360, width: '100%', textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.06)'
  },
  artFrame: { width: '100%', aspectRatio: '1', borderRadius: 16, overflow: 'hidden' },
  closeBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(160,196,232,0.5)',
    padding: '10px 32px', borderRadius: 12,
    marginTop: 16, cursor: 'pointer', fontSize: 14,
    fontFamily: 'Outfit, sans-serif'
  }
};
