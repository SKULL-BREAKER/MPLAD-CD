'use client';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Role → destination page
const ROLE_REDIRECT = {
  ADMIN:    '/authority',
  OFFICER:  '/authority',
  MP:       '/mp',
};

// Role → accent colour
const ROLE_COLOR = {
  ADMIN:   '#DC2626',
  OFFICER: '#2563EB',
  MP:      '#10B981',
};

export default function GoogleLoginCard({ expectedRole, title, subtitle, accentColor }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [error, setError] = useState('');

  // Auto-redirect once session is established
  useEffect(() => {
    if (status !== 'authenticated') return;
    const role = session?.user?.role;
    if (!role) {
      setError('Your Google account is not registered in MPLADS. Contact your district admin.');
      return;
    }
    if (expectedRole && role !== expectedRole && !(expectedRole === 'OFFICER' && role === 'ADMIN')) {
      setError(`This portal is for ${expectedRole}s only. Your account role is ${role}.`);
      return;
    }
    const dest = ROLE_REDIRECT[role] || '/';
    router.replace(dest);
  }, [status, session]);

  const handleSignIn = () => {
    setError('');
    signIn('google', { callbackUrl: window.location.href });
  };

  const accent = accentColor || ROLE_COLOR[expectedRole] || '#4F46E5';

  if (status === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        Checking session...
      </div>
    );
  }

  return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .g-btn { transition: all 0.2s; }
        .g-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important; }
        .g-btn:active { transform: scale(0.97); }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--surface-2, white)',
        borderRadius: 20, padding: '40px 36px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        border: `1px solid rgba(0,0,0,0.07)`,
        borderTop: `4px solid ${accent}`,
        textAlign: 'center',
      }}>
        {/* Logo / Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `${accent}18`, border: `2px solid ${accent}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 24,
        }}>
          {expectedRole === 'MP' ? '🏛️' : expectedRole === 'ADMIN' ? '🔐' : '🏢'}
        </div>

        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: accent, margin: '0 0 6px' }}>{title}</h1>
        <p style={{ color: 'var(--text-muted, #666)', fontSize: '0.83rem', margin: '0 0 28px' }}>{subtitle}</p>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C',
            borderRadius: 10, padding: '10px 14px', fontSize: '0.82rem',
            marginBottom: 20, textAlign: 'left', lineHeight: 1.5,
          }}>
            ⚠️ {error}
          </div>
        )}

        {status === 'authenticated' && !error ? (
          <div style={{ color: '#10B981', fontWeight: 600, fontSize: '0.9rem' }}>
            ✅ Signed in — redirecting...
          </div>
        ) : (
          <>
            <button onClick={handleSignIn} className="g-btn" style={{
              width: '100%', padding: '13px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              background: 'white', border: '1.5px solid #E5E7EB',
              borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem',
              color: '#374151', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              {/* Google SVG logo */}
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9CA3AF)', marginTop: 18, lineHeight: 1.5 }}>
              Only officially registered {expectedRole === 'MP' ? 'MPs' : 'officers'} can access this portal.
              Your Google account email must match the registered record.
            </p>
          </>
        )}

        {status === 'authenticated' && (
          <button onClick={() => signOut()} style={{
            background: 'none', border: 'none', color: '#9CA3AF',
            fontSize: '0.75rem', cursor: 'pointer', marginTop: 12,
            textDecoration: 'underline',
          }}>
            Sign out and use a different account
          </button>
        )}
      </div>
    </main>
  );
}
