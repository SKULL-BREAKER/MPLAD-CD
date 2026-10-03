/**
 * scripts/set-passwords.js
 * Sets email + password for all users in the DB.
 * Run: node scripts/set-passwords.js
 * 
 * Default passwords (change after first login):
 *   ADMIN/OFFICER: admin@mplads.gov.in / Prahari@2026
 *   Each user gets email = id@mplads.gov.in, password = Prahari@2026
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

// Hardcoded admin accounts — set these to real emails
const ADMIN_ACCOUNTS = [
  { id: 'admin-001', email: '31skullbreaker@gmail.com',     password: 'Prahari@2026', role: 'ADMIN', name: 'System Administrator' },
  { id: 'admin-002', email: 'nanthakumar7750@gmail.com',    password: 'Prahari@2026', role: 'ADMIN', name: 'System Administrator' },
  { id: 'admin-003', email: 'sreedharnandha9442@gmail.com', password: 'Prahari@2026', role: 'ADMIN', name: 'System Administrator' },
  { id: 'admin-004', email: 'sreedharnandhu17@gmail.com',   password: 'Prahari@2026', role: 'ADMIN', name: 'System Administrator' },
];

async function main() {
  // Upsert admin accounts
  for (const acc of ADMIN_ACCOUNTS) {
    const hash = await bcrypt.hash(acc.password, 12);
    await db.user.upsert({
      where: { id: acc.id },
      update: { email: acc.email, password_hash: hash, role: acc.role, name: acc.name },
      create: { id: acc.id, email: acc.email, password_hash: hash, role: acc.role, name: acc.name, created_at: new Date().toISOString() },
    });
    console.log(`✅ Admin set: ${acc.email}`);
  }

  // Set passwords for all existing officers (email = id + @mplads.gov.in)
  const officers = await db.user.findMany({ where: { role: 'OFFICER', password_hash: null } });
  for (const u of officers) {
    const email = `${u.id.toLowerCase().replace(/\s+/g, '.')}@mplads.gov.in`;
    const hash  = await bcrypt.hash('Prahari@2026', 12);
    await db.user.update({
      where: { id: u.id },
      data: { email, password_hash: hash },
    });
    console.log(`✅ Officer set: ${email}`);
  }

  console.log('\nDone. Default password for all: Prahari@2026');
}

main().catch(console.error).finally(() => db.$disconnect());
