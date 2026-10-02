import { rateLimit } from '../../../lib/rate-limit';
import { verifyOtp } from '../../../lib/otp-store';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';

    const { email, otp } = await request.json();

    if (!email || !otp) {
      return new Response(JSON.stringify({ error: 'Email and OTP are required' }), { status: 400 });
    }

    const normalised = email.toLowerCase().trim();

    // Rate limit verify attempts: 10 per IP per 5 minutes
    const { allowed, resetIn } = rateLimit(`verify:${ip}`, 10, 300);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Too many verification attempts. Try again in ${resetIn}s.` }),
        { status: 429, headers: { 'Retry-After': String(resetIn) } }
      );
    }

    // Verify using secure store (constant-time, brute-force protected)
    const result = verifyOtp(normalised, String(otp).trim());

    if (!result.ok) {
      const status = result.locked ? 403 : 400;
      return new Response(JSON.stringify({ error: result.error }), { status });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error('[verify-otp]', err.message);
    return new Response(JSON.stringify({ error: 'Verification failed' }), { status: 500 });
  }
}
