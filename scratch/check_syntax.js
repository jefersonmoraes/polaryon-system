
import fs from 'fs';
const content = fs.readFileSync('e:\\-JEFÃO-\\APLICATIVOS\\POLARYON KUNBUN\\polaryon-system\\src\\components\\board\\CardDetailPanel.tsx', 'utf8');

const openDivs = (content.match(/<div/g) || []).length;
const closeDivs = (content.match(/<\/div>/g) || []).length;
const openBraces = (content.match(/\{/g) || []).length;
const closeBraces = (content.match(/\}/g) || []).length;
const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;

console.log(`Divs: ${openDivs} open, ${closeDivs} close (diff: ${openDivs - closeDivs})`);
console.log(`Braces: ${openBraces} open, ${closeBraces} close (diff: ${openBraces - closeBraces})`);
console.log(`Parens: ${openParens} open, ${closeParens} close (diff: ${openParens - closeParens})`);
