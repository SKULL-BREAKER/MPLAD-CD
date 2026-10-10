const fs = require('fs');
const path = require('path');

function copyDir(src, dst) {
  if (!fs.existsSync(src)) {
    console.log(`Skipping (not found): ${src}`);
    return;
  }
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
  console.log(`Copied: ${src} → ${dst}`);
}

// 1. Copy static assets into standalone
copyDir('.next/static', '.next/standalone/.next/static');

// 2. Copy public folder into standalone
copyDir('public', '.next/standalone/public');

// 3. Copy demo.db into standalone (Prisma SQLite database)
const dbSrc = 'demo.db';
const dbDst = '.next/standalone/demo.db';
if (fs.existsSync(dbSrc)) {
  fs.copyFileSync(dbSrc, dbDst);
  console.log(`Copied: ${dbSrc} → ${dbDst}`);
} else {
  console.warn('WARNING: demo.db not found! Server will have no data.');
}

console.log('postbuild: standalone output is ready.');
