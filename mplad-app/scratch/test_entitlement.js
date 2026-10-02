const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const e = await db.$queryRaw`SELECT SUM(entitlement) as ent FROM fund_flows`;
  console.log(e);
}
main().catch(console.error).finally(() => db.$disconnect());
