const { ipcRenderer } = require('electron');

console.log("👻 [POLARYON] Script de Preload Carregado com SUCESSO!");

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
             console.log("%c👻 [POLARYON] Token Capturado com Sucesso!", "color: lime; font-weight: bold;");
             window.polaryonAuthBearer = payload.token;
             if (!window.polaryonHybrid_Active) startHybridEngine();
        }

        if (payload.action === 'API_DUMP' && payload.url) {
             // Captura de ID Universal para monitoramento focado
             const idMatch = payload.url.match(/\/v1\/(?:compras|disputas\/compras)\/(\d+)/);
             if (idMatch) {
                  const fullId = idMatch[1];
                  if (!window.polaryonHybrid_Rooms) window.polaryonHybrid_Rooms = new Set();
                  const itemsUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${fullId}/itens`;
                  window.polaryonHybrid_Rooms.add(itemsUrl);
                  console.log(`📡 [POLARYON] Sala detectada via navegação: ${fullId}`);
             }
        }
    }
}, false);

const startHybridEngine = () => {
    if (window.polaryonHybrid_Active) return;
    window.polaryonHybrid_Active = true;
    console.log("%c🔥 [POLARYON] Motor de Combate Iniciado. Iniciando Varredura...", "color: cyan; font-weight: bold;");

    const pollingLoop = async () => {
         const authHeader = window.polaryonAuthBearer || window.polaryonAuthBearer_Last;
         if (!authHeader) {
              console.log("⏳ [POLARYON] Aguardando autenticação (Token)...");
              setTimeout(pollingLoop, 2000); 
              return; 
         }

         try {
                    // 1. DESCOBERTA AGRESSIVA (SIGA CLONE)
                    if (!window.polaryonLastDiscovery || Date.now() - window.polaryonLastDiscovery > 10000) {
                        window.polaryonLastDiscovery = Date.now();
                        const discoveryTargets = [
                            'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/participacao?pagina=0&tamanhoPagina=100',
                            'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/participacao?situacao=2&pagina=0&tamanhoPagina=100'
                        ];
                        
                        for (const discUrl of discoveryTargets) {
                            try {
                                console.log(`🔍 [POLARYON] Sincronizando participações: ${discUrl.includes('situacao=2') ? 'DISPUTAS' : 'GERAL'}`);
                                const discRes = await fetch(discUrl, { headers: { 'Authorization': authHeader } });
                                if (discRes.ok) {
                                    const discData = await discRes.json();
                                    const certames = discData.itens || discData.items || (Array.isArray(discData) ? discData : []);
                                    console.log(`✅ [POLARYON] API retornou ${certames.length} certames.`);
                                    
                                    certames.forEach(cert => {
                                        let pId = cert.compra || cert.id || cert.codigoCompra || cert.codigoProcesso || cert.identificador;
                                        if (pId && pId.toString().length < 10) {
                                            const uasg = (cert.uasg || cert.codigoUasg || '0').toString().padStart(6, '0');
                                            const mod = (cert.modalidade || '06').toString().padStart(2, '0');
                                            const num = (cert.numero || cert.numeroCompra || '0').toString().padStart(5, '0');
                                            const year = cert.ano || cert.anoCompra || new Date().getFullYear();
                                            pId = `${uasg}${mod}${num}${year}`;
                                        }
                                        if (pId && pId.toString().length >= 10) {
                                            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${pId}/itens`;
                                            if (!window.polaryonHybrid_Rooms) window.polaryonHybrid_Rooms = new Set();
                                            if (!window.polaryonHybrid_Rooms.has(url)) {
                                                console.log(`🆕 [POLARYON] Nova sala mapeada: ${pId}`);
                                                window.polaryonHybrid_Rooms.add(url);
                                            }
                                        }
                                    });
                                } else {
                                    console.log(`❌ [POLARYON] Falha na API de participações: ${discRes.status}`);
                                }
                            } catch(e) {
                                console.error("⚠️ [POLARYON] Erro na descoberta:", e);
                            }
                        }
                    }

                    // 2. BUSCA DE ITENS NAS SALAS MAPEADAS
                    let allFetchedItems = [];
                    const targetUrls = window.polaryonHybrid_Rooms ? Array.from(window.polaryonHybrid_Rooms) : [];
                    
                    if (targetUrls.length === 0) {
                        console.log("Empty [POLARYON] Nenhuma sala mapeada ainda. Tentando via navegação...");
                    }

                    for (const baseUrl of targetUrls) {
                        try {
                            const res = await fetch(baseUrl, { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } });
                            if (res.ok) {
                                const data = await res.json();
                                const items = Array.isArray(data) ? data : (data.itens || data.items || []);
                                if (items.length > 0) {
                                    const pIdMatch = baseUrl.match(/\/v1\/compras\/(\d+)/);
                                    const pId = pIdMatch ? pIdMatch[1] : 'UNKNOWN';
                                    allFetchedItems = [...allFetchedItems, ...items.map(it => ({ ...it, polaryon_purchaseId: pId }))];
                                }
                            }
                        } catch(e) {}
                    }

                    // 3. SINCRONIZAÇÃO COM O DASHBOARD
                    if (allFetchedItems.length > 0) {
                        console.log(`📦 [POLARYON] Enviando ${allFetchedItems.length} itens para o painel.`);
                        if (!window.polaryonAllItems) window.polaryonAllItems = {};
                        allFetchedItems.forEach(item => {
                            const rawId = item.identificador || item.numero.toString();
                            const vAtual = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                            const vMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
                            const pos = String(item.posicaoParticipanteDisputa || '').trim().toUpperCase();
                            const isWin = (pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°') || (vMeu > 0 && vMeu <= vAtual);

                            window.polaryonAllItems[rawId] = {
                                itemId: rawId,
                                valorAtual: vAtual,
                                meuValor: vMeu,
                                isDispute: item.situacao === '1' || item.situacao === '2',
                                desc: item.descricao || ("Item " + rawId),
                                ganhador: isWin ? 'Você' : 'Outro',
                                status: item.situacao === '1' ? 'Disputa' : (item.situacao === '2' ? 'Iminência' : 'Encerrado')
                            };
                        });

                        ipcRenderer.send('portal-update', {
                            sessionId: mySessionId || 'UNKNOWN',
                            items: Object.values(window.polaryonAllItems),
                            turbo: true
                        });
                        window.polaryonAPIStatus = "✅ CONECTADO";
                    }

                    // 4. AUTO-FILTER UI
                    const filterSelect = document.querySelector('.br-select, [placeholder*="andamento"], .select-etapa');
                    if (filterSelect && !filterSelect.innerText.toUpperCase().includes('DISPUTA')) {
                        console.log("🎯 [POLARYON] Selecionando filtro de disputa visual...");
                        filterSelect.click();
                        setTimeout(() => {
                            const opt = Array.from(document.querySelectorAll('.br-item, li, .option')).find(o => o.innerText.toUpperCase().includes('DISPUTA'));
                            if (opt) opt.click();
                        }, 500);
                    }
                    
                    const hasCritical = allFetchedItems.some(i => i.isDispute);
                    setTimeout(pollingLoop, hasCritical ? 200 : 1000);
         } catch(e) { 
              console.error("🔥 [POLARYON] Erro no loop de polling:", e);
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
            const send = (data) => window.postMessage({ type: 'POLARYON_HYBRID_SPY', payload: data }, '*');
            
            const OrigXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                const xhr = new OrigXHR();
                const oOpen = xhr.open;
                const oSet = xhr.setRequestHeader;
                xhr._url = '';
                xhr.open = function(m, u) { this._url = u; return oOpen.apply(this, arguments); };
                xhr.setRequestHeader = function(h, v) {
                    if (h.toLowerCase() === 'authorization' || h.toLowerCase() === 'bearer') {
                        window.polaryonAuthBearer = v;
                        send({ action: 'TOKEN_GRABBED', token: v });
                    }
                    return oSet.apply(this, arguments);
                };
                xhr.addEventListener('load', function() {
                    if (this._url && (this._url.includes('compras') || this._url.includes('disputa'))) {
                        try { send({ action: 'API_DUMP', url: this._url, response: JSON.parse(this.responseText) }); } catch(e) {}
                    }
                });
                return xhr;
            };

            const oFetch = window.fetch;
            window.fetch = async function() {
                const url = arguments[0];
                const opt = arguments[1] || {};
                let token = null;
                if (opt.headers) {
                    if (typeof opt.headers.get === 'function') token = opt.headers.get('authorization') || opt.headers.get('Authorization');
                    else token = opt.headers['Authorization'] || opt.headers['authorization'];
                }
                if (token) {
                    window.polaryonAuthBearer = token;
                    send({ action: 'TOKEN_GRABBED', token: token });
                }
                const res = await oFetch.apply(this, arguments);
                if (url && typeof url === 'string' && (url.includes('compras') || url.includes('disputa'))) {
                    try { res.clone().json().then(d => send({ action: 'API_DUMP', url: url, response: d })); } catch(e) {}
                }
                return res;
            };
            console.log("👻 [POLARYON] Sniffer Ativado com Sucesso.");
        })();
    `;
    const root = document.head || document.documentElement;
    if (root) { root.appendChild(script); script.remove(); }
};
injectSniffer();

let mySessionId = null;
ipcRenderer.on('init-session', (event, { sessionId, config }) => {
    mySessionId = sessionId;
    console.log(`[POLARYON] Sessão Inicializada: ${sessionId}`);
    if (window.polaryonAuthBearer) startHybridEngine();
});

function scrapeManual() {
    try {
        const body = document.body.innerText || "";
        if (body.includes('AvisoPortal') || body.includes('Comunicado')) {
            const btn = Array.from(document.querySelectorAll('button, a')).find(el => {
                const t = el.innerText.toUpperCase();
                return t.includes('PROSSEGUIR') || t.includes('ENTENDI') || t.includes('FECHAR');
            });
            if (btn) btn.click();
        }
    } catch(e) {}
}
setInterval(scrapeManual, 2000);
