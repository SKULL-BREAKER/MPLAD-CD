const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'app'));

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');

  // Replace any rgba(255,255,255, 0.x)
  // For text color context (opacity > 0.25): replace with var(--text-muted)
  content = content.replace(/['"`]rgba\(255,\s*255,\s*255,\s*0\.[3-9]\d*?\)['"`]/g, "'var(--text-muted)'");
  
  // For borders/backgrounds (opacity <= 0.25): replace with rgba(42,58,49,0.1)
  content = content.replace(/['"`]rgba\(255,\s*255,\s*255,\s*0\.[0-2]\d*?\)['"`]/g, "'rgba(42, 58, 49, 0.1)'");
  
  // If it's literally just color: 'rgba(255,255,255,...)'
  content = content.replace(/color:\s*['"`]rgba\(255,\s*255,\s*255,\s*[^'"`]+['"`]/g, "color: 'var(--text-muted)'");

  if (content !== fs.readFileSync(f, 'utf8')) {
    fs.writeFileSync(f, content);
    console.log('Fixed glass styles in', f);
  }
});
