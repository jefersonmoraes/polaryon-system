const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('⚡ SSH Connection Ready for deployment!');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const localScript = path.join(__dirname, 'remote_update.js');
        const remoteScript = '/tmp/update_nginx.js';
        
        console.log('📤 Uploading remote_update.js to VPS...');
        sftp.fastPut(localScript, remoteScript, (uploadErr) => {
            if (uploadErr) {
                console.error('❌ Failed to upload update script:', uploadErr);
                conn.end();
                return;
            }
            console.log('✓ Uploaded update script successfully.');
            
            console.log('⚙️ Executing update script on VPS...');
            conn.exec('node /tmp/update_nginx.js', (execErr, stream) => {
                if (execErr) {
                    console.error('❌ Failed to execute remote script:', execErr);
                    conn.end();
                    return;
                }
                
                stream.on('close', (code) => {
                    console.log(`✓ Remote script completed with code ${code}`);
                    // Clean up
                    conn.exec('rm -f /tmp/update_nginx.js', () => {
                        conn.end();
                    });
                }).on('data', (data) => {
                    console.log('VPS:', data.toString().trim());
                }).stderr.on('data', (data) => {
                    console.error('VPS ERR:', data.toString().trim());
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('❌ Connection error:', err);
}).connect({
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
});
