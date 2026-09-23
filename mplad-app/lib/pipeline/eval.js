const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { computeMetrics } = require('./metrics');

async function main() {
  const args = process.argv.slice(2);
  let dbPath = null;
  let outPath = null;
  let locked = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && i + 1 < args.length) {
      dbPath = args[++i];
    } else if (args[i] === '--out' && i + 1 < args.length) {
      outPath = args[++i];
    } else if (args[i] === '--locked') {
      locked = true;
    }
  }

  if (!outPath) {
    console.error("Missing --out argument");
    process.exit(1);
  }

  outPath = path.resolve(process.cwd(), outPath);

  // Locked Evaluation Check
  if (locked && fs.existsSync(outPath)) {
    if (process.env.FORCE === '1') {
      const logPath = path.join(path.dirname(outPath), 'eval_log.txt');
      const note = `${new Date().toISOString()} - FORCE=1 used to discard locked eval at ${outPath}\n`;
      fs.appendFileSync(logPath, note);
    } else {
      console.error("LOCKED EVAL EXISTS — results frozen. FORCE=1 to discard (logs to reports/eval_log.txt).");
      process.exit(1);
    }
  }

  // Ensure output directory exists
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let db;
  // Setup Prisma with the specific DB
  if (dbPath) {
    let absoluteDbPath = path.resolve(process.cwd(), dbPath);
    let schemaDir = path.resolve(__dirname, '../../prisma');
    let relativePath = path.relative(schemaDir, absoluteDbPath);
    const fileUri = 'file:' + relativePath.replace(/\\/g, '/');
    db = new PrismaClient({
      datasources: {
        db: {
          url: fileUri
        }
      }
    });
  } else {
    db = new PrismaClient();
  }

  try {
    const metrics = await computeMetrics(db, 'balanced');
    
    // Determinism requirement: JSON stringified exactly the same way.
    fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2));
    
    console.log(`✅ Evaluation complete. Metrics written to ${outPath}`);
  } catch (error) {
    console.error("❌ Evaluation failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
