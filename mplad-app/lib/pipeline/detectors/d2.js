// d2.js

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[half - 1] + sorted[half]) / 2.0;
  return sorted[half];
}

// Simple Chi-Square CDF for df=8
function chi2_pvalue(chi2, df = 8) {
  // We only need df=8 for Benford (digits 1-9)
  // CDF of chi-square with 8 df = P(df/2, chi2/2) = P(4, x) where x = chi2/2
  // P(4, x) = 1 - e^-x * (1 + x + x^2/2 + x^3/6)
  if (df !== 8) throw new Error("Only df=8 supported");
  const x = chi2 / 2.0;
  const cdf = 1.0 - Math.exp(-x) * (1 + x + (x * x) / 2.0 + (x * x * x) / 6.0);
  return 1.0 - cdf; // p-value is 1 - CDF
}

async function runD2(works) {
  console.log(`[D2] Running Cost Outlier & Benford Detector on ${works.length} works...`);

  const results = [];
  const districtFlags = [];

  // Part 1: Cost Outliers
  const groups = {};
  
  for (const w of works) {
    if (w.physical_qty && w.physical_qty > 0 && w.sanctioned_amount) {
      const perunit = w.sanctioned_amount / w.physical_qty;
      const key = `${w.category}|${w.fy}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ id: w.id, perunit });
    }
  }

  for (const [key, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    const [category, fy] = key.split('|');
    const values = items.map(i => i.perunit);
    const med = median(values);
    const absDevs = values.map(v => Math.abs(v - med));
    const mad = median(absDevs);

    for (const item of items) {
      let z = 0;
      if (mad > 0) {
        z = 0.6745 * (item.perunit - med) / mad;
      }
      if (Math.abs(z) >= 1.0) {
        results.push({
          work_id: item.id,
          detector: 'D2',
          score: z,
          evidence_json: JSON.stringify({
            category,
            fy,
            perunit: parseFloat(item.perunit.toFixed(4)),
            median: parseFloat(med.toFixed(4)),
            mad: parseFloat(mad.toFixed(4)),
            z: parseFloat(z.toFixed(4)),
            n_group: items.length
          })
        });
      }
    }
  }

  // Part 2: Benford per district
  const distAmounts = {};
  for (const w of works) {
    if (w.district_id && w.sanctioned_amount > 0) {
      if (!distAmounts[w.district_id]) distAmounts[w.district_id] = [];
      distAmounts[w.district_id].push(w.sanctioned_amount);
    }
  }

  const expected = {};
  for (let d = 1; d <= 9; d++) {
    expected[d] = Math.log10(1 + 1.0 / d);
  }

  for (const [distId, amounts] of Object.entries(distAmounts)) {
    const digitCounts = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 };
    let validN = 0;
    
    for (const amt of amounts) {
      // Find first non-zero digit
      const str = amt.toString().replace(/[^1-9]/g, '');
      if (str.length > 0) {
        const d = parseInt(str[0]);
        if (d >= 1 && d <= 9) {
          digitCounts[d]++;
          validN++;
        }
      }
    }

    if (validN > 0) {
      let chi2 = 0;
      for (let d = 1; d <= 9; d++) {
        const obs = digitCounts[d];
        const exp = expected[d] * validN;
        if (exp > 0) {
          chi2 += Math.pow(obs - exp, 2) / exp;
        }
      }
      
      const p = chi2_pvalue(chi2, 8);
      
      districtFlags.push({
        district_id: distId,
        flag: 'benford_chi2',
        value: chi2,
        evidence_json: JSON.stringify({
          chi2: parseFloat(chi2.toFixed(4)),
          p: parseFloat(p.toFixed(6)),
          n: validN,
          digit_counts: digitCounts
        })
      });
    }
  }

  return { detection_results: results, district_flags: districtFlags };
}

module.exports = { runD2 };
