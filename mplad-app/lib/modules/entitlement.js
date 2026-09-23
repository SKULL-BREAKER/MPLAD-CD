'use server';
import db from '../db';

/**
 * Returns derived entitlement balance for (member_id, year_val).
 * balance = annualAmount − sum(sanctioned_amount of WORKs whose status != COMPLETED)
 */
export async function getEntitlementBalance(member_id, year_val) {
  if (!member_id || !year_val) return { annual: 0, balance: 0, committed: 0 };

  const flows = await db.fundFlow.findMany({
    where: { mp_id: member_id, fy: String(year_val) },
  });

  const annual_amount = flows.reduce((sum, f) => sum + (f.entitlement || 0), 0);

  if (annual_amount === 0) return { annual: 0, balance: 0, committed: 0 };

  const activeWorks = await db.work.findMany({
    where: { 
      mp_id: member_id, 
      fy: String(year_val), 
      status: { notIn: ['COMPLETED', 'UTILISED', 'completed', 'utilised'] } 
    },
    select: { sanctioned_amount: true },
  });

  const committed = activeWorks.reduce((sum, w) => sum + (w.sanctioned_amount || 0), 0);
  const balance = annual_amount - committed;

  return { annual: annual_amount, committed, balance };
}

/**
 * Guard: throws if sanctioning `amount` for (member_id, year_val) would cause over-commitment.
 */
export async function checkSanctionWillOverCommit(member_id, year_val, amount) {
  const { balance } = await getEntitlementBalance(member_id, year_val);
  if (amount > balance) {
    throw new Error(
      `Over-commitment prevented: sanction of ₹${amount.toLocaleString()} exceeds ` +
      `available balance of ₹${balance.toLocaleString()} for (member_id=${member_id}, year=${year_val}).`
    );
  }
}

/**
 * SC/ST Earmarking Tracker.
 * Real MPLADS mandates: ≥15% of annual funds for SC areas, ≥7.5% for ST areas.
 * Tracks sanctioned amounts tagged as SC or ST community area works.
 */
export async function getSCSTUtilisation(member_id, year_val) {
  const { annual } = await getEntitlementBalance(member_id, year_val);

  const works = await db.work.findMany({
    where: { mp_id: member_id, fy: String(year_val) }
  });

  const scAmount = works
    .filter(w => (w.area_type || w.village || '').toUpperCase().includes('SC-') || (w.area_type || w.village || '').toUpperCase().includes('SC '))
    .reduce((s, w) => s + (w.sanctioned_amount || 0), 0);

  const stAmount = works
    .filter(w => (w.area_type || w.village || '').toUpperCase().includes('ST-') || (w.area_type || w.village || '').toUpperCase().includes('ST '))
    .reduce((s, w) => s + (w.sanctioned_amount || 0), 0);

  const scTarget = annual * 0.15;
  const stTarget = annual * 0.075;

  return {
    annual,
    scAmount, scTarget, scPct: annual > 0 ? Math.round((scAmount / annual) * 100) : 0,
    stAmount, stTarget, stPct: annual > 0 ? Math.round((stAmount / annual) * 100) : 0,
    scMet: scAmount >= scTarget,
    stMet: stAmount >= stTarget,
  };
}
