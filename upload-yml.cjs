const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const localYml = path.join(__dirname, 'dist_desktop', 'latest.yml');
const remotePath = '/var/www/polaryon/storage/download/latest.yml';

conn.on('ready', () => {
    console.log('🔗 Conectado');
    conn.sftp((err, sftp) => {
        if (err) { console.error('SFTP err:', err); conn.end(); return; }
        sftp.fastPut(localYml, remotePath, {}, (err) => {
            if (err) { console.error('Upload err:', err); }
            else { console.log('✅ latest.yml uploaded'); }
            sftp.end();
            conn.end();
        });
    });
});

conn.on('error', (err) => console.error('❌', err.message));
conn.connect({ host: '191.252.93.79', username: 'root', password: 'Jaguar2018#', readyTimeout: 10000 });
