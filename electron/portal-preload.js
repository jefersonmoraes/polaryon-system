(function() {
    const { ipcRenderer } = require('electron');

    ipcRenderer.invoke('get-app-version').then(v => {
        console.log(`%c[POLARYON] Escuta-Geral v${v} Ativado! 🛰️`, "color: #00ff00; font-weight: bold;");
    }).catch(() => {
        console.log("%c[POLARYON] Escuta-Geral Ativado! 🛰️", "color: #00ff00; font-weight: bold;");
    });

    // Compartilhamento de Estado CORS-Safe entre Frames (v3.6.90)
    let shared = {
        sessionToken: '',
        synchronizedPurchases: new Set()
    };
    try {
        if (window.top) {
            if (!window.top._polaryonSharedState) {
                window.top._polaryonSharedState = {
                    sessionToken: '',
                    synchronizedPurchases: new Set()
                };
            }
            shared = window.top._polaryonSharedState;
        }
    } catch (e) {
        // Ignora erro de cross-origin e usa o estado local isolado
    }

    // Ativamente busca o token da sessão do processo principal Electron (Evita Race Condition)
    ipcRenderer.invoke('get-login-token').then(token => {
        if (token) {
            shared.sessionToken = token;
            console.log("%c[POLARYON] Token recuperado ativamente no startup!", "color: #ff00ff; font-size: 11px;");
        }
    }).catch(() => {});

    // AUTOMATIZADOR DE FILTRO: Seleciona "Disputa" automaticamente se estiver em outra opção (v3.6.86)
    // Garante que o usuário sempre seja guiado para a lista de disputas sem precisar de cliques manuais
    setInterval(() => {
        try {
            // 1. Procura por elemento <select> padrão do portal
            const selects = document.querySelectorAll('select');
            selects.forEach(select => {
                const options = Array.from(select.options);
                const hasDisputa = options.some(opt => opt.text.includes('Disputa') || opt.value === '4');
                if (hasDisputa && select.value !== '4') {
                    select.value = '4';
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('%c[POLARYON AUTOMATION] Filtro "Disputa" selecionado via <select>!', 'color: #10b981; font-weight: bold;');
                }
            });

            // 2. Procura por botões de dropdown customizados (Bootstrap/Angular / JSF / Material)
            const allToggles = Array.from(document.querySelectorAll('.dropdown-toggle, .ui-select-toggle, [data-toggle="dropdown"], .mat-select-trigger, .br-select, .ui-select-match, button, div'));
            const dropdownToggles = allToggles.filter(toggle => {
                const className = (toggle.className || '').toLowerCase();
                const tagName = toggle.tagName.toLowerCase();
                if (tagName === 'button' || tagName === 'div') {
                    return className.includes('select') || className.includes('dropdown') || className.includes('filtro') || className.includes('toggle') || className.includes('ui-select');
                }
                return true;
            });
            dropdownToggles.forEach(toggle => {
                const text = toggle.innerText || '';
                // Se for o botão principal do filtro de status e não estiver na Disputa
                if ((text.includes('Todas') || text.includes('Em andamento') || text.includes('Filtro') || text.includes('Situação') || text.includes('Situacao')) && !text.includes('Disputa')) {
                    toggle.click();
                    setTimeout(() => {
                        const options = Array.from(document.querySelectorAll('.dropdown-menu a, .ui-select-choices-row, mat-option, .dropdown-item, li, span, button, .ui-select-choices-row-inner'));
                        const disputaOpt = options.find(opt => opt.innerText.trim() === 'Disputa');
                        if (disputaOpt) {
                            disputaOpt.click();
                            console.log('%c[POLARYON AUTOMATION] Filtro "Disputa" selecionado via Custom Dropdown!', 'color: #10b981; font-weight: bold;');
                        }
                    }, 300);
                }
            });
        } catch (e) {
            // Silencioso para não poluir
        }
    }, 4000);

    // AUTOMATIZADOR DE SALA: Abre automaticamente as disputas clicando no botão [+] (v3.6.91)
    // Garante que o robô acesse e carregue os itens das salas ativas em disputa sem intervenção humana
    setInterval(() => {
        try {
            // Busca por todos os botões, links, spans ou divs que representam o [+] de abertura
            const allElements = Array.from(document.querySelectorAll('button, a, div, span, mat-icon'));
            allElements.forEach(el => {
                const text = (el.innerText || el.textContent || '').trim();
                const className = (el.className || '').toLowerCase();
                const title = (el.getAttribute('title') || el.getAttribute('aria-label') || '').toLowerCase();
                
                // Critérios para identificar o botão [+] azul do card:
                // 1. O texto do botão/ícone é exatamente "+"
                // 2. Ou possui título como "abrir", "acessar", "detalhar", "visualizar"
                // 3. Ou possui classes CSS de ícone de mais (plus)
                const isPlusButton = (text === '+' || 
                                      className.includes('fa-plus') || 
                                      className.includes('glyphicon-plus') || 
                                      className.includes('plus-button') ||
                                      title.includes('abrir') || 
                                      title.includes('acessar') || 
                                      title.includes('detalhar') || 
                                      title.includes('visualizar'));

                if (isPlusButton) {
                    // Evita clique duplo/múltiplo se o botão já foi clicado ou se o card já está aberto
                    // (geralmente quando expandido o texto muda para "-" ou a classe ganha "active"/"open")
                    if (text === '-' || className.includes('minus') || className.includes('active') || className.includes('open')) {
                        return; 
                    }

                    // Verifica se o elemento ou seu botão pai possui alguma marcação de já clicado temporária
                    if (el._polaryonClicked || (el.parentElement && el.parentElement._polaryonClicked)) {
                        return;
                    }

                    console.log('%c[POLARYON AUTOMATION] 🔓 Abrindo itens da disputa automaticamente clicando no botão [+]', 'color: #10b981; font-weight: bold;');
                    el._polaryonClicked = true;
                    if (el.parentElement) el.parentElement._polaryonClicked = true;
                    
                    el.click();
                }
            });
        } catch (e) {
            // Silencioso
        }
    }, 3000);

    // 🛡️ Recebe e armazena o token de sessão capturado pelo Visual Runner
    ipcRenderer.on('force-token-injection', (event, data) => {
        if (data && data.token) {
            shared.sessionToken = data.token;
            console.log("%c[POLARYON] Token de Combate Armado e Pronto!", "color: #ff00ff; font-size: 11px;");
        }
    });

    // 🎯 O GATILHO KAMIKAZE: Envia o lance utilizando o Bypass de Captcha do Siga
    ipcRenderer.on('manual-bid', async (event, { purchaseId, itemId, value }) => {
        console.log(`%c[POLARYON TÁTICO] Iniciando Sequência de Disparo - Item: ${itemId} | Valor: R$ ${value}`, "color: #ffaa00; font-weight: bold;");
        
        if (!shared.sessionToken) {
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
                    'Authorization': shared.sessionToken,
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

        if (url.includes('/participacoes')) {
            // 🔥 FILTRO INTELIGENTE: Ignora abas "Em Andamento" (situacao=2) ou "Agendadas" (situacao=1) 
            // e foca unicamente nas salas ativas em disputa (situacao=3 ou situacao=EM_DISPUTA)
            const isDisputaQuery = url.includes('situacao=3') || url.includes('situacao=EM_DISPUTA') || url.includes('fase=disputa') || url.includes('situacao=disputa');
            const hasOtherFilters = url.includes('situacao=1') || url.includes('situacao=2') || url.includes('situacao=4') || url.includes('situacao=AGENDADA') || url.includes('situacao=EM_ANDAMENTO');
            
            if (hasOtherFilters && !isDisputaQuery) {
                console.log(`%c[POLARYON] Ignorando participações fora da aba de Disputa Ativa: ${url}`, "color: #94a3b8; font-size: 10px; font-weight: bold;");
                return;
            }

            const listObj = Array.isArray(data) ? data : (data.itens || []);
            listObj.forEach(p => {
                // Filtro individual por item (situacaoCompra = 3 significa em disputa)
                const isItemDisputa = p.situacaoCompra === undefined || p.situacaoCompra === null || String(p.situacaoCompra) === '3';
                if (!isItemDisputa) return;

                if (p.compra && p.compra.numeroUasg && p.compra.numero) {
                    const uasg = p.compra.numeroUasg;
                    const numero = p.compra.numero;
                    const ano = p.compra.ano;
                    const modalityCode = String(p.compra.modalidade || '6').padStart(2, '0');
                    const purchaseId = `${uasg}${modalityCode}${String(numero).padStart(5, '0')}${ano}`;
                    
                    if (!shared.synchronizedPurchases.has(purchaseId)) {
                        shared.synchronizedPurchases.add(purchaseId);
                        console.log(`%c[POLARYON DETECTOR] Sala de Participação Ativa Detectada: ${purchaseId}`, "color: #10b981; font-weight: bold;");
                        
                        // Notifica o processo Electron principal sobre a nova sala
                        ipcRenderer.send('portal-detected-room', { url: `compra=${purchaseId}` });
                    }
                }
            });
        } else {
            const jsonStr = JSON.stringify(data || {});
            const discoveredIds = jsonStr.match(/\b\d{17}\b/g);
            if (discoveredIds && discoveredIds.length > 0) {
                discoveredIds.forEach(purchaseId => {
                    if (!shared.synchronizedPurchases.has(purchaseId)) {
                        shared.synchronizedPurchases.add(purchaseId);
                        console.log(`%c[POLARYON DETECTOR] Nova sala detectada por varredura de rede: ${purchaseId}`, "color: #10b981; font-weight: bold;");
                        
                        // Notifica o processo Electron principal sobre a nova sala
                        ipcRenderer.send('portal-detected-room', { url: `compra=${purchaseId}` });
                    }
                });
            }
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
                        officialMargin: it.variacaoMinimaEntreLances || 1,
                        officialMarginType: it.tipoVariacaoMinimaEntreLances || 'V',
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
                shared.sessionToken = token;
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

    // SCANNER DE DOM EM TEMPO REAL PARA CAPTURAR COMPRAS RENDERIZADAS PELO SERVIDOR (v3.6.89)
    // Varre a página a cada 2 segundos procurando por cards de compras e UASGs renderizadas diretamente via HTML (JSF/Server-side)
    setInterval(() => {
        try {
            // 1. Captura direta de IDs de 17 dígitos em atributos HTML (data-id, click, scripts, etc.)
            const html = document.documentElement.innerHTML || '';
            const discoveredIds = html.match(/\b\d{17}\b/g);
            if (discoveredIds && discoveredIds.length > 0) {
                discoveredIds.forEach(purchaseId => {
                    if (!shared.synchronizedPurchases.has(purchaseId)) {
                        shared.synchronizedPurchases.add(purchaseId);
                        console.log(`%c[POLARYON DOM] Sala Detectada via Código HTML: ${purchaseId}`, "color: #10b981; font-weight: bold;");
                        
                        // Notifica o processo Electron principal sobre a nova sala
                        ipcRenderer.send('portal-detected-room', { url: `compra=${purchaseId}` });
                    }
                });
            }

            // 2. Captura lógica baseada nos cards de compra renderizados na tela (Segmentação por Modalidade - v3.6.89)
            const bodyText = document.body ? document.body.innerText : '';
            const segments = bodyText.split(/(DISPENSA\s+ELETRÔNICA|DISPENSA\s+ELETRONICA|DISPENSA|PREGÃO|PREGAO|CONCORRÊNCIA|CONCORRENCIA|INEXIGIBILIDADE|COTAÇÃO|COTACAO)/i);
            
            for (let i = 1; i < segments.length; i += 2) {
                const modalidadeText = segments[i];
                const blockText = segments[i + 1] || '';
                
                const editalMatch = blockText.match(/Nº\s*(\d+)\/(\d{4})/i);
                // Busca qualquer número de 5 ou 6 dígitos (que representa a UASG na estrutura do card) independente de traços/hifens
                const uasgMatch = blockText.match(/\b(\d{5,6})\b/);
                
                if (editalMatch && uasgMatch) {
                    const editalNum = editalMatch[1];
                    const ano = editalMatch[2];
                    const uasg = uasgMatch[1];
                    
                    let modalidade = '06'; // Padrão Dispensa Eletrônica
                    if (modalidadeText.toUpperCase().includes('PREGÃO') || modalidadeText.toUpperCase().includes('PREGAO')) {
                        modalidade = '05';
                    }
                    
                    const numStr = String(editalNum).padStart(5, '0');
                    const purchaseId = `${uasg}${modalidade}${numStr}${ano}`;
                    
                    if (!shared.synchronizedPurchases.has(purchaseId)) {
                        shared.synchronizedPurchases.add(purchaseId);
                        console.log(`%c[POLARYON DOM] Sala Detectada via Segmentação: ${purchaseId} (UASG: ${uasg} | Edital: ${editalNum}/${ano})`, "color: #10b981; font-weight: bold;");
                        
                        // Notifica o processo Electron principal sobre a nova sala
                        ipcRenderer.send('portal-detected-room', { url: `compra=${purchaseId}` });
                    }
                }
            }
        } catch (e) {
            console.error("[POLARYON DOM SCANNER] Falha na varredura:", e);
        }
    }, 2000);

    // LOOP DE FUNDO DE AUTO-SINCRONIZAÇÃO EM TEMPO REAL COM PREVENÇÃO DE 429 (v3.6.89)
    // Distribui as consultas em Round-Robin (1 sala a cada 3 segundos) para nunca sobrecarregar a API do Serpro
    let currentIndex = 0;
    setInterval(async () => {
        if (!shared.sessionToken || shared.synchronizedPurchases.size === 0) return;
        
        const purchaseIds = Array.from(shared.synchronizedPurchases);
        const purchaseId = purchaseIds[currentIndex % purchaseIds.length];
        currentIndex++;

        try {
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': shared.sessionToken,
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                }
            });

            if (res.ok) {
                const data = await res.json();
                processSerproData(data, url);
            } else if (res.status === 401 || res.status === 403) {
                console.warn(`[POLARYON LOOP] ⚠️ Erro de autenticação (${res.status}) na sala ${purchaseId}. Resetando token e solicitando re-autenticação.`);
                shared.sessionToken = '';
                ipcRenderer.send('portal-error', {
                    sessionId: 'GLOBAL',
                    error: 'Sessão Expirada. Por favor, reautentique com o Gov.br.',
                    code: res.status,
                    action: 'REQUIRE_REAUTH'
                });
            } else if (res.status === 422 || res.status === 404) {
                // Auto-limpeza defensiva: se o Serpro retornar que a sala é inválida/inexistente ou já encerrou, removemos do radar
                shared.synchronizedPurchases.delete(purchaseId);
                console.warn(`[POLARYON LOOP] 🛡️ Sala auto-removida por inatividade (${res.status}): ${purchaseId}`);
            }
        } catch (e) {
            console.error(`[POLARYON LOOP] Falha ao atualizar sala ${purchaseId}:`, e);
        }
    }, 3000);
})();
