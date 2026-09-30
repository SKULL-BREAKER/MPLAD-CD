'use client';
import { useState, useRef, useEffect } from 'react';

export default function Chatbot({ role }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: `Hello! I am LUDO, your AI Assistant (${role} mode). Ask me about projects.` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.text, role }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { sender: 'bot', text: data.reply }]);
    } catch (error) {
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Sorry, I encountered an error connecting to the AI engine.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: role === 'officer' ? '#4F46E5' : '#10B981',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden'
        }}
      >
        {isOpen ? '' : <img src="/ludo_logo.png" alt="LUDO AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header" style={{
            backgroundColor: role === 'officer' ? '#4F46E5' : 'var(--accent)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/ludo_logo.png" alt="LUDO" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
              <span>LUDO AI {role === 'officer' ? '(Secure)' : '(Public)'}</span>
            </div>
            <span style={{ fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '12px' }}>
              {role === 'officer' ? 'Full Access' : 'Read Only'}
            </span>
          </div>

          {/* Messages Area */}
          <div className="chatbot-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chatbot-bubble ${msg.sender === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: '#94A3B8', fontSize: '0.85rem' }}>
                AI is analyzing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="chatbot-input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a project (e.g. status of work 1)..."
              className="chatbot-input"
            />
            <button
              type="submit"
              disabled={loading}
              className="chatbot-submit"
              style={{ backgroundColor: role === 'officer' ? '#4F46E5' : 'var(--accent)' }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
