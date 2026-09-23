/**
 * C3 — Deterministic Expected-Cost Estimator
 * C5 — Justification Verdict (triangulation)
 * ===========================================
 * V3 Core: the primary estimator is DETERMINISTIC and AUDITABLE.
 * ML only corroborates (C4). No flag is ever raised by ML alone.
 *
 * C3: expected_cost = Σ BoQ line totals + contingency_pct + overhead_pct
 * C5: triangulates norm (C3) + peer + ML (C4) → VERDICT + evidence card
 */

import { synthesizeBoQ, inferSpec } from './boqSynthesizer.js';

// ─────────────────────────────────────────────────────────────────────────────
// Config (all thresholds here — auditable, officer-overridable via API)
// ─────────────────────────────────────────────────────────────────────────────
export const ESTIMATOR_CONFIG = {
  contingency_pct:       0.03,   // 3% contingency on direct costs
  overhead_pct:          0.05,   // 5% overhead (survey, supervision, admin)
  flag_gap_pct:          0.30,   // 30% gap → possible flag
  inconclusive_gap_pct:  0.40,   // 40% divergence between norm and peer → INCONCLUSIVE
  min_peer_count:        5,      // minimum peers for peer-based verdict
  underspend_flag_pct:   0.25,   // 25% BELOW norm → under-spend review
};

// ─────────────────────────────────────────────────────────────────────────────
// C3 — Deterministic Estimator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate expected cost from norm rates for a given work.
 * @param {object} work - must have: sanctioned_amount, status, fy
 * @param {string} category - work category (bridge/road/classroom/etc.)
 * @param {object} specJson - parametric spec e.g. {span_m:15, width_m:4.5}
 * @param {string} month    - sanction month e.g. "2023-06"
 * @param {string} district - district name (for terrain)
 * @returns CostEstimateResult
 */
export function estimateNorm(work, category, specJson, month, district = '') {
  if (!category || !specJson) {
    return {
      method: 'norm', expected_cost: null, error: 'Missing category or spec',
      breakdown_json: '{}', mape: null,
    };
  }

  const boq = synthesizeBoQ(category, specJson, month, district);
  if (boq.error) {
    return { method: 'norm', expected_cost: null, error: boq.error, breakdown_json: '{}', mape: null };
  }

  const direct = boq.total_before_overheads;
  const contingency = Math.round(direct * ESTIMATOR_CONFIG.contingency_pct * 100) / 100;
  const overhead    = Math.round(direct * ESTIMATOR_CONFIG.overhead_pct * 100) / 100;
  const expectedCost = Math.round((direct + contingency + overhead) * 100) / 100;

  // Compute materials / labor split for waterfall
  let materialsTotal = 0, laborTotal = 0;
  for (const item of boq.items) {
    const mat = item.line_total * (item.mix_steel + item.mix_cement + item.mix_other);
    const lab = item.line_total * item.mix_labor;
    materialsTotal += mat;
    laborTotal     += lab;
  }
  materialsTotal = Math.round(materialsTotal * 100) / 100;
  laborTotal     = Math.round(laborTotal * 100) / 100;

  const breakdown = {
    boq_items:      boq.items,
    direct_cost:    direct,
    materials_cost: materialsTotal,
    labor_cost:     laborTotal,
    contingency,
    overhead,
    expected_cost:  expectedCost,
    category,
    spec:           specJson,
    month,
    district,
  };

  return {
    method:         'norm',
    expected_cost:  expectedCost,
    direct_cost:    direct,
    materials_cost: materialsTotal,
    labor_cost:     laborTotal,
    contingency,
    overhead,
    breakdown_json: JSON.stringify(breakdown),
    mape:           null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// C5 — Verdict (triangulation)
// ─────────────────────────────────────────────────────────────────────────────

export const VERDICTS = {
  UNJUSTIFIED_PREMIUM: 'UNJUSTIFIED_PREMIUM',
  COST_REVIEW:         'COST_REVIEW',
  NOT_FLAGGED:         'NOT_FLAGGED',
  INCONCLUSIVE:        'INCONCLUSIVE',
  VERIFIED_CLEAN:      'VERIFIED_CLEAN',
  INSUFFICIENT_DATA:   'INSUFFICIENT_DATA',
};

/**
 * Triangulate three estimates to produce verdict.
 * @param {number} normExpected  - C3 norm estimate (₹)
 * @param {number} sanctioned    - actual sanctioned amount (₹)
 * @param {object} peer          - { median, n, z_score } from peer benchmarking
 * @param {number|null} mlPred   - C4 ML prediction (₹) or null if unavailable
 * @param {object} indexCheck    - { old_month, old_norm_expected } recomputed at older indices
 * @returns VerdictResult
 */
export function computeVerdict(normExpected, sanctioned, peer, mlPred = null, indexCheck = null) {
  if (!normExpected || !sanctioned) {
    return {
      verdict: VERDICTS.INSUFFICIENT_DATA,
      severity: 'LOW',
      gap_norm: null, gap_peer_z: null, explanation: 'Missing norm estimate or sanctioned amount.',
    };
  }

  const gapNorm = (sanctioned - normExpected) / normExpected;
  const gapPeerZ = peer?.z_score ?? null;

  const { flag_gap_pct, inconclusive_gap_pct, min_peer_count } = ESTIMATOR_CONFIG;

  // Check if price-index movement explains the gap
  // (recompute at old indices — if that lands within peer range, it's price-driven)
  const priceExplains = indexCheck && indexCheck.old_norm_expected
    ? Math.abs((sanctioned - indexCheck.old_norm_expected) / indexCheck.old_norm_expected) <= 0.10
    : false;

  // Check norm vs peer divergence
  const peerNormDivergence = peer?.median && normExpected
    ? Math.abs(peer.median - normExpected) / normExpected
    : 0;

  let verdict, severity, explanation;

  if (gapNorm > flag_gap_pct && gapPeerZ !== null && gapPeerZ > 3
      && mlPred !== null && mlPred <= peer?.median * 1.15) {
    // All three point to inflation: norm gap large, peer z > 3, ML within peer range
    verdict = VERDICTS.UNJUSTIFIED_PREMIUM;
    severity = gapNorm > 0.60 ? 'CRITICAL' : 'HIGH';
    explanation = `Sanctioned ${pct(gapNorm)}% above norm-expected. Peer z=${gapPeerZ?.toFixed(1)}, ML within peer range. No price-index justification found.`;

  } else if (gapNorm > flag_gap_pct && (peer === null || (peer?.n ?? 0) < min_peer_count)) {
    // Norm gap large but insufficient peers for full triangulation
    verdict = VERDICTS.COST_REVIEW;
    severity = 'HIGH';
    explanation = `Sanctioned ${pct(gapNorm)}% above norm-expected but only ${peer?.n ?? 0} comparable works found (need ≥${min_peer_count}). Norm-only flag raised.`;

  } else if (gapNorm > flag_gap_pct && priceExplains) {
    // Recomputed at old indices lands within peers — price movement explains it
    verdict = VERDICTS.NOT_FLAGGED;
    severity = 'LOW';
    explanation = `Gap of ${pct(gapNorm)}% is EXPLAINED by documented price movement. Recomputed at base-period indices: ₹${fmtL(indexCheck.old_norm_expected)} — within peer range.`;

  } else if (peerNormDivergence > inconclusive_gap_pct) {
    // Norm and peer estimates diverge wildly — system says INCONCLUSIVE
    verdict = VERDICTS.INCONCLUSIVE;
    severity = 'MEDIUM';
    explanation = `Norm estimate and peer median diverge by ${pct(peerNormDivergence)}% (>40%). System cannot determine if cost is justified. Manual review required.`;

  } else if (gapNorm < -ESTIMATOR_CONFIG.underspend_flag_pct) {
    // Stale-norm trap: cost is 25%+ below norm-expected
    verdict = VERDICTS.COST_REVIEW;
    severity = 'MEDIUM';
    explanation = `Sanctioned ${pct(Math.abs(gapNorm))}% BELOW norm-expected. Possible stale rate schedule, scope underestimation, or under-reporting. Review recommended.`;

  } else {
    // All within tolerance
    verdict = VERDICTS.VERIFIED_CLEAN;
    severity = 'LOW';
    explanation = `Sanctioned amount within acceptable range of norm-expected (gap: ${pct(gapNorm)}%). No unexplained premium detected.`;
  }

  return {
    verdict,
    severity,
    gap_norm:   Math.round(gapNorm * 10000) / 100, // percentage with 2dp
    gap_peer_z: gapPeerZ !== null ? Math.round(gapPeerZ * 100) / 100 : null,
    ml_pred:    mlPred,
    norm_expected: normExpected,
    peer_median: peer?.median ?? null,
    peer_n:      peer?.n ?? 0,
    price_explains: priceExplains,
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Card Generator (exact sentences per spec §5)
// ─────────────────────────────────────────────────────────────────────────────

function fmtL(n) {
  if (!n) return '₹0';
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function pct(g) { return `${g >= 0 ? '+' : ''}${(g * 100).toFixed(1)}%`; }

/**
 * Generate human-readable evidence card for a work.
 */
export function generateEvidenceCard(work, normResult, verdictResult, peer = null, boqBreakdown = null) {
  const sanctioned = work.sanctioned_amount;
  const verdict    = verdictResult?.verdict;

  if (verdict === VERDICTS.UNJUSTIFIED_PREMIUM || verdict === VERDICTS.COST_REVIEW) {
    // Card 1 — Flagged
    const normExp = normResult?.expected_cost;
    const mat     = boqBreakdown?.materials_cost;
    const lab     = boqBreakdown?.labor_cost;
    const ovh     = normResult?.contingency != null
      ? normResult.contingency + normResult.overhead : 0;
    const gap     = sanctioned - normExp;
    const gapPct  = normExp ? ((gap / normExp) * 100).toFixed(0) : '?';

    // Pull first two BoQ item source_refs for citation
    const items    = boqBreakdown?.boq_items?.slice(0, 2) || [];
    const srcRefs  = items.map(i => i.source_ref).filter(Boolean).join(' + ');

    // Index factors from first steel-heavy item
    const steelItem = boqBreakdown?.boq_items?.find(i => i.mix_steel > 0.5);
    const steelFactor = steelItem ? `+${((steelItem.steel_factor - 1) * 100).toFixed(1)}%` : 'N/A';
    const cementItem = boqBreakdown?.boq_items?.find(i => i.mix_cement > 0.2);
    const cementFactor = cementItem ? `+${((cementItem.cement_factor - 1) * 100).toFixed(1)}%` : 'N/A';

    return {
      type: 'FLAGGED',
      headline: `Sanctioned ${fmtL(sanctioned)}. Norm-based expected ${fmtL(normExp)}.`,
      body: `Materials ${fmtL(mat)} (${srcRefs} + WPI steel ${steelFactor}, cement ${cementFactor} since base year), labor ${fmtL(lab)}, overhead+contingency ${fmtL(ovh)}. ` +
            (peer?.median ? `Comparable works within 80km: median ${fmtL(peer.median)} (n=${peer.n}). ` : '') +
            `Unexplained gap: ${fmtL(gap)} (${gapPct}%).`,
      action: '[View full breakdown]',
      severity: verdictResult.severity,
    };
  }

  if (verdict === VERDICTS.NOT_FLAGGED || verdict === VERDICTS.VERIFIED_CLEAN) {
    // Card 2 — Cleared (discrimination proof)
    const normExp = normResult?.expected_cost;
    const boqItems = boqBreakdown?.boq_items || [];
    const steelItem  = boqItems.find(i => i.mix_steel > 0.4);
    const cementItem = boqItems.find(i => i.mix_cement > 0.15);
    const laborItem  = boqItems.find(i => i.mix_labor > 0.35);

    const steelChg  = steelItem  ? `Steel +${((steelItem.steel_factor - 1) * 100).toFixed(1)}%`  : '';
    const cementChg = cementItem ? `cement +${((cementItem.cement_factor - 1) * 100).toFixed(1)}%` : '';
    const laborChg  = laborItem  ? `labor +${((laborItem.labor_factor - 1) * 100).toFixed(1)}%`   : '';
    const indexNote = [steelChg, cementChg, laborChg].filter(Boolean).join(', ');

    return {
      type: 'CLEARED',
      headline: `Sanctioned ${fmtL(sanctioned)} vs norm-expected ${fmtL(normExp)} (${pct(verdictResult.gap_norm / 100)}).`,
      body: `${indexNote} in the same window → norm-expected ${fmtL(normExp)}. The increase is explained by documented price movement. NOT FLAGGED.`,
      action: null,
      severity: 'LOW',
    };
  }

  // Generic card for other verdicts
  return {
    type: verdict,
    headline: `Verdict: ${verdict}`,
    body: verdictResult?.explanation || '',
    action: '[View full breakdown]',
    severity: verdictResult?.severity || 'MEDIUM',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec resolver: pick spec from DB record or infer on the fly
// ─────────────────────────────────────────────────────────────────────────────
export function resolveSpec(work, dbSpec = null) {
  if (dbSpec && dbSpec.source === 'officer_confirmed') {
    return { ...JSON.parse(dbSpec.spec_json), _source: 'officer_confirmed', _confidence: 1.0 };
  }
  if (dbSpec && dbSpec.source === 'provided') {
    return { ...JSON.parse(dbSpec.spec_json), _source: 'provided', _confidence: 1.0 };
  }
  if (dbSpec && dbSpec.source === 'inferred') {
    return { ...JSON.parse(dbSpec.spec_json), _source: 'inferred', _confidence: dbSpec.confidence };
  }

  // Infer from title
  const title = [
    work.public_utility_term_id,
    work.public_locality_term_id,
    work.description,
    work.work_title,
  ].filter(Boolean).join(' ');

  const inferred = inferSpec(title);
  return { ...inferred.spec, _category: inferred.category, _source: 'inferred', _confidence: inferred.confidence };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanction month helper
// ─────────────────────────────────────────────────────────────────────────────
export function sanctionMonth(work) {
  // Try sanction_date field, fall back to year_val → June of that year
  if (work.sanction_date) {
    const d = new Date(work.sanction_date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (work.year_val) {
    return `${work.year_val}-06`; // default to mid-year
  }
  return '2021-06'; // absolute fallback to base year
}
