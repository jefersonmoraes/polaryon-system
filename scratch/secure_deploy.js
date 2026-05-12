
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const config = {
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
};

const remotePath = "/var/www/polaryon/storage/download/";

async function deploy() {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const version = packageJson.version;
    const exeName = `Polaryon-v${version}-Setup.exe`;
    const filesToUpload = [
        { local: path.join(rootDir, 'dist_desktop', exeName), remote: path.join(remotePath, exeName) },
        { local: path.join(rootDir, 'dist_desktop', `${exeName}.blockmap`), remote: path.join(remotePath, `${exeName}.blockmap`) },
        { local: path.join(rootDir, 'dist_desktop', 'latest.yml'), remote: path.join(remotePath, 'latest.yml') }
    ];

    console.log(`🚀 Iniciando Deploy SEGURO para v${version}...`);

    const conn = new Client();

    conn.on('ready', () => {
        console.log('✅ Conexão SSH Estabelecida.');
        
        conn.sftp((err, sftp) => {
            if (err) throw err;

            let uploadedCount = 0;
            filesToUpload.forEach(file => {
                console.log(`📤 Enviando: ${path.basename(file.local)}...`);
                sftp.fastPut(file.local, file.remote, (err) => {
                    if (err) {
                        console.error(`❌ Erro ao enviar ${file.local}:`, err);
                        conn.end();
                        process.exit(1);
                    }
                    console.log(`✅ Concluído: ${path.basename(file.local)}`);
                    uploadedCount++;

                    if (uploadedCount === filesToUpload.length) {
                        console.log('🚀 Todos os arquivos enviados. Executando comandos remotos...');
                        runRemoteCommands(conn);
                    }
                });
            });
        });
    }).connect(config);
}

function runRemoteCommands(conn) {
    const remoteCmd = `cd /var/www/polaryon && git fetch origin main && git reset --hard origin/main && cd backend && npx prisma@6 db push && cd .. && npm run build && rm -rf dist/download && ln -s /var/www/polaryon/storage/download dist/download && pm2 restart polaryon-backend`;
    
    conn.exec(remoteCmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`\n✅ DEPLOY COMPLETO! Código de saída: ${code}`);
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}

deploy().catch(console.error);
