const fs = require('fs');
const path = require('path');
const yaml = require('yaml'); // Requires 'yaml' package

async function runD7(works, db) {
  console.log('[D7] Running Rules Engine Detector...');
  
  const results = [];
  const districtFlags = [];

  // Load config
  const rulesPath = path.join(__dirname, '../../../../config/rules.yaml');
  let config = {};
  if (fs.existsSync(rulesPath)) {
    config = yaml.parse(fs.readFileSync(rulesPath, 'utf8'));
  }

  const keywords = config.prohibited_keywords || [];
  const trustCap = (config.trust_cap_lakhs || 200) * 100000;
  const scMin = (config.sc_min_share || 15) / 100.0;
  const stMin = (config.st_min_share || 7) / 100.0;

  // 1. R1: Keywords
  for (const w of works) {
    const text = (w.title + ' ' + (w.description || '')).toLowerCase();
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(text)) {
        results.push({
          work_id: w.id,
          detector: 'D7',
          score: 1.0,
          evidence_json: JSON.stringify({
            rule_id: 'R1',
            keyword: kw,
            snippet: text.substring(0, 100) // truncated for evidence
          })
        });
        break; // one R1 violation is enough per work
      }
    }
  }

  // 2. R2: Agency Spend Caps (TRUST, SOCIETY)
  const agencies = await db.agency.findMany();
  const agencyMap = {};
  for (const a of agencies) {
    agencyMap[a.id] = a;
  }
  
  const agencySpent = {};
  for (const w of works) {
    if (!w.agency_id) continue;
    const a = agencyMap[w.agency_id];
    if (a && (a.type === 'TRUST' || a.type === 'SOCIETY')) {
      if (!agencySpent[w.agency_id]) agencySpent[w.agency_id] = { total: 0, works: [] };
      agencySpent[w.agency_id].total += (w.sanctioned_amount || 0);
      agencySpent[w.agency_id].works.push(w.id);
    }
  }

  for (const [aId, data] of Object.entries(agencySpent)) {
    if (data.total > trustCap) {
      // Flag all works contributing to this? Or just one row per work?
      // "R2: ... -> flag" usually means flag the works of that agency.
      for (const wId of data.works) {
        results.push({
          work_id: wId,
          detector: 'D7',
          score: 1.0,
          evidence_json: JSON.stringify({
            rule_id: 'R2',
            agency_id: aId,
            cumulative_spent: data.total,
            cap: trustCap
          })
        });
      }
    }
  }

  // 3. R3: SC/ST area spend share
  const distSpend = {};
  for (const w of works) {
    if (!w.district_id) continue;
    if (!distSpend[w.district_id]) {
      distSpend[w.district_id] = { total: 0, sc: 0, st: 0 };
    }
    distSpend[w.district_id].total += (w.sanctioned_amount || 0);
    if (w.locality_type === 'SC') distSpend[w.district_id].sc += (w.sanctioned_amount || 0);
    if (w.locality_type === 'ST') distSpend[w.district_id].st += (w.sanctioned_amount || 0);
  }

  for (const [distId, data] of Object.entries(distSpend)) {
    if (data.total > 0) {
      const scShare = data.sc / data.total;
      const stShare = data.st / data.total;
      
      if (scShare < scMin) {
        districtFlags.push({
          district_id: distId,
          flag: 'sc_share_violation',
          value: scShare,
          evidence_json: JSON.stringify({ rule_id: 'R3', share: scShare, min: scMin })
        });
      }
      if (stShare < stMin) {
        districtFlags.push({
          district_id: distId,
          flag: 'st_share_violation',
          value: stShare,
          evidence_json: JSON.stringify({ rule_id: 'R3', share: stShare, min: stMin })
        });
      }
    }
  }

  // 4. R4: Jurisdiction
  const mps = await db.mp.findMany();
  const mpMap = {};
  for (const m of mps) {
    mpMap[m.id] = m;
  }

  for (const w of works) {
    if (!w.mp_id || !w.district_id) continue;
    const mp = mpMap[w.mp_id];
    if (!mp) continue;

    let violation = false;
    let evidence = {
      rule_id: 'R4',
      mp_house: mp.house,
      work_district: w.district_id
    };

    if (mp.house === 'LS') {
      const nodals = mp.nodal_districts ? mp.nodal_districts.split(',') : [];
      evidence.constituency_districts = nodals;
      if (!nodals.includes(w.district_id)) {
        violation = true;
      }
    } else if (mp.house === 'RS') {
      // RS MP must spend in their elected state. 
      // How do we know the district's state? We fetch district.
      evidence.mp_state = mp.state;
      // We need to fetch district state. Let's do it in a pre-fetch.
    }
    
    if (violation) {
      results.push({
        work_id: w.id,
        detector: 'D7',
        score: 1.0,
        evidence_json: JSON.stringify(evidence)
      });
    }
  }
  
  // Backfill RS state check
  const districts = await db.district.findMany();
  const distStateMap = {};
  for (const d of districts) distStateMap[d.id] = d.state;

  for (const w of works) {
    if (!w.mp_id || !w.district_id) continue;
    const mp = mpMap[w.mp_id];
    if (!mp || mp.house !== 'RS') continue;

    const wState = distStateMap[w.district_id];
    if (wState && mp.state && wState !== mp.state) {
      results.push({
        work_id: w.id,
        detector: 'D7',
        score: 1.0,
        evidence_json: JSON.stringify({
          rule_id: 'R4',
          mp_house: mp.house,
          mp_state: mp.state,
          work_district: w.district_id,
          work_state: wState
        })
      });
    }
  }

  return { results, districtFlags };
}

module.exports = { runD7 };
