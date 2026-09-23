/**
 * POST /api/works/{id}/spec
 * Officer confirms or corrects inferred spec.
 * source becomes 'officer_confirmed' → highest trust, overrides inference.
 *
 * Body: { category: string, spec: object }
 * Auth: Officer JWT required (same middleware as other officer routes)
 */

import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';

export async function POST(request, { params }) {
  const { id } = params;

  try {
    const body = await request.json();
    const { category, spec } = body;

    if (!category || !spec) {
      return NextResponse.json({ success: false, error: 'category and spec are required' }, { status: 400 });
    }

    const VALID_CATEGORIES = ['bridge', 'road', 'classroom', 'drinking_water',
      'sanitation_block', 'community_hall', 'electrification'];
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({
        success: false,
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
      }, { status: 400 });
    }

    // Verify work exists
    const work = await db.work.findUnique({ where: { work_id: id } });
    if (!work) {
      return NextResponse.json({ success: false, error: 'Work not found' }, { status: 404 });
    }

    const specData = { ...spec, _category: category };
    const now = new Date().toISOString();

    // Upsert WorkSpec with officer_confirmed source
    await db.$executeRawUnsafe(
      'INSERT OR REPLACE INTO WorkSpec (work_id, spec_json, source, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      id, JSON.stringify(specData), 'officer_confirmed', 1.0, now, now
    );

    // Invalidate cached cost estimates so next GET recomputes with confirmed spec
    await db.$executeRawUnsafe(
      'DELETE FROM CostEstimate WHERE work_id = ?', id
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      work_id: id,
      spec: specData,
      source: 'officer_confirmed',
      confidence: 1.0,
      updated_at: now,
      message: 'Spec confirmed. Cost estimate will be recomputed on next view.',
    });

  } catch (err) {
    console.error('[spec-confirm]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  const { id } = params;
  try {
    const spec = await db.$queryRawUnsafe(
      'SELECT * FROM WorkSpec WHERE work_id = ? LIMIT 1', id
    ).then(rows => rows[0] ?? null);

    if (!spec) {
      return NextResponse.json({ success: false, error: 'No spec found for this work' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...spec, spec_json: JSON.parse(spec.spec_json) });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
