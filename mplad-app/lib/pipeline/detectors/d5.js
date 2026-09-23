async function runD5(works, db) {
  console.log('[D5] Running Vendor Concentration Detector...');
  
  const results = [];
  const districtFlags = [];

  // Calculate expenditure per district, and per agency per district
  const districtSpent = {};
  const agencyDistrictSpent = {};

  for (const w of works) {
    if (!w.district_id || !w.agency_id) continue;
    
    if (!districtSpent[w.district_id]) districtSpent[w.district_id] = 0;
    districtSpent[w.district_id] += (w.sanctioned_amount || 0);

    const adKey = `${w.district_id}|${w.agency_id}`;
    if (!agencyDistrictSpent[adKey]) agencyDistrictSpent[adKey] = 0;
    agencyDistrictSpent[adKey] += (w.sanctioned_amount || 0);
  }

  // Calculate shares and HHI
  const hhiByDistrict = {};
  const shareByAgencyDistrict = {};

  for (const [adKey, spent] of Object.entries(agencyDistrictSpent)) {
    const [distId, agencyId] = adKey.split('|');
    const totalDistSpent = districtSpent[distId];
    
    let share = 0;
    if (totalDistSpent > 0) {
      share = spent / totalDistSpent;
    }
    
    shareByAgencyDistrict[adKey] = share;
    
    if (!hhiByDistrict[distId]) hhiByDistrict[distId] = 0;
    hhiByDistrict[distId] += (share * share);
  }

  // Store district HHI flags
  for (const [distId, hhi] of Object.entries(hhiByDistrict)) {
    districtFlags.push({
      district_id: distId,
      flag: 'hhi',
      value: hhi,
      evidence_json: JSON.stringify({ hhi_district: hhi })
    });
  }

  // Create detection results per work for agency share >= 0.10
  for (const w of works) {
    if (!w.district_id || !w.agency_id) continue;
    
    const adKey = `${w.district_id}|${w.agency_id}`;
    const share = shareByAgencyDistrict[adKey] || 0;
    
    if (share >= 0.10) {
      results.push({
        work_id: w.id,
        detector: 'D5',
        score: share, // raw share
        evidence_json: JSON.stringify({
          share: share,
          agency_id: w.agency_id,
          hhi_district: hhiByDistrict[w.district_id]
        })
      });
    }
  }

  return { results, districtFlags };
}

module.exports = { runD5 };
