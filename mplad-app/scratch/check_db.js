const Database = require('better-sqlite3');
const db = new Database('demo.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(({name}) => {
  try {
    const n = db.prepare(`SELECT COUNT(*) as n FROM [${name}]`).get().n;
    console.log(`${name}: ${n}`);
  } catch(e) {}
});
