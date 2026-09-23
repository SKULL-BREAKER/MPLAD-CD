async function runD6(works, db) {
  console.log('[D6] Running Geo (Ghost & Overlap) Detector...');
  
  const results = [];

  // Haversine distance in km
  function haversine(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // 1. Ghost Distance
  // Fetch all villages and group by district
  const allVillages = await db.village.findMany();
  const villagesByDistrict = {};
  for (const v of allVillages) {
    if (!villagesByDistrict[v.district_id]) villagesByDistrict[v.district_id] = [];
    villagesByDistrict[v.district_id].push(v);
  }

  // Fetch fund flows for spend ratio
  const fundFlows = await db.fundFlow.findMany();
  const spentByDistrict = {};
  const entitlementByDistrict = {};
  for (const f of fundFlows) {
    if (!spentByDistrict[f.district_id]) spentByDistrict[f.district_id] = 0;
    if (!entitlementByDistrict[f.district_id]) entitlementByDistrict[f.district_id] = 0;
    spentByDistrict[f.district_id] += (f.expenditure || 0);
    entitlementByDistrict[f.district_id] += (f.entitlement || 0);
  }

  for (const w of works) {
    if (!w.district_id || !w.lat || !w.lon) continue;
    
    const vils = villagesByDistrict[w.district_id] || [];
    let minDist = Infinity;
    let nearestVil = null;

    for (const v of vils) {
      if (v.lat && v.lon) {
        const d = haversine(w.lat, w.lon, v.lat, v.lon);
        if (d < minDist) {
          minDist = d;
          nearestVil = v.id;
        }
      }
    }

    if (minDist !== Infinity && minDist >= 3.0) {
      let spend_ratio = 0;
      if (entitlementByDistrict[w.district_id] > 0) {
        spend_ratio = spentByDistrict[w.district_id] / entitlementByDistrict[w.district_id];
      }
      
      results.push({
        work_id: w.id,
        detector: 'D6',
        score: minDist, // raw distance
        evidence_json: JSON.stringify({
          distance_km: minDist,
          nearest_village: nearestVil,
          status: w.status,
          spend_ratio: spend_ratio
        })
      });
    }
  }

  // 2. DBSCAN clustering per district for Overlap
  const eps_km = 0.3; // 300m
  const min_samples = 2;

  const worksByDistrict = {};
  for (const w of works) {
    if (w.district_id && w.lat && w.lon) {
      if (!worksByDistrict[w.district_id]) worksByDistrict[w.district_id] = [];
      worksByDistrict[w.district_id].push(w);
    }
  }

  for (const [distId, distWorks] of Object.entries(worksByDistrict)) {
    const visited = new Set();
    const clusters = [];
    
    function getNeighbors(idx) {
      const neighbors = [];
      const w1 = distWorks[idx];
      for (let i = 0; i < distWorks.length; i++) {
        const w2 = distWorks[i];
        if (haversine(w1.lat, w1.lon, w2.lat, w2.lon) <= eps_km) {
          neighbors.push(i);
        }
      }
      return neighbors;
    }

    for (let i = 0; i < distWorks.length; i++) {
      if (visited.has(i)) continue;
      visited.add(i);

      const neighbors = getNeighbors(i);
      if (neighbors.length < min_samples) {
        // Noise
        continue;
      }

      const cluster = [i];
      let seedIdx = 0;
      while (seedIdx < neighbors.length) {
        const p = neighbors[seedIdx];
        if (!visited.has(p)) {
          visited.add(p);
          const pNeighbors = getNeighbors(p);
          if (pNeighbors.length >= min_samples) {
            neighbors.push(...pNeighbors);
          }
        }
        if (!cluster.includes(p)) {
          cluster.push(p);
        }
        seedIdx++;
      }
      clusters.push(cluster.map(idx => distWorks[idx]));
    }

    // Process clusters for overlap
    for (const cluster of clusters) {
      // Find works with same category and same FY
      const catFyGroups = {};
      for (const w of cluster) {
        const key = `${w.category}|${w.fy}`;
        if (!catFyGroups[key]) catFyGroups[key] = [];
        catFyGroups[key].push(w);
      }

      for (const [key, groupWorks] of Object.entries(catFyGroups)) {
        if (groupWorks.length > 1) { // Same cluster + same category + same FY
          const clusterMembers = groupWorks.map(gw => gw.id);
          const cats = groupWorks.map(gw => gw.category);
          
          for (const gw of groupWorks) {
            results.push({
              work_id: gw.id,
              detector: 'D6_overlap',
              score: 1.0,
              evidence_json: JSON.stringify({
                cluster_members: clusterMembers,
                categories: cats
              })
            });
          }
        }
      }
    }
  }

  return { results, districtFlags: [] };
}

module.exports = { runD6 };
