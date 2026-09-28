import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { signToken } from '../../../lib/auth';

// POST /api/auth — Officer login
export async function POST(request) {
  try {
    const { officerId } = await request.json();

    if (!officerId) {
      return NextResponse.json({ error: 'Officer ID is required' }, { status: 400 });
    }

    // Attempt to find officer by ID
    let officer = await db.user.findUnique({ where: { id: officerId } });
    
    // Prevent normal people from logging in by disabling automatic profile generation
    if (!officer || officer.role !== 'OFFICER') {
      return NextResponse.json({ error: 'Unauthorized: Invalid Officer ID or you do not have Officer privileges.' }, { status: 401 });
    }

    const token = await signToken({
      officer_id: officer.id,
      name: officer.name,
      district_id: officer.district_id,
      role: officer.role
    });

    return NextResponse.json({
      token,
      officer: {
        id: officer.id,
        name: officer.name,
        district_id: officer.district_id,
        role: officer.role,
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
