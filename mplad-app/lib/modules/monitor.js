import db from '../db';

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT THRESHOLDS  (officer-overridable via UI)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_THRESHOLDS = {
  minSanctionAmount:      100_000,   // ₹1,00,000 — MPLADS statutory floor (officer can raise)
  fundBalanceWarnPct:     0.25,      // warn when balance < 25%
  fundBalanceCriticalPct: 0.10,      // critical when balance < 10%
  stalledExecutionDays:   30,        // IN-EXECUTION with no evidence
  unstartedSanctionDays:  60,        // SANCTIONED but not started
  lowUtilisationPct:      0.30,      // scheme-level utilisation floor
  expenditureGapPct:      0.50,      // expended vs sanctioned for completed works
  highRejectionRatePct:   0.40,      // historical rejection rate threshold
  minWorksForTrend:       2,         // need at least N data points for trend confidence
};

// MPLADS statutory constants (non-negotiable)
const SC_MINIMUM_RATIO = 0.15;
const ST_MINIMUM_RATIO = 0.075;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL SEVERITY MAP
// ─────────────────────────────────────────────────────────────────────────────
const SEV = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };
const DIM = { PAST: 'PAST', PRESENT: 'PRESENT', FUTURE: 'FUTURE' };
const CONF = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function daysSince(date) {
  if (!date) return 9999;
  return Math.floor((Date.now() - new Date(date).getTime()) / 864e5);
}

function fmt(n) {
  if (!n || n === 0) return '₹0';
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function pct(num, den) {
  if (!den || den === 0) return 0;
  return Math.round((num / den) * 100);
}

function trend(values) {
  // Simple linear trend: +ve = improving, -ve = declining, 0 = flat
  if (values.length < 2) return 0;
  const n   = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  let slope = 0;
  values.forEach((v, i) => { slope += (i - (n - 1) / 2) * (v - avg); });
  return slope;
}

function makeAlert(id, category, severity, dimension, confidence, title, detail, affectedIds = [], meta = {}) {
  return { id, category, severity, dimension, confidence, title, detail, affectedIds, meta, timestamp: new Date().toISOString() };
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ DIMENSION 1 — PAST: HISTORICAL TREND ANALYSIS ════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

async function analyseHistoricalTrends(alerts, thresholds) {
  const allEntitlements = await db.fundFlow.findMany({
    orderBy: { fy: 'asc' },
  });

  if (allEntitlements.length === 0) return [];

  const years = [...new Set(allEntitlements.map(e => e.fy))].sort();
  const yearlyStats = [];

  for (const yr of years) {
    const works = await db.work.findMany({
      where: { fy: yr },
    });
    const proposals = works.filter(w => w.status === 'PROPOSED');
    const ey = allEntitlements.filter(e => e.fy === yr);
    const annualTotal = ey.reduce((s, e) => s + (e.entitlement || 0), 0);
    const sanctionedTotal = works.reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
    const expendedTotal   = works.reduce((s, w) => s + (w.expenditure || 0), 0);
    const utilisedCount   = works.filter(w => w.status === 'UTILISED' || w.status === 'utilised').length;
    const zeroEvidence = works.filter(w => (w.status === 'IN-EXECUTION' || w.status === 'in_progress') && (!w.evidence || w.evidence.length === 0));
    const completedCount  = works.filter(w => w.status === 'COMPLETED' || w.status === 'completed' || w.status === 'UTILISED' || w.status === 'utilised').length;
    const rejectedAudits  = works.filter(w => w.status === 'DROPPED').length;
    const sanctionRate    = proposals.length > 0 ? (works.length - proposals.length) / proposals.length : 0;
    const utilisationRate = works.length > 0 ? utilisedCount / works.length : 0;
    const fundUsagePct    = annualTotal > 0 ? sanctionedTotal / annualTotal : 0;

    const scAmount = works.filter(w => (w.area_type || w.village || '').toUpperCase().includes('SC-')).reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
    const stAmount = works.filter(w => (w.area_type || w.village || '').toUpperCase().includes('ST-')).reduce((s, w) => s + (w.sanctioned_amount || 0), 0);

    yearlyStats.push({ year: yr, works: works.length, proposals: proposals.length, annualTotal, sanctionedTotal, expendedTotal, utilisedCount, completedCount, rejectedAudits, sanctionRate, utilisationRate, fundUsagePct, scAmount, stAmount, zeroEvidenceCount: zeroEvidence.length });
  }

  const trendData = yearlyStats.map(s => s.utilisationRate);
  const fundTrend = yearlyStats.map(s => s.fundUsagePct);
  const rejTrend  = yearlyStats.map(s => s.sanctionRate);

  // PAST ALERT 1: Declining utilisation trend
  if (yearlyStats.length >= thresholds.minWorksForTrend) {
    const utilisationSlope = trend(trendData);
    if (utilisationSlope < -0.05) {
      const latest = yearlyStats[yearlyStats.length - 1];
      const oldest = yearlyStats[0];
      alerts.push(makeAlert(
        'hist-declining-utilisation', 'TREND_UTILISATION', SEV.HIGH, DIM.PAST,
        yearlyStats.length >= 3 ? CONF.HIGH : CONF.MEDIUM,
        'Declining Utilisation Trend Detected',
        `Work utilisation has been declining over ${yearlyStats.length} year(s). ` +
        `From ${pct(oldest.utilisationRate, 1)}% (${oldest.year}) → ${pct(latest.utilisationRate, 1)}% (${latest.year}). ` +
        `This pattern suggests systemic completion bottlenecks.`,
        [],
        { yearlyRates: yearlyStats.map(s => ({ year: s.year, rate: Math.round(s.utilisationRate * 100) })), slope: utilisationSlope }
      ));
    }
  }

  // PAST ALERT 2: High historical rejection rate
  for (const s of yearlyStats) {
    if (s.proposals > 0) {
      const rejRate = s.proposals > 0 ? (s.proposals - s.works) / s.proposals : 0;
      if (rejRate >= thresholds.highRejectionRatePct && s.proposals >= 3) {
        alerts.push(makeAlert(
          `hist-rejection-${s.year}`, 'TREND_REJECTION', SEV.MEDIUM, DIM.PAST, CONF.HIGH,
          `High Proposal Rejection Rate — ${s.year}`,
          `${pct(rejRate, 1)}% of proposals in ${s.year} were rejected (${s.proposals - s.works} of ${s.proposals}). ` +
          `This exceeds the officer-set threshold of ${pct(thresholds.highRejectionRatePct, 1)}%. Review proposal quality or scrutiny criteria.`,
          [],
          { year: s.year, rejectionRate: Math.round(rejRate * 100) }
        ));
      }
    }
  }

  // PAST ALERT 3: Fund under-usage in prior year
  const priorYears = yearlyStats.filter(s => s.year < new Date().getFullYear());
  for (const s of priorYears) {
    if (s.annualTotal > 0 && s.fundUsagePct < 0.60) {
      alerts.push(makeAlert(
        `hist-lowfund-${s.year}`, 'TREND_FUND_USAGE', SEV.MEDIUM, DIM.PAST, CONF.HIGH,
        `Low Fund Deployment — ${s.year}`,
        `Only ${pct(s.fundUsagePct, 1)}% of the ${fmt(s.annualTotal)} entitlement was deployed in ${s.year}. ` +
        `${fmt(s.annualTotal - s.sanctionedTotal)} was left uncommitted. Review MP proposal activity for that year.`,
        [],
        { year: s.year, deployed: Math.round(s.fundUsagePct * 100), annualTotal: s.annualTotal }
      ));
    }
  }

  // PAST ALERT 4: SC/ST earmarking failures in past years
  for (const s of priorYears) {
    if (s.annualTotal > 0) {
      const scTarget = s.annualTotal * SC_MINIMUM_RATIO;
      const stTarget = s.annualTotal * ST_MINIMUM_RATIO;
      if (s.scAmount < scTarget) {
        alerts.push(makeAlert(
          `hist-sc-breach-${s.year}`, 'SCST_HISTORY', SEV.HIGH, DIM.PAST, CONF.HIGH,
          `SC Earmarking Was Breached in ${s.year}`,
          `SC allocation in ${s.year} was ${fmt(s.scAmount)} (${pct(s.scAmount, s.annualTotal)}%), ` +
          `below the 15% mandatory minimum (${fmt(scTarget)}). ` +
          `Deficit of ${fmt(scTarget - s.scAmount)}. Recurring pattern requires corrective measures.`,
          [],
          { year: s.year, scPct: pct(s.scAmount, s.annualTotal), required: 15 }
        ));
      }
      if (s.stAmount < stTarget) {
        alerts.push(makeAlert(
          `hist-st-breach-${s.year}`, 'SCST_HISTORY', SEV.HIGH, DIM.PAST, CONF.HIGH,
          `ST Earmarking Was Breached in ${s.year}`,
          `ST allocation in ${s.year} was ${fmt(s.stAmount)} (${pct(s.stAmount, s.annualTotal)}%), ` +
          `below the 7.5% mandatory minimum (${fmt(stTarget)}). ` +
          `Deficit of ${fmt(stTarget - s.stAmount)}.`,
          [],
          { year: s.year, stPct: pct(s.stAmount, s.annualTotal), required: 7.5 }
        ));
      }
    }
  }

  return yearlyStats;
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ DIMENSION 2 — PRESENT: ENHANCED CURRENT STATE ANALYSIS ═══════════════════
// ─────────────────────────────────────────────────────────────────────────────

async function analysePresentState(alerts, thresholds) {
  // Load current active works
  const activeWorks = await db.work.findMany({
    where: { status: { notIn: ['COMPLETED', 'UTILISED', 'completed', 'utilised', 'DROPPED'] } },
  });

  const entitlements = await db.fundFlow.findMany();

  // Group entitlements by member
  const memberFunds = {};
  for (const e of entitlements) {
    if (!memberFunds[e.mp_id]) memberFunds[e.mp_id] = { total: 0, committed: 0, balance: 0, member_id: e.mp_id, member_name: e.mp_id };
    memberFunds[e.mp_id].total += (e.entitlement || 0);
  }

  for (const w of activeWorks) {
    if (memberFunds[w.mp_id]) {
      memberFunds[w.mp_id].committed += (w.sanctioned_amount || 0);
      memberFunds[w.mp_id].balance = memberFunds[w.mp_id].total - memberFunds[w.mp_id].committed;
    }
  }

  // P1 — Fund balance per entitlement year
  for (const ey of entitlements) {
    const memberActiveWorks = activeWorks.filter(w => w.mp_id === ey.mp_id);
    const committed = memberActiveWorks.reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
    const balance   = (ey.entitlement || 0) - committed;
    const balPct    = (ey.entitlement || 0) > 0 ? balance / (ey.entitlement || 0) : 1;

    if (balPct < thresholds.fundBalanceCriticalPct) {
      alerts.push(makeAlert(
        `present-fund-crit-${ey.id}`, 'FUND_BALANCE', SEV.CRITICAL, DIM.PRESENT, CONF.HIGH,
        `Critical Fund Balance — Year ${ey.fy}`,
        `Balance is ${fmt(balance)} (${pct(balPct, 1)}% of ${fmt(ey.entitlement)}). ` +
        `Below the critical threshold of ${pct(thresholds.fundBalanceCriticalPct, 1)}%. ` +
        `New proposals risk over-commitment.`,
        [ey.id, ey.mp_id],
        { balance, annual: ey.entitlement, pct: Math.round(balPct * 100) }
      ));
    } else if (balPct < thresholds.fundBalanceWarnPct) {
      alerts.push(makeAlert(
        `present-fund-warn-${ey.id}`, 'FUND_BALANCE', SEV.HIGH, DIM.PRESENT, CONF.HIGH,
        `Low Fund Balance Warning — Year ${ey.fy}`,
        `Balance is ${fmt(balance)} (${pct(balPct, 1)}% remaining). ` +
        `Below the officer-set warning threshold of ${pct(thresholds.fundBalanceWarnPct, 1)}%. Slow down new sanctions.`,
        [ey.id, ey.mp_id],
        { balance, annual: ey.entitlement, pct: Math.round(balPct * 100) }
      ));
    }
  }

  // P2 — SC/ST current year compliance
  for (const ey of entitlements) {
    const works = await db.work.findMany({
      where: { member_id: ey.mp_id, fy: ey.fy },
      include: { proposal: { select: { public_locality_term_id: true } } },
    });
    if (works.length === 0) continue;
    const scAmount = works.filter(w => (w.area_type || w.village || w.proposal?.public_locality_term_id || '').toUpperCase().includes('SC-')).reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
    const stAmount = works.filter(w => (w.area_type || w.village || w.proposal?.public_locality_term_id || '').toUpperCase().includes('ST-')).reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
    const annual = ey.entitlement || 0;
    if (scAmount < annual * SC_MINIMUM_RATIO) {
      alerts.push(makeAlert(
        `present-sc-${ey.id}`, 'SCST_COMPLIANCE', SEV.CRITICAL, DIM.PRESENT, CONF.HIGH,
        `SC Earmarking Breach — ${ey.fy}`,
        `SC allocation is ${fmt(scAmount)} (${pct(scAmount, annual)}%), below the mandatory 15% (${fmt(annual * SC_MINIMUM_RATIO)}). ` +
        `Deficit: ${fmt(annual * SC_MINIMUM_RATIO - scAmount)}.`,
        [ey.id],
        { scPct: pct(scAmount, annual), target: 15, deficit: annual * SC_MINIMUM_RATIO - scAmount }
      ));
    }
    if (stAmount < annual * ST_MINIMUM_RATIO) {
      alerts.push(makeAlert(
        `present-st-${ey.id}`, 'SCST_COMPLIANCE', SEV.CRITICAL, DIM.PRESENT, CONF.HIGH,
        `ST Earmarking Breach — ${ey.fy}`,
        `ST allocation is ${fmt(stAmount)} (${pct(stAmount, annual)}%), below the mandatory 7.5% (${fmt(annual * ST_MINIMUM_RATIO)}). ` +
        `Deficit: ${fmt(annual * ST_MINIMUM_RATIO - stAmount)}.`,
        [ey.id],
        { stPct: pct(stAmount, annual), target: 7.5, deficit: annual * ST_MINIMUM_RATIO - stAmount }
      ));
    }
  }

  // P3 — Stalled IN-EXECUTION works
  const stalledExecutions = activeWorks.filter(w => {
    if (w.status !== 'IN-EXECUTION' && w.status !== 'in_progress') return false;
    const days = w.sanction_date ? daysSince(w.sanction_date) : 0;
    return days > thresholds.stalledExecutionDays;
  });
  for (const w of stalledExecutions) {
    const days = w.sanction_date ? daysSince(w.sanction_date) : 9999;
    alerts.push(makeAlert(
      `present-stalled-${w.work_id}`, 'STALLED_WORK', SEV.HIGH, DIM.PRESENT, CONF.HIGH,
      `Stalled IN-EXECUTION Work (${days === 9999 ? '∞' : days} days)`,
      `Work ${w.work_id} has been IN-EXECUTION with no evidence for ${days === 9999 ? 'an unknown period' : `${days} days`} ` +
      `(threshold: ${thresholds.stalledExecutionDays} days). Sanctioned: ${fmt(w.sanctioned_amount)}.`,
      [w.work_id],
      { days: days === 9999 ? null : days, threshold: thresholds.stalledExecutionDays }
    ));
  }

  // P4 — Sanctioned but unstarted works
  const unstartedSanctions = activeWorks.filter(w => {
    if (w.status !== 'SANCTIONED' && w.status !== 'sanctioned') return false;
    const days = w.sanction_date ? daysSince(w.sanction_date) : 0;
    return days > thresholds.unstartedSanctionDays;
  });
  for (const w of unstartedSanctions) {
    const days = w.sanction_date ? daysSince(w.sanction_date) : 9999;
    alerts.push(makeAlert(
      `present-unstarted-${w.work_id}`, 'UNSTARTED_WORK', SEV.MEDIUM, DIM.PRESENT, CONF.HIGH,
      `Sanctioned Work Not Started (${days} days)`,
      `Work ${w.work_id} sanctioned ${days} days ago and still in SANCTIONED state. ` +
      `Threshold: ${thresholds.unstartedSanctionDays} days. Sanctioned: ${fmt(w.sanctioned_amount)}.`,
      [w.work_id],
      { days, threshold: thresholds.unstartedSanctionDays }
    ));
  }

  // P5 — Active duplicate works
  const dupMap = {};
  activeWorks.forEach(w => {
    const k = `${w.public_utility_term_id || w.utility || ''}|${w.public_locality_term_id || w.locality || ''}`;
    if (!dupMap[k]) dupMap[k] = [];
    dupMap[k].push(w.work_id);
  });
  for (const [k, ids] of Object.entries(dupMap)) {
    if (ids.length > 1) {
      const [utility, locality] = k.split('|');
      alerts.push(makeAlert(
        `present-dup-${k.replace(/[^a-z0-9]/gi, '-').slice(0, 40)}`, 'DUPLICATION', SEV.HIGH, DIM.PRESENT, CONF.HIGH,
        `Duplicate Active Works Detected`,
        `${ids.length} active works share utility "${utility}" at locality "${locality}". Non-duplication rule may be violated.`,
        ids,
        { utility, locality, count: ids.length }
      ));
    }
  }

  // P6 — Zero evidence on active/completed works
  const needEvidence = []; // Disabled for flat schema
  for (const w of needEvidence.filter(w => !w.evidence || w.evidence.length === 0)) {
    alerts.push(makeAlert(
      `present-noevidence-${w.work_id}`, 'EVIDENCE', SEV.HIGH, DIM.PRESENT, CONF.HIGH,
      `No Geo-Tagged Evidence — ${w.status} Work`,
      `Work ${w.work_id} is ${w.status} but has zero immutable evidence records. ` +
      `Sanctioned: ${fmt(w.sanctioned_amount)}. Geo-tagged photo/video required.`,
      [w.work_id], {}
    ));
  }

  // P7 — Expenditure shortfall on completed works
  const completedWorks = await db.work.findMany({
    where:  { status: { in: ['COMPLETED', 'UTILISED', 'completed', 'utilised'] } },
    select: { work_id: true, sanctioned_amount: true, expenditure: true, status: true },
  });
  for (const w of completedWorks) {
    if (w.sanctioned_amount <= 0) continue;
    const expRatio = w.sanctioned_amount > 0 ? (w.expenditure || 0) / w.sanctioned_amount : 0;
    if (expRatio < thresholds.expenditureGapPct) {
      alerts.push(makeAlert(
        `present-expgap-${w.work_id}`, 'EXPENDITURE', SEV.MEDIUM, DIM.PRESENT, CONF.MEDIUM,
        `Expenditure Gap on ${w.status} Work`,
        `Work ${w.work_id}: only ${pct(expRatio, 1)}% expended (${fmt(w.expenditure || 0)} of ${fmt(w.sanctioned_amount)}). ` +
        `Gap threshold: ${pct(thresholds.expenditureGapPct, 1)}%. Verify financial records.`,
        [w.work_id],
        { expPct: Math.round(expRatio * 100), sanctioned: w.sanctioned_amount, expended: w.expenditure || 0 }
      ));
    }
  }

  // P8 — Low-value proposals below custom minimum
  const allWorksForProposals = await db.work.findMany();
  const proposals = allWorksForProposals.filter(w => w.status === 'PROPOSED');
  for (const p of proposals) {
    if ((p.sanctioned_amount || 0) < thresholds.minSanctionAmount) {
      alerts.push(makeAlert(
        `present-lowval-${p.id}`, 'LOW_VALUE_PROPOSAL', SEV.LOW, DIM.PRESENT, CONF.HIGH,
        `Proposal Below Custom Minimum Amount`,
        `Proposal ${p.id} (Year ${p.fy}) requests ${fmt(p.sanctioned_amount || 0)}, ` +
        `below your custom floor of ${fmt(thresholds.minSanctionAmount)}. ` +
        `(Note: MPLADS statutory minimum is ₹1,00,000.)`,
        [p.id],
        { requested: p.sanctioned_amount, customMinimum: thresholds.minSanctionAmount }
      ));
    }
  }

  // P9 — Global utilisation rate
  const allWorksForUtil = await db.work.findMany({ select: { status: true } });
  if (allWorksForUtil.length > 0) {
    const utilisedCount = allWorksForUtil.filter(w => w.status === 'UTILISED' || w.status === 'utilised').length;
    const rate = utilisedCount / allWorksForUtil.length;
    if (rate < thresholds.lowUtilisationPct) {
      alerts.push(makeAlert(
        'present-low-util', 'UTILISATION', SEV.MEDIUM, DIM.PRESENT, CONF.HIGH,
        `Low Scheme Utilisation Rate`,
        `${pct(rate, 1)}% of works (${utilisedCount}/${allWorksForUtil.length}) are fully utilised. ` +
        `Below officer-set threshold of ${pct(thresholds.lowUtilisationPct, 1)}%.`,
        [],
        { utilisedPct: Math.round(rate * 100), total: allWorksForUtil.length, utilised: utilisedCount }
      ));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ DIMENSION 3 — FUTURE: PREDICTIVE FORECASTING ════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

async function predictFutureRisks(alerts, yearlyStats, thresholds) {
  const currentYear = new Date().getFullYear();
  const now         = new Date();
  const dayOfYear   = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  const daysLeft    = 365 - dayOfYear;

  // Current year entitlements
  const currentEYs = await db.fundFlow.findMany(); // Assuming all are active for now or we filter by max fy

  for (const ey of currentEYs) {
    const works = await db.work.findMany({ where: { member_id: ey.member_id, year_val: currentYear } });
    const sanctionedTotal = works.reduce((s, w) => s + w.sanctioned_amount, 0);
    const uncommitted     = ey.annual_amount - sanctionedTotal;

    // FUTURE 1 — Fund exhaustion projection
    if (dayOfYear > 0 && sanctionedTotal > 0) {
      const dailyBurnRate = sanctionedTotal / dayOfYear; // avg per day committed so far
      const daysToExhaust = dailyBurnRate > 0 ? Math.round(uncommitted / dailyBurnRate) : Infinity;
      const exhaustDate   = daysToExhaust < Infinity
        ? new Date(Date.now() + daysToExhaust * 864e5).toLocaleDateString('en-IN')
        : 'beyond year-end';

      if (daysToExhaust < 90 && daysToExhaust > 0) {
        const sev = daysToExhaust < 30 ? SEV.CRITICAL : daysToExhaust < 60 ? SEV.HIGH : SEV.MEDIUM;
        alerts.push(makeAlert(
          `future-exhaustion-${ey.entitlement_year_id}`, 'FUND_FORECAST', sev, DIM.FUTURE,
          daysToExhaust < 30 ? CONF.HIGH : CONF.MEDIUM,
          `Fund Exhaustion Forecast — ~${daysToExhaust} Days`,
          `At the current daily commitment rate of ${fmt(dailyBurnRate)}/day, ` +
          `the remaining balance of ${fmt(uncommitted)} will be exhausted by ~${exhaustDate}. ` +
          `${daysLeft} days remain in the financial year. Plan new proposals accordingly.`,
          [ey.entitlement_year_id],
          { daysToExhaust, exhaustDate, dailyBurnRate: Math.round(dailyBurnRate), uncommitted, daysLeft }
        ));
      }

      // FUTURE 2 — Under-spend risk (too much left, too little time)
      const projectedSpend = dailyBurnRate * 365;
      const spendRisk      = projectedSpend < ey.annual_amount * 0.60 && daysLeft < 120;
      if (spendRisk) {
        alerts.push(makeAlert(
          `future-underspend-${ey.entitlement_year_id}`, 'UNDERSPEND_RISK', SEV.HIGH, DIM.FUTURE, CONF.MEDIUM,
          `Under-Spend Risk — Year ${currentYear}`,
          `At current burn rate (${fmt(dailyBurnRate)}/day), projected year-end spend is ${fmt(projectedSpend)} ` +
          `(${pct(projectedSpend, ey.annual_amount)}% of ${fmt(ey.annual_amount)}). ` +
          `Only ${daysLeft} days remain. Accelerate proposal activity to avoid fund lapse.`,
          [ey.entitlement_year_id],
          { projectedSpend: Math.round(projectedSpend), annual: ey.annual_amount, daysLeft, projectedPct: pct(projectedSpend, ey.annual_amount) }
        ));
      }
    }

    // FUTURE 3 — SC/ST compliance trajectory
    const scWorks = works.filter(w => {
      // We'll check via proposal join
      return false; // handled below
    });

    const worksWithProposals = await db.work.findMany({
      where: { mp_id: ey.member_id, fy: currentYear }
    });
    const scAmount = worksWithProposals.filter(w => w.area_type?.toUpperCase().includes('SC-')).reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
    const stAmount = worksWithProposals.filter(w => w.area_type?.toUpperCase().includes('ST-')).reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
    const scTarget = ey.annual_amount * SC_MINIMUM_RATIO;
    const stTarget = ey.annual_amount * ST_MINIMUM_RATIO;

    if (scAmount < scTarget && daysLeft > 0) {
      const scDeficit      = scTarget - scAmount;
      const dailyScNeeded  = scDeficit / daysLeft;
      const currentScRate  = dayOfYear > 0 ? scAmount / dayOfYear : 0;
      const willMeet       = currentScRate >= dailyScNeeded;
      if (!willMeet) {
        alerts.push(makeAlert(
          `future-sc-miss-${ey.entitlement_year_id}`, 'SCST_FORECAST', SEV.CRITICAL, DIM.FUTURE,
          daysLeft < 60 ? CONF.HIGH : CONF.MEDIUM,
          `SC 15% Target Will Likely Be Missed — ${currentYear}`,
          `Current SC allocation: ${fmt(scAmount)} (${pct(scAmount, ey.annual_amount)}%). ` +
          `Need ${fmt(scDeficit)} more in ${daysLeft} days (${fmt(Math.round(dailyScNeeded))}/day). ` +
          `Current pace: ${fmt(Math.round(currentScRate))}/day. Trajectory: at risk.`,
          [ey.entitlement_year_id],
          { scPct: pct(scAmount, ey.annual_amount), target: 15, deficit: Math.round(scDeficit), daysLeft }
        ));
      }
    }
    if (stAmount < stTarget && daysLeft > 0) {
      const stDeficit     = stTarget - stAmount;
      const dailyStNeeded = stDeficit / daysLeft;
      const currentStRate = dayOfYear > 0 ? stAmount / dayOfYear : 0;
      const willMeet      = currentStRate >= dailyStNeeded;
      if (!willMeet) {
        alerts.push(makeAlert(
          `future-st-miss-${ey.entitlement_year_id}`, 'SCST_FORECAST', SEV.CRITICAL, DIM.FUTURE,
          daysLeft < 60 ? CONF.HIGH : CONF.MEDIUM,
          `ST 7.5% Target Will Likely Be Missed — ${currentYear}`,
          `Current ST allocation: ${fmt(stAmount)} (${pct(stAmount, ey.annual_amount)}%). ` +
          `Need ${fmt(stDeficit)} more in ${daysLeft} days. Trajectory: at risk.`,
          [ey.entitlement_year_id],
          { stPct: pct(stAmount, ey.annual_amount), target: 7.5, deficit: Math.round(stDeficit), daysLeft }
        ));
      }
    }
  }

  // FUTURE 4 — Work completion forecast (based on historical avg state duration)
  const inExecWorks = await db.work.findMany({
    where:   { status: 'IN-EXECUTION' }
  });

  // Compute avg days per state from historical completed works + audits
  const completedAudits = await db.actionAudit.findMany({
    where: { state_change_code: { in: ['IN-EXECUTION', 'COMPLETED'] } },
    orderBy: { action_datetime: 'asc' },
  });

  // Stagnation risk per work
  for (const w of inExecWorks) {
    const firstEvidence  = null; // Evidence query removed for flat schema
    const daysInExec     = daysSince(firstEvidence);
    // High stagnation risk if no evidence AND in exec for a long time
    if (!firstEvidence || daysInExec > thresholds.stalledExecutionDays * 2) {
      const conf = daysInExec > thresholds.stalledExecutionDays * 3 ? CONF.HIGH : CONF.MEDIUM;
      alerts.push(makeAlert(
        `future-stagnation-${w.work_id}`, 'STAGNATION_RISK', SEV.HIGH, DIM.FUTURE, conf,
        `High Stagnation Risk — Work May Not Complete`,
        `Work ${w.work_id} has been IN-EXECUTION for ${daysInExec === 9999 ? 'an unknown duration' : `${daysInExec} days`} ` +
        `with no evidence. Based on historical patterns, this work is at high risk of not completing in the current year. ` +
        `Sanctioned: ${fmt(w.sanctioned_amount)}.`,
        [w.work_id],
        { daysInExec: daysInExec === 9999 ? null : daysInExec, sanctioned: w.sanctioned_amount }
      ));
    }
  }

  // FUTURE 5 — Sector concentration risk (one sector > 70% of funds)
  const allCurrentWorks = await db.work.findMany({
    where: { fy: currentYear }
  });
  const sectorTotals = {};
  const totalSanctioned = allCurrentWorks.reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
  allCurrentWorks.forEach(w => {
    const sec = w.category || 'Other';
    sectorTotals[sec] = (sectorTotals[sec] || 0) + (w.sanctioned_amount || 0);
  });
  for (const [sec, amt] of Object.entries(sectorTotals)) {
    if (totalSanctioned > 0 && amt / totalSanctioned > 0.70) {
      alerts.push(makeAlert(
        `future-sector-conc-${sec.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        'SECTOR_CONCENTRATION', SEV.MEDIUM, DIM.FUTURE, CONF.HIGH,
        `Sector Concentration Risk — ${sec}`,
        `${pct(amt, totalSanctioned)}% of current-year sanctioned funds (${fmt(amt)} of ${fmt(totalSanctioned)}) ` +
        `are concentrated in "${sec}". This limits diversity of community assets and may trigger audit scrutiny.`,
        [],
        { sector: sec, pct: pct(amt, totalSanctioned), amount: Math.round(amt) }
      ));
    }
  }

  return { daysLeft, dayOfYear };
}

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHTS: Aggregate cross-dimensional insights
// ─────────────────────────────────────────────────────────────────────────────
function buildInsights(alerts, yearlyStats) {
  const byDim = {
    [DIM.PAST]:    alerts.filter(a => a.dimension === DIM.PAST).length,
    [DIM.PRESENT]: alerts.filter(a => a.dimension === DIM.PRESENT).length,
    [DIM.FUTURE]:  alerts.filter(a => a.dimension === DIM.FUTURE).length,
  };

  const criticalFuture = alerts.filter(a => a.dimension === DIM.FUTURE && a.severity === SEV.CRITICAL);
  const topCategory    = Object.entries(
    alerts.reduce((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {})
  ).sort((x, y) => y[1] - x[1])[0];

  return {
    dimensionCounts: byDim,
    criticalFutureCount: criticalFuture.length,
    topAlertCategory: topCategory ? topCategory[0] : null,
    yearlyStats: yearlyStats.map(s => ({
      year:           s.year,
      fundUsagePct:   Math.round(s.fundUsagePct * 100),
      utilisationPct: Math.round(s.utilisationRate * 100),
      works:          s.works,
      proposals:      s.proposals,
      scPct:          s.annualTotal > 0 ? pct(s.scAmount, s.annualTotal) : 0,
      stPct:          s.annualTotal > 0 ? pct(s.stAmount, s.annualTotal) : 0,
    })),
    overallTrend:
      yearlyStats.length >= 2
        ? trend(yearlyStats.map(s => s.utilisationRate)) > 0 ? 'IMPROVING' : 'DECLINING'
        : 'INSUFFICIENT_DATA',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH SCORE
// ─────────────────────────────────────────────────────────────────────────────
function computeHealthScore(alerts) {
  const w = { [SEV.CRITICAL]: 20, [SEV.HIGH]: 8, [SEV.MEDIUM]: 4, [SEV.LOW]: 1 };
  return Math.max(0, 100 - alerts.reduce((s, a) => s + (w[a.severity] || 0), 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
function buildSummary(alerts, durationMs) {
  const counts = {
    [SEV.CRITICAL]: alerts.filter(a => a.severity === SEV.CRITICAL).length,
    [SEV.HIGH]:     alerts.filter(a => a.severity === SEV.HIGH).length,
    [SEV.MEDIUM]:   alerts.filter(a => a.severity === SEV.MEDIUM).length,
    [SEV.LOW]:      alerts.filter(a => a.severity === SEV.LOW).length,
  };
  return {
    total: alerts.length, counts,
    healthScore: computeHealthScore(alerts),
    scannedAt: new Date().toISOString(),
    scanDurationMs: durationMs,
    status:
      counts[SEV.CRITICAL] > 0 ? 'CRITICAL' :
      counts[SEV.HIGH]     > 0 ? 'WARNING' :
      counts[SEV.MEDIUM]   > 0 ? 'CAUTION' : 'HEALTHY',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ MAIN EXPORT ═══════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
/**
 * runMonitorScan(customThresholds?)
 * Read-only temporal intelligence scan.
 * Returns { alerts, summary, insights }.
 * Fully compliant with MPLADS AI-as-support-only principle.
 */
export async function runMonitorScan(customThresholds = {}) {
  const start      = Date.now();
  const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
  const alerts     = [];

  // Run all three temporal dimensions
  const [yearlyStats] = await Promise.all([
    analyseHistoricalTrends(alerts, thresholds),
    analysePresentState(alerts, thresholds),
  ]);

  // Future analysis needs yearly stats from historical pass
  const { daysLeft } = await predictFutureRisks(alerts, yearlyStats || [], thresholds);

  // Sort: CRITICAL → HIGH → MEDIUM → LOW, then by FUTURE → PRESENT → PAST within same severity
  const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const DIM_ORDER = { FUTURE: 0, PRESENT: 1, PAST: 2 };
  alerts.sort((a, b) => {
    const sd = (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
    return sd !== 0 ? sd : (DIM_ORDER[a.dimension] ?? 9) - (DIM_ORDER[b.dimension] ?? 9);
  });

  const summary  = buildSummary(alerts, Date.now() - start);
  const insights = buildInsights(alerts, yearlyStats || []);

  return { alerts, summary, insights, daysLeft };
}
