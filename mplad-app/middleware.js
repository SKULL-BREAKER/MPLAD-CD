import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

// Routes that require a valid JWT (officer/authority)
const PROTECTED = [
  '/api/fraud',
  '/api/monitor',
  '/api/alerts',
  '/api/investigator',
  '/api/officer',
  '/api/officers',
  '/api/ingest',
];

// Routes that are always public
const PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/send-otp',
  '/api/verify-otp',
  '/api/public',
  '/api/chat',
  '/_next',
  '/favicon',
  '/ludo_logo',
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Enforce auth on protected API routes
  if (PROTECTED.some(p => pathname.startsWith(p))) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized — Bearer token required' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized — invalid or expired token' },
        { status: 401 }
      );
    }

    // Inject verified identity into request headers for downstream handlers
    const headers = new Headers(request.headers);
    headers.set('x-user-id', String(payload.officer_id || payload.id || ''));
    headers.set('x-user-role', String(payload.role || ''));
    headers.set('x-district-id', String(payload.district_id || ''));

    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
