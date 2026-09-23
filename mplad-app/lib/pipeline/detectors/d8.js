async function runD8(works, db) {
  console.log('[D8] Running Network Detector...');
  
  const results = [];

  // 1. Calculate cross_districts per agency
  const agencyDistricts = {};
  for (const w of works) {
    if (!w.agency_id || !w.district_id) continue;
    if (!agencyDistricts[w.agency_id]) agencyDistricts[w.agency_id] = new Set();
    agencyDistricts[w.agency_id].add(w.district_id);
  }

  // 2. Map titles to districts for duplicate cross-district titles
  const titleMap = {};
  for (const w of works) {
    if (!w.title || !w.district_id) continue;
    const t = w.title.toLowerCase().trim();
    if (!titleMap[t]) titleMap[t] = [];
    titleMap[t].push(w);
  }

  // 3. Score per work
  for (const w of works) {
    if (!w.agency_id || !w.district_id) continue;
    
    const cross_districts = agencyDistricts[w.agency_id].size;
    
    let dup_matches = 0;
    const matched_works = [];
    
    if (w.title) {
      const t = w.title.toLowerCase().trim();
      const others = titleMap[t] || [];
      for (const o of others) {
        if (o.id !== w.id && o.district !== w.district_id) {
          dup_matches++;
          matched_works.push(o.id);
        }
      }
    }

    const score = Math.min(1.0, (cross_districts / 5.0) + (dup_matches / 3.0));
    
    // Only report if score > 0 (to save DB rows)
    if (score > 0) {
      results.push({
        work_id: w.id,
        detector: 'D8',
        score: score,
        evidence_json: JSON.stringify({
          agency_id: w.agency_id,
          cross_districts: cross_districts,
          dup_matches: dup_matches,
          matched_works: matched_works
        })
      });
    }
  }

  return { results, districtFlags: [] };
}

module.exports = { runD8 };
