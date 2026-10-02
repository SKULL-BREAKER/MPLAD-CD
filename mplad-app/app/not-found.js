import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '80vh', padding: '24px', textAlign: 'center'
    }}>
      <div style={{
        background: 'var(--surface-2, white)', padding: '48px',
        borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        maxWidth: '500px', width: '100%'
      }}>
        <h1 style={{ fontSize: '5rem', fontWeight: 900, color: 'var(--text-muted, #94A3B8)', margin: '0 0 10px' }}>
          404
        </h1>
        <h2 style={{ color: 'var(--text, #1E293B)', marginBottom: '16px', fontSize: '1.5rem', fontWeight: 800 }}>
          Resource Not Found
        </h2>
        <p style={{ color: 'var(--text-muted, #64748B)', marginBottom: '32px', lineHeight: 1.5 }}>
          The requested system resource or page does not exist or has been moved.
        </p>
        <Link href="/login" style={{
          background: 'var(--primary, #10B981)', color: 'white',
          border: 'none', padding: '12px 24px', borderRadius: '12px',
          fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
          display: 'inline-block'
        }}>
          Return to Portal
        </Link>
      </div>
    </div>
  );
}
