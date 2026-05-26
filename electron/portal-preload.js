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
        lastClassificacaoClickTs: 0
    };
    // Staggered room-fetch delay counter (anti-429). Resets after all rooms queued.
    let _roomFetchDelayMs = 0;
    try {
        if (window.top) {
            if (!window.top._polaryonSharedState) {
                window.top._polaryonSharedState = {
                    sessionToken: '',
                    captchaToken: '',
                    synchronizedPurchases: new Set(),
                    lastClassificacaoClickTs: 0
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

    // 🎯 O GATILHO KAMIKAZE: Envia o lance utilizando o Bypass de Captcha do Siga
    ipcRenderer.on('manual-bid', async (event, { purchaseId, itemId, value }) => {
        // Ignora disparos se a janela atual não corresponder à compra selecionada
        const currentUrl = window.location.href;
        if (!currentUrl.includes(purchaseId)) {
            return;
        }

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
            // 🔥 FILTRO INTELIGENTE ULTRA-RIGOROSO: Ignora abas "Em Andamento" ou "Agendadas"
            // e foca unicamente nas salas ativas em disputa (situacao=3 ou contendo "DISPUTA")
            const isDisputaQuery = url.includes('situacao=3') || url.includes('situacao=EM_DISPUTA') || url.includes('fase=disputa') || url.includes('situacao=disputa');
            const hasOtherFilters = url.includes('situacao=1') || url.includes('situacao=2') || url.includes('situacao=4') || url.includes('AGENDADA') || url.includes('EM_ANDAMENTO') || url.includes('ENCERRADA');
            
            if (hasOtherFilters && !isDisputaQuery) {
                console.log(`%c[POLARYON] Ignorando participações fora da aba de Disputa Ativa: ${url}`, "color: #94a3b8; font-size: 10px; font-weight: bold;");
                return;
            }

            const listObj = Array.isArray(data) ? data : (data.itens || []);
            listObj.forEach(p => {
                // Filtro individual rigoroso por qualquer campo de situação presente no objeto
                const situacaoRaw = p.situacao || (p.compra && p.compra.situacao) || p.situacaoCompra || (p.compra && p.compra.situacaoCompra) || p.situacaoParticipacao || '';
                const situacaoStr = String(situacaoRaw).toUpperCase();
                
                if (situacaoRaw) {
                    // ✅ Aceita apenas EM_DISPUTA / DISPUTA (código 3) — exclui DISPUTA_ENCERRADA explicitamente
                    const isDisputa = (situacaoStr.includes('DISPUTA') || situacaoStr === '3') && !situacaoStr.includes('ENCERRADA') && !situacaoStr.includes('ENCERRADO');
                    if (!isDisputa) {
                        return; // Descarte imediato
                    }
                } else {
                    // Sem campos de situação, descarta preventivamente se a consulta for de outra aba
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
                        console.log(`%c[POLARYON DETECTOR] 🎯 Nova sala em disputa detectada: ${purchaseId}`, "color: #10b981; font-weight: bold;");
                        
                        // Notifica o processo Electron principal sobre a nova sala
                        ipcRenderer.send('portal-detected-room', { url: `compra=${purchaseId}` });

                        // ⚡ BUSCA IMEDIATA — não espera o round-robin
                        if (shared.sessionToken) {
                            const roomUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/em-disputa`;
                            fetch(roomUrl, {
                                headers: {
                                    'Authorization': shared.sessionToken,
                                    'Accept': 'application/json',
                                    'x-device-platform': 'web',
                                    'x-version-number': '6.0.2'
                                }
                            }).then(r => r.ok ? r.json().then(d => processSerproData(d, roomUrl)) : null)
                              .catch(() => {});
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
                        purchaseId: roomCode,
                        valorAtual: it.melhorValorGeral ? it.melhorValorGeral.valorCalculado : it.melhorLance,
                        meuValor: it.melhorValorFornecedor ? it.melhorValorFornecedor.valorCalculado : it.valorLanceProposta,
                        status: it.faseTraduzido || it.fase,
                        posicao: it.classificacao || it.posicao || (it.melhorValorFornecedor && (it.melhorValorFornecedor.classificacao || it.melhorValorFornecedor.posicao)) || it.situacaoParticipanteDisputaTraduzido || (it.situacaoParticipanteDisputa === 'G' ? 'GANHANDO' : 'PERDENDO'),
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
        if (!shared.sessionToken) return;
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
                console.log(`%c[POLARYON AUTO FETCH] ✅ ${purchaseId}: ${Array.isArray(data) ? data.length + ' itens' : 'OK'}`, 'color: #10b981; font-size: 10px;');
                processSerproData(data, url);
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

    // 🔄 LOOP PROATIVO DE RANKING: a cada 5s busca ranking dos itens ativos usando o token já capturado.
    // Usa uma estratégia híbrida: fetch silencioso em background se tiver captcha, ou clique programático se não tiver.
    let rankingRoundRobin = 0;
    const activeRankingItems = []; // { purchaseId, itemId }
    setInterval(() => {
        if (!shared.sessionToken) {
            console.log('%c[POLARYON RANKING LOOP] ⏳ Aguardando token...', 'color: #f59e0b; font-size: 10px;');
            return;
        }
        if (activeRankingItems.length === 0) {
            console.log('%c[POLARYON RANKING LOOP] ⏳ Nenhum item ativo ainda. Aguardando dados da sala...', 'color: #f59e0b; font-size: 10px;');
            return;
        }

        const target = activeRankingItems[rankingRoundRobin % activeRankingItems.length];
        rankingRoundRobin++;

        // 🎯 ESTRATÉGIA 1 (FORNECEDOR com captcha disponível):
        // NÃO reutilizamos o token (causaria 204). Em vez disso, clicamos na aba para que
        // o Angular gere um token fresco e faça a chamada — o fetch interceptor captura a resposta 200.
        const now = Date.now();
        const hasCaptcha = shared.captchaToken && shared.captchaToken.startsWith('P1_');
        if (hasCaptcha) {
            // Limpa o token (não reusamos — Angular fará chamada própria)
            shared.captchaToken = '';
            // Cai para a estratégia de clique de aba abaixo
        }

        // 🎯 ESTRATÉGIA 2: Fetch direto SEM captcha (funciona para usuários GOVERNO)
        const fetchCooldown = 8000;
        if (!hasCaptcha && now - (shared.lastDirectFetchTs || 0) >= fetchCooldown) {
            shared.lastDirectFetchTs = now;
            const urlDirect = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${target.purchaseId}/itens/${target.itemId}/lances/por-participante?tamanhoPagina=50&pagina=0`;
            console.log(`%c[POLARYON RANKING LOOP] 🔓 Fetch sem captcha para item ${target.itemId} (tentativa GOVERNO/cookie)`, 'color:#6366f1;font-size:10px;');
            document.dispatchEvent(new CustomEvent('polaryon-fetch-ranking', {
                detail: { url: urlDirect, purchaseId: target.purchaseId, itemId: target.itemId }
            }));
            return;
        }

        // 🎯 ESTRATÉGIA 3: Clique na aba para acionar o Angular (que gera captcha fresco e faz a chamada)
        // O fetch interceptor captura a resposta 200 automaticamente.
        const cooldown = hasCaptcha ? 3000 : 12000; // Clique mais freqüente se captcha disponível
        if (now - (shared.lastClassificacaoClickTs || 0) < cooldown) {
            return;
        }

        shared.lastClassificacaoClickTs = now;
        console.log('%c[POLARYON RANKING LOOP] 🖱️ Executando clique programático na aba Classificação para item ' + target.itemId + '...', 'color: #6366f1; font-weight: bold; font-size: 11px;');
        
        try {
            const selectors = [
                '[role="tab"]',
                '.mat-tab-label',
                '.mat-mdc-tab',
                '.nav-link',
                'button',
                'a',
                '.mat-tab-link'
            ];
            
            let classTab = null;
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    const text = (el.textContent || el.innerText || '').trim();
                    const textLower = text.toLowerCase();
                    if (
                        text === 'Classificação' || 
                        text === 'Classificacao' || 
                        textLower.includes('classifica') || 
                        textLower.includes('melhores') || 
                        textLower.includes('valores') || 
                        (textLower.includes('fornecedor') && text.length < 40)
                    ) {
                        classTab = el;
                        break;
                    }
                }
                if (classTab) break;
            }
            
            if (!classTab) {
                const allElements = document.querySelectorAll('span, div');
                for (const el of allElements) {
                    const text = (el.textContent || el.innerText || '').trim();
                    const textLower = text.toLowerCase();
                    if (
                        text === 'Classificação' || 
                        text === 'Classificacao' || 
                        textLower.includes('classifica') || 
                        textLower.includes('melhores') || 
                        textLower.includes('valores') || 
                        (textLower.includes('fornecedor') && text.length < 40)
                    ) {
                        let parent = el;
                        while (parent && parent !== document.body) {
                            const role = parent.getAttribute('role');
                            const tagName = parent.tagName.toLowerCase();
                            const className = parent.className || '';
                            if (role === 'tab' || tagName === 'button' || tagName === 'a' || className.includes('tab') || className.includes('link')) {
                                classTab = parent;
                                break;
                            }
                            parent = parent.parentElement;
                        }
                        if (classTab) break;
                    }
                }
            }

            if (classTab) {
                console.log('%c[POLARYON PRELOAD] 🖱️ Clicando na aba Classificação...', 'color:#6366f1;font-weight:bold;font-size:11px;');
                classTab.click();
            } else {
                console.log('%c[POLARYON PRELOAD] ⚠️ Aba Classificação não encontrada para clique.', 'color:#f59e0b;font-size:10px;');
            }
        } catch (err) {
            console.error('[POLARYON PRELOAD] ❌ Erro ao clicar na aba Classificação:', err);
        }
    }, 5000);

    function processSerproData(data, url, status, ok) {
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
                                    const r = await fetch(roomUrl, { headers: { 'Authorization': shared.sessionToken, 'Accept': 'application/json', 'x-device-platform': 'web', 'x-version-number': '6.0.2' } });
                                    if (r.ok) {
                                        const d = await r.json();
                                        processSerproData(d, roomUrl);
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

        if (items.length > 0 && roomCode) {
            // 🏆 Registra itens ativos para o loop de ranking
            items.forEach(it => {
                const itemIdStr = String(it.numero || it.identificador);
                const faseItem = (it.faseTraduzido || it.fase || '').toUpperCase();
                const isEncerrado = faseItem.includes('ENCERRAD') || faseItem.includes('FINALIZ') || faseItem.includes('CANCEL');
                if (!isEncerrado && itemIdStr) {
                    const alreadyTracked = activeRankingItems.some(r => r.purchaseId === roomCode && r.itemId === itemIdStr);
                    if (!alreadyTracked) {
                        activeRankingItems.push({ purchaseId: roomCode, itemId: itemIdStr });
                        console.log(`%c[POLARYON RANKING LOOP] ➕ Item ${itemIdStr} (compra: ${roomCode}) adicionado ao radar de ranking. Total: ${activeRankingItems.length}`, 'color: #6366f1; font-weight: bold; font-size: 11px;');
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
                    return {
                        itemId: String(it.numero || it.identificador),
                        purchaseId: roomCode,
                        valorAtual,
                        meuValor,
                        ganhador: posFinal === '1' || posFinal === 'GANHANDO' ? 'Você' : 'Outro',
                        status: it.faseTraduzido || it.fase || (it.situacaoItem || ''),
                        posicao: posFinal,
                        timerSeconds: it.segundosParaEncerramento || -1,
                        dataHoraFimContagem: it.dataHoraFimContagem,
                        officialMargin: it.variacaoMinimaEntreLances || 1,
                        officialMarginType: it.tipoVariacaoMinimaEntreLances || 'V',
                        desc: it.descricao
                    };
                });
                ipcRenderer.send('send-portal-data', {
                    type: 'portal-sync',
                    roomCode: roomCode,
                    timestamp: Date.now(),
                    items: mappedItems
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
                processSerproData(data, url, status, ok);
            } else if (type === 'captcha-error') {
                console.log('%c[POLARYON] ⚠️ Captcha rejeitado/expirado (403/Forbidden). Limpando token...', 'color:#f59e0b;font-weight:bold;font-size:11px;');
                shared.captchaToken = null;
            } else if (type === 'fresh-captcha') {
                // 🔑 Token FRESCO: interceptado ANTES do Angular consumir
                // O Angular vai usar para fazer a chamada legítima, que nosso interceptor captura automaticamente.
                // Também armazenamos para uso no PRÓXIMO ciclo se o interceptor não capturar.
                if (token && token.startsWith('P1_')) {
                    shared.captchaToken = token;
                    console.log('%c[POLARYON] 🔑 Token FRESCO interceptado antes do Angular! Aguardando resposta da chamada legítima...', 'color:#10b981;font-weight:bold;font-size:11px;');
                    // Não consumimos o token aqui — o Angular vai usar e o fetch interceptor captura a resposta 200
                }
            }
        }
    });



    // Injeta o interceptor de rede na página
    try {
        const scriptContent = `
        (function() {
            let sessionToken = '';
            
            function processSerproData(data, url, status, ok) {
                window.postMessage({
                    source: 'polaryon-injector',
                    type: 'serpro-data',
                    data,
                    url,
                    status,
                    ok
                }, '*');
            }

            // 🔑 INTERCEPTA hcaptcha.execute() ANTES de qualquer consumo pelo Angular
            // Captura o token P1_ fresco no momento de geração, não após uso
            let _hcaptchaWrapped = false;
            const wrapHcaptcha = () => {
                if (_hcaptchaWrapped || !window.hcaptcha || !window.hcaptcha.execute) return;
                _hcaptchaWrapped = true;
                const originalExecute = window.hcaptcha.execute;
                window.hcaptcha.execute = function(widgetId, options) {
                    const result = originalExecute.apply(window.hcaptcha, arguments);
                    if (result && typeof result.then === 'function') {
                        result.then(token => {
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
                console.log('%c[POLARYON INJECTED] 🔑 hcaptcha.execute interceptado!', 'color:#10b981;font-weight:bold;font-size:10px;');
            };
            wrapHcaptcha();
            setInterval(wrapHcaptcha, 1500);

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
                        const clone = response.clone();
                        clone.json()
                            .then(data => processSerproData(data, url, response.status, response.ok))
                            .catch(() => {
                                clone.text().then(text => processSerproData(text, url, response.status, response.ok)).catch(() => {});
                            });
                    } else if (response.status === 403 && url.includes('/lances/por-participante')) {
                        window.postMessage({
                            source: 'polaryon-injector',
                            type: 'captcha-error',
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
                this.addEventListener('load', function() {
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
                        try {
                            const data = JSON.parse(this.responseText);
                            processSerproData(data, this._url, this.status, this.status >= 200 && this.status < 300);
                        } catch (e) {
                            processSerproData(this.responseText, this._url, this.status, this.status >= 200 && this.status < 300);
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
                    }
                }

                let data;
                try { data = JSON.parse(body); } catch(err) { data = body; }
                window.postMessage({ source: 'polaryon-injector', type: 'serpro-data', data, url, status: res.status, ok: res.ok }, '*');
            } catch(err) {
                console.error('[POLARYON INJECTED] ❌ Ranking fetch error:', err);
                window.postMessage({ source: 'polaryon-injector', type: 'captcha-error', error: err.message }, '*');
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

    // LOOP DE FUNDO DE AUTO-SINCRONIZAÇÃO EM TEMPO REAL COM PREVENÇÃO DE 429 (v3.6.89)
    // Distribui as consultas em Round-Robin (1 sala a cada 3 segundos) para nunca sobrecarregar a API do Serpro
    let currentIndex = 0;
    let consecutiveLoopFailures = 0;
    setInterval(async () => {
        if (!shared.sessionToken || shared.synchronizedPurchases.size === 0) return;
        
        const purchaseIds = Array.from(shared.synchronizedPurchases);
        // Processa até 3 salas por tick para salas grandes (ex: 10 salas = ~10s para ciclo completo)
        const batchSize = Math.min(3, purchaseIds.length);
        for (let b = 0; b < batchSize; b++) {
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
                consecutiveLoopFailures = 0; // Reset na tolerância
                const data = await res.json();
                processSerproData(data, url);
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
                // Auto-limpeza apenas se a sala realmente não existir
                shared.synchronizedPurchases.delete(purchaseId);
                console.warn(`[POLARYON LOOP] 🛡️ Sala auto-removida por não existir (${res.status}): ${purchaseId}`);
            }
        } catch (e) {
            console.error(`[POLARYON LOOP] Falha ao atualizar sala ${purchaseId}:`, e);
        }
        } // fim do batch
    }, 3000);

    // =========================================================================
    // 🔍 SCANNER PROATIVO DE PARTICIPAÇÕES (v3.7.4)
    // Busca TODAS as salas em disputa a cada 30s, independente do interceptor.
    // Garante que salas abertas ANTES do login sejam capturadas automaticamente.
    // =========================================================================
    async function proactiveScanRooms() {
        if (!shared.sessionToken) return;
        try {
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/participacoes?tamanhoPagina=50&pagina=0&filtro=4`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': shared.sessionToken,
                    'Accept': 'application/json',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                },
                signal: AbortSignal.timeout(15000)
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`%c[POLARYON SCAN] 🔍 Varredura proativa de participações concluída.`, 'color: #6366f1; font-size: 10px;');
                processSerproData(data, url);
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
