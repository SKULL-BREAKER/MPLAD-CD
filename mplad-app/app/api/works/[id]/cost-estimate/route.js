/**
 * GET /api/works/{id}/cost-estimate
 * Returns: { norm, peer, ml, verdict, breakdown, evidenceCard }
 *
 * V3 deterministic pipeline:
 *   1. Load work from DB
 *   2. Resolve spec (officer_confirmed > provided > inferred)
 *   3. C3: norm estimate (deterministic)
 *   4. C4: ML corroborator (optional, never flags alone)
 *   5. C5: verdict triangulation
 *   6. Persist to CostEstimate table
 *   7. Return full breakdown + evidence card
 */

import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { estimateNorm, computeVerdict, generateEvidenceCard,
         resolveSpec, sanctionMonth, ESTIMATOR_CONFIG } from '../../../../../lib/modules/costEstimator.js';
import { inferSpec } from '../../../../../lib/modules/boqSynthesizer.js';
import { predictCost } from '../../../../../lib/modules/mlCorroborator.js';
import { getIndexAt } from '../../../../../lib/modules/normRegistry.js';

// ─────────────────────────────────────────────────────────────────────────────
// Peer estimate: simple MAD-normalized z from same-category works
// ─────────────────────────────────────────────────────────────────────────────
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
function mad(arr, med) { return median(arr.map(v => Math.abs(v - med))); }

async function getPeerEstimate(work, category) {
  const wtype = work.category || category || '';
  // Find peers: same utility type
  const peers = await db.work.findMany({
    where: {
      id: { not: work.id },
      category: wtype,
      sanctioned_amount: { gt: 0 },
    },
    select: { sanctioned_amount: true },
    take: 50,
  });

  const amounts = peers.map(p => p.sanctioned_amount);
  if (amounts.length < 2) return { median: null, n: amounts.length, z_score: null };

  const med   = median(amounts);
  const madV  = mad(amounts, med);
  const scale = madV * 1.4826;
  const z     = scale < 1e-9 ? 0 : (work.sanctioned_amount - med) / scale;

  return { median: med, n: amounts.length, z_score: Math.round(z * 100) / 100 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Index-check: recompute norm at older indices (price-drive detection)
// ─────────────────────────────────────────────────────────────────────────────
function computeIndexCheck(normResult, month, district, category, specJson) {
  // Recompute at 3 years prior
  try {
    const year = parseInt(month.split('-')[0]);
    const oldMonth = `${year - 3}-${month.split('-')[1]}`;
    const { estimateNorm: en } = require('../../../../../lib/modules/costEstimator.js');
    // We use the same function — if old indices are lower, it produces a lower expected
    return { old_month: oldMonth, old_norm_expected: null }; // Simplified: full recompute is in C5
  } catch { return { old_month: null, old_norm_expected: null }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request, { params }) {
  const { id } = params;

  try {
    // 1. Load work
    const work = await db.work.findUnique({
      where: { id: id }
    });
    if (!work) {
      return NextResponse.json({ success: false, error: 'Work not found' }, { status: 404 });
    }

    // 2. Load or infer spec
    const dbSpec = await db.$queryRawUnsafe(
      'SELECT * FROM WorkSpec WHERE work_id = ? LIMIT 1', id
    ).then(rows => rows[0] ?? null).catch(() => null);

    const flat = {
      ...work,
      public_utility_term_id:  work.category || '',
      public_locality_term_id: work.area_type || '',
    };

    let category, specJson, specSource, specConfidence;
    if (dbSpec) {
      category       = JSON.parse(dbSpec.spec_json)?._category || dbSpec.spec_json.category;
      specJson       = JSON.parse(dbSpec.spec_json);
      specSource     = dbSpec.source;
      specConfidence = dbSpec.confidence;
    } else {
      // Infer from title
      const title = [flat.public_utility_term_id, flat.public_locality_term_id].join(' ');
      const inferred = inferSpec(title);
      category       = inferred.category;
      specJson       = inferred.spec;
      specSource     = 'inferred';
      specConfidence = inferred.confidence;

      // Persist inferred spec if reasonable confidence
      if (category && specConfidence > 0.3) {
        const specData = { ...specJson, _category: category };
        await db.$executeRawUnsafe(
          'INSERT OR IGNORE INTO WorkSpec (work_id, spec_json, source, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          id, JSON.stringify(specData), 'inferred', specConfidence,
          new Date().toISOString(), new Date().toISOString()
        ).catch(() => {}); // non-fatal
      }
    }

    const month    = sanctionMonth(work);
    const district = work.constituency_id || '';

    // 3. C3 — Norm estimate (deterministic)
    const normResult = category
      ? estimateNorm(flat, category, specJson, month, district)
      : { method: 'norm', expected_cost: null, error: 'Category could not be determined' };

    const boqBreakdown = normResult.breakdown_json
      ? JSON.parse(normResult.breakdown_json) : null;

    // 4. Peer estimate
    const peer = await getPeerEstimate(flat, category);

    // 5. C4 — ML corroborator (never flags alone)
    const mlResult = predictCost(flat, category, 1.0);

    // 6. C5 — Verdict
    const verdictResult = normResult.expected_cost
      ? computeVerdict(
          normResult.expected_cost,
          work.sanctioned_amount,
          peer,
          mlResult.ml_pred,
          null
        )
      : null;

    // 7. Evidence card
    const evidenceCard = verdictResult
      ? generateEvidenceCard(flat, normResult, verdictResult, peer, boqBreakdown)
      : null;

    // 8. Persist estimates
    if (normResult.expected_cost) {
      await db.$executeRawUnsafe(
        'INSERT OR REPLACE INTO CostEstimate (id, work_id, method, expected_cost, mape, breakdown_json, verdict, verdict_json, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?)',
        id, 'norm', normResult.expected_cost, 0,
        normResult.breakdown_json,
        verdictResult?.verdict ?? null,
        verdictResult ? JSON.stringify(verdictResult) : null,
        new Date().toISOString()
      ).catch(() => {});
    }
    if (mlResult.ml_pred) {
      await db.$executeRawUnsafe(
        'INSERT OR REPLACE INTO CostEstimate (id, work_id, method, expected_cost, mape, breakdown_json, verdict, verdict_json, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?)',
        id, 'ml', mlResult.ml_pred, mlResult.mape ?? 0, '{}', null, null,
        new Date().toISOString()
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      work_id: id,
      sanctioned_amount: work.sanctioned_amount,
      spec: {
        category, specJson, source: specSource, confidence: specConfidence,
      },
      estimates: {
        norm: {
          expected_cost:  normResult.expected_cost,
          direct_cost:    normResult.direct_cost,
          materials_cost: normResult.materials_cost,
          labor_cost:     normResult.labor_cost,
          contingency:    normResult.contingency,
          overhead:       normResult.overhead,
          error:          normResult.error ?? null,
        },
        peer: {
          median:  peer.median,
          n:       peer.n,
          z_score: peer.z_score,
        },
        ml: {
          prediction: mlResult.ml_pred,
          mape:       mlResult.mape,
          available:  mlResult.available,
          note:       mlResult.temporal_split_note,
        },
      },
      boq: boqBreakdown?.boq_items ?? [],
      verdict: verdictResult,
      evidence_card: evidenceCard,
      config: ESTIMATOR_CONFIG,
    });

  } catch (err) {
    console.error('[cost-estimate]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
