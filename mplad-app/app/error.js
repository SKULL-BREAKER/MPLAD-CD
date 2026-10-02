'use client';
import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // In a production system, this would send to Sentry or Datadog
    console.error('[Global Error Boundary]', error);
  }, [error]);

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
