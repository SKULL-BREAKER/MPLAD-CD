const Database = require('better-sqlite3');
const db1 = new Database('demo.db');
try {
  db1.prepare("ALTER TABLE works ADD COLUMN import_hash TEXT;").run();
  console.log("Column added.");
} catch(e) {
  console.log(e.message);
}
