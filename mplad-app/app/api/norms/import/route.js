/**
 * POST /api/norms/import (admin only)
 * Upload new SSR lines or price index rows as CSV.
 * Updates the in-memory registry (server restart required for persistence).
 *
 * For the demo, we write to data/norms/ and return the parsed rows.
 * In production: requires officer auth + audit log.
 */

import { NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type'); // 'items' or 'indices'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!['items', 'indices'].includes(type)) {
      return NextResponse.json({ success: false, error: 'type must be "items" or "indices"' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    // Validate required columns
    const requiredItems   = ['item_code', 'description', 'category', 'unit', 'base_rate', 'source_ref'];
    const requiredIndices = ['month', 'steel_idx', 'cement_idx', 'labor_idx'];
    const required        = type === 'items' ? requiredItems : requiredIndices;

    const missing = required.filter(c => !headers.includes(c));
    if (missing.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing required columns: ${missing.join(', ')}`
      }, { status: 400 });
    }

    // Validate each row has source_ref (no invented data)
    if (type === 'items') {
      const srcRefIdx = headers.indexOf('source_ref');
      const invalid = lines.slice(1).filter(l => {
        const cols = l.split(',');
        return !cols[srcRefIdx] || cols[srcRefIdx].trim().length < 5;
      });
      if (invalid.length > 0) {
        return NextResponse.json({
          success: false,
          error: `${invalid.length} rows missing source_ref. Every norm row MUST have a cited source.`,
        }, { status: 400 });
      }
    }

    // Write to data directory
    const filename = type === 'items' ? 'norm_items.csv' : 'price_indices.csv';
    const outPath = join(process.cwd(), 'data', 'norms', filename);
    writeFileSync(outPath, text, 'utf-8');

    return NextResponse.json({
      success: true,
      type,
      rows_imported: lines.length - 1,
      filename,
      note: 'File saved. Restart server to reload registry, or call /api/norms/reload.',
    });

  } catch (err) {
    console.error('[norms/import]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
