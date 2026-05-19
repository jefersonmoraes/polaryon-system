const fs = require('fs');

const file1 = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\POLARYONSYSTEN';

function analyzePolaryonSystemHar(filePath) {
  console.log(`\n==================================================`);
  console.log(`ANALYZING HAR: POLARYONSYSTEN (${filePath})`);
  console.log(`==================================================`);

  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist.`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.log(`Failed to parse JSON: ${e.message}`);
    return;
  }

  const entries = data.log.entries || [];
  console.log(`Total entries: ${entries.length}`);

  entries.forEach((entry, idx) => {
    const req = entry.request;
    const res = entry.response;
    console.log(`\n[${idx + 1}] ${req.method} ${req.url} (Status: ${res ? res.status : 0})`);
    if (req.postData && req.postData.text) {
      console.log(`    Request Body: ${req.postData.text}`);
    }
    if (res && res.content && res.content.text) {
      console.log(`    Response Body (first 400 chars): ${res.content.text.substring(0, 400)}`);
    }
  });
}

analyzePolaryonSystemHar(file1);
