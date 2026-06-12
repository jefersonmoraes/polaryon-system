import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
    conn.exec('cd /var/www/polaryon && git status && ls -la backend/src', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => { process.stdout.write(d.toString()); });
        stream.stderr.on('data', (d) => { process.stderr.write(d.toString()); });
        stream.on('close', () => {
            conn.end();
        });
    });
}).connect({
    host: '191.252.93.79',
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
