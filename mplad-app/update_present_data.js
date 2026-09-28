const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Updating financial years to present data...");
  
  // Mapping old mock years to present active years
  const yearMap = {
    '2019-20': '2023-24',
    '2021-22': '2024-25',
    '2022-23': '2025-26',
    '2023-24': '2026-27' // Or just cap at 2024-25
  };

  // 1. Update Works
  const works = await prisma.work.findMany();
  let wCount = 0;
  for (const w of works) {
    if (yearMap[w.fy]) {
      await prisma.work.update({
        where: { id: w.id },
        data: { fy: yearMap[w.fy] }
      });
      wCount++;
    }
  }
  console.log(`Updated ${wCount} works.`);

  // 2. Update FundFlows
  const flows = await prisma.fundFlow.findMany();
  let fCount = 0;
  for (const f of flows) {
    if (yearMap[f.fy]) {
      await prisma.fundFlow.update({
        where: { district_id_fy_mp_id: { district_id: f.district_id, fy: f.fy, mp_id: f.mp_id } },
        data: { fy: yearMap[f.fy] }
      });
      fCount++;
    }
  }
  console.log(`Updated ${fCount} fund flows.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
