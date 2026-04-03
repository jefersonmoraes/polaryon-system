const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/AdminDashboardPage.tsx',
  'src/pages/AuditMetricsDash.tsx'
];

const map = {
  'õ': '\\u00f5',
  'ã': '\\u00e3',
  'é': '\\u00e9',
  'í': '\\u00ed',
  'á': '\\u00e1',
  'ó': '\\u00f3',
  'ç': '\\u00e7',
  'Õ': '\\u00d5',
  'Ã': '\\u00c3',
  'É': '\\u00c9',
  'Í': '\\u00cd',
  'Á': '\\u00c1',
  'Ó': '\\u00d3',
  'Ç': '\\u00c7',
  'ê': '\\u00ea',
  'Ê': '\\u00ca'
};

files.forEach(file => {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const [char, escape] of Object.entries(map)) {
    content = content.split(char).join(escape);
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Converted ${file} to Unicode Escapes.`);
});
