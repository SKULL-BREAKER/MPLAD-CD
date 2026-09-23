const { PrismaClient } = require('@prisma/client');

async function runD4(works, db) {
  console.log('[D4] Running Utilization Detector on districts...');
  
  const results = [];
  const districtFlags = [];

  // 1. Utilization = sum(expenditure) / sum(entitlement) per district
  const flows = await db.fundFlow.findMany();
  
  const utilByDistrict = {};
  for (const flow of flows) {
    if (!utilByDistrict[flow.district_id_id]) {
      utilByDistrict[flow.district_id_id] = { spent: 0, entitlement: 0, fys: new Set() };
    }
    utilByDistrict[flow.district_id_id].spent += (flow.expenditure || 0);
    utilByDistrict[flow.district_id_id].entitlement += (flow.entitlement || 0);
    utilByDistrict[flow.district_id_id].fys.add(flow.fy);
  }

  for (const [distId, data] of Object.entries(utilByDistrict)) {
    let ratio = 0;
    if (data.entitlement > 0) {
      ratio = data.spent / data.entitlement;
    }
    
    districtFlags.push({
      district_id: distId,
      flag: 'utilization',
      value: ratio,
      evidence_json: JSON.stringify({
        spent: data.spent,
        entitlement: data.entitlement,
        fy_breakdown: Array.from(data.fys)
      })
    });
  }

  // 2. Year-end rush: fraction of sanctions in last 30 days of FY (March)
  const rushByDistrictFy = {};
  for (const w of works) {
    if (!w.district_id) continue;
    if (!w.sanction_date || !w.fy) continue;
    
    const key = `${w.district_id}|${w.fy}`;
    if (!rushByDistrictFy[key]) {
      rushByDistrictFy[key] = { total: 0, march: 0 };
    }
    
    rushByDistrictFy[key].total += 1;
    
    // Check if sanction date is in March (YYYY-03-DD)
    if (w.sanction_date.includes('-03-')) {
      rushByDistrictFy[key].march += 1;
    }
  }

  for (const [key, data] of Object.entries(rushByDistrictFy)) {
    const [distId, fy] = key.split('|');
    if (data.total > 0) {
      const fraction = data.march / data.total;
      districtFlags.push({
        district_id: distId,
        flag: `yearend_rush_${fy}`,
        value: fraction,
        evidence_json: JSON.stringify({
          fy: fy,
          total_sanctions: data.total,
          march_sanctions: data.march
        })
      });
    }
  }

  return { results, districtFlags };
}

module.exports = { runD4 };
