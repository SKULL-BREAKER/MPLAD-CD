import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { rateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_B64 = 5 * 1024 * 1024; // 5 MB
const validId = (id) => id && /^[A-Za-z0-9_-]{1,50}$/.test(id);

// POST /api/public/photos — upload evidence photo (field officer or public)
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Rate limit: 5 photos per IP per 10 minutes
    const { allowed, resetIn } = rateLimit(`photo:${ip}`, 5, 600);
    if (!allowed) {
      return NextResponse.json({ error: `Too many uploads. Retry in ${resetIn}s.` }, { status: 429 });
    }

    const body = await request.json();
    const { work_id, poster_name, photo_data, caption } = body;

    if (!work_id || !poster_name?.trim() || !photo_data) {
      return NextResponse.json({ error: 'work_id, poster_name, and photo_data required' }, { status: 400 });
    }
    if (!validId(work_id)) {
      return NextResponse.json({ error: 'Invalid work_id format' }, { status: 400 });
    }
    if (photo_data.length > MAX_B64) {
      return NextResponse.json({ error: 'Photo exceeds 5 MB limit' }, { status: 413 });
    }
    if (!photo_data.startsWith('data:image/')) {
      return NextResponse.json({ error: 'photo_data must be a base64 data URL (data:image/...)' }, { status: 400 });
    }

    // Verify work exists using correct PK
    const work = await db.work.findUnique({ where: { id: work_id }, select: { id: true } });
    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    const photo = await db.evidenceSubmission.create({
      data: {
        work_id,
        submitted_by: String(poster_name).trim().slice(0, 100),
        media_type: 'PHOTO',
        media_data: photo_data,
        caption: caption ? String(caption).trim().slice(0, 300) : null,
        source: 'PUBLIC',
      },
      select: { id: true, submitted_by: true, caption: true, created_at: true },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    console.error('[photos POST]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/public/photos?work_id=xxx
export async function GET(request) {
  try {
    const work_id = new URL(request.url).searchParams.get('work_id');
    if (!work_id || !validId(work_id)) {
      return NextResponse.json({ error: 'Valid work_id is required' }, { status: 400 });
    }

    const photos = await db.evidenceSubmission.findMany({
      where: { work_id, media_type: 'PHOTO' },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: { id: true, submitted_by: true, caption: true, created_at: true },
      // Note: media_data intentionally excluded from listing — use /api/public/photos/[id] for full data
    });

    return NextResponse.json({ photos });
  } catch (err) {
    console.error('[photos GET]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
