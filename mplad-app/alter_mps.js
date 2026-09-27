const Database = require('better-sqlite3');
const db = new Database('demo.db');
try {
  // SQLite doesn't have an easy ALTER COLUMN TYPE, but we can UPDATE
  // and CAST to string, but since SQLite is dynamically typed, the actual type of the value is INT.
  // We can update the table to cast all rows to text:
  db.prepare("UPDATE mps SET constituency = CAST(constituency AS TEXT)").run();
  console.log("Updated mps.");
} catch(e) {
  console.log(e.message);
}
