const fs = require('fs');
const path = require('path');

function cleanStrayCharacters(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      cleanStrayCharacters(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let code = fs.readFileSync(fullPath, 'utf8');
      
      let lines = code.split('\n');
      let changed = false;
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (!line.trim().startsWith('//')) {
          // Remove U+FE0F (variation selector-16) and U+FE0E (variation selector-15)
          let newLine = line.replace(/[\uFE0F\uFE0E]/g, '');
          if (line !== newLine) {
            lines[i] = newLine;
            changed = true;
          }
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, lines.join('\n'));
        console.log('Cleaned stray chars from:', fullPath);
      }
    }
  }
}

cleanStrayCharacters(path.join(__dirname, 'app'));
