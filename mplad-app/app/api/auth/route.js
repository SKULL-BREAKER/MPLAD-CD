import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../lib/db';
import { signToken } from '../../../lib/auth';

// POST /api/auth — Officer login
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const officer = await db.officer.findUnique({ where: { username } });
    if (!officer) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, officer.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({
      officer_id: officer.officer_id,
      username: officer.username,
      display_name: officer.display_name,
      constituency_id: officer.constituency_id,
    });

    return NextResponse.json({
      token,
      officer: {
        officer_id: officer.officer_id,
        username: officer.username,
        display_name: officer.display_name,
        constituency_id: officer.constituency_id,
      },
    });
  } catch (err) {
    console.error('[Auth Error]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/auth — Check if server is up (ping)
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'MPLADS Auth API' });
}
