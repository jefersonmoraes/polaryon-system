import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

const vpsIp = '191.252.93.79';
const localScriptPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\scratch\\query_companies.js';
const scriptContent = fs.readFileSync(localScriptPath, 'utf8');

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Uploading script...');
    // We will write the script by executing cat with a heredoc
    const escapedContent = scriptContent.replace(/'/g, "'\\''");
    const cmd = `cat << 'EOF' > /var/www/polaryon/backend/query_companies.js\n${scriptContent}\nEOF\nnode /var/www/polaryon/backend/query_companies.js`;
    
    console.log('Running script on VPS...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let out = '';
        stream.on('data', (data) => {
            out += data.toString();
        }).on('close', () => {
            console.log('--- VPS Output ---');
            fs.writeFileSync('e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\scratch\\vps_query_results.txt', out);
            console.log('Saved output to scratch\\vps_query_results.txt');
            conn.end();
        });
    });
}).connect({
    host: vpsIp,
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
