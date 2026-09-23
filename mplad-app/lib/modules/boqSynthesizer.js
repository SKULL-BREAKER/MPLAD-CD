/**
 * C2 — BoQ Synthesizer
 * =====================
 * Converts a work spec (parametric dimensions) + category → itemized BoQ.
 * Each line: qty × adjusted_rate = line_total, with full audit trail.
 *
 * Sources:
 *  - config/boq_templates.yaml (parametric quantity formulas)
 *  - normRegistry.adjustedRate() (index-adjusted unit rates)
 *
 * Also handles SPEC INFERENCE from work title/description via regex patterns.
 * Confidence is stored; officers can confirm/override via POST /api/works/{id}/spec.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { adjustedRate } from './normRegistry.js';

// ─────────────────────────────────────────────────────────────────────────────
// Inline minimal YAML parser (no external deps)
// Supports: key: value, nested lists with - {key: val, ...}
// ─────────────────────────────────────────────────────────────────────────────
function parseYAML(raw) {
  const lines = raw.split('\n');
  const result = {};
  let currentCategory = null;
  let currentKey = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }

    const indent = line.length - line.trimStart().length;

    // Top-level category (indent=0, ends with :)
    if (indent === 0 && trimmed.endsWith(':') && !trimmed.startsWith('-')) {
      currentCategory = trimmed.slice(0, -1);
      result[currentCategory] = { items: [] };
      currentKey = null;
      i++; continue;
    }

    if (!currentCategory) { i++; continue; }

    // Category-level key: value (indent=2)
    if (indent === 2 && trimmed.includes(':') && !trimmed.startsWith('-')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (key === 'vars') {
        // Parse: [span_m, width_m]
        result[currentCategory].vars = val.replace(/[\[\]]/g, '').split(',').map(v => v.trim());
      } else if (key !== 'items') {
        result[currentCategory][key] = val.replace(/^["']|["']$/g, '');
      }
      currentKey = key;
      i++; continue;
    }

    // Item line: - {item_code: B-01, qty: "...", unit: cum}
    if (indent >= 4 && trimmed.startsWith('-')) {
      const inner = trimmed.slice(1).trim();
      // Parse inline object: {key: val, key: val, ...}
      const obj = {};
      const cleaned = inner.replace(/^\{|\}$/g, '');
      // Split on comma but not inside quotes
      const parts = [];
      let buf = '', inQ = false;
      for (const ch of cleaned) {
        if ((ch === '"' || ch === "'") && !inQ) { inQ = true; continue; }
        if ((ch === '"' || ch === "'") && inQ)  { inQ = false; continue; }
        if (ch === ',' && !inQ) { parts.push(buf); buf = ''; continue; }
        buf += ch;
      }
      if (buf) parts.push(buf);
      for (const part of parts) {
        const idx2 = part.indexOf(':');
        if (idx2 === -1) continue;
        const k = part.slice(0, idx2).trim();
        const v = part.slice(idx2 + 1).trim().replace(/^["']|["']$/g, '');
        obj[k] = v;
      }
      if (obj.item_code) result[currentCategory].items.push(obj);
      i++; continue;
    }
    i++;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load BoQ templates
// ─────────────────────────────────────────────────────────────────────────────
let _templates = null;

function getTemplates() {
  if (_templates) return _templates;
  const raw = readFileSync(join(process.cwd(), 'config', 'boq_templates.yaml'), 'utf-8');
  _templates = parseYAML(raw);
  return _templates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec inference: extract parametric variables from work title/description
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_PATTERNS = [
  { category: 'bridge',         patterns: [/\bbridge\b/i, /\bculvert\b/i, /\bviaduct\b/i] },
  { category: 'road',           patterns: [/\broad\b/i, /\bstreet\b/i, /\bpath\b/i, /\blink road\b/i] },
  { category: 'classroom',      patterns: [/\bschool\b/i, /\bclassroom\b/i, /\banganwadi\b/i, /\beducation\b/i] },
  { category: 'drinking_water', patterns: [/\bdrinking water\b/i, /\bborewell\b/i, /\bhandpump\b/i, /\bwater supply\b/i, /\boverhead tank\b/i] },
  { category: 'sanitation_block', patterns: [/\btoilet\b/i, /\blatrine\b/i, /\bsanitation\b/i, /\bswachh\b/i] },
  { category: 'community_hall', patterns: [/\bcommunity hall\b/i, /\bpanchayat hall\b/i, /\bmultipurpose hall\b/i] },
  { category: 'electrification', patterns: [/\belectrif/i, /\bpower line\b/i, /\bpole line\b/i, /\bstreet light\b/i] },
];

const SPEC_EXTRACTORS = {
  bridge: (text) => {
    const spec = {};
    let conf = 0.3;
    const spanMatch = text.match(/(\d+(?:\.\d+)?)\s*m(?:etre|eter)?\s*span/i)
      || text.match(/span\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*m/i)
      || text.match(/(\d+(?:\.\d+)?)\s*m\s*(?:long|length)/i);
    if (spanMatch) { spec.span_m = parseFloat(spanMatch[1]); conf += 0.3; }
    else spec.span_m = 15; // default

    const widthMatch = text.match(/(\d+(?:\.\d+)?)\s*m\s*wide/i)
      || text.match(/width\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*m/i);
    if (widthMatch) { spec.width_m = parseFloat(widthMatch[1]); conf += 0.2; }
    else spec.width_m = 4.5; // default single-lane

    return { spec, confidence: Math.min(conf, 0.9) };
  },
  road: (text) => {
    const spec = {};
    let conf = 0.3;
    const lenMatch = text.match(/(\d+(?:\.\d+)?)\s*km/i)
      || text.match(/(\d+(?:\.\d+)?)\s*k\.?\s*m/i)
      || text.match(/(\d+)\s*(?:meter|metre)\s*(?:road|length)/i);
    if (lenMatch) {
      const val = parseFloat(lenMatch[1]);
      spec.length_km = val < 10 ? val : val / 1000; // handle meters input
      conf += 0.4;
    } else spec.length_km = 1.0;

    const widthMatch = text.match(/(\d+(?:\.\d+)?)\s*m\s*(?:wide|width)/i);
    if (widthMatch) { spec.width_m = parseFloat(widthMatch[1]); conf += 0.2; }
    else spec.width_m = 3.75; // default single lane

    return { spec, confidence: Math.min(conf, 0.9) };
  },
  classroom: (text) => {
    const spec = {};
    let conf = 0.3;
    const roomMatch = text.match(/(\d+)\s*(?:class)?room/i)
      || text.match(/(\d+)\s*(?:additional\s+)?class(?:rooms?)?/i);
    if (roomMatch) { spec.rooms = parseInt(roomMatch[1]); conf += 0.4; }
    else spec.rooms = 2;
    return { spec, confidence: Math.min(conf, 0.8) };
  },
  drinking_water: (text) => {
    const spec = {};
    let conf = 0.4;
    const hhMatch = text.match(/(\d+)\s*(?:household|family|hh|beneficiar)/i);
    if (hhMatch) { spec.households = parseInt(hhMatch[1]); conf += 0.3; }
    else spec.households = 100;

    const depthMatch = text.match(/(\d+)\s*m(?:etre|eter)?\s*(?:depth|deep|boring)/i);
    if (depthMatch) { spec.borewell_depth_m = parseInt(depthMatch[1]); conf += 0.2; }
    else spec.borewell_depth_m = 150;

    return { spec, confidence: Math.min(conf, 0.85) };
  },
  sanitation_block: (text) => {
    const spec = {};
    let conf = 0.4;
    const unitMatch = text.match(/(\d+)\s*(?:seat|unit|toilet|pan)/i);
    if (unitMatch) { spec.units = parseInt(unitMatch[1]); conf += 0.3; }
    else spec.units = 5;
    return { spec, confidence: Math.min(conf, 0.8) };
  },
  community_hall: (text) => {
    const spec = {};
    let conf = 0.4;
    const areaMatch = text.match(/(\d+)\s*sq\.?\s*m/i)
      || text.match(/(\d+)\s*sqm/i);
    if (areaMatch) { spec.floor_area_sqm = parseFloat(areaMatch[1]); conf += 0.3; }
    else spec.floor_area_sqm = 200;
    return { spec, confidence: Math.min(conf, 0.8) };
  },
  electrification: (text) => {
    const spec = {};
    let conf = 0.4;
    const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*km/i);
    if (kmMatch) { spec.line_length_km = parseFloat(kmMatch[1]); conf += 0.3; }
    else spec.line_length_km = 2.0;
    const hhMatch = text.match(/(\d+)\s*(?:household|hh|connection)/i);
    if (hhMatch) { spec.households = parseInt(hhMatch[1]); conf += 0.2; }
    else spec.households = 50;
    return { spec, confidence: Math.min(conf, 0.8) };
  },
};

/**
 * Infer category and spec from work title/description.
 * Returns: { category, spec, confidence, source: 'inferred' }
 */
export function inferSpec(workTitle, description = '') {
  const text = `${workTitle} ${description}`.toLowerCase();

  for (const { category, patterns } of CATEGORY_PATTERNS) {
    const matched = patterns.some(p => p.test(text));
    if (matched) {
      const extractor = SPEC_EXTRACTORS[category];
      if (extractor) {
        const { spec, confidence } = extractor(text);
        return { category, spec, confidence, source: 'inferred' };
      }
    }
  }

  return { category: null, spec: {}, confidence: 0.1, source: 'inferred' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe eval for qty formulas (vars from spec)
// ─────────────────────────────────────────────────────────────────────────────
function evalQty(formula, vars) {
  // Inject Math.ceil, Math.floor for formulas like sanitation_block
  const fn = new Function('Math', ...Object.keys(vars), `return (${formula});`);
  try {
    return fn(Math, ...Object.values(vars));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: synthesizeBoQ(category, specJson, month, district)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Produce an itemized BoQ for a work.
 * @param {string} category   - e.g. "bridge"
 * @param {object} specJson   - parametric vars e.g. { span_m: 15, width_m: 4.5 }
 * @param {string} month      - e.g. "2023-06"
 * @param {string} district   - e.g. "Lucknow" (for terrain)
 * @returns {{ items: BoQLine[], total_before_overheads, category, spec }}
 */
export function synthesizeBoQ(category, specJson, month, district = '') {
  const templates = getTemplates();
  const template  = templates[category];
  if (!template) {
    return { items: [], total_before_overheads: 0, category, spec: specJson, error: `No template for category: ${category}` };
  }

  const items = [];
  let total = 0;

  for (const tmplItem of template.items) {
    const qty = evalQty(tmplItem.qty, specJson);
    if (qty === null || isNaN(qty) || qty <= 0) continue;

    let rateInfo;
    try {
      rateInfo = adjustedRate(tmplItem.item_code, month, district);
    } catch (e) {
      rateInfo = { adj_rate: 0, base_rate: 0, steel_factor: 1, cement_factor: 1, labor_factor: 1,
                   terrain_mult: 1, blended_index: 1, source_ref: 'UNKNOWN', unit: tmplItem.unit };
    }

    const lineTotal = Math.round(qty * rateInfo.adj_rate * 100) / 100;
    total += lineTotal;

    items.push({
      item_code:     tmplItem.item_code,
      description:   rateInfo.description || tmplItem.item_code,
      qty:           Math.round(qty * 100) / 100,
      unit:          tmplItem.unit,
      base_rate:     rateInfo.base_rate,
      steel_factor:  rateInfo.steel_factor,
      cement_factor: rateInfo.cement_factor,
      labor_factor:  rateInfo.labor_factor,
      blended_index: rateInfo.blended_index,
      terrain_mult:  rateInfo.terrain_mult,
      adj_rate:      rateInfo.adj_rate,
      line_total:    lineTotal,
      source_ref:    rateInfo.source_ref,
    });
  }

  return {
    category,
    spec: specJson,
    month,
    district,
    items,
    total_before_overheads: Math.round(total * 100) / 100,
  };
}
