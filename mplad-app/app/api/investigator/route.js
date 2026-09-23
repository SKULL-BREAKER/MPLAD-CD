import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { runDetectionEngines } from '../../../lib/modules/fusionBrain';

export async function GET() {
  try {
    const risks = await db.workRisk.findMany();
    const works = await db.work.findMany();

    const analyzedWorks = works.map(w => {
      const risk = risks.find(r => r.work_id === w.id);
      let aiAnalysis = { score: 0, level: 'LOW', factors: [] };
      if (risk) {
        let factors = [];
        try {
          if (risk.contributions_json) {
            factors = JSON.parse(risk.contributions_json).map(f => ({
              module: f.module_code,
              severity: f.severity,
              detail: f.evidence?.message || (f.evidence ? JSON.stringify(f.evidence) : '')
            }));
          }
        } catch(e) {}
        aiAnalysis = {
          score: risk.risk_score || 0,
          level: risk.tier || 'LOW',
          factors
        };
      }
      return { ...w, aiAnalysis };
    });

    analyzedWorks.sort((a, b) => b.aiAnalysis.score - a.aiAnalysis.score);

    return NextResponse.json({ success: true, queue: analyzedWorks.slice(0, 50) }); // Top 50 to avoid huge payload
  } catch (error) {
    console.error('Investigator API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
