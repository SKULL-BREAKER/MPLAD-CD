const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.fundFlow.create({
    data: {
      mp_id: 'MP-001',
      district_id: 'DIST-001',
      fy: '2024-25',
      entitlement: 50000000
    }
  });
  console.log('Fund flow created.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
