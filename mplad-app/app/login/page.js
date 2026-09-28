'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [officerId, setOfficerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerId })
      });

      const data = await res.json();
      if (res.ok) {
        // Save the token as a cookie so Server Components can read it
        document.cookie = `officer_token=${data.token}; path=/; max-age=86400`;
        // Save user info in localStorage for client components
        localStorage.setItem('officer', JSON.stringify(data.officer));
        
        // Redirect to officer dashboard
        router.push('/officer');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: 'var(--text-main)', fontSize: '1.8rem', fontWeight: 800, margin: '0 0 10px 0' }}>Officer Login</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Access your secure district surveillance dashboard.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>District / Officer ID</label>
            <input 
              type="text" 
              placeholder="e.g. CONST-101" 
              value={officerId} 
              onChange={(e) => setOfficerId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-color)',
                color: 'var(--text-main)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && <div style={{ color: '#C55A5A', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading || !officerId}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 'bold',
              opacity: loading || !officerId ? 0.7 : 1,
            }}
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </main>
  );
}
