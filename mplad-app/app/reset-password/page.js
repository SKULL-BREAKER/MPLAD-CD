'use client';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage({ searchParams }) {
  const router = useRouter();
  const resolvedParams = searchParams ? use(searchParams) : {};
  const initialEmail = resolvedParams?.email || '';
  const testUrl = resolvedParams?.testUrl || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword: password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
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
        }}>🔑</div>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary, #10B981)', margin: '0 0 6px', textAlign: 'center' }}>
          Reset Password
        </h1>
        <p style={{ color: 'var(--text-muted, #666)', fontSize: '0.85rem', margin: '0 0 32px', lineHeight: 1.5, textAlign: 'center' }}>
          Enter the 6-digit code sent to your email and choose a new password.
        </p>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
            borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: '0.85rem', textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}
        
        {success && (
          <div style={{
            background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46',
            borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: '0.85rem', textAlign: 'center',
          }}>
            ✅ Password reset successfully! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Verification Code (OTP)
            </label>
            <input
              type="text"
              className="login-input"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              placeholder="123456"
              maxLength={6}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              New Password
            </label>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || success}
            className="login-btn"
            style={{
              width: '100%', padding: '14px', marginTop: 4,
              background: (loading || success) ? '#9CA3AF' : 'linear-gradient(135deg, #10B981, #059669)',
              color: 'white', border: 'none', borderRadius: 12,
              cursor: (loading || success) ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '1rem', letterSpacing: '0.3px',
            }}
          >
            {loading ? 'Updating…' : 'Reset Password'}
          </button>
        </form>
        
        {testUrl && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#92400E',
            padding: '16px', borderRadius: '12px', marginTop: 24, fontSize: '0.8rem', lineHeight: 1.5
          }}>
            <strong>🛠 Local Dev Mode</strong><br/>
            Because you are not using a real SMTP server, the email was caught locally. <br/>
            <a href={testUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#D97746', fontWeight: 600, textDecoration: 'underline', marginTop: 8, display: 'inline-block' }}>
              Click Here to View the OTP Email Preview
            </a>
          </div>
        )}
        
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.85rem' }}>
          <Link href="/login" style={{ color: 'var(--text-muted, #666)', textDecoration: 'none', fontWeight: 500 }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
