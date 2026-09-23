import db from '../db';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * runFraudEngine(options)
 * Loads data from DB and returns real AI pipeline risk scores.
 * Returns { perWork, districtFlags, summary, scannedAt }
 */
export async function runFraudEngine(options = {}) {
  const start = Date.now();

  // Load real AI scores from DB
  const risks = await db.workRisk.findMany({
    orderBy: { risk_score: 'desc' },
  });

  const detectionResults = await db.detectionResult.findMany();

  // Map DetectionResult into perWork flags
  const flagMap = {};
  for (const dr of detectionResults) {
    if (!flagMap[dr.work_id]) flagMap[dr.work_id] = [];
    flagMap[dr.work_id].push({
      category: dr.detector,
      severity: dr.tier,
      reason: dr.evidence_json ? JSON.stringify(dr.evidence_json) : '',
      confidence: 'HIGH',
      detail: dr.evidence_json ? JSON.stringify(dr.evidence_json) : '',
    });
  }

  // Load flat works
  const works = await db.work.findMany();
  const workMap = {};
  for (const w of works) {
    workMap[w.id] = w;
  }

  const perWork = risks.map(r => ({
    work_id: r.work_id,
    risk_score: r.risk_score || 0,
    severity: r.tier || 'LOW',
    flags: flagMap[r.work_id] || [],
    timestamp: r.updated_at,
    work_details: workMap[r.work_id] || null,
  }));

  const summary = {
    total_works:    works.length,
    flagged_works:  perWork.filter(w => w.risk_score >= 40).length,
    critical_works: perWork.filter(w => w.severity === 'CRITICAL').length,
    high_works:     perWork.filter(w => w.severity === 'HIGH').length,
    avg_risk:       perWork.length
      ? Math.round(perWork.reduce((s, w) => s + w.risk_score, 0) / perWork.length)
      : 0,
    total_flags:    detectionResults.length,
    district_flags: 0,
    scan_ms:        Date.now() - start,
    scanned_at:     new Date().toISOString(),
  };

  return { perWork, districtFlags: [], summary };
}
