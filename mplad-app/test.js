const Database = require('better-sqlite3');
const db1 = new Database('demo.db');
console.log('demo.db tables:', db1.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
const db2 = new Database('data/app.db');
console.log('data/app.db tables:', db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
