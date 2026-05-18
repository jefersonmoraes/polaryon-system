import fs from 'fs';

const content = fs.readFileSync('C:/Users/icebo/.gemini/antigravity/brain/21015be5-fa19-49cd-bc83-0fc21a519fbd/.system_generated/steps/5928/content.md', 'utf8');

const index = content.indexOf('configuracoes_view');
console.log('Index of configuracoes_view:', index);
if (index !== -1) {
    console.log('Context:', content.substring(index - 100, index + 100));
}
