'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testUrl, setTestUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        setLoading(false);
      } else {
        if (data.testUrl) {
          // Pass it via query string (dev only)
          router.push(`/reset-password?email=${encodeURIComponent(email)}&testUrl=${encodeURIComponent(data.testUrl)}`);
        } else {
          router.push(`/reset-password?email=${encodeURIComponent(email)}`);
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '80vh', padding: '24px',
    }}>
      <style>{`
        .login-input {
          width: 100%; padding: 12px 14px; border: 1.5px solid #E5E7EB;
          borderRadius: 10px; fontSize: 0.95rem; outline: none;
          transition: border-color 0.2s; background: #FAFAFA; boxSizing: border-box;
        }
        .login-input:focus { border-color: #10B981; background: white; }
        .login-btn { transition: all 0.2s; }
        .login-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16,185,129,0.35); }
        .login-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--surface-2, white)',
        borderRadius: 24, padding: '48px 36px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.1)',
        border: '1px solid rgba(0,0,0,0.05)',
      }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 36,
        }}>🔒</div>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary, #10B981)', margin: '0 0 6px', textAlign: 'center' }}>
          Forgot Password
        </h1>
        <p style={{ color: 'var(--text-muted, #666)', fontSize: '0.85rem', margin: '0 0 32px', lineHeight: 1.5, textAlign: 'center' }}>
          Enter your registered email and we will send you a one-time code to reset your password.
        </p>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
            borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: '0.85rem', textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              className="login-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.gov.in"
              required
            />
          </div>
          
          <button
            id="forgot-submit"
            type="submit"
            disabled={loading}
            className="login-btn"
            style={{
              width: '100%', padding: '14px', marginTop: 4,
              background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #10B981, #059669)',
              color: 'white', border: 'none', borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '1rem', letterSpacing: '0.3px',
            }}
          >
            {loading ? 'Sending code…' : 'Send Reset Code'}
          </button>
        </form>
        
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.85rem' }}>
          <Link href="/login" style={{ color: 'var(--text-muted, #666)', textDecoration: 'none', fontWeight: 500 }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
