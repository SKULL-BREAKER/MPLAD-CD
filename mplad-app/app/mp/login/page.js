'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MPLogin() {
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
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      
      if (res.ok) {
        document.cookie = `mp_auth=true; path=/; max-age=86400`;
        router.push('/mp');
      } else {
        setError(data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setError('Network error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', borderTop: '4px solid var(--accent)' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>MP Secure Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>Authorized Members Only</p>
        </div>

        {error && <div className="alert alert-error" style={{ fontSize: '0.8rem', padding: '10px', marginBottom: '16px' }}>{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'left' }}>
              <label className="label">Official Email ID</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="member@sansad.nic.in" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            
            <button type="submit" className="btn" disabled={loading} style={{ 
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
              We sent a 6-digit OTP to <strong>{email}</strong>
            </div>

            {testUrl && (
              <a href={testUrl} target="_blank" rel="noreferrer" style={{ display: 'block', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: 'var(--accent)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 'bold' }}>
                View Email Inbox (Mock Viewer) ↗
              </a>
            )}

            <div style={{ textAlign: 'left' }}>
              <label className="label">Enter OTP</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="123456" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required 
                style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px' }}
              />
            </div>
            
            <button type="submit" className="btn" disabled={loading} style={{ 
              width: '100%', justifyContent: 'center', background: 'var(--accent)', 
              color: 'white', border: 'none', padding: '14px',
              boxShadow: '4px 4px 10px rgba(42, 58, 49, 0.08)',
              cursor: loading ? 'wait' : 'pointer', borderRadius: '12px', fontWeight: 700
            }}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>

            <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '8px', textDecoration: 'underline' }}>
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
