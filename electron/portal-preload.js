const { ipcRenderer } = require('electron');

let scrapingInterval = null;
let serverOffset = 0;

// Configuração recebida via IPC
let currentVault = {
    simulationMode: true,
    itemsConfig: {}
};
let mySessionId = null;
let currentConfig = {
    uasg: '',
    numero: '',
    ano: '',
    modality: '05'
};

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

        // --- AUTO-NAVEGAÇÃO (ÁREA DO FORNECEDOR) ---
        if (bodyText.includes('Área de Trabalho do Fornecedor Brasileira') || bodyText.includes('redirecionado ao módulo de Dispensas')) {
             // Tenta encontrar o link de "Compras" -> "Dispensa/Licitação Eletrônica"
             const comprasLink = Array.from(document.querySelectorAll('a, button, .menu-item')).find(el => 
                el.innerText.toUpperCase().includes('COMPRAS') || el.innerText.toUpperCase().includes('DISPENSA/LICITAÇÃO')
             );
             if (comprasLink) {
                console.log("[POLARYON] Navegando para Módulo de Compras...");
                comprasLink.click();
             }
             return;
        }

        // Se estiver na tela de busca de lances, tenta encontrar o pregão solicitado
        if (bodyText.includes('Pesquisar') && bodyText.includes('Lances')) {
            const uasgInput = document.querySelector('input[name="uasg"], #uasg');
            if (uasgInput && currentConfig.uasg) {
                // Preenche e busca se necessário (Lógica complexa de preenchimento de formulário legado)
                // Por enquanto assumimos que o link virá via URL ou clique manual, 
                // mas podemos automatizar o filtro aqui se necessário.
            }
        }
        // Esta é uma leitura genérica baseada nos elementos React/Angular do portal fase-externa
        const items = [];
        let hasItemsInDispute = false;

        // EXEMPLO DE INJEÇÃO V3: Motor de Identificação de Precisão (Dispensa 14.133 e Siga Pregão Style)
        const rowSelector = 'mat-expansion-panel, mat-row, tr[role="row"], .br-item, .card-item';
        const itemCards = document.querySelectorAll(rowSelector); 
        
        if (itemCards.length > 0) {
            itemCards.forEach(card => {
                const text = card.innerText;
                
                // Dispensa 14.133 layout: Has "Melhor valor" or "Meu valor" and an item number
                const isDispensaItem = text.includes('Melhor valor') || text.includes('Meu valor') || text.includes('Valor final');
                // General layout: Has "R$" and "Item"
                const isGeneralItem = text.includes('R$') && (text.includes('Item') || text.match(/^\d+/));

                if (isDispensaItem || isGeneralItem) {
                    const isDispute = text.toUpperCase().includes('EM DISPUTA') || 
                                     text.toUpperCase().includes('ABERTO') ||
                                     text.toUpperCase().includes('IMINÊNCIA');

                    if (isDispute) hasItemsInDispute = true;
                    
                    let valorAtual = 0;
                    let meuValor = 0;

                    // Extração Dispensa 14.133 explícita
                    if (isDispensaItem) {
                        const melhorMatch = text.match(/Melhor valor[^\d]+([\d,.]+)/i);
                        const meuMatch = text.match(/Meu valor[^\d]+([\d,.]+)/i);
                        
                        if (melhorMatch) valorAtual = parseFloat(melhorMatch[1].replace(/\./g, '').replace(',', '.'));
                        if (meuMatch) meuValor = parseFloat(meuMatch[1].replace(/\./g, '').replace(',', '.'));
                    } else {
                        // Regex genérica
                        const matches = text.match(/R\$\s*([\d,.]+)/g);
                        if (matches && matches.length >= 1) {
                             valorAtual = parseFloat(matches[0].replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
                             if (matches.length >= 2) {
                                meuValor = parseFloat(matches[1].replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
                             }
                        }
                    }

                    // Se não achou nenhum valor limpo, ignora
                    if (valorAtual === 0 && !text.includes('R$')) return;

                    // Extração de ID - Pega o primeiro número antes de espaço ou descritivo
                    const idMatch = text.match(/^\s*(\d+)\s+/) || text.match(/(?:Item)\s*(\d+)/i) || text.match(/^(\d+)/);
                    const itemId = idMatch ? idMatch[1] : "1";

                    const ganhador = text.toUpperCase().includes('MELHOR LANCE') || (meuValor > 0 && meuValor <= valorAtual) ? 'Você' : 'Outro';

                    items.push({
                        itemId: itemId,
                        valorAtual: valorAtual,
                        meuValor: meuValor,
                        ganhador: ganhador,
                        status: isDispute ? 'Disputa' : (text.toUpperCase().includes('ENCERRADO') ? 'Encerrado' : 'Aguardando'),
                        tempoRestante: -1, 
                        position: ganhador === 'Você' ? 1 : 0
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
    currentConfig = {
        uasg: config.uasg,
        numero: config.numero,
        ano: config.ano,
        modality: config.modality
    };
    console.log("[POLARYON] Sessão Local Inicializada:", sessionId, currentConfig);
});

ipcRenderer.on('update-config', (event, config) => {
    currentVault = config;
    console.log("[POLARYON] Estratégia atualizada no navegador injetado:", currentVault);
});
