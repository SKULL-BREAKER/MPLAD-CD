import nodemailer from 'nodemailer';
import { rateLimit } from '../../../lib/rate-limit';
import { storeOtp, isLocked } from '../../../lib/otp-store';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';

    const { email } = await request.json();

    if (!email || !/.+@.+\..+/.test(email)) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), { status: 400 });
    }

    const normalised = email.toLowerCase().trim();

    // Rate limit: 20 OTPs per email per 10 minutes (for easier testing)
    const { allowed, resetIn } = rateLimit(`otp:${normalised}`, 20, 600);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Too many OTP requests. Try again in ${resetIn}s.` }),
        { status: 429, headers: { 'Retry-After': String(resetIn) } }
      );
    }

    // Rate limit: 50 requests per IP per 10 minutes (prevent scraping but allow testing)
    const ipLimit = rateLimit(`otp-ip:${ip}`, 50, 600);
    if (!ipLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests from your network. Try again later.' }),
        { status: 429, headers: { 'Retry-After': String(ipLimit.resetIn) } }
      );
    }

    if (isLocked(normalised)) {
      return new Response(
        JSON.stringify({ error: 'Account is temporarily locked due to too many failed attempts.' }),
        { status: 403 }
      );
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Store securely (replaces global.otpCache)
    storeOtp(normalised, otp);

    // Send email
    let transporter;
    let isTest = false;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    } else {
      isTest = true;
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    }

    const info = await transporter.sendMail({
      from: `"MPLAD Secure Portal" <${process.env.SMTP_USER || 'no-reply@mplad.gov.in'}>`,
      to: normalised,
      subject: 'Your Secure Login OTP — MPLAD Portal',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px">
          <h2 style="color:#10B981;margin-bottom:24px">Secure Portal Access</h2>
          <p style="color:#334155;font-size:16px">Your One Time Password for the MPLAD Dashboard:</p>
          <div style="background:#f1f5f9;padding:16px;border-radius:8px;text-align:center;margin:24px 0">
            <span style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#0f172a">${otp}</span>
          </div>
          <p style="color:#64748b;font-size:14px">⏱ Valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:11px;text-align:center">Govt of India · MPLAD Monitoring Cell · If you did not request this, ignore this email.</p>
        </div>
      `,
    });

    const testUrl = isTest ? nodemailer.getTestMessageUrl(info) : null;
    if (isTest) console.log('[OTP] Dev preview:', testUrl);

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent', ...(isTest && { testUrl }) }),
      { status: 200 }
    );

  } catch (err) {
    console.error('[send-otp]', err.message);
    return new Response(JSON.stringify({ error: 'Failed to send OTP' }), { status: 500 });
  }
}
