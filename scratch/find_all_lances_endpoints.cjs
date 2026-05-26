const fs = require('fs');
const path = require('path');

const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\siga-client\\app_extracted\\.webpack\\main\\index.js';
if (!fs.existsSync(file)) {
    console.log("File not found");
    process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');
const regex = /comprasnet-disputa\/v1\/compras\/[^\`\'\"]+/g;
const matches = content.match(regex) || [];

console.log("=== COMPRASNET DISPUTA ENDPOINTS FOUND IN SIGA ===");
const uniqueMatches = Array.from(new Set(matches));
uniqueMatches.forEach(m => console.log(m));
