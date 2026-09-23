/**
 * C4 — ML Cost Corroborator
 * ==========================
 * Loads the existing GBM/RF ensemble model trained in mplad_ai/train2.js
 * and produces an ML cost prediction.
 *
 * HARD RULE: C4 output NEVER triggers a flag alone.
 * It only corroborates C3 (norm) and peer z-scores.
 * If the model is unavailable → V3 still functions fully on C3 + peers.
 *
 * Features used (must match train2.js encoding):
 *   - category_enc (ordinal)
 *   - log_sanctioned
 *   - terrain_mult
 *   - fy
 *   - steel_idx, cement_idx, labor_idx at sanction month
 *   - state_cost_index
 *   - region_enc
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getIndexAt } from './normRegistry.js';
import { sanctionMonth } from './costEstimator.js';

const MODELS_DIR = join(process.cwd(), '..', 'mplad_ai', 'models');

// ─────────────────────────────────────────────────────────────────────────────
// Category encoding (must match train2.js WORK_TYPES)
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_ENC = {
  'ROAD': 0, 'BUILDING': 1, 'SCHOOL': 2, 'HOSPITAL': 3, 'WATER_TANK': 4,
  'DRAIN': 5, 'COMMUNITY_HALL': 6, 'BRIDGE': 7, 'PARK': 8, 'TOILET': 9,
  'ANGANWADI': 10, 'CULVERT': 11,
  // V3 category names
  'bridge': 7, 'road': 0, 'classroom': 2, 'drinking_water': 4,
  'sanitation_block': 9, 'community_hall': 6, 'electrification': 5,
};

const STATE_COST_INDEX = {
  'Arunachal Pradesh':1.35,'Sikkim':1.30,'Himachal Pradesh':1.25,
  'Uttarakhand':1.22,'Jammu & Kashmir':1.28,'Ladakh':1.40,
  'Manipur':1.30,'Nagaland':1.28,'Mizoram':1.25,'Meghalaya':1.20,
  'Tripura':1.18,'Assam':1.10,'Maharashtra':1.05,'Delhi':1.10,
  'Gujarat':1.00,'Karnataka':1.00,'Tamil Nadu':1.02,'Telangana':1.00,
  'Andhra Pradesh':0.98,'Odisha':0.95,'Rajasthan':0.96,
  'Madhya Pradesh':0.94,'Chhattisgarh':0.96,'Jharkhand':0.95,
  'Bihar':0.93,'Uttar Pradesh':0.95,'West Bengal':1.00,
  'Punjab':1.00,'Haryana':1.02,'Kerala':1.08,'Goa':1.12,
  'Andaman and Nicobar Islands':1.45,'Lakshadweep':1.50,'DEFAULT':1.00
};

const STATE_REGION = {
  'Andhra Pradesh':'South','Telangana':'South','Tamil Nadu':'South',
  'Karnataka':'South','Kerala':'South','Goa':'West',
  'Maharashtra':'West','Gujarat':'West','Rajasthan':'West',
  'Uttar Pradesh':'North','Bihar':'East','West Bengal':'East',
  'Odisha':'East','Jharkhand':'East','Chhattisgarh':'Central',
  'Madhya Pradesh':'Central','Haryana':'North','Punjab':'North',
  'Delhi':'North','Himachal Pradesh':'North','Uttarakhand':'North',
  'Jammu & Kashmir':'North','Ladakh':'North',
  'Assam':'NorthEast','Manipur':'NorthEast','Nagaland':'NorthEast',
  'Mizoram':'NorthEast','Meghalaya':'NorthEast','Sikkim':'NorthEast',
  'Tripura':'NorthEast','Arunachal Pradesh':'NorthEast',
  'Andaman and Nicobar Islands':'Islands','Lakshadweep':'Islands',
  'DEFAULT':'Central'
};
const REGION_ENC = {'South':0,'West':1,'North':2,'East':3,'Central':4,'NorthEast':5,'Islands':6};

// ─────────────────────────────────────────────────────────────────────────────
// Model loader (lazy)
// ─────────────────────────────────────────────────────────────────────────────
let _model = null;
let _modelLoaded = false;
let _modelError = null;

function loadModel() {
  if (_modelLoaded) return _model;
  _modelLoaded = true;

  // Try cost model first (from train2.js cost bands), then cost_model.json
  const candidates = [
    join(MODELS_DIR, 'cost_model.json'),
    join(MODELS_DIR, 'gbm_model.json'),
    join(MODELS_DIR, 'rf_model.json'),
    join(MODELS_DIR, 'ensemble.json'),
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        _model = JSON.parse(readFileSync(p, 'utf-8'));
        console.log(`[C4] Loaded model from ${p}`);
        return _model;
      } catch (e) {
        _modelError = `Failed to parse ${p}: ${e.message}`;
      }
    }
  }

  _modelError = 'No trained model found in mplad_ai/models/. Run mplad_ai/train2.js first.';
  console.warn(`[C4] ${_modelError}`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple GBM tree inference (compatible with train2.js tree format)
// ─────────────────────────────────────────────────────────────────────────────
function predictTree(tree, features) {
  let node = tree;
  while (node.leaf === undefined) {
    const val = features[node.feature] ?? 0;
    node = val <= node.threshold ? node.left : node.right;
  }
  return node.leaf;
}

function predictGBM(model, features) {
  if (!model || !model.trees) return null;
  let pred = model.base_score ?? 0;
  for (const tree of model.trees) {
    pred += (model.learning_rate ?? 0.1) * predictTree(tree, features);
  }
  return Math.exp(pred); // log-target model
}

function predictRF(model, features) {
  if (!model || !model.trees) return null;
  const preds = model.trees.map(t => predictTree(t, features));
  const avg = preds.reduce((a, b) => a + b, 0) / preds.length;
  return Math.exp(avg);
}

function predictEnsemble(model, features) {
  if (!model) return null;
  // Handle ensemble wrapper { gbm: {...}, rf: {...}, weights: [...] }
  if (model.gbm && model.rf) {
    const gbmPred = predictGBM(model.gbm, features);
    const rfPred  = predictRF(model.rf, features);
    if (gbmPred === null || rfPred === null) return gbmPred ?? rfPred;
    const [wGbm, wRf] = model.weights ?? [0.6, 0.4];
    return wGbm * gbmPred + wRf * rfPred;
  }
  // Single model
  if (model.trees && model.base_score !== undefined) return predictGBM(model, features);
  if (model.trees) return predictRF(model, features);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature extractor
// ─────────────────────────────────────────────────────────────────────────────
function extractFeatures(work, category, terrainMult = 1.0) {
  const month = sanctionMonth(work);
  const idx   = getIndexAt(month) ?? { steel_idx: 1.0, cement_idx: 1.0, labor_idx: 1.0 };
  const state = work.status || 'DEFAULT';
  const fy    = parseInt(work.fy?.split('-')[0]) || 2022;

  return [
    CATEGORY_ENC[category] ?? CATEGORY_ENC[work.category] ?? 0,
    Math.log(Math.max(work.sanctioned_amount || 100000, 100000)),
    terrainMult,
    fy,
    idx.steel_idx,
    idx.cement_idx,
    idx.labor_idx,
    STATE_COST_INDEX[state] ?? STATE_COST_INDEX['DEFAULT'],
    REGION_ENC[STATE_REGION[state] ?? 'Central'] ?? 4,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: predictCost(work, category, terrainMult)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Produce an ML corroborating cost prediction.
 * Returns null prediction if model unavailable — V3 still works without C4.
 *
 * @returns {{ ml_pred, mape, model_version, temporal_split_note, available }}
 */
export function predictCost(work, category = null, terrainMult = 1.0) {
  const model = loadModel();

  if (!model) {
    return {
      ml_pred: null,
      mape: null,
      available: false,
      error: _modelError,
      temporal_split_note: 'Model not trained. Run: node mplad_ai/train2.js',
    };
  }

  try {
    const features = extractFeatures(work, category || work.public_utility_term_id, terrainMult);
    const mlPred   = predictEnsemble(model, features);

    return {
      ml_pred:    mlPred !== null ? Math.round(mlPred * 100) / 100 : null,
      mape:       model.validation_mape ?? model.mape ?? null,
      model_version: model.version ?? 'v2',
      available:  mlPred !== null,
      temporal_split_note: 'Train ≤ FY22, validate FY23+. See /admin for MAPE.',
      features_used: features,  // for transparency
    };
  } catch (e) {
    return {
      ml_pred: null, mape: null, available: false,
      error: `Inference error: ${e.message}`,
    };
  }
}

/**
 * Get model performance stats for the /admin page.
 */
export function getModelStats() {
  const model = loadModel();
  if (!model) return { available: false, error: _modelError };
  return {
    available: true,
    mape:             model.validation_mape ?? model.mape ?? null,
    train_size:       model.train_size ?? null,
    validation_size:  model.validation_size ?? null,
    model_version:    model.version ?? 'v2',
    temporal_split:   'Train ≤ FY22, Validate FY23+',
    last_trained:     model.trained_at ?? null,
  };
}
