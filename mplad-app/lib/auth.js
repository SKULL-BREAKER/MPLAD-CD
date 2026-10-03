import { SignJWT, jwtVerify } from 'jose';

function getSecretKey() {
  const rawSecret = process.env.JWT_SECRET;
  if (!rawSecret && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is not set.');
  }
  return new TextEncoder().encode(
    rawSecret || 'mplads-dev-only-secret-do-not-use-in-production-2026'
  );
}

/**
 * Sign a JWT token (1h expiry for officer sessions)
 */
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecretKey());
}

/**
 * Verify a JWT and return payload, or null if invalid/expired
 */
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header and verify it,
 * OR trust the middleware-injected x-user-role header (set after NextAuth session verify).
 */
export async function verifyRequest(request) {
  // 1. Trust middleware-injected identity (set after NextAuth cookie verification)
  const role = request.headers.get('x-user-role');
  if (role) {
    return {
      role,
      id: request.headers.get('x-user-id') || null,
      district_id: request.headers.get('x-district-id') || null,
    };
  }
  // 2. Fallback: Bearer token (for scripts/Postman)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

/**
 * Extract verified role from request (set by middleware)
 */
export function getRoleFromHeaders(request) {
  return request.headers.get('x-user-role') || null;
}

/**
 * Check if the request is from an officer (via middleware-injected header)
 */
export function isOfficer(request) {
  const role = request.headers.get('x-user-role');
  return role === 'OFFICER' || role === 'ADMIN';
}
