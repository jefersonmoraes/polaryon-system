const fs = require('fs');
const { execSync } = require('child_process');

try {
    console.log('1. Cleaning up default.bak...');
    try {
        fs.unlinkSync('/etc/nginx/sites-enabled/default.bak');
    } catch (e) {}

    console.log('2. Reading Nginx config...');
    const file = '/etc/nginx/sites-enabled/default';
    let content = fs.readFileSync(file, 'utf8');

    const target = '    location /download/ {\n        alias /var/www/polaryon/storage/download/;\n        autoindex on;\n    }';
    const replacement = '    location /download/ {\n        alias /var/www/polaryon/storage/download/;\n        autoindex on;\n        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";\n        add_header Pragma "no-cache";\n    }';

    if (!content.includes(target)) {
        if (content.includes('add_header Cache-Control')) {
            console.log('✓ Nginx config already updated!');
            process.exit(0);
        }
        console.error('❌ Target config block not found in sites-enabled/default!');
        process.exit(1);
    }

    console.log('3. Writing backup to /tmp/default.bak...');
    fs.writeFileSync('/tmp/default.bak', content, 'utf8');

    console.log('4. Writing modified config...');
    fs.writeFileSync(file, content.replace(target, replacement), 'utf8');

    console.log('5. Testing Nginx configuration...');
    try {
        execSync('nginx -t', { stdio: 'inherit' });
        console.log('6. Nginx test passed! Reloading Nginx...');
        execSync('systemctl reload nginx', { stdio: 'inherit' });
        console.log('⭐️ SUCCESS!');
    } catch (err) {
        console.error('❌ Nginx test or reload failed! Restoring backup...');
        fs.writeFileSync(file, content, 'utf8');
        process.exit(1);
    }
} catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
}
