const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('1. SSH Connection Ready');
    
    console.log('2. Running rm command...');
    conn.exec('rm -f /etc/nginx/sites-enabled/default.bak', (rmErr, rmStream) => {
        if (rmErr) {
            console.error('rm exec error:', rmErr);
            conn.end();
            return;
        }
        
        rmStream.on('close', (code) => {
            console.log('3. rm command closed with code:', code);
            
            console.log('4. Reading sites-enabled/default...');
            conn.exec('cat /etc/nginx/sites-enabled/default', (catErr, catStream) => {
                if (catErr) {
                    console.error('cat exec error:', catErr);
                    conn.end();
                    return;
                }
                
                let data = '';
                catStream.on('data', (d) => { data += d.toString(); });
                
                catStream.on('close', (catCode) => {
                    console.log('5. cat command closed with code:', catCode);
                    console.log('File size read:', data.length);
                    
                    console.log('6. Creating backup in /tmp/default.bak...');
                    conn.exec('cat > /tmp/default.bak', (bakErr, bakStream) => {
                        if (bakErr) {
                            console.error('bak exec error:', bakErr);
                            conn.end();
                            return;
                        }
                        
                        bakStream.write(data);
                        bakStream.end();
                        
                        bakStream.on('close', (bakCode) => {
                            console.log('7. Backup written, closed with code:', bakCode);
                            
                            const target = '    location /download/ {\n        alias /var/www/polaryon/storage/download/;\n        autoindex on;\n    }';
                            const replacement = '    location /download/ {\n        alias /var/www/polaryon/storage/download/;\n        autoindex on;\n        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";\n        add_header Pragma "no-cache";\n    }';
                            
                            if (!data.includes(target)) {
                                console.error('❌ Target config block not found in Nginx file.');
                                conn.end();
                                return;
                            }
                            
                            const modifiedData = data.replace(target, replacement);
                            
                            console.log('8. Writing modified data to /etc/nginx/sites-enabled/default...');
                            conn.exec('cat > /etc/nginx/sites-enabled/default', (writeErr, writeStream) => {
                                if (writeErr) {
                                    console.error('write exec error:', writeErr);
                                    conn.end();
                                    return;
                                }
                                
                                writeStream.write(modifiedData);
                                writeStream.end();
                                
                                writeStream.on('close', (writeCode) => {
                                    console.log('9. Config written, closed with code:', writeCode);
                                    
                                    console.log('10. Testing nginx...');
                                    conn.exec('nginx -t', (tErr, tStream) => {
                                        if (tErr) {
                                            console.error('nginx -t exec error:', tErr);
                                            conn.end();
                                            return;
                                        }
                                        
                                        let output = '';
                                        tStream.on('data', (d) => { output += d.toString(); });
                                        tStream.stderr.on('data', (d) => { output += d.toString(); });
                                        
                                        tStream.on('close', (tCode) => {
                                            console.log('11. nginx -t closed with code:', tCode);
                                            console.log('Nginx test output:\n', output);
                                            
                                            if (tCode === 0) {
                                                console.log('12. Nginx configuration is valid! Reloading Nginx...');
                                                conn.exec('systemctl reload nginx', (reloadErr, reloadStream) => {
                                                    if (reloadErr) {
                                                        console.error('Reload exec error:', reloadErr);
                                                        conn.end();
                                                        return;
                                                    }
                                                    reloadStream.on('close', (reloadCode) => {
                                                        console.log('⭐️ 13. Nginx reloaded successfully on VPS, code:', reloadCode);
                                                        conn.end();
                                                    });
                                                });
                                            } else {
                                                console.error('❌ Nginx test failed! Restoring backup...');
                                                conn.exec('cat > /etc/nginx/sites-enabled/default', (resErr, resStream) => {
                                                    if (resErr) {
                                                        console.error('Restore exec error:', resErr);
                                                        conn.end();
                                                        return;
                                                    }
                                                    resStream.write(data);
                                                    resStream.end();
                                                    resStream.on('close', () => {
                                                        console.log('✓ Backup restored.');
                                                        conn.end();
                                                    });
                                                });
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('Connection error:', err);
}).connect({
    host: '204.168.151.231',
    port: 22,
    username: 'root',
    password: 'Jaguar2018jolela#'
});
