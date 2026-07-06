import { Client } from 'ssh2';

const vpsIp = '191.252.93.79';

function sshExec(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let out = '', errOut = '';
            stream.on('data', (d) => { out += d.toString(); });
            stream.stderr.on('data', (d) => { errOut += d.toString(); });
            stream.on('close', (code) => {
                if (code === 0) resolve(out);
                else reject(new Error(`Exit ${code}: ${errOut}`));
            });
        });
    });
}

async function run() {
    console.log('Connecting to VPS...');
    const conn = new Client();
    await new Promise((resolve, reject) => {
        conn.on('ready', resolve);
        conn.on('error', reject);
        conn.connect({ host: vpsIp, username: 'root', password: 'Jaguar2018#', readyTimeout: 15000 });
    });
    console.log('Connected!');

    try {
        const env = await sshExec(conn, 'cat /var/www/polaryon/backend/.env');
        console.log('--- VPS backend .env ---');
        console.log(env);
    } catch (e) {
        console.error('Error reading .env:', e.message);
    }

    try {
        console.log('Running list-users.js on VPS...');
        const users = await sshExec(conn, 'cd /var/www/polaryon/backend && node list-users.js');
        console.log('--- VPS Users ---');
        console.log(users);
    } catch (e) {
        console.error('Error running list-users.js:', e.message);
    }

    conn.end();
}

run().catch(e => { console.error('Error:', e.message); });
