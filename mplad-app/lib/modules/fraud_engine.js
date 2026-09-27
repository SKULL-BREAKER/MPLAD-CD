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
    
    // Parse evidence JSON
    let evidence = null;
    try { evidence = dr.evidence_json ? JSON.parse(dr.evidence_json) : null; } catch(e) {}
    
    flagMap[dr.work_id].push({
      module_code: dr.detector, // Changed from category to module_code
      severity: dr.tier,
      evidence: evidence || { message: dr.evidence_json },
    });
  }

  // Load flat works
  const works = await db.work.findMany();
  const workMap = {};
  for (const w of works) {
    workMap[w.id] = w;
  }

  const perWork = risks.map(r => {
    // Convert 0-1 to 0-100
    const rawScore = r.risk_score || 0;
    const score100 = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
    
    const flags = flagMap[r.work_id] || [];
    
    // Mock factors based on flags for the UI
    const factors = flags.map(f => ({
        module: f.module_code,
        contribution: f.severity === 'CRITICAL' ? 35 : f.severity === 'HIGH' ? 25 : f.severity === 'MEDIUM' ? 15 : 5,
        severity: f.severity,
        message: f.evidence?.message || f.evidence?.detail || 'No detailed message provided'
    }));

    // Sort factors by contribution
    factors.sort((a,b) => b.contribution - a.contribution);

    return {
      work_id: r.work_id,
      risk_score: score100,
      severity: r.tier || 'LOW',
      module_count: flags.length,
      flags,
      factors,
      timestamp: r.updated_at,
      work_details: workMap[r.work_id] || null,
    };
  });

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
