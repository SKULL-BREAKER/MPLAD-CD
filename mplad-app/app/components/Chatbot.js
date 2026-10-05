'use client';
import { useState, useRef, useEffect } from 'react';

// Lightweight markdown renderer (no external deps)
function renderMarkdown(text) {
  if (!text) return '';
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.07);padding:1px 5px;border-radius:4px;font-size:0.85em">$1</code>')
    // Tables
    .replace(/\|(.+)\|/g, (line) => {
      if (line.includes('---')) return '';
      const cells = line.split('|').filter(Boolean).map(c => `<td style="padding:4px 8px;border:1px solid rgba(0,0,0,0.1)">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    // Wrap consecutive tr in table
    .replace(/(<tr>.*<\/tr>\n?)+/gs, m => `<table style="border-collapse:collapse;width:100%;font-size:0.82rem;margin:6px 0">${m}</table>`)
    // Bullet points
    .replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul style="margin:4px 0 4px 16px;padding:0">${m}</ul>`)
    // Headings
    .replace(/^### (.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:0.9rem">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:8px 0 4px;font-size:0.95rem">$1</h3>')
    // Italic
    .replace(/\_(.+?)\_/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

const SUGGESTIONS = {
  officer: [
    'Show overview statistics',
    'Top 5 highest value works',
    'Show high risk works',
    'District-wise summary',
  ],
  public: [
    'What is MPLADS?',
    'Show scheme statistics',
    'SC/ST works',
    'District summary',
  ],
};

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '8px 4px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--accent, #4F46E5)',
          animation: `ludoBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          display: 'inline-block',
        }} />
      ))}
    </div>
  );
}

export default function Chatbot({ role }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: `👋 Hello! I am **LUDO**, the official AI Monitor for MPLADS.\n\nI have live access to all project data. You can ask me about works, budgets, districts, ${role === 'officer' ? 'risk reports, anomalies, ' : ''}and scheme guidelines.\n\n_${role === 'officer' ? '🔐 Officer mode — full access enabled.' : '🌐 Public mode — general information.'}_`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setShowSuggestions(false);
    setMessages(prev => [...prev, { sender: 'user', text: msg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, role }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { sender: 'bot', text: data.reply || 'No response.' }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'bot', text: '⚠️ Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const accentColor = role === 'officer' ? '#4F46E5' : '#10B981';

  return (
    <>
      <style>{`
        @keyframes ludoBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        .ludo-fab { transition: transform 0.2s, box-shadow 0.2s; }
        .ludo-fab:hover { transform: scale(1.08); box-shadow: 0 8px 24px rgba(0,0,0,0.35) !important; }
        .ludo-fab:active { transform: scale(0.95); }
        .ludo-suggestion { transition: all 0.15s; border: 1px solid rgba(0,0,0,0.1); }
        .ludo-suggestion:hover { background: ${accentColor} !important; color: white !important; border-color: transparent; transform: translateY(-1px); }
        .ludo-msg-user { animation: msgIn 0.2s ease-out; }
        .ludo-msg-bot { animation: msgIn 0.2s ease-out; }
        @keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .ludo-input:focus { border-color: ${accentColor} !important; box-shadow: 0 0 0 3px ${accentColor}22 !important; }
        .ludo-send:hover:not(:disabled) { opacity: 0.88; transform: scale(1.03); }
        .ludo-send { transition: all 0.15s; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: none; } }
        .chatbot-window {
          position: fixed;
          bottom: 100px;
          right: 24px;
          width: 380px;
          max-width: calc(100vw - 48px);
          height: 600px;
          max-height: calc(100vh - 120px);
          background: white;
          border-radius: 20px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 10000;
          border: 1px solid rgba(0,0,0,0.1);
        }
      `}</style>

      {/* FAB */}
      <button
        className="ludo-fab"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Open LUDO AI Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 60, height: 60, borderRadius: '50%',
          backgroundColor: accentColor, border: 'none',
          boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
          cursor: 'pointer', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {isOpen
          ? <span style={{ color: 'white', fontSize: 22, fontWeight: 700 }}>✕</span>
          : <img src="/ludo_logo.png" alt="LUDO AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="color:white;font-weight:700;font-size:15px">AI</span>'; }} />
        }
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="chatbot-window" style={{ animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>

          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            color: 'white', padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/ludo_logo.png" alt="LUDO" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }}
                onError={e => { e.target.style.display = 'none'; }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1 }}>LUDO AI</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.85, marginTop: 2 }}>
                  {loading ? '⚡ Thinking...' : '🟢 Online — Live Data'}
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)',
              padding: '3px 8px', borderRadius: 10, fontWeight: 600, letterSpacing: '0.03em',
            }}>
              {role === 'officer' ? '🔐 OFFICER' : '🌐 PUBLIC'}
            </span>
          </div>

          {/* Messages */}
          <div className="chatbot-messages" style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-1, #f8f9fa)' }}>
            {messages.map((msg, i) => (
              <div key={i} className={msg.sender === 'user' ? 'ludo-msg-user' : 'ludo-msg-bot'}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  background: msg.sender === 'user' ? accentColor : 'white',
                  color: msg.sender === 'user' ? 'white' : 'var(--text-main, #1a1a1a)',
                  padding: '10px 13px',
                  borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: '0.865rem', lineHeight: 1.5,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: msg.sender === 'bot' ? '1px solid rgba(0,0,0,0.07)' : 'none',
                  overflowX: 'auto',
                }}
              >
                {msg.sender === 'bot'
                  ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                  : msg.text
                }
              </div>
            ))}

            {/* Suggestions after welcome */}
            {showSuggestions && messages.length === 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {(SUGGESTIONS[role] || SUGGESTIONS.public).map(s => (
                  <button key={s} className="ludo-suggestion" onClick={() => send(s)}
                    style={{
                      background: 'white', border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 20, padding: '5px 12px', fontSize: '0.78rem',
                      cursor: 'pointer', color: 'var(--text-main, #333)', fontWeight: 500,
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div style={{
                alignSelf: 'flex-start', background: 'white', border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: '16px 16px 16px 4px', padding: '4px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                <TypingDots />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); send(); }}
            style={{
              display: 'flex', gap: 8, padding: '10px 12px',
              borderTop: '1px solid rgba(0,0,0,0.07)',
              background: 'var(--surface-2, #ffffff)', flexShrink: 0,
            }}>
            <input
              ref={inputRef}
              className="ludo-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about a project, district, or rule…"
              disabled={loading}
              style={{
                flex: 1, padding: '9px 14px', borderRadius: 12,
                border: '1.5px solid rgba(0,0,0,0.12)',
                background: 'var(--surface-1, #f8f9fa)',
                color: 'var(--text-main, #1a1a1a)',
                fontSize: '0.88rem', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
            <button type="submit" className="ludo-send" disabled={loading || !input.trim()}
              style={{
                padding: '9px 16px', borderRadius: 12, border: 'none',
                background: accentColor, color: 'white',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                opacity: (loading || !input.trim()) ? 0.55 : 1,
                whiteSpace: 'nowrap',
              }}>
              Send ↑
            </button>
          </form>
        </div>
      )}
    </>
  );
}
