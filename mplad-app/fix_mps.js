const Database = require('better-sqlite3');
const db = new Database('demo.db');

try {
  db.exec('BEGIN TRANSACTION;');

  // Create new mps table with strict TEXT for constituency
  db.exec(`
    CREATE TABLE mps_new (
      id TEXT PRIMARY KEY,
      name TEXT,
      house TEXT,
      party TEXT,
      state TEXT,
      constituency TEXT,
      nodal_districts TEXT
    );
  `);

  // Copy data from old to new, casting constituency to TEXT
  db.exec(`
    INSERT INTO mps_new (id, name, house, party, state, constituency, nodal_districts)
    SELECT id, name, house, party, state, CAST(constituency AS TEXT), nodal_districts
    FROM mps;
  `);

  // Drop old table
  db.exec('DROP TABLE mps;');

  // Rename new table to mps
  db.exec('ALTER TABLE mps_new RENAME TO mps;');

  db.exec('COMMIT;');
  console.log('Fixed mps schema and data.');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('Failed to fix mps:', err.message);
}
