'use client';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';

export default function LoginPage({ searchParams }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = searchParams ? use(searchParams) : {};
  const errorParam = resolvedParams?.error;

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (status !== 'authenticated') return;
    const role = session?.user?.role;
    if (role === 'MP') router.replace('/mp');
    else if (role === 'OFFICER') router.replace('/officer');
    else if (role === 'ADMIN') router.replace('/authority');
    else router.replace('/');
  }, [status, session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      const msgs = {
        USER_NOT_FOUND: 'No account found with this email. Please sign up first.',
        WRONG_PASSWORD: 'Incorrect password. Please try again.',
        NO_PASSWORD: 'This account has no password set. Please reset your password.',
        MISSING_FIELDS: 'Please enter your email and password.',
      };
      setError(msgs[res.error] || 'Login failed. Check your email and password.');
    }
    // Success case is handled by the useEffect above
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
          MPLADS Portal
        </h1>
        <p style={{ color: 'var(--text-muted, #666)', fontSize: '0.85rem', margin: '0 0 32px', lineHeight: 1.5, textAlign: 'center' }}>
          Secure login for Members of Parliament, Officers & Administrators
        </p>

        {/* Error */}
        {(error || errorParam === 'CredentialsSignin') && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
            borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: '0.85rem', textAlign: 'center',
          }}>
            ⚠️ {error || 'Invalid credentials. Please try again.'}
          </div>
        )}

        {status === 'authenticated' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#10B981', fontWeight: 700, marginBottom: 12 }}>✅ Signed in as {session?.user?.email}</div>
            <button onClick={() => import('next-auth/react').then(({ signOut }) => signOut())}
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                className="login-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.gov.in"
                required
                autoComplete="email"
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.95rem', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                className="login-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.95rem', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box' }}
              />
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Link href="/forgot-password" style={{ color: 'var(--primary, #10B981)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                  Forgot Password?
                </Link>
              </div>
            </div>
            <button
              id="login-submit"
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
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}
        
        {status !== 'authenticated' && (
          <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted, #666)' }}>Don't have an account? </span>
            <Link href="/signup" style={{ color: 'var(--primary, #10B981)', fontWeight: 600, textDecoration: 'none' }}>
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
