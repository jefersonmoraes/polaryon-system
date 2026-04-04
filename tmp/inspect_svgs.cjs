const fs = require('fs');
const path = require('path');

function extractImages(svgPath, outputPrefix) {
    const content = fs.readFileSync(svgPath, 'utf8');
    const matches = content.matchAll(/data:(?:image|img)\/[^;]+;base64,([^"]+)/g);
    let i = 0;
    for (const match of matches) {
        const base64 = match[1];
        const buffer = Buffer.from(base64, 'base64');
        const ext = svgPath.includes('png') || content.includes('image/png') ? 'png' : 'jpg'; // simplistic
        const outputPath = `${outputPrefix}_${i}.${ext}`;
        fs.writeFileSync(outputPath, buffer);
        console.log(`Extracted: ${outputPath} (${buffer.length} bytes)`);
        i++;
    }
}

const importarPath = 'e:\\-JEFÃO-\\APLICATIVOS\\POLARYON KUNBUN\\polaryon-system\\importar';
const tempPath = 'e:\\-JEFÃO-\\APLICATIVOS\\POLARYON KUNBUN\\polaryon-system\\tmp';

if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);

console.log('Inspecting belt.svg...');
extractImages(path.join(importarPath, 'belt.svg'), path.join(tempPath, 'belt_extracted'));

console.log('Inspecting jef.svg...');
extractImages(path.join(importarPath, 'jef.svg'), path.join(tempPath, 'jef_extracted'));
