const fs = require('fs');
let c = fs.readFileSync('mplad-app/lib/pipeline/metrics.js', 'utf8');
c = c.replace(/    'D5': 'CONTRACTOR_CONCENTRATION',\r?\n    'D5': 'CONTRACTOR_CONCENTRATION',/g, "    'D5': 'CONTRACTOR_CONCENTRATION',");
fs.writeFileSync('mplad-app/lib/pipeline/metrics.js', c);
