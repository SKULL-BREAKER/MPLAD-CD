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
  let changed = false;

  // Replace db.work.findMany({ ... }) -> db.work.findMany({ take: 50, ... })
  // But avoid replacing if take: is already there
  let newContent = content.replace(/db\.work\.findMany\(\s*\{/g, (match) => {
    return 'db.work.findMany({ take: 100,';
  });

  // Replace db.work.findMany() -> db.work.findMany({ take: 100 })
  newContent = newContent.replace(/db\.work\.findMany\(\s*\)/g, "db.work.findMany({ take: 100 })");

  if (newContent !== content) {
    fs.writeFileSync(f, newContent);
    console.log('Fixed', f);
  }
});
