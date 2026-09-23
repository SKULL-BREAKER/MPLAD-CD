const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

try {
  console.log(`Migrating S8 models for DB at: ${dbPath}`);
  const db = new Database(dbPath);

  // 1. DetectionResult table
  db.exec(`
    CREATE TABLE IF NOT EXISTS "DetectionResult" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "work_id" TEXT NOT NULL,
      "module_code" TEXT NOT NULL,
      "raw_score" REAL NOT NULL,
      "evidence_json" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DetectionResult_work_id_module_code_key" ON "DetectionResult"("work_id", "module_code");
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS "DetectionResult_work_id_idx" ON "DetectionResult"("work_id");
  `);

  // 2. WorkRisk table
  db.exec(`
    CREATE TABLE IF NOT EXISTS "WorkRisk" (
      "work_id" TEXT NOT NULL PRIMARY KEY,
      "composite_score" REAL NOT NULL,
      "tier" TEXT NOT NULL,
      "active_preset" TEXT NOT NULL,
      "flags_json" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✅ Successfully applied S8 schema changes.');
  db.close();
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
