const fs = require('fs');

const file1 = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';

function extractSerproEndpoints(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist.`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const entries = data.log.entries || [];

  const serproEntries = entries.filter(entry => {
    const url = entry.request.url.toLowerCase();
    return url.includes('serpro.gov.br') && (url.includes('api') || url.includes('comprasnet') || entry.request.method === 'POST');
  });

  console.log(`Total Serpro api/comprasnet requests found: ${serproEntries.length}`);

  // Group by distinct endpoint to see structure
  const endpoints = {};
  serproEntries.forEach(entry => {
    const req = entry.request;
    const res = entry.response;
    const urlObj = new URL(req.url);
    const key = `${req.method} ${urlObj.host}${urlObj.pathname}`;
    if (!endpoints[key]) {
      endpoints[key] = {
        count: 0,
        samples: []
      };
    }
    endpoints[key].count++;
    if (endpoints[key].samples.length < 2) {
      endpoints[key].samples.push({
        url: req.url,
        status: res ? res.status : 0,
        reqHeaders: req.headers,
        reqBody: req.postData ? req.postData.text : null,
        resBody: res && res.content ? res.content.text : null
      });
    }
  });

  console.log(`\n==================================================`);
  console.log(`DISTINCT SERPRO ENDPOINTS:`);
  console.log(`==================================================`);
  for (const [key, val] of Object.entries(endpoints)) {
    console.log(`${key} - called ${val.count} times`);
  }

  console.log(`\n==================================================`);
  console.log(`DETAILED SERPRO ENDPOINT ANALYSIS:`);
  console.log(`==================================================`);
  for (const [key, val] of Object.entries(endpoints)) {
    console.log(`\nEndpoint: ${key} (Called: ${val.count} times)`);
    val.samples.forEach((sample, idx) => {
      console.log(`  Sample #${idx + 1}:`);
      console.log(`    Full URL: ${sample.url}`);
      console.log(`    Response Status: ${sample.status}`);
      if (sample.reqHeaders && sample.reqHeaders.length) {
        // Show interesting headers
        const interestingHeaders = sample.reqHeaders.filter(h => 
          ['authorization', 'content-type', 'cookie', 'x-', 'origin', 'referer'].some(x => h.name.toLowerCase().startsWith(x))
        );
        console.log(`    Headers:`, JSON.stringify(interestingHeaders.slice(0, 8), null, 2));
      }
      if (sample.reqBody) {
        console.log(`    Request Body: ${sample.reqBody}`);
      }
      if (sample.resBody) {
        console.log(`    Response Body (first 500 chars): ${sample.resBody.substring(0, 500)}`);
      }
      console.log(`  -----------------`);
    });
  }
}

extractSerproEndpoints(file1);
