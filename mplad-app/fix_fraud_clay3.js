const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'app/fraud/page.js');
let code = fs.readFileSync(p, 'utf8');

// Fix filter buttons
code = code.replace(/className: "glass-card",\s*background:/g, 'background:');
code = code.replace(/style={{ padding: '6px 14px'/g, 'className="glass-card" style={{ padding: \'6px 14px\'');

// Fix left sidebar list items
code = code.replace(/className: "glass-card",\s*background:/g, 'background:');
code = code.replace(/style={{\s*padding: '14px 16px'/g, 'className="glass-card" style={{ padding: \'14px 16px\'');

fs.writeFileSync(p, code);
console.log('Fixed className syntax!');
