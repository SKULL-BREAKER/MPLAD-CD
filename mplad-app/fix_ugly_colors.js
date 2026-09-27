const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'app/fraud/page.js');
let code = fs.readFileSync(p, 'utf8');

// 1. Earthy Severity Colors
code = code.replace(/#EF4444/g, '#C55A5A'); // Earthy Red
code = code.replace(/#F97316/g, '#D97746'); // Earthy Orange
code = code.replace(/#F59E0B/g, '#C48F37'); // Earthy Mustard
code = code.replace(/#38BDF8/g, '#62A4B0'); // Earthy Teal

// 2. Add D-codes to MODULE_META
const moduleMetaRegex = /const MODULE_META = \{[\s\S]*?\};/;
const newModuleMeta = `const MODULE_META = {
  COST_OUTLIER:   { label: 'Cost Outlier',        icon: '💰', color: '#C48F37' },
  DUPLICATE:      { label: 'Duplicate Work',      icon: '👯', color: '#A78BFA' },
  TIMELINE:       { label: 'Timeline Violation',  icon: '⏱️', color: '#C55A5A' },
  CONTRACTOR_NET: { label: 'Contractor Network',  icon: '🏢', color: '#10B981' },
  SPLITTING:      { label: 'Tender Splitting',    icon: '✂️', color: '#D97746' },
  GUIDELINE:      { label: 'Guideline Breach',    icon: '📏', color: '#62A4B0' },
  BENAMI:         { label: 'Benami Entity',       icon: '🎭', color: '#EC4899' },
  SATELLITE:      { label: 'Ghost Work 🛰️',       icon: '🛰️', color: '#8B5CF6' },
  RISK_FUSION:    { label: 'Risk Fusion',         icon: '🧠', color: '#06B6D4' },
  D1: { label: 'D1: Duplicate', icon: '👯', color: '#A78BFA' },
  D2: { label: 'D2: Cost Anomaly', icon: '💰', color: '#C48F37' },
  D3: { label: 'D3: Timeline Delay', icon: '⏱️', color: '#C55A5A' },
  D6: { label: 'D6: Geo-Conflict', icon: '🗺️', color: '#62A4B0' },
  D6_overlap: { label: 'D6_overlap: Spatial Cluster', icon: '📍', color: '#D97746' },
  D8: { label: 'D8: Monopoly', icon: '🏢', color: '#10B981' },
  ENSEMBLE: { label: 'AI Ensemble', icon: '🧠', color: '#8B5CF6' },
};`;
code = code.replace(moduleMetaRegex, newModuleMeta);

// 3. Remove Neon Glow from list items
code = code.replace(/boxShadow:\s*isActive\s*\?\s*`0 0 15px \$\{sev.color\}40, 8px 8px 16px var\(--shadow-dark\), -8px -8px 16px var\(--shadow-light\)`\s*:\s*undefined/g, 
  "boxShadow: isActive ? `inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light)` : undefined");

// 4. Factor Bar improvements
// Remove neon glow
code = code.replace(/boxShadow:\s*`0 0 6px \$\{meta\.color\}`/g, "boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.1)'");
// Darker track background
code = code.replace(/background:\s*'rgba\(42,58,49,0\.08\)',\s*borderRadius:\s*4,\s*height:\s*6/g, "background: 'var(--border-color)', borderRadius: 4, height: 8, boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.06)'");

// 5. Remove RiskGauge drop-shadow
code = code.replace(/filter:\s*`drop-shadow\(0 0 6px \$\{color\}\)`/g, "filter: 'none'");

fs.writeFileSync(p, code);
console.log('Fixed ugly colors and removed neon glows!');
