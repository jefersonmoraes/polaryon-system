const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.readFile('/etc/nginx/sites-available/default', 'utf8', (readErr, data) => {
            if (readErr) throw readErr;
            const idx = data.indexOf('location /download/');
            if (idx !== -1) {
                console.log(data.substring(idx, idx + 400));
            } else {
                console.log('location /download/ not found in data!');
            }
            conn.end();
        });
    });
}).connect({
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
});
