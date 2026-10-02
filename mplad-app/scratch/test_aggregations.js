const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const totalWorksResult = await db.$queryRaw`SELECT COUNT(*) as count FROM works`;
  console.log('Total Works:', totalWorksResult[0].count.toString());

  const amtResult = await db.$queryRaw`SELECT SUM(sanctioned_amount) as sanctioned, SUM(expenditure) as expended FROM works`;
  console.log('Amounts:', amtResult);

  const statusDist = await db.$queryRaw`SELECT status, COUNT(*) as count FROM works GROUP BY status`;
  console.log('Status Dist:', statusDist);

  const constDist = await db.$queryRaw`
    SELECT COALESCE(mps.constituency, works.district_id) as cid, 
           COUNT(*) as works, 
           SUM(works.sanctioned_amount) as sanctioned, 
           SUM(works.expenditure) as expended, 
           SUM(CASE WHEN UPPER(works.status) IN ('UTILISED', 'COMPLETED') THEN 1 ELSE 0 END) as utilised 
    FROM works 
    LEFT JOIN mps ON works.mp_id = mps.id 
    GROUP BY cid 
    ORDER BY sanctioned DESC 
    LIMIT 5`;
  console.log('Const Dist:', constDist);
}

main().catch(console.error).finally(() => db.$disconnect());
