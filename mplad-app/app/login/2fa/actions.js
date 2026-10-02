'use server';
import { cookies } from 'next/headers';

export async function set2faCookie() {
  const cookieStore = await cookies();
  cookieStore.set('mplads_2fa_verified', 'true', { 
    maxAge: 8 * 60 * 60, // 8 hours
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}
