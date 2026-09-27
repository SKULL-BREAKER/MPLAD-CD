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
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', padding: '20px' }}>
      <div style={{ background: '#1E293B', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', width: '100%', maxWidth: '400px', border: '1px solid #334155' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 800, margin: '0 0 10px 0' }}>Officer Login</h1>
          <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.9rem' }}>Access your secure district surveillance dashboard.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#CBD5E1', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>District / Officer ID</label>
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
                border: '1px solid #334155',
                background: '#0F172A',
                color: 'white',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <p style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '6px' }}>Hint: Type any ID to automatically generate a profile.</p>
          </div>

          {error && <div style={{ color: '#EF4444', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

          <button 
            type="submit" 
            disabled={loading || !officerId}
            style={{
              width: '100%',
              padding: '14px',
              background: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: loading || !officerId ? 'not-allowed' : 'pointer',
              opacity: loading || !officerId ? 0.7 : 1,
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </main>
  );
}
