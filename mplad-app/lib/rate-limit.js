/**
 * lib/rate-limit.js
 * In-memory rate limiter using a sliding window.
 * Usage: const result = rateLimit(ip, 'send-otp', 3, 60); // 3 per 60s
 */

const store = new Map(); // key → { count, resetAt }

/**
 * @param {string} key   — unique identifier (e.g. IP + action)
 * @param {number} limit — max requests allowed
 * @param {number} windowSec — window in seconds
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
export function rateLimit(key, limit, windowSec) {
  const now = Date.now();
  const resetAt = now + windowSec * 1000;

  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt };
    store.set(key, entry);
  }

  entry.count += 1;

  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  const resetIn = Math.ceil((entry.resetAt - now) / 1000);

  // Cleanup old entries periodically (every 1000 checks)
  if (store.size > 1000) {
    for (const [k, v] of store.entries()) {
      if (now > v.resetAt) store.delete(k);
    }
  }

  return { allowed, remaining, resetIn };
}
