import fs from 'fs';
const content = fs.readFileSync('electron/bidding-runner.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('class ') || line.includes('async ') || line.includes('function ') || line.trim().startsWith('send') || line.trim().startsWith('process') || line.trim().startsWith('evaluate')) {
        if (line.length < 120) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    }
});
