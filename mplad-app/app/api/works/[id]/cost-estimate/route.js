import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';
import { verifyRequest } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/works/[id]/cost-estimate
 * Returns AI-generated cost estimate for a work.
 * Requires officer JWT.
 */
export async function GET(request, { params }) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized — officer login required' }, { status: 401 });
  }

  const { id } = params;

  try {
    const estimate = await db.costEstimate.findFirst({
      where: { work_id: id },
      orderBy: { created_at: 'desc' },
    });

    const work = await db.work.findUnique({
      where: { id },
      select: { id: true, title: true, sanctioned_amount: true, category: true },
    });

    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    return NextResponse.json({ work, estimate: estimate || null });
  } catch (err) {
    console.error('[works/cost-estimate]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
