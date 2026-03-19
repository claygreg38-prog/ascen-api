import { useState, useEffect } from 'react';
import { getUser } from '../services/auth';
import api from '../services/api';

const IPFS_GW = 'https://gateway.pinata.cloud/ipfs/';

export default function ShowcaseScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);
  const user = getUser();
  const userId = user?.participant_id || user?.userId;

  useEffect(() => { loadFeed(); }, []);

  async function loadFeed() {
    try {
      const { data } = await api.get('/api/showcase');
      setPosts(data?.posts || data || []);
    } catch {}
    setLoading(false);
  }

  async function toggleLike(postId) {
    try {
      const { data } = await api.post(`/api/showcase/like/${postId}`);
      setPosts(prev => prev.map(p =>
        p.post_id === postId ? { ...p, like_count: data.like_count ?? (p.liked ? p.like_count - 1 : p.like_count + 1), liked: !p.liked } : p
      ));
    } catch {}
  }

  const displayed = mineOnly ? posts.filter(p => p.user_id === userId || p.participant_id === userId) : posts;

  return (
    <div style={S.container}>
      <h2 style={S.title}>Showcase</h2>
      <p style={S.sub}>Art made by real people doing real work.</p>

      <div style={S.filterRow}>
        <button onClick={() => setMineOnly(false)} style={{ ...S.filterBtn, ...(mineOnly ? {} : S.filterActive) }}>All</button>
        <button onClick={() => setMineOnly(true)} style={{ ...S.filterBtn, ...(!mineOnly ? {} : S.filterActive) }}>Mine</button>
      </div>

      {loading && <p style={S.dim}>Loading...</p>}

      {displayed.map(p => (
        <div key={p.post_id} style={S.card}>
          {p.ipfs_hash && (
            <img src={`${IPFS_GW}${p.ipfs_hash}`} alt="Art" style={S.artImg} />
          )}
          <div style={S.cardBody}>
            <p style={S.authorName}>{p.display_name || p.first_name || 'Someone'}</p>
            {p.caption && <p style={S.caption}>{p.caption}</p>}
            <div style={S.actionRow}>
              <button onClick={() => toggleLike(p.post_id)} style={S.heartBtn}>
                <span style={{ color: p.liked ? '#ff6b6b' : '#556677', fontSize: '20px' }}>{p.liked ? '\u2764' : '\u2661'}</span>
              </button>
              <span style={S.likeCount}>{p.like_count || 0}</span>
            </div>
          </div>
        </div>
      ))}

      {!loading && displayed.length === 0 && (
        <p style={{ ...S.dim, marginTop: '40px', textAlign: 'center' }}>
          {mineOnly ? 'You have not shared any art yet.' : 'No art to show yet. Be the first!'}
        </p>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

const S = {
  container: { padding: '24px', minHeight: '100vh', background: '#061a2a', color: '#e0e0e0', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 600, color: '#5ffce0', marginBottom: '4px' },
  sub: { color: '#8899aa', marginBottom: '16px', fontSize: '15px' },
  dim: { color: '#8899aa', fontSize: '14px' },
  filterRow: { display: 'flex', gap: '8px', marginBottom: '20px' },
  filterBtn: { padding: '8px 20px', borderRadius: '20px', border: '1px solid #1a3a5c', background: 'transparent', color: '#8899aa', fontSize: '14px', cursor: 'pointer' },
  filterActive: { background: '#1a7a6d', color: '#fff', borderColor: '#1a7a6d' },
  card: { background: '#0a2540', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' },
  artImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  cardBody: { padding: '16px' },
  authorName: { color: '#e0e0e0', fontWeight: 600, fontSize: '15px', margin: '0 0 4px 0' },
  caption: { color: '#aabbcc', fontSize: '14px', lineHeight: '1.4', margin: '0 0 12px 0' },
  actionRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  heartBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '8px', lineHeight: 1 },
  likeCount: { color: '#8899aa', fontSize: '14px' },
};
