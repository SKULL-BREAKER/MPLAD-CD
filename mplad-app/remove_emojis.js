const fs = require('fs');
const path = require('path');

function removeEmojis(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.expo' || file === 'assets') continue;
    if (fs.statSync(fullPath).isDirectory()) {
      removeEmojis(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]/gu;
      if (emojiRegex.test(content)) {
        content = content.replace(emojiRegex, '');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Removed emojis from', fullPath);
      }
    }
  }
}

const targetDir = process.argv[2];
if (targetDir) {
  removeEmojis(path.resolve(targetDir));
}
