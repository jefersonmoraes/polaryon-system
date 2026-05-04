const { ipcRenderer } = require('electron');

// 🛡️ MODO HÍBRIDO: INJEÇÃO DO "FANTASMA" NO MUNDO REAL (DOM)
window.addEventListener("message", (event) => {
    if (event.source === window && event.data && event.data.type === 'POLARYON_HYBRID_SPY') {
        const payload = event.data.payload;
        
        ipcRenderer.send('portal-hybrid-capture', {
            sessionId: mySessionId || 'UNKNOWN',
            action: payload.action,
            data: payload
        });
        
        if (payload.action === 'TOKEN_GRABBED') {
             console.log("👻 [POLARYON] Token Capturado! Modo Híbrido armado.");
             window.polaryonAuthBearer = payload.token;
        }

        if (payload.action === 'API_DUMP' && payload.url) {
             const idMatch = payload.url.match(/\/v1\/(?:compras|disputas\/compras)\/(\d+)/);
             if (idMatch) {
                  const fullId = idMatch[1];
                  const yearMatch = payload.url.match(/\/v1\/(?:compras|disputas\/compras)\/\d+\/(\d{4})/);
                  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
                  const basePath = payload.url.includes('disputas') ? 'disputas/compras' : 'compras';
                  
                  window.polaryonContext_PurchaseId = fullId;
                  window.polaryonContext_Year = year;
                  window.polaryonContext_BasePath = basePath;

                  if (!window.polaryonHybrid_ItemsUrl || window.polaryonHybrid_ItemsUrl.includes('/participacao')) {
                      window.polaryonHybrid_ItemsUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${fullId}/itens`;
                  }
             }

             const isItemsList = (payload.url.includes('/itens') || payload.url.includes('/disputa')) && !payload.url.includes('/totalizadores');
             const isMetadata = payload.url.includes('/participacao') || payload.url.includes('/sessao') || payload.url.includes('/usuario');

             if (isItemsList && !isMetadata) {
                  window.polaryonHybrid_ItemsUrl = payload.url.replace(/tamanhoPagina=\d+/, 'tamanhoPagina=100');
                  if (!window.polaryonHybrid_ItemsUrl.includes('tamanhoPagina')) {
                      window.polaryonHybrid_ItemsUrl += (window.polaryonHybrid_ItemsUrl.includes('?') ? '&' : '?') + 'tamanhoPagina=100';
                  }
                  if (!window.polaryonHybrid_Active) startHybridEngine();
             }

             if (payload.url.includes('/participacao')) {
                 const content = payload.response;
                 const certames = content.itens || content.items || (Array.isArray(content) ? content : []);
                 console.log(`🕵️ [POLARYON CRAWLER] Detectados ${certames.length} certames. Sincronizando...`);
                 
                 certames.forEach(cert => {
                     let purchaseId = cert.compra || cert.id || cert.codigoCompra;
                     const year = cert.ano || cert.anoCompra || new Date().getFullYear();
                     
                     if (purchaseId && purchaseId.toString().length > 10) {
                        const itemsUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${purchaseId}/itens`;
                        if (!window.polaryonHybrid_Rooms) window.polaryonHybrid_Rooms = new Set();
                        window.polaryonHybrid_Rooms.add(itemsUrl);
                     }
                 });
                 if (!window.polaryonHybrid_Active) startHybridEngine();
             }
        }
    }
}, false);

const startHybridEngine = () => {
    if (window.polaryonHybrid_Active) return;
    window.polaryonHybrid_Active = true;
    console.log("🔥 [POLARYON PHANTOM] Modo Combate Ativado!");

    const pollingLoop = async () => {
         if (!window.polaryonBadUrls) window.polaryonBadUrls = new Set();
         if (!window.polaryonAuthBearer) { setTimeout(pollingLoop, 2000); return; }

         try {
                    const authHeader = window.polaryonAuthBearer || window.polaryonAuthBearer_Last;

                    // [VITAL FIX] DESCOBERTA AGRESSIVA AGORA RODA NO INÍCIO DO LOOP
                    if (!window.polaryonLastDiscovery || Date.now() - window.polaryonLastDiscovery > 10000) {
                        window.polaryonLastDiscovery = Date.now();
                        const discoveryTargets = [
                            'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/participacao?pagina=0&tamanhoPagina=100',
                            'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/participacao?situacao=2&pagina=0&tamanhoPagina=100'
                        ];
                        for (const discUrl of discoveryTargets) {
                            try {
                                const discRes = await fetch(discUrl, { headers: { 'Authorization': authHeader } });
                                if (discRes.ok) {
                                    const discData = await discRes.json();
                                    const certames = discData.itens || discData.items || (Array.isArray(discData) ? discData : []);
                                    certames.forEach(cert => {
                                        let purchaseId = cert.compra || cert.id || cert.codigoCompra || cert.codigoProcesso;
                                        const year = cert.ano || cert.anoCompra || new Date().getFullYear();
                                        if (purchaseId && purchaseId.toString().length < 10) {
                                            const uasg = (cert.uasg || cert.codigoUasg || '0').toString().padStart(6, '0');
                                            const mod = (cert.modalidade || '06').toString().padStart(2, '0');
                                            const num = (cert.numero || cert.numeroCompra || '0').toString().padStart(5, '0');
                                            purchaseId = `${uasg}${mod}${num}${year}`;
                                        }
                                        if (purchaseId && purchaseId.toString().length > 10) {
                                            const itemsUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${purchaseId}/itens`;
                                            if (!window.polaryonHybrid_Rooms) window.polaryonHybrid_Rooms = new Set();
                                            window.polaryonHybrid_Rooms.add(itemsUrl);
                                        }
                                    });
                                }
                            } catch(e) {}
                        }
                    }

                    let allFetchedItems = [];
                    const targetUrls = window.polaryonHybrid_Rooms ? Array.from(window.polaryonHybrid_Rooms) : [window.polaryonHybrid_ItemsUrl];
                    
                    for (const baseUrl of targetUrls) {
                        if (!baseUrl) continue;
                        const urlParts = baseUrl.match(/\/v1\/compras\/(\d+)/);
                        const currentPurchaseId = urlParts ? urlParts[1] : null;
                        if (!currentPurchaseId || currentPurchaseId.length < 10) continue;

                        try {
                            const res = await fetch(baseUrl, {
                                 headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
                            });
                            if (res.ok) {
                                const data = await res.json();
                                const itemsArray = Array.isArray(data) ? data : (data.itens || data.items || []);
                                if (itemsArray.length > 0) {
                                    const currentYear = currentPurchaseId.slice(-4);
                                    allFetchedItems = [...allFetchedItems, ...itemsArray.map(it => ({
                                        ...it,
                                        polaryon_purchaseId: currentPurchaseId,
                                        polaryon_year: currentYear
                                    }))];
                                }
                            }
                        } catch(e) {}
                    }

                    if (allFetchedItems.length > 0) {
                        if (!window.polaryonAllItems) window.polaryonAllItems = {};
                        allFetchedItems.forEach(item => {
                            const isGroupHeading = (item.identificador || "").startsWith('G') && (!item.posicaoParticipanteDisputa) && (!item.melhorValorFornecedor);
                            if (isGroupHeading) return; 

                            const melhorGeral = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                            const melhorMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
                            const pos = String(item.posicaoParticipanteDisputa || '').trim().toUpperCase();
                            let isWinner = (pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°');
                            if (!isWinner && (pos === '?' || pos === '')) {
                                if (melhorMeu > 0 && melhorMeu <= melhorGeral) isWinner = true;
                            }

                            const rawId = item.identificador || item.numero.toString();
                            window.polaryonAllItems[rawId] = {
                                itemId: rawId,
                                valorAtual: melhorGeral,
                                meuValor: melhorMeu,
                                isDispute: item.situacao === '1' || item.situacao === '2',
                                desc: item.descricao || ("Item " + rawId),
                                ganhador: isWinner ? 'Você' : 'Outro',
                                status: item.situacao === '1' ? 'Disputa' : (item.situacao === '2' ? 'Iminência' : 'Encerrado')
                            };
                        });

                        ipcRenderer.send('portal-hybrid-capture', {
                            sessionId: mySessionId || 'UNKNOWN',
                            action: 'HYBRID_API_RESULTS',
                            data: { items: allFetchedItems }
                        });
                        window.polaryonAPIStatus = "✅ ELITE (CAMUFLADO)";
                    }

                    // --- AUTO-FILTER UI ---
                    try {
                        const filterSelect = document.querySelector('.br-select, [placeholder*="andamento"], .select-etapa');
                        if (filterSelect && !filterSelect.innerText.toUpperCase().includes('DISPUTA')) {
                            filterSelect.click();
                            setTimeout(() => {
                                const disputeOpt = Array.from(document.querySelectorAll('.br-item, li, .option')).find(o => o.innerText.toUpperCase().includes('DISPUTA'));
                                if (disputeOpt) disputeOpt.click();
                            }, 500);
                        }
                    } catch(e) {}
                    
               const items = Object.values(window.polaryonAllItems || {});
               const hasCritical = items.some(it => it.status === 'Disputa' || it.status === 'Iminência' || it.isDispute);
               setTimeout(pollingLoop, hasCritical ? 150 : 1000);
         } catch(e) {
              window.polaryonAPIStatus = "❌ OFFLINE";
              setTimeout(pollingLoop, 2000);
         }
    };
    pollingLoop();
};

const injectSniffer = () => {
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            if (window.__polaryon_sniffed) return;
            window.__polaryon_sniffed = true;
            const sendToPreload = (data) => window.postMessage({ type: 'POLARYON_HYBRID_SPY', payload: data }, '*');
            const OrigXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                const xhr = new OrigXHR();
                const origOpen = xhr.open;
                const origSetReqHeader = xhr.setRequestHeader;
                xhr._url = '';
                xhr.open = function(method, url) { this._url = url; return origOpen.apply(this, arguments); };
                xhr.setRequestHeader = function(header, value) {
                    if (header.toLowerCase() === 'authorization' || header.toLowerCase() === 'bearer') {
                        window.polaryonAuthBearer = value;
                        sendToPreload({ action: 'TOKEN_GRABBED', token: value, url: this._url });
                    }
                    return origSetReqHeader.apply(this, arguments);
                };
                xhr.addEventListener('load', function() {
                    const url = this._url || '';
                    if (url.includes('compras') || url.includes('disputa')) {
                        try { sendToPreload({ action: 'API_DUMP', url: url, response: JSON.parse(this.responseText) }); } catch(e) {}
                    }
                });
                return xhr;
            };
            const origFetch = window.fetch;
            window.fetch = async function() {
                const url = arguments[0];
                const options = arguments[1] || {};
                if (options.headers) {
                    try {
                        const tk = options.headers['Authorization'] || options.headers['authorization'];
                        if (tk) { window.polaryonAuthBearer = tk; sendToPreload({ action: 'TOKEN_GRABBED', token: tk, url: url }); }
                    } catch(e){}
                }
                const response = await origFetch.apply(this, arguments);
                if (url && typeof url === 'string' && (url.includes('compras') || url.includes('disputa'))) {
                    try { const clone = response.clone(); clone.json().then(data => sendToPreload({ action: 'API_DUMP', url: url, response: data })); } catch(e) {}
                }
                return response;
            };
        })();
    `;
    const inject = () => { const root = document.head || document.documentElement; if (root) { root.appendChild(script); script.remove(); } else { setTimeout(inject, 50); } };
    inject();
};
injectSniffer();

function scrapeChatAndTimers() {
    try {
        const timerEls = Array.from(document.querySelectorAll('span, div, b')).filter(el => /^\d{2}:\d{2}:\d{2}$/.test(el.innerText.trim()));
        if (timerEls.length > 0) {
            ipcRenderer.send('portal-update', { sessionId: mySessionId, action: 'TIMER_UPDATE', data: { time: timerEls[0].innerText } });
        }
        const chatRows = document.querySelectorAll('.chat-msg, .mensagem-pregoeiro, .br-item.chat');
        if (chatRows.length > 0) {
            const chatMessages = Array.from(chatRows).map(row => ({ text: row.innerText.trim(), time: new Date().toLocaleTimeString() }));
            ipcRenderer.send('portal-update', { sessionId: mySessionId, action: 'CHAT_EXTRACTED', data: { messages: chatMessages } });
        }
    } catch (e) {}
}
setInterval(scrapeChatAndTimers, 500);

let mySessionId = null;
let currentConfig = { uasg: '', numero: '', ano: '', modality: '05' };
let isManualLogin = false;
let loginSuccessDetected = false;

function scrapeDisputeRoom() {
    if (!mySessionId) return;
    try {
        const bodyText = document.body.innerText || "";
        const currentUrl = window.location.href;
        
        if (!loginSuccessDetected && (currentUrl.includes('servico=226') || currentUrl.includes('/disputa') || currentUrl.includes('intro.htm'))) {
             loginSuccessDetected = true;
             ipcRenderer.send('login-success', { sessionId: mySessionId, url: currentUrl });
        }

        if (currentUrl.includes('AvisoPortal') || bodyText.includes('Comunicado')) {
            const skip = Array.from(document.querySelectorAll('button, a')).find(el => {
                const t = el.innerText.toUpperCase();
                return t.includes('PROSSEGUIR') || t.includes('FECHAR') || t.includes('ENTENDI');
            });
            if (skip) skip.click();
            else if (currentUrl.includes('Aviso')) window.location.href = 'https://www.comprasnet.gov.br/intro.htm';
        }

        // [VITAL FIX] SANITIZAÇÃO DE ID PARA EVITAR JUMPS MALFORMADOS
        if (currentUrl.includes('cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/compras')) {
            const uasg = (currentConfig.uasg || "").toString();
            const numero = (currentConfig.numero || "").toString();
            // Só pula se for um ID numérico válido
            if (/^\d+$/.test(uasg) && /^\d+$/.test(numero)) {
                const uasgStr = uasg.padStart(6, '0');
                const numStr = numero.padStart(5, '0');
                const anoStr = (currentConfig.ano || "2026").toString();
                let mod = (currentConfig.modality || "06").toString();
                if (mod === "14") mod = "06"; 
                const modalityCode = mod.padStart(2, '0');
                window.location.href = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${uasgStr}${modalityCode}${numStr}${anoStr}`;
            }
        }

        const items = [];
        const itemCards = Array.from(document.querySelectorAll('div, tr, li')).filter(el => {
            const txt = el.innerText;
            return (txt.includes('Melhor valor') || txt.includes('Meu valor')) && txt.match(/(?:Item|GRUPO)\s*(\d+)/i);
        });

        itemCards.forEach(card => {
            const text = card.innerText;
            const idMatch = text.match(/(?:Item|GRUPO)\s*(\d+)/i);
            if (idMatch) {
                const itemId = text.includes('GRUPO') ? 'G' + idMatch[1] : idMatch[1];
                const valorMatch = text.match(/Melhor valor[^\d,]+([\d,.]+)/i);
                const meuMatch = text.match(/Meu valor[^\d,]+([\d,.]+)/i);
                const valorAtual = valorMatch ? parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
                const meuValor = meuMatch ? parseFloat(meuMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
                
                if (!window.polaryonAllItems) window.polaryonAllItems = {};
                window.polaryonAllItems[itemId] = {
                    itemId: itemId,
                    valorAtual: valorAtual,
                    meuValor: meuValor,
                    ganhador: (meuValor > 0 && meuValor <= (valorAtual + 0.0001)) ? 'Você' : 'Outro',
                    status: text.toUpperCase().includes('DISPUTA') ? 'Disputa' : 'Aguardando'
                };
            }
        });

        if (Object.keys(window.polaryonAllItems || {}).length > 0) {
            ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items: Object.values(window.polaryonAllItems),
                timestamp: new Date().toISOString(),
                turbo: true
            });
        }
    } catch (e) {}
}

window.addEventListener('load', () => setInterval(scrapeDisputeRoom, 2000));

ipcRenderer.on('init-session', (event, { sessionId, config }) => {
    mySessionId = sessionId;
    currentConfig = { uasg: config.uasg, numero: config.numero, ano: config.ano, modality: config.modality };
    isManualLogin = config.modality === 'LOGIN_FLOW';
    if (window.polaryonAuthBearer) startHybridEngine();
});
