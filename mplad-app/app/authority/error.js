'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthorityError({ error }) {
  const router = useRouter();
  useEffect(() => {
    console.error('[Authority Error]', error?.message);
    router.replace('/login');
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <p style={{ color: '#64748B' }}>Redirecting to login…</p>
    </div>
  );
}
