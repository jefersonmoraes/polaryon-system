import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
    conn.exec('pm2 logs polaryon-backend --lines 60 --raw --no-color || true', (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => { process.stdout.write(d.toString()); });
        stream.stderr.on('data', (d) => { process.stderr.write(d.toString()); });
        setTimeout(() => {
            conn.end();
        }, 3000);
    });
}).connect({
    host: '191.252.93.79',
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
