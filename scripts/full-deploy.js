import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function run(cmd) {
    console.log(`\n🏃 Executando: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: rootDir });
}

async function start() {
    try {
        console.log('🛡️ INICIANDO DEPLOY TOTAL POLARYON ELITE...');

        // 1. Build do Frontend (Desktop)
        console.log('\n[1/3] Gerando build do frontend para Desktop...');
        run('npm run build:desktop');

        // 2. Build do Robô (Electron)
        console.log('\n[2/3] Empacotando Robô Electron...');
        run('npm run electron:build');

        // 3. Deploy para o VPS e GitHub
        console.log('\n[3/3] Enviando para VPS e Sincronizando GitHub...');
        run('node scripts/deploy.js');

        console.log('\n✅ MISSÃO CUMPRIDA! Sistema atualizado e Auto-Update disparado.');
    } catch (error) {
        console.error('\n❌ ABORTAR MISSÃO: Erro durante o deploy total.');
        console.error(error.message);
        process.exit(1);
    }
}

start();
