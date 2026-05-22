const fs = require('fs');
const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\siga-client\\app_extracted\\.webpack\\main\\index.js';

if (!fs.existsSync(file)) {
    console.log("File does not exist");
    process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');
const pos = 3117626;
console.log(content.substring(pos - 600, pos + 400));
