import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function run(cmd) {
    console.log(`\n🏃 Executando: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: rootDir });
}

// Bumpa o patch version (ex: 3.8.163 → 3.8.164)
function bumpVersion() {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const parts = pkg.version.split('.');
    parts[2] = parseInt(parts[2]) + 1;
    const newVersion = parts.join('.');
    console.log(`📦 Bumping versão: ${pkg.version} → ${newVersion}`);
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    return newVersion;
}

async function start() {
    try {
        console.log('🛡️ INICIANDO DEPLOY TOTAL POLARYON ELITE...');

        // 0. Bump versão automático
        const newVersion = bumpVersion();

        // 1. Build do Frontend (Desktop)
        console.log(`\n[1/4] Gerando build do frontend para Desktop v${newVersion}...`);
        run('npm run build:desktop');

        // 2. Build do Robô (Electron)
        console.log(`\n[2/4] Empacotando Robô Electron v${newVersion}...`);
        run('npm run electron:build');

        // 3. Git commit + push
        console.log(`\n[3/4] Commitando e enviando v${newVersion} para o GitHub...`);
        run('git add .');
        run(`git commit -m "chore(release): v${newVersion}"`);
        run('git push origin main');

        // 4. Deploy para o VPS
        console.log(`\n[4/4] Enviando para VPS...`);
        run('node scripts/deploy.js');

        console.log(`\n✅ MISSÃO CUMPRIDA! v${newVersion} buildada, commitada e deployada. Auto-Update pronto.`);
    } catch (error) {
        console.error('\n❌ ABORTAR MISSÃO: Erro durante o deploy total.');
        console.error(error.message);
        process.exit(1);
    }
}

start();
