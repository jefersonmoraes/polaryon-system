const { ipcRenderer } = require('electron');

let scrapingInterval = null;
let serverOffset = 0;

// Configuração recebida via IPC
let currentVault = {
    simulationMode: true,
    itemsConfig: {}
};
// Bidding Control Variables
let isBiddingActive = false;
let itemLimits = {}; // { "1": { price: 50.0, mode: 'follower' } }

// Inject global functions for the panel inputs
window.polaryonUpdateLimit = function(itemId, val) {
    if (!itemLimits[itemId]) itemLimits[itemId] = { price: '', mode: 'follower' };
    itemLimits[itemId].price = val;
};
window.polaryonUpdateMode = function(itemId, val) {
    if (!itemLimits[itemId]) itemLimits[itemId] = { price: '', mode: 'follower' };
    itemLimits[itemId].mode = val;
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

    // --- SILENCIADOR DE DIÁLOGOS BLOQUEANTES ---
    window.alert = () => { console.log("[POLARYON] Alert silenciado"); };
    window.confirm = () => { console.log("[POLARYON] Confirm silenciado"); return true; };
    window.prompt = () => { console.log("[POLARYON] Prompt silenciado"); return null; };

    try {
        const bodyText = document.body.innerText || "";
        const currentUrl = window.location.href;
        
        // --- BYPASS DE AVISOS/COMUNICADOS (SICAF/GOV) ---
        if (bodyText.includes('A Secretaria de Gestão e Inovação informa') || 
            bodyText.includes('Comunicado') || 
            bodyText.includes('Aviso Importante') ||
            currentUrl.includes('AvisoPortal')) {
            
            const skipBtns = Array.from(document.querySelectorAll('button, a, input[type="button"], tr, td')).find(el => {
                const txt = (el.innerText || el.value || "").toUpperCase();
                return txt.includes('PROSSEGUIR') || txt.includes('CONTINUAR') || txt.includes('FECHAR') || 
                       txt.includes('OK') || txt.includes('ENTENDI') || txt.includes('CLIQUE AQUI');
            });

            if (skipBtns) {
                console.log("[POLARYON] Pulando Aviso de Comunicado do Governo...");
                if (typeof skipBtns.click === 'function') skipBtns.click();
                else window.location.href = skipBtns.href || window.location.href;
                return;
            }

            // Fallback Agressivo: Se detectamos o aviso mas não achamos o botão, 
            // tentamos saltar direto para a página pós-login (intro.htm)
            if (currentUrl.includes('Aviso') || currentUrl.includes('Comunicado')) {
                console.log("[POLARYON] Aviso detectado sem botões. Forçando salto para Intro...");
                window.location.href = 'https://www.comprasnet.gov.br/intro.htm';
                return;
            }
        }

        // --- AUTOMAÇÃO DE LOGIN (GOV.BR) ---
        // Fase 1: Tela intermediária do Comprasnet ("Acesse sua Conta" -> "Entrar com Gov.br")
        if (bodyText.includes('Acesse sua Conta') && bodyText.includes('Fornecedor Brasileiro')) {
            const entrarBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
                el.innerText.toUpperCase().includes('ENTRAR COM GOV.BR')
            );
            if (entrarBtn) {
                console.log("[POLARYON] Clicando em Entrar com Gov.br...");
                entrarBtn.click();
            }
            return;
        }

        // Fase 2: Plataforma Gov.br (SSO)
        if (bodyText.includes('Identifique-se no gov.br') || bodyText.includes('Acesso Gov.br') || bodyText.includes('Certificado digital')) {
            // Tentativa rápida e direta no botão de certificado
            const certButton = document.querySelector('button#login-certificate, .cert-login-button, [alt="Certificado Digital"], #label-certificate');
            const certLink = Array.from(document.querySelectorAll('button, a, div, span, img')).find(el => {
                const txt = (el.innerText || el.getAttribute('alt') || '').toUpperCase();
                return txt.includes('CERTIFICADO DIGITAL') || txt === 'SEU CERTIFICADO DIGITAL';
            });

            const finalBtn = certButton || certLink;

            if (finalBtn && typeof finalBtn.click === 'function') {
                console.log("[POLARYON] Executando Login Automático via Certificado...");
                finalBtn.click();
            }

            ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items: [],
                statusMessage: "Autenticando no Gov.br via A1..."
            });
            return;
        }

        // --- AUTO-NAVEGAÇÃO (ÁREA DO FORNECEDOR / INTRO.HTM COM FRAMES) ---
        // O Compras.gov.br antigo usa Framesets. Precisamos procurar em todos os frames usando recursão.
        let foundMenu = false;
        try {
            const searchAndClickMenu = (win) => {
                if (foundMenu) return;
                try {
                    // 1. Tenta achar o link DIRETO da Licitação e Dispensa (Pode estar oculto mas clicável)
                    const elements = Array.from(win.document.querySelectorAll('a, td, div, span'));
                    const targetLink = elements.find(el => {
                        const txt = (el.innerText || el.textContent || "").toUpperCase().trim();
                        // Ignora espaços extras ou quebras de linha
                        const normalizedTxt = txt.replace(/\s+/g, ' ');
                        return normalizedTxt.includes('LICITAÇÃO E DISPENSA (NOVO)') || 
                               normalizedTxt.includes('LICITAÇÕES E DISPENSAS (NOVO)') ||
                               normalizedTxt.includes('DISPENDA (NOVO)'); // Typos do governo
                    });

                    if (targetLink && targetLink.href) {
                        console.log("[POLARYON] Link do Handoff encontrado. Navegando Top Window...", targetLink.href);
                        window.top.location.href = targetLink.href;
                        foundMenu = true;
                        return;
                    } else if (targetLink && typeof targetLink.click === 'function') {
                         console.log("[POLARYON] Forçando entrada automática na Sala de Disputa...");
                         targetLink.click();
                         foundMenu = true;
                         return;
                    }

                    // 2. Se não achou direto, tenta achar o botão COMPRAS e clicar para ver se o submenu abre
                    const comprasBtn = elements.find(el => {
                        const txt = (el.innerText || el.textContent || "").toUpperCase().trim();
                        return txt === 'COMPRAS';
                    });
                    
                    if (comprasBtn && typeof comprasBtn.click === 'function') {
                        // Clica em Compras se ainda não clicamos neste ciclo (evita flood)
                        if (!win.polaryonMenuClicked) {
                            console.log("[POLARYON] Abrindo Aba COMPRAS...");
                            comprasBtn.click();
                            // Dispara um mouseover também por garantia (menus DHTML antigos)
                            comprasBtn.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
                            win.polaryonMenuClicked = true;
                        }
                    }

                    // Busca recursiva nos filhos
                    if (win.frames && win.frames.length > 0) {
                        for (let i = 0; i < win.frames.length; i++) {
                            searchAndClickMenu(win.frames[i]);
                        }
                    }
                } catch(err) {
                    // Ignora erros de permissão de cross-origin em frames de login, se houver
                }
            };
            
            // Só roda a busca profunda se estivermos no topo para evitar processamento duplicado
            if (window === window.top && (window.location.href.includes('intro.htm') || bodyText.includes('Área de Trabalho do Fornecedor'))) {
                searchAndClickMenu(window.top);
            }
        } catch(e) {}


        // --- AUTO-DIRECIONAMENTO DIRETO PARA A SALA LOGO APÓS O HANDOFF ---
        if (window.location.href.includes('cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/compras')) {
            const uasgStr = (currentConfig.uasg || "150002").toString().padStart(6, '0');
            const numStr = (currentConfig.numero || "67").toString().padStart(5, '0');
            const anoStr = (currentConfig.ano || "2026").toString();
            // Assumimos 06 para Dispensa Eletrônica
            const compraCode = `${uasgStr}06${numStr}${anoStr}`;
            const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${compraCode}`;

            console.log(`[POLARYON] Handoff Concluído! Saltando direto para a sala de combate: ${targetUrl}`);
            window.location.href = targetUrl;
            return;
        }

        // --- AUTOMOÇÃO DE PESQUISA (MODALIDADE DISPENSA 14.133) ---
        if (bodyText.includes('Pesquisa de Dispensa') || bodyText.includes('Pesquisar Dispensa')) {
            const uasgInput = document.querySelector('input[name="uasg"], #uasg, [placeholder*="UASG"]');
            const numInput = document.querySelector('input[name="numero"], #numero, [placeholder*="Número"]');
            const searchBtn = document.querySelector('button.btn-pesquisar, #btnPesquisar, .br-button.primary');

            if (uasgInput && numInput && currentConfig?.uasg) {
                if (uasgInput.value !== currentConfig.uasg) {
                    console.log("[POLARYON] Preenchendo UASG...");
                    uasgInput.value = currentConfig.uasg;
                    uasgInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (numInput.value !== currentConfig.numero) {
                    console.log("[POLARYON] Preenchendo Número...");
                    numInput.value = currentConfig.numero;
                    numInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                if (searchBtn && uasgInput.value === currentConfig.uasg) {
                    console.log("[POLARYON] Disparando Busca...");
                    searchBtn.click();
                }
            }
        }

        // --- ENTRADA AUTOMÁTICA NA SALA ENCONTRADA ---
        if (bodyText.includes('Resultado da Pesquisa')) {
            const disputeLink = Array.from(document.querySelectorAll('a, button')).find(el => {
                const txt = el.innerText.toUpperCase();
                return txt.includes('ACESSAR SALA') || txt.includes('DETALHES') || txt.includes(currentConfig?.numero);
            });
            if (disputeLink) {
                console.log("[POLARYON] Entrando na Sala de Lances...");
                disputeLink.click();
            }
        }

        const items = [];
        let hasItemsInDispute = false;

        // Monitor de mudanças para extração instantânea
        if (!window.polaryonObserver) {
            window.polaryonObserver = new MutationObserver(() => {
                // A própria função scrape será chamada novamente pelo timer global, 
                // mas podemos forçar uma execução aqui se quisermos latência zero.
            });
            window.polaryonObserver.observe(document.body, { childList: true, subtree: true });
        }

        // EXEMPLO DE INJEÇÃO V4: Motor de Identificação de Precisão "Leaf-Node" (Imune a trocas de Classes/Frameworks)
        const possibleRows = Array.from(document.querySelectorAll('div, tr, li, article, mat-expansion-panel'));
        
        let itemCards = possibleRows.filter(el => {
            const txt = (el.innerText || "").trim();
            // Verifica se o texto tem a sintaxe de dispensa de lances
            const isBiddingArea = (txt.includes('Melhor valor') || txt.includes('Meu valor') || txt.includes('Valor final')) && txt.includes('R$');
            // Verifica se começa com um número de item longo isolado ou "Item [x]"
            const hasId = txt.match(/^\s*(\d+)\s+/) || txt.match(/(?:Item)\s*(\d+)/i);
            
            // Rejeita containers enormes de página (se tiver mais de 2000 caracteres, provavelmente é o body)
            return isBiddingArea && hasId && txt.length < 3000;
        });

        // Filtragem Folha (Garante que não pegamos o pai e o filho duplicados, só o container exato do item)
        itemCards = itemCards.filter(el => {
             const children = Array.from(el.querySelectorAll('*'));
             const hasNestedCard = children.some(child => itemCards.includes(child));
             return !hasNestedCard;
        });
        
        if (itemCards.length > 0) {
            itemCards.forEach(card => {
                const text = card.innerText.trim();
                
                // Dispensa 14.133 layout
                const isDispensaItem = text.includes('Melhor valor') || text.includes('Meu valor') || text.includes('Valor final');
                const isGeneralItem = text.includes('R$');

                if (isDispensaItem || isGeneralItem) {
                    // Dispensa nova Serpro: "Fase de lances aberta" ou "Em disputa". 
                    // Se a aba é 'Em disputa', assumimos aberto.
                    const isDispute = text.toUpperCase().includes('EM DISPUTA') || 
                                     text.toUpperCase().includes('ABERTO') ||
                                     text.toUpperCase().includes('IMINÊNCIA') ||
                                     text.toUpperCase().includes('FASE DE LANCES ABERTA');

                    if (isDispute) hasItemsInDispute = true;
                    
                    let valorAtual = 0;
                    let meuValor = 0;

                    // Extração Dispensa explícita (Melhor valor unitário / global)
                    if (isDispensaItem) {
                        const melhorMatch = text.match(/Melhor valor[^\d]+([\d,.]+)/i);
                        const meuMatch = text.match(/Meu valor[^\d]+([\d,.]+)/i);
                        
                        if (melhorMatch) valorAtual = parseFloat(melhorMatch[1].replace(/\./g, '').replace(',', '.'));
                        if (meuMatch) meuValor = parseFloat(meuMatch[1].replace(/\./g, '').replace(',', '.'));
                    } else {
                        // Regex genérica fallback
                        const matches = text.match(/R\$\s*([\d,.]+)/g);
                        if (matches && matches.length >= 1) {
                             valorAtual = parseFloat(matches[0].replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
                             if (matches.length >= 2) {
                                meuValor = parseFloat(matches[1].replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
                             }
                        }
                    }

                    if (valorAtual === 0 && !text.includes('R$')) return;

                    // Extração de ID (agora sabemos que a card inteira começa com o ID)
                    const idMatch = text.match(/^\s*(\d+)\s+/) || text.match(/(?:Item)\s*(\d+)/i);
                    const itemId = idMatch ? idMatch[1] : "1";

                    // No novo Serpro tem o iconezinho de Thumbs Down para perdendo. Ou Thumbs Up.
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
            renderBiddingPanel(items);
            
            // Lógica Autônoma se Máquina Ativa
            if (isBiddingActive) {
                items.forEach(it => {
                    const limit = itemLimits[it.itemId];
                    if (!limit || !limit.price) return;
                    
                    // Converte string com vírgula para float
                    const valLim = parseFloat(limit.price.replace(/\./g, '').replace(',', '.'));
                    if (isNaN(valLim)) return;

                    if (it.ganhador !== 'Você' && it.status === 'Disputa') {
                        // Anti-flood rate limit global (3 segundos)
                        if (Date.now() - (window.lastBidTime || 0) < 3000) return;
                        
                        let targetBid = it.valorAtual - 0.01; // decremento fixo de 1 centavo
                        
                        // Se for sniper, espera tempo, mas como não temos timer ainda, atira como follower mas no limite
                        if (limit.mode === 'sniper') {
                            // Sniper mode: drop directly to the minimum allowed if it beats the current
                            targetBid = valLim; 
                        }

                        if (targetBid >= valLim && targetBid < it.valorAtual) {
                            enviarLanceVisual(it.itemId, targetBid);
                            window.lastBidTime = Date.now();
                        }
                    }
                });
            }
            
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
    currentVault = { ...currentVault, ...config };
    if (config.itemsConfig) {
        Object.keys(config.itemsConfig).forEach(itemId => {
            const strat = config.itemsConfig[itemId];
            const priceStr = strat.minPrice.toFixed(2).replace('.', ',');
            if (!itemLimits[itemId]) {
                itemLimits[itemId] = { price: priceStr, mode: strat.mode };
            } else {
                itemLimits[itemId].price = priceStr;
                itemLimits[itemId].mode = strat.mode;
            }
            
            // Tenta atualizar a UI do Painel se existir
            try {
                const ipt = document.querySelector(`input[onchange*="'${itemId}'"]`);
                if (ipt) ipt.value = priceStr;
                const sel = document.querySelector(`select[onchange*="'${itemId}'"]`);
                if (sel) sel.value = strat.mode;
            } catch (e) { }
        });
    }
    console.log("[POLARYON] Estratégia atualizada no navegador injetado:", currentVault, itemLimits);
});

// -------------- FUNÇÕES DO PAINEL CIBERNÉTICO --------------
function renderBiddingPanel(items) {
    let panel = document.getElementById('polaryon-combat-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'polaryon-combat-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            max-height: 90vh;
            background: rgba(11, 16, 30, 0.95);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(16, 185, 129, 0.4);
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            z-index: 2147483647; /* MAX Z-INDEX */
            display: flex;
            flex-direction: column;
            color: #fff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            overflow: hidden;
            transition: all 0.3s ease;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = 'padding: 15px; border-bottom: 1px solid rgba(16,185,129,0.2); background: linear-gradient(90deg, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0) 100%); font-weight: 800; display: flex; align-items: center; justify-content: space-between; cursor: move;';
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <div id="polaryon-led" style="width:8px; height:8px; border-radius:50%; background:#eab308; box-shadow:0 0 10px #eab308;"></div>
                <span style="letter-spacing: 1px;">MÁQUINA DE LANCES</span>
            </div>
            <div style="font-size:9px; opacity:0.5; border:1px solid rgba(255,255,255,0.2); padding:2px 4px; border-radius:3px;">V3.0</div>
        `;
        
        const listContainer = document.createElement('div');
        listContainer.id = 'polaryon-items-list';
        listContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;';
        // Add scrollbar styling via injected style
        const style = document.createElement('style');
        style.innerHTML = `
            #polaryon-items-list::-webkit-scrollbar { width: 5px; }
            #polaryon-items-list::-webkit-scrollbar-track { background: transparent; }
            #polaryon-items-list::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.3); border-radius: 4px; }
        `;
        document.head.appendChild(style);
        
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 15px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.4);';
        
        const startBtn = document.createElement('button');
        startBtn.id = 'polaryon-combat-btn';
        startBtn.innerText = '▶ AUTORIZAR MÁQUINA DE LANCES';
        startBtn.style.cssText = 'width: 100%; padding: 14px; background: #10b981; color: #000; font-weight: 900; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; text-transform: uppercase; font-size: 12px; box-shadow: 0 0 20px rgba(16,185,129,0.3); letter-spacing: 0.5px;';
        startBtn.onmouseover = () => { if(!isBiddingActive) startBtn.style.transform = 'scale(1.02)'; };
        startBtn.onmouseout = () => { startBtn.style.transform = 'scale(1)'; };
        startBtn.onclick = () => {
            isBiddingActive = !isBiddingActive;
            const led = document.getElementById('polaryon-led');
            if (isBiddingActive) {
                startBtn.innerText = '🛑 ABORTAR OPERAÇÃO AUTOMÁTICA';
                startBtn.style.background = '#ef4444';
                startBtn.style.color = '#fff';
                startBtn.style.boxShadow = '0 0 20px rgba(239,68,68,0.4)';
                if (led) { led.style.background = '#ef4444'; led.style.boxShadow = '0 0 10px #ef4444'; }
            } else {
                startBtn.innerText = '▶ AUTORIZAR MÁQUINA DE LANCES';
                startBtn.style.background = '#10b981';
                startBtn.style.color = '#000';
                startBtn.style.boxShadow = '0 0 20px rgba(16,185,129,0.3)';
                if (led) { led.style.background = '#eab308'; led.style.boxShadow = '0 0 10px #eab308'; }
            }
        };
        
        footer.appendChild(startBtn);
        panel.appendChild(header);
        panel.appendChild(listContainer);
        panel.appendChild(footer);
        document.body.appendChild(panel);
    }
    
    // Update Items gracefully to avoid losing input focus
    const list = document.getElementById('polaryon-items-list');
    if (list) {
        items.forEach(it => {
            let itemDiv = document.getElementById('pol-item-' + it.itemId);
            if (!itemDiv) {
                // Monta o Card do Item pela primeira vez
                itemDiv = document.createElement('div');
                itemDiv.id = 'pol-item-' + it.itemId;
                itemDiv.style.cssText = 'background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); transition: border-color 0.3s;';
                
                const limit = itemLimits[it.itemId] || { price: '', mode: 'follower' };
                
                itemDiv.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
                        <span style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.9);">Item ${it.itemId}</span>
                        <div style="display:flex; flex-direction:column; align-items:flex-end;">
                           <span id="pol-item-status-${it.itemId}" style="font-size:8px; padding:2px 4px; border-radius:3px; background:rgba(255,255,255,0.1); margin-bottom:2px; font-weight:bold; letter-spacing:0.5px;">${it.status.toUpperCase()}</span>
                           <span id="pol-item-val-${it.itemId}" style="font-size:11px; font-weight:bold; color: #10b981;">R$ ${it.valorAtual.toFixed(2)}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap: 6px;">
                        <div style="position:relative; flex:1;">
                           <span style="position:absolute; left:6px; top:5px; font-size:10px; color:rgba(255,255,255,0.4); font-weight:bold;">R$</span>
                           <input type="text" placeholder="Meu Limite Mínimo" value="${limit.price}" 
                            <input type="text" placeholder="Meu Limite Mínimo" value="${limit.price}" 
                               class="polaryon-limit-input"
                               style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.4); border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:6px 6px 6px 22px; color:#fff; font-size:11px; outline:none; font-weight:bold;" />
                        </div>
                        <select class="polaryon-mode-select"
                            style="width: 85px; background:rgba(0,0,0,0.4); border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:4px; color:#10b981; font-size:10px; font-weight:bold; outline:none; cursor:pointer;">
                            <option value="follower" ${limit.mode === 'follower' ? 'selected' : ''}>SEGUIDOR</option>
                            <option value="sniper" ${limit.mode === 'sniper' ? 'selected' : ''}>SNIPER</option>
                        </select>
                    </div>
                `;
                
                // Anexa os eventos via Isolated context (addEventListener funciona aqui)
                const inputEl = itemDiv.querySelector('.polaryon-limit-input');
                const selectEl = itemDiv.querySelector('.polaryon-mode-select');
                
                if (inputEl) inputEl.addEventListener('change', (e) => window.polaryonUpdateLimit(it.itemId, e.target.value));
                if (selectEl) selectEl.addEventListener('change', (e) => window.polaryonUpdateMode(it.itemId, e.target.value));
                
                list.appendChild(itemDiv);
            } else {
                // Atualiza apenas os valores visuais do span (sem tocar no input para o usuário não perder o foco)
                const valSpan = document.getElementById('pol-item-val-' + it.itemId);
                const statusSpan = document.getElementById('pol-item-status-' + it.itemId);
                if (valSpan) valSpan.innerText = 'R$ ' + it.valorAtual.toFixed(2);
                if (statusSpan) {
                    statusSpan.innerText = it.status.toUpperCase();
                    if (it.ganhador === 'Você') {
                        statusSpan.style.background = 'rgba(16,185,129,0.2)';
                        statusSpan.style.color = '#10b981';
                        statusSpan.innerText = 'Ganhando';
                    } else if (it.status === 'Disputa') {
                        statusSpan.style.background = 'rgba(239,68,68,0.2)';
                        statusSpan.style.color = '#ef4444';
                        statusSpan.innerText = 'EM DISPUTA';
                    } else {
                        statusSpan.style.background = 'rgba(255,255,255,0.1)';
                        statusSpan.style.color = '#fff';
                    }
                }
            }
        });
    }
}

// -------------- ROTINA DE DISPARO VISUAL --------------
function enviarLanceVisual(itemId, valorStr) {
    try {
        const possibleRows = Array.from(document.querySelectorAll('div, tr, li, article'));
        let itemCards = possibleRows.filter(el => {
            const txt = (el.innerText || "").trim();
            const hasId = txt.match(new RegExp(`^\\s*${itemId}\\s+`)) || txt.match(new RegExp(`(?:Item)\\s*${itemId}`, 'i'));
            return hasId && txt.includes('R$') && txt.length < 3000;
        });

        itemCards = itemCards.filter(el => {
             const children = Array.from(el.querySelectorAll('*'));
             return !children.some(child => itemCards.includes(child));
        });
        
        const itemRow = itemCards.length > 0 ? itemCards[0] : null;
        
        if (itemRow) {
            // Acha todos os inputs texto dentro do Container do Item
            const inputs = Array.from(itemRow.querySelectorAll('input[type="text"], input[class*="moeda"], input[class*="valor"]'));
            // Remove inputs readonly ou desabilitados
            const activeInputs = inputs.filter(i => !i.disabled && !i.readOnly);
            
            if (activeInputs.length > 0) {
                const input = activeInputs[0];
                const cleanValue = valorStr.toFixed(2).replace('.', ',');
                
                // Set the value via object property descriptor trick for React/Angular SPAs
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(input, cleanValue);
                } else {
                    input.value = cleanValue;
                }
                
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', {'key':'Enter'}));

                // Find the submit button next to it
                const buttons = Array.from(itemRow.querySelectorAll('button, input[type="button"], a[class*="btn"]'));
                const submitBtn = buttons.find(b => b.innerText.toUpperCase().includes('LANCE') || b.innerText.toUpperCase().includes('ENVIAR') || b.title.toUpperCase().includes('LANCE'));
                
                if (submitBtn) {
                    submitBtn.click();
                    console.log(`[POLARYON COMBAT TACTICAL] Fire: Item ${itemId} -> R$ ${cleanValue}`);
                    
                    // Identifica Modal de Confirmação (Gov.br 14.133 frequentemente pergunta: "Deseja confirmar o lance?")
                    setTimeout(() => {
                        const confirmBtns = Array.from(document.querySelectorAll('button'));
                        const btnConfirma = confirmBtns.find(b => b.innerText.toUpperCase() === 'CONFIRMAR' || b.innerText.toUpperCase() === 'SIM');
                        if (btnConfirma) {
                            btnConfirma.click();
                            console.log(`[POLARYON COMBAT TACTICAL] Auto-Confirmação Clicada para Item ${itemId}`);
                        }
                    }, 500); // 500ms delay for modal to popup
                }
            }
        }
    } catch (e) {
        console.error("Polaryon Combat Error:", e);
    }
}
// -------------- FIM DO INJETOR v1.2.50 --------------
