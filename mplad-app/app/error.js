'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    console.error('[Global Error Boundary]', error);

    // Auth/session errors → redirect to login instead of showing error page
    const msg = error?.message?.toLowerCase() || '';
    const isAuthError =
      msg.includes('unauthorized') ||
      msg.includes('session') ||
      msg.includes('unauthenticated') ||
      msg.includes('redirect') ||
      msg.includes('nextauth') ||
      msg.includes('fetch') ||
      error?.digest?.includes('NEXT_REDIRECT');

    if (isAuthError) {
      router.replace('/login');
    }
  }, [error]);

  // If it looks like an auth error, show a redirect message instead of crash page
  const msg = error?.message?.toLowerCase() || '';
  const isAuthError =
    msg.includes('unauthorized') || msg.includes('session') ||
    msg.includes('fetch') || error?.digest?.includes('NEXT_REDIRECT');

  if (isAuthError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <p style={{ color: 'var(--text-muted, #64748B)' }}>Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '80vh', padding: '24px', textAlign: 'center'
    }}>
      <div style={{
        background: 'var(--surface-2, white)', padding: '40px',
        borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        maxWidth: '500px', width: '100%'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ color: 'var(--danger, #EF4444)', marginBottom: '16px', fontSize: '1.5rem', fontWeight: 800 }}>
          System Error Encountered
        </h2>
        <p style={{ color: 'var(--text-muted, #64748B)', marginBottom: '32px', lineHeight: 1.5 }}>
          A critical error occurred while processing this request. Our monitoring systems have logged the incident.
        </p>
        <button
          onClick={() => reset()}
          style={{
            background: 'var(--primary, #10B981)', color: 'white',
            border: 'none', padding: '12px 24px', borderRadius: '12px',
            fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={e => e.target.style.opacity = '0.9'}
          onMouseOut={e => e.target.style.opacity = '1'}
        >
          Attempt Recovery
        </button>
      </div>
    </div>
  );
}
