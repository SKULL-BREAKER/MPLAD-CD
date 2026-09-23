/**
 * C1 — Norm Rate Registry
 * ========================
 * Loads SSR/DSR norm lines and WPI price indices from data/norms/.
 * Provides adjustedRate(itemCode, month, district) with full factor breakdown.
 *
 * V3 Principle: deterministic, auditable.
 * Every factor is a stored, visible number — no black boxes.
 *
 * Formula:
 *   adjusted_rate = base_rate
 *     × (mix_steel×I_steel + mix_cement×I_cement + mix_labor×I_labor + mix_other)
 *     × terrain_multiplier(district)
 *
 * Source: CPWD DSR 2021; WPI indices from Ministry of Commerce & Industry;
 *         State minimum wage notifications for labor index.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data', 'norms');

// ─────────────────────────────────────────────────────────────────────────────
// Load norm items CSV
// ─────────────────────────────────────────────────────────────────────────────
function loadNormItems() {
  const raw = readFileSync(join(DATA_DIR, 'norm_items.csv'), 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const items = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < headers.length) continue;
    const row = {};
    headers.forEach((h, j) => { row[h] = cols[j]; });
    items[row.item_code] = {
      item_code:  row.item_code,
      description: row.description,
      category:   row.category,
      unit:       row.unit,
      base_rate:  parseFloat(row.base_rate),
      mix_steel:  parseFloat(row.mix_steel),
      mix_cement: parseFloat(row.mix_cement),
      mix_labor:  parseFloat(row.mix_labor),
      mix_other:  parseFloat(row.mix_other),
      base_year:  parseInt(row.base_year),
      source_ref: row.source_ref,
    };
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load price indices CSV
// ─────────────────────────────────────────────────────────────────────────────
function loadPriceIndices() {
  const raw = readFileSync(join(DATA_DIR, 'price_indices.csv'), 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const indices = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 4) continue;
    const row = {};
    headers.forEach((h, j) => { row[h] = cols[j]; });
    indices[row.month] = {
      month:      row.month,
      steel_idx:  parseFloat(row.steel_idx),
      cement_idx: parseFloat(row.cement_idx),
      labor_idx:  parseFloat(row.labor_idx),
      source:     row.source,
    };
  }
  return indices;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load terrain multipliers
// ─────────────────────────────────────────────────────────────────────────────
function loadTerrainMultipliers() {
  const raw = readFileSync(join(DATA_DIR, 'terrain_multipliers.json'), 'utf-8');
  return JSON.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singletons (loaded once at startup)
// ─────────────────────────────────────────────────────────────────────────────
let _normItems = null;
let _priceIndices = null;
let _terrainMultipliers = null;

function init() {
  if (_normItems) return; // already loaded
  _normItems        = loadNormItems();
  _priceIndices     = loadPriceIndices();
  _terrainMultipliers = loadTerrainMultipliers();
}

// ─────────────────────────────────────────────────────────────────────────────
// District → terrain classification (config-driven)
// ─────────────────────────────────────────────────────────────────────────────
const HILLY_DISTRICTS = new Set([
  'darjeeling', 'sikkim', 'shimla', 'manali', 'mussoorie', 'nainital',
  'dehradun', 'srinagar', 'leh', 'kargil', 'tawang', 'itanagar',
  'kohima', 'aizawl', 'shillong', 'gangtok',
]);
const DIFFICULT_DISTRICTS = new Set([
  'lakshadweep', 'andaman', 'nicobar', 'ladakh',
]);

function classifyTerrain(district) {
  if (!district) return 'PLAIN';
  const d = district.toLowerCase();
  if (DIFFICULT_DISTRICTS.has(d)) return 'DIFFICULT';
  for (const h of HILLY_DISTRICTS) { if (d.includes(h)) return 'HILLY'; }
  return 'PLAIN';
}

// ─────────────────────────────────────────────────────────────────────────────
// Find closest available month in index (for months before our data starts)
// ─────────────────────────────────────────────────────────────────────────────
function findClosestMonth(targetMonth) {
  const available = Object.keys(_priceIndices).sort();
  if (_priceIndices[targetMonth]) return targetMonth;
  // Return nearest available month
  for (let i = available.length - 1; i >= 0; i--) {
    if (available[i] <= targetMonth) return available[i];
  }
  return available[0]; // fallback to earliest
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: adjustedRate(itemCode, month, district)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns the index-adjusted rate for a norm item at a given month and district.
 * @param {string} itemCode - e.g. "B-02"
 * @param {string} month    - e.g. "2023-06" (YYYY-MM)
 * @param {string} district - e.g. "Lucknow" (used for terrain classification)
 * @returns {{ adj_rate, base_rate, steel_factor, cement_factor, labor_factor,
 *             terrain_class, terrain_mult, blended_index, source_ref, item }}
 */
export function adjustedRate(itemCode, month, district = 'PLAIN') {
  init();
  const item = _normItems[itemCode];
  if (!item) throw new Error(`Norm item not found: ${itemCode}`);

  const closestMonth = findClosestMonth(month);
  const idx = _priceIndices[closestMonth];
  if (!idx) throw new Error(`No price index for month: ${month}`);

  const terrainClass = classifyTerrain(district);
  const terrainMult  = _terrainMultipliers[terrainClass] || 1.0;

  // Blended index: weighted sum of material/labor indices
  const blended = (
    item.mix_steel  * idx.steel_idx  +
    item.mix_cement * idx.cement_idx +
    item.mix_labor  * idx.labor_idx  +
    item.mix_other  // other stays at 1.0 (no index — e.g. contractor overhead)
  );

  const adjRate = item.base_rate * blended * terrainMult;

  return {
    item_code:     itemCode,
    description:   item.description,
    unit:          item.unit,
    base_rate:     item.base_rate,
    steel_factor:  idx.steel_idx,
    cement_factor: idx.cement_idx,
    labor_factor:  idx.labor_idx,
    mix_steel:     item.mix_steel,
    mix_cement:    item.mix_cement,
    mix_labor:     item.mix_labor,
    mix_other:     item.mix_other,
    blended_index: Math.round(blended * 10000) / 10000,
    terrain_class: terrainClass,
    terrain_mult:  terrainMult,
    adj_rate:      Math.round(adjRate * 100) / 100,
    index_month:   closestMonth,
    source_ref:    item.source_ref,
    index_source:  idx.source,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get all norm items (for admin browse)
// ─────────────────────────────────────────────────────────────────────────────
export function getNormItems(category = null) {
  init();
  const all = Object.values(_normItems);
  if (category) return all.filter(i => i.category === category);
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get price index series (for sparklines)
// ─────────────────────────────────────────────────────────────────────────────
export function getPriceIndexSeries() {
  init();
  return Object.values(_priceIndices).sort((a, b) => a.month.localeCompare(b.month));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get index at a specific month (or nearest)
// ─────────────────────────────────────────────────────────────────────────────
export function getIndexAt(month) {
  init();
  const closestMonth = findClosestMonth(month);
  return _priceIndices[closestMonth];
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS (run with: node -e "import('./lib/modules/normRegistry.js')")
// ─────────────────────────────────────────────────────────────────────────────
export function runTests() {
  init();
  const TOLERANCE = 0.005; // 0.5% tolerance for float arithmetic
  let passed = 0, failed = 0;

  function assert(label, actual, expected) {
    const diff = Math.abs(actual - expected) / (expected || 1);
    if (diff <= TOLERANCE) {
      console.log(`  ✅ PASS: ${label} — got ${actual.toFixed(4)}, expected ~${expected.toFixed(4)}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label} — got ${actual.toFixed(4)}, expected ~${expected.toFixed(4)} (diff ${(diff*100).toFixed(2)}%)`);
      failed++;
    }
  }

  console.log('\n=== C1 Norm Registry Tests ===');

  // Test 1: B-02 at base year (2021-06) in plain terrain
  // Expected: base_rate × (0.10×1.0 + 0.28×1.0 + 0.30×1.0 + 0.32) × 1.0 = 12800 × 1.0 = 12800
  const r1 = adjustedRate('B-02', '2021-06', 'Lucknow');
  assert('B-02 at base year plain terrain', r1.adj_rate, 12800.0);
  assert('B-02 blended index at base year', r1.blended_index, 1.0);
  assert('B-02 terrain multiplier plain', r1.terrain_mult, 1.0);

  // Test 2: B-03 (steel-heavy, 80% steel) at 2023-06 when steel_idx=1.085
  // blended = 0.80×1.085 + 0.00×1.052 + 0.12×1.120 + 0.08 = 0.868 + 0 + 0.1344 + 0.08 = 1.0824
  // adj_rate = 72 × 1.0824 × 1.0 = 77.93
  const r2 = adjustedRate('B-03', '2023-06', 'Varanasi');
  const expectedBlended2 = 0.80*1.085 + 0.00*1.052 + 0.12*1.120 + 0.08;
  assert('B-03 blended index at 2023-06', r2.blended_index, expectedBlended2);
  assert('B-03 adj_rate at 2023-06', r2.adj_rate, 72 * expectedBlended2 * 1.0);

  // Test 3: Hilly terrain multiplier
  const r3 = adjustedRate('B-01', '2021-06', 'Shimla');
  assert('B-01 terrain multiplier hilly', r3.terrain_mult, 1.25);
  assert('B-01 adj_rate hilly at base', r3.adj_rate, 5200 * 1.0 * 1.25);

  // Test 4: source_ref is populated
  if (!r1.source_ref || r1.source_ref.length < 5) {
    console.error('  ❌ FAIL: source_ref missing on B-02'); failed++;
  } else {
    console.log(`  ✅ PASS: source_ref present — "${r1.source_ref}"`); passed++;
  }

  // Test 5: Item not found throws
  try {
    adjustedRate('NONEXISTENT', '2021-06');
    console.error('  ❌ FAIL: Should have thrown for unknown item'); failed++;
  } catch (e) {
    console.log(`  ✅ PASS: throws for unknown item`); passed++;
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}
