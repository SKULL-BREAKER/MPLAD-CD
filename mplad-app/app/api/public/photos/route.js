import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB base64 limit

// POST /api/public/photos — anyone can post a photo on a work
export async function POST(request) {
  try {
    const body = await request.json();
    const { work_id, poster_name, photo_data, caption } = body;

    if (!work_id || !poster_name?.trim() || !photo_data) {
      return NextResponse.json(
        { error: 'work_id, poster_name, and photo_data (base64) are required' },
        { status: 400 }
      );
    }

    if (photo_data.length > MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json({ error: 'Photo too large (max 5 MB)' }, { status: 413 });
    }

    // Validate it looks like a base64 image
    if (!photo_data.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'photo_data must be a base64 data URL (data:image/...)' },
        { status: 400 }
      );
    }

    // Verify work exists
    const work = await db.work.findUnique({ where: { work_id } });
    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    const photo = await db.publicPhoto.create({
      data: {
        work_id,
        poster_name: poster_name.trim().slice(0, 100),
        photo_data,
        caption: caption?.trim().slice(0, 300) || null,
      },
      select: {
        photo_id: true,
        poster_name: true,
        caption: true,
        created_at: true,
      },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    console.error('[Photo Error]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/public/photos?work_id=xxx — get photos for a work
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const work_id = searchParams.get('work_id');

  if (!work_id) {
    return NextResponse.json({ error: 'work_id is required' }, { status: 400 });
  }

  const photos = await db.publicPhoto.findMany({
    where: { work_id },
    orderBy: { created_at: 'desc' },
    select: {
      photo_id: true,
      poster_name: true,
      photo_data: true,
      caption: true,
      created_at: true,
    },
  });

  return NextResponse.json({ photos });
}
