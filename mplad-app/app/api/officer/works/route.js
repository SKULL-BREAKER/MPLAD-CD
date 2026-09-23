import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { verifyRequest } from '../../../../lib/auth';
import { updateExecutionState, appendEvidence } from '../../../../lib/modules/execution';
import { revalidatePath } from 'next/cache';

// GET /api/officer/works — fetch works scoped to officer's constituency
export async function GET(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { constituency_id } = payload;

  const works = await db.work.findMany({
    where: { district_id: constituency_id },
    include: {
      comments: { orderBy: { created_at: 'desc' }, take: 5 },
      photos: { orderBy: { created_at: 'desc' }, take: 5 },
    },
    orderBy: { id: 'asc' },
  });

  // Summary stats
  const stats = {
    total: works.length,
    sanctioned: works.filter(w => w.status === 'SANCTIONED').length,
    inExecution: works.filter(w => w.status === 'IN-EXECUTION').length,
    completed: works.filter(w => w.status === 'COMPLETED').length,
    utilised: works.filter(w => w.status === 'UTILISED').length,
    totalSanctioned: works.reduce((s, w) => s + (w.sanctioned_amount || 0), 0),
    totalExpended: works.reduce((s, w) => s + (w.expenditure || 0), 0),
    evidenceCount: 0,
  };

  return NextResponse.json({ works, stats, constituency_id });
}

// POST /api/officer/works — advance state or append evidence
export async function POST(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, work_id } = body;

    if (!work_id || !action) {
      return NextResponse.json({ error: 'work_id and action are required' }, { status: 400 });
    }

    // Verify the work belongs to this officer's constituency
    const work = await db.work.findUnique({ where: { id: work_id } });
    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }
    if (work.district_id !== payload.constituency_id) {
      return NextResponse.json({ error: 'Access denied — not your constituency' }, { status: 403 });
    }

    const NEXT_STATE = {
      SANCTIONED: 'IN-EXECUTION',
      'IN-EXECUTION': 'COMPLETED',
      COMPLETED: 'UTILISED',
    };

    if (action === 'advance_state') {
      const nextState = NEXT_STATE[work.status];
      if (!nextState) {
        return NextResponse.json({ error: 'Work is already fully utilised' }, { status: 400 });
      }
      await updateExecutionState(work_id, nextState);
      return NextResponse.json({ success: true, new_state: nextState });
    }

    if (action === 'append_evidence') {
      const { media_type = 'PHOTO', latitude = 0, longitude = 0, authority = 'OFFICER' } = body;
      await appendEvidence(work_id, media_type, latitude, longitude, authority);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Officer Works Error]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
