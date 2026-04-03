const fs = require('fs');
const files = [
  '/var/www/polaryon/src/pages/AdminDashboardPage.tsx',
  '/var/www/polaryon/src/pages/AuditMetricsDash.tsx'
];

files.forEach(p => {
  if (!fs.existsSync(p)) {
      console.log('File not found: ' + p);
      return;
  }
  const buffer = fs.readFileSync(p);
  // Check for UTF-8 BOM: EF BB BF
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    console.log('Removing BOM from ' + p);
    fs.writeFileSync(p, buffer.slice(3));
  } else {
    // Also ensure it is UTF-8 (if it was somehow corrupted to UTF-16)
    // But since we see Ãµ, it is likely just BOM or lack of charset header
    console.log('No BOM found in ' + p);
  }
});
