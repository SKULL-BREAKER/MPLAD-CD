const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { runD1 } = require('./detectors/d1');
const { runD2 } = require('./detectors/d2');
const { runD3 } = require('./detectors/d3');
const { runD4 } = require('./detectors/d4');
const { runD5 } = require('./detectors/d5');
const { runD6 } = require('./detectors/d6');
const { runD7 } = require('./detectors/d7');
const { runD8 } = require('./detectors/d8');
const { runEnsemble } = require('./detectors/ensemble');

const db = new PrismaClient();

async function main() {
  console.log("🚀 Starting Core Detectors (D1-D8 + ENSEMBLE)...");
  
  const cacheDir = path.resolve(process.cwd(), '../data/cache');
  const configDir = path.resolve(process.cwd(), '../config');

  // Load all works
  const works = await db.work.findMany();
  console.log(`Loaded ${works.length} works from database.`);

  // Clear existing results
  console.log("🧹 Clearing previous detection results...");
  await db.detectionResult.deleteMany({});
  await db.districtFlag.deleteMany({});

  // Attach village lat/lon to works
  const villages = await db.village.findMany();
  const vMap = {};
  for (const v of villages) {
    vMap[v.id] = { lat: v.lat, lon: v.lon };
  }
  for (const w of works) {
    // w already has w.lat and w.lon from db
    if (w.public_locality_term_id && vMap[w.public_locality_term_id]) {
      w.lat = vMap[w.public_locality_term_id].lat;
      w.lon = vMap[w.public_locality_term_id].lon;
    }
  }

  // Run Detectors
  const d1Results = await runD1(works, cacheDir);
  console.log(`[D1] Generated ${d1Results.length} detection rows.`);

  const { detection_results: d2Results, district_flags: d2Flags } = await runD2(works);
  console.log(`[D2] Generated ${d2Results.length} detection rows and ${d2Flags.length} district flags.`);

  const d3Results = await runD3(works, configDir);
  console.log(`[D3] Generated ${d3Results.length} detection rows.`);

  const d4 = await runD4(works, db);
  console.log(`[D4] Generated ${d4.districtFlags.length} district flags.`);

  const d5 = await runD5(works, db);
  console.log(`[D5] Generated ${d5.results.length} detection rows and ${d5.districtFlags.length} district flags.`);

  const d6 = await runD6(works, db);
  console.log(`[D6] Generated ${d6.results.length} detection rows.`);

  const d7 = await runD7(works, db);
  console.log(`[D7] Generated ${d7.results.length} detection rows and ${d7.districtFlags.length} district flags.`);

  const d8 = await runD8(works, db);
  console.log(`[D8] Generated ${d8.results.length} detection rows.`);

  const intermediateResults = [...d1Results, ...d2Results, ...d3Results, ...d5.results, ...d6.results, ...d7.results, ...d8.results];
  const intermediateFlags = [...d2Flags, ...d4.districtFlags, ...d5.districtFlags, ...d7.districtFlags];

  const ens = await runEnsemble(works, db, intermediateResults, intermediateFlags);
  console.log(`[ENSEMBLE] Generated ${ens.results.length} detection rows.`);

  const allResults = [...intermediateResults, ...ens.results];
  const allFlags = [...intermediateFlags];
  
  console.log("💾 Saving detection results to database...");
  if (allResults.length > 0) {
    // Deduplicate allResults by work_id and detector
    const dedupedResultsMap = new Map();
    for (const r of allResults) {
      if (r.work_id && r.detector) {
        dedupedResultsMap.set(`${r.work_id}_${r.detector}`, r);
      }
    }
    const dedupedResults = Array.from(dedupedResultsMap.values());
    console.log(`Deduplicated ${allResults.length} rows to ${dedupedResults.length} rows.`);

    // SQLite can struggle with very large inserts, chunk it
    const chunkSize = 1000;
    for (let i = 0; i < dedupedResults.length; i += chunkSize) {
      const chunk = dedupedResults.slice(i, i + chunkSize);
      await db.detectionResult.createMany({ data: chunk });
    }
  }

  if (allFlags.length > 0) {
    // sqlite has a limit of 999 vars per insert. 
    // allFlags can be around 200 items, should be fine for one insert, but chunk just in case
    const chunkSize = 500;
    for (let i = 0; i < allFlags.length; i += chunkSize) {
      const chunk = allFlags.slice(i, i + chunkSize);
      await db.districtFlag.createMany({ data: chunk });
    }
  }

  console.log("✅ Detection completed successfully.");
}

main()
  .catch(e => {
    console.error("❌ Detection failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
