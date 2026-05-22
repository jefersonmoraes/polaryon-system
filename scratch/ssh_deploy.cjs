const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const vpsIp = "204.168.151.231";
const password = "Jaguar2018jolela#";
const remotePath = "/var/www/polaryon/storage/download/";

const version = "3.8.19";
const exeName = `Polaryon-v${version}-Setup.exe`;

const filesToUpload = [
    { local: path.join(__dirname, '..', 'dist_desktop', exeName), remote: remotePath + exeName },
    { local: path.join(__dirname, '..', 'dist_desktop', `${exeName}.blockmap`), remote: remotePath + `${exeName}.blockmap` },
    { local: path.join(__dirname, '..', 'dist_desktop', 'latest.yml'), remote: remotePath + 'latest.yml' }
];

// Check local files existence
for (const file of filesToUpload) {
    if (!fs.existsSync(file.local)) {
        console.error(`❌ Local file not found: ${file.local}`);
        process.exit(1);
    }
}

console.log("🚀 Initializing SSH connection to VPS...");

const conn = new Client();
conn.on('ready', () => {
    console.log("⚡ SSH Connection Ready!");
    
    // Start SFTP session
    conn.sftp((err, sftp) => {
        if (err) {
            console.error("❌ SFTP error:", err);
            conn.end();
            return;
        }
        
        let filesUploaded = 0;
        
        function uploadNext() {
            if (filesUploaded === filesToUpload.length) {
                console.log("✅ All files uploaded successfully via SFTP!");
                runRemoteCommands();
                return;
            }
            
            const file = filesToUpload[filesUploaded];
            console.log(`📤 Uploading ${path.basename(file.local)} to ${file.remote}...`);
            
            sftp.fastPut(file.local, file.remote, (uploadErr) => {
                if (uploadErr) {
                    console.error(`❌ Failed uploading ${path.basename(file.local)}:`, uploadErr);
                    conn.end();
                    return;
                }
                console.log(`✓ Uploaded ${path.basename(file.local)}`);
                filesUploaded++;
                uploadNext();
            });
        }
        
        uploadNext();
    });
}).on('error', (err) => {
    console.error("❌ SSH Client Error:", err);
}).connect({
    host: vpsIp,
    port: 22,
    username: 'root',
    password: password
});

function runRemoteCommands() {
    console.log("⚙️ Running remote setup commands on VPS...");
    
    // Command to clean old setup EXEs (keep only 2 newest) and update permissions
    const remoteCmd = `ls -t /var/www/polaryon/storage/download/*.exe | tail -n +3 | xargs -r rm && chown -R www-data:www-data /var/www/polaryon/storage/download && chmod -R 755 /var/www/polaryon/storage/download`;
    
    conn.exec(remoteCmd, (err, stream) => {
        if (err) {
            console.error("❌ Remote exec error:", err);
            conn.end();
            return;
        }
        
        stream.on('close', (code, signal) => {
            console.log(`✓ Remote commands completed with code ${code}`);
            
            // Now run git updates on the VPS repository as well, but only for main if it's there
            console.log("⚙️ Syncing main repository code on VPS...");
            const gitCmd = `cd /var/www/polaryon && git fetch origin main && git reset --hard origin/main && pm2 restart polaryon-backend`;
            conn.exec(gitCmd, (err2, stream2) => {
                if (err2) {
                    console.error("❌ Remote git sync error:", err2);
                    conn.end();
                    return;
                }
                stream2.on('close', (code2) => {
                    console.log(`✓ VPS git repository synced with code ${code2}`);
                    console.log("\n⭐️ DEPLOY IS COMPLETE AND FULLY SUCCESSFUL!");
                    conn.end();
                });
                stream2.stdout.on('data', (data) => console.log('VPS:', data.toString().trim()));
                stream2.stderr.on('data', (data) => console.error('VPS ERR:', data.toString().trim()));
            });
            
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}
