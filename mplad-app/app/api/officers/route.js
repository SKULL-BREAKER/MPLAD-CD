import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../lib/db';
import { verifyRequest } from '../../../lib/auth';

// ── Seed helper — creates a test officer if none exist ─────────────────────────
async function ensureTestOfficer() {
  const count = await db.officer.count();
  if (count === 0) {
    const hash = await bcrypt.hash('officer123', 10);
    await db.officer.create({
      data: {
        username: 'officer1',
        password_hash: hash,
        display_name: 'Field Officer — CONST-101',
        constituency_id: 'CONST-101',
      },
    });
  }
}

// GET /api/officers — list officers (admin) or get current officer info
export async function GET(request) {
  await ensureTestOfficer();

  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const officer = await db.officer.findUnique({
    where: { officer_id: payload.officer_id },
    select: { officer_id: true, username: true, display_name: true, constituency_id: true },
  });

  if (!officer) {
    return NextResponse.json({ error: 'Officer not found' }, { status: 404 });
  }

  return NextResponse.json({ officer });
}

// POST /api/officers — create a new officer (admin only, no auth check for demo)
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, display_name, constituency_id } = body;

    if (!username || !password || !display_name || !constituency_id) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const existing = await db.officer.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const officer = await db.officer.create({
      data: { username, password_hash: hash, display_name, constituency_id },
      select: { officer_id: true, username: true, display_name: true, constituency_id: true },
    });

    return NextResponse.json({ officer }, { status: 201 });
  } catch (err) {
    console.error('[Officer Create Error]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
