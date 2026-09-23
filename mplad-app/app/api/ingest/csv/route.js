import { NextResponse } from 'next/server';
import { processCSV } from '../../../../lib/ingest/csv_import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s for large datasets

export async function POST(request) {
  try {
    const adminToken = request.headers.get('x-admin-token');
    const expectedToken = process.env.ADMIN_TOKEN || 'test-admin-token'; // Fallback for tests
    
    if (adminToken !== expectedToken) {
      return NextResponse.json({ ok: false, error: 'Unauthorized: Invalid Admin Token' }, { status: 403 });
    }

    const searchParams = new URL(request.url).searchParams;
    const mode = searchParams.get('mode') || 'dryrun';

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    try {
      const report = await processCSV(buffer, mode);
      return NextResponse.json({ ok: true, report });
    } catch (importErr) {
      return NextResponse.json({ ok: false, error: importErr.message }, { status: 400 });
    }
  } catch (err) {
    console.error('[ingest/csv] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
