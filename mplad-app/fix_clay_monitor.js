const fs = require('fs');
const path = require('path');

function replaceBrightHex(content) {
  // Replace #F8FAFC, #FFFFFF, #FFF, #F1F5F9, #E2E8F0, #CBD5E1 with var(--text-main)
  return content.replace(/['"]#(F8FAFC|FFFFFF|FFF|F1F5F9|E2E8F0|CBD5E1)['"]/gi, "'var(--text-main)'");
}

let monitorPath = path.join(__dirname, 'app/monitor/page.js');
let monitorCode = fs.readFileSync(monitorPath, 'utf8');
monitorCode = replaceBrightHex(monitorCode);

// Replace AlertCard styling
monitorCode = monitorCode.replace(
  /<div style=\{\{\s*background:\s*sc\.bg,\s*border:\s*`1px solid \$\{sc\.border\}`,\s*borderRadius:\s*'12px',\s*padding:\s*'14px 18px',\s*boxShadow:\s*sc\.glow,\s*position:\s*'relative',\s*overflow:\s*'hidden',\s*animation:\s*'fadeIn 0\.3s ease forwards',\s*\}\}>/g,
  '<div className="clay-card" style={{ padding: "14px 18px", position: "relative", overflow: "hidden", animation: "fadeIn 0.3s ease forwards", marginBottom: "16px" }}>'
);

// Replace DimPanel mini alerts
monitorCode = monitorCode.replace(
  /style=\{\{\s*background:\s*sc\.bg,\s*border:\s*`1px solid \$\{sc\.border\}`,\s*padding:\s*'8px 12px',\s*borderRadius:\s*'6px',\s*fontSize:\s*'0\.8rem'\s*\}\}/g,
  'className="clay-card" style={{ padding: "12px", fontSize: "0.8rem", marginBottom: "8px" }}'
);

fs.writeFileSync(monitorPath, monitorCode);

// Cost page fixes
let costPath = path.join(__dirname, 'app/officer/[workId]/cost/page.js');
let costCode = fs.readFileSync(costPath, 'utf8');
costCode = replaceBrightHex(costCode);
fs.writeFileSync(costPath, costCode);

console.log('Fixed hex and clay morphism!');
