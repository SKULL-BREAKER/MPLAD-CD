import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../lib/db';
import { verifyRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/officers — get current officer profile (requires JWT)
export async function GET(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const officer = await db.user.findUnique({
    where: { id: payload.officer_id },
    select: { id: true, name: true, district_id: true, role: true },
  });

  if (!officer) {
    return NextResponse.json({ error: 'Officer not found' }, { status: 404 });
  }

  return NextResponse.json({ officer });
}

/**
 * POST /api/officers — create officer account
 * REQUIRES a valid existing officer JWT (admin-level officer only).
 * Removes the open unauthenticated creation endpoint.
 */
export async function POST(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only ADMIN-role officers can create other officers
  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { username, password, display_name, constituency_id } = body;

    if (!username || !password || !display_name || !constituency_id) {
      return NextResponse.json({ error: 'All fields required: username, password, display_name, constituency_id' }, { status: 400 });
    }

    // Password strength check — minimum 8 chars
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { id: username } });
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12); // cost factor 12
    const officer = await db.user.create({
      data: {
        id: String(username).trim().toLowerCase(),
        phone_hash: hash,
        name: String(display_name).trim().slice(0, 100),
        district_id: String(constituency_id).trim().toUpperCase(),
        role: 'OFFICER',
      },
      select: { id: true, name: true, district_id: true },
    });

    return NextResponse.json({ officer }, { status: 201 });
  } catch (err) {
    console.error('[officers POST]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
