import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

// Sanitise string input
const clean = (s, max = 100) => String(s || '').trim().slice(0, max);

// Validate work ID string format
const validId = (id) => id && /^[A-Za-z0-9_-]{1,50}$/.test(id);

// POST /api/public/works/comments — citizen comment
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await request.json();
    const { work_id, poster_name, comment_text } = body;

    if (!work_id || !poster_name?.trim() || !comment_text?.trim()) {
      return NextResponse.json({ error: 'work_id, poster_name, and comment_text are required' }, { status: 400 });
    }
    if (!validId(work_id)) {
      return NextResponse.json({ error: 'Invalid work_id format' }, { status: 400 });
    }
    if (comment_text.length > 1000) {
      return NextResponse.json({ error: 'Comment too long (max 1000 chars)' }, { status: 400 });
    }

    // Verify work exists using correct PK field
    const work = await db.work.findUnique({ where: { id: work_id }, select: { id: true } });
    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    const comment = await db.comment.create({
      data: {
        work_id,
        author: clean(poster_name),
        body: clean(comment_text, 1000),
      },
      select: { id: true, author: true, body: true, created_at: true },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error('[comments POST]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/public/comments?work_id=xxx
export async function GET(request) {
  try {
    const work_id = new URL(request.url).searchParams.get('work_id');
    if (!work_id || !validId(work_id)) {
      return NextResponse.json({ error: 'Valid work_id is required' }, { status: 400 });
    }

    const comments = await db.comment.findMany({
      where: { work_id },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: { id: true, author: true, body: true, created_at: true },
    });

    return NextResponse.json({ comments });
  } catch (err) {
    console.error('[comments GET]', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
