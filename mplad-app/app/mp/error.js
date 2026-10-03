'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MPError({ error }) {
  const router = useRouter();
  useEffect(() => {
    console.error('[MP Error]', error?.message);
    router.replace('/login');
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <p style={{ color: '#64748B' }}>Redirecting to login…</p>
    </div>
  );
}
