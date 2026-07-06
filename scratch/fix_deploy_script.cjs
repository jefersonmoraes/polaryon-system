const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'vps-deploy.sh');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF for matching
content = content.replace(/\r\n/g, '\n');

// Fix cd placement
content = content.replace(
  'echo "=== [0/5] Limpando versões antigas de instaladores ==="',
  'cd /var/www/polaryon\necho "=== [0/5] Limpando versões antigas de instaladores ==="'
);

// Remove duplicate cd
content = content.replace(
  'cd /var/www/polaryon\ngit fetch origin main',
  'git fetch origin main'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("vps-deploy.sh modified successfully!");
