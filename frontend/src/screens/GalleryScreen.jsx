import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

export default function GalleryScreen() {
  const [gallery, setGallery] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const user = getUser();

  useEffect(() => { loadGallery(); }, []);

  async function loadGallery() {
    try {
      const { data } = await api.get(`/api/art/gallery/${user?.participant_id || user?.userId}`);
      setGallery(data?.gallery || []);
    } catch {}
  }

  return (
    <div style={S.container}>
      <h2 style={S.title}>Your Healing Gallery</h2>

      {gallery.length === 0 && (
        <p style={{ color: '#556677', textAlign: 'center', marginTop: '40px' }}>
          Complete a session to create your first piece.
        </p>
      )}

      <div style={S.grid}>
        {gallery.map((art, i) => {
          const isMilestone = [10, 30, 50, 75, 100].includes(art.session_number);
          return (
            <div key={i} onClick={() => setExpanded(art)} style={S.thumb}>
              {art.ipfs_hash
                ? <img src={`https://gateway.pinata.cloud/ipfs/${art.ipfs_hash}`} alt="" style={S.img} />
                : <div style={{ ...S.img, background: '#112d4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#334455', fontSize: '12px' }}>S{art.session_number}</span>
                  </div>
              }
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
              {expanded.ipfs_hash
                ? <img src={`https://gateway.pinata.cloud/ipfs/${expanded.ipfs_hash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} />
                : <div style={{ width: '100%', height: '100%', background: '#112d4a', borderRadius: '16px' }} />
              }
            </div>
            <p style={{ color: '#8899aa', fontSize: '13px', marginTop: '12px' }}>
              Session {expanded.session_number} {expanded.completed_at ? '— ' + new Date(expanded.completed_at).toLocaleDateString() : ''}
            </p>
            {expanded.intention && <p style={{ color: '#5ffce0', fontStyle: 'italic', marginTop: '8px' }}>{expanded.intention}</p>}
            <button onClick={() => setExpanded(null)} style={S.closeBtn}>Close</button>
          </div>
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', padding: '24px 16px', background: '#061a2a' },
  title: { fontSize: '22px', fontWeight: 300, color: '#5ffce0', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  thumb: { position: 'relative', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #1a2a3a' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  badge: { position: 'absolute', top: '4px', right: '4px', width: '12px', height: '12px', borderRadius: '50%', background: '#f0b860', boxShadow: '0 0 6px #f0b860' },
  label: { position: 'absolute', bottom: '4px', left: '6px', fontSize: '10px', color: '#fff', textShadow: '0 1px 3px #000' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
  expandedCard: { background: '#0a2540', borderRadius: '20px', padding: '24px', maxWidth: '360px', width: '100%', textAlign: 'center' },
  artFrame: { width: '100%', aspectRatio: '1', borderRadius: '16px', overflow: 'hidden' },
  closeBtn: { background: 'transparent', border: '1px solid #1a3a5a', color: '#556677', padding: '10px 32px', borderRadius: '12px', marginTop: '16px', cursor: 'pointer', fontSize: '14px' }
};
