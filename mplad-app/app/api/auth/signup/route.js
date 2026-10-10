import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../../lib/db';

export async function POST(req) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const emailFormatted = email.toLowerCase().trim();

    const existingUser = await db.user.findFirst({
      where: { email: emailFormatted },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in instead.' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userId = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    let defaultDistrict = null;
    if (role === 'OFFICER') {
        defaultDistrict = 'D01';
    } else if (role === 'MP') {
        defaultDistrict = 'D01';
    }

    const newUser = await db.user.create({
      data: {
        id: userId,
        name,
        email: emailFormatted,
        password_hash,
        role: role || 'OFFICER',
        district_id: defaultDistrict,
        created_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, user: { id: newUser.id, email: newUser.email, name: newUser.name } });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
