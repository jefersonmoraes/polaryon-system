const { ipcRenderer } = require('electron');

// 🔍 FUNÇÃO DE SCRAPING GLOBAL (v3.5.78)
const scrapeTimerFromDOM = () => {
    try {
        const allTextElements = document.querySelectorAll('span, p, label, div.cp-valor-item, .ng-star-inserted');
        for (const el of Array.from(allTextElements)) {
            const text = el.textContent || '';
            if (!text.includes(':')) continue;
            let dateStr = '', timeStr = '';
            const matchA = text.match(/(\d{2}\/\d{2}\/\d{4}).*at[eé]\s+(\d{2}:\d{2}(?::\d{2})?)/i);
            if (matchA) { dateStr = matchA[1]; timeStr = matchA[2]; }
            else {
                const matchB = text.match(/at[eé]\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/i);
                if (matchB) { dateStr = matchB[1]; timeStr = matchB[2]; }
            }
            if (dateStr && timeStr) {
                const [day, month, year] = dateStr.split('/');
                const timeParts = timeStr.split(':');
                const endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(timeParts[0]), parseInt(timeParts[1]), timeParts[2] ? parseInt(timeParts[2]) : 0);
                const diff = Math.floor((endDate.getTime() - Date.now()) / 1000);
                if (diff > 0) return diff;
            }

            // ⏱️ NOVO: Captura de Countdown Direto (MM:SS ou HH:MM:SS)
            const matchCountdown = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (matchCountdown && !text.includes('/') && (el.classList.contains('relogio') || el.classList.contains('timer') || el.id.includes('relogio') || el.id.includes('timer') || el.className.includes('cp-valor-item'))) {
                const h = matchCountdown[3] ? parseInt(matchCountdown[1]) : 0;
                const m = matchCountdown[3] ? parseInt(matchCountdown[2]) : parseInt(matchCountdown[1]);
                const s = matchCountdown[3] ? parseInt(matchCountdown[3]) : parseInt(matchCountdown[2]);
                const total = (h * 3600) + (m * 60) + s;
                if (total > 0 && total < 3600) return total; 
            }
        }
    } catch (e) { }
    return 0;
};

// ⏱️ SINCRONIA DE TEMPO REAL
setInterval(() => {
    if (window.polaryonHybrid_Active) {
        const domTime = scrapeTimerFromDOM();
        if (domTime > 0) window.polaryonLastSyncTime = domTime;
    }
}, 1000);

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
ipcRenderer.on('manual-bid', async (event, { purchaseId, itemId, bidId, value, options }) => {
    await sendBid(purchaseId, itemId, bidId, value, options);
});

// 🕵️ MOTOR DE DIAGNÓSTICO E SINCRONIA (v3.5.72)
if (!window.polaryonSnifferInjected) {
    window.polaryonSnifferInjected = true;
    window.polaryonServerOffset = 0;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('/lances')) {
            console.log("%c📡 [SNIFFER FETCH] Detectado!", "color: #ff00ff; font-weight: bold;");
            if (args[1]?.body) console.log("📦 PAYLOAD:", JSON.parse(args[1].body));
        }
        return await originalFetch(...args);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (url.includes('/lances')) {
            const originalSend = this.send;
            this.send = function(body) {
                console.log("%c📡 [SNIFFER XHR] Detectado!", "color: #00ffff; font-weight: bold;");
                console.log("📦 PAYLOAD XHR:", JSON.parse(body));
                return originalSend.apply(this, arguments);
            };
        }
        return originalOpen.apply(this, arguments);
    };
}

const sendBid = async (purchaseId, itemNum, bidId, value, options = {}) => {
    const auth = window.polaryonAuthBearer;
    if (!auth) return console.error("❌ Token ausente.");

    const getFreshItem = (id) => {
        const cache = window.polaryonAllItems || {};
        return cache[String(id)] || Object.values(cache).find(i => String(i.numero) === String(id) || String(i.identificador) === String(id));
    };

    try {
        const strat = window.polaryonStrategies[itemNum];
        const decimals = options.allow4 || strat?.useFourDecimals ? 4 : 2;
        const valFormatted = Number(Number(value).toFixed(decimals));
        const item = getFreshItem(bidId || itemNum);
        
        // 🛠️ CORREÇÃO DE ENDEREÇAMENTO (v3.5.87)
        // Usamos o bidId (ID interno do Serpro) como prioridade absoluta para a URL
        const targetId = bidId || item?.bidId || item?.itemId || itemNum;
        const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${targetId}/lances?configs=false&captcha1=${options.captcha || ''}&captcha2=&captcha3=`;

        // 🛡️ PAYLOAD RÉPLICA HUMANA (v3.5.72) - Especial para Dispensa Eletrônica
        // Baseado no log capturado: { valorInformado: 990, faseItem: "LA" }
        const payload = {
            valorInformado: valFormatted,
            faseItem: "LA"
        };

        console.log(`🚀 [POLARYON] DISPARANDO (RÉPLICA HUMANA):`, payload);

        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': auth, 
                'Content-Type': 'application/json', 
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2 Chrome/112.0.5615.165 Electron/24.1.3 Safari/537.36'
            },
            body: JSON.stringify(payload)
        });

        const responseData = await res.json().catch(() => ({}));
        if (res.ok) {
            console.log(`✅ LANCE ACEITO: R$ ${valFormatted}`);
        } else {
            console.error(`❌ REJEITADO (Mesmo com payload réplica):`, responseData);
            
            // 🔄 FALLBACK: Se falhar com o payload de dispensa, tenta o payload completo (Shotgun)
            if (responseData?.message?.includes("incluirLanceCommand") || res.status === 400) {
                console.warn("⚠️ Detectado erro de comando completo. Tentando Payload Shotgun...");
                const fullPayload = {
                    valor: valFormatted,
                    valorAjustado: valFormatted,
                    identificadorItem: String(item?.identificador || bidId || itemNum),
                    faseItem: "LA",
                    versaoItem: Number(item?.versaoItem || 1),
                    versaoParticipante: Number(item?.versaoParticipante || 1),
                    tipoLance: 'V',
                    dataHoraLance: new Date().toISOString()
                };
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullPayload)
                });
            }

            // 🛡️ NOVO: AUTO-CORREÇÃO PARA ERRO 422 (Intervalo Mínimo)
            if (res.status === 422 && responseData?.message?.includes("intervalo mínimo")) {
                console.warn("🚨 [AUTO-FIX] Erro de Intervalo Mínimo. Ajustando lance...");
                const margin = item?.officialMargin || 0.01;
                const best = item?.valorAtual || 0;
                if (best > 0) {
                    const correctedValue = Number((best - margin).toFixed(decimals));
                    console.log(`♻️ Tentando novamente com valor corrigido: R$ ${correctedValue}`);
                    // Chama recursivamente sendBid com o valor corrigido
                    await sendBid(purchaseId, itemNum, bidId, correctedValue);
                }
            }
        }
    } catch (e) {
        console.error(`❌ Erro:`, e);
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
                            const finalUrl = baseUrl.includes('?') ? `${baseUrl}&configs=false&captcha1=&captcha2=&captcha3=` : `${baseUrl}?configs=false&captcha1=&captcha2=&captcha3=`;
                            const res = await fetch(finalUrl, { headers: { 'Authorization': authHeader, 'Accept': 'application/json', 'User-Agent': 'SIGAClient/0.7.2' } });
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
                             
                             // 🏆 CAPTURA DE POSIÇÃO ULTRA-ROBUSTA (v3.5.95)
                             let pos = String(item.posicaoParticipanteDisputa || item.posicao || item.classificacao || '').trim().toUpperCase();
                             
                             // Fallback: Se a posição estiver vazia, tenta buscar no DOM
                              if (!pos || pos === '0' || pos === '?') {
                                 const rows = Array.from(document.querySelectorAll('tr, .cp-item-row, .ng-star-inserted'));
                                 const itemRow = rows.find(r => r.textContent.includes(`Item ${rawId}`) || r.textContent.includes(`Item: ${rawId}`));
                                 if (itemRow) {
                                     const posCell = itemRow.querySelector('.col-posicao, [title="Posição"], td:nth-child(2), .posicao-label, .cp-posicao, .classificacao');
                                     if (posCell) pos = posCell.textContent.trim().replace('º', '').replace('°', '');
                                 }
                              }

                             const currentTitle = document.querySelector('.br-header-title')?.textContent?.trim() || 
                                     document.querySelector('.titulo-servico')?.textContent?.trim() || 
                                     document.querySelector('h1')?.textContent?.trim() ||
                                     document.querySelector('.breadcrumb')?.textContent?.replace(/\s+/g, ' ').trim() ||
                                     document.title;

                             const isWin = (pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°') || (vMeu > 0 && vMeu <= vAtual);
                             const isDispute = item.situacao === '1' || item.situacao === '2';

                            // 🎯 CAPTURA DE MARGEM OFICIAL (Intervalo Mínimo)
                            const intervalValue = item.intervaloMinimoEntreLances || 1;
                            const intervalType = item.tipoIntervaloLance === 2 ? 'percentage' : 'fixed';

                                let rawSeconds = item.segundosParaEncerramento ?? 
                                                 item.segundosEncerramento ?? 
                                                 item.segundosRestantes ?? 
                                                 item.tempoRestante ?? 
                                                 item.segundosRestantesParaFimFase ??
                                                 (item.disputaItem?.segundosParaEncerramento) ?? 
                                                 (item.situacaoItem?.segundosParaEncerramento) ?? 0;

                                // 📅 FALLBACK POR DATA (Se os segundos falharem)
                                if (!rawSeconds || rawSeconds <= 0) {
                                    const dataFim = item.dataFimFase || item.dataHoraFimFase || (item.disputaItem?.dataHoraFimFase);
                                    if (dataFim) {
                                        const now = new Date().getTime();
                                        const end = new Date(dataFim).getTime();
                                        if (end > now) {
                                            rawSeconds = Math.floor((end - now) / 1000);
                                        }
                                    }
                                }

                                // 🕵️‍♂️ ÚLTIMA INSTÂNCIA: SCRAPER DE TELA (v3.5.78)
                                if (!rawSeconds || rawSeconds <= 0) {
                                    rawSeconds = scrapeTimerFromDOM();
                                }

                                window.polaryonAllItems[rawId] = {
                                    itemId: rawId,
                                    bidId: bidId,
                                    purchaseId: pId,
                                    valorAtual: vAtual,
                                    meuValor: vMeu,
                                    isDispute: isDispute,
                                    timerSeconds: Number(rawSeconds),
                                    desc: item.descricao || ("Item " + rawId),
                                    ganhador: isWin ? 'Você' : 'Outro',
                                    status: isDispute ? 'Disputa' : 'Encerrado',
                                    officialMargin: intervalValue,
                                    officialMarginType: intervalType,
                                    posicao: pos
                                };

                                // 🚀 BROADCAST EM TEMPO REAL (v3.5.95)
                                let num = '---', ano = '---';
                                const urlMatch = window.location.href.match(/compra=(\d{6})06(\d{5})(\d{4})/);
                                if (urlMatch) {
                                    num = parseInt(urlMatch[2], 10).toString();
                                    ano = urlMatch[3];
                                }

                                ipcRenderer.send('portal-update', { 
                                    items: Object.values(window.polaryonAllItems),
                                    sessionTitle: currentTitle,
                                    uasg: pId,
                                    numero: num,
                                    ano: ano
                                });

                            const strat = window.polaryonStrategies[rawId];
                            if (strat && strat.active && isDispute && !isWin && vAtual > 0) {
                                let marginToUse = strat.decrementValue || intervalValue;
                                if (strat.decrementType === 'percentage' || intervalType === 'percentage') {
                                    const perc = strat.decrementType === 'percentage' ? strat.decrementValue : intervalValue;
                                    marginToUse = vAtual * (perc / 100);
                                }

                                let nextValue = vAtual - marginToUse;
                                if (strat.mode === 'follower') {
                                    if (nextValue >= (strat.minPrice || 0) && nextValue < vMeu) {
                                        // 🧨 LÓGICA KAMIKAZE: Sem delay se faltar pouco tempo ou se forçado
                                        const secondsLeft = Number(item.segundosParaEncerramento || 0);
                                        const isKamikaze = strat.kamikazeMode || (secondsLeft > 0 && secondsLeft < 3);
                                        
                                        if (isKamikaze) {
                                            console.log("%c🧨 [KAMIKAZE] Disparo imediato!", "color: red; font-weight: bold;");
                                        } else {
                                            await new Promise(r => setTimeout(r, 100 + Math.random() * 200)); // Delay humano reduzido
                                        }

                                        await sendBid(pId, rawId, bidId, nextValue);
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

// 🔄 SINCRONIZAÇÃO DE TIMER EM SEGUNDO PLANO (v3.5.78)
setInterval(() => {
    if (window.polaryonAllItems) {
        const emergencySeconds = scrapeTimerFromDOM();
        if (emergencySeconds > 0) {
            Object.keys(window.polaryonAllItems).forEach(id => {
                if (!window.polaryonAllItems[id].timerSeconds || window.polaryonAllItems[id].timerSeconds <= 0) {
                    window.polaryonAllItems[id].timerSeconds = emergencySeconds;
                }
            });
        }
    }
}, 5000);
