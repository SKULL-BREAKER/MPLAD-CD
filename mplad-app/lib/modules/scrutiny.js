'use server';
import db from '../db';
import { appendAuditLog } from './audit';
import { checkSanctionWillOverCommit } from './entitlement';

/**
 * SANCTION: Authority sanctions a proposal → status becomes SANCTIONED.
 */
export async function sanctionProposal(proposal_id, implementing_agency_id, sanctioned_amount) {
  if (!proposal_id) throw new Error('proposal_id is required.');
  if (!implementing_agency_id) throw new Error('implementing_agency_id is required.');
  if (!sanctioned_amount || sanctioned_amount <= 0) throw new Error('sanctioned_amount must be > 0.');

  if (sanctioned_amount < 100_000) {
    throw new Error(`Minimum sanction amount is ₹1,00,000 per MPLADS guidelines. Requested: ₹${sanctioned_amount.toLocaleString()}`);
  }

  return await db.$transaction(async (tx) => {
    // C1 — Fetch proposal
    const proposal = await tx.work.findUnique({ where: { id: proposal_id } });
    if (!proposal) throw new Error(`Proposal not found: ${proposal_id}`);

    // C3 — Prevent double-sanctioning
    if (proposal.status !== 'PROPOSED') {
      throw new Error(`Proposal ${proposal_id} has already been sanctioned or rejected.`);
    }

    // C2 — Verify implementing agency exists
    const agency = await tx.agency.findUnique({ where: { id: implementing_agency_id } });
    if (!agency) throw new Error(`Implementing agency not found: ${implementing_agency_id}`);

    // C1 — Over-commitment guard (balance derived from Works inside the same tx)
    await checkSanctionWillOverCommit(proposal.mp_id, proposal.fy, sanctioned_amount);

    // Update WORK
    const work = await tx.work.update({
      where: { id: proposal_id },
      data: {
        agency_id: implementing_agency_id,
        sanctioned_amount,
        status: 'SANCTIONED',
      },
    });

    // Append immutable audit record
    await appendAuditLog('AUTHORITY', proposal_id, 'SANCTIONED');

    return work;
  });
}

/**
 * REJECT: Authority rejects a proposal — status becomes DROPPED.
 */
export async function rejectProposal(proposal_id, reason_term_id) {
  if (!proposal_id) throw new Error('proposal_id is required.');
  if (!reason_term_id || typeof reason_term_id !== 'string' || reason_term_id.trim() === '') {
    throw new Error('A canonical reason_term_id must be provided for rejection.');
  }

  // Verify proposal exists
  const proposal = await db.work.findUnique({ where: { id: proposal_id } });
  if (!proposal) throw new Error(`Proposal not found: ${proposal_id}`);

  // Verify it has not already been sanctioned
  if (proposal.status !== 'PROPOSED') {
    throw new Error(`Proposal ${proposal_id} has already been sanctioned and cannot be rejected.`);
  }

  await db.work.update({
    where: { id: proposal_id },
    data: { status: 'DROPPED' }
  });

  // Append ACTION-AUDIT with exactly ONE minimal reason — the proposal_id is the affected identity
  await appendAuditLog('AUTHORITY', proposal_id, 'REJECTED', reason_term_id.trim());

  return { success: true };
}
