const axios = require('axios');
const https = require('https');
const { ipcMain, session } = require('electron');

/**
 * CaptchaManager - Bypass Automático via Nuvem Siga
 */
class CaptchaManager {
    constructor() {
        this.token1 = '';
        this.token2 = '';
        this.lastFetch = 0;
        this.fetchPromise = null;
    }

    async getTokens() {
        const now = Date.now();
        if (now - this.lastFetch > 180000) { // Renova a cada 3 minutos
            if (!this.fetchPromise) {
                this.fetchPromise = this._fetchTokens().finally(() => {
                    this.fetchPromise = null;
                });
            }
            if (!this.token1) {
                await this.fetchPromise;
            }
        }
        return { captcha1: this.token1, captcha2: this.token2, captcha3: this.token1 };
    }

    async getFreshToken() {
        try {
            const headers = {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'pt-BR',
                'origin': 'https://disputas.sigapregao.com.br',
                'referer': 'https://disputas.sigapregao.com.br/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2 Chrome/112.0.5615.165 Electron/24.1.3 Safari/537.36'
            };
            const res = await axios.get('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers, timeout: 5000 });
            if (res.data) {
                return res.data;
            }
        } catch (e) {
            console.error('[POLARYON] Erro ao obter captcha avulso do Siga:', e.message);
        }

        try {
            const fallbackRes = await axios.get('https://polaryon.com.br/api/bidding/captcha-pool', { timeout: 4000 });
            if (fallbackRes.data && fallbackRes.data.success && fallbackRes.data.captcha1) {
                return fallbackRes.data.captcha1;
            }
        } catch (err) {
            console.error('[POLARYON] Erro no fallback de captcha avulso:', err.message);
        }

        return this.token1;
    }

    async _fetchTokens() {
        try {
            const headers = {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'pt-BR',
                'origin': 'https://disputas.sigapregao.com.br',
                'referer': 'https://disputas.sigapregao.com.br/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2 Chrome/112.0.5615.165 Electron/24.1.3 Safari/537.36'
            };
            
            const [res1, res2] = await Promise.all([
                axios.get('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers, timeout: 6000 }).catch(() => ({data: ''})),
                axios.get('https://capgen.sigapregao.com.br/capgen/captcha-dispensas-2', { headers, timeout: 6000 }).catch(() => ({data: ''}))
            ]);

            if (res1.data) this.token1 = res1.data;
            if (res2.data) this.token2 = res2.data;

            // Fallback de Captcha Seguro Polaryon
            if (!this.token1 || !this.token2) {
                console.warn('[POLARYON] ⚠️ Captchas primários falharam! Ativando Fallback de Captcha Seguro Polaryon...');
                try {
                    const fallbackRes = await axios.get('https://polaryon.com.br/api/bidding/captcha-pool', {
                        timeout: 5000
                    });
                    if (fallbackRes.data && fallbackRes.data.success) {
                        if (!this.token1 && fallbackRes.data.captcha1) this.token1 = fallbackRes.data.captcha1;
                        if (!this.token2 && fallbackRes.data.captcha2) this.token2 = fallbackRes.data.captcha2;
                        console.log('[POLARYON] 🛡️ Tokens de Captcha obtidos com sucesso do Fallback Seguro Polaryon!');
                    }
                } catch (err) {
                    console.error('[POLARYON] ❌ Falha crítica no Fallback de Captcha Seguro:', err.message);
                }
            }

            this.lastFetch = Date.now();
            console.log('[POLARYON] 🔓 Tokens Captcha Bypass adquiridos com sucesso!');
        } catch (e) {
            console.error('[POLARYON] ❌ Erro ao renovar captchas:', e.message);
        }
    }
}

const captchaManager = new CaptchaManager();

/**
 * ClockSync - Sincronizador de Relógio Atômico v2
 */
class ClockSync {
    constructor() {
        this.serverTimeAtLastUpdate = Date.now();
        this.localTimeAtLastUpdate = Date.now();
    }
    update(serverDateHeader) {
        if (!serverDateHeader) return;
        this.serverTimeAtLastUpdate = new Date(serverDateHeader).getTime();
        this.localTimeAtLastUpdate = Date.now();
    }
    getServerTime() {
        const elapsed = Date.now() - this.localTimeAtLastUpdate;
        return this.serverTimeAtLastUpdate + elapsed;
    }
}

/**
 * RoomRunner v4.1.0 - Radar Global Kamikaze Adaptativo (v3.8.2)
 */
class RoomRunner {
    constructor(idCompra, sessionId, agent, webContents, clockSync, biddingRunner) {
        this.idCompra = idCompra;
        this.sessionId = sessionId;
        this.agent = agent;
        this.webContents = webContents;
        this.clockSync = clockSync;
        this.biddingRunner = biddingRunner;
        this.active = true;
        this.timeoutId = null;
        this.itemRankingsMap = new Map(); // Persist real-time competitor rankings
    }

    async run() {
        if (!this.active) return;

        try {
            const captchas = await captchaManager.getTokens();
            let token = global.serproToken;
            
            if (!token) {
                console.log(`[POLARYON MOTOR] Aguardando o login furtivo capturar o Token Oficial...`);
                this.timeoutId = setTimeout(() => this.run(), 2000);
                return;
            }

            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/em-disputa?configs=false&captcha1=${captchas.captcha1}&captcha2=${captchas.captcha2}&captcha3=${captchas.captcha3}`;
            
            const res = await axios.get(url, {
                httpsAgent: this.agent,
                headers: { 
                    'Authorization': token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                }
            });

            this.clockSync.update(res.headers.date);
            const itemsList = Array.isArray(res.data) ? res.data : (res.data.itens || []);
            
            let minTimer = Infinity;

            if (itemsList.length > 0) {
                const serverNow = this.clockSync.getServerTime();
                const mappedItems = itemsList.map(item => {
                    const itemIdStr = String(item.numero || item.identificador);
                    const cachedRanking = this.itemRankingsMap.get(itemIdStr);
                    
                    const spd = item.situacaoParticipanteDisputa;
                    let posicaoTxt = item.classificacao || item.posicao || (item.melhorValorFornecedor && (item.melhorValorFornecedor.classificacao || item.melhorValorFornecedor.posicao)) || item.situacaoParticipanteDisputaTraduzido || (spd === 'G' ? 'GANHANDO' : (spd === 'P' || spd === 'E' ? 'PERDENDO' : '?'));
                    if (cachedRanking && cachedRanking.realPosicao) {
                        posicaoTxt = cachedRanking.realPosicao;
                    }
                    
                    let secondsLeft = item.segundosParaEncerramento;
                    if (secondsLeft === undefined || secondsLeft === null) {
                        if (item.dataHoraFimContagem) {
                            const endTime = new Date(item.dataHoraFimContagem).getTime();
                            secondsLeft = Math.max(0, (endTime - serverNow) / 1000);
                        } else {
                            secondsLeft = -1;
                        }
                    }

                    // Apenas considera itens ativos na fase de disputa (LA) para aceleração
                    const faseItem = item.fase || 'LA';
                    if (faseItem === 'LA' && secondsLeft >= 0 && secondsLeft < minTimer) {
                        minTimer = secondsLeft;
                    }

                    // 🔧 FIX: Extração correta de valorAtual e meuValor (bug do ternário duplicado)
                    const melhorGeral = item.melhorValorGeral;
                    const melhorFornec = item.melhorValorFornecedor;
                    const valorAtual = melhorGeral
                        ? (melhorGeral.valorCalculado !== undefined && melhorGeral.valorCalculado !== null ? melhorGeral.valorCalculado : (melhorGeral.valorInformado || 0))
                        : 0;
                    const meuValor = melhorFornec
                        ? (melhorFornec.valorCalculado !== undefined && melhorFornec.valorCalculado !== null ? melhorFornec.valorCalculado : (melhorFornec.valorInformado || 0))
                        : 0;

                    return {
                        itemId: itemIdStr,
                        purchaseId: this.idCompra,
                        valorAtual,
                        meuValor,
                        ganhador: posicaoTxt === '1' || posicaoTxt === 'GANHANDO' ? 'Você' : 'Outro',
                        status: item.faseTraduzido || item.fase || 'Em Disputa',
                        posicao: posicaoTxt,
                        timerSeconds: secondsLeft,
                        dataHoraFimContagem: item.dataHoraFimContagem,
                        officialMargin: item.variacaoMinimaEntreLances || 1,
                        officialMarginType: item.tipoVariacaoMinimaEntreLances || 'V',
                        desc: item.descricao,
                        rankingLances: cachedRanking ? cachedRanking.rankingLances : []
                    };
                });

                // Envia a sala COMPLETA para o dashboard
                this.webContents.send('bidding-update', {
                    sessionId: this.sessionId,
                    uasg: this.idCompra.substring(0, 6),
                    sessionTitle: `Disputa Oficial - ${this.idCompra}`,
                    log: `[MOTOR KAMIKAZE] Escaneamento Limpo: ${mappedItems.length} itens detectados.`,
                    items: mappedItems
                });

                // 🏆 RANKING REAL via /lances/por-participante — busca assíncrona sem bloquear o polling
                // Só busca em itens ativos para não gastar cota de rate-limit
                const activeItems = mappedItems.filter(it => {
                    const statusLower = String(it.status).toLowerCase();
                    const isClosed = statusLower.includes('encerrad') || statusLower.includes('finaliz') || statusLower.includes('cancel');
                    return !isClosed;
                });
                if (activeItems.length > 0 && token) {
                    // Limita a 1 item por ciclo para evitar 429
                    const itemToCheck = activeItems[Math.floor(Date.now() / 5000) % activeItems.length];
                    
                    const fetchRanking = async () => {
                        let cookieStr = '';
                        try {
                            const cookies = await session.fromPartition('persist:polaryon-global').cookies.get({ url: 'https://cnetmobile.estaleiro.serpro.gov.br' });
                            cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                        } catch (cookieErr) {
                            console.error('[POLARYON] Erro ao extrair cookies da sessão:', cookieErr.message);
                        }

                        // 🔧 FIX: Tenta 3 variações de URL - sem captcha, com captchaPool, com getFresh
                        const baseHeaders = {
                            'Authorization': token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SIGAClient/0.7.2 Chrome/112.0.5615.165 Electron/24.1.3 Safari/537.36',
                            'x-device-platform': 'web',
                            'x-version-number': '6.0.2',
                            ...(cookieStr ? { 'Cookie': cookieStr } : {})
                        };

                        const poolTokens = await captchaManager.getTokens().catch(() => ({}));
                        const freshToken = await captchaManager.getFreshToken().catch(() => '');
                        console.log(`[POLARYON RANKING] 🎫 captcha1=${poolTokens.captcha1 ? poolTokens.captcha1.substring(0,20)+'...' : 'VAZIO'} | captcha2=${poolTokens.captcha2 ? poolTokens.captcha2.substring(0,20)+'...' : 'VAZIO'} | freshToken=${freshToken ? freshToken.substring(0,20)+'...' : 'VAZIO'}`);

                        const urlVariants = [
                            // Variante 0: com captcha1/2/3 (formato do endpoint /lances)
                            (poolTokens.captcha1 ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/${itemToCheck.itemId}/lances/por-participante?captcha1=${poolTokens.captcha1}&captcha2=${poolTokens.captcha2 || poolTokens.captcha1}&captcha3=${poolTokens.captcha1}&tamanhoPagina=50&pagina=0` : null),
                            // Variante 1: com captcha (singular) via pool
                            (poolTokens.captcha1 ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/${itemToCheck.itemId}/lances/por-participante?captcha=${poolTokens.captcha1}&tamanhoPagina=50&pagina=0` : null),
                            // Variante 2: com token fresco do Siga
                            (freshToken && freshToken !== poolTokens.captcha1 ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/${itemToCheck.itemId}/lances/por-participante?captcha=${freshToken}&tamanhoPagina=50&pagina=0` : null),
                            // Variante 3: sem parâmetro captcha (alguns endpoints aceitam)
                            `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/${itemToCheck.itemId}/lances/por-participante?tamanhoPagina=50&pagina=0`,
                            // Variante 4: /propostas-iniciais (não precisa de captcha!) — ÚLTIMO recurso
                            `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/${this.idCompra}/itens/${itemToCheck.itemId}/propostas-iniciais?tamanhoPagina=50&pagina=0`,
                        ].filter(Boolean);

                        let lancesRes = null;
                        for (const lancesUrl of urlVariants) {
                            try {
                                lancesRes = await axios.get(lancesUrl, {
                                    httpsAgent: this.agent,
                                    timeout: 5000,
                                    headers: baseHeaders
                                });
                                console.log(`[POLARYON RANKING] ✅ URL funcionou (status ${lancesRes.status}): ${lancesUrl.split('?')[1]?.substring(0,40)}`);
                                break;
                            } catch (varErr) {
                                console.warn(`[POLARYON RANKING] ⚠️ Variante falhou (${varErr.response?.status || varErr.message}): ${lancesUrl.split('?')[1]?.substring(0,40)}`);
                            }
                        }
                        if (!lancesRes) {
                            // 🏆 FALLBACK: Tenta o endpoint /classificacao (usado pelo portal ao clicar no botão "Classificação")
                            const classifVariants = [
                                (poolTokens.captcha1 ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/${itemToCheck.itemId}/classificacao?captcha=${poolTokens.captcha1}` : null),
                                (poolTokens.captcha1 ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet/classificacao?codigo=${this.idCompra}&numeroItem=${itemToCheck.itemId}&captcha=${poolTokens.captcha1}` : null),
                                `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/${itemToCheck.itemId}/classificacao`,
                                (freshToken && freshToken !== poolTokens.captcha1 ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet/classificacao?codigo=${this.idCompra}&numeroItem=${itemToCheck.itemId}&captcha=${freshToken}` : null),
                            ].filter(Boolean);
                            for (const classifUrl of classifVariants) {
                                try {
                                    lancesRes = await axios.get(classifUrl, {
                                        httpsAgent: this.agent, timeout: 5000, headers: baseHeaders
                                    });
                                    console.log(`[POLARYON RANKING] ✅ /classificacao funcionou (status ${lancesRes.status}): ${classifUrl.substring(0,100)}`);
                                    break;
                                } catch (classifErr) {
                                    console.warn(`[POLARYON RANKING] ⚠️ /classificacao falhou (${classifErr.response?.status || classifErr.message})`);
                                }
                            }
                        }
                        if (!lancesRes) return;

                        const rawData = lancesRes.data;
                        console.log(`[POLARYON RANKING] 📦 rawData tipo: ${Array.isArray(rawData) ? 'array(' + rawData.length + ')' : typeof rawData} | keys: ${rawData && typeof rawData === 'object' ? Object.keys(rawData).join(',') : 'n/a'}`);

                        let lancesList = [];
                        if (Array.isArray(rawData)) {
                            lancesList = rawData;
                        } else if (rawData) {
                            if (Array.isArray(rawData.itens))           lancesList = rawData.itens;
                            else if (Array.isArray(rawData.lances))      lancesList = rawData.lances;
                            else if (Array.isArray(rawData.conteudo))    lancesList = rawData.conteudo;
                            else if (Array.isArray(rawData.content))     lancesList = rawData.content;
                            else if (Array.isArray(rawData.data))        lancesList = rawData.data;
                            else if (Array.isArray(rawData.records))     lancesList = rawData.records;
                            else if (Array.isArray(rawData.lista))       lancesList = rawData.lista;
                            else if (Array.isArray(rawData.participantes)) lancesList = rawData.participantes;
                            else if (Array.isArray(rawData.fornecedores))  lancesList = rawData.fornecedores;
                            else if (Array.isArray(rawData.resultado))    lancesList = rawData.resultado;
                            else if (rawData.conteudo?.lista && Array.isArray(rawData.conteudo.lista)) lancesList = rawData.conteudo.lista;
                            else if (rawData._embedded && Array.isArray(rawData._embedded.lances)) lancesList = rawData._embedded.lances;
                            else if (rawData._embedded && Array.isArray(rawData._embedded.participantes)) lancesList = rawData._embedded.participantes;
                            else if (rawData._embedded && Array.isArray(rawData._embedded.content)) lancesList = rawData._embedded.content;
                            else {
                                // Último recurso: varre chaves do objeto procurando qualquer array
                                for (const key of Object.keys(rawData)) {
                                    if (Array.isArray(rawData[key]) && rawData[key].length > 0) {
                                        lancesList = rawData[key];
                                        console.log(`[POLARYON RANKING] 📋 Extraído array da chave "${key}" (${lancesList.length} itens)`);
                                        break;
                                    }
                                }
                            }
                        }

                        console.log(`[POLARYON RANKING] 📋 lancesList.length = ${lancesList.length}`);
                        if (lancesList.length === 0) {
                            console.warn('[POLARYON RANKING] ⚠️ Lista vazia! rawData:', JSON.stringify(rawData).substring(0, 300));
                            return;
                        }

                            const rankingLances = lancesList.map((entry, idx) => {
                                if (entry.excluido) return null;
                                const valObj = entry.melhorValorFornecedor || entry;
                                if (valObj.excluido) return null;

                                let val = null;
                                // Suporte a /propostas-iniciais: entry.valores.valorPropostaInicial
                                if (entry.valores && entry.valores.valorPropostaInicial) {
                                    const proposta = entry.valores.valorPropostaInicial;
                                    val = proposta.valorInformado !== undefined && proposta.valorInformado !== null
                                        ? proposta.valorInformado
                                        : (proposta.valorCalculado ? proposta.valorCalculado.valorUnitario : null);
                                }
                                if (val === null || val === undefined) {
                                    if (valObj.valor !== undefined && valObj.valor !== null) {
                                        if (typeof valObj.valor === 'object') {
                                            val = valObj.valor.valorCalculado !== undefined ? valObj.valor.valorCalculado : valObj.valor.valorInformado;
                                        } else {
                                            val = valObj.valor;
                                        }
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
                                
                                const dt = valObj.dataHoraInclusao || valObj.dataHoraAtualizacao || entry.dataHoraInclusao || entry.dataHoraAtualizacao || valObj.data || entry.data || '';
                                const formattedDt = dt ? new Date(dt).toLocaleString('pt-BR') : '';
                                const eMeuLance = !!(entry.eMeuLance || valObj.eMeuLance || entry.meuLance || valObj.meuLance || entry.isMyBid || valObj.isMyBid || entry.meuLance === true);
                                
                                const origemRaw = entry.origem || valObj.origem || entry.tipo || valObj.tipo || entry.tipoLance || valObj.tipoLance || '';
                                const origem = (origemRaw === 'P' || origemRaw === 'Proposta') ? 'Proposta' : 'Lance';

                                // Extração robusta do participante para agrupamento correto e eliminação de duplicidades
                                let partId = null;
                                if (entry.participanteId) partId = entry.participanteId;
                                else if (entry.fornecedorId) partId = entry.fornecedorId;
                                else if (entry.cnpjFornecedor) partId = entry.cnpjFornecedor;
                                else if (entry.codigoParticipante) partId = entry.codigoParticipante;
                                else if (entry.codigoFornecedor) partId = entry.codigoFornecedor;
                                else if (entry.identificadorParticipante) partId = entry.identificadorParticipante;
                                else if (entry.numeroParticipante) partId = entry.numeroParticipante;
                                else if (entry.identificador) partId = entry.identificador;
                                else if (entry.sequencial !== undefined && entry.sequencial !== null) partId = `__PARTICIPANTE__${entry.sequencial}`;
                                else if (entry.participante) {
                                    if (typeof entry.participante === 'object') {
                                        partId = entry.participante.identificacao || entry.participante.nome || entry.participante.codigo;
                                    } else {
                                        partId = entry.participante;
                                    }
                                } else if (entry.fornecedor) {
                                    if (typeof entry.fornecedor === 'object') {
                                        partId = entry.fornecedor.cnpj || entry.fornecedor.codigo || entry.fornecedor.nome;
                                    } else {
                                        partId = entry.fornecedor;
                                    }
                                }

                                if (!partId && valObj) {
                                    if (valObj.participanteId) partId = valObj.participanteId;
                                    else if (valObj.fornecedorId) partId = valObj.fornecedorId;
                                    else if (valObj.cnpjFornecedor) partId = valObj.cnpjFornecedor;
                                    else if (valObj.codigoParticipante) partId = valObj.codigoParticipante;
                                    else if (valObj.codigoFornecedor) partId = valObj.codigoFornecedor;
                                    else if (valObj.identificadorParticipante) partId = valObj.identificadorParticipante;
                                    else if (valObj.numeroParticipante) partId = valObj.numeroParticipante;
                                    else if (valObj.identificador) partId = valObj.identificador;
                                    else if (valObj.participante) {
                                        if (typeof valObj.participante === 'object') {
                                            partId = valObj.participante.identificacao || valObj.participante.nome || valObj.participante.codigo;
                                        } else {
                                            partId = valObj.participante;
                                        }
                                    } else if (valObj.fornecedor) {
                                        if (typeof valObj.fornecedor === 'object') {
                                            partId = valObj.fornecedor.cnpj || valObj.fornecedor.codigo || valObj.fornecedor.nome;
                                        } else {
                                            partId = valObj.fornecedor;
                                        }
                                    }
                                }

                                return {
                                    valor: Number(val),
                                    origem: origem,
                                    data: formattedDt,
                                    eMeuLance: eMeuLance,
                                    classificacao: valObj.classificacao || valObj.posicao || entry.classificacao || entry.posicao || null,
                                    participanteId: partId ? String(partId) : `__PARTICIPANTE__${idx}`
                                };
                            }).filter(Boolean).sort((a, b) => a.valor - b.valor);

                            if (rankingLances.length === 0) return;

                            rankingLances.forEach((r, idx) => {
                                r.posicao = r.classificacao || (idx + 1);
                            });

                            let myRankIndex = rankingLances.findIndex(r => r.eMeuLance);
                            if (myRankIndex === -1 && itemToCheck.meuValor > 0) {
                                myRankIndex = rankingLances.findIndex(r => Math.abs(r.valor - itemToCheck.meuValor) < 0.001);
                                if (myRankIndex !== -1) {
                                    rankingLances[myRankIndex].eMeuLance = true;
                                }
                            }

                            const realPosicao = myRankIndex !== -1 ? String(myRankIndex + 1) : null;

                            console.log(`[POLARYON RANKING] 📊 Item ${itemToCheck.itemId}: posição real = ${realPosicao} | ${rankingLances.length} participantes`);
                            
                            this.itemRankingsMap.set(itemToCheck.itemId, {
                                realPosicao,
                                rankingLances,
                                updatedAt: Date.now()
                            });

                            if (!this.webContents.isDestroyed()) {
                                this.webContents.send('bidding-ranking-update', {
                                    sessionId: this.sessionId,
                                    itemId: itemToCheck.itemId,
                                    realPosicao: realPosicao ? String(realPosicao) : null,
                                    rankingLances
                                });
                            }
                            if (realPosicao) itemToCheck.posicao = String(realPosicao);
                    };

                    fetchRanking().catch(err => {
                        console.error(`[POLARYON RANKING ERROR] ❌ Erro geral ao buscar ranking do item ${itemToCheck.itemId}:`, err.message);
                    });
                }

                // 🎯 MOTOR DE AUTO-LANCE BACKEND (v3.8.4) - Independente da UI React!
                if (this.biddingRunner && this.biddingRunner.configs.has(this.sessionId)) {
                    const sessionConfig = this.biddingRunner.configs.get(this.sessionId);
                    if (sessionConfig && sessionConfig.itemsConfig) {
                        if (!this.lastBidTimes) this.lastBidTimes = new Map();

                        for (const mappedItem of mappedItems) {
                            const sId = String(mappedItem.itemId);
                            const strat = sessionConfig.itemsConfig[sId] || {};

                            if (!strat.active) continue;

                            const myMin = Number(strat.minPrice || 0);
                            if (myMin <= 0) {
                                console.debug(`[BACKEND SNIPER] Item ${sId}: BLOQUEADO - Mínimo não configurado.`);
                                continue;
                            }

                            const tSeconds = Number(mappedItem.timerSeconds);
                            const isKamikaze = strat.kamikazeMode || false;
                            const isTimerActive = (tSeconds >= 0);

                            // Só dispara nos 30 segundos finais, OU em modo kamikaze (qualquer timer)
                            // Timer -1 = sem countagem ativa, mas no modo kamikaze continua ativo
                            const timerFiring = isTimerActive && tSeconds <= 30 && tSeconds >= 0;
                            if (!timerFiring && !isKamikaze) continue;

                            // Verifica se está perdendo
                            const posicao = String(mappedItem.posicao || '').toUpperCase().trim();
                            // 🔧 FIX: verifica se GANHANDO explicitamente; 'PERDENDO' confirma que deve disparar
                            const isGanhando = (posicao === '1' || posicao === '1º' || posicao === '1°' || posicao === 'G' || posicao === 'V' || posicao === 'GANHANDO' || posicao === 'VENCEDOR');
                            const isPerdendo = (posicao === 'PERDENDO' || posicao === 'P' || posicao === 'L' || posicao === 'LOSING');
                            // Se explicitamente ganhando, para. Se posicao é desconhecida E não temos meuValor comparável, continua para avaliar
                            if (isGanhando) {
                                console.log(`[BACKEND SNIPER] Item ${sId}: GANHANDO (pos=${posicao}), protegendo.`);
                                continue;
                            }
                            if (!isPerdendo && posicao !== '' && isNaN(Number(posicao))) {
                                // Posição desconhecida (ex: 'Em Disputa'), mas não confirmada como perdendo
                                // Deixa passar para avaliação pelo valor
                                console.log(`[BACKEND SNIPER] Item ${sId}: Posição desconhecida='${posicao}', avaliando pelo valor...`);
                            }

                            const currentBest = Number(mappedItem.valorAtual || 0);
                            const myCurrentBid = Number(mappedItem.meuValor || 999999999);
                            const margin = Number(strat.decrementValue || 1);
                            const allow4 = strat.useFourDecimals || false;

                            // Cooldown para não spammar (Kamikaze: 500ms, Normal nos 30s finais: 1000ms, Normal geral: 2000ms)
                            const now = Date.now();
                            const cooldown = isKamikaze ? 500 : (tSeconds <= 30 ? 1000 : 2000);
                            const lastBidAt = this.lastBidTimes.get(sId) || 0;
                            if (now - lastBidAt < cooldown) continue;

                            // Calcular margem obrigatória do Serpro (baseada no líder para assumir a ponta)
                            const officialMarginVal = Number(mappedItem.officialMargin || 0);
                            const officialMarginType = mappedItem.officialMarginType || 'V';
                            const mandatorySerproMargin = officialMarginType === 'P'
                                ? currentBest * (officialMarginVal / 100)
                                : officialMarginVal;
                            const maxAllowedToTakeLead = currentBest - mandatorySerproMargin;

                            // Calcular próximo lance
                            let nextBid = 0;
                            let shouldBid = true;

                            if (isKamikaze) {
                                // Modo Kamikaze: mira no meuMin diretamente e atira imediatamente se estiver perdendo
                                nextBid = myMin;
                                if (myCurrentBid !== 999999999 && Math.abs(myCurrentBid - myMin) < 0.001) {
                                    shouldBid = false;
                                }
                            } else {
                                // Modo Normal
                                // Verificar se temos ranking dos concorrentes recente (máximo 60s, sincronizado via IPC)
                                const cached = this.itemRankingsMap.get(sId);
                                const hasRankings = cached && cached.rankingLances && (now - cached.updatedAt < 60000);

                                if (hasRankings) {
                                    // Filtrar lances dos concorrentes (onde eMeuLance é falso E não coincide com nosso próprio valor)
                                    const competitorBids = cached.rankingLances
                                        .filter(r => !r.eMeuLance && Math.abs(r.valor - myCurrentBid) > 0.001 && Math.abs(r.valor - Number(mappedItem.meuValor)) > 0.001)
                                        .map(r => r.valor)
                                        .sort((a, b) => a - b); // Crescente

                                    // Calcular decrementToUse
                                    let decrementToUse = margin;
                                    if (officialMarginVal > 0) {
                                        const requiredDecrement = officialMarginType === 'P' 
                                            ? currentBest * (officialMarginVal / 100) 
                                            : officialMarginVal;
                                        decrementToUse = Math.max(margin, requiredDecrement);
                                    }

                                    // Encontrar o primeiro concorrente que conseguimos bater (c - decrementToUse >= myMin)
                                    let targetCompetitorBid = null;
                                    for (const c of competitorBids) {
                                        if (c - decrementToUse >= myMin) {
                                            targetCompetitorBid = c;
                                            break;
                                        }
                                    }

                                    if (targetCompetitorBid !== null) {
                                        const targetBid = targetCompetitorBid - decrementToUse;

                                        // Se nosso lance atual já é menor ou igual ao targetBid,
                                        // já ocupamos essa posição (ou melhor) e economizamos margem!
                                        if (myCurrentBid !== 999999999 && myCurrentBid <= targetBid) {
                                            shouldBid = false;
                                            console.log(`[BACKEND SNIPER] Item ${sId}: Já estamos na posição ideal (meuLance: ${myCurrentBid} <= target: ${targetBid} p/ concorrente ${targetCompetitorBid}). Protegendo margem.`);
                                        } else {
                                            nextBid = targetBid;
                                        }
                                    } else {
                                        // Nenhum concorrente é batível acima de myMin.
                                        // A melhor posição que podemos conseguir é o nosso próprio mínimo
                                        if (myCurrentBid !== 999999999 && myCurrentBid <= myMin) {
                                            shouldBid = false;
                                        } else {
                                            nextBid = myMin;
                                        }
                                    }
                                } else {
                                    // Fallback: Lógica padrão sem rankings detalhados
                                    const isLeaderBeatable = (currentBest > 0 && (currentBest - margin) >= myMin && maxAllowedToTakeLead >= myMin);

                                    if (isLeaderBeatable) {
                                        nextBid = Math.min(currentBest - margin, maxAllowedToTakeLead);
                                        console.log(`[BACKEND SNIPER] Item ${sId}: FALLBACK - Líder batível. nextBid=${nextBid} (lider=${currentBest} - margem=${margin})`);
                                    } else {
                                        // 🔧 FIX: Sem ranking E líder não batível → dispara no mínimo do usuário
                                        // Isso garante que o robô sempre tente participar nos 30s finais
                                        if (currentBest <= 0) {
                                            // Sem dados do líder da API, dispara no mínimo
                                            if (myCurrentBid !== 999999999 && myCurrentBid <= myMin) {
                                                shouldBid = false; // Já no mínimo
                                            } else {
                                                nextBid = myMin;
                                                console.log(`[BACKEND SNIPER] Item ${sId}: FALLBACK sem líder → disparando mínimo R$ ${nextBid}`);
                                            }
                                        } else {
                                            const isSecondPlace = (posicao === '2' || posicao === '2º' || posicao === '2°');
                                            if (isSecondPlace) {
                                                shouldBid = false; // Já estamos em 2º lugar
                                            } else {
                                                if (myCurrentBid !== 999999999) {
                                                    let decrementToUse = margin;
                                                    if (officialMarginVal > 0) {
                                                        const requiredDecrement = officialMarginType === 'P' 
                                                            ? currentBest * (officialMarginVal / 100) 
                                                            : officialMarginVal;
                                                        decrementToUse = Math.max(margin, requiredDecrement);
                                                    }
                                                    nextBid = myCurrentBid - decrementToUse;
                                                } else {
                                                    nextBid = myMin;
                                                }
                                            }
                                        } // fim else currentBest > 0
                                    } // fim else !isLeaderBeatable
                                } // fim else fallback
                            }

                            if (!shouldBid) continue;

                            if (nextBid < myMin) nextBid = myMin;
                            nextBid = allow4
                                ? Math.floor(nextBid * 10000) / 10000
                                : Math.floor(nextBid * 100) / 100;

                            // Validações de segurança
                            if (nextBid < myMin) {
                                console.log(`[BACKEND SNIPER] Item ${sId}: Lance R$ ${nextBid} abaixo do mínimo R$ ${myMin}. Bloqueado.`);
                                continue;
                            }
                            
                            // Bloqueia se o lance não melhorar o PRÓPRIO lance
                            if (myCurrentBid !== 999999999 && nextBid >= myCurrentBid) {
                                console.log(`[BACKEND SNIPER] Item ${sId}: Já estamos na posição ideal ou lance (R$ ${nextBid}) não melhora o atual. Protegendo margem.`);
                                continue;
                            }

                            // 🔥 DISPARO BACKEND DIRETO!
                            this.lastBidTimes.set(sId, now);
                            console.log(`%c🎯 [BACKEND SNIPER] DISPARANDO: R$ ${nextBid} → Item ${sId} | Timer: ${tSeconds}s | Lider: R$ ${currentBest}`, 'color: #10b981; font-weight: bold;');

                            if (!this.webContents.isDestroyed()) {
                                this.webContents.send('bidding-update-log', `🎯 [SNIPER BACKEND] Disparando R$ ${nextBid} → Item ${sId} (${tSeconds}s restantes)`);
                            }

                            // Disparo assíncrono - não bloqueia o polling
                            this.biddingRunner.sendBid({
                                purchaseId: mappedItem.purchaseId,
                                itemId: sId,
                                value: nextBid
                            }).catch(err => console.error(`[BACKEND SNIPER] Falha no disparo do Item ${sId}:`, err.message));
                        }
                    }
                }
            }

            // Polling dinâmico inteligente e adaptativo contra erro 422/429
            let nextInterval = 10000; // Por padrão, ritmo passivo de 10s para evitar 429
            const isBiddingActive = this.biddingRunner && this.biddingRunner.isSessionActive(this.sessionId);

            if (isBiddingActive) {
                nextInterval = 1000;
                if (minTimer <= 30) {
                    nextInterval = 350; // Ritmo frenético de 350ms nos segundos finais! 🔥🚀
                    console.log(`[POLARYON MOTOR] 🚀 ACELERAÇÃO MÁXIMA (${this.sessionId}): Item iminente a ${minTimer.toFixed(1)}s do fim! Polling ajustado para ${nextInterval}ms`);
                } else if (minTimer <= 60) {
                    nextInterval = 600; // Ritmo intermediário de 600ms
                    console.log(`[POLARYON MOTOR] ⚡ Ritmo Elevado (${this.sessionId}): Item a ${minTimer.toFixed(1)}s do fim. Polling ajustado para ${nextInterval}ms`);
                }
            } else {
                // Se a sessão está inativa e em plano de fundo, polling de 10 segundos é suficiente e extremamente seguro
                if (Math.random() < 0.1) { // Reduz poluição do log
                    console.log(`[POLARYON MOTOR] 💤 Radar Passivo (${this.sessionId}) rodando a 10s para preservação de banda e proteção de IP (Anti-429).`);
                }
            }

            this.timeoutId = setTimeout(() => this.run(), nextInterval);

        } catch (e) {
            const statusError = e.response ? e.response.status : 0;

            if (statusError === 429) {
                // 🛑 RATE-LIMIT DETECTADO: Backoff Exponencial Anti-429
                this.backoffCount = (this.backoffCount || 0) + 1;
                const backoffMs = Math.min(15000 * this.backoffCount, 60000);
                console.warn(`[POLARYON MOTOR] 🚦 429 Rate-Limit na sala ${this.sessionId}! Backoff: ${backoffMs/1000}s`);
                captchaManager.lastFetch = 0;
                captchaManager.token1 = '';
                captchaManager.token2 = '';
                if (!this.webContents.isDestroyed()) {
                    this.webContents.send('bidding-update-log', `⏳ [ANTI-429] Aguardando ${backoffMs/1000}s...`);
                }
                this.timeoutId = setTimeout(() => this.run(), backoffMs);
                return;
            }

            if (statusError === 401 || statusError === 403) {
                // 🔄 TOKEN EXPIRADO: Auto-renovação via Siga — não para, tenta de novo
                this.tokenRetryCount = (this.tokenRetryCount || 0) + 1;
                console.warn(`[POLARYON MOTOR] 🔑 401/403 na sala ${this.sessionId} (tentativa ${this.tokenRetryCount}). Forçando renovação de token via Siga...`);
                
                // Sinaliza para o visual-runner renovar o token capturando um novo login furtivo
                if (!this.webContents.isDestroyed()) {
                    this.webContents.send('bidding-update-log', `🔑 [AUTO-RENEW] Token expirou. Renovando automaticamente... (${this.tokenRetryCount}ª tentativa)`);
                    this.webContents.send('request-token-renewal', { sessionId: this.sessionId });
                }
                
                // Limpa o token atual para forçar o visual-runner a capturar um novo
                if (this.tokenRetryCount >= 3) {
                    global.serproToken = null;
                    this.tokenRetryCount = 0;
                    console.warn('[POLARYON MOTOR] 🚨 Token limpo após 3 falhas. Aguardando re-captura pelo Visual Runner...');
                }
                
                // Espera 2 segundos e tenta de novo sem parar a sessão
                this.timeoutId = setTimeout(() => this.run(), 2000);
                return;
            }

            this.backoffCount = 0;
            this.tokenRetryCount = 0;
            console.error('[POLARYON MOTOR] Erro na varredura da sala:', e.message);
            this.timeoutId = setTimeout(() => this.run(), 3000);
        }
    }

    stop() {
        this.active = false;
        if (this.timeoutId) clearTimeout(this.timeoutId);
    }
}

/**
 * GlobalScanner - Varrer Minhas Participações Automático (Filtro: Disputa)
 */
class GlobalScanner {
    constructor(webContents, clockSync, biddingRunner) {
        this.webContents = webContents;
        this.clockSync = clockSync;
        this.biddingRunner = biddingRunner;
        this.active = true;
        this.timeoutId = null;
        this.knownRooms = new Set();
    }

    async run() {
        if (!this.active) return;
        try {
            let token = global.serproToken;
            if (!token) {
                this.timeoutId = setTimeout(() => this.run(), 5000);
                return;
            }

            const captchas = await captchaManager.getTokens();

            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/participacoes?captcha=${captchas.captcha1}&tamanhoPagina=50&pagina=0&filtro=4`;
            
            const res = await axios.get(url, {
                headers: { 
                    'Authorization': token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                }
            });

            const participacoes = res.data || [];
            
            participacoes.forEach(p => {
                if (p.compra && p.compra.numeroUasg && p.compra.numero) {
                    const uasg = p.compra.numeroUasg;
                    const numero = p.compra.numero;
                    const ano = p.compra.ano;
                    const modalityCode = String(p.compra.modalidade || '6').padStart(2, '0');
                    const idCompra = `${uasg}${modalityCode}${String(numero).padStart(5, '0')}${ano}`;
                    const sessionId = `GLOBAL_${idCompra}`;
                    
                    if (!this.knownRooms.has(sessionId)) {
                        this.knownRooms.add(sessionId);
                        console.log(`[GLOBAL SCANNER] Nova Sala em Disputa Detectada Automaticamente: ${idCompra}`);
                        
                        this.webContents.send('bidding-update-log', `[GLOBAL SCANNER] Automático: Iniciando Radar na Sala ${uasg} - Pregão ${numero}/${ano}...`);
                        
                        // Envia ao frontend para focar e abrir
                        this.webContents.send('bidding-detected-room', {
                            url: `compra=${idCompra}`
                        });
                        
                        // Auto-inicia o motor invisível no backend Electron para monitorar a sala inteira sem clique!
                        this.biddingRunner.start(sessionId, uasg, numero, ano, null, modalityCode);
                    }
                }
            });

            // Varre a cada 60 segundos para encontrar novas salas (v3.8.2)
            this.timeoutId = setTimeout(() => this.run(), 60000);
        } catch (e) {
            console.error('[GLOBAL SCANNER] Erro na varredura global:', e.message);
            const statusError = e.response ? e.response.status : 500;
            if ((statusError === 401 || statusError === 403) && !this.webContents.isDestroyed()) {
                console.warn(`[GLOBAL SCANNER] 🚨 Sessão Expirada durante varredura. Solicitando re-autenticação.`);
                this.webContents.send('bidding-error', {
                    sessionId: 'GLOBAL',
                    error: 'Sessão Expirada. Por favor, reautentique com o Gov.br.',
                    code: statusError,
                    action: 'REQUIRE_REAUTH'
                });
            }
            this.timeoutId = setTimeout(() => this.run(), 60000);
        }
    }

    stop() {
        this.active = false;
        if (this.timeoutId) clearTimeout(this.timeoutId);
    }
}

class BiddingRunner {
    constructor(webContents) {
        this.webContents = webContents;
        this.clockSync = new ClockSync();
        this.activeRunners = new Map(); // Mapa de sessões ativas
        this.configs = new Map(); // Configurações de estratégias por sessão (v3.8.2)
        this.focusedSessionId = null; // ID da sessão focada na tela do usuário
        this.agent = null;
        
        // Inicializa Varredura Global Automática no boot
        this.globalScanner = new GlobalScanner(this.webContents, this.clockSync, this);
        this.globalScanner.run();
    }

    async start(sessionId, uasg, numero, ano, vault, modality = '06') {
        const idCompra = `${uasg}${modality}${String(numero).padStart(5, '0')}${ano}`;
        if (this.activeRunners.has(sessionId)) return;

        console.log(`[POLARYON KAMIKAZE] Dando a partida no Motor de Fundo para a sala ${idCompra}`);

        this.agent = new https.Agent({
            pfx: vault && vault.pfxBase64 ? Buffer.from(vault.pfxBase64, 'base64') : null,
            passphrase: vault && vault.password ? vault.password : null,
            rejectUnauthorized: false
        });

        // Repassa this (BiddingRunner) para o RoomRunner conseguir ler as configs de lances ativos
        const runner = new RoomRunner(idCompra, sessionId, this.agent, this.webContents, this.clockSync, this);
        this.activeRunners.set(sessionId, runner);
        runner.run();
    }

    stop(sessionId) {
        if (this.activeRunners.has(sessionId)) {
            this.activeRunners.get(sessionId).stop();
            this.activeRunners.delete(sessionId);
        }
    }

    updateConfig(sessionId, config) {
        if (config) {
            this.configs.set(sessionId, config);
            console.log(`[POLARYON MOTOR] ⚙️ Estratégia de lances atualizada no Motor para a sessão: ${sessionId}`);
        }
    }

    isSessionActive(sessionId) {
        // Se for a sessão atualmente visualizada pelo usuário no painel, força a atividade em tempo real!
        if (sessionId === this.focusedSessionId) {
            return true;
        }

        // Se houver algum sniper ativado (botão verde) nessa sessão, considera ativa!
        const config = this.configs.get(sessionId);
        if (config && config.itemsConfig) {
            for (const itemId in config.itemsConfig) {
                const strat = config.itemsConfig[itemId];
                if (strat && strat.active === true) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 🔫 Disparo Rest Direto! Sem Depender de Janela Visual!
     */
    async sendBid({ purchaseId, itemId, value }) {
        try {
            console.log(`[KAMIKAZE SNIPER] Engatilhando Lance HTTP Invisível: Item ${itemId} | Valor: ${value}`);
            const captchas = await captchaManager.getTokens();
            
            let token = global.serproToken;

            if (!token) {
                throw new Error("Token de Sessão não capturado. Disparo Abortado.");
            }

            const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances?captcha1=${captchas.captcha1}&captcha2=${captchas.captcha2}&captcha3=${captchas.captcha3}`;

            const payload = {
                valorInformado: parseFloat(value),
                faseItem: "LA"
            };

             const response = await axios.post(targetUrl, payload, {
                httpsAgent: this.agent,
                headers: {
                    'Authorization': token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'x-device-platform': 'web',
                    'x-version-number': '6.0.2'
                }
            });

            console.log(`[KAMIKAZE SNIPER] 🎯 Headshot Confirmado! Status API Serpro:`, response.status);
            
            if (this.webContents && !this.webContents.isDestroyed()) {
                this.webContents.send('bidding-update-log', `🎯 Lance Kamikaze de R$ ${value} no Item ${itemId} ACERTOU O ALVO!`);
            }
        } catch (e) {
            console.error('[KAMIKAZE SNIPER] ❌ O disparo travou:', e.response ? e.response.data : e.message);
            if (this.webContents && !this.webContents.isDestroyed()) {
                this.webContents.send('bidding-update-log', `❌ Falha ao tentar atirar no Item ${itemId}. Erro: ${e.message}`);
            }
        }
    }
}

module.exports = BiddingRunner;
module.exports.getCaptchaTokens = () => captchaManager.getTokens();
module.exports.getFreshCaptchaToken = () => captchaManager.getFreshToken();
