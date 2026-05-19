const fs = require('fs');
const path = require('path');

const file1 = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';
const file2 = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\disputas.sigapregao2.com.br';

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

  // Count by domain and method
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
        responseBody: res && res.content ? res.content.text : null,
        mimeType: res && res.content ? res.content.mimeType : ''
      });
    } catch (e) {
      // Ignored malformed URL
    }
  });

  console.log(`\nDistinct Hostnames:`);
  console.log(JSON.stringify(domains, null, 2));

  // Find interesting API endpoints (bids, item details, updates)
  console.log(`\nKey API / XHR Requests Found:`);
  const interesting = urls.filter(u => {
    const p = u.pathname.toLowerCase();
    return p.includes('api') || 
           p.includes('disputa') || 
           p.includes('lance') || 
           p.includes('item') || 
           p.includes('compra') || 
           p.includes('sala') || 
           p.includes('chat') ||
           u.method === 'POST';
  });

  console.log(`Total interesting requests: ${interesting.length}`);
  
  // Show top 30 interesting requests details
  interesting.slice(0, 30).forEach((u, i) => {
    console.log(`[${i+1}] ${u.method} - ${u.host}${u.pathname} (Status: ${u.status})`);
    if (u.method === 'POST' && u.requestBody) {
      console.log(`   Req Body snippet: ${u.requestBody.substring(0, 150)}`);
    }
    if (u.responseBody) {
      console.log(`   Res Body snippet: ${u.responseBody.substring(0, 150)}`);
    }
    console.log(`-----------------------------------`);
  });
}

analyzeHAR(file1, "Serpro Hibrido/Mobile");
analyzeHAR(file2, "Siga Pregao");
