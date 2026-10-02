'use client';
import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  return (
    <button 
      onClick={() => signOut({ callbackUrl: '/login' })} 
      className="btn btn-sm" 
      style={{ 
        background: 'var(--surface-2)', 
        color: 'var(--danger)', 
        border: 'none',
        fontWeight: 700,
        boxShadow: '4px 4px 10px rgba(42, 58, 49, 0.08), inset 2px 2px 6px rgba(255, 255, 255, 0.8), inset -2px -2px 6px rgba(42, 58, 49, 0.04)',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      Secure Logout
    </button>
  );
}
