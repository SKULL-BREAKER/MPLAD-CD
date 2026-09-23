import { NextResponse }       from 'next/server';
import { runMonitorScan, DEFAULT_THRESHOLDS } from '../../../lib/modules/monitor';

/**
 * GET /api/monitor
 * Optional query params (all officer-overridable):
 *   minSanctionAmount      — custom minimum proposal amount floor
 *   fundBalanceWarnPct     — 0–1 fraction
 *   fundBalanceCriticalPct — 0–1 fraction
 *   stalledExecutionDays
 *   unstartedSanctionDays
 *   lowUtilisationPct      — 0–1 fraction
 *   expenditureGapPct      — 0–1 fraction
 *   highRejectionRatePct   — 0–1 fraction
 *   minWorksForTrend
 *
 * Returns { alerts, summary, insights, daysLeft, thresholdsUsed }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse officer-supplied thresholds from query string
    const custom = {};
    const numParam = (key) => {
      const v = searchParams.get(key);
      return v !== null && !isNaN(Number(v)) ? Number(v) : undefined;
    };

    const maybeSet = (key) => { const v = numParam(key); if (v !== undefined) custom[key] = v; };
    [
      'minSanctionAmount', 'fundBalanceWarnPct', 'fundBalanceCriticalPct',
      'stalledExecutionDays', 'unstartedSanctionDays', 'lowUtilisationPct',
      'expenditureGapPct', 'highRejectionRatePct', 'minWorksForTrend',
    ].forEach(maybeSet);

    const result = await runMonitorScan(custom);

    // Echo back what thresholds were actually used (merged defaults + custom)
    const thresholdsUsed = { ...DEFAULT_THRESHOLDS, ...custom };

    return NextResponse.json({ ...result, thresholdsUsed }, { status: 200 });
  } catch (err) {
    console.error('[AI Monitor] Scan error:', err);
    return NextResponse.json(
      { error: 'Monitor scan failed', message: err.message },
      { status: 500 },
    );
  }
}
