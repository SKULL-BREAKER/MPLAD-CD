import { NextResponse } from 'next/server';
import { runFraudEngine } from '../../../lib/modules/fraud_engine';
import { verifyRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized — officer login required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const top = parseInt(searchParams.get('top') || '50', 10);

    const result = await runFraudEngine();

    // Return top N works + summary + district flags
    return NextResponse.json({
      ok: true,
      perWork:       result.perWork.slice(0, top),
      districtFlags: result.districtFlags,
      summary:       result.summary,
    });
  } catch (err) {
    console.error('[fraud/route] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
