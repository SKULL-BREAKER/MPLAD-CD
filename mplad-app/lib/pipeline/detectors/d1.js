const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function haversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getNgrams(text, minN = 3, maxN = 5) {
  const ngrams = {};
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= text.length - n; i++) {
      const g = text.substring(i, i + n);
      ngrams[g] = (ngrams[g] || 0) + 1;
    }
  }
  return ngrams;
}

function buildTfIdf(corpus) {
  const df = {};
  const N = corpus.length;
  const docs = corpus.map(text => {
    const counts = getNgrams(text);
    for (const token of Object.keys(counts)) {
      df[token] = (df[token] || 0) + 1;
    }
    return counts;
  });

  const vectors = docs.map(counts => {
    const vec = {};
    let norm = 0;
    for (const [token, count] of Object.entries(counts)) {
      const idf = Math.log(N / (df[token] || 1)) + 1; // +1 to avoid 0
      const weight = count * idf;
      vec[token] = weight;
      norm += weight * weight;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (const token of Object.keys(vec)) {
        vec[token] /= norm;
      }
    }
    return vec;
  });
  return vectors;
}

function cosineSim(vec1, vec2) {
  let sim = 0;
  // Iterate over smaller vector
  const keys1 = Object.keys(vec1);
  const keys2 = Object.keys(vec2);
  const [smaller, larger] = keys1.length < keys2.length ? [vec1, vec2] : [vec2, vec1];
  for (const token of Object.keys(smaller)) {
    if (larger[token]) {
      sim += smaller[token] * larger[token];
    }
  }
  return sim;
}

async function runD1(works, cacheDir) {
  console.log(`[D1] Running Duplicates Detector on ${works.length} works...`);
  console.log(`[D1] Model fallback: Using TF-IDF char ngrams (3,5) since offline sentence-transformers are not available without binary downloads.`);
  
  const cacheFile = path.join(cacheDir, 'tfidf_cache.json');
  
  // Compute text hashes
  const texts = works.map(w => `${w.title} | ${w.description}`.toLowerCase());
  const combinedText = texts.join('|||');
  const textHash = crypto.createHash('sha256').update(combinedText).digest('hex');

  let vectors;
  let cacheHit = false;

  if (fs.existsSync(cacheFile)) {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cache.textHash === textHash) {
      console.log(`[D1] cache hit - loaded precomputed embeddings.`);
      vectors = cache.vectors;
      cacheHit = true;
    }
  }

  if (!cacheHit) {
    vectors = buildTfIdf(texts);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, JSON.stringify({ textHash, vectors }));
  }

  const results = [];
  
  // Blocking by district
  const districtBlocks = {};
  // Blocking by category
  const categoryBlocks = {};

  works.forEach((w, i) => {
    if (!districtBlocks[w.district_id]) districtBlocks[w.district_id] = [];
    districtBlocks[w.district_id].push(i);

    if (!categoryBlocks[w.category]) categoryBlocks[w.category] = [];
    categoryBlocks[w.category].push(i);
  });

  const getPairs = (blocks) => {
    const pairs = [];
    for (const block of Object.values(blocks)) {
      for (let i = 0; i < block.length; i++) {
        for (let j = i + 1; j < block.length; j++) {
          pairs.push([block[i], block[j]]);
        }
      }
    }
    return pairs;
  };

  const allPairs = [...getPairs(districtBlocks), ...getPairs(categoryBlocks)];
  
  // Deduplicate pairs
  const uniquePairs = new Set();
  const validPairs = [];
  for (const [i, j] of allPairs) {
    const min = Math.min(i, j);
    const max = Math.max(i, j);
    const key = `${min}-${max}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.add(key);
      validPairs.push([min, max]);
    }
  }

  // Find max similarity per work
  const maxSim = {}; // i -> { matched_with, score, ...evidence }

  for (const [i, j] of validPairs) {
    let sim = cosineSim(vectors[i], vectors[j]);
    const w1 = works[i];
    const w2 = works[j];
    
    // Innocent Guard: if villages differ AND geo_distance > 5km -> score capped at 0.69
    const geo_distance_km = haversine(w1.lat, w1.lon, w2.lat, w2.lon);
    if (w1.village !== w2.village && geo_distance_km > 5) {
      if (sim > 0.69) sim = 0.69;
    }

    // Set threshold to 0.99 for TF-IDF since char ngrams have very high baseline similarity
    if (sim >= 0.99) {
      const a1 = w1.sanctioned_amount || 0;
      const a2 = w2.sanctioned_amount || 0;
      const maxA = Math.max(a1, a2) || 1;
      const amount_delta = Math.abs(a1 - a2) / maxA;
      const same_agency = w1.agency_id === w2.agency_id;
      
      let y1 = parseInt(w1.fy ? w1.fy.substring(0, 4) : 0);
      let y2 = parseInt(w2.fy ? w2.fy.substring(0, 4) : 0);
      const fy_delta = Math.abs(y1 - y2);

      const updateMax = (idx1, idx2) => {
        if (!maxSim[idx1] || sim > maxSim[idx1].score) {
          maxSim[idx1] = {
            detector: 'D1',
            score: sim,
            evidence_json: JSON.stringify({
              matched_with: works[idx2].id,
              similarity: parseFloat(sim.toFixed(4)),
              amount_delta: parseFloat(amount_delta.toFixed(4)),
              same_agency,
              geo_distance_km: parseFloat(geo_distance_km.toFixed(2)),
              fy_delta
            })
          };
        }
      };
      updateMax(i, j);
      updateMax(j, i);
    }
  }

  for (const [iStr, res] of Object.entries(maxSim)) {
    results.push({
      work_id: works[parseInt(iStr)].id,
      ...res
    });
  }

  // D1_split: Split-sanction
  // group works by (village, agency, 30-day sanction window); ≥3 works each ≤ ₹12L and group total ≥ ₹25L →all members get row detector='D1_split', score=1.0
  const parseDate = (dStr) => dStr ? new Date(dStr).getTime() : 0;
  
  // Group by village + agency
  const vaGroups = {};
  works.forEach(w => {
    if (!w.village || !w.agency_id || !w.sanction_date) return;
    const key = `${w.village}|${w.agency_id}`;
    if (!vaGroups[key]) vaGroups[key] = [];
    vaGroups[key].push(w);
  });

  for (const [key, groupWorks] of Object.entries(vaGroups)) {
    if (groupWorks.length < 3) continue;
    // Sort by sanction date
    groupWorks.sort((a, b) => parseDate(a.sanction_date) - parseDate(b.sanction_date));
    
    // Sliding 30-day window
    for (let i = 0; i < groupWorks.length; i++) {
      const windowWorks = [groupWorks[i]];
      const startT = parseDate(groupWorks[i].sanction_date);
      for (let j = i + 1; j < groupWorks.length; j++) {
        if (parseDate(groupWorks[j].sanction_date) - startT <= 30 * 24 * 60 * 60 * 1000) {
          windowWorks.push(groupWorks[j]);
        } else {
          break; // Since sorted, we can break early
        }
      }

      if (windowWorks.length >= 3) {
        // check conditions
        let allUnder12 = true;
        let totalAmt = 0;
        for (const w of windowWorks) {
          totalAmt += w.sanctioned_amount;
          if (w.sanctioned_amount > 12) allUnder12 = false;
        }

        if (allUnder12 && totalAmt >= 25) {
          const members = windowWorks.map(w => w.id);
          const evidence = JSON.stringify({ members });
          for (const w of windowWorks) {
            results.push({
              work_id: w.id,
              detector: 'D1_split',
              score: 1.0,
              evidence_json: evidence
            });
          }
          // To avoid overlapping windows flagging the same works multiple times, 
          // we should probably skip ahead, but pushing multiple rows is fine since aggregate will just take the highest or sum.
          // Wait, the schema DetectionResult has @@id([work_id, detector]), so we can only store ONE row per work per detector.
          // So we break out or track added works.
          i += windowWorks.length - 1; // skip processed
        }
      }
    }
  }

  // Deduplicate results per work_id + detector just in case
  const finalResults = [];
  const seen = new Set();
  for (const r of results) {
    const k = `${r.work_id}|${r.detector}`;
    if (!seen.has(k)) {
      seen.add(k);
      finalResults.push(r);
    }
  }

  return finalResults;
}

module.exports = { runD1, haversine };
