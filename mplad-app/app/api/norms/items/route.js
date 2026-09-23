/**
 * GET /api/norms/items?category=bridge
 * Admin: browse norm lines with source refs.
 * Returns all norm items, optionally filtered by category.
 */

import { NextResponse } from 'next/server';
import { getNormItems } from '../../../../lib/modules/normRegistry.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || null;

    const items = getNormItems(category);

    return NextResponse.json({
      success: true,
      count: items.length,
      category: category || 'all',
      items,
      meta: {
        source: 'CPWD DSR 2021 + State PWD SSR',
        base_year: 2021,
        note: 'Rates are index-adjusted at query time. See /api/norms/indices for price series.',
      },
    });
  } catch (err) {
    console.error('[norms/items]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
