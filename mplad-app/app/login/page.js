'use client';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, use } from 'react';

export default function LoginPage({ searchParams }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = searchParams ? use(searchParams) : {};
  const error = resolvedParams?.error;

  // Auto-redirect to 2FA step
  useEffect(() => {
    if (status !== 'authenticated') return;
    const role = session?.user?.role;
    if (role === 'MP' || role === 'OFFICER' || role === 'ADMIN') {
      router.replace('/login/2fa');
    }
  }, [status, session]);

  const handleSignIn = () => {
    // Uses Google's default callback which goes to this page, then the useEffect redirects
    signIn('google', { callbackUrl: '/login' });
  };

  return (
    <main style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '80vh', padding: '24px',
    }}>
      <style>{`
        .g-btn { transition: all 0.2s; }
        .g-btn:hover { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .g-btn:active { transform: scale(0.98); }
      `}</style>

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
          🇮🇳
        </div>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary, #10B981)', margin: '0 0 10px' }}>
          MPLADS Portal
        </h1>
        <p style={{ color: 'var(--text-muted, #666)', fontSize: '0.9rem', margin: '0 0 32px', lineHeight: 1.5 }}>
          Centralized secure login for Members of Parliament, District Officers, and System Administrators.
        </p>

        {error === 'OAuthCallback' && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
            borderRadius: 10, padding: '12px', marginBottom: 24, fontSize: '0.85rem',
          }}>
            ⚠️ Authentication error. Please try again.
          </div>
        )}

        {error === 'not_registered' && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
            borderRadius: 10, padding: '12px', marginBottom: 24, fontSize: '0.85rem',
          }}>
            ⚠️ <strong>{resolvedParams?.email}</strong> is not registered. Please use your official MPLADS account.
          </div>
        )}

        {status === 'loading' ? (
          <div style={{ padding: '14px', color: '#666', fontSize: '0.9rem' }}>Checking session...</div>
        ) : status === 'authenticated' ? (
          <div style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ color: '#10B981', fontWeight: 700, fontSize: '1.1rem', marginBottom: '12px' }}>
              ✅ Signed in as {session?.user?.email}
            </div>
            {!session?.user?.role && (
              <div style={{ color: '#B91C1C', fontSize: '0.85rem', marginBottom: '16px' }}>
                ⚠️ No role assigned. Your account might be cached without a role.
              </div>
            )}
            <button
              onClick={() => {
                import('next-auth/react').then(({ signOut }) => signOut());
              }}
              className="g-btn"
              style={{
                background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              Sign Out & Try Again
            </button>
          </div>
        ) : (
          <button onClick={handleSignIn} className="g-btn" style={{
            width: '100%', padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            background: 'white', border: '1.5px solid #E5E7EB',
            borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: '1rem',
            color: '#374151',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    </main>
  );
}
