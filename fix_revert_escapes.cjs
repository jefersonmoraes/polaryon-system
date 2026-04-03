const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/AdminDashboardPage.tsx',
  'src/pages/AuditMetricsDash.tsx'
];

const map = {
  '\\u00f5': 'õ',
  '\\u00e3': 'ã',
  '\\u00e9': 'é',
  '\\u00ed': 'í',
  '\\u00e1': 'á',
  '\\u00f3': 'ó',
  '\\u00e7': 'ç',
  '\\u00d5': 'Õ',
  '\\u00c3': 'Ã',
  '\\u00c9': 'É',
  '\\u00cd': 'Í',
  '\\u00c1': 'Á',
  '\\u00d3': 'Ó',
  '\\u00c7': 'Ç',
  '\\u00ea': 'ê',
  '\\u00ca': 'Ê'
};

files.forEach(file => {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const [escape, char] of Object.entries(map)) {
    content = content.split(escape).join(char);
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Reverted ${file} to normal characters.`);
});
