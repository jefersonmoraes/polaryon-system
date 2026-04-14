
import fs from 'fs';

const content = fs.readFileSync('e:\\-JEFÃO-\\APLICATIVOS\\POLARYON KUNBUN\\polaryon-system\\src\\components\\board\\CardDetailPanel.tsx', 'utf8');

const lines = content.split('\n');
const divRegex = /<\/?div/g;

let stack = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = divRegex.exec(line)) !== null) {
        if (match[0] === '<div') {
            stack.push(i + 1);
        } else if (match[0] === '</div>') {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`Extra closing div at line ${i + 1}`);
            }
        }
    }
}

console.log(`Unclosed divs started at lines: ${stack.join(', ')}`);
