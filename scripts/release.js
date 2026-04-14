import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const downloadPagePath = path.join(rootDir, 'src/pages/DesktopDownloadPage.tsx');

function updateVersion() {
    console.log('🚀 Iniciando Processo de Release do Terminal...');

    // 1. Ler package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = packageJson.version;
    
    // Incrementa o patch (ex: 1.2.0 -> 1.2.1)
    const versionParts = oldVersion.split('.');
    versionParts[2] = parseInt(versionParts[2]) + 1;
    const newVersion = versionParts.join('.');

    console.log(`📦 Bumping versão: ${oldVersion} -> ${newVersion}`);

    // 2. Atualizar package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // 3. Atualizar DesktopDownloadPage.tsx
    let downloadPage = fs.readFileSync(downloadPagePath, 'utf8');
    const versionRegex = /const version = "[^"]*";/;
    downloadPage = downloadPage.replace(versionRegex, `const version = "${newVersion}";`);
    fs.writeFileSync(downloadPagePath, downloadPage);

    console.log('✅ Versões sincronizadas com sucesso.');

    // 4. Rodar Build
    console.log('🔨 Iniciando Compilação do Terminal...');
    try {
        execSync('npm run electron:build:terminal', { stdio: 'inherit', cwd: rootDir });
        console.log('🎉 Build concluído com sucesso!');
        console.log(`\n👉 Novo instalador: dist_desktop/Polaryon-v${newVersion}-Setup.exe`);
    } catch (error) {
        console.error('❌ Erro durante o build:', error.message);
        process.exit(1);
    }
}

updateVersion();
