import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

// POST /api/public/comments — anyone can post a comment on a work
export async function POST(request) {
  try {
    const body = await request.json();
    const { work_id, poster_name, comment_text } = body;

    if (!work_id || !poster_name?.trim() || !comment_text?.trim()) {
      return NextResponse.json(
        { error: 'work_id, poster_name, and comment_text are required' },
        { status: 400 }
      );
    }

    if (comment_text.length > 1000) {
      return NextResponse.json({ error: 'Comment too long (max 1000 chars)' }, { status: 400 });
    }

    // Verify work exists
    const work = await db.work.findUnique({ where: { work_id } });
    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    const comment = await db.publicComment.create({
      data: {
        work_id,
        poster_name: poster_name.trim().slice(0, 100),
        comment_text: comment_text.trim(),
      },
      select: {
        comment_id: true,
        poster_name: true,
        comment_text: true,
        created_at: true,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error('[Comment Error]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/public/comments?work_id=xxx — get comments for a work
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const work_id = searchParams.get('work_id');

  if (!work_id) {
    return NextResponse.json({ error: 'work_id is required' }, { status: 400 });
  }

  const comments = await db.publicComment.findMany({
    where: { work_id },
    orderBy: { created_at: 'desc' },
    select: {
      comment_id: true,
      poster_name: true,
      comment_text: true,
      created_at: true,
    },
  });

  return NextResponse.json({ comments });
}
