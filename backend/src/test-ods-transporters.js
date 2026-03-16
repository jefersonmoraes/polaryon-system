const XLSX = require('xlsx');
const path = require('path');
const ODS_FILE_PATH = path.join(__dirname, '..', '..', 'importar', 'TRANSPORTADORAS.ods');

const workbook = XLSX.readFile(ODS_FILE_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log("Colunas encontradas:", Object.keys(data[0] || {}));
console.log("Primeira linha:", data[0]);
