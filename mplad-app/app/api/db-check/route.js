import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function GET() {
  try {
    const count = await db.user.count();
    return NextResponse.json({ ok: true, userCount: count, dbUrl: process.env.DATABASE_URL || 'NOT SET' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message, dbUrl: process.env.DATABASE_URL || 'NOT SET' }, { status: 500 });
  }
}
