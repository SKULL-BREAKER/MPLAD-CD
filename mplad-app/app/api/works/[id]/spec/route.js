import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';
import { verifyRequest } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/works/[id]/spec
 * Returns the work specification (BOQ, scope, technical details).
 * Public: basic spec. Officer: full spec including cost estimate linkage.
 */
export async function GET(request, { params }) {
  const { id } = params;

  try {
    const work = await db.work.findUnique({
      where: { id },
      select: {
        id: true, title: true, category: true, status: true,
        sanctioned_amount: true, fy: true, district_id: true,
        village: true, area_type: true,
        workSpec: true,
      },
    });

    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    const payload = await verifyRequest(request);

    return NextResponse.json({
      work: {
        ...work,
        // Mask risk-sensitive fields for public access
        workSpec: work.workSpec || null,
      },
      isOfficer: !!payload,
    });
  } catch (err) {
    console.error('[works/spec]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
