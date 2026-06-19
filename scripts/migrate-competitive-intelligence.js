import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vpsIp = '191.252.93.79';

function sshExec(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let out = '', errOut = '';
            stream.on('data', (d) => { out += d.toString(); process.stdout.write(d.toString()); });
            stream.stderr.on('data', (d) => { errOut += d.toString(); process.stderr.write(d.toString()); });
            stream.on('close', (code) => {
                if (code === 0) resolve(out);
                else reject(new Error(`Exit ${code}: ${errOut.slice(0, 500)}`));
            });
        });
    });
}

function sftpPut(conn, local, remote) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            sftp.fastPut(local, remote, (e) => {
                sftp.end();
                if (e) reject(e); else resolve();
            });
        });
    });
}

async function migrate() {
    console.log('\n🗄️  PRISMA MIGRATION — Competitive Intelligence\n');

    const conn = new Client();
    await new Promise((resolve, reject) => {
        conn.on('ready', resolve);
        conn.on('error', reject);
        conn.connect({
            host: vpsIp, username: 'root',
            password: 'Jaguar2018#', readyTimeout: 15000
        });
    });
    console.log('  ✅ Conectado à VPS');

    // 1. Copy migration SQL to VPS
    const migrationSql = path.join(__dirname, '..', 'backend', 'prisma', 'migrations', '20260619_add_competitive_intelligence', 'migration.sql');
    const remoteTmp = '/tmp/migration_competitive_intelligence.sql';
    
    console.log('  📤 Copiando SQL de migração...');
    await sftpPut(conn, migrationSql, remoteTmp);
    console.log('  ✅ SQL copiado');

    // 2. Apply migration via psql
    console.log('  🗄️  Aplicando migração no banco...');
    const psqlUser = 'polaryon';
    const psqlPass = 'Jaguar2018jolela#';
    const psqlDb = 'polaryon_db';
    
    await sshExec(conn, `PGPASSWORD='${psqlPass}' psql -U ${psqlUser} -h localhost -d ${psqlDb} -f ${remoteTmp}`);
    console.log('  ✅ Migração aplicada com sucesso!');

    // 3. Verify tables exist
    console.log('  🔍 Verificando tabelas criadas...');
    const result = await sshExec(conn, `PGPASSWORD='${psqlPass}' psql -U ${psqlUser} -h localhost -d ${psqlDb} -c "\\dt BidHistory" -c "\\dt CompetitorProfile" -c "\\dt AuctionRound" -c "\\dt AuctionResult" -c "\\dt RateLimitModel"`);
    
    // 4. Clean up
    await sshExec(conn, `rm -f ${remoteTmp}`);
    
    conn.end();
    console.log('\n✅ Migração concluída! Tabelas competitive intelligence criadas no banco.\n');
}

migrate().catch(err => {
    console.error('❌ Erro na migração:', err.message);
    process.exit(1);
});
