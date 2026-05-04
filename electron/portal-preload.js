const { ipcRenderer } = require('electron');

console.log("👻 [POLARYON] Script de Preload Carregado com SUCESSO!");

// 💉 RECEPTOR DE TOKEN FORÇADO (Via Dashboard)
ipcRenderer.on('force-token-injection', (event, { token }) => {
    if (token && token !== window.polaryonAuthBearer) {
        console.log("%c🚀 [POLARYON] Token Injetado via Sifão!", "color: yellow; font-weight: bold;");
        window.polaryonAuthBearer = token;
        if (!window.polaryonHybrid_Active) startHybridEngine();
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

const startHybridEngine = () => {
    if (window.polaryonHybrid_Active) return;
    window.polaryonHybrid_Active = true;
    console.log("%c🔥 [POLARYON] Motor de Combate Iniciado.", "color: cyan; font-weight: bold;");

    const pollingLoop = async () => {
         const authHeader = window.polaryonAuthBearer;
         if (!authHeader) { setTimeout(pollingLoop, 2000); return; }

         try {
                    // 1. DESCOBERTA AGRESSIVA (OPCIONAL SE O TRÁFEGO JÁ ENSINOU)
                    if (!window.polaryonLastDiscovery || Date.now() - window.polaryonLastDiscovery > 12000) {
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
                                        let pId = cert.compra || cert.id || cert.codigoCompra || cert.identificador;
                                        if (pId && pId.toString().length < 10) {
                                            const uasg = (cert.uasg || cert.codigoUasg || '0').toString().padStart(6, '0');
                                            const mod = (cert.modalidade || '06').toString().padStart(2, '0');
                                            const num = (cert.numero || cert.numeroCompra || '0').toString().padStart(5, '0');
                                            const year = cert.ano || cert.anoCompra || new Date().getFullYear();
                                            pId = `${uasg}${mod}${num}${year}`;
                                        }
                                        if (pId && pId.toString().length >= 10) {
                                            if (!window.polaryonHybrid_Rooms) window.polaryonHybrid_Rooms = new Set();
                                            window.polaryonHybrid_Rooms.add(`https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${pId}/itens`);
                                            window.polaryonHybrid_Rooms.add(`https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${pId}/itens/em-disputa`);
                                        }
                                    });
                                }
                            } catch(e) {}
                        }
                    }

                    // 2. BUSCA DE ITENS
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

                    // 3. SINCRONIZAÇÃO
                    if (allFetchedItems.length > 0) {
                        if (!window.polaryonAllItems) window.polaryonAllItems = {};
                        allFetchedItems.forEach(item => {
                            const rawId = item.identificador || item.numero.toString();
                            const vAtual = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                            const vMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
                            const pos = String(item.posicaoParticipanteDisputa || '').trim().toUpperCase();
                            const isWin = (pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°') || (vMeu > 0 && vMeu <= vAtual);
                            const isDispute = item.situacao === '1' || item.situacao === '2';

                            window.polaryonAllItems[rawId] = {
                                itemId: rawId,
                                valorAtual: vAtual,
                                meuValor: vMeu,
                                isDispute: isDispute,
                                desc: item.descricao || ("Item " + rawId),
                                ganhador: isWin ? 'Você' : 'Outro',
                                status: isDispute ? 'Disputa' : 'Encerrado'
                            };
                        });

                        ipcRenderer.send('portal-update', { sessionId: mySessionId || 'UNKNOWN', items: Object.values(window.polaryonAllItems), turbo: true });
                    }

                    const hasCritical = allFetchedItems.some(i => i.isDispute);
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
    if (window.polaryonAuthBearer) startHybridEngine();
});
