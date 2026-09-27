import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../lib/db';
import { verifyRequest } from '../../../lib/auth';

// ── Seed helper — creates a test officer if none exist ─────────────────────────
async function ensureTestOfficer() {
  const count = await db.user.count({ where: { role: 'OFFICER' } });
  if (count === 0) {
    const hash = await bcrypt.hash('officer123', 10);
    await db.user.create({
      data: {
        id: 'officer1',
        phone_hash: hash,
        name: 'Field Officer — CONST-101',
        district_id: 'CONST-101',
        role: 'OFFICER'
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

  const officer = await db.user.findUnique({
    where: { id: payload.officer_id },
    select: { id: true, name: true, district_id: true },
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

    const existing = await db.user.findUnique({ where: { id: username } });
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const officer = await db.user.create({
      data: { id: username, phone_hash: hash, name: display_name, district_id: constituency_id, role: 'OFFICER' },
      select: { id: true, name: true, district_id: true },
    });

    return NextResponse.json({ officer }, { status: 201 });
  } catch (err) {
    console.error('[Officer Create Error]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
