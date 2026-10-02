import { NextResponse } from 'next/server';
import { processCSV } from '../../../../lib/ingest/csv_import';
import { verifyRequest } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ingest/csv
 * Requires officer JWT (ADMIN role enforced).
 * Query: ?mode=dryrun|commit
 * Body: multipart form with file field
 */
export async function POST(request) {
  // Require valid JWT — no plaintext token fallback
  const payload = await verifyRequest(request);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Unauthorized — officer login required' }, { status: 401 });
  }
  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Forbidden — admin role required for data ingestion' }, { status: 403 });
  }

  try {
    const mode = new URL(request.url).searchParams.get('mode') || 'dryrun';
    if (!['dryrun', 'commit'].includes(mode)) {
      return NextResponse.json({ ok: false, error: 'mode must be "dryrun" or "commit"' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    // File type check
    if (file.type && !file.type.includes('csv') && !file.type.includes('text')) {
      return NextResponse.json({ ok: false, error: 'Only CSV files are accepted' }, { status: 415 });
    }

    // File size limit: 50 MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'File too large (max 50 MB)' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const report = await processCSV(buffer, mode);

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error('[ingest/csv]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
