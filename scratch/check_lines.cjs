const fs = require('fs');
const file = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\src\\pages\\BiddingDashboardPage.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split(/\r?\n/);
for (let i = 930; i <= 940; i++) {
    console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}
