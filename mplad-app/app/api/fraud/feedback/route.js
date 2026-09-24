import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/fraud/feedback
 * Body: { work_id, module_code, verdict: "CONFIRMED_FRAUD" | "FALSE_POSITIVE", officer_id }
 *
 * Persists investigator feedback to FraudFlag table.
 * This feedback loop allows weights to be retrained over time.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { work_id, module_code, verdict, officer_id } = body;

    if (!work_id || !verdict) {
      return NextResponse.json({ ok: false, error: 'work_id and verdict are required' }, { status: 400 });
    }
    if (!['CONFIRMED_FRAUD', 'FALSE_POSITIVE'].includes(verdict)) {
      return NextResponse.json({ ok: false, error: 'verdict must be CONFIRMED_FRAUD or FALSE_POSITIVE' }, { status: 400 });
    }

    // Upsert: update existing flag or create new feedback record
    const existing = await db.fraudFlag.findFirst({
      where: { work_id, module_code: module_code || 'RISK_FUSION' },
    });

    let record;
    if (existing) {
      record = await db.fraudFlag.update({
        where: { flag_id: existing.flag_id },
        data: {
          investigator_verdict: verdict,
          verdict_officer_id:   officer_id || null,
          verdict_at:           new Date(),
        },
      });
    } else {
      record = await db.fraudFlag.create({
        data: {
          work_id,
          module_code:          module_code || 'RISK_FUSION',
          risk_score:           0,
          severity:             'MEDIUM',
          evidence_json:        JSON.stringify({ feedback_only: true }),
          investigator_verdict: verdict,
          verdict_officer_id:   officer_id || null,
          verdict_at:           new Date(),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      flag_id: record.flag_id,
      verdict,
      message: verdict === 'CONFIRMED_FRAUD'
        ? ' Marked as confirmed fraud. This case will be escalated.'
        : ' Marked as false positive. Model will learn from this.',
    });
  } catch (err) {
    console.error('[fraud/feedback] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/fraud/feedback?work_id=xxx
 * Returns existing feedback for a work
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const work_id = searchParams.get('work_id');
    if (!work_id) {
      return NextResponse.json({ ok: false, error: 'work_id required' }, { status: 400 });
    }
    const flags = await db.fraudFlag.findMany({
      where: { work_id, investigator_verdict: { not: null } },
      orderBy: { verdict_at: 'desc' },
    });
    return NextResponse.json({ ok: true, flags });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
