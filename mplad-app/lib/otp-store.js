/**
 * lib/otp-store.js
 * Secure OTP store — replaces global.otpCache.
 * Features:
 *  - Brute-force lockout (5 wrong attempts → 15 min ban)
 *  - 5-minute expiry
 *  - Constant-time comparison (no timing oracle)
 *  - Auto-cleanup
 */

import { timingSafeEqual } from 'crypto';

const otpStore  = new Map(); // email → { hash, expires, attempts }
const lockStore = new Map(); // email → lockedUntil

const OTP_TTL_MS   = 5  * 60 * 1000; // 5 minutes
const LOCK_TTL_MS  = 15 * 60 * 1000; // 15 minutes lockout
const MAX_ATTEMPTS = 5;

function toBuffer(s) {
  return Buffer.from(String(s).padEnd(6, ' ').slice(0, 6));
}

export function storeOtp(email, otp) {
  // Clear any previous OTP
  otpStore.delete(email);
  lockStore.delete(email);

  otpStore.set(email, {
    otp: String(otp),
    expires: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  // Schedule auto-cleanup
  setTimeout(() => otpStore.delete(email), OTP_TTL_MS + 1000);
}

export function verifyOtp(email, candidate) {
  const now = Date.now();

  // Check lockout
  const lockedUntil = lockStore.get(email);
  if (lockedUntil && now < lockedUntil) {
    const secs = Math.ceil((lockedUntil - now) / 1000);
    return { ok: false, error: `Too many attempts. Try again in ${secs}s.`, locked: true };
  }

  const entry = otpStore.get(email);
  if (!entry) {
    return { ok: false, error: 'No OTP requested for this email or it has expired.' };
  }

  if (now > entry.expires) {
    otpStore.delete(email);
    return { ok: false, error: 'OTP has expired. Please request a new one.' };
  }

  // Constant-time comparison
  let match = false;
  try {
    match = timingSafeEqual(toBuffer(entry.otp), toBuffer(candidate));
  } catch {
    match = false;
  }

  if (!match) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(email);
      lockStore.set(email, now + LOCK_TTL_MS);
      setTimeout(() => lockStore.delete(email), LOCK_TTL_MS + 1000);
      return { ok: false, error: 'Too many failed attempts. Account locked for 15 minutes.', locked: true };
    }
    return { ok: false, error: `Invalid OTP. ${MAX_ATTEMPTS - entry.attempts} attempt(s) remaining.` };
  }

  // Success
  otpStore.delete(email);
  lockStore.delete(email);
  return { ok: true };
}

export function isLocked(email) {
  const lockedUntil = lockStore.get(email);
  return lockedUntil && Date.now() < lockedUntil;
}
