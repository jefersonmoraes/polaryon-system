const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', async () => {
    console.log('SSH Ready to repair dist');
    
    const repairCmd = `
        echo "=== REPAIRING DIST ==="
        cd /var/www/polaryon
        
        # Remove dist if it is a symlink (including self-referencing)
        if [ -L dist ]; then
            rm -f dist
            echo "Removed symlink dist"
        fi
        
        # Also remove dist_electron if it is a symlink
        if [ -L dist_electron ]; then
            rm -f dist_electron
            echo "Removed symlink dist_electron"
        fi

        # If dist is a directory, remove it to be clean
        rm -rf dist
        
        # Now if dist_electron_build_tmp exists, rename it to dist
        if [ -d dist_electron_build_tmp ]; then
            mv dist_electron_build_tmp dist
            echo "Renamed dist_electron_build_tmp to dist"
        else
            # Otherwise copy build from backend or just make sure a dist folder exists
            mkdir -p dist
            echo "Created clean dist directory"
        fi
        
        # Create symlink dist_electron -> dist
        ln -sf dist dist_electron
        echo "Created symlink dist_electron -> dist"
        
        # Ensure storage/download is a real directory
        mkdir -p /var/www/polaryon/storage/download
        
        # Remove any link/file at dist/download and link it to storage/download
        rm -rf dist/download
        ln -sf /var/www/polaryon/storage/download dist/download
        echo "Created symlink dist/download -> storage/download"
    `;
    
    conn.exec(repairCmd, (err, stream) => {
        if (err) throw err;
        let out = '';
        stream.on('data', (d) => { out += d.toString(); });
        stream.stderr.on('data', (d) => { out += d.toString(); });
        stream.on('close', () => {
            console.log(out);
            conn.end();
        });
    });
}).connect({
    host: '191.252.93.79',
    username: 'root',
    password: 'Jaguar2018#',
    readyTimeout: 15000
});
