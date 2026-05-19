const fs = require('fs');

const file2 = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\disputas.sigapregao2.com.br';

function extractSigaPregaoApis(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist.`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const entries = data.log.entries || [];

  const sigaEntries = entries.filter(entry => {
    const url = entry.request.url.toLowerCase();
    return url.includes('sigapregao.com.br') && !url.includes('localhost') && !url.includes('127.0.0.1');
  });

  console.log(`Total siga-pregao requests: ${sigaEntries.length}`);

  sigaEntries.forEach((entry, idx) => {
    const req = entry.request;
    const res = entry.response;
    console.log(`\n[${idx + 1}] ${req.method} ${req.url} (Status: ${res ? res.status : 0})`);
    if (req.postData && req.postData.text) {
      console.log(`    Request Body: ${req.postData.text}`);
    }
    if (res && res.content && res.content.text) {
      console.log(`    Response Body: ${res.content.text.substring(0, 500)}`);
    }
  });
}

extractSigaPregaoApis(file2);
