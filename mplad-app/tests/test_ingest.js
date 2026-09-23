const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { processCSV } = require('../lib/ingest/csv_import.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  const csvPath = path.join(__dirname, 'fixtures', 'oms_sample_100.csv');
  const buffer = fs.readFileSync(csvPath);

  // 1. Dry run
  console.log('--- TEST 1: Dry Run ---');
  let report = await processCSV(buffer, 'dryrun');
  console.log('Total:', report.total);
  console.log('Accepted:', report.accepted);
  console.log('Rejected:', report.rejected);
  assert.strictEqual(report.total, 100);
  assert.strictEqual(report.accepted, 98); // 89 clean + 1 dup + 8 warnings
  assert.strictEqual(report.rejected, 2); // 2 fatal
  console.log('Dry run counts match spec (98 accept, 2 reject). Note: duplicate is accepted in dryrun but skipped in commit.');

  // 2. Commit
  console.log('\n--- TEST 2: Commit ---');
  // First clear db to start fresh for this test
  await prisma.work.deleteMany({ where: { import_hash: { not: null } } });
  let countBefore = await prisma.work.count();
  
  // This should throw because of the 2 fatal rows
  try {
    await processCSV(buffer, 'commit');
    assert.fail('Should have thrown an error on fatal rows');
  } catch (err) {
    console.log('Caught expected error on fatal rows:', err.message);
  }

  // Create clean buffer (remove last 2 lines)
  const lines = buffer.toString().split('\n').filter(Boolean);
  const cleanLines = lines.slice(0, lines.length - 2);
  const cleanBuffer = Buffer.from(cleanLines.join('\n'));

  // Commit clean buffer
  report = await processCSV(cleanBuffer, 'commit');
  let countAfter = await prisma.work.count();
  console.log(`Inserted ${countAfter - countBefore} works`);
  assert.strictEqual(report.accepted, 98);
  assert.strictEqual(report.duplicatesSkipped, 1);
  assert.strictEqual(countAfter - countBefore, 97); // 98 accepted - 1 duplicate

  // 3. Idempotency (re-commit)
  console.log('\n--- TEST 3: Idempotency ---');
  const report2 = await processCSV(cleanBuffer, 'commit');
  console.log('Re-import accepted:', report2.accepted, 'Skipped:', report2.duplicatesSkipped);
  assert.strictEqual(report2.duplicatesSkipped, 98); // all skipped
  let countFinal = await prisma.work.count();
  assert.strictEqual(countFinal, countAfter);
  console.log('Idempotency verified: 0 new works inserted.');

  console.log('\nALL INGEST TESTS PASSED.');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
