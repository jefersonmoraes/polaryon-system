const { ipcRenderer } = require('electron');

console.log("👻 [POLARYON] Script de Preload Carregado com SUCESSO!");

window.polaryonStrategies = {};
window.polaryonAuthBearer = null;
window.polaryonHybrid_Rooms = new Set();

// 💉 RECEPTOR DE TOKEN FORÇADO
ipcRenderer.on('force-token-injection', (event, { token }) => {
    if (token && token !== window.polaryonAuthBearer) {
        window.polaryonAuthBearer = token;
        if (!window.polaryonHybrid_Active) startHybridEngine();
    }
});

// ⚙️ RECEPTOR DE CONFIGURAÇÃO
ipcRenderer.on('update-config', (event, config) => {
    if (config.itemsConfig) {
        window.polaryonStrategies = { ...window.polaryonStrategies, ...config.itemsConfig };
    }
});

// 🧠 APRENDIZAGEM DE SALAS
ipcRenderer.on('force-room-learning', (event, { purchaseId }) => {
    if (purchaseId) {
        const roomUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${purchaseId}/itens`;
        const disputeUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
        
        if (!window.polaryonHybrid_Rooms.has(roomUrl)) {
            console.log(`%c🧠 [POLARYON] Nova sala detectada: ${purchaseId}`, "color: orange; font-weight: bold;");
            window.polaryonHybrid_Rooms.add(roomUrl);
            window.polaryonHybrid_Rooms.add(disputeUrl);
        }
    }
});

// ⚡ LANCE MANUAL / AUTOMÁTICO
ipcRenderer.on('manual-bid', async (event, { purchaseId, itemId, bidId, value }) => {
    // itemId = número sequencial (ex: 1)
    // bidId = identificador longo (ex: UUID)
    await sendBid(purchaseId, itemId, bidId, value);
});

const sendBid = async (purchaseId, itemNum, bidId, value) => {
    const auth = window.polaryonAuthBearer;
    if (!auth) {
        console.error("❌ [POLARYON] Token não encontrado. Faça login novamente.");
        return;
    }
    
    // 🔍 OPERAÇÃO SINCRONIA TOTAL (v3.5.60)
    // Força a captura da versão mais recente do item antes de disparar
    const getFreshItem = (id) => {
        const cache = window.polaryonAllItems || {};
        return cache[String(id)] || Object.values(cache).find(i => String(i.numero) === String(id) || String(i.identificador) === String(id));
    };

    try {
        const numValue = Number(value) || 0;
        const valFormatted = Number(numValue.toFixed(2));
        const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemNum}/lances`;
        
        // Sincronia de milissegundos: busca o dado mais fresco possível
        const cached = getFreshItem(bidId || itemNum);
        
        if (!cached) {
            console.warn(`[POLARYON] ⚠️ Alerta: Item ${itemNum} não encontrado no cache. Risco de erro de versão.`);
        }

        const payload = {
            valor: valFormatted,
            valorAjustado: valFormatted,
            identificadorItem: Number(bidId || itemNum), // Serpro Mobile prefere Number
            faseItem: Number(cached?.fase || 1),
            versaoItem: Number(cached?.versaoItem || 1),
            versaoParticipante: Number(cached?.versaoParticipante || 1),
            tipoLance: 'V', // 🎯 CAMPO OBRIGATÓRIO (Fixes "não deve ser nulo")
            dataHoraLance: new Date().toISOString()
        };

        console.log(`🚀 [POLARYON] DISPARANDO LANCE (v3.5.60):`, payload);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': auth,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseData = await res.json().catch(() => ({}));

        if (res.ok) {
            console.log(`%c✅ [POLARYON] LANCE ACEITO NO SERPRO: R$ ${valFormatted}`, "color: #00ff00; font-weight: bold; font-size: 14px;");
            
            // Persistência no Backend Polaryon (Fixes 404)
            fetch(`https://polaryon.com.br/api/bidding/sessions/${window.polaryonSessionId || 'default'}/items/${itemNum}/bid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': window.polaryonAuthBearer },
                body: JSON.stringify({ value: valFormatted, status: 'success', type: 'MANUAL' })
            }).catch(e => console.error("Erro na persistência local:", e));

        } else {
            console.error(`❌ [POLARYON] REJEITADO PELO SERPRO (Status ${res.status}):`, responseData);
            
            // Tratamento de Erro de Versão (Auto-Correção)
            if (JSON.stringify(responseData).includes('versaoItem')) {
                 console.warn("🔄 [POLARYON] Versão obsoleta detectada. O robô irá sincronizar no próximo ciclo.");
            }

            // Fallback Estrutural (String ID + Fase 2)
            if (res.status === 400) {
                 console.log("🔄 [POLARYON] Tentando estratégia de fallback (String ID + Tipo Alternativo)...");
                 const altPayload = { ...payload, identificadorItem: String(payload.identificadorItem), faseItem: 2 };
                 await fetch(url, { 
                     method: 'POST', 
                     headers: { 'Authorization': auth, 'Content-Type': 'application/json' }, 
                     body: JSON.stringify(altPayload) 
                 });
            }
        }
    } catch (e) {
        console.error(`❌ [POLARYON] Falha na execução do lance:`, e);
    }
};

const startHybridEngine = () => {
    if (window.polaryonHybrid_Active) return;
    window.polaryonHybrid_Active = true;
    console.log("%c🔥 [POLARYON] Motor de Combate Iniciado.", "color: cyan; font-weight: bold;");

    const pollingLoop = async () => {
         const authHeader = window.polaryonAuthBearer;
         if (!authHeader) { setTimeout(pollingLoop, 2000); return; }

         try {
                    let allFetchedItems = [];
                    const targetUrls = Array.from(window.polaryonHybrid_Rooms);
                    
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

                    if (allFetchedItems.length > 0) {
                        if (!window.polaryonAllItems) window.polaryonAllItems = {};
                        
                        for (const item of allFetchedItems) {
                            // 🕵️ ESTRATÉGIA DE DESCOBERTA DE ID v3.5.54
                            const realId = String(item.identificador || item.identificadorItem || item.id || item.item_id || item.uuid || '');
                            const displayNum = String(item.numero || '');
                            const pId = item.polaryon_purchaseId;
                            
                            const bidId = realId; 
                            const rawId = displayNum;
                            const vItem = item.versaoItem || 1;
                            const vPart = item.versaoParticipante || 1;

                            // 🛠️ LOG DE DEPURAÇÃO (Aparece no F12 do Robô)
                            if (displayNum === "1" || !window._polaryon_logged_once) {
                                console.log(`[POLARYON DEBUG] Dados do Item ${displayNum}:`, item);
                                window._polaryon_logged_once = true;
                            }

                            const vAtual = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                            const vMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
                            const pos = String(item.posicaoParticipanteDisputa || '').trim().toUpperCase();
                            const isWin = (pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°') || (vMeu > 0 && vMeu <= vAtual);
                            const isDispute = item.situacao === '1' || item.situacao === '2';

                            // 🎯 CAPTURA DE MARGEM OFICIAL (Intervalo Mínimo)
                            const intervalValue = item.intervaloMinimoEntreLances || 1;
                            const intervalType = item.tipoIntervaloLance === 2 ? 'percentage' : 'fixed';

                            window.polaryonAllItems[rawId] = {
                                itemId: rawId,
                                bidId: bidId, // Guardamos o ID real para o lance
                                purchaseId: pId,
                                valorAtual: vAtual,
                                meuValor: vMeu,
                                isDispute: isDispute,
                                timerSeconds: item.segundosParaEncerramento || 0,
                                desc: item.descricao || ("Item " + rawId),
                                ganhador: isWin ? 'Você' : 'Outro',
                                status: isDispute ? 'Disputa' : 'Encerrado',
                                officialMargin: intervalValue,
                                officialMarginType: intervalType
                            };

                            const strat = window.polaryonStrategies[rawId];
                            if (strat && strat.active && isDispute && !isWin && vAtual > 0) {
                                // ... (logic same but using bidId if sending)
                                let marginToUse = strat.decrementValue || intervalValue;
                                if (strat.decrementType === 'percentage' || intervalType === 'percentage') {
                                    const perc = strat.decrementType === 'percentage' ? strat.decrementValue : intervalValue;
                                    marginToUse = vAtual * (perc / 100);
                                }

                                let nextValue = vAtual - marginToUse;
                                if (strat.mode === 'follower') {
                                    if (nextValue >= (strat.minPrice || 0) && nextValue < vMeu) {
                                        await sendBid(pId, bidId, nextValue);
                                        await new Promise(r => setTimeout(r, 1000));
                                    }
                                }
                            }
                        }

                        // 📦 AGRUPAMENTO POR SALA PARA INTERFACE MULTI-DROP
                        const roomsData = {};
                        for (const item of Object.values(window.polaryonAllItems)) {
                            const pId = item.purchaseId || 'GLOBAL';
                            if (!roomsData[pId]) roomsData[pId] = [];
                            roomsData[pId].push(item);
                        }

                        for (const [pId, roomItems] of Object.entries(roomsData)) {
                            if (roomItems && roomItems.length > 0) {
                                const sid = `HYBRID_${pId}`;
                                ipcRenderer.send('portal-update', { 
                                    sessionId: sid, 
                                    items: roomItems, 
                                    turbo: true,
                                    uasg: pId.length > 6 ? pId.substring(0, 6) : pId 
                                });
                            }
                        }
                    }

                    // 🏎️ RATE LIMIT DINÂMICO (v3.5.44) - Evita Erro 429
                    const numRooms = window.polaryonHybrid_Rooms.size / 2; // Divide por 2 porque adicionamos 2 URLs por sala
                    const baseDelay = numRooms > 3 ? 2000 : 1000;
                    const isUrgent = allFetchedItems.some(i => (i.segundosParaEncerramento > 0 && i.segundosParaEncerramento < 60));
                    
                    setTimeout(pollingLoop, (isUrgent ? 600 : baseDelay) + Math.random() * 500);
          } catch(e) {
              console.log("%c⚠️ [POLARYON] Falha de Sessão. Re-tentando em 5s...", "color: yellow;");
              setTimeout(pollingLoop, 5000);
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
            const oFetch = window.fetch;
            window.fetch = async function() {
                const url = arguments[0];
                const opt = arguments[1] || {};
                let token = null;
                if (opt.headers) {
                    if (typeof opt.headers.get === 'function') token = opt.headers.get('authorization') || opt.headers.get('Authorization');
                    else token = opt.headers['Authorization'] || opt.headers['authorization'];
                }
                if (token) { window.polaryonAuthBearer = token; send({ action: 'TOKEN_GRABBED', token: token }); }
                const res = await oFetch.apply(this, arguments);
                
                // 🕵️ SNIFFER DE SALAS EM MASSA (v3.5.38)
                if (url.includes('minhas-participacoes')) {
                    const clone = res.clone();
                    clone.json().then(data => {
                        const compras = data.compras || [];
                        compras.forEach(c => {
                            if (c.situacaoCompra === 2 || c.situacaoCompra === 1) { // 1 ou 2 = Aberto/Disputa
                                const pId = c.identificador;
                                if (pId) {
                                    window.postMessage({ type: 'POLARYON_LEARN_ROOM', purchaseId: pId }, '*');
                                }
                            }
                        });
                    }).catch(() => {});
                }

                return res;
            };

            window.addEventListener('message', (e) => {
                if (e.data && e.data.type === 'POLARYON_LEARN_ROOM') {
                     const pId = e.data.purchaseId;
                     const roomUrl = \`https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/\${pId}/itens\`;
                     const disputeUrl = \`https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/\${pId}/itens/em-disputa\`;
                     if (!window.polaryonHybrid_Rooms.has(roomUrl)) {
                         console.log("%c🚀 [POLARYON SCANNER] Detectada Sala em Massa: " + pId, "color: #00ff00; font-weight: bold;");
                         window.polaryonHybrid_Rooms.add(roomUrl);
                         window.polaryonHybrid_Rooms.add(disputeUrl);
                     }
                }
            });
        })();
    `;
    const root = document.head || document.documentElement;
    if (root) { root.appendChild(script); script.remove(); }
};
injectSniffer();

let mySessionId = null;
ipcRenderer.on('init-session', (event, { sessionId, config }) => {
    mySessionId = sessionId;
    if (config.vault && config.vault.itemsConfig) {
        window.polaryonStrategies = config.vault.itemsConfig;
    }
    if (window.polaryonAuthBearer) startHybridEngine();
});
