'use server';
import db from '../db';

// ── Canonical MPLADS Priority Sectors (as defined in real guidelines) ─────────
const CANONICAL_SECTORS = new Set([
  'Drinking Water', 'Education', 'Electricity', 'Non-Conventional Energy',
  'Healthcare & Sanitation', 'Irrigation', 'Railways/Roads/Bridges', 'Sports',
  'Agriculture', 'Self-Help Group', 'Urban Development', 'Other',
]);

// ── AI SUPPORT: ELIGIBILITY ──────────────────────────────────────────────────
// Read-only. Returns eligibility signals. isIndividualBenefit=true → absolute disqualifier.
function mockEligibilityAI(public_utility_term_id) {
  const lower = public_utility_term_id.toLowerCase();
  if (lower.includes('individual') || lower.includes('personal')) {
    return { isCommunityPublicUtility: false, isIndividualBenefit: true, isDurableCommunityAsset: false };
  }
  return { isCommunityPublicUtility: true, isIndividualBenefit: false, isDurableCommunityAsset: true };
}

// ── AI SUPPORT: DUPLICATION ──────────────────────────────────────────────────
// Read-only. Checks active-state WORKs.
const ACTIVE_WORK_STATES = ['SANCTIONED', 'IN-EXECUTION', 'COMPLETED', 'sanctioned', 'in_progress', 'completed'];

async function mockDuplicationAI(district_id, category, area_type) {
  // Check against active-state WORKs
  const activeWork = await db.work.findFirst({
    where: {
      district_id,
      status: { in: ACTIVE_WORK_STATES },
      category,
      area_type,
    },
  });
  if (activeWork) {
    return { duplicateStatus: 'LIKELY_DUP', reason: 'Similar work is already active.' };
  }

  return { duplicateStatus: 'NO_DUP', reason: '' };
}

// ── STRUCTURE PROPOSAL ───────────────────────────────────────────────────────
export async function structureProposal(data) {
  const { constituency_id, member_id, year_val, public_utility_term_id, public_locality_term_id, requested_amount } = data;

  // ── Field validation ──
  if (!constituency_id || typeof constituency_id !== 'string') {
    throw new Error('constituency_id is required.');
  }
  if (!member_id || typeof member_id !== 'string') {
    throw new Error('member_id is required.');
  }
  if (!year_val) {
    throw new Error('year_val must be provided.');
  }
  if (!public_utility_term_id || typeof public_utility_term_id !== 'string' || public_utility_term_id.trim() === '') {
    throw new Error('public_utility_term_id must be a non-empty canonical term.');
  }
  // Enforce canonical sector — only real MPLADS priority sectors accepted
  if (!CANONICAL_SECTORS.has(public_utility_term_id.trim())) {
    throw new Error(`'${public_utility_term_id}' is not a canonical MPLADS priority sector. Must be one of: ${[...CANONICAL_SECTORS].join(', ')}.`);
  }
  if (!public_locality_term_id || typeof public_locality_term_id !== 'string' || public_locality_term_id.trim() === '') {
    throw new Error('public_locality_term_id must be a non-empty canonical term.');
  }
  if (!requested_amount || requested_amount <= 0) {
    throw new Error('requested_amount must be greater than 0.');
  }

  // ── AI support: Eligibility (read-only) ──
  const eligibility = mockEligibilityAI(public_utility_term_id.trim());
  if (eligibility.isIndividualBenefit) {
    throw new Error('Absolute Disqualifier: Proposal is for individual benefit and cannot be submitted.');
  }

  // ── AI support: Duplication (read-only) ──
  const duplication = await mockDuplicationAI(constituency_id, public_utility_term_id.trim(), public_locality_term_id.trim());

  // ── Persist proposal (append-only) ──
  const proposal = await db.work.create({
    data: {
      id: `PROP-${Date.now()}`,
      district_id: constituency_id,
      mp_id: member_id,
      fy: String(year_val),
      category: public_utility_term_id.trim(),
      area_type: public_locality_term_id.trim(),
      sanctioned_amount: requested_amount,
      expenditure: 0,
      status: 'PROPOSED',
    },
  });

  return { proposal, aiSupport: { eligibility, duplication } };
}
