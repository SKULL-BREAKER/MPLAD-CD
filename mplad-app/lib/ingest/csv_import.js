import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import crypto from 'crypto';
import yaml from 'yaml';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
        matrix[i - 1][j - 1] + indicator
      );
    }
  }
  return matrix[a.length][b.length];
}

function fuzzyRatio(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
  return ((maxLen - dist) / maxLen) * 100;
}

const CATEGORIES = [
  'Drinking Water', 'Education', 'Electricity', 'Health', 'Roads',
  'Sanitation', 'Sports', 'Irrigation', 'Agriculture', 'Other'
];

function mapCategory(catStr) {
  if (!catStr) return 'UNCLASSIFIED';
  let bestMatch = 'UNCLASSIFIED';
  let highestRatio = 0;
  
  for (const cat of CATEGORIES) {
    const ratio = fuzzyRatio(cat, catStr);
    if (ratio > highestRatio) {
      highestRatio = ratio;
      bestMatch = cat;
    }
  }
  return highestRatio >= 70 ? bestMatch : 'UNCLASSIFIED';
}

function mapStatus(statusStr) {
  if (!statusStr) return 'recommended';
  const s = statusStr.toLowerCase().trim();
  if (s.includes('complete') || s.includes('done')) return 'completed';
  if (s.includes('progress') || s.includes('ongoing')) return 'in_progress';
  if (s.includes('drop') || s.includes('cancel')) return 'dropped';
  if (s.includes('sanction') || s.includes('approve')) return 'sanctioned';
  return 'recommended';
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // expects dd-mm-yyyy, yyyy-mm-dd, dd/mm/yy
  let d = dateStr.replace(/\//g, '-').trim();
  const parts = d.split('-');
  if (parts.length !== 3) return null;
  // Very rough validation
  if (parts[0].length === 4) {
    // yyyy-mm-dd
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  } else if (parts[2].length === 4) {
    // dd-mm-yyyy
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  } else if (parts[2].length === 2) {
    // dd-mm-yy
    const year = parseInt(parts[2], 10) > 50 ? `19${parts[2]}` : `20${parts[2]}`;
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null;
}

function coerceFY(fy) {
  if (!fy) return '';
  const s = fy.replace(/[^0-9]/g, '');
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(6)}`; // 20212022 -> 2021-22
  if (s.length === 6) return `${s.slice(0, 4)}-${s.slice(4)}`; // 202122 -> 2021-22
  return fy;
}

function generateImportHash(work) {
  const data = `${work.title || ''}|${work.district || ''}|${work.fy || ''}|${work.sanctioned_amount || 0}`;
  return crypto.createHash('sha256').update(data.toLowerCase()).digest('hex');
}

export async function processCSV(csvBuffer, mode) {
  const yamlPath = path.join(process.cwd(), 'config', 'ingest_map.yaml');
  let configMap = { synonyms: {} };
  if (fs.existsSync(yamlPath)) {
    configMap = yaml.parse(fs.readFileSync(yamlPath, 'utf8'));
  }
  
  const reverseMap = {};
  for (const [canonical, synonyms] of Object.entries(configMap.synonyms)) {
    reverseMap[canonical] = canonical;
    for (const syn of synonyms) {
      reverseMap[syn.toLowerCase()] = canonical;
    }
  }

  const csvString = csvBuffer.toString('utf-8');
  const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
  
  const report = {
    total: parsed.data.length,
    accepted: 0,
    rejected: 0,
    rejectedReasons: [],
    duplicatesSkipped: 0,
    mapping: {}, // showing mapped headers
  };

  if (parsed.data.length === 0) {
    return report;
  }

  // Map headers
  const rawHeaders = parsed.meta.fields;
  const headerMap = {};
  for (const h of rawHeaders) {
    const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Also build a reverseMap that has stripped keys
    let found = normalized;
    for (const [canonical, synonyms] of Object.entries(configMap.synonyms)) {
      if (canonical.replace(/[^a-z0-9]/g, '') === normalized) found = canonical;
      for (const syn of synonyms) {
        if (syn.replace(/[^a-z0-9]/g, '') === normalized) {
          found = canonical;
        }
      }
    }
    headerMap[h] = found;
    report.mapping[h] = headerMap[h];
  }

  const validRows = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const rawRow = parsed.data[i];
    const row = {};
    for (const [rawKey, val] of Object.entries(rawRow)) {
      row[headerMap[rawKey]] = val;
    }

    const reasons = [];
    
    // required: district, title, fy, sanctioned_amount, status
    if (!row.district) reasons.push('missing district');
    if (!row.title) reasons.push('missing title');
    if (!row.fy) reasons.push('missing fy');
    if (!row.sanctioned_amount && row.sanctioned_amount !== 0) reasons.push('missing sanctioned_amount');
    
    const amount = parseFloat(row.sanctioned_amount);
    if (isNaN(amount) || amount < 0) reasons.push('invalid sanctioned_amount');
    
    // Dates
    let sanction_date = parseDate(row.sanction_date);
    if (row.sanction_date && !sanction_date) reasons.push('bad_date');

    if (reasons.length > 0) {
      report.rejected++;
      report.rejectedReasons.push({ row: i + 1, reasons });
      continue;
    }

    const workData = {
      title: row.title,
      district_id: row.district, // Note: real app would link to actual District ID
      fy: coerceFY(row.fy),
      sanctioned_amount: amount,
      status: mapStatus(row.status),
      category: mapCategory(row.category),
      sanction_date: sanction_date,
      agency_id: row.agency || null,
    };
    
    workData.import_hash = generateImportHash(workData);
    
    // Warning flag check
    const expenditure = parseFloat(row.expenditure);
    if (!isNaN(expenditure) && expenditure > amount) {
      workData._warning = 'sanctioned < expenditure';
    }

    validRows.push(workData);
    report.accepted++;
  }

  if (mode === 'commit') {
    if (report.rejected > 0) {
      // rollback (fail fast on fatal)
      throw new Error(`Fatal error: ${report.rejected} rows rejected. Transaction aborted.`);
    }

    // Check for duplicates
    const hashes = validRows.map(r => r.import_hash);
    const existing = await prisma.work.findMany({
      where: { import_hash: { in: hashes } },
      select: { import_hash: true }
    });
    
    const existingHashes = new Set(existing.map(e => e.import_hash));
    const payloadHashes = new Set();
    
    const toInsert = validRows.filter(r => {
      delete r._warning;
      if (existingHashes.has(r.import_hash) || payloadHashes.has(r.import_hash)) {
        return false;
      }
      payloadHashes.add(r.import_hash);
      r.id = crypto.randomUUID();
      return true;
    });
    
    report.duplicatesSkipped = validRows.length - toInsert.length;
    
    if (toInsert.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.work.createMany({
          data: toInsert
        });
      });
    }
  }

  return report;
}
