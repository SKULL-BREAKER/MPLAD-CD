const fs = require('fs');
let c = fs.readFileSync('mplad_ai/synthetic_data_generator.js', 'utf8');
c = c.replace(/const district = 'Lucknow';/g, "const district = 'DIST-LUCKNO';");
c = c.replace(/for \(let i = 0; i < 8; i\+\+\) {/g, 'for (let i = 0; i < 80; i++) {');
fs.writeFileSync('mplad_ai/synthetic_data_generator.js', c);
