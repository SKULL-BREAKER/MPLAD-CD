'use client';
import { useState, useRef, useEffect } from 'react';

export default function Chatbot({ role }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: `Hello! I am the MPLADS AI Assistant (${role} mode). Ask me about projects.` }
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
          fontSize: '24px'
        }}
      >
        {isOpen ? '' : ''}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '350px',
          height: '500px',
          backgroundColor: '#1E293B',
          border: '1px solid #334155',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            backgroundColor: role === 'officer' ? '#3730A3' : '#047857',
            color: 'white',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>MPLADS AI {role === 'officer' ? '(Secure)' : '(Public)'}</span>
            <span style={{ fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '12px' }}>
              {role === 'officer' ? 'Full Access' : 'Read Only'}
            </span>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {messages.map((msg, index) => (
              <div key={index} style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.sender === 'user' ? '#3B82F6' : '#334155',
                color: 'white',
                padding: '10px 14px',
                borderRadius: '12px',
                maxWidth: '85%',
                fontSize: '0.9rem',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap'
              }}>
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
          <form onSubmit={handleSend} style={{
            display: 'flex',
            padding: '12px',
            borderTop: '1px solid #334155',
            backgroundColor: '#0F172A'
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a project (e.g. status of work 1)..."
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#1E293B',
                color: 'white',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                marginLeft: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: role === 'officer' ? '#4F46E5' : '#10B981',
                color: 'white',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
