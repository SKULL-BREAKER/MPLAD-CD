const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'app/fraud/page.js');
let code = fs.readFileSync(p, 'utf8');

// Normalize everything to LF to ensure string replacements work
code = code.replace(/\r\n/g, '\n');

// 3. Fix left sidebar work items
const listStyleTarget = `                    background: isActive ? sev.bg : 'var(--surface-2)',
                    border: \`1px solid \${isActive ? sev.border : 'var(--border-color)'}\`,
                    transition: 'all 0.2s',
                    boxShadow: isActive ? 'inset 2px 2px 6px rgba(0,0,0,0.05)' : 'none',
                    color: 'var(--text-main)'`;

const listStyleReplacement = `                    className: "glass-card",
                    background: 'var(--surface-2)',
                    border: isActive ? \`2px solid \${sev.color}\` : \`2px solid transparent\`,
                    transition: 'all 0.2s',
                    boxShadow: isActive ? \`0 0 15px \${sev.color}40, 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light)\` : undefined,
                    color: 'var(--text-main)',
                    borderRadius: 16`;

code = code.replace(listStyleTarget, listStyleReplacement);

// 4. Fix filter buttons
const filterTarget = `                background: filterSev === s
                  ? (SEV_CFG[s]?.bg || 'rgba(42, 58, 49, 0.1)')
                  : 'rgba(42, 58, 49, 0.05)',
                color: filterSev === s ? (SEV_CFG[s]?.color || '#fff') : 'var(--text-muted)',
                border: filterSev === s
                  ? \`1px solid \${SEV_CFG[s]?.border || 'rgba(42, 58, 49, 0.1)'}\`
                  : '1px solid rgba(255,255,255,0.08)'`;

const filterReplacement = `                className: "glass-card",
                background: 'var(--surface-2)',
                color: filterSev === s ? (SEV_CFG[s]?.color || 'var(--text-main)') : 'var(--text-muted)',
                border: filterSev === s
                  ? \`2px solid \${SEV_CFG[s]?.color || 'var(--primary)'}\`
                  : '2px solid transparent',
                borderRadius: 20`;

code = code.replace(filterTarget, filterReplacement);

// 5. Header buttons (rescan, export)
const rescanTarget = `              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(167,139,250,0.4)',
                background: 'rgba(167,139,250,0.12)', color: '#A78BFA', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.8rem' }}`;
const rescanReplacement = `              className="glass-card"
              style={{ padding: '8px 18px', borderRadius: 12, border: 'none',
                color: '#A78BFA', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem' }}`;
code = code.replace(rescanTarget, rescanReplacement);

const exportTarget = `              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.4)',
                background: 'rgba(16,185,129,0.12)', color: '#10B981', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.8rem' }}`;
const exportReplacement = `              className="glass-card"
              style={{ padding: '8px 18px', borderRadius: 12, border: 'none',
                color: '#10B981', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem' }}`;
code = code.replace(exportTarget, exportReplacement);

// 6. Search Input
const searchTarget = `            style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(42, 58, 49, 0.05)',
              border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', outline: 'none', minWidth: 180,
              fontSize: '0.8rem' }}`;
const searchReplacement = `            className="glass-card"
            style={{ padding: '8px 14px', borderRadius: 12, border: 'none', color: 'var(--text-main)', outline: 'none', minWidth: 180,
              fontSize: '0.8rem' }}`;
code = code.replace(searchTarget, searchReplacement);


fs.writeFileSync(p, code);
console.log('Fixed fraud page clay styles robustly!');
