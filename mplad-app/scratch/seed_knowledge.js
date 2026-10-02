/**
 * seed_knowledge.js
 * Reads demo.db and writes a real-data knowledge snapshot to scratch/ludo_knowledge.json
 * This is consumed by the chat API for zero-token factual answers.
 */
const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('demo.db');

const stats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status='PROPOSED' THEN 1 ELSE 0 END) as proposed,
    ROUND(SUM(sanctioned_amount)) as budget,
    ROUND(SUM(expenditure)) as spent,
    COUNT(DISTINCT district_id) as districts,
    COUNT(DISTINCT mp_id) as mps
  FROM works
`).get();

const cats = db.prepare(`
  SELECT category, COUNT(*) as n, ROUND(SUM(sanctioned_amount)) as amt
  FROM works WHERE category IS NOT NULL AND category != '' AND category != 'N/A'
  GROUP BY category ORDER BY n DESC LIMIT 10
`).all();

const districts = db.prepare(`
  SELECT district_id,
    COUNT(*) as total,
    SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
    ROUND(SUM(sanctioned_amount)) as budget,
    ROUND(SUM(expenditure)) as spent
  FROM works
  WHERE district_id NOT LIKE '%RAJYASABHA%' AND district_id NOT LIKE '%NOMINATED%'
  GROUP BY district_id ORDER BY total DESC LIMIT 20
`).all();

const topMPs = db.prepare(`
  SELECT m.name, m.state, m.constituency,
    COUNT(w.id) as works,
    SUM(CASE WHEN w.status='COMPLETED' THEN 1 ELSE 0 END) as completed,
    ROUND(SUM(w.sanctioned_amount)) as budget
  FROM mps m
  JOIN works w ON w.mp_id = m.id
  GROUP BY m.id ORDER BY works DESC LIMIT 15
`).all();

const stateAgg = db.prepare(`
  SELECT m.state,
    COUNT(w.id) as total,
    SUM(CASE WHEN w.status='COMPLETED' THEN 1 ELSE 0 END) as completed,
    ROUND(SUM(w.sanctioned_amount)) as budget,
    COUNT(DISTINCT m.id) as mps
  FROM works w
  JOIN mps m ON m.id = w.mp_id
  GROUP BY m.state ORDER BY total DESC LIMIT 20
`).all();

const riskSummary = db.prepare(`
  SELECT tier, COUNT(*) as n
  FROM work_risk GROUP BY tier ORDER BY n DESC
`).all();

const alertSummary = db.prepare(`
  SELECT status, COUNT(*) as n FROM alerts GROUP BY status ORDER BY n DESC
`).all();

const topRisk = db.prepare(`
  SELECT wr.work_id, wr.risk_score, wr.tier, w.title, w.district_id
  FROM work_risk wr
  JOIN works w ON w.id = wr.work_id
  WHERE wr.tier IN ('HIGH','CRITICAL')
  ORDER BY wr.risk_score DESC LIMIT 10
`).all();

const knowledge = {
  generated_at: new Date().toISOString(),
  stats,
  categories: cats,
  top_districts: districts,
  top_mps: topMPs,
  state_summary: stateAgg,
  risk_summary: riskSummary,
  alert_summary: alertSummary,
  top_risk_works: topRisk,
};

const out = 'scratch/ludo_knowledge.json';
fs.writeFileSync(out, JSON.stringify(knowledge, null, 2), 'utf8');
console.log(`Written to ${out}`);
console.log(`Stats: ${stats.total} works | ₹${(stats.budget/1e9).toFixed(1)}B budget | ${stats.mps} MPs | ${stats.districts} districts`);
console.log(`States: ${stateAgg.length} | Categories: ${cats.length} | Risk works: ${topRisk.length}`);
