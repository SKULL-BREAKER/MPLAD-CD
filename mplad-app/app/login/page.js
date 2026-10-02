'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testUrl, setTestUrl] = useState(null);
  const router = useRouter();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid official email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.testUrl) setTestUrl(data.testUrl);
        setStep(2);
      } else {
        setError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setError('Network error connecting to email service.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First, verify the OTP with the global verifier
      const verifyRes = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const verifyData = await verifyRes.json();
      
      if (!verifyRes.ok) {
        setError(verifyData.error || 'Invalid OTP.');
        setLoading(false);
        return;
      }

      // Internal Auth Logic for the Prototype
      const officerId = 'CONST-101'; 
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerId })
      });

      const data = await res.json();
      if (res.ok) {
        document.cookie = `officer_token=${data.token}; path=/; max-age=86400`;
        localStorage.setItem('officer', JSON.stringify(data.officer));
        router.push('/officer');
      } else {
        setError(data.error || 'Login failed');
        setLoading(false);
      }
    } catch (err) {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '40px', textAlign: 'center', borderTop: '4px solid #10B981' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ color: '#10B981', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px 0' }}>Officer Secure Portal</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>Authorized Implementing Officers Only</p>
        </div>

        {error && <div style={{ color: '#C55A5A', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'left' }}>
              <label className="label" style={{ display: 'block', color: 'var(--text-main)', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Official Email ID</label>
              <input 
                type="email" 
                placeholder="officer@nic.in" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-color)',
                  color: 'var(--text-main)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            
            <button type="submit" disabled={loading} style={{ 
              width: '100%', justifyContent: 'center', background: 'var(--surface-2)', 
              color: 'var(--text-main)', border: 'none', padding: '14px',
              boxShadow: '4px 4px 10px rgba(42, 58, 49, 0.08), inset 2px 2px 6px rgba(255, 255, 255, 0.8), inset -2px -2px 6px rgba(42, 58, 49, 0.04)',
              cursor: loading ? 'wait' : 'pointer', borderRadius: '12px', fontWeight: 700
            }}>
              {loading ? 'Sending OTP...' : 'Continue with Email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              We sent a 6-digit OTP to <strong style={{ color: 'var(--text-main)' }}>{email}</strong>
            </div>

            {testUrl && (
              <a href={testUrl} target="_blank" rel="noreferrer" style={{ display: 'block', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10B981', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 'bold' }}>
                View Email Inbox (Mock Viewer) ↗
              </a>
            )}

            <div style={{ textAlign: 'left' }}>
              <label className="label" style={{ display: 'block', color: 'var(--text-main)', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Enter OTP</label>
              <input 
                type="text" 
                placeholder="123456" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required 
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-color)',
                  color: 'var(--text-main)', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            
            <button type="submit" disabled={loading} style={{ 
              width: '100%', justifyContent: 'center', background: '#10B981', 
              color: 'white', border: 'none', padding: '14px',
              boxShadow: '4px 4px 10px rgba(16, 185, 129, 0.2)',
              cursor: loading ? 'wait' : 'pointer', borderRadius: '12px', fontWeight: 700
            }}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>

            <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#10B981', fontSize: '0.8rem', cursor: 'pointer', marginTop: '8px', textDecoration: 'underline' }}>
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
