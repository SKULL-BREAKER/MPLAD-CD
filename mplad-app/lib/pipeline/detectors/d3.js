// d3.js
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

function getDaysBetween(d1, d2) {
  if (!d1 || !d2) return null;
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  if (isNaN(t1) || isNaN(t2)) return null;
  return Math.floor((t1 - t2) / (1000 * 60 * 60 * 24));
}

async function runD3(works, configDir) {
  console.log(`[D3] Running Timeline Detector on ${works.length} works...`);

  // Load ref_today from app.yaml
  let ref_today = new Date();
  try {
    const appYamlPath = path.join(configDir, 'app.yaml');
    if (fs.existsSync(appYamlPath)) {
      const appConfig = yaml.parse(fs.readFileSync(appYamlPath, 'utf8'));
      if (appConfig && appConfig.ref_today) {
        ref_today = new Date(appConfig.ref_today);
      }
    }
  } catch (e) {
    console.warn(`[D3] Warning: Could not read ref_today from config/app.yaml, using current date.`);
  }

  const results = [];

  for (const w of works) {
    let stalled_days = null;
    let not_started_days = null;
    let flash_gap_days = null;
    let start_gap_days = null;

    if (w.status === 'in_progress' && w.sanction_date) {
      stalled_days = getDaysBetween(ref_today, w.sanction_date);
    }
    
    if (w.status === 'sanctioned' && w.sanction_date) {
      not_started_days = getDaysBetween(ref_today, w.sanction_date);
    }

    if (w.status === 'completed' && w.completion_date && w.sanction_date) {
      flash_gap_days = getDaysBetween(w.completion_date, w.sanction_date);
    }

    if (w.start_date && w.sanction_date) {
      start_gap_days = getDaysBetween(w.start_date, w.sanction_date);
    }

    // Spend ratio = expenditure / sanctioned_amount
    let spend_ratio = 0;
    if (w.expenditure > 0 && w.sanctioned_amount > 0) {
      spend_ratio = w.expenditure / w.sanctioned_amount;
    }

    // score = flash_gap_days (raw)
    let score = null;
    if (flash_gap_days !== null) score = flash_gap_days;
    else if (stalled_days !== null) score = stalled_days;
    else if (not_started_days !== null) score = not_started_days;
    // We store one row per work. We just use flash_gap_days as score if completed, etc.
    // Spec: "score = flash_gap_days (raw; thresholds live in aggregation)."
    // It says "score = flash_gap_days" but what if it's stalled? The spec implies `score` can be whatever primary raw metric is most relevant, but usually we just store the score that aggregate will use. Aggregate uses `flash_gap_days` and `stalled_days` and `not_started_days` from evidence. 
    // Wait, the spec says exactly: "score = flash_gap_days (raw; thresholds live in aggregation)."
    // If flash_gap_days is null, we can just put 0 or null as score.
    if (score === null) score = 0;

    results.push({
      work_id: w.id,
      detector: 'D3',
      score: parseFloat(score),
      evidence_json: JSON.stringify({
        stalled_days,
        not_started_days,
        flash_gap_days,
        start_gap_days,
        spend_ratio: parseFloat(spend_ratio.toFixed(4))
      })
    });
  }

  return results;
}

module.exports = { runD3 };
