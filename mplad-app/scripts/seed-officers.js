/**
 * Seed script — creates default officer accounts for testing
 * Run: node scripts/seed-officers.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const OFFICERS = [
  {
    username: 'officer1',
    password: 'officer123',
    display_name: 'Field Officer — CONST-101 (North Zone)',
    constituency_id: 'CONST-101',
  },
  {
    username: 'officer2',
    password: 'officer123',
    display_name: 'Field Officer — CONST-102 (South Zone)',
    constituency_id: 'CONST-102',
  },
  {
    username: 'admin',
    password: 'admin123',
    display_name: 'District Programme Officer',
    constituency_id: 'CONST-101',
  },
];

async function main() {
  console.log('🌱 Seeding officers...\n');

  for (const o of OFFICERS) {
    const existing = await prisma.officer.findUnique({ where: { username: o.username } });
    if (existing) {
      console.log(`⏭  Skipped (already exists): ${o.username}`);
      continue;
    }

    const hash = await bcrypt.hash(o.password, 10);
    await prisma.officer.create({
      data: {
        username: o.username,
        password_hash: hash,
        display_name: o.display_name,
        constituency_id: o.constituency_id,
      },
    });
    console.log(`✅ Created officer: ${o.username} (${o.constituency_id})`);
  }

  console.log('\n✅ Officer seeding complete!');
  console.log('\nTest credentials:');
  OFFICERS.forEach(o => {
    console.log(`  Username: ${o.username} | Password: ${o.password} | Constituency: ${o.constituency_id}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
