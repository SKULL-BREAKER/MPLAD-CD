import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const alerts = await db.alert.findMany({
      where: { status: { not: 'RESOLVED' } },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
    return NextResponse.json({ ok: true, alerts });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { id } = await req.json();
    await db.alert.update({
      where: { id },
      data: { status: 'RESOLVED', resolved_at: new Date().toISOString() }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
