import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { verifyRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/investigator
 * Returns top 50 works by risk score for the officer's own district, with their flags.
 */
export async function GET(request) {
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized — officer login required' }, { status: 401 });
  }

  try {
    const districtId = payload.district_id || null;

    // Get all risk entries, filter by district after manual join
    const risks = await db.workRisk.findMany({
      orderBy: { risk_score: 'desc' },
    });

    const riskWorkIds = risks.map(r => r.work_id);

    // Fetch works for those IDs, scoped to the officer's district
    const worksQuery = {
      where: {
        id: { in: riskWorkIds },
        ...(districtId ? { district_id: districtId } : {}),
      },
      select: {
        id: true, title: true, category: true, status: true,
        sanctioned_amount: true, expenditure: true,
        district_id: true, village: true, fy: true, area_type: true,
      },
    };
    const works = await db.work.findMany(worksQuery);
    const worksMap = Object.fromEntries(works.map(w => [w.id, w]));

    // Only include risk entries that have a matching (in-district) work
    const filteredRisks = risks.filter(r => worksMap[r.work_id]);

    const queue = filteredRisks.slice(0, 50).map(r => {
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

      const work = worksMap[r.work_id];
      return {
        ...work,
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

