/**
 * GET /api/norms/indices
 * Returns the full price-index series (steel/cement/labor) for sparklines.
 * 48 monthly data points, 2020-01 → 2023-12, normalized to base_year=1.0.
 */

import { NextResponse } from 'next/server';
import { getPriceIndexSeries } from '../../../../lib/modules/normRegistry.js';

export async function GET() {
  try {
    const series = getPriceIndexSeries();

    // Format for ECharts sparkline consumption
    const months  = series.map(s => s.month);
    const steel   = series.map(s => s.steel_idx);
    const cement  = series.map(s => s.cement_idx);
    const labor   = series.map(s => s.labor_idx);

    return NextResponse.json({
      success: true,
      count: series.length,
      months,
      series: { steel, cement, labor },
      raw: series,
      meta: {
        base_year:    2021,
        base_month:   '2021-06',
        steel_source: 'WPI Series — Ministry of Commerce & Industry (Iron & Steel)',
        cement_source: 'WPI Series — Ministry of Commerce & Industry (Cement)',
        labor_source:  'State Minimum Wage Notifications (Construction Workers)',
        note: 'All indices normalized to 1.0 at base_month (Jun 2021).',
      },
    });
  } catch (err) {
    console.error('[norms/indices]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
