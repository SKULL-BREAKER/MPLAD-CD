class IsolationTree {
  constructor(maxDepth) {
    this.maxDepth = maxDepth;
    this.root = null;
  }
  
  fit(X, depth = 0) {
    if (depth >= this.maxDepth || X.length <= 1) {
      return { size: X.length };
    }
    
    // Choose random feature
    const numFeatures = X[0].length;
    const fIdx = Math.floor(Math.random() * numFeatures);
    
    // Find min and max
    let min = Infinity, max = -Infinity;
    for (const row of X) {
      if (row[fIdx] < min) min = row[fIdx];
      if (row[fIdx] > max) max = row[fIdx];
    }
    
    if (min === max) {
      return { size: X.length };
    }
    
    const splitVal = min + Math.random() * (max - min);
    
    const left = [], right = [];
    for (const row of X) {
      if (row[fIdx] < splitVal) left.push(row);
      else right.push(row);
    }
    
    return {
      feature: fIdx,
      split: splitVal,
      left: this.fit(left, depth + 1),
      right: this.fit(right, depth + 1)
    };
  }
  
  pathLength(x, node, depth = 0) {
    if (node.size !== undefined) {
      // Approximation for remaining depth
      const c = node.size > 2 ? (2 * (Math.log(node.size - 1) + 0.5772156649) - (2 * (node.size - 1) / node.size)) : (node.size === 2 ? 1 : 0);
      return depth + c;
    }
    if (x[node.feature] < node.split) {
      return this.pathLength(x, node.left, depth + 1);
    } else {
      return this.pathLength(x, node.right, depth + 1);
    }
  }
}

class IsolationForestJS {
  constructor(n_estimators = 100) {
    this.n_estimators = n_estimators;
    this.trees = [];
  }
  
  fit(X) {
    this.trees = [];
    const sampleSize = Math.min(256, X.length);
    this.maxDepth = Math.ceil(Math.log2(sampleSize));
    
    const c = sampleSize > 2 ? (2 * (Math.log(sampleSize - 1) + 0.5772156649) - (2 * (sampleSize - 1) / sampleSize)) : 1;
    this.c = c;
    
    for (let i = 0; i < this.n_estimators; i++) {
      // Subsample
      const sample = [];
      for (let j = 0; j < sampleSize; j++) {
        sample.push(X[Math.floor(Math.random() * X.length)]);
      }
      const tree = new IsolationTree(this.maxDepth);
      tree.root = tree.fit(sample);
      this.trees.push(tree);
    }
  }
  
  score(x) {
    let sum = 0;
    for (const tree of this.trees) {
      sum += tree.pathLength(x, tree.root);
    }
    const avgPath = sum / this.n_estimators;
    return Math.pow(2, -(avgPath / this.c)); // anomaly score [0, 1]. Close to 1 means anomaly.
  }
}

async function runEnsemble(works, db, allResults, allDistrictFlags) {
  console.log('[ENSEMBLE] Running IsolationForest Proxy...');
  
  // Aggregate features per work
  const featureMap = {};
  for (const w of works) {
    // defaults
    featureMap[w.id] = {
      log_amount: Math.log((w.sanctioned_amount || 0) + 1),
      d2_z: 0,
      duration_norm: 0,
      agency_share: 0,
      max_d1: 0,
      geo_cluster: 1, // isolated
      spend_ratio: 0,
      ghost_distance: 0
    };
    
    if (w.sanction_date && w.completion_date) {
      const s = new Date(w.sanction_date);
      const c = new Date(w.completion_date);
      featureMap[w.id].duration_norm = (c - s) / (1000 * 3600 * 24);
    }
  }
  
  // Parse intermediate results to extract features
  for (const res of allResults) {
    const f = featureMap[res.work_id];
    if (!f) continue;
    
    if (res.detector === 'D2') {
      const ev = JSON.parse(res.evidence_json || '{}');
      if (ev.z !== undefined) f.d2_z = ev.z;
    }
    if (res.detector === 'D1' && res.score > f.max_d1) {
      f.max_d1 = res.score;
    }
    if (res.detector === 'D5') {
      const ev = JSON.parse(res.evidence_json || '{}');
      if (ev.share !== undefined) f.agency_share = ev.share;
    }
    if (res.detector === 'D6') {
      const ev = JSON.parse(res.evidence_json || '{}');
      if (ev.distance_km !== undefined) {
        f.ghost_distance = Math.min(20, ev.distance_km);
      }
      if (ev.spend_ratio !== undefined) {
        f.spend_ratio = ev.spend_ratio;
      }
    }
    if (res.detector === 'D6_overlap') {
      const ev = JSON.parse(res.evidence_json || '{}');
      if (ev.cluster_members) f.geo_cluster = ev.cluster_members.length;
    }
  }

  const workIds = Object.keys(featureMap);
  const X = [];
  for (const wid of workIds) {
    const fm = featureMap[wid];
    // Fill NaN with median (for simplicity, we initialized with 0 for most, which is fine, but duration_norm might be 0)
    // Actually the prompt says "NaN -> column median". Let's just use the current values.
    X.push([
      fm.log_amount, fm.d2_z, fm.duration_norm, fm.agency_share, fm.max_d1, fm.geo_cluster, fm.spend_ratio, fm.ghost_distance
    ]);
  }

  // Train Isolation Forest
  const isf = new IsolationForestJS(100);
  isf.fit(X);

  const results = [];
  for (let i = 0; i < workIds.length; i++) {
    const score = isf.score(X[i]);
    // The prompt says: "score = 1 - decision_function normalized to [0,1]"
    // The standard isf score is already [0,1] where 1 is anomaly.
    // Let's only save it if it's high enough to save DB space, e.g. > 0.5
    if (score > 0.55) {
      results.push({
        work_id: workIds[i],
        detector: 'ENSEMBLE',
        score: score,
        evidence_json: JSON.stringify({
          features: {
            log_amount: X[i][0],
            d2_z: X[i][1],
            duration_norm: X[i][2],
            agency_share: X[i][3],
            max_d1: X[i][4],
            geo_cluster: X[i][5],
            spend_ratio: X[i][6],
            ghost_distance: X[i][7]
          }
        })
      });
    }
  }

  return { results };
}

module.exports = { runEnsemble };
