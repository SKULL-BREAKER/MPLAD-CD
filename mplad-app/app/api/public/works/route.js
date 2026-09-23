import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

// GET /api/public/works — all works visible to public (read-only, public-safe fields)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const constituency_id = searchParams.get('constituency_id');
  const state = searchParams.get('state');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const skip = (page - 1) * limit;

  const where = {};
  if (constituency_id) where.district_id = constituency_id;
  if (state) where.status = state;

  const [works, total] = await Promise.all([
    db.work.findMany({
      where,
      include: {
        comments: {
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            comment_id: true,
            poster_name: true,
            comment_text: true,
            created_at: true,
          },
        },
        photos: {
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            photo_id: true,
            poster_name: true,
            photo_data: true,
            caption: true,
            created_at: true,
          },
        },
      },
      orderBy: [{ fy: 'desc' }],
      skip,
      take: limit,
    }),
    db.work.count({ where }),
  ]);

  // Summary stats for public dashboard
  const allWorks = await db.work.findMany({
    select: {
      status: true,
      sanctioned_amount: true,
      expenditure: true,
      district_id: true,
      category: true,
    },
  });

  const summary = {
    total: allWorks.length,
    sanctioned: allWorks.filter(w => w.status === 'SANCTIONED').length,
    inExecution: allWorks.filter(w => w.status === 'IN-EXECUTION').length,
    completed: allWorks.filter(w => w.status === 'COMPLETED').length,
    utilised: allWorks.filter(w => w.status === 'UTILISED').length,
    totalSanctionedAmount: allWorks.reduce((s, w) => s + (w.sanctioned_amount || 0), 0),
    totalExpendedAmount: allWorks.reduce((s, w) => s + (w.expenditure || 0), 0),
  };

  return NextResponse.json({
    works,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary,
  });
}
