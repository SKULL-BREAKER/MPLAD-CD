const test = require('node:test');
const assert = require('node:assert');
const { runD1, haversine } = require('../lib/pipeline/detectors/d1');
const { runD2 } = require('../lib/pipeline/detectors/d2');
const { runD3 } = require('../lib/pipeline/detectors/d3');
const { runD5 } = require('../lib/pipeline/detectors/d5');
const { runD6 } = require('../lib/pipeline/detectors/d6');
const { runD7 } = require('../lib/pipeline/detectors/d7');
const path = require('path');

test('D1 - Duplicates', async (t) => {
  const cacheDir = path.resolve(__dirname, 'test_cache');
  
  await t.test('identical title, same district -> similarity >= 0.95', async () => {
    const works = [
      { id: 'w1', district_id: 'd1', title: 'Road repair', description: 'desc', lat: 10, lon: 10, village: 'v1' },
      { id: 'w2', district_id: 'd1', title: 'Road repair', description: 'desc', lat: 10, lon: 10.01, village: 'v1' }
    ];
    const res = await runD1(works, cacheDir);
    assert.strictEqual(res.length, 2);
    assert.ok(res[0].score >= 0.95);
  });
});

test('D2 - Cost', async (t) => {
  await t.test('outlier z >= 3', async () => {
    const values = [8, 9, 10, 10, 10, 10, 10, 11, 12];
    const works = [
      ...values.map((v, i) => ({ id: `w${i}`, category: 'ROAD', fy: '23-24', physical_qty: 1, sanctioned_amount: v })),
      { id: 'w9', category: 'ROAD', fy: '23-24', physical_qty: 1, sanctioned_amount: 40 }
    ];
    const res = await runD2(works);
    const outlier = res.detection_results.find(r => r.work_id === 'w9');
    assert.ok(outlier);
    assert.ok(outlier.score >= 3);
  });
});

test('D3 - Timeline', async (t) => {
  const configDir = path.resolve(__dirname, 'test_config');

  await t.test('flash_gap 8, not_started_days 500', async () => {
    const ref_today = '2024-06-30T00:00:00.000Z';
    const sanction500 = new Date(new Date(ref_today).getTime() - 500 * 24 * 60 * 60 * 1000).toISOString();
    
    const works = [
      { id: 'w1', status: 'completed', sanction_date: '2023-01-01', completion_date: '2023-01-09', expenditure: 10, sanctioned_amount: 10 },
      { id: 'w2', status: 'sanctioned', sanction_date: sanction500, expenditure: 0, sanctioned_amount: 10 }
    ];
    
    const res = await runD3(works, configDir);
    const w1Res = res.find(r => r.work_id === 'w1');
    const w2Res = res.find(r => r.work_id === 'w2');

    const ev1 = JSON.parse(w1Res.evidence_json);
    assert.strictEqual(ev1.flash_gap_days, 8);
  });
});

test('D5 - Vendor Concentration (P5)', async (t) => {
  await t.test('P5 injection -> agency share >= 0.30', async () => {
    const works = [
      { id: 'w1', district_id: 'd1', agency_id: 'a1', sanctioned_amount: 35 },
      { id: 'w2', district_id: 'd1', agency_id: 'a2', sanctioned_amount: 65 }
    ];
    const res = await runD5(works, { fundFlow: { findMany: async () => [] } });
    const p5Row = res.results.find(r => r.work_id === 'w1');
    assert.ok(p5Row);
    assert.ok(p5Row.score >= 0.30);
  });
});

test('D6 - Geo (P1)', async (t) => {
  await t.test('P1 -> ghost_distance >= 8', async () => {
    const works = [
      { id: 'w1', district_id: 'd1', lat: 10.1, lon: 10.1 } // offset
    ];
    const dbMock = {
      village: {
        findMany: async () => [
          { id: 'v1', district_id: 'd1', centroid_lat: 10.0, centroid_lon: 10.0 }
        ]
      },
      fundFlow: {
        findMany: async () => []
      }
    };
    const res = await runD6(works, dbMock);
    const p1Row = res.results.find(r => r.detector === 'D6');
    assert.ok(p1Row);
    assert.ok(p1Row.score >= 8.0); // ~15km
  });
});

test('D7 - Rules Engine (P8)', async (t) => {
  await t.test('P8 -> D7 matches R1', async () => {
    const works = [
      { id: 'w1', title: 'Construction of a statue', description: '' }
    ];
    const dbMock = {
      agency: { findMany: async () => [] },
      mp: { findMany: async () => [] },
      district: { findMany: async () => [] }
    };
    const res = await runD7(works, dbMock);
    const p8Row = res.results.find(r => r.work_id === 'w1');
    assert.ok(p8Row);
    assert.strictEqual(p8Row.detector, 'D7');
    const ev = JSON.parse(p8Row.evidence_json);
    assert.strictEqual(ev.rule_id, 'R1');
  });
});

