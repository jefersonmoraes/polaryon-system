import { Client } from 'ssh2';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Deploy VPS via SSH
const conn = new Client();
conn.on('ready', () => {
    console.log('Conectado a VPS. Executando deploy...');
    conn.exec('cd /var/www/polaryon && bash vps-deploy.sh', { pty: true }, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log(`Deploy VPS finalizado com codigo: ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });
    });
}).connect({
    host: '191.252.93.79',
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 30000
});
