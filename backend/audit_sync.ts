import axios from 'axios';

async function checkSync() {
    console.log('--- AUDITORIA DE SINCRONISMO: ANEXOS ---');
    try {
        const response = await axios.get('https://polaryon.com.br/api/kanban/sync', {
             headers: { 'Authorization': 'Bearer YOUR_TOKEN_HERE' } // This is pseudo-code but I'll try to find a token if possible, or just hit it
        });
        
        const card = response.data.cards.find(c => c.id === 117); // Aviso de Contratação Direta
        if (card) {
            console.log(`Card 117 found: ${card.title}`);
            console.log(`Attachments count: ${card.attachments?.length}`);
            if (card.attachments?.[0]) {
                const urlLen = card.attachments[0].url?.length || 0;
                console.log(`First attachment URL length: ${urlLen}`);
                if (urlLen > 100) {
                   console.log('✅ URL contains data/links!');
                } else {
                   console.error('❌ URL is empty or too short!');
                }
            }
        }
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}
// checkSync(); 
// Wait, I don't have the token. I'll use a public endpoint if exists? No.
