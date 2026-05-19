(function() {
    const { ipcRenderer } = require('electron');

    ipcRenderer.invoke('get-app-version').then(v => {
        console.log(`%c[POLARYON] Escuta-Geral v${v} Ativado! 🛰️`, "color: #00ff00; font-weight: bold;");
    }).catch(() => {
        console.log("%c[POLARYON] Escuta-Geral Ativado! 🛰️", "color: #00ff00; font-weight: bold;");
    });

    let sessionToken = '';
    const synchronizedPurchases = new Set();
    let discoveryInterval = null;

    async function runDiscovery() {
        if (!sessionToken) return;
        try {
            const url = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/participacoes?tamanhoPagina=100&pagina=0&filtro=4';
            const res = await fetch(url, {
                headers: {
                    'Authorization': sessionToken,
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                }
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`%c[POLARYON DISCOVERY] Auto-Descoberta de Salas em Disputa (Encontrado: ${Array.isArray(data) ? data.length : 0})`, "color: #a78bfa; font-weight: bold;");
                processSerproData(data, url);
            }
        } catch (e) {
            console.error("[POLARYON DISCOVERY] Erro ao buscar participações em disputa:", e);
        }
    }

    function triggerAutoDiscovery() {
        if (!sessionToken) return;
        runDiscovery();
        if (discoveryInterval) clearInterval(discoveryInterval);
        discoveryInterval = setInterval(runDiscovery, 30000);
    }

    // 🛡️ Recebe e armazena o token de sessão capturado pelo Visual Runner
    ipcRenderer.on('force-token-injection', (event, data) => {
        if (data && data.token) {
            const oldToken = sessionToken;
            sessionToken = data.token;
            console.log("%c[POLARYON] Token de Combate Armado e Pronto!", "color: #ff00ff; font-size: 11px;");
            if (sessionToken !== oldToken) {
                triggerAutoDiscovery();
            }
        }
    });

    // 🎯 O GATILHO KAMIKAZE: Envia o lance utilizando o Bypass de Captcha do Siga
    ipcRenderer.on('manual-bid', async (event, { purchaseId, itemId, value }) => {
        console.log(`%c[POLARYON TÁTICO] Iniciando Sequência de Disparo - Item: ${itemId} | Valor: R$ ${value}`, "color: #ffaa00; font-weight: bold;");
        
        if (!sessionToken) {
            console.error('[POLARYON] ERRO: Token de Sessão ausente. O robô não interceptou o login ainda.');
            return;
        }

        try {
            // 1. Extração Sombria dos Captchas (Farmados da Nuvem do Siga)
            const capHeaders = { 
                'origin': 'https://disputas.sigapregao.com.br',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2'
            };
            
            const [c1, c2] = await Promise.all([
                fetch('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers: capHeaders }).then(r => r.text()).catch(() => ''),
                fetch('https://capgen.sigapregao.com.br/capgen/captcha-dispensas-2', { headers: capHeaders }).then(r => r.text()).catch(() => '')
            ]);

            // 2. Monta a URL de Ataque do Serpro
            const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances?captcha1=${c1}&captcha2=${c2}&captcha3=${c1}`;

            // 3. Payload do Protocolo Oficial
            const payload = {
                valorInformado: parseFloat(value),
                faseItem: "LA"
            };

            // 4. Disparo Furtivo
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Authorization': sessionToken,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`%c[POLARYON] LANCE DE R$ ${value} ENVIADO COM SUCESSO! 🎯🎯🎯`, "color: #10b981; font-weight: bold; font-size: 16px;");
            } else {
                const errText = await response.text();
                console.error(`%c[POLARYON] LANCE REJEITADO (Status ${response.status}): ${errText}`, "color: #ef4444; font-weight: bold;");
            }
        } catch (e) {
            console.error('[POLARYON] Exceção crítica durante o disparo:', e);
        }
    });

    // -------------------------------------------------------------------------
    // SISTEMA DE INTERCEPTAÇÃO DE REDE (O "ESCUTA-GERAL")
    // -------------------------------------------------------------------------
    function processSerproData(data, url) {
        console.log(`%c[POLARYON] Radar: ${url.split('?')[0]}`, "color: #888; font-size: 10px;");

        // 🔥 EXTRAÇÃO INTELIGENTE DE PARTICIPAÇÕES (v3.6.80)
        if (url.includes('/participacoes')) {
            const list = Array.isArray(data) ? data : [];
            list.forEach(p => {
                if (p.compra) {
                    const { numeroUasg, modalidade, numero, ano } = p.compra;
                    // Mapeia modalidade (geralmente 6 é Dispensa Eletrônica, mas formatamos sempre com 2 dígitos)
                    const modStr = String(modalidade).padStart(2, '0');
                    const numStr = String(numero).padStart(5, '0');
                    const purchaseId = `${numeroUasg}${modStr}${numStr}${ano}`;
                    
                    if (!synchronizedPurchases.has(purchaseId)) {
                        synchronizedPurchases.add(purchaseId);
                        console.log(`%c[POLARYON DETECTOR] Sala Auto-Detectada via Participações: ${purchaseId}`, "color: #10b981; font-weight: bold;");
                        // O loop em Round-Robin carregará esta sala suavemente a cada 3 segundos, prevenindo 429
                    }
                }
            });
        }

        const jsonStr = JSON.stringify(data || {});
        const discoveredIds = jsonStr.match(/\b\d{17}\b/g);
        if (discoveredIds && discoveredIds.length > 0) {
            discoveredIds.forEach(purchaseId => {
                if (!synchronizedPurchases.has(purchaseId)) {
                    synchronizedPurchases.add(purchaseId);
                    console.log(`%c[POLARYON DETECTOR] Nova sala detectada por varredura: ${purchaseId}`, "color: #10b981; font-weight: bold;");
                    // O loop em Round-Robin carregará esta sala suavemente a cada 3 segundos, prevenindo 429
                }
            });
        }

        const items = Array.isArray(data) ? data : (data.itens || []);
        const match = url.match(/\/compras\/(\d+)\//);
        const roomCode = match ? match[1] : null;

        if (items.length > 0 && roomCode) {
            if (typeof ipcRenderer !== 'undefined') {
                ipcRenderer.send('send-portal-data', {
                    type: 'portal-sync',
                    roomCode: roomCode,
                    timestamp: Date.now(),
                    items: items.map(it => ({
                        itemId: String(it.numero || it.identificador),
                        valorAtual: it.melhorValorGeral ? it.melhorValorGeral.valorCalculado : it.melhorLance,
                        meuValor: it.melhorValorFornecedor ? it.melhorValorFornecedor.valorCalculado : it.valorLanceProposta,
                        status: it.faseTraduzido || it.fase,
                        posicao: it.situacaoParticipanteDisputaTraduzido || (it.situacaoParticipanteDisputa === 'G' ? 'GANHANDO' : 'PERDENDO'),
                        timerSeconds: it.segundosParaEncerramento || -1,
                        dataHoraFimContagem: it.dataHoraFimContagem,
                        desc: it.descricao
                    }))
                });
            }
        }
    }

    async function autoFetchPurchaseItems(purchaseId) {
        if (!sessionToken) return;
        try {
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': sessionToken,
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                }
            });
            if (res.ok) {
                const data = await res.json();
                processSerproData(data, url);
            }
        } catch (e) {
            console.error(`[POLARYON] Erro ao sincronizar itens da sala ${purchaseId}:`, e);
        }
    }

    // Escuta as mensagens da página injetada
    window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'polaryon-injector') {
            const { type, token, data, url } = event.data;
            if (type === 'token') {
                const oldToken = sessionToken;
                sessionToken = token;
                if (sessionToken !== oldToken) {
                    triggerAutoDiscovery();
                }
            } else if (type === 'serpro-data') {
                processSerproData(data, url);
            }
        }
    });

    // Injeta o interceptor de rede na página
    try {
        const scriptContent = `
        (function() {
            let sessionToken = '';
            
            function processSerproData(data, url) {
                window.postMessage({
                    source: 'polaryon-injector',
                    type: 'serpro-data',
                    data,
                    url
                }, '*');
            }

            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                if (args[1] && args[1].headers) {
                    const headers = args[1].headers;
                    let auth = '';
                    if (headers instanceof Headers) {
                        auth = headers.get('Authorization') || headers.get('authorization');
                    } else if (typeof headers === 'object') {
                        auth = headers['Authorization'] || headers['authorization'] || headers['Authorization '] || headers['authorization '];
                    }
                    if (auth && auth.toLowerCase().startsWith('bearer')) {
                        sessionToken = auth;
                        window.postMessage({
                            source: 'polaryon-injector',
                            type: 'token',
                            token: sessionToken
                        }, '*');
                    }
                }
                const response = await originalFetch(...args);
                const url = typeof args[0] === 'string' ? args[0] : args[0].url;
                const isSerpro = url.includes('serpro.gov.br') || url.includes('/comprasnet-') || url.includes('/compras/') || window.location.hostname.includes('serpro.gov.br');
                if (isSerpro) {
                    const clone = response.clone();
                    clone.json().then(data => processSerproData(data, url)).catch(() => {});
                }
                return response;
            };

            const open = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
                this._url = url;
                return open.apply(this, arguments);
            };

            const setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
            XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
                if (header.toLowerCase() === 'authorization' && value && value.toLowerCase().startsWith('bearer')) {
                    sessionToken = value;
                    window.postMessage({
                        source: 'polaryon-injector',
                        type: 'token',
                        token: sessionToken
                    }, '*');
                }
                return setRequestHeader.apply(this, arguments);
            };

            const send = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function() {
                this.addEventListener('load', function() {
                    const isSerpro = this._url && (this._url.includes('serpro.gov.br') || this._url.includes('/comprasnet-') || this._url.includes('/compras/') || window.location.hostname.includes('serpro.gov.br'));
                    if (isSerpro) {
                        try {
                            const data = JSON.parse(this.responseText);
                            processSerproData(data, this._url);
                        } catch (e) {}
                    }
                });
                return send.apply(this, arguments);
            };
        })();
        `;
 
        const injectScript = () => {
            const script = document.createElement('script');
            script.textContent = scriptContent;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        };

        if (document.head || document.documentElement) {
            injectScript();
        } else {
            const observer = new MutationObserver(() => {
                if (document.head || document.documentElement) {
                    injectScript();
                    observer.disconnect();
                }
            });
            observer.observe(document, { childList: true, subtree: true });
        }
    } catch (e) {
        console.error("🔴 [POLARYON] Falha ao injetar script de escuta:", e);
    }

    // 🛡️ AUTO-CLICKER DO LOGIN DO GOV.BR (v3.6.60)
    // Se estiver na landing page, executa o clique ou redirecionamento programático para iniciar a autenticação de forma natural e com referrers corretos.
    if (window.location.href.includes('/compras/pt-br') && !window.location.href.includes('@@') && !window.location.href.includes('search')) {
        const autoClickLogin = () => {
            const btn = document.querySelector('.br-sign-in') || 
                        document.querySelector('.sign-in') || 
                        Array.from(document.querySelectorAll('a, button')).find(el => el.textContent && el.textContent.includes('Entrar com gov.br'));
            
            if (btn) {
                console.log('%c[POLARYON] ⚡ Botão/Link de login detectado! Executando clique automático...', 'color: #3b82f6; font-weight: bold;');
                btn.click();
                return true;
            }
            return false;
        };

        if (!autoClickLogin()) {
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (autoClickLogin() || attempts > 50) {
                    clearInterval(interval);
                }
            }, 100);
        }
    }

    // SCANNER DE DOM EM TEMPO REAL PARA CAPTURAR COMPRAS RENDERIZADAS PELO SERVIDOR (v3.6.83)
    // Varre a página a cada 2 segundos procurando por cards de compras e UASGs renderizadas diretamente via HTML (JSF/Server-side)
    setInterval(() => {
        try {
            // 1. Captura direta de IDs de 17 dígitos em atributos HTML (data-id, click, scripts, etc.)
            const html = document.documentElement.innerHTML || '';
            const discoveredIds = html.match(/\b\d{17}\b/g);
            if (discoveredIds && discoveredIds.length > 0) {
                discoveredIds.forEach(purchaseId => {
                    if (!synchronizedPurchases.has(purchaseId)) {
                        synchronizedPurchases.add(purchaseId);
                        console.log(`%c[POLARYON DOM] Sala Detectada via Código HTML: ${purchaseId}`, "color: #10b981; font-weight: bold;");
                    }
                });
            }

            // 2. Captura lógica baseada nos cards de compra renderizados na tela (Híbrido Perfeito)
            const allElements = Array.from(document.querySelectorAll('*'));
            allElements.forEach(el => {
                if (el.children.length > 3) return; // Foca apenas nos elementos de título/célula folha para evitar loops desnecessários
                
                const text = el.innerText || '';
                const editalMatch = text.match(/Nº\s*(\d+)\/(\d{4})/i);
                
                if (editalMatch) {
                    const editalNum = editalMatch[1];
                    const ano = editalMatch[2];
                    
                    // Procura pela UASG subindo até o nível do card (pai/avô) para associar ao edital correspondente
                    let uasg = '';
                    let parentText = '';
                    let current = el;
                    
                    for (let i = 0; i < 3; i++) {
                        if (!current) break;
                        const cText = current.innerText || '';
                        const uMatch = cText.match(/\b(\d{5,6})\s*-\s*/);
                        if (uMatch) {
                            uasg = uMatch[1];
                            parentText = cText;
                            break;
                        }
                        current = current.parentElement;
                    }
                    
                    if (uasg) {
                        let modalidade = '06'; // Padrão Dispensa Eletrônica
                        if (parentText.toUpperCase().includes('PREGÃO') || text.toUpperCase().includes('PREGÃO')) {
                            modalidade = '05';
                        }
                        
                        const numStr = String(editalNum).padStart(5, '0');
                        const purchaseId = `${uasg}${modalidade}${numStr}${ano}`;
                        
                        if (!synchronizedPurchases.has(purchaseId)) {
                            synchronizedPurchases.add(purchaseId);
                            console.log(`%c[POLARYON DOM] Sala Detectada via Layout Híbrido: ${purchaseId} (UASG: ${uasg} | Edital: ${editalNum}/${ano})`, "color: #10b981; font-weight: bold;");
                        }
                    }
                }
            });
        } catch (e) {
            console.error("[POLARYON DOM SCANNER] Falha na varredura:", e);
        }
    }, 2000);

    // LOOP DE FUNDO DE AUTO-SINCRONIZAÇÃO EM TEMPO REAL COM PREVENÇÃO DE 429 (v3.6.83)
    // Distribui as consultas em Round-Robin (1 sala a cada 3 segundos) para nunca sobrecarregar a API do Serpro
    let currentIndex = 0;
    setInterval(async () => {
        if (!sessionToken || synchronizedPurchases.size === 0) return;
        
        const purchaseIds = Array.from(synchronizedPurchases);
        const purchaseId = purchaseIds[currentIndex % purchaseIds.length];
        currentIndex++;

        try {
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': sessionToken,
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                }
            });

            if (res.ok) {
                const data = await res.json();
                processSerproData(data, url);
            } else if (res.status === 401 || res.status === 403) {
                console.warn(`[POLARYON LOOP] ⚠️ Erro de autenticação (${res.status}) na sala ${purchaseId}. Mantendo na fila para re-tentativa quando novo token chegar.`);
            } else if (res.status === 422 || res.status === 404) {
                // Auto-limpeza defensiva: se o Serpro retornar que a sala é inválida/inexistente ou já encerrou, removemos do radar
                synchronizedPurchases.delete(purchaseId);
                console.warn(`[POLARYON LOOP] 🛡️ Sala auto-removida por inatividade (${res.status}): ${purchaseId}`);
            }
        } catch (e) {
            console.error(`[POLARYON LOOP] Falha ao atualizar sala ${purchaseId}:`, e);
        }
    }, 3000);
})();
