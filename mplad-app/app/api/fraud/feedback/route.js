import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { verifyRequest } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/fraud/feedback
 * Requires officer JWT.
 * Body: { work_id, module_code?, verdict: "CONFIRMED_FRAUD" | "FALSE_POSITIVE" }
 */
export async function POST(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Unauthorized — officer login required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { work_id, module_code, verdict } = body;

    if (!work_id || !verdict) {
      return NextResponse.json({ ok: false, error: 'work_id and verdict are required' }, { status: 400 });
    }
    if (!['CONFIRMED_FRAUD', 'FALSE_POSITIVE'].includes(verdict)) {
      return NextResponse.json({ ok: false, error: 'verdict must be CONFIRMED_FRAUD or FALSE_POSITIVE' }, { status: 400 });
    }

    await db.fraudLabel.upsert({
      where: {
        work_id_pattern: { work_id, pattern: module_code || 'RISK_FUSION' },
      },
      update: { label_class: verdict },
      create: {
        work_id,
        pattern: module_code || 'RISK_FUSION',
        label_class: verdict,
      },
    });

    return NextResponse.json({
      ok: true,
      verdict,
      message: verdict === 'CONFIRMED_FRAUD'
        ? 'Marked as confirmed fraud. Case will be escalated.'
        : 'Marked as false positive. Model will learn from this.',
    });
  } catch (err) {
    console.error('[fraud/feedback POST]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/fraud/feedback?work_id=xxx
 * Requires officer JWT.
 */
export async function GET(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const work_id = new URL(request.url).searchParams.get('work_id');
    if (!work_id) {
      return NextResponse.json({ ok: false, error: 'work_id required' }, { status: 400 });
    }

    const flags = await db.fraudLabel.findMany({
      where: { work_id, label_class: { not: null } },
      select: { pattern: true, label_class: true },
    });

    return NextResponse.json({
      ok: true,
      flags: flags.map(f => ({
        module_code: f.pattern,
        investigator_verdict: f.label_class,
      })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
