const { ipcRenderer } = require('electron');

let scrapingInterval = null;
let serverOffset = 0;

// Configuração recebida via IPC
let currentVault = {
    simulationMode: true,
    itemsConfig: {}
};
let mySessionId = null;

/**
 * Esta função lê o HTML da página do Portal Comprasnet atual 
 * para identificar itens, valores e se é a sua vez de dar lance.
 */
function scrapeDisputeRoom() {
    if (!mySessionId) return; // Aguarda inicialização

    try {
        const bodyText = document.body.innerText || "";
        
        // --- AUTOMAÇÃO DE LOGIN (GOV.BR) ---
        if (bodyText.includes('Acesso Gov.br') || bodyText.includes('Identificação do Usuário')) {
            // Tenta localizar o botão de Certificado Digital
            const certButton = Array.from(document.querySelectorAll('button, a, div.button')).find(el => 
                el.innerText.toUpperCase().includes('CERTIFICADO DIGITAL')
            );

            if (certButton) {
                console.log("[POLARYON] Executando Login Automático via Certificado...");
                certButton.click();
            }

            ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items: [],
                statusMessage: "Autenticando via Certificado A1..."
            });
            return;
        }

        // Se encontrou a tabela ou lista de itens da Dispensa (Adapte a classe baseado no HTML da Serpro)
        // Esta é uma leitura genérica baseada nos elementos React/Angular do portal fase-externa
        const items = [];
        let hasItemsInDispute = false;

        // EXEMPLO DE INJEÇÃO V2: Suporte ao novo layout Compras.gov.br (Angular/Material)
        const itemCards = document.querySelectorAll('mat-card, .br-card, .item-container, tr[role="row"]'); 
        
        if (itemCards.length > 0) {
            itemCards.forEach(card => {
                const text = card.innerText;
                
                // Ignora cabeçalhos
                if (text.includes('Valor do Lance') || text.includes('Mínimo')) {
                    const isDispute = text.toUpperCase().includes('EM DISPUTA') || 
                                     text.toUpperCase().includes('DISPUTA ABERTA') ||
                                     text.toUpperCase().includes('EM SELEÇÃO');

                    if (isDispute) hasItemsInDispute = true;
                    
                    const valorMatch = text.match(/R\$\s*([\d,.]+)/);
                    const valorAtual = valorMatch ? parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.')) : 0;

                    const idMatch = text.match(/Item\s*(\d+)/i);
                    const itemId = idMatch ? `Item ${idMatch[1]}` : (card.getAttribute('id') || "Item Ativo");

                    const ganhador = text.toUpperCase().includes('MELHOR LANCE') ? 'Você' : 'Outro';

                    items.push({
                        itemId: itemId,
                        valorAtual: valorAtual,
                        ganhador: ganhador,
                        status: isDispute ? 'Disputa' : 'Aguardando',
                        tempoRestante: -1, 
                        position: text.includes('1º') ? 1 : 0
                    });
                }
            });
        }

        if (items.length > 0) {
            // Emite pro Electron Master atualizar a tela do Polaryon
            ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items,
                actions: [], // Ações simuladas ou reais enviadas
                timestamp: new Date().toISOString(),
                source: 'VISUAL_AUTOMATION',
                turbo: hasItemsInDispute
            });
        } else {
             ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items: [],
                statusMessage: "Aguardando abertura da sala de lances ou navegação para o pregão..."
            });
        }

    } catch (e) {
        console.error("Erro no Portal Injector:", e);
    }
}

window.addEventListener('load', () => {
    console.log("[POLARYON] Injetor Visual Ativado no Compras.gov.br");
    scrapingInterval = setInterval(scrapeDisputeRoom, 2000); // Scraper veloz
});

ipcRenderer.on('init-session', (event, { sessionId, config }) => {
    mySessionId = sessionId;
    currentVault = config.vault || currentVault;
    console.log("[POLARYON] Sessão Local Inicializada:", sessionId);
});

ipcRenderer.on('update-config', (event, config) => {
    currentVault = config;
    console.log("[POLARYON] Estratégia atualizada no navegador injetado:", currentVault);
});
