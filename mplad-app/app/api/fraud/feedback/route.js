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
    const record = await db.fraudLabel.upsert({
      where: {
        work_id_pattern: {
          work_id,
          pattern: module_code || 'RISK_FUSION'
        }
      },
      update: {
        label_class: verdict
      },
      create: {
        work_id,
        pattern: module_code || 'RISK_FUSION',
        label_class: verdict
      }
    });

    return NextResponse.json({
      ok: true,
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
    const flags = await db.fraudLabel.findMany({
      where: { work_id, label_class: { not: null } }
    });
    // Map to old expected format
    const mappedFlags = flags.map(f => ({
      module_code: f.pattern,
      investigator_verdict: f.label_class,
      verdict_at: new Date()
    }));
    return NextResponse.json({ ok: true, flags: mappedFlags });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
