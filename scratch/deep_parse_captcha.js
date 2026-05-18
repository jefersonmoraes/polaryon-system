import fs from 'fs';

const file = 'e:/POLARYON SYSTEM/POLARYON KUNBUN/polaryon-system/importar/cnetmobile.estaleiro.serpro.gov.br.har';
try {
    const har = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entry = har.log.entries[6]; // GET /captcha/configuracao
    console.log(`URL: ${entry.request.url}`);
    console.log(`Response Status: ${entry.response.status}`);
    console.log(`Response Text:`, entry.response.content.text);

    const entry15 = har.log.entries[15]; // GET /itens/disputa-encerrada
    console.log(`\nURL: ${entry15.request.url}`);
    console.log(`Headers for entry 15:`);
    entry15.request.headers.forEach(h => {
        console.log(`  ${h.name}: ${h.value}`);
    });
} catch(err) {
    console.error(err);
}
