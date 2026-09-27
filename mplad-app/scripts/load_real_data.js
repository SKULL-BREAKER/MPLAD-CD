const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'demo.db');
const db = new Database(dbPath);

console.log('Clearing old synthetic data...');
db.exec(`
  DELETE FROM works;
  DELETE FROM mps;
  DELETE FROM districts;
  DELETE FROM agencies;
`);

const insertMp = db.prepare(`INSERT OR IGNORE INTO mps (id, name, constituency, state, house) VALUES (?, ?, ?, ?, ?)`);
const insertDistrict = db.prepare(`INSERT OR IGNORE INTO districts (id, name, state) VALUES (?, ?, ?)`);
const insertWork = db.prepare(`
  INSERT INTO works (id, title, category, mp_id, district_id, status, sanctioned_amount, expenditure, sanction_date, completion_date, fy)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2025-26')
`);

db.exec('BEGIN TRANSACTION;');

function loadCSV(filename, isCompleted) {
  const filePath = path.join(__dirname, '..', '..', filename);
  console.log('Loading ' + filePath);
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found: ' + filePath);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  let count = 0;
  
  Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    step: function(row) {
      const data = row.data;
      if (!data['Work ID']) return;
      
      const workId = data['Work ID'].toString();
      const title = data['Work Description'] || 'Untitled Work';
      const category = data['Category'] || 'Unknown';
      const mpName = data['MP Name'] || 'Unknown MP';
      const constituency = data['Constituency'] || 'Unknown';
      const state = data['State'] || 'Unknown';
      const house = data['House'] || 'Lok Sabha';
      
      // Amount differs based on file
      const amount = parseFloat(data['Final Amount (₹)'] || data['Recommended Amount (₹)'] || 0);
      const dateStr = data['Completed Date'] || data['Recommendation Date'] || '';
      const date = dateStr ? dateStr.substring(0, 10) : '';
      
      const status = isCompleted ? 'COMPLETED' : 'PROPOSED';
      
      // Insert MP
      const mpId = mpName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 20);
      insertMp.run(mpId, mpName, constituency, state, house);
      
      // Insert District
      const distId = constituency.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 20);
      insertDistrict.run(distId, constituency, state);
      
      // Insert Work
      try {
        insertWork.run(
          workId, 
          title, 
          category, 
          mpId, 
          distId, 
          status, 
          amount, // sanctioned
          isCompleted ? amount : 0, // expenditure
          isCompleted ? date : '', 
          isCompleted ? date : ''
        );
        count++;
      } catch(e) {
        // Ignore duplicate primary keys if they exist across files
      }
    }
  });
  console.log(`Loaded ${count} works from ${filename}`);
}

loadCSV('mplads_completed_works_2026-09-14.csv', true);
loadCSV('mplads_recommended_works_2026-09-14.csv', false);

db.exec('COMMIT;');
db.close();

console.log('Real-world data load complete!');
