'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('OFFICER');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (status !== 'authenticated') return;
    const userRole = session?.user?.role;
    if (userRole === 'MP') router.replace('/mp');
    else if (userRole === 'OFFICER') router.replace('/officer');
    else if (userRole === 'ADMIN') router.replace('/authority');
    else router.replace('/');
  }, [status, session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to sign up');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
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
        }}>🇮🇳</div>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary, #10B981)', margin: '0 0 6px', textAlign: 'center' }}>
          Create Account
        </h1>
        <p style={{ color: 'var(--text-muted, #666)', fontSize: '0.85rem', margin: '0 0 32px', lineHeight: 1.5, textAlign: 'center' }}>
          Register to access the MPLADS Portal
        </p>

        {/* Error */}
        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
            borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: '0.85rem', textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}
        
        {/* Success */}
        {success && (
          <div style={{
            background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46',
            borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: '0.85rem', textAlign: 'center',
          }}>
            ✅ Account created successfully! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Full Name
            </label>
            <input
              id="signup-name"
              type="text"
              className="login-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your Name"
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Email Address
            </label>
            <input
              id="signup-email"
              type="email"
              className="login-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.gov.in"
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Role
            </label>
            <select
              id="signup-role"
              className="login-input"
              value={role}
              onChange={e => setRole(e.target.value)}
              required
            >
              <option value="OFFICER">District Officer</option>
              <option value="MP">Member of Parliament</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              id="signup-password"
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
            id="signup-submit"
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
            {loading ? 'Creating Account…' : 'Sign Up'}
          </button>
        </form>
        
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted, #666)' }}>Already have an account? </span>
          <Link href="/login" style={{ color: 'var(--primary, #10B981)', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
