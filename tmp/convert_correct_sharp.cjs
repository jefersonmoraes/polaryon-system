const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

async function convert(svgPath, outPath) {
    let svgContent = fs.readFileSync(svgPath, 'utf8');
    // Fix invalid type exported by some software so sharp doesn't fail
    svgContent = svgContent.replace(/data:img\//g, 'data:image/');
    
    await sharp(Buffer.from(svgContent))
        .webp({ quality: 80 })
        .toFile(outPath);
    console.log(`Converted ${svgPath} to ${outPath}`);
}

(async () => {
    try {
        await convert(path.join(__dirname, '../importar/belt.svg'), path.join(__dirname, '../src/assets/belt.webp'));
        await convert(path.join(__dirname, '../importar/jef.svg'), path.join(__dirname, '../src/assets/jef.webp'));
        console.log('Images converted correctly preserving SVG layout.');
    } catch(e) {
        console.error('Error during conversion:', e);
    }
})();
