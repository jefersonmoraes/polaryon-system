const { ipcRenderer } = require('electron');

console.log("👻 [POLARYON] Script de Preload Carregado com SUCESSO!");

window.polaryonStrategies = {};
window.polaryonAuthBearer = null;

// 💉 RECEPTOR DE TOKEN FORÇADO (Via Dashboard)
ipcRenderer.on('force-token-injection', (event, { token }) => {
    if (token && token !== window.polaryonAuthBearer) {
        console.log("%c🚀 [POLARYON] Token Injetado via Sifão!", "color: yellow; font-weight: bold;");
        window.polaryonAuthBearer = token;
        if (!window.polaryonHybrid_Active) startHybridEngine();
    }
});

// ⚙️ RECEPTOR DE CONFIGURAÇÃO DE ITENS (Play/Pause, Margem, Estratégia)
ipcRenderer.on('update-config', (event, config) => {
    if (config.itemsConfig) {
        window.polaryonStrategies = { ...window.polaryonStrategies, ...config.itemsConfig };
        console.log("🛠️ [POLARYON] Estratégias Atualizadas:", window.polaryonStrategies);
    }
});

// 🧠 APRENDIZAGEM FORÇADA DE SALAS (Via Dashboard)
ipcRenderer.on('force-room-learning', (event, { purchaseId }) => {
    if (purchaseId) {
        if (!window.polaryonHybrid_Rooms) window.polaryonHybrid_Rooms = new Set();
        const roomUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${purchaseId}/itens`;
        const disputeUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
        
        if (!window.polaryonHybrid_Rooms.has(roomUrl)) {
            console.log(`%c🧠 [POLARYON] Aprendida nova sala via tráfego: ${purchaseId}`, "color: orange; font-weight: bold;");
            window.polaryonHybrid_Rooms.add(roomUrl);
            window.polaryonHybrid_Rooms.add(disputeUrl);
        }
    }
});

// 🛡️ MODO HÍBRIDO: INJEÇÃO DO "FANTASMA"
window.addEventListener("message", (event) => {
    if (event.source === window && event.data && event.data.type === 'POLARYON_HYBRID_SPY') {
        const payload = event.data.payload;
        ipcRenderer.send('portal-hybrid-capture', { sessionId: mySessionId || 'UNKNOWN', action: payload.action, data: payload });
        
        if (payload.action === 'TOKEN_GRABBED') {
             console.log("%c👻 [POLARYON] Token Capturado via Sniffer!", "color: lime; font-weight: bold;");
             window.polaryonAuthBearer = payload.token;
             if (!window.polaryonHybrid_Active) startHybridEngine();
        }
    }
}, false);

const sendBid = async (purchaseId, itemId, value) => {
    const auth = window.polaryonAuthBearer;
    if (!auth) return;

    console.log(`%c🎯 [POLARYON] DISPARANDO LANCE: R$ ${value} no Item ${itemId}`, "color: #ff00ff; font-weight: bold;");
    
    try {
        const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': auth,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ valorAjustado: value })
        });

        if (res.ok) {
            console.log(`%c✅ [POLARYON] Lance de R$ ${value} ACEITO pelo Portal!`, "color: lime; font-weight: bold;");
        } else {
            const err = await res.text();
            console.error(`❌ [POLARYON] Erro ao enviar lance:`, err);
        }
    } catch (e) {
        console.error(`❌ [POLARYON] Falha na rede ao enviar lance:`, e);
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
                    // 1. BUSCA DE ITENS
                    let allFetchedItems = [];
                    const targetUrls = window.polaryonHybrid_Rooms ? Array.from(window.polaryonHybrid_Rooms) : [];
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

                    // 2. SINCRONIZAÇÃO E LANCE AUTOMÁTICO
                    if (allFetchedItems.length > 0) {
                        if (!window.polaryonAllItems) window.polaryonAllItems = {};
                        
                        for (const item of allFetchedItems) {
                            const rawId = item.identificador || item.numero.toString();
                            const pId = item.polaryon_purchaseId;
                            const vAtual = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                            const vMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
                            const pos = String(item.posicaoParticipanteDisputa || '').trim().toUpperCase();
                            const isWin = (pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°') || (vMeu > 0 && vMeu <= vAtual);
                            const isDispute = item.situacao === '1' || item.situacao === '2';

                            window.polaryonAllItems[rawId] = {
                                itemId: rawId,
                                purchaseId: pId,
                                valorAtual: vAtual,
                                meuValor: vMeu,
                                isDispute: isDispute,
                                timerSeconds: item.segundosParaEncerramento || 0,
                                desc: item.descricao || ("Item " + rawId),
                                ganhador: isWin ? 'Você' : 'Outro',
                                status: isDispute ? 'Disputa' : 'Encerrado'
                            };

                            // --- GATILHO DE LANCE AUTOMÁTICO ---
                            const strat = window.polaryonStrategies[rawId];
                            if (strat && strat.active && isDispute && !isWin && vAtual > 0) {
                                let shouldBid = false;
                                let nextValue = vAtual - (strat.decrementValue || 1);

                                if (strat.mode === 'follower') shouldBid = true;
                                if (strat.mode === 'sniper' && (item.segundosParaEncerramento < 30)) shouldBid = true;
                                if (strat.mode === 'shadow') { shouldBid = true; nextValue = vAtual - 0.01; }

                                if (shouldBid && nextValue >= (strat.minPrice || 0) && nextValue < vMeu) {
                                    await sendBid(pId, rawId, nextValue);
                                    // Aguarda um pouco para não floodar
                                    await new Promise(r => setTimeout(r, 500));
                                }
                            }
                        }

                        ipcRenderer.send('portal-update', { sessionId: mySessionId || 'UNKNOWN', items: Object.values(window.polaryonAllItems), turbo: true });
                    }

                    const hasCritical = allFetchedItems.some(i => i.situacao === '1' || i.situacao === '2');
                    setTimeout(pollingLoop, hasCritical ? 150 : 1000);
         } catch(e) { setTimeout(pollingLoop, 2000); }
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
                return res;
            };
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
