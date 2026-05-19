import fs from 'fs';
import path from 'path';

const harFile = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';

try {
  const content = fs.readFileSync(harFile, 'utf8');
  const har = JSON.parse(content);
  
  const entries = har.log.entries;
  let count = 0;
  
  for (const entry of entries) {
    if (entry.request.method === 'POST' && entry.request.url.includes('/lances')) {
      console.log('--- FOUND LANCE POST ---');
      console.log('URL:', entry.request.url);
      console.log('Status:', entry.response.status);
      
      if (entry.request.postData && entry.request.postData.text) {
        console.log('Payload:', entry.request.postData.text);
      } else {
        console.log('No payload text found.');
      }
      
      console.log('Response:', entry.response.content.text);
      console.log('------------------------\n');
      count++;
    }
  }
  
  if (count === 0) {
    console.log('No POST /lances found. Searching for any POST to comprasnet-disputa...');
    for (const entry of entries) {
      if (entry.request.method === 'POST' && entry.request.url.includes('comprasnet-disputa')) {
        console.log('POST URL:', entry.request.url);
        if (entry.request.postData && entry.request.postData.text) {
          console.log('Payload:', entry.request.postData.text);
        }
      }
    }
  }
} catch (e) {
  console.error("Error reading/parsing HAR:", e);
}
