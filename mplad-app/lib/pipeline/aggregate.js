const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const MODULE_WEIGHTS = {
  D1_DUPLICATE: 15,
  D1_SPLIT: 25,
  D2_COST: 30,
  D3_DURATION: 20,
  D3_STALLED: 20,
  D5_VENDOR: 12,
  D7_RULES: 18,
  C5_COST: 28,
};
const SEV_MULT = { CRITICAL: 1.0, HIGH: 0.75, MEDIUM: 0.50, LOW: 0.25 };

async function runAggregate() {
  console.log('📊 Phase 2: Running Aggregation...');

  // 1. Read Presets
  const appConfigPath = path.join(__dirname, '..', '..', 'config', 'app.yaml');
  const opConfigPath  = path.join(__dirname, '..', '..', 'config', 'operating_points.yaml');
  
  let activePreset = 'balanced';
  if (fs.existsSync(appConfigPath)) {
    const appCfg = yaml.parse(fs.readFileSync(appConfigPath, 'utf8'));
    if (appCfg && appCfg.active_preset) activePreset = appCfg.active_preset;
  }
  
  const opCfg = yaml.parse(fs.readFileSync(opConfigPath, 'utf8'));
  const preset = opCfg.presets[activePreset];
  if (!preset) {
    throw new Error(`Preset ${activePreset} not found in operating_points.yaml`);
  }
  
  console.log(`Using preset: ${activePreset}`);
  const th = preset.thresholds;
  const tiers = preset.tiers;

  // 2. Fetch all raw DetectionResults
  const results = await db.detectionResult.findMany();
  console.log(`Fetched ${results.length} detection results from DB.`);
  
  const workFlags = {};

  for (const r of results) {
    if (!workFlags[r.work_id]) workFlags[r.work_id] = [];
    
    let severity = null;
    let risk_score = 0;

    // Apply thresholds based on module_code
    switch (r.detector) {
      case 'D1':
        if (r.score >= th.d1_duplicates) {
          severity = r.score >= (th.d1_duplicates + 0.05) ? 'CRITICAL' : 'HIGH';
          risk_score = 70;
        }
        break;
      case 'D2':
        if (r.score >= th.d2_cost) {
          severity = r.score >= th.d2_cost + 1.0 ? 'CRITICAL' : 'HIGH';
          risk_score = 50 + (r.score - th.d2_cost) * 10;
        }
        break;
      case 'D3':
        // we'll just check if it's high duration or stalled
        if (r.score >= 365 * 3) {
          severity = 'HIGH';
          risk_score = 60;
        } else if (r.score <= th.d3_timeline_gap) {
          severity = 'CRITICAL';
          risk_score = 85;
        }
        break;
      case 'D5':
        if (r.score >= th.d5_vendor) {
          severity = r.score >= th.d5_vendor + 0.20 ? 'CRITICAL' : 'HIGH';
          risk_score = r.score * 80 + 20;
        }
        break;
      case 'D7':
        if (r.score >= 1.0) {
          severity = 'HIGH';
          risk_score = 75;
        }
        break;
    }

    if (severity) {
      workFlags[r.work_id].push({
        module_code: r.detector,
        severity,
        risk_score: Math.min(100, Math.round(risk_score)),
        evidence: r.evidence_json ? JSON.parse(r.evidence_json) : null,
      });
    }
  }

  // 3. Aggregate WorkRisk
  const workRisks = [];
  for (const [work_id, flags] of Object.entries(workFlags)) {
    if (flags.length === 0) continue;
    
    // fuse scores
    const byModule = {};
    for (const f of flags) {
      if (!byModule[f.module_code]) byModule[f.module_code] = [];
      byModule[f.module_code].push(f);
    }
    
    let total = 0;
    for (const [mod, mflags] of Object.entries(byModule)) {
      const worst = mflags.sort((a,b) => b.risk_score - a.risk_score)[0];
      const w = MODULE_WEIGHTS[mod] || 10;
      const sev = SEV_MULT[worst.severity] || 0.5;
      const c = (worst.risk_score / 100) * w * sev;
      total += c;
    }
    
    // Normalize to max 100
    const composite_score = Math.min(100, total);
    
    // Tier assignment based on operating points preset
    let tier = 'LOW';
    const normalizedScore = composite_score / 100.0;
    if (normalizedScore >= tiers.critical) tier = 'CRITICAL';
    else if (normalizedScore >= tiers.high) tier = 'HIGH';
    else if (normalizedScore >= (tiers.high * 0.5)) tier = 'MEDIUM';

    workRisks.push({
      work_id,
      risk_score: composite_score,
      tier,
      contributions_json: JSON.stringify(flags),
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`🧹 Clearing previous WorkRisks...`);
  await db.workRisk.deleteMany({});

  console.log(`💾 Saving ${workRisks.length} aggregated risks to WorkRisk...`);
  const BATCH_SIZE = 5000;
  for (let i = 0; i < workRisks.length; i += BATCH_SIZE) {
    const batch = workRisks.slice(i, i + BATCH_SIZE);
    await db.workRisk.createMany({ data: batch });
  }

  console.log('✅ Phase 2 Complete.');
}

if (require.main === module) {
  runAggregate().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
}

module.exports = { runAggregate };
