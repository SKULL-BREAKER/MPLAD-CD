const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
      let code = fs.readFileSync(fullPath, 'utf8');
      let originalCode = code;

      // Color replacements
      code = code.replace(/#EF4444/g, '#C55A5A'); // Earthy Red
      code = code.replace(/#F97316/g, '#D97746'); // Earthy Orange
      code = code.replace(/#F59E0B/g, '#C48F37'); // Earthy Mustard
      code = code.replace(/#38BDF8/g, '#62A4B0'); // Earthy Teal
      
      // Remove neon glows (monitor page specific)
      code = code.replace(/glow:\s*'0 0 20px rgba\([^)]+\)'/g, "glow: 'none'");
      code = code.replace(/filter:\s*`drop-shadow\([^)]+\)`/g, "filter: 'none'");

      if (code !== originalCode) {
        fs.writeFileSync(fullPath, code);
        console.log('Updated colors in:', fullPath);
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'app'));
