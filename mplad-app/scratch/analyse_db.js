const Database = require('better-sqlite3');
const db = new Database('demo.db');

// Works stats
const stats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inprogress,
    SUM(CASE WHEN status='SANCTIONED' THEN 1 ELSE 0 END) as sanctioned,
    ROUND(SUM(sanctioned_amount)) as budget,
    ROUND(SUM(expenditure)) as spent
  FROM works
`).get();
console.log('=== WORKS STATS ===');
console.log(JSON.stringify(stats, null, 2));

// Top states via MPs
const states = db.prepare(`
  SELECT mp_id, COUNT(*) as works FROM works GROUP BY mp_id ORDER BY works DESC LIMIT 5
`).all();
console.log('\n=== TOP MP IDs ===', states);

// Category breakdown
const cats = db.prepare(`
  SELECT category, COUNT(*) as n, ROUND(SUM(sanctioned_amount)) as amt
  FROM works WHERE category IS NOT NULL
  GROUP BY category ORDER BY n DESC LIMIT 15
`).all();
console.log('\n=== CATEGORIES ===');
cats.forEach(c => console.log(`  ${c.category}: ${c.n} works, ₹${(c.amt/1e7).toFixed(1)} Cr`));

// District breakdown
const dists = db.prepare(`
  SELECT district_id, COUNT(*) as n FROM works GROUP BY district_id ORDER BY n DESC LIMIT 10
`).all();
console.log('\n=== TOP DISTRICTS ===', dists);

// Status breakdown
const status = db.prepare(`
  SELECT status, COUNT(*) as n FROM works GROUP BY status ORDER BY n DESC
`).all();
console.log('\n=== STATUS ===', status);

// MPs
const mps = db.prepare(`SELECT COUNT(*) as n FROM mps`).get();
const mpSample = db.prepare(`SELECT id, name, state, constituency FROM mps LIMIT 5`).all();
console.log('\n=== MPs ===', mps.n, 'total');
console.log(mpSample);
