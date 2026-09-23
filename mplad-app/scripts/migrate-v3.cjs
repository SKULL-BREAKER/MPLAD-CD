const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS WorkSpec (' +
      '  work_id TEXT PRIMARY KEY,' +
      '  spec_json TEXT NOT NULL DEFAULT \'{}\',' +
      '  source TEXT NOT NULL DEFAULT \'inferred\',' +
      '  confidence REAL NOT NULL DEFAULT 0.5,' +
      '  created_at TEXT NOT NULL DEFAULT (datetime(\'now\')),' +
      '  updated_at TEXT NOT NULL DEFAULT (datetime(\'now\'))' +
      ')'
    );
    console.log('WorkSpec table created/verified');

    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS CostEstimate (' +
      '  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),' +
      '  work_id TEXT NOT NULL,' +
      '  method TEXT NOT NULL,' +
      '  expected_cost REAL NOT NULL DEFAULT 0,' +
      '  mape REAL NOT NULL DEFAULT 0,' +
      '  breakdown_json TEXT NOT NULL DEFAULT \'{}\',' +
      '  verdict TEXT,' +
      '  verdict_json TEXT,' +
      '  created_at TEXT NOT NULL DEFAULT (datetime(\'now\')),' +
      '  PRIMARY KEY (id)' +
      ')'
    );
    console.log('CostEstimate table created/verified');

    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS CostEstimate_work_id_method_key ON CostEstimate(work_id, method)'
    );
    console.log('Unique index created/verified');

    console.log('V3 migration complete');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
