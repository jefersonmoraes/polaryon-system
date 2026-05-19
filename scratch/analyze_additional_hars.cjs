const fs = require('fs');

const file1 = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har';
const file2 = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\www.comprasnet.gov.br.har';

function analyzeHAR(filePath, label) {
  console.log(`\n==================================================`);
  console.log(`ANALYZING HAR: ${label} (${filePath})`);
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

  const domains = {};
  const urls = [];

  entries.forEach(entry => {
    const req = entry.request;
    const res = entry.response;
    if (!req) return;

    try {
      const urlObj = new URL(req.url);
      const host = urlObj.hostname;
      domains[host] = (domains[host] || 0) + 1;

      urls.push({
        method: req.method,
        host: host,
        pathname: urlObj.pathname,
        url: req.url,
        status: res ? res.status : 0,
        requestBody: req.postData ? req.postData.text : null,
        responseBody: res && res.content ? res.content.text : null
      });
    } catch (e) {
      // Ignored
    }
  });

  console.log(`\nDistinct Hostnames:`);
  console.log(JSON.stringify(domains, null, 2));

  console.log(`\nInteresting Endpoints / POST/PUT Requests:`);
  const interesting = urls.filter(u => {
    const p = u.pathname.toLowerCase();
    return p.includes('api') || 
           p.includes('disputa') || 
           p.includes('lance') || 
           p.includes('item') || 
           p.includes('compra') || 
           p.includes('login') ||
           u.method === 'POST' || 
           u.method === 'PUT';
  });

  console.log(`Total interesting requests: ${interesting.length}`);
  interesting.slice(0, 40).forEach((u, i) => {
    console.log(`[${i+1}] ${u.method} - ${u.host}${u.pathname} (Status: ${u.status})`);
    if (u.requestBody) {
      console.log(`   Req Body: ${u.requestBody.substring(0, 150)}`);
    }
    if (u.responseBody) {
      console.log(`   Res Body: ${u.responseBody.substring(0, 150)}`);
    }
    console.log(`-----------------------------------`);
  });
}

analyzeHAR(file1, "importar/disputas.sigapregao.com.br.har");
analyzeHAR(file2, "importar/www.comprasnet.gov.br.har");
