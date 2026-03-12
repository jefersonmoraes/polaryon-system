const fs = require('fs');
const http = require('http');

http.get('http://localhost:3000/api/kanban/sync', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            
            // Apply the partialize function logic from frontend
            parsed.folders.forEach(f => delete f.sideImage);
            parsed.boards.forEach(b => delete b.backgroundImage);
            parsed.cards.forEach(c => {
                c.attachments = [];
                c.comments = [];
            });
            parsed.members = [];
            
            // There are still base64 strings hiding somewhere! Let's find them
            let totalMainCompanyBase64 = 0;
            if (parsed.mainCompanies) {
                parsed.mainCompanies.forEach(mc => {
                    if (mc.logo) totalMainCompanyBase64 += mc.logo.length;
                    if (mc.signatureImage) totalMainCompanyBase64 += mc.signatureImage.length;
                });
            }
            console.log(`Main Companies Logo/Signature Base64 size: ${totalMainCompanyBase64/1024} KB`);
            
            let totalCompanyBase64 = 0;
            if (parsed.companies) {
                parsed.companies.forEach(c => {
                    if (c.logo) totalCompanyBase64 += c.logo.length;
                });
            }
            console.log(`Companies Logo Base64 size: ${totalCompanyBase64/1024} KB`);
            
            let totalBudgetBase64 = 0;
            if (parsed.budgets) {
                parsed.budgets.forEach(b => {
                    if (b.items) {
                         const items = typeof b.items === 'string' ? JSON.parse(b.items) : b.items;
                         let str = JSON.stringify(items);
                         totalBudgetBase64 += str.length;
                    }
                });
            }
            console.log(`Budgets Base64 size (items array string length): ${totalBudgetBase64/1024} KB`);
            
            const stringified = JSON.stringify(parsed);
            console.log('\nFINAL STORE SIZE AFTER PARTIALIZE (bytes):', stringified.length);
            console.log('FINAL STORE SIZE AFTER PARTIALIZE (MB):', (stringified.length / 1024 / 1024).toFixed(4));
            
        } catch (e) {
            console.error(e);
        }
    });
});
