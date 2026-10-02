import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const validId = (id) => id && /^[A-Za-z0-9_-]{1,50}$/.test(id);
const PAGE_MAX = 50;

/**
 * GET /api/public/works
 * Query params: constituency_id, status, page (1-based), limit (max 50)
 *
 * Summary stats use a single SQL aggregate — never loads all rows into memory.
 */
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const constituency_id = sp.get('constituency_id') || undefined;
    const status = sp.get('status') || undefined;
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit = Math.min(PAGE_MAX, Math.max(1, parseInt(sp.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Validate constituency_id to prevent injection via Prisma string contains
    if (constituency_id && !validId(constituency_id)) {
      return NextResponse.json({ error: 'Invalid constituency_id' }, { status: 400 });
    }

    const where = {};
    if (constituency_id) where.district_id = constituency_id;
    if (status) where.status = status;

    // Parallel: paginated works + total count + aggregate stats (single SQL each)
    const [works, total, agg] = await Promise.all([
      db.work.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fy: 'desc' },
        select: {
          id: true, title: true, category: true, status: true,
          sanctioned_amount: true, expenditure: true,
          district_id: true, village: true, fy: true, area_type: true,
        },
      }),
      db.work.count({ where }),
      // Single aggregate — never loads 131k rows into JS
      db.work.aggregate({
        _count: { _all: true },
        _sum: { sanctioned_amount: true, expenditure: true },
      }),
    ]);

    // Status counts via groupBy (one DB round-trip)
    const statusCounts = await db.work.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const byStatus = {};
    for (const row of statusCounts) byStatus[row.status] = row._count._all;

    const summary = {
      total: agg._count._all,
      completed: byStatus['COMPLETED'] || 0,
      proposed: byStatus['PROPOSED'] || 0,
      inProgress: byStatus['IN_PROGRESS'] || 0,
      totalSanctionedAmount: agg._sum.sanctioned_amount || 0,
      totalExpendedAmount: agg._sum.expenditure || 0,
    };

    return NextResponse.json({
      works,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary,
    });
  } catch (err) {
    console.error('[public/works GET]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
