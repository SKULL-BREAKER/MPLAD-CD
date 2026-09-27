const fs = require('fs');
const path = require('path');

const fraudPath = path.join(__dirname, 'app/fraud/page.js');
let lines = fs.readFileSync(fraudPath, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('{f.evidence?.message ? ('));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('No evidence provided</div>'));

if (startIdx !== -1 && endIdx !== -1) {
  // endIdx is the line with No evidence provided</div>
  // we need to remove the next line as well which is ")}".
  lines.splice(startIdx, endIdx - startIdx + 2, 
    '                <div style={{ margin: 0, fontSize: \'0.75rem\', color: \'var(--text-main)\', lineHeight: 1.6 }}>',
    '                  {formatEvidenceToText(f.module_code, f.evidence)}',
    '                </div>'
  );
  fs.writeFileSync(fraudPath, lines.join('\n'));
  console.log('Fixed fraud lines!');
} else {
  console.log('Could not find lines in fraud page. startIdx:', startIdx, 'endIdx:', endIdx);
}
