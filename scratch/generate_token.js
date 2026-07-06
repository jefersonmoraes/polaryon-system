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

    // Write a temp script on the VPS using cat EOF to avoid escaping issues
    const scriptCode = `
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function run() {
    const user = await prisma.user.findFirst({
        where: { email: 'jefersonmoraes72@gmail.com' }
    });
    if (!user) {
        console.error('User not found!');
        process.exit(1);
    }
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        'polaryon_super_secret_jwt_key_2026',
        { expiresIn: '90d' }
    );
    const authState = {
        state: {
            currentUser: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role.toUpperCase(),
                permissions: {
                    canView: true,
                    canEdit: true,
                    canDownload: true,
                    allowedScreens: ['ALL']
                },
                status: 'active',
                createdAt: user.createdAt
            },
            systemUsers: [
                {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role.toUpperCase(),
                    permissions: {
                        canView: true,
                        canEdit: true,
                        canDownload: true,
                        allowedScreens: ['ALL']
                    },
                    status: 'active',
                    createdAt: user.createdAt
                }
            ],
            isAuthenticated: true,
            jwtToken: token
        },
        version: 3
    };
    console.log('AUTH_STATE_JSON_START');
    console.log(JSON.stringify(authState));
    console.log('AUTH_STATE_JSON_END');
}
run().catch(console.error).finally(() => prisma.$disconnect());
`;

    // Create the command to write the script via EOF
    const writeCmd = `cat << 'EOF' > /var/www/polaryon/backend/generate-token-tmp.js\n${scriptCode}\nEOF`;
    await sshExec(conn, writeCmd);
    
    // Run the script
    const output = await sshExec(conn, `cd /var/www/polaryon/backend && node generate-token-tmp.js`);
    console.log(output);

    // Clean up
    await sshExec(conn, `rm -f /var/www/polaryon/backend/generate-token-tmp.js`);
    conn.end();
}

run().catch(e => { console.error('Error:', e.message); });
