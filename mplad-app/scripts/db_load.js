const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Basic CSV parser to handle quotes
function parseCSV(content) {
  if (!content) return [];
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const result = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const row = {};
    let inQuote = false;
    let currentField = '';
    let currentHeaderIndex = 0;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"' && line[j+1] === '"') {
        currentField += '"';
        j++;
      } else if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        row[headers[currentHeaderIndex]] = currentField;
        currentField = '';
        currentHeaderIndex++;
      } else {
        currentField += char;
      }
    }
    row[headers[currentHeaderIndex]] = currentField;
    result.push(row);
  }
  return result;
}

function parseNumber(val) {
  if (!val || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

async function runLoad() {
  let csvDir = path.join(__dirname, '..', '..', 'data');
  
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--csv' && i + 1 < process.argv.length) {
      csvDir = path.resolve(process.cwd(), process.argv[++i]);
    }
  }

  if (!fs.existsSync(csvDir)) {
    console.error(`❌ Data not found at ${csvDir}`);
    process.exit(1);
  }

  console.log(`📦 Loading data from ${csvDir}...`);
  console.log(`🧹 Clearing existing dev.db data...`);
  
  await db.auditAction.deleteMany();
  await db.fraudLabel.deleteMany();
  await db.districtRisk.deleteMany();
  await db.workRisk.deleteMany();
  await db.districtFlag.deleteMany();
  await db.detectionResult.deleteMany();
  await db.workUpdate.deleteMany();
  await db.alert.deleteMany();
  await db.comment.deleteMany();
  await db.evidenceSubmission.deleteMany();
  await db.user.deleteMany();
  await db.costEstimate.deleteMany();
  await db.workSpec.deleteMany();
  await db.fundFlow.deleteMany();
  await db.work.deleteMany();
  await db.village.deleteMany();
  await db.agency.deleteMany();
  await db.mp.deleteMany();
  await db.district.deleteMany();

  const loadTable = async (filename, modelDelegate, mapper) => {
    const file = path.join(csvDir, filename);
    if (!fs.existsSync(file)) {
      console.log(`⚠️  ${filename} not found, skipping.`);
      return;
    }
    const data = parseCSV(fs.readFileSync(file, 'utf8'));
    if (data.length > 0) {
      const mapped = data.map(mapper);
      // SQLite limit workaround for large datasets
      const BATCH_SIZE = 1000;
      for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
        await modelDelegate.createMany({ data: mapped.slice(i, i + BATCH_SIZE) });
      }
      console.log(`✅ Loaded ${mapped.length} rows into ${filename}`);
    }
  };

  await loadTable('districts.csv', db.district, r => ({
    id: r.id, name: r.name, state: r.state,
    centroid_lat: parseNumber(r.centroid_lat), centroid_lon: parseNumber(r.centroid_lon),
    terrain: parseNumber(r.terrain), geo_key: r.geo_key
  }));

  await loadTable('mps.csv', db.mp, r => ({
    id: r.id, name: r.name, house: r.house, party: r.party,
    state: r.state, constituency: r.constituency, nodal_districts: r.nodal_districts
  }));

  await loadTable('agencies.csv', db.agency, r => ({
    id: r.id, name: r.name, agency_type: r.agency_type, home_district: r.home_district
  }));

  await loadTable('villages.csv', db.village, r => ({
    id: r.id, district_id: r.district_id, name: r.name,
    lat: parseNumber(r.lat), lon: parseNumber(r.lon)
  }));

  await loadTable('works.csv', db.work, r => ({
    id: r.id, mp_id: r.mp_id, district_id: r.district_id, agency_id: r.agency_id,
    title: r.title, description: r.description, category: r.category, fy: r.fy,
    sanctioned_amount: parseNumber(r.sanctioned_amount), expenditure: parseNumber(r.expenditure),
    physical_qty: parseNumber(r.physical_qty), unit: r.unit, area_type: r.area_type,
    status: r.status, sanction_date: r.sanction_date, start_date: r.start_date,
    completion_date: r.completion_date, lat: parseNumber(r.lat), lon: parseNumber(r.lon),
    village: r.village, block: r.block, created_at: r.created_at
  }));

  await loadTable('fund_flows.csv', db.fundFlow, r => ({
    district_id: r.district_id, fy: r.fy, mp_id: r.mp_id,
    entitlement: parseNumber(r.entitlement), funds_released: parseNumber(r.funds_released),
    expenditure: parseNumber(r.expenditure), unspent: parseNumber(r.unspent)
  }));

  await loadTable('work_specs.csv', db.workSpec, r => ({
    work_id: r.work_id, spec_json: r.spec_json, source: r.source, confidence: parseNumber(r.confidence)
  }));

  await loadTable('fraud_labels.csv', db.fraudLabel, r => ({
    work_id: r.work_id, pattern: r.pattern, label_class: r.label_class
  }));

  console.log(`🎉 DB Load Complete!`);
}

runLoad().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
