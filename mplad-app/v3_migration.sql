CREATE TABLE IF NOT EXISTS WorkSpec (
  work_id TEXT PRIMARY KEY,
  spec_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'inferred',
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS CostEstimate (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  work_id TEXT NOT NULL,
  method TEXT NOT NULL,
  expected_cost REAL NOT NULL DEFAULT 0,
  mape REAL NOT NULL DEFAULT 0,
  breakdown_json TEXT NOT NULL DEFAULT '{}',
  verdict TEXT,
  verdict_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(work_id, method)
);
