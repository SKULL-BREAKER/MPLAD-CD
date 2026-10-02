'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { set2faCookie } from './actions';

export default function TwoFactorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const [testUrl, setTestUrl] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    // Auto-send OTP when page loads and session is available
    if (status === 'authenticated' && session?.user?.email && !sent) {
      setSent(true);
      fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.user.email })
      })
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
        } else if (d.testUrl) {
          setTestUrl(d.testUrl);
        }
      })
      .catch(err => setError('Failed to communicate with OTP server.'));
    }
  }, [status, session, sent]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.user.email, otp })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Invalid OTP');
        setLoading(false);
        return;
      }
      
      // OTP matched, set secure cookie
      await set2faCookie();
      
      // Redirect to correct dashboard
      const role = session.user.role;
      if (role === 'MP') {
        router.replace('/mp');
      } else {
        router.replace('/authority');
      }
    } catch (err) {
      setError('An error occurred during verification');
      setLoading(false);
    }
  };

  if (status !== 'authenticated') {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading Secure 2FA...</div>;
  }

  return (
    <main style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '80vh', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'var(--surface-2, white)',
        borderRadius: 24, padding: '48px 36px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.1)',
        border: '1px solid rgba(0,0,0,0.05)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 36,
        }}>
          🛡️
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary, #10B981)', margin: '0 0 10px' }}>
          Two-Factor Verification
        </h1>
        <p style={{ color: 'var(--text-muted, #666)', fontSize: '0.9rem', margin: '0 0 32px', lineHeight: 1.5 }}>
          For maximum security, we have sent a 6-digit verification code to <strong>{session.user.email}</strong>.
        </p>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
            borderRadius: 10, padding: '12px', marginBottom: 24, fontSize: '0.85rem',
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input 
            type="text" 
            placeholder="Enter 6-digit code" 
            value={otp}
            onChange={e => setOtp(e.target.value)}
            maxLength={6}
            required
            style={{
              padding: '14px', borderRadius: 12, border: '1.5px solid #E5E7EB',
              fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px',
              outline: 'none', fontWeight: 600
            }}
          />
          <button type="submit" disabled={loading || otp.length < 6} style={{
            padding: '14px', borderRadius: 12, border: 'none',
            background: (loading || otp.length < 6) ? '#D1D5DB' : '#10B981',
            color: 'white', fontWeight: 700, fontSize: '1rem',
            cursor: (loading || otp.length < 6) ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}>
            {loading ? 'Verifying...' : 'Verify & Enter Portal'}
          </button>
        </form>

        {testUrl && (
          <div style={{ marginTop: 24, padding: 16, background: '#FEF3C7', borderRadius: 12, border: '1px solid #FDE68A', textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', color: '#92400E', fontWeight: 800, marginBottom: 8 }}>
              🛠️ Local Dev Mode (No SMTP Configured)
            </div>
            <p style={{ fontSize: '0.75rem', color: '#B45309', marginBottom: 12, lineHeight: 1.4 }}>
              Because your <strong>.env.local</strong> does not have a real Gmail App Password configured for <code>SMTP_USER</code> and <code>SMTP_PASS</code>, the system securely caught the email before it was sent and generated a preview link instead!
            </p>
            <a href={testUrl} target="_blank" rel="noreferrer" style={{ 
              display: 'block', background: '#D97706', color: 'white', padding: '8px 12px', 
              borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', textAlign: 'center' 
            }}>
              Click Here to View the OTP Email Preview
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
