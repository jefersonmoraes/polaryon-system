const fs = require('fs');

const file2 = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\disputas.sigapregao2.com.br';

function extractLocalhostRequests(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist.`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const entries = data.log.entries || [];

  const localEntries = entries.filter(entry => {
    const url = entry.request.url.toLowerCase();
    return url.includes('localhost') || url.includes('127.0.0.1');
  });

  console.log(`Total localhost/127.0.0.1 requests found: ${localEntries.length}`);

  // Group by distinct endpoint to see structure
  const endpoints = {};
  localEntries.forEach(entry => {
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
  console.log(`DISTINCT LOCALHOST ENDPOINTS:`);
  console.log(`==================================================`);
  for (const [key, val] of Object.entries(endpoints)) {
    console.log(`${key} - called ${val.count} times`);
  }

  console.log(`\n==================================================`);
  console.log(`DETAILED ENDPOINT ANALYSIS:`);
  console.log(`==================================================`);
  for (const [key, val] of Object.entries(endpoints)) {
    console.log(`\nEndpoint: ${key} (Called: ${val.count} times)`);
    val.samples.forEach((sample, idx) => {
      console.log(`  Sample #${idx + 1}:`);
      console.log(`    Full URL: ${sample.url}`);
      console.log(`    Response Status: ${sample.status}`);
      if (sample.reqHeaders && sample.reqHeaders.length) {
        // Show interesting headers like authorization or custom headers
        const interestingHeaders = sample.reqHeaders.filter(h => 
          ['authorization', 'content-type', 'x-', 'origin', 'sec-'].some(x => h.name.toLowerCase().startsWith(x))
        );
        console.log(`    Headers:`, JSON.stringify(interestingHeaders, null, 2));
      }
      if (sample.reqBody) {
        console.log(`    Request Body: ${sample.reqBody}`);
      }
      if (sample.resBody) {
        console.log(`    Response Body (first 300 chars): ${sample.resBody.substring(0, 500)}`);
      }
      console.log(`  -----------------`);
    });
  }
}

extractLocalhostRequests(file2);
