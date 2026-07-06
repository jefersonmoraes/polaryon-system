const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', async () => {
    console.log('SSH Ready');
    
    // Let's run a series of commands to inspect and resolve the symlink issue.
    conn.exec('ls -la /var/www/polaryon/ && ls -la /var/www/polaryon/storage/ && ls -la /var/www/polaryon/dist/', (err, stream) => {
        if (err) throw err;
        let out = '';
        stream.on('data', (d) => { out += d.toString(); });
        stream.stderr.on('data', (d) => { out += d.toString(); });
        stream.on('close', () => {
            console.log('=== BEFORE ===');
            console.log(out);
            
            // Now run the fix command:
            // Remove storage/download if it's a symlink or circular link,
            // make sure it's a real directory.
            const fixCmd = `
                echo "=== FIXING ==="
                # If /var/www/polaryon/storage/download is a symlink, remove it
                if [ -L /var/www/polaryon/storage/download ]; then
                    rm -f /var/www/polaryon/storage/download
                    echo "Removed symlink storage/download"
                fi
                # Ensure storage/download is a directory
                mkdir -p /var/www/polaryon/storage/download
                
                # If dist/download is a symlink, remove it
                if [ -L /var/www/polaryon/dist/download ]; then
                    rm -f /var/www/polaryon/dist/download
                    echo "Removed symlink dist/download"
                fi
                # Re-link dist/download -> storage/download
                ln -sf /var/www/polaryon/storage/download /var/www/polaryon/dist/download
                echo "Created symlink dist/download -> storage/download"
            `;
            
            conn.exec(fixCmd, (err2, stream2) => {
                if (err2) throw err2;
                let out2 = '';
                stream2.on('data', (d) => { out2 += d.toString(); });
                stream2.stderr.on('data', (d) => { out2 += d.toString(); });
                stream2.on('close', () => {
                    console.log(out2);
                    conn.end();
                });
            });
        });
    });
}).connect({
    host: '191.252.93.79',
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
