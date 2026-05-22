const fs = require('fs');
const content = fs.readFileSync('importar/siga-client/app_extracted/.webpack/main/index.js', 'utf8');

const idx = content.indexOf('async makeRequest(');
if (idx !== -1) {
    console.log(content.substring(idx - 1000, idx + 2000).replace(/\r?\n/g, ' '));
} else {
    console.log('async makeRequest not found by exact string.');
}
