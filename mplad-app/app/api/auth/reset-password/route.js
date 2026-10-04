import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../../lib/db';
import { rateLimit } from '../../../../lib/rate-limit';
import { verifyOtp } from '../../../../lib/otp-store';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';

    const { email, otp, newPassword } = await request.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'Email, OTP, and new password are required' }, { status: 400 });
    }

    const normalised = email.toLowerCase().trim();

    // Rate limit verify attempts: 10 per IP per 5 minutes
    const { allowed, resetIn } = rateLimit(`verify-reset:${ip}`, 10, 300);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many verification attempts. Try again in ${resetIn}s.` },
        { status: 429, headers: { 'Retry-After': String(resetIn) } }
      );
    }

    // Verify using secure store
    const result = verifyOtp(normalised, String(otp).trim());

    if (!result.ok) {
      const status = result.locked ? 403 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    // OTP is valid. Now update the password
    const user = await db.user.findFirst({
      where: { email: normalised },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);

    await db.user.update({
      where: { id: user.id },
      data: { password_hash },
    });

    return NextResponse.json({ success: true, message: 'Password reset successfully' }, { status: 200 });
  } catch (err) {
    console.error('[reset-password]', err.message);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
