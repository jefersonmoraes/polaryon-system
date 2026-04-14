
const fs = require('fs');
const content = fs.readFileSync('e:\\-JEFÃO-\\APLICATIVOS\\POLARYON KUNBUN\\polaryon-system\\src\\components\board\\CardDetailPanel.tsx', 'utf8');

const divOpens = (content.match(/<div/g) || []).length;
const divCloses = (content.match(/<\/div>/g) || []).length;
const braceOpens = (content.match(/\{/g) || []).length;
const braceCloses = (content.match(/\}/g) || []).length;

console.log(`Divs: ${divOpens} open, ${divCloses} close (Diff: ${divOpens - divCloses})`);
console.log(`Braces: ${braceOpens} open, ${braceCloses} close (Diff: ${braceOpens - braceCloses})`);
