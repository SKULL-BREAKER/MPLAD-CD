import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { verifyRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/investigator
 * Returns top 50 works by risk score with their flags.
 * Requires officer JWT.
 * Uses a DB join instead of O(n²) JS loops.
 */
export async function GET(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized — officer login required' }, { status: 401 });
  }

  try {
    // Single DB query: join work_risk with works, ordered by score
    const risks = await db.workRisk.findMany({
      take: 50,
      orderBy: { risk_score: 'desc' },
      include: {
        work: {
          select: {
            id: true, title: true, category: true, status: true,
            sanctioned_amount: true, expenditure: true,
            district_id: true, village: true, fy: true,
          },
        },
      },
    });

    const queue = risks.map(r => {
      let factors = [];
      try {
        if (r.contributions_json) {
          factors = JSON.parse(r.contributions_json).map(f => ({
            module: f.module_code,
            severity: f.severity,
            detail: f.evidence?.message || (f.evidence ? JSON.stringify(f.evidence) : ''),
          }));
        }
      } catch (_) {}

      return {
        ...r.work,
        work_id: r.work_id,
        aiAnalysis: {
          score: r.risk_score || 0,
          level: r.tier || 'LOW',
          factors,
        },
      };
    });

    return NextResponse.json({ success: true, queue });
  } catch (err) {
    console.error('[investigator]', err.message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
