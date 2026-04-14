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
        
        // Se ainda estiver na tela de login, avisa o sistema e pausa
        if (bodyText.includes('Acesso Gov.br') || bodyText.includes('Identificação do Usuário')) {
            ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items: [],
                statusMessage: "Aguardando Login do Usuário no Gov.br..."
            });
            return;
        }

        // Se encontrou a tabela ou lista de itens da Dispensa (Adapte a classe baseado no HTML da Serpro)
        // Esta é uma leitura genérica baseada nos elementos React/Angular do portal fase-externa
        const items = [];
        let hasItemsInDispute = false;

        // EXEMPLO DE INJEÇÃO V1: Procurando contêineres de cartões de itens
        const itemCards = document.querySelectorAll('.card-item, .item-linha, tr.item'); // Seletores coringa do Comprasnet
        
        if (itemCards.length > 0) {
            itemCards.forEach(card => {
                const text = card.innerText;
                
                // Extração muito bruta inicial:
                // O ideal é inspecionar o DOM real do portal para refinar esses seletores
                const isDispute = text.toUpperCase().includes('EM DISPUTA') || text.toUpperCase().includes('ABERTO');
                if (isDispute) hasItemsInDispute = true;
                
                const valorMatch = text.match(/R\$\s*([\d,.]+)/);
                const valorAtual = valorMatch ? parseFloat(valorMatch[1].replace('.', '').replace(',', '.')) : 0;

                const ganhador = text.toUpperCase().includes('MEU LANCE') ? 'Você' : 'Concorrente';

                items.push({
                    itemId: card.getAttribute('data-item-id') || "Item Identificado",
                    valorAtual: valorAtual,
                    ganhador: ganhador,
                    status: isDispute ? 'Em Disputa' : 'Fechado',
                    tempoRestante: -1, // Extrair o timer do DOM
                    position: ganhador === 'Você' ? 1 : 0
                });
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
