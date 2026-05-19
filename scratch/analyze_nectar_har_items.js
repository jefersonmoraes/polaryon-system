import fs from 'fs';
import path from 'path';

const harFile = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\NECTAR\\cnetmobile.estaleiro.serpro2.gov.br';

try {
  const content = fs.readFileSync(harFile, 'utf8');
  const har = JSON.parse(content);
  
  const entries = har.log.entries;
  
  for (const entry of entries) {
    if (entry.request.method === 'GET' && entry.request.url.includes('/itens/em-disputa')) {
      console.log('--- FOUND EM-DISPUTA GET ---');
      console.log('URL:', entry.request.url);
      console.log('Response:', entry.response.content.text);
      console.log('------------------------\n');
      break; // Only need one
    }
  }
} catch (e) {
  console.error("Error reading/parsing HAR:", e);
}
