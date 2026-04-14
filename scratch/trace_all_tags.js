
import fs from 'fs';

const content = fs.readFileSync('e:\\-JEFÃO-\\APLICATIVOS\\POLARYON KUNBUN\\polaryon-system\\src\\components\\board\\CardDetailPanel.tsx', 'utf8');

const tags = [];
const tagRegex = /<([a-zA-Z0-9.]+)|<\/([a-zA-Z0-9.]+)>|{/g;
let braceStack = 0;

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
        if (match[0] === '{') {
            braceStack++;
        } else if (match[1]) {
            // Opening tag
            const tagName = match[1];
            // Check if self-closing
            const sub = line.substring(match.index);
            if (!sub.includes('/>') || sub.indexOf('/>') > sub.indexOf('>')) {
                tags.push({ name: tagName, line: i + 1 });
            }
        } else if (match[2]) {
            // Closing tag
            const tagName = match[2];
            if (tags.length > 0) {
                const last = tags.pop();
                if (last.name !== tagName) {
                    console.log(`Mismatch at line ${i + 1}: expected </${last.name}>, got </${tagName}>`);
                }
            } else {
                console.log(`Extra closing tag </${tagName}> at line ${i + 1}`);
            }
        }
    }
}

console.log(`Unclosed tags: ${tags.length}`);
tags.forEach(t => console.log(`- <${t.name}> at line ${t.line}`));
