const fs = require('fs');
const path = require('path');

const monitorPath = path.join(__dirname, 'app/monitor/page.js');
let lines = fs.readFileSync(monitorPath, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('<ul style={{ margin: 0, paddingLeft: \'16px\''));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('</ul>'));

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx + 1, 
    '            <div style={{ margin: 0, fontSize: \'0.75rem\', color: \'var(--text-main)\', lineHeight: 1.6 }}>',
    '              {formatEvidenceToText(alert.category, alert.evidence_json)}',
    '            </div>'
  );
  fs.writeFileSync(monitorPath, lines.join('\n'));
  console.log('Fixed lines!');
} else {
  console.log('Could not find lines');
}
