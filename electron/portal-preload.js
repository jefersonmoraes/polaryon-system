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
        captchaToken: '',
        synchronizedPurchases: new Set(),
        lastClassificacaoClickTs: 0,
        pendingRankingTarget: null
    };

    // Estabiliza serverOffset com média dos últimos N valores (Date header tem precisão de 1s)
    const offsetHistory = [];
    const OFFSET_SAMPLES = 5;
    function smoothOffset(rawOffset) {
        offsetHistory.push(rawOffset);
        if (offsetHistory.length > OFFSET_SAMPLES) offsetHistory.shift();
        return offsetHistory.reduce((a, b) => a + b, 0) / offsetHistory.length;
    }

    // ⚡ CACHE ROTATIVO DE CAPTCHAS (v3.8.85)
    // Worker agressivo que mantém pool cheio para disparos sem espera.
    const captchaPool = [];
    const CAP_POOL_MAX = 16;
    const CAP_HEADERS = {
        'origin': 'https://disputas.sigapregao.com.br',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2'
    };

    async function prefetchCaptchaPair() {
        if (captchaPool.length >= CAP_POOL_MAX) return;
        try {
            const [c1, c2] = await Promise.all([
                fetch('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers: CAP_HEADERS }).then(r => r.text()).catch(() => ''),
                fetch('https://capgen.sigapregao.com.br/capgen/captcha-dispensas-2', { headers: CAP_HEADERS }).then(r => r.text()).catch(() => '')
            ]);
            if (c1 && c2) {
                captchaPool.push({ c1, c2, ts: Date.now() });
            }
        } catch(e) { /* silencioso */ }
    }

    // Inicia o worker de pré-busca assim que o token de sessão for disponível
    setInterval(() => {
        if (shared.sessionToken) prefetchCaptchaPair();
    }, 150);

    async function getNextCaptcha() {
        // Descarta captchas com mais de 20s (expiram no Serpro)
        while (captchaPool.length > 0 && Date.now() - captchaPool[0].ts > 20000) {
            captchaPool.shift();
        }
        if (captchaPool.length > 0) {
            const pair = captchaPool.shift();
            console.log(`%c[POLARYON CAPTCHA] ⚡ Pool hit! ${captchaPool.length} pares restantes.`, 'color: #a78bfa; font-size: 10px;');
            return pair;
        }
        // Fallback: busca ao vivo se o pool estiver vazio
        console.warn('[POLARYON CAPTCHA] Pool vazio — buscando ao vivo (cold path).');
        const [c1, c2] = await Promise.all([
            fetch('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers: CAP_HEADERS }).then(r => r.text()).catch(() => ''),
            fetch('https://capgen.sigapregao.com.br/capgen/captcha-dispensas-2', { headers: CAP_HEADERS }).then(r => r.text()).catch(() => '')
        ]);
        return { c1, c2 };
    }
    // Staggered room-fetch delay counter (anti-429). Resets after all rooms queued.
    let _roomFetchDelayMs = 0;
    try {
        if (window.top) {
            if (!window.top._polaryonSharedState) {
                window.top._polaryonSharedState = {
                    sessionToken: '',
                    captchaToken: '',
                    synchronizedPurchases: new Set(),
                    lastClassificacaoClickTs: 0,
                    pendingRankingTarget: null
                };
            }
            shared = window.top._polaryonSharedState;
        }
    } catch (e) {
        // Ignora erro de cross-origin e usa o estado local isolado
    }

    ipcRenderer.invoke('get-login-token').then(token => {
        if (token) {
            shared.sessionToken = token;
            console.log("%c[POLARYON] Token recuperado ativamente no startup!", "color: #ff00ff; font-size: 11px;");
        }
    }).catch(err => console.error("[POLARYON] Erro get-login-token:", err));

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

    // 🎯 O GATILHO KAMIKAZE: Envia o lance direto do BrowserView (sem proxy VPS, v3.8.85)
    ipcRenderer.on('manual-bid', async (event, { purchaseId, itemId, value }) => {
        const currentUrl = window.location.href;
        if (!currentUrl.includes(purchaseId)) {
            console.warn(`[POLARYON] ⚠️ purchaseId ${purchaseId} não está na URL atual (${currentUrl.substring(0,60)}). Tentando mesmo assim...`);
            // Tenta mesmo sem bater a URL — o servidor rejeita se estiver errado
        }

        console.log(`%c[POLARYON TÁTICO] Iniciando Sequência de Disparo - Item: ${itemId} | Valor: R$ ${value}`, "color: #ffaa00; font-weight: bold;");
        
        if (!shared.sessionToken) {
            console.error('[POLARYON] ERRO: Token de Sessão ausente. O robô não interceptou o login ainda.');
            return;
        }

        try {
            // 1. Captcha do Pool Rotativo (⚡ instantâneo) com fallback ao vivo
            const { c1, c2 } = await getNextCaptcha();

            // 2. Monta URL de ataque direto ao Serpro (sem passar pela VPS)
            const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances?captcha1=${c1}&captcha2=${c2}&captcha3=${c1}`;
            const payload = { valorInformado: parseFloat(value), faseItem: "LA" };

            console.log(`%c[POLARYON] 🚀 Disparando lance de R$ ${value} no Item ${itemId} direto do BrowserView...`, "color: #a855f7; font-weight: bold;");

            // 3. Disparo direto do BrowserView (elimina latência do proxy VPS)
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Authorization': shared.sessionToken,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`%c[POLARYON] ✅ Lance de R$ ${value} enviado com sucesso!`, "color: #10b981; font-weight: bold;");
            } else {
                const errText = await response.text();
                console.error(`%c[POLARYON] ❌ Lance rejeitado (${response.status}): ${errText}`, "color: #ef4444; font-weight: bold;");
            }
        } catch (e) {
            console.error('[POLARYON] Exceção crítica durante o disparo direto:', e);
        }
    });

    // -------------------------------------------------------------------------
    // SISTEMA DE INTERCEPTAÇÃO DE REDE (O "ESCUTA-GERAL")
    // -------------------------------------------------------------------------
    // (Nota: processSerproData antigo removido para evitar colisão e sombreamento)

    async function autoFetchPurchaseItems(purchaseId) {
        if (!shared.sessionToken) return;
        try {
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
            const tStart = Date.now();
            const res = await fetch(url, {
                headers: {
                    'Authorization': shared.sessionToken,
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                }
            });
            const tEnd = Date.now();
            if (res.ok) {
                const data = await res.json();
                console.log(`%c[POLARYON AUTO FETCH] ✅ ${purchaseId}: ${Array.isArray(data) ? data.length + ' itens' : 'OK'}`, 'color: #10b981; font-size: 10px;');
                const dateHeader = res.headers.get('Date') || res.headers.get('date') || '';
                processSerproData(data, url, res.status, res.ok, dateHeader, tStart, tEnd);
            } else {
                console.warn(`[POLARYON AUTO FETCH] ⚠️ ${purchaseId}: status ${res.status}`);
            }
        } catch (e) {
            console.error(`[POLARYON] Erro ao sincronizar itens da sala ${purchaseId}:`, e);
        }
    }

    // 🏆 RANKING INTERCEPTOR: Captura /lances/por-participante ou localhost/classificacao diretamente do tráfego do browser
    // Retorna true se encontrou e processou lances válidos, false caso contrário.
    function processRankingData(data, url, status, ok) {
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                // Keep raw string if parsing fails
            }
        }
        console.log(`%c[POLARYON RANKING INTERCEPTOR]  Dados brutos recebidos: type=${typeof data}, isArray=${Array.isArray(data)}, keys=${data && typeof data === 'object' ? Object.keys(data).join(',') : 'N/A'} (status: ${status || 'N/A'}, ok: ${ok !== undefined ? ok : 'N/A'})`, 'color: #f59e0b; font-size: 10px;');
        if (typeof data === 'string') {
            console.log(`%c[POLARYON RANKING INTERCEPTOR] Preview da string recebida (primeiros 400 chars): ${data.substring(0, 400)}`, 'color: #ef4444; font-size: 10px;');
        }
        
        let compraId = null;
        let itemId = null;

        const matchCompra = url.match(/\/compras\/(\d+)\//);
        const matchItem  = url.match(/\/itens\/(\d+)\//);
        if (matchCompra && matchItem) {
            compraId = matchCompra[1];
            itemId = matchItem[1];
        } else {
            try {
                // Tenta buscar nos query parameters (ex: localhost:36981/comprasnet/classificacao?codigo=X&numeroItem=Y)
                let targetUrl = url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    targetUrl = 'http://localhost' + (url.startsWith('/') ? '' : '/') + url;
                }
                const urlObj = new URL(targetUrl);
                compraId = urlObj.searchParams.get('codigo') || urlObj.searchParams.get('compraId');
                itemId = urlObj.searchParams.get('numeroItem') || urlObj.searchParams.get('itemId');
            } catch (e) {
                const matchQueryCodigo = url.match(/[?&]codigo=(\d+)/);
                const matchQueryItem = url.match(/[?&]numeroItem=(\d+)/);
                if (matchQueryCodigo) compraId = matchQueryCodigo[1];
                if (matchQueryItem) itemId = matchQueryItem[1];
            }
        }

        if (!compraId || !itemId) {
            console.warn(`[POLARYON RANKING INTERCEPTOR]  Não conseguiu extrair compraId/itemId. url=${url}`);
            return false;
        }

        // FIX v3.8.20: Usa o mesmo formato que handlePortalSync usa para criar sessões: "virtual_{roomCode}"
        const sessionId = `virtual_${compraId}`;

        if (data && (data.error || data.status >= 400 || data.message === 'Forbidden')) {
            console.warn(`[POLARYON RANKING INTERCEPTOR] Ignorando resposta de erro para item ${itemId}: ${data.message || data.error}`);
            return false;
        }

        // Extrai lista de lances do formato que vier
        let lancesList = [];
        if (Array.isArray(data)) {
            lancesList = data;
        } else if (data) {
            if (Array.isArray(data.itens))           lancesList = data.itens;
            else if (Array.isArray(data.lances))      lancesList = data.lances;
            else if (Array.isArray(data.conteudo))    lancesList = data.conteudo;
            else if (Array.isArray(data.content))     lancesList = data.content;
            else if (Array.isArray(data.data))        lancesList = data.data;
            else if (Array.isArray(data.records))     lancesList = data.records;
            else if (Array.isArray(data.lista))       lancesList = data.lista;
            else if (Array.isArray(data.participantes)) lancesList = data.participantes;
            else if (Array.isArray(data.fornecedores))  lancesList = data.fornecedores;
            else if (Array.isArray(data.resultado))    lancesList = data.resultado;
            else if (data._embedded && Array.isArray(data._embedded.lances)) lancesList = data._embedded.lances;
            else if (data._embedded && Array.isArray(data._embedded.participantes)) lancesList = data._embedded.participantes;
            else if (data._embedded && Array.isArray(data._embedded.content)) lancesList = data._embedded.content;
            else {
                // Fallback: varre chaves do objeto principal
                for (const k of Object.keys(data)) {
                    if (Array.isArray(data[k]) && data[k].length > 0) {
                        const sample = data[k][0];
                        if (sample && (typeof sample.valor !== 'undefined' || typeof sample.valorInformado !== 'undefined' || typeof sample.valorCalculado !== 'undefined')) {
                            lancesList = data[k];
                            console.log(`%c[POLARYON RANKING INTERCEPTOR] 🔄 Extraído de chave "${k}" (${lancesList.length})`, 'color: #f59e0b; font-size: 10px;');
                            break;
                        }
                    }
                }
            }
        }

        console.log(`%c[POLARYON RANKING INTERCEPTOR] 📋 lancesList encontrada: length=${lancesList.length}`, 'color: #6366f1; font-size: 10px;');
        
        if (lancesList.length === 0) {
            console.warn(`[POLARYON RANKING INTERCEPTOR]  Lista vazia para item ${itemId}. keys: ${data && typeof data === 'object' ? Object.keys(data).join(',') : typeof data}`);
            return false;
        }

        console.log(`%c[POLARYON RANKING INTERCEPTOR] 🏆 ${lancesList.length} lances interceptados para item ${itemId} (Compra: ${compraId})`, 'color: #10b981; font-weight: bold;');

        const rankingLances = lancesList.map((entry, idx) => {
            if (entry.excluido) return null;
            const valObj = entry.melhorValorFornecedor || entry;
            if (valObj.excluido) return null;

            let val = null;
            // Suporte a /propostas-iniciais: valores aninhados em entry.valores.valorPropostaInicial
            if (entry.valores && entry.valores.valorPropostaInicial) {
                const proposta = entry.valores.valorPropostaInicial;
                val = proposta.valorInformado !== undefined && proposta.valorInformado !== null
                    ? proposta.valorInformado
                    : (proposta.valorCalculado ? proposta.valorCalculado.valorUnitario : null);
            }
            if (val === null || val === undefined) {
                if (valObj.valor !== undefined && valObj.valor !== null) {
                    val = typeof valObj.valor === 'object'
                        ? (valObj.valor.valorCalculado ?? valObj.valor.valorInformado)
                        : valObj.valor;
                } else if (valObj.valorCalculado !== undefined && valObj.valorCalculado !== null) {
                    val = valObj.valorCalculado;
                } else if (valObj.valorInformado !== undefined && valObj.valorInformado !== null) {
                    val = valObj.valorInformado;
                } else if (valObj.valorLance !== undefined && valObj.valorLance !== null) {
                    val = valObj.valorLance;
                } else if (valObj.valorProposta !== undefined && valObj.valorProposta !== null) {
                    val = valObj.valorProposta;
                } else if (valObj.lance !== undefined && valObj.lance !== null) {
                    val = typeof valObj.lance === 'number' ? valObj.lance : null;
                }
            }
            if (val === null || val === undefined) return null;

            const eMeuLance = !!(entry.eMeuLance || valObj.eMeuLance || entry.meuLance || valObj.meuLance || entry.isMyBid || valObj.isMyBid);
            const origemRaw = entry.origem || valObj.origem || entry.tipo || valObj.tipo || entry.tipoLance || valObj.tipoLance || '';
            const origem = (origemRaw === 'P' || origemRaw === 'Proposta') ? 'Proposta' : 'Lance';
            const dt = valObj.dataHoraInclusao || valObj.dataHoraAtualizacao || entry.dataHoraInclusao || entry.dataHoraAtualizacao || valObj.data || entry.data || entry.dataHora || valObj.dataHora || valObj.dataHoraRegistro || entry.dataHoraRegistro || '';
            const formattedDt = dt ? new Date(dt).toLocaleString('pt-BR') : '';

            let partId = entry.participanteId || entry.fornecedorId || entry.cnpjFornecedor
                      || entry.codigoParticipante || entry.codigoFornecedor || entry.identificadorParticipante
                      || entry.numeroParticipante || entry.identificador || entry.sequencial || null;

            if (!partId && entry.participante) partId = typeof entry.participante === 'object' ? (entry.participante.identificacao || entry.participante.nome) : entry.participante;
            if (!partId && entry.fornecedor)   partId = typeof entry.fornecedor   === 'object' ? (entry.fornecedor.cnpj || entry.fornecedor.nome) : entry.fornecedor;
            if (!partId && valObj.participanteId) partId = valObj.participanteId;

            return {
                valor: Number(val),
                origem,
                data: formattedDt,
                eMeuLance,
                classificacao: valObj.classificacao || entry.classificacao || null,
                participanteId: partId ? String(partId) : `__PARTICIPANTE__${idx}`
            };
        }).filter(Boolean).sort((a, b) => a.valor - b.valor);

        if (rankingLances.length === 0) {
            console.warn(`[POLARYON RANKING INTERCEPTOR]  Nenhum lance válido após filtragem para item ${itemId}`);
            return false;
        }

        console.log(`%c[POLARYON RANKING INTERCEPTOR] 🏆 Enviando ${rankingLances.length} lances para sessionId=${sessionId} itemId=${itemId}`, 'color: #10b981; font-weight: bold; font-size: 11px;');
        console.log(`%c[POLARYON RANKING INTERCEPTOR] 📊 Top 3: ${rankingLances.slice(0, 3).map(l => `R$${l.valor} (${l.eMeuLance ? 'MEU' : 'OUTRO'})`).join(', ')}`, 'color: #6366f1; font-size: 10px;');

        // Envia para o processo principal Electron via IPC
        ipcRenderer.send('portal-ranking-data', { sessionId, itemId, rankingLances });
        return true;
    }

    // 🔄 LOOP DE RANKING COM FILA INTELIGENTE:
    //   - Fila FIFO com rate-limit de 1 req/2s → sem 429
    //   - Item novo → inserido no INÍCIO da fila (prioridade, carga instantânea)
    //   - 429 → backoff de 15s automático antes de continuar
    //   - Refresh periódico de todos os itens a cada 45s (re-enfileira no final)
    const activeRankingItems = []; // { purchaseId, itemId }
    const _rankingQueue = [];      // fila FIFO
    let _rankingBackoffUntil = 0;  // timestamp para respeitar 429
    let _lastRankingFetchTs = 0;   // timestamp do último fetch disparado
    const RANKING_RATE_MS = 2000;  // 1 requisição a cada 2s (30 req/min)

    // Enfileira item de ranking. priority=true coloca na frente da fila.
    function enqueueRankingFetch(target, priority = false) {
        const alreadyQueued = _rankingQueue.some(q => q.purchaseId === target.purchaseId && q.itemId === target.itemId);
        if (alreadyQueued) return;
        if (priority) {
            _rankingQueue.unshift({ purchaseId: target.purchaseId, itemId: target.itemId });
        } else {
            _rankingQueue.push({ purchaseId: target.purchaseId, itemId: target.itemId });
        }
    }

    // Dispara o fetch de um item: hCaptcha (P1_ token) + fetch direto concorrente
    function triggerRankingFetch(target) {
        shared.pendingRankingTarget = target;
        document.dispatchEvent(new CustomEvent('polaryon-trigger-hcaptcha'));

        const urlDirect = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${target.purchaseId}/itens/${target.itemId}/lances/por-participante?tamanhoPagina=50&pagina=0`;
        document.dispatchEvent(new CustomEvent('polaryon-fetch-ranking', {
            detail: { url: urlDirect, purchaseId: target.purchaseId, itemId: target.itemId }
        }));
    }

    // 🚦 PROCESSADOR DE FILA: a cada 500ms verifica se pode disparar o próximo item
    setInterval(() => {
        if (!shared.sessionToken) return;
        if (_rankingQueue.length === 0) return;
        const now = Date.now();
        if (now < _rankingBackoffUntil) return;           // 429 backoff ativo
        if (now - _lastRankingFetchTs < RANKING_RATE_MS) return; // rate-limit
        const target = _rankingQueue.shift();
        _lastRankingFetchTs = now;
        console.log(`%c[POLARYON RANKING QUEUE] ▶️ Processando item ${target.itemId} (Compra: ${target.purchaseId}) | Fila: ${_rankingQueue.length}`, 'color:#6366f1;font-size:9px;');
        triggerRankingFetch(target);
    }, 500);

    // 🔁 REFRESH PERIÓDICO: a cada 45s re-enfileira todos os itens ativos (no final da fila)
    setInterval(() => {
        if (!shared.sessionToken || activeRankingItems.length === 0) return;
        console.log(`%c[POLARYON RANKING QUEUE] 🔁 Re-enfileirando ${activeRankingItems.length} itens para refresh periódico`, 'color:#a855f7;font-size:9px;');
        activeRankingItems.forEach(target => enqueueRankingFetch(target, false));
    }, 45000);

    function processSerproData(data, url, status, ok, dateHeader, tStart, tEnd) {
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                // Keep raw string if parsing fails
            }
        }
        console.log(`%c[POLARYON] Radar: ${url.split('?')[0]}`, "color: #888; font-size: 10px;");

        // 🏆 RANKING: intercepta respostas de /lances/por-participante ou classificação local
        if (url.includes('/lances/por-participante') || url.includes('/lances/compra/') || url.includes('/classificacao') || url.includes('comprasnet/classificacao')) {
            processRankingData(data, url, status, ok);
            return;
        }

        if (url.includes('/participacoes')) {
            const isDisputaQuery = url.includes('situacao=3') || url.includes('situacao=EM_DISPUTA') || url.includes('fase=disputa') || url.includes('situacao=disputa');
            const hasOtherFilters = url.includes('situacao=1') || url.includes('situacao=2') || url.includes('situacao=4') || url.includes('AGENDADA') || url.includes('EM_ANDAMENTO') || url.includes('ENCERRADA');
            if (hasOtherFilters && !isDisputaQuery) {
                console.log(`%c[POLARYON] Ignorando participações fora da aba de Disputa Ativa: ${url}`, "color: #94a3b8; font-size: 10px; font-weight: bold;");
                return;
            }
            const listObj = Array.isArray(data) ? data : (data.itens || []);
            listObj.forEach(p => {
                const situacaoRaw = p.situacao || (p.compra && p.compra.situacao) || p.situacaoCompra || (p.compra && p.compra.situacaoCompra) || p.situacaoParticipacao || '';
                const situacaoStr = String(situacaoRaw).toUpperCase();
                if (situacaoRaw) {
                    const isDisputa = (situacaoStr.includes('DISPUTA') || situacaoStr === '3') && !situacaoStr.includes('ENCERRADA') && !situacaoStr.includes('ENCERRADO');
                    if (!isDisputa) return;
                } else {
                    if (hasOtherFilters && !isDisputaQuery) return;
                }
                if (p.compra && p.compra.numeroUasg && p.compra.numero) {
                    const uasg = String(p.compra.numeroUasg).padStart(6, '0');
                    const numero = p.compra.numero;
                    const ano = p.compra.ano;
                    const modalityCode = String(p.compra.modalidade || '6').padStart(2, '0');
                    const purchaseId = `${uasg}${modalityCode}${String(numero).padStart(5, '0')}${ano}`;
                    if (!shared.synchronizedPurchases.has(purchaseId)) {
                        shared.synchronizedPurchases.add(purchaseId);
                        console.log(`%c[POLARYON DETECTOR] 🎯 Nova sala em disputa detectada: ${purchaseId} (fetch em ${_roomFetchDelayMs}ms)`, "color: #10b981; font-weight: bold;");
                        ipcRenderer.send('portal-detected-room', { url: `compra=${purchaseId}` });
                        if (shared.sessionToken) {
                            // ⚙️ Anti-429: Escalonamento com 2.5s entre cada sala detectada
                            const myDelay = _roomFetchDelayMs;
                            _roomFetchDelayMs += 2500;
                            setTimeout(() => { _roomFetchDelayMs = Math.max(0, _roomFetchDelayMs - 2500); }, myDelay + 4000);
                            setTimeout(async () => {
                                try {
                                    const roomUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
                                    const tStart = Date.now();
                                    const r = await fetch(roomUrl, { headers: { 'Authorization': shared.sessionToken, 'Accept': 'application/json', 'x-device-platform': 'web', 'x-version-number': '6.0.2' } });
                                    const tEnd = Date.now();
                                    if (r.ok) {
                                         const d = await r.json();
                                         const dateHeader = r.headers.get('Date') || r.headers.get('date') || '';
                                         processSerproData(d, roomUrl, r.status, r.ok, dateHeader, tStart, tEnd);
                                    } else if (r.status === 429) {
                                        console.warn(`[POLARYON DETECTOR] ⚠️ 429 para ${purchaseId}. Retentando em 15s...`);
                                        setTimeout(() => autoFetchPurchaseItems(purchaseId), 15000);
                                    }
                                } catch (e) { console.error('[POLARYON DETECTOR] Erro fetch sala:', e); }
                            }, myDelay);
                        }
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
                        ipcRenderer.send('portal-detected-room', { url: `compra=${purchaseId}` });
                    }
                });
            }
        }

        const items = Array.isArray(data) ? data : (data.itens || []);
        const match = url.match(/\/compras\/(\d+)\//);
        const roomCode = match ? match[1] : null;

        // Log EVERY URL que chega no processSerproData
        const urlShort = url.replace(/https:\/\/cnetmobile\.estaleiro\.serpro\.gov\.br\/comprasnet-disputa\/v1\/compras\/\d+\//, '.../');
        console.log(`%c[API] 📡 ${urlShort} | items=${items.length} | isArray=${Array.isArray(data)} | hasItens=${!!data.itens}`, 'color:#6366f1;font-size:10px;');
        // 🎯 SUB-ITENS via /itens-grupo: quando Angular expande o grupo
        // Cada sub-item tem LANCE INDIVIDUAL — o grupo só agrega no final
        const isSubItemsEndpoint = url.includes('/itens/-1/itens-grupo') || url.includes('/itens-grupo');
        if (isSubItemsEndpoint && items.length > 0 && roomCode) {
            const groupIdMatch = url.match(/\/itens\/(?:em-disputa\/)?(-?\d+)\/itens-grupo/);
            const parentId = groupIdMatch ? groupIdMatch[1] : '-1';
            shared.subItemsCache = shared.subItemsCache || {};
            shared.subItemsCache[roomCode] = items.map(si => ({
                ...si,
                isGroupItem: true,
                parentGroupId: parentId
            }));
            console.log(`%c[GRUPO] 📦 Sub-itens recebidos (${urlShort}): ${items.length} itens — serão processados individualmente (ranking + lances)`, 'color:#f59e0b;font-weight:bold;font-size:12px;');
            items.forEach((si, idx) => {
                console.log(`%c[GRUPO]   Sub #${idx}: numero=${si.numero} identificador=${si.identificador} desc="${(si.descricao || '').substring(0, 30)}"`, 'color:#f59e0b;');
            });
            if (items.length > 0) {
                console.log(`%c[GRUPO] FULL 1o sub-item keys=${Object.keys(items[0]).filter(k => !k.startsWith('_') && !k.startsWith('$')).join(',')}`, 'color:#f59e0b;font-size:9px;');
                console.log(`%c[GRUPO] FULL 1o sub-item: ${JSON.stringify(items[0])}`, 'color:#f59e0b;font-size:9px;');
            }
            // ✈️ Envio direto via IPC (garantia, independente do ranking queue + mapper)
            if (typeof ipcRenderer !== 'undefined' && roomCode) {
                const subMapped = items.map(si => ({
                    itemId: String(si.identificador || si.numero),
                    purchaseId: roomCode,
                    valorAtual: 0, meuValor: 0, ganhador: 'Outro',
                    status: '', posicao: '?',
                    timerSeconds: -1, segundosParaEncerramento: undefined,
                    dataHoraFimContagem: undefined,
                    updatedAt: Date.now(),
                    officialMargin: 1, officialMarginType: 'V',
                    desc: si.descricao, tipo: si.tipo,
                    isGroup: false, isGroupItem: true, parentGroupId: parentId,
                    qtdeItensDoGrupo: 0, subItens: undefined
                }));
                console.log(`%c[GRUPO] ✈️ Enviando ${subMapped.length} sub-itens via IPC direto`, 'color:#f59e0b;font-weight:bold;font-size:12px;');
                ipcRenderer.send('send-portal-data', {
                    type: 'portal-sync', roomCode, timestamp: Date.now(),
                    items: subMapped, serverOffset: undefined,
                    sigaTimerSeconds: undefined, clockSkew: 0
                });
            }
            // ❌ Não retorna early — sub-itens passam pelo fluxo normal (ranking queue + mapper)
            // para terem lances individuais como qualquer outro item
        }
        // Procura sub-itens (tipo "S") em qualquer resposta (debug)
        const subItemsFound = items.filter(it => it.tipo === 'S' || it.tipo === 's');
        if (subItemsFound.length > 0) {
            console.log(`%c[API] 🎯 SUB-ITENS (tipo S) encontrados! ${subItemsFound.length} em ${urlShort}`, 'color:#22c55e;font-weight:bold;font-size:12px;');
            subItemsFound.forEach((si, idx) => {
                console.log(`%c[API]   Sub #${idx}: numero=${si.numero} identificador=${si.identificador} desc="${(si.descricao || '').substring(0, 30)}" parentGrupo=${si.grupo || si.grupoIdentificador || si.grupoId || '?'}`, 'color:#22c55e;');
            });
        }

        // 🔍 Detecta item grupo (tipo "G", numero -1) para debug
        const groupItem = items.find(it => it.tipo === 'G' || it.numero === -1);
        if (groupItem) {
            const subItens = groupItem.itens || [];
            console.log(`%c[GRUPO] Item grupo detectado em ${url}: numero=${groupItem.numero} identificador=${groupItem.identificador} desc="${(groupItem.descricao || '').substring(0, 40)}" subItens=${subItens.length} qtdeItensDoGrupo=${groupItem.qtdeItensDoGrupo || '?'} keys=${Object.keys(groupItem).join(',')}`, 'color:#f59e0b;font-weight:bold;');
            // Log all group fields as JSON
            const gKeys = Object.keys(groupItem).filter(k => !k.startsWith('_') && !k.startsWith('$'));
            gKeys.forEach(k => {
                const v = groupItem[k];
                if (Array.isArray(v)) {
                    console.log(`%c[GRUPO]   🔑 ${k}: Array(${v.length})`, 'color:#f59e0b;');
                } else if (typeof v === 'object' && v !== null) {
                    console.log(`%c[GRUPO]   🔑 ${k}: ${JSON.stringify(v).substring(0, 100)}`, 'color:#f59e0b;');
                } else {
                    console.log(`%c[GRUPO]   🔑 ${k}: ${v}`, 'color:#f59e0b;');
                }
            });
            if (subItens.length > 0) {
                console.log(`%c[GRUPO] 1o sub-item:`, 'color:#f59e0b;', JSON.stringify(subItens[0]).substring(0, 300));
            }
            if (items.filter(i => i.tipo === 'G' || i.numero === -1).length > 0) {
                const nonGroup = items.filter(i => !(i.tipo === 'G' || i.numero === -1));
                console.log(`%c[GRUPO] Itens avulsos (fora do grupo): ${nonGroup.length}`, 'color:#f59e0b;font-weight:bold;');
                nonGroup.forEach((ig, idx) => {
                    const keysSub = Object.keys(ig).filter(k => k !== 'descricao' && k !== 'disputaPorValorUnitario' && k !== 'criterioJulgamento');
                    console.log(`%c[GRUPO]   Avulso #${idx}: numero=${ig.numero} identificador=${ig.identificador} desc="${(ig.descricao || '').substring(0, 30)}" grupo=${ig.grupo || ig.grupoIdentificador || ig.grupoId || ig.grupoNumero || '?'} keys=${keysSub.join(',')}`, 'color:#f59e0b;');
                });
                // Log detalhado do primeiro item avulso (procura campo de grupo)
                if (nonGroup.length > 0) {
                    console.log(`%c[GRUPO]   FULL 1o avulso: ${JSON.stringify(nonGroup[0])}`, 'color:#f59e0b;font-size:9px;');
                }
            }
        }

        // 🔄 Proactive fetch: busca sub-itens do grupo (caso Angular não expanda automaticamente)
        if (groupItem && roomCode && shared.sessionToken && !(shared.subItemsCache && shared.subItemsCache[roomCode])) {
            setTimeout(async () => {
                try {
                    const epUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${roomCode}/itens/em-disputa/-1/itens-grupo`;
                    const r = await fetch(epUrl, { headers: { 'Authorization': shared.sessionToken, 'Accept': 'application/json', 'x-device-platform': 'web', 'x-version-number': '6.0.2' } });
                    if (r.ok) {
                        const d = await r.json();
                        const dItems = Array.isArray(d) ? d : (d.itens || []);
                        if (dItems.length > 0) {
                            console.log(`%c[GRUPO FETCH] ✅ Sub-itens encontrados (auto): ${dItems.length}`, 'color:#22c55e;font-weight:bold;font-size:11px;');
                            shared.subItemsCache = shared.subItemsCache || {};
                            const pfGroupIdMatch = epUrl.match(/\/itens\/(?:em-disputa\/)?(-?\d+)\/itens-grupo/);
                            const pfParentId = pfGroupIdMatch ? pfGroupIdMatch[1] : '-1';
                            shared.subItemsCache[roomCode] = dItems.map(si => ({ ...si, isGroupItem: true, parentGroupId: pfParentId }));
                            // Re-fetch em-disputa para mostrar sub-itens
                            const roomUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${roomCode}/itens/em-disputa`;
                            const rr = await fetch(roomUrl, { headers: { 'Authorization': shared.sessionToken, 'Accept': 'application/json', 'x-device-platform': 'web', 'x-version-number': '6.0.2' } });
                            if (rr.ok) {
                                const dd = await rr.json();
                                const dh = rr.headers.get('Date') || rr.headers.get('date') || '';
                                processSerproData(dd, roomUrl, rr.status, rr.ok, dh, Date.now() - 100, Date.now());
                            }
                        }
                    }
                } catch(e) { /* silently ignore */ }
            }, 3000);
        }

        if (items.length > 0 && roomCode) {
            // 🏆 Registra itens ativos para o loop de ranking
            items.forEach(it => {
                const itemIdStr = String(it.identificador || it.numero);
                const isGroup = it.tipo === 'G' || it.numero === -1 || itemIdStr === 'G1';
                const faseItem = (it.faseTraduzido || it.fase || '').toUpperCase();
                const isEncerrado = faseItem.includes('ENCERRAD') || faseItem.includes('FINALIZ') || faseItem.includes('CANCEL');
                // ⛔ Pula itens de grupo (numero -1) — ranking API não funciona pra eles
                if (isGroup) return;
                if (!isEncerrado && itemIdStr) {
                    const alreadyTracked = activeRankingItems.some(r => r.purchaseId === roomCode && r.itemId === itemIdStr);
                    if (!alreadyTracked) {
                        const newTarget = { purchaseId: roomCode, itemId: itemIdStr };
                        activeRankingItems.push(newTarget);
                        console.log(`%c[POLARYON RANKING QUEUE] ➕ Item ${itemIdStr} (compra: ${roomCode}) enfileirado com prioridade. Fila: ${_rankingQueue.length + 1}`, 'color: #6366f1; font-weight: bold; font-size: 11px;');
                        // 🚀 Prioridade: coloca na FRENTE da fila → será o próximo processado (sem burst)
                        enqueueRankingFetch(newTarget, true);
                    }
                }
            });

            if (typeof ipcRenderer !== 'undefined') {
                const mappedItems = items.map(it => {
                    const spd = it.situacaoParticipanteDisputa;
                    const rawPos = it.classificacao || it.posicao || (it.melhorValorFornecedor && (it.melhorValorFornecedor.classificacao || it.melhorValorFornecedor.posicao)) || it.situacaoParticipanteDisputaTraduzido || (spd === 'G' ? 'GANHANDO' : (spd === 'P' || spd === 'E' ? 'PERDENDO' : '?'));
                    const numPos = parseInt(rawPos, 10);
                    const posFinal = !isNaN(numPos) ? String(numPos) : rawPos;
                    const meuValor = it.melhorValorFornecedor ? it.melhorValorFornecedor.valorCalculado : (it.valorLanceProposta || 0);
                    const valorAtual = it.melhorValorGeral ? it.melhorValorGeral.valorCalculado : (it.melhorLance || 0);
                    // 🕒 Timer síncrono com o DOM do Serpro
                    // O DOM usa segundosParaEncerramento (server-side). dataHoraFimContagem - Date.now()
                    // pode divergir porque o relógio local pode estar diferente do servidor.
                    const segundosRaw = it.segundosParaEncerramento;
                    const sigaTimer = segundosRaw !== undefined && segundosRaw !== null && segundosRaw >= 0
                        ? segundosRaw
                        : (it.dataHoraFimContagem
                            ? Math.max(0, (new Date(it.dataHoraFimContagem).getTime() - Date.now()) / 1000)
                            : -1);
                    var nowTs = tEnd || Date.now();
                    const subItemCacheEntry = shared.subItemsCache?.[roomCode]?.find(
                        si => String(si.identificador || si.numero) === String(it.identificador || it.numero)
                    );
                    return {
                        itemId: String(it.identificador || it.numero),
                        purchaseId: roomCode,
                        valorAtual,
                        meuValor,
                        ganhador: posFinal === '1' || posFinal === 'GANHANDO' ? 'Você' : 'Outro',
                        status: it.faseTraduzido || it.fase || (it.situacaoItem || ''),
                        posicao: posFinal,
                        timerSeconds: sigaTimer,
                        segundosParaEncerramento: segundosRaw,
                        dataHoraFimContagem: it.dataHoraFimContagem,
                        updatedAt: nowTs,
                        officialMargin: it.variacaoMinimaEntreLances || 1,
                        officialMarginType: it.tipoVariacaoMinimaEntreLances || 'V',
                        desc: it.descricao,
                        tipo: it.tipo,
                        isGroup: it.tipo === 'G' || it.numero === -1,
                        isGroupItem: !!subItemCacheEntry,
                        parentGroupId: subItemCacheEntry?.parentGroupId,
                        qtdeItensDoGrupo: it.qtdeItensDoGrupo || 0,
                        subItens: (it.tipo === 'G' || it.numero === -1) ? (shared.subItemsCache?.[roomCode] || []) : undefined
                    };
                });
                let serverOffset = undefined;
                const rtt = (tStart && tEnd) ? (tEnd - tStart) : 0;

                // PRIORIDADE 1: HTTP Date header - timestamp oficial do servidor
                if (dateHeader) {
                    const serverTime = new Date(dateHeader).getTime();
                    if (!isNaN(serverTime)) {
                        serverOffset = (serverTime + rtt / 2) - (tEnd || Date.now());
                    }
                }

                // PRIORIDADE 2: Fallback via segundosParaEncerramento (se Date header falhou)
                if (serverOffset === undefined && Array.isArray(mappedItems)) {
                    for (const it of mappedItems) {
                        if (it.dataHoraFimContagem && it.timerSeconds !== undefined && it.timerSeconds >= 0) {
                            const endTime = new Date(it.dataHoraFimContagem).getTime();
                            if (!isNaN(endTime)) {
                                const calculatedServerTime = (endTime - it.timerSeconds * 1000) + (rtt / 2);
                                serverOffset = calculatedServerTime - (tEnd || Date.now());
                                break;
                            }
                        }
                    }
                }
                // Estabiliza o offset (Date header tem precisão de 1s, causando saltos)
                const stabilizedOffset = serverOffset !== undefined ? smoothOffset(serverOffset) : undefined;
                if (stabilizedOffset !== undefined && serverOffset !== undefined) {
                    // Atualiza shared com offset estabilizado para o ClockSync
                    shared.stabilizedOffset = stabilizedOffset;
                }

                // Se o injector ainda não enviou siga-timer, usa o primeiro item para calcular
                let sigaSecs = shared.sigaTimerSeconds;
                if (sigaSecs === undefined && mappedItems.length > 0) {
                    const first = mappedItems[0];
                    if (first.segundosParaEncerramento !== undefined && first.segundosParaEncerramento >= 0) {
                        sigaSecs = first.segundosParaEncerramento;
                    } else if (first.timerSeconds !== undefined && first.timerSeconds >= 0) {
                        sigaSecs = first.timerSeconds;
                    }
                }

                // 🕒 ClockSkew: diferença entre relógio do servidor e local
                // Estratégia 1: savedSegundos (mais preciso, via segundosParaEncerramento do ranking)
                // Estratégia 2: stabilizedOffset (sempre disponível, via Date header)
                // Estratégia 3: sigaTimerSeconds do injector (DOM/WebSocket do Siga)
                let clockSkew = shared.clockSkew || 0;
                var rawSkew = null;
                var skewSource = 'none';
                // Estratégia 1: savedSegundos por sala
                var savedSegundos = shared.savedSegundos;
                var savedTimestamp = shared.savedTimestamp;
                if (shared.savedSegundosByRoom && shared.savedSegundosByRoom[roomCode] !== undefined) {
                    savedSegundos = shared.savedSegundosByRoom[roomCode];
                    savedTimestamp = shared.savedTimestampByRoom?.[roomCode] || 0;
                }
                if (savedSegundos !== undefined && savedSegundos >= 0 && savedTimestamp > 0 && mappedItems.length > 0 && mappedItems[0].dataHoraFimContagem) {
                    var endTime = new Date(mappedItems[0].dataHoraFimContagem).getTime();
                    if (!isNaN(endTime)) {
                        var localPrediction = (endTime - savedTimestamp) / 1000;
                        rawSkew = savedSegundos - localPrediction;
                        skewSource = 'segundos';
                    }
                }
                // Estratégia 2: stabilizedOffset do Date header (ms → segundos, invertido)
                if (rawSkew === null && stabilizedOffset !== undefined) {
                    rawSkew = -(stabilizedOffset / 1000);
                    skewSource = 'DateHeader';
                }
                // Estratégia 3: sigaTimerSeconds do injector (leitura contínua do DOM/rede do Siga)
                if (rawSkew === null && sigaSecs !== undefined && sigaSecs >= 0 && mappedItems.length > 0 && mappedItems[0].dataHoraFimContagem) {
                    var endTime3 = new Date(mappedItems[0].dataHoraFimContagem).getTime();
                    if (!isNaN(endTime3)) {
                        var now3 = tEnd || Date.now();
                        var elapsed3 = 0;
                        if (shared.sigaTimerReceivedAt) {
                            elapsed3 = Math.max(0, (now3 - shared.sigaTimerReceivedAt) / 1000);
                        }
                        var adjustedSiga = sigaSecs - elapsed3;
                        var localPrediction3 = (endTime3 - now3) / 1000;
                        rawSkew = adjustedSiga - localPrediction3;
                        skewSource = 'sigaTimer';
                    }
                }
                if (rawSkew !== null && rawSkew !== undefined) {
                    if (shared.clockSkew === undefined || shared.clockSkew === 0) {
                        shared.clockSkew = rawSkew;
                    } else {
                        shared.clockSkew = shared.clockSkew * 0.85 + rawSkew * 0.15;
                    }
                    clockSkew = shared.clockSkew;
                    if (Math.abs(rawSkew) > 0.1) {
                        console.log(`%c[CLOCK SKEW] ${rawSkew > 0 ? 'server ahead' : 'local ahead'}=${Math.abs(rawSkew).toFixed(2)}s raw=${rawSkew.toFixed(3)}s smoothed=${clockSkew.toFixed(3)}s via=${skewSource}`, 'color:#22c55e;font-weight:bold;');
                    }
                }

                ipcRenderer.send('send-portal-data', {
                    type: 'portal-sync',
                    roomCode: roomCode,
                    timestamp: tEnd || Date.now(),
                    serverOffset: stabilizedOffset,
                    items: mappedItems,
                    sigaTimerSeconds: sigaSecs,
                    clockSkew: clockSkew
                });
            }
        }
    }

    // Escuta as mensagens da página injetada
    window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'polaryon-injector') {
            const { type, token, data, url, status, ok } = event.data;
            if (type === 'token') {
                shared.sessionToken = token;
            } else if (type === 'captcha') {
                // Só aceita P1_... (hCaptcha do portal). Siga captcha retorna 204 no ranking.
                if (token && token.startsWith('P1_')) {
                    shared.captchaToken = token;
                    console.log('%c[POLARYON] 🔓 Captcha P1_... interceptado!', 'color:#10b981;font-weight:bold;font-size:11px;');
                }
            } else if (type === 'serpro-data') {
                var roomMatch = url.match(/\/compras\/(\d+)\//);
                // Só sobrescreve savedSegundos se o payload tiver valor válido
                // (evita que mensagens sem savedSegundos — ex: ranking loop — destruam o valor bom)
                if (event.data.savedSegundos !== undefined && event.data.savedSegundos >= 0) {
                    if (roomMatch) {
                        shared.savedSegundosByRoom[roomMatch[1]] = event.data.savedSegundos;
                        shared.savedTimestampByRoom[roomMatch[1]] = event.data.savedTimestamp;
                    }
                    shared.savedSegundos = event.data.savedSegundos;
                    shared.savedTimestamp = event.data.savedTimestamp;
                }
                processSerproData(data, url, status, ok, event.data.dateHeader, event.data.tStart, event.data.tEnd);
            } else if (type === 'captcha-error') {
                console.log('%c[POLARYON] ⚠️ Captcha rejeitado/expirado (403/Forbidden). Limpando token...', 'color:#f59e0b;font-weight:bold;font-size:11px;');
                shared.captchaToken = null;
            } else if (type === '429-error') {
                console.log('%c[POLARYON] 🚨 429 Too Many Requests detectado! Ativando backoff de 15 segundos...', 'color:#ef4444;font-weight:bold;font-size:11px;');
                _rankingBackoffUntil = Date.now() + 15000;
            } else if (type === 'siga-timer') {
                shared.sigaTimerSeconds = event.data.remainingSec;
                shared.sigaTimerMs = event.data.remainingMs;
                shared.sigaTimerReceivedAt = Date.now();
                if (event.data.savedSegundos !== undefined && event.data.savedSegundos >= 0 && event.data.savedTimestamp) {
                    shared.savedSegundos = event.data.savedSegundos;
                    shared.savedTimestamp = event.data.savedTimestamp;
                }
                ipcRenderer.send('send-portal-data', {
                    type: 'siga-timer',
                    sigaTimerSeconds: event.data.remainingSec,
                    sigaTimerReceivedAt: event.data.timestamp
                });
            } else if (type === 'server-time') {
                shared.serverTimeMs = event.data.serverTimeMs;
                shared.serverTimeReceivedAt = event.data.timestamp;
                // 🎯 ClockSkew preciso via WebSocket Server Time (sub-ms, muito melhor que Date header 1s)
                var wsOffset = shared.serverTimeMs - shared.serverTimeReceivedAt;
                var wsSkew = -(wsOffset / 1000);
                if (shared.clockSkew === undefined || shared.clockSkew === 0) {
                    shared.clockSkew = wsSkew;
                } else {
                    shared.clockSkew = shared.clockSkew * 0.85 + wsSkew * 0.15;
                }
                console.log('%c[CLOCK SKEW WS] ' + (wsSkew > 0 ? 'server ahead' : 'local ahead') + '=' + Math.abs(wsSkew).toFixed(3) + 's smoothed=' + shared.clockSkew.toFixed(3) + 's', 'color:#f59e0b;font-weight:bold;');
                ipcRenderer.send('send-portal-data', {
                    type: 'server-time',
                    serverTimeMs: shared.serverTimeMs,
                    serverTimeReceivedAt: shared.serverTimeReceivedAt,
                    clockSkew: shared.clockSkew
                });
                } else if (type === 'fresh-captcha') {
                // 🔑 Token FRESCO: interceptado antes do Angular ou gerado sob demanda por nós
                if (token && token.startsWith('P1_')) {
                    console.log('%c[POLARYON] 🔑 Token FRESCO recebido!', 'color:#10b981;font-weight:bold;font-size:11px;');
                    
                    if (shared.pendingRankingTarget) {
                        const target = shared.pendingRankingTarget;
                        shared.pendingRankingTarget = null; // consome target
                        
                        const encoded = encodeURIComponent(token);
                        const urlCaptcha = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${target.purchaseId}/itens/${target.itemId}/lances/por-participante?captcha=${encoded}&tamanhoPagina=50&pagina=0`;
                        console.log(`%c[POLARYON RANKING LOOP] 🚀 Executando fetch em background com token fresco gerado para item ${target.itemId}...`, 'color:#a855f7;font-weight:bold;font-size:11px;');
                        
                        document.dispatchEvent(new CustomEvent('polaryon-fetch-ranking', {
                            detail: { url: urlCaptcha, purchaseId: target.purchaseId, itemId: target.itemId }
                        }));
                    } else {
                        // Fallback: armazena
                        shared.captchaToken = token;
                    }
                }
            } else if (type === 'ws-item-update') {
                // ⚡ WebSocket do Siga avisou que algo mudou — dispara fetch imediato na API oficial
                var wsCodigo = event.data.codigo;
                var wsData = event.data.data;
                if (wsCodigo && Array.isArray(wsData) && wsData.length > 0 && shared.sessionToken) {
                    var firstItem = wsData[0];
                    console.log('%c[WS TRIGGER] ⚡ ' + wsCodigo + ' (' + wsData.length + ' itens) — fetch imediato...', 'color:#22c55e;font-weight:bold;font-size:10px;');
                    // Log amostra do primeiro item para debug
                    try { console.log('%c[WS TRIGGER] sample: ' + JSON.stringify(firstItem).substring(0, 200), 'color:#888;font-size:9px;'); } catch(e) {}
                    // Dispara fetch prioritário na API oficial do Serpro (sem esperar o próximo ciclo do adaptiveLoop)
                    var fetchUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/' + wsCodigo + '/itens/em-disputa';
                    fetch(fetchUrl, {
                        headers: {
                            'Authorization': shared.sessionToken,
                            'Accept': 'application/json',
                            'x-device-platform': 'web',
                            'x-version-number': '6.0.2'
                        }
                    }).then(function(res) {
                        if (res.ok) {
                            var tEnd = Date.now();
                            return res.json().then(function(data) {
                                var dateHeader = res.headers.get('Date') || '';
                                processSerproData(data, fetchUrl, res.status, true, dateHeader, tEnd - 50, tEnd);
                            });
                        }
                    }).catch(function() {});
                }
            }
        }
    });



    // Injeta o interceptor de rede na página
    try {
        const scriptContent = `
        (function() {
            // 🕒 Intercepta console.log do Siga para capturar server time (/topic/dataHoraBrasilia)
            var __origLog = console.log;
            console.log = function() {
                var msg = '';
                for (var i = 0; i < arguments.length; i++) { msg += (i > 0 ? ' ' : '') + String(arguments[i]); }
                if (msg.indexOf('Hora:') !== -1) {
                    var m = msg.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})/);
                    if (m) {
                        window.postMessage({ source: 'polaryon-injector', type: 'server-time', serverTimeMs: new Date(m[1]).getTime(), timestamp: Date.now() }, '*');
                    }
                }
                return __origLog.apply(console, arguments);
            };
            let sessionToken = '';
            let polaryonEndTime = 0;
            var savedSegundos = -1;
            var savedTimestamp = 0;

            // 🕒 Intercepta WebSocket STOMP /topic/dataHoraBrasilia (server time sync)
            (function() {
                var OriginalWS = window.WebSocket;
                window.WebSocket = function(url, protocols) {
                    var ws = new OriginalWS(url, protocols);
                    if (url.indexOf('estaleiro.serpro.gov.br') !== -1 || url.indexOf('sigapregao.com.br') !== -1) {
                        console.log('%c[WS INTERCEPT] WebSocket criado: ' + url.substring(0, 80), 'color:#6366f1');
                        var origAddEventListener = ws.addEventListener.bind(ws);
                        ws.addEventListener = function(type, fn) {
                            if (type === 'message' && typeof fn === 'function') {
                                var wrappedFn = function(event) {
                                    tryParseServerTime(event.data);
                                    fn.call(ws, event);
                                };
                                return origAddEventListener(type, wrappedFn);
                            }
                            return origAddEventListener(type, fn);
                        };
                        var origOnMessage = null;
                        Object.defineProperty(ws, 'onmessage', {
                            get: function() { return origOnMessage; },
                            set: function(fn) {
                                origOnMessage = function(event) {
                                    tryParseServerTime(event.data);
                                    if (typeof fn === 'function') fn.call(ws, event);
                                };
                            }
                        });
                    }
                    return ws;
                };
                window.WebSocket.prototype = OriginalWS.prototype;
                window.WebSocket.CONNECTING = OriginalWS.CONNECTING;
                window.WebSocket.OPEN = OriginalWS.OPEN;
                window.WebSocket.CLOSING = OriginalWS.CLOSING;
                window.WebSocket.CLOSED = OriginalWS.CLOSED;

                function tryParseServerTime(data) {
                    try {
                        if (typeof data !== 'string') return;
                        // STOMP frame: tenta extrair corpo JSON (após cabeçalhos)
                        var body = data;
                        if (data.indexOf('\\n\\n') !== -1 || data.indexOf('\\r\\n\\r\\n') !== -1) {
                            var sep = data.indexOf('\\r\\n\\r\\n') !== -1 ? '\\r\\n\\r\\n' : '\\n\\n';
                            var parts = data.split(sep);
                            body = parts[parts.length - 1];
                        }
                        // Tenta parsear como JSON
                        var parsed = null;
                        try { parsed = JSON.parse(body); } catch(e) {}
                        if (parsed && typeof parsed === 'object') {
                            // 🎯 Atualização de itens em tempo real via WebSocket do Siga
                            if (parsed.tipo === 'att_itens_ws' && parsed.codigo && Array.isArray(parsed.data)) {
                                console.log('%c[WS ITENS] ' + parsed.codigo + ' (' + parsed.data.length + ' itens, ws=' + parsed.websocket + ')', 'color:#22c55e;font-weight:bold;font-size:10px;');
                                window.postMessage({
                                    source: 'polaryon-injector',
                                    type: 'ws-item-update',
                                    codigo: parsed.codigo,
                                    data: parsed.data,
                                    timestamp: Date.now()
                                }, '*');
                                return;
                            }
                            // 🕒 Server time via /topic/dataHoraBrasilia
                            if (parsed.tipo === 'serverTime' || (typeof parsed.serverTimeMs === 'number') || data.indexOf('/topic/dataHoraBrasilia') !== -1) {
                                var timeVal = parsed.serverTimeMs || (parsed.data && parsed.data.serverTimeMs) || 0;
                                if (!timeVal && parsed.body) {
                                    try {
                                        var bodyObj = JSON.parse(parsed.body);
                                        timeVal = bodyObj.serverTimeMs || 0;
                                    } catch(e) {}
                                }
                                if (timeVal > 0) {
                                    console.log('%c[WS TIME] Server time: ' + new Date(timeVal).toISOString(), 'color:#10b981');
                                    window.postMessage({
                                        source: 'polaryon-injector',
                                        type: 'server-time',
                                        serverTimeMs: timeVal,
                                        timestamp: Date.now()
                                    }, '*');
                                    return;
                                }
                            }
                        } else if (data.indexOf('/topic/dataHoraBrasilia') !== -1) {
                            // STOMP frame sem JSON parseável — fallback regex
                            var tsStr = null;
                            var qMatch = data.match(/"([^"]+)"/);
                            if (qMatch && qMatch[1]) {
                                tsStr = qMatch[1];
                            } else {
                                // Plain text ISO timestamp (ex: 2026-05-28T14:26:11-03:00)
                                var isoMatch = data.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})/);
                                if (isoMatch && isoMatch[1]) {
                                    tsStr = isoMatch[1];
                                }
                            }
                            if (tsStr) {
                                var serverTimeMs = new Date(tsStr).getTime();
                                if (!isNaN(serverTimeMs)) {
                                    console.log('%c[WS TIME] STOMP fallback: ' + tsStr, 'color:#10b981');
                                    window.postMessage({
                                        source: 'polaryon-injector',
                                        type: 'server-time',
                                        serverTimeMs: serverTimeMs,
                                        timestamp: Date.now()
                                    }, '*');
                                }
                            }
                        }
                    } catch(e) {}
                }
            })();
            
            function processSerproData(data, url, status, ok, dateHeader, tStart, tEnd) {
                // 🎯 Extrai dataHoraFimContagem para o timer contínuo
                extractEndTime(data);
                window.postMessage({
                    source: 'polaryon-injector',
                    type: 'serpro-data',
                    data,
                    url,
                    status,
                    ok,
                    dateHeader: dateHeader || '',
                    tStart: tStart || 0,
                    tEnd: tEnd || 0,
                    savedSegundos: savedSegundos,
                    savedTimestamp: savedTimestamp
                }, '*');
            }

            // 🎯 Extrai dataHoraFimContagem + segundosParaEncerramento da resposta da API para timer contínuo
            var savedSegundos = -1;
            var savedTimestamp = 0;
            function extractEndTime(data) {
                if (Array.isArray(data)) {
                    for (const item of data) {
                        if (item.dataHoraFimContagem) {
                            polaryonEndTime = new Date(item.dataHoraFimContagem).getTime();
                        }
                        if (item.segundosParaEncerramento !== undefined && item.segundosParaEncerramento !== null && item.segundosParaEncerramento >= 0) {
                            savedSegundos = item.segundosParaEncerramento;
                            savedTimestamp = Date.now();
                        }
                    }
                } else if (data && data.itens && Array.isArray(data.itens)) {
                    extractEndTime(data.itens);
                }
            }

            // 🕒 Timer contínuo — lê do DOM do Siga (exato) ou fallback segundosParaEncerramento
            var savedDomTimer = -1;
            var savedDomTimerAt = 0;
            function readDomTimer() {
                try {
                    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                    var best = -1;
                    while (walker.nextNode()) {
                        var txt = (walker.currentNode.textContent || '').trim();
                        if (!txt) continue;
                        // HH:MM:SS (ex: "05:08:35")
                        var hms = txt.match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
                        if (hms) {
                            var val = parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]);
                            if (val > best && val < 172800) best = val;
                            continue;
                        }
                        // HH:MM:SS.mmm (com milissegundos)
                        var hmsm = txt.match(/^(\d{1,3}):(\d{2}):(\d{2})\.(\d{1,3})$/);
                        if (hmsm) {
                            var val = parseInt(hmsm[1]) * 3600 + parseInt(hmsm[2]) * 60 + parseInt(hmsm[3]) + parseInt(hmsm[4]) / 1000;
                            if (val > best && val < 172800) best = val;
                            continue;
                        }
                        // Apenas H:MM:SS (ex: "5:08:35")
                        var hmsShort = txt.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
                        if (hmsShort) {
                            var val = parseInt(hmsShort[1]) * 3600 + parseInt(hmsShort[2]) * 60 + parseInt(hmsShort[3]);
                            if (val > best && val < 172800) best = val;
                            continue;
                        }
                        // Decimal (ex: "5893.39" ou "424.023")
                        var dec = txt.match(/^(\d{2,})\.(\d{2,3})$/);
                        if (dec) {
                            var val = parseFloat(txt);
                            if (val > best && val < 172800) best = val;
                        }
                    }
                    if (best > 0) {
                        savedDomTimer = best;
                        savedDomTimerAt = Date.now();
                        console.log('%c[DOM TIMER] Read from DOM: ' + best + 's', 'color:#22c55e');
                    }
                } catch(e) {}
            }
            setInterval(function() {
                // Tenta ler timer do DOM (mais preciso que segundosParaEncerramento)
                readDomTimer();
                if (savedDomTimer > 0 && savedDomTimerAt > 0) {
                    var remainingSec = Math.max(0, savedDomTimer - (Date.now() - savedDomTimerAt) / 1000);
                    window.postMessage({
                        source: 'polaryon-injector',
                        type: 'siga-timer',
                        remainingMs: remainingSec * 1000,
                        remainingSec: remainingSec,
                        timestamp: Date.now(),
                        savedSegundos: savedSegundos,
                        savedTimestamp: savedTimestamp
                    }, '*');
                } else if (savedSegundos >= 0 && savedTimestamp > 0) {
                    var remainingSec = Math.max(0, savedSegundos - (Date.now() - savedTimestamp) / 1000);
                    window.postMessage({
                        source: 'polaryon-injector',
                        type: 'siga-timer',
                        remainingMs: remainingSec * 1000,
                        remainingSec: remainingSec,
                        timestamp: Date.now(),
                        savedSegundos: savedSegundos,
                        savedTimestamp: savedTimestamp
                    }, '*');
                }
            }, 100);

            // 🔑 INTERCEPTA hcaptcha.render() E hcaptcha.execute()
            let _hcaptchaWrapped = false;
            let lastWidgetId = null;
            let polaryonWidgetId = null;
            
            const wrapHcaptcha = () => {
                if (_hcaptchaWrapped || !window.hcaptcha) return;
                _hcaptchaWrapped = true;

                if (window.hcaptcha.render) {
                    const originalRender = window.hcaptcha.render;
                    window.hcaptcha.render = function(container, parameters) {
                        const widgetId = originalRender.apply(window.hcaptcha, arguments);
                        lastWidgetId = widgetId;
                        console.log('%c[POLARYON INJECTED] 🛠️ hcaptcha.render interceptado! widgetId = ' + widgetId, 'color:#10b981;font-weight:bold;font-size:10px;');
                        return widgetId;
                    };
                }

                if (window.hcaptcha.execute) {
                    const originalExecute = window.hcaptcha.execute;
                    window.hcaptcha.execute = function(widgetId, options) {
                        if (widgetId !== undefined && widgetId !== null) {
                            lastWidgetId = widgetId;
                        }
                        const result = originalExecute.apply(window.hcaptcha, arguments);
                        if (result && typeof result.then === 'function') {
                            result.then(tokenObj => {
                                let token = '';
                                if (typeof tokenObj === 'string') {
                                    token = tokenObj;
                                } else if (tokenObj && typeof tokenObj === 'object') {
                                    token = tokenObj.response || tokenObj.token || '';
                                }
                                if (token && token.startsWith('P1_')) {
                                    // Envia como 'fresh-captcha' - token ainda não consumido
                                    window.postMessage({
                                        source: 'polaryon-injector',
                                        type: 'fresh-captcha',
                                        token
                                    }, '*');
                                }
                            }).catch(() => {});
                        }
                        return result;
                    };
                }
                console.log('%c[POLARYON INJECTED] 🔑 hcaptcha APIs interceptadas!', 'color:#10b981;font-weight:bold;font-size:10px;');
            };

            const initPolaryonHcaptcha = () => {
                if (polaryonWidgetId !== null || !window.hcaptcha || !window.hcaptcha.render) return;
                try {
                    let div = document.getElementById('polaryon-hidden-hcaptcha');
                    if (!div) {
                        div = document.createElement('div');
                        div.id = 'polaryon-hidden-hcaptcha';
                        div.style.position = 'absolute';
                        div.style.left = '-9999px';
                        div.style.top = '-9999px';
                        div.style.width = '1px';
                        div.style.height = '1px';
                        div.style.opacity = '0.01';
                        document.body.appendChild(div);
                    }
                    polaryonWidgetId = window.hcaptcha.render('polaryon-hidden-hcaptcha', {
                        sitekey: 'b8bbded1-9d04-4ace-9952-b67cde081a7b',
                        size: 'invisible',
                        callback: function(tokenObj) {
                            let token = '';
                            if (typeof tokenObj === 'string') {
                                token = tokenObj;
                            } else if (tokenObj && typeof tokenObj === 'object') {
                                token = tokenObj.response || tokenObj.token || '';
                            }
                            if (token && token.startsWith('P1_')) {
                                console.log('%c[POLARYON INJECTED] 🎉 Token programático gerado via widget próprio!', 'color:#10b981;font-weight:bold;font-size:10px;');
                                window.postMessage({
                                    source: 'polaryon-injector',
                                    type: 'fresh-captcha',
                                    token
                                }, '*');
                            }
                        }
                    });
                    console.log('%c[POLARYON INJECTED] 🚀 Widget hcaptcha invisível inicializado com ID = ' + polaryonWidgetId, 'color:#10b981;font-weight:bold;font-size:10px;');
                } catch (err) {
                    console.error('[POLARYON INJECTED] ❌ Falha ao inicializar widget hcaptcha próprio:', err);
                }
            };

            wrapHcaptcha();
            setInterval(() => {
                wrapHcaptcha();
                initPolaryonHcaptcha();
            }, 1500);

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
                const tStart = Date.now();
                const response = await originalFetch(...args);
                const tEnd = Date.now();
                const url = typeof args[0] === 'string' ? args[0] : args[0].url;
                const captchaMatch = url.match(/[?&]captcha\d*=([^&]+)/);
                if (captchaMatch) {
                    window.postMessage({
                        source: 'polaryon-injector',
                        type: 'captcha',
                        token: decodeURIComponent(captchaMatch[1])
                    }, '*');
                }
                const isSerpro = url.includes('serpro.gov.br') || url.includes('/comprasnet-') || url.includes('/compras/') || window.location.hostname.includes('serpro.gov.br') || url.includes('/classificacao') || url.includes('comprasnet/classificacao');
                if (isSerpro) {
                    if (response.ok) {
                        const dateHeader = response.headers.get('Date') || response.headers.get('date') || '';
                        const clone = response.clone();
                        clone.json()
                            .then(data => processSerproData(data, url, response.status, response.ok, dateHeader, tStart, tEnd))
                            .catch(() => {
                                clone.text().then(text => processSerproData(text, url, response.status, response.ok, dateHeader, tStart, tEnd)).catch(() => {});
                            });
                    } else if (response.status === 403 && url.includes('/lances/por-participante')) {
                        window.postMessage({
                            source: 'polaryon-injector',
                            type: 'captcha-error',
                            status: response.status
                        }, '*');
                    } else if (response.status === 429) {
                        window.postMessage({
                            source: 'polaryon-injector',
                            type: '429-error',
                            status: response.status
                        }, '*');
                    }
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
                this._tStart = Date.now();
                this.addEventListener('load', function() {
                    const tEnd = Date.now();
                    const tStart = this._tStart || tEnd;
                    const captchaMatch = this._url && this._url.match(/[?&]captcha\d*=([^&]+)/);
                    if (captchaMatch) {
                        window.postMessage({
                            source: 'polaryon-injector',
                            type: 'captcha',
                            token: decodeURIComponent(captchaMatch[1])
                        }, '*');
                    }
                    const isSerpro = this._url && (this._url.includes('serpro.gov.br') || this._url.includes('/comprasnet-') || this._url.includes('/compras/') || window.location.hostname.includes('serpro.gov.br') || this._url.includes('/classificacao') || this._url.includes('comprasnet/classificacao'));
                    if (isSerpro) {
                        if (this.status === 429) {
                            window.postMessage({
                                source: 'polaryon-injector',
                                type: '429-error',
                                status: this.status
                            }, '*');
                        }
                        const dateHeader = this.getResponseHeader('Date') || this.getResponseHeader('date') || '';
                        try {
                            const data = JSON.parse(this.responseText);
                            processSerproData(data, this._url, this.status, this.status >= 200 && this.status < 300, dateHeader, tStart, tEnd);
                        } catch (e) {
                            processSerproData(this.responseText, this._url, this.status, this.status >= 200 && this.status < 300, dateHeader, tStart, tEnd);
                        }
                    }
                });
                return send.apply(this, arguments);
            };
        // 🏆 Ranking fetch handler: triggered by preload via DOM event.
        // Uses the page's originalFetch (with credentials/cookies) instead of preload's isolated fetch.
        document.addEventListener('polaryon-fetch-ranking', async (e) => {
            const { url } = e.detail || {};
            if (!url) return;
            try {
                const xsrfCookie = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
                const xsrfToken = xsrfCookie ? xsrfCookie.split('=')[1] : '';
                console.log('%c[POLARYON INJECTED] 🌐 Fetch ranking (page context): ' + url.substring(0,100) + '...', 'color:#888;font-size:10px;');
                const res = await originalFetch(url, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'x-device-platform': 'web',
                        'x-version-number': '6.0.2',
                        ...(sessionToken ? { 'Authorization': sessionToken } : {}),
                        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {})
                    }
                });
                const body = await res.text();
                console.log('%c[POLARYON INJECTED] ✅ Ranking response: status=' + res.status + ' body(' + body.length + 'B)', 'color:' + (res.ok ? '#10b981' : '#f59e0b') + ';font-size:10px;');
                
                if (!res.ok) {
                    if (res.status === 403) {
                        window.postMessage({ source: 'polaryon-injector', type: 'captcha-error', status: res.status }, '*');
                    } else if (res.status === 429) {
                        window.postMessage({ source: 'polaryon-injector', type: '429-error', status: res.status }, '*');
                    }
                }

                let data;
                try { data = JSON.parse(body); } catch(err) { data = body; }
                // Extrai segundosParaEncerramento antes de postar (ranking loop não passa pelo fetch override)
                if (typeof data === 'object' && data !== null) {
                    extractEndTime(data);
                }
                window.postMessage({ source: 'polaryon-injector', type: 'serpro-data', data, url, status: res.status, ok: res.ok, savedSegundos: savedSegundos, savedTimestamp: savedTimestamp }, '*');
            } catch(err) {
                console.error('[POLARYON INJECTED] ❌ Ranking fetch error:', err);
                window.postMessage({ source: 'polaryon-injector', type: 'captcha-error', error: err.message }, '*');
            }
        });

        // ⚡ Dispara hcaptcha programaticamente sob demanda
        document.addEventListener('polaryon-trigger-hcaptcha', async () => {
            if (!window.hcaptcha || !window.hcaptcha.execute) {
                console.warn('[POLARYON INJECTED] ⚠️ window.hcaptcha não disponível ou sem suporte a execute.');
                return;
            }
            try {
                // Prioriza nosso widget invisível próprio, depois o interceptado do Angular, depois o ID padrão 0
                const widgetId = polaryonWidgetId !== null ? polaryonWidgetId : (lastWidgetId !== null ? lastWidgetId : 0);
                console.log('%c[POLARYON INJECTED] ⚡ hcaptcha.execute disparado para widgetId = ' + widgetId, 'color:#a855f7;font-weight:bold;font-size:10px;');
                
                const result = window.hcaptcha.execute(widgetId, { async: true });
                if (result && typeof result.then === 'function') {
                    const tokenObj = await result;
                    let token = '';
                    if (typeof tokenObj === 'string') {
                        token = tokenObj;
                    } else if (tokenObj && typeof tokenObj === 'object') {
                        token = tokenObj.response || tokenObj.token || '';
                    }

                    if (token && token.startsWith('P1_')) {
                        console.log('%c[POLARYON INJECTED] 🎉 Token programático gerado: ' + token.substring(0, 30) + '...', 'color:#10b981;font-weight:bold;font-size:10px;');
                        window.postMessage({
                            source: 'polaryon-injector',
                            type: 'fresh-captcha',
                            token
                        }, '*');
                    }
                }
            } catch (err) {
                console.error('[POLARYON INJECTED] ❌ Falha ao disparar hcaptcha programático:', err.message || err);
            }
        });
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
                    const uasg = String(uasgMatch[1]).padStart(6, '0');
                    
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

    // ⚡ LOOP DE FUNDO ADAPTATIVO — MODO GUERRA DE LANCES (v3.8.70)
    // Detecta rajadas de lances (valorAtual mudando a cada ciclo) e acelera para 150ms.
    // Volta ao ritmo normal (800ms) quando o mercado estabiliza. Anti-429 em modo passivo (3000ms).
    let currentIndex = 0;
    let consecutiveLoopFailures = 0;
    const _loopLastBestValues = new Map();  // purchaseId → valorAtual anterior
    const _loopWarCycles = new Map();       // purchaseId → contador de ciclos em guerra

    async function _adaptiveLoop() {
        if (!shared.sessionToken || shared.synchronizedPurchases.size === 0) {
            setTimeout(_adaptiveLoop, 3000);
            return;
        }

        const purchaseIds = Array.from(shared.synchronizedPurchases);
        const batchSize = Math.min(3, purchaseIds.length);
        let anyWar = false;

        for (let b = 0; b < batchSize; b++) {
            const purchaseId = purchaseIds[currentIndex % purchaseIds.length];
            currentIndex++;

            try {
                const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
                const tStart = Date.now();
                const res = await fetch(url, {
                    headers: {
                        'Authorization': shared.sessionToken,
                        'Accept': 'application/json',
                        'x-device-platform': 'web',
                        'x-version-number': '6.0.2'
                    }
                });
                const tEnd = Date.now();

                if (res.ok) {
                    consecutiveLoopFailures = 0;
                    const data = await res.json();
                    const dateHeader = res.headers.get('Date') || res.headers.get('date') || '';

                    // ⚡ Detecta guerra de lances: valorAtual mudou desde o ciclo anterior?
                    const items = Array.isArray(data) ? data : (data.itens || []);
                    for (const it of items) {
                        const best = it.melhorValorGeral ? (it.melhorValorGeral.valorCalculado ?? 0) : 0;
                        const prev = _loopLastBestValues.get(purchaseId + '_' + (it.identificador || it.numero));
                        if (prev !== undefined && prev !== best && best > 0) {
                            _loopWarCycles.set(purchaseId, (_loopWarCycles.get(purchaseId) || 0) + 1);
                            anyWar = true;
                        } else if (prev === best) {
                            const w = _loopWarCycles.get(purchaseId) || 0;
                            if (w > 0) _loopWarCycles.set(purchaseId, w - 1);
                        }
                        _loopLastBestValues.set(purchaseId + '_' + (it.identificador || it.numero), best);
                    }

                    processSerproData(data, url, res.status, res.ok, dateHeader, tStart, tEnd);
                } else if (res.status === 401 || res.status === 403) {
                    consecutiveLoopFailures++;
                    console.warn(`[POLARYON LOOP] ⚠️ Erro de autenticação (${res.status}) na sala ${purchaseId}. Falha ${consecutiveLoopFailures}/3.`);
                    if (consecutiveLoopFailures >= 3) {
                        consecutiveLoopFailures = 0;
                        shared.sessionToken = '';
                        ipcRenderer.send('portal-error', {
                            sessionId: 'GLOBAL',
                            error: 'Sessão Expirada. Por favor, reautentique com o Gov.br.',
                            code: res.status,
                            action: 'REQUIRE_REAUTH'
                        });
                    }
                } else if (res.status === 422) {
                    console.log(`[POLARYON LOOP] ⏳ Sala aguardando início ou pausada (422): ${purchaseId}. Mantendo no radar...`);
                } else if (res.status === 404) {
                    shared.synchronizedPurchases.delete(purchaseId);
                    console.warn(`[POLARYON LOOP] 🛡️ Sala auto-removida por não existir (${res.status}): ${purchaseId}`);
                }
            } catch (e) {
                console.error(`[POLARYON LOOP] Falha ao atualizar sala ${purchaseId}:`, e);
            }
        } // fim do batch

        // ⚡ Intervalo adaptativo — modo guerra acelera para 50ms (vs WebSocket do Siga)
        const warLevel = Math.max(...Array.from(_loopWarCycles.values()), 0);
        const nextMs = warLevel >= 3 ? 50 : (warLevel >= 2 ? 100 : (warLevel >= 1 ? 300 : 3000));
        if (warLevel >= 2) console.log(`%c[POLARYON LOOP] ⚔️ GUERRA DE LANCES! Polling=${nextMs}ms (war=${warLevel})`, 'color:#f59e0b;font-weight:bold;');
        setTimeout(_adaptiveLoop, nextMs);
    }
    _adaptiveLoop();

    // =========================================================================
    // 🔍 SCANNER PROATIVO DE PARTICIPAÇÕES (v3.7.4)
    // Busca TODAS as salas em disputa a cada 30s, independente do interceptor.
    // Garante que salas abertas ANTES do login sejam capturadas automaticamente.
    // =========================================================================
    async function proactiveScanRooms() {
        if (!shared.sessionToken) return;
        try {
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/participacoes?tamanhoPagina=50&pagina=0&filtro=4`;
            const tStart = Date.now();
            const res = await fetch(url, {
                headers: {
                    'Authorization': shared.sessionToken,
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                },
                signal: AbortSignal.timeout(15000)
            });
            const tEnd = Date.now();
            if (res.ok) {
                 const data = await res.json();
                 console.log(`%c[POLARYON SCAN] 🔍 Varredura proativa de participações concluída.`, 'color: #6366f1; font-size: 10px;');
                 const dateHeader = res.headers.get('Date') || res.headers.get('date') || '';
                 processSerproData(data, url, res.status, res.ok, dateHeader, tStart, tEnd);
            }
        } catch (e) {
            // Silencioso
        }
    }

    // Primeiro scan com delay de 5s (aguarda token) e depois a cada 30s
    setTimeout(() => {
        proactiveScanRooms();
        setInterval(proactiveScanRooms, 30000);
    }, 5000);

    // =========================================================================
    // 💓 SISTEMA DE HEARTBEAT - MANTÉM A SESSÃO VIVA INDEFINIDAMENTE (v3.7.2)
    // =========================================================================
    // O SIGA Pregão nunca desconecta porque faz polling contínuo. Nós fazemos o mesmo:
    // A cada 90 segundos enviamos um ping silencioso à API do Serpro usando o token ativo.
    // Isso renova o TTL do JWT/sessão no servidor e impede o timeout por inatividade.
    // =========================================================================
    let keepAliveConsecutiveFailures = 0;
    const KEEPALIVE_INTERVAL_MS = 30000; // 30 segundos (Super Estabilidade Anti-Queda)
    const KEEPALIVE_MAX_FAILURES = 5;    // 5 falhas consecutivas = pede re-auth

    async function sendKeepAlive() {
        if (!shared.sessionToken) return; // Sem token, não há o que manter

        try {
            // 1. Ping leve na API do Serpro (endpoint de participações com paginação mínima)
            const pingUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/participacoes?tamanhoPagina=1&pagina=0&filtro=4`;
            const res = await fetch(pingUrl, {
                method: 'GET',
                headers: {
                    'Authorization': shared.sessionToken,
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                },
                signal: AbortSignal.timeout(15000) // Timeout de 15s
            });

            if (res.ok || res.status === 404 || res.status === 422) {
                // Qualquer resposta válida (mesmo 404/422 = token aceito, apenas sem dados)
                keepAliveConsecutiveFailures = 0;
                console.log(`%c[POLARYON HEARTBEAT] ❤️ Sessão Viva! Ping às ${new Date().toLocaleTimeString()}`, 'color: #10b981; font-size: 10px;');
            } else if (res.status === 401 || res.status === 403) {
                keepAliveConsecutiveFailures++;
                console.warn(`[POLARYON HEARTBEAT] ⚠️ Token expirado ou rejeitado (${res.status}). Falha ${keepAliveConsecutiveFailures}/${KEEPALIVE_MAX_FAILURES}`);
                
                if (keepAliveConsecutiveFailures >= KEEPALIVE_MAX_FAILURES) {
                    keepAliveConsecutiveFailures = 0;
                    shared.sessionToken = '';
                    ipcRenderer.send('portal-error', {
                        sessionId: 'HEARTBEAT',
                        error: 'Sessão expirada por inatividade. Por favor, reautentique com o Gov.br.',
                        code: res.status,
                        action: 'REQUIRE_REAUTH'
                    });
                    console.error('[POLARYON HEARTBEAT] 🔴 Sessão encerrada definitivamente. Re-autenticação necessária.');
                }
            } else {
                console.warn(`[POLARYON HEARTBEAT] ⚠️ Status inesperado: ${res.status}`);
            }
        } catch (err) {
            if (err.name === 'AbortError' || err.name === 'TimeoutError') {
                console.warn('[POLARYON HEARTBEAT] ⏰ Timeout no ping. Rede lenta? Continuando...');
            } else {
                keepAliveConsecutiveFailures++;
                console.warn(`[POLARYON HEARTBEAT] ❌ Falha de rede no heartbeat:`, err.message);
                if (keepAliveConsecutiveFailures >= KEEPALIVE_MAX_FAILURES) {
                    keepAliveConsecutiveFailures = 0;
                    ipcRenderer.send('portal-error', {
                        sessionId: 'HEARTBEAT',
                        error: 'Conexão com o Serpro perdida. Verifique sua internet.',
                        code: 0,
                        action: 'REQUIRE_REAUTH'
                    });
                }
            }
        }
    }

    // 2. Ping de renovação de cookies Gov.br (fetch silencioso para manter o SSO vivo)
    async function renewGovBrSession() {
        try {
            await fetch('https://www.comprasnet.gov.br/main.asp', {
                method: 'GET',
                credentials: 'include',
                mode: 'no-cors',
                signal: AbortSignal.timeout(10000)
            });
            console.log('%c[POLARYON HEARTBEAT] 🔄 Sessão Gov.br renovada silenciosamente (main.asp).', 'color: #6366f1; font-size: 10px;');
        } catch (e) {
            // Silencioso — falha no Gov.br não é crítica
        }
    }

    // Inicia o heartbeat com 30s de delay inicial (aguarda o token ser capturado primeiro)
    setTimeout(() => {
        // Primeiro ping
        sendKeepAlive();
        renewGovBrSession();

        // Loop de manutenção contínua
        setInterval(() => {
            sendKeepAlive();
            renewGovBrSession();
        }, KEEPALIVE_INTERVAL_MS);

    }, 30000);

    console.log('%c[POLARYON HEARTBEAT] 💓 Sistema de Keep-Alive ativado (ping a cada 90s)', 'color: #6366f1; font-weight: bold;');
    // =========================================================================
})();
