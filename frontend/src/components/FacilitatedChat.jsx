import { useState, useEffect } from 'react';
import api from '../services/api';
import { getUser } from '../services/auth';

export default function FacilitatedChat({ familyUnitId, channelType = 'parent_child' }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [coaching, setCoaching] = useState(null);
  const [sending, setSending] = useState(false);
  const user = getUser();

  useEffect(() => { loadMessages(); }, [channelType]);

  async function loadMessages() {
    try {
      const { data } = await api.get(`/api/premium/messages/${channelType}?family_unit_id=${familyUnitId}`);
      setMessages(data.messages || []);
    } catch {}
  }

  async function send() {
    if (!text.trim() || !recipientId) return;
    setSending(true);
    try {
      const { data } = await api.post('/api/premium/message/send', {
        recipient_id: parseInt(recipientId), message_text: text,
        channel_type: channelType, family_unit_id: familyUnitId
      });
      if (data.decision === 'coach') {
        setCoaching(data);
      } else if (data.disclosure === 'abuse_recipient') {
        setCoaching({ senderMessage: data.senderMessage, isDisclosure: true });
      } else {
        setText(''); loadMessages();
      }
    } catch {}
    setSending(false);
  }

  async function sendOriginal() {
    if (!coaching?.messageId) return;
    try {
      await api.post('/api/premium/message/respond-to-coaching', {
        message_id: coaching.messageId, accepted: false
      });
      setCoaching(null); setText(''); loadMessages();
    } catch {}
  }

  return (
    <div>
      <div style={S.thread}>
        {messages.length === 0 && <p style={S.dim}>No messages yet</p>}
        {messages.map((m, i) => (
          <div key={i} style={{ ...S.msg, alignSelf: m.sender_id === user?.id ? 'flex-end' : 'flex-start' }}>
            <p style={S.sender}>{m.sender_name || m.sender_type}</p>
            <p style={S.text}>{m.final_text}</p>
            {m.recipient_coaching && <p style={S.coachNote}>{m.recipient_coaching}</p>}
            <span style={S.time}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>

      {coaching && (
        <div style={S.coachCard}>
          {coaching.isDisclosure ? (
            <p style={{ color: '#5ffce0' }}>{coaching.senderMessage}</p>
          ) : (<>
            <p style={S.coachTitle}>Coaching suggestion</p>
            <p style={S.coachText}>{coaching.coachingText}</p>
            {coaching.reframeSuggestion && <p style={S.reframe}>Try: "{coaching.reframeSuggestion}"</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => setCoaching(null)} style={S.btnSm}>Edit</button>
              <button onClick={sendOriginal} style={S.btnSmSec}>Send as written</button>
            </div>
          </>)}
        </div>
      )}

      <div style={S.compose}>
        <input value={recipientId} onChange={e => setRecipientId(e.target.value)}
          placeholder="To (ID)" style={{ ...S.input, maxWidth: '80px' }} />
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="Write a message..." style={S.input} maxLength={500} />
        <button onClick={send} disabled={sending} style={S.sendBtn}>
          {sending ? '...' : 'Send'}
        </button>
      </div>
      <p style={{ fontSize: '11px', color: '#334455', textAlign: 'right' }}>{text.length}/500</p>
    </div>
  );
}

const S = {
  thread: { maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' },
  msg: { background: '#112d4a', borderRadius: '12px', padding: '10px 14px', maxWidth: '80%' },
  sender: { fontSize: '11px', color: '#5ffce0', marginBottom: '2px' },
  text: { fontSize: '14px', lineHeight: 1.4 },
  time: { fontSize: '10px', color: '#445566' },
  coachNote: { fontSize: '12px', color: '#5ffce0', fontStyle: 'italic', marginTop: '4px' },
  coachCard: { background: '#1a1a3a', border: '1px solid #5ffce040', borderRadius: '12px', padding: '14px', marginBottom: '8px' },
  coachTitle: { fontSize: '12px', color: '#f0b860', marginBottom: '4px' },
  coachText: { fontSize: '13px', color: '#ccc' },
  reframe: { fontSize: '13px', color: '#5ffce0', fontStyle: 'italic', marginTop: '6px' },
  compose: { display: 'flex', gap: '6px' },
  input: { flex: 1, background: '#112d4a', border: '1px solid #1a3a5a', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '14px', outline: 'none' },
  sendBtn: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' },
  btnSm: { background: '#1a7a6d', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  btnSmSec: { background: 'transparent', color: '#5ffce0', border: '1px solid #1a3a5a', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  dim: { color: '#556677', textAlign: 'center' }
};
