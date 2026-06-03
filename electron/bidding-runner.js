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
        if (now - this.lastFetch > 15000) { // Renova a cada 15s (captchas expiram rápido no Serpro — cenário agressivo)
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
 * ClockSync - Sincronizador de Relógio Atômico v3
 * Prioriza o HTTP Date header (autoritativo) sobre segundosParaEncerramento (inteiro truncado).
 */
class ClockSync {
    constructor() {
        this.serverTimeAtLastUpdate = Date.now();
        this.localTimeAtLastUpdate = Date.now();
    }
    update(serverDateHeader, itemsList, tStart, tEnd) {
        const now = tEnd || Date.now();
        const rtt = (tStart && tEnd) ? (tEnd - tStart) : 0;

        // PRIORIDADE 1: HTTP Date header - timestamp oficial do servidor
        if (serverDateHeader) {
            const serverTime = new Date(serverDateHeader).getTime();
            if (!isNaN(serverTime)) {
                this.serverTimeAtLastUpdate = serverTime + (rtt / 2);
                this.localTimeAtLastUpdate = now;
                return;
            }
        }

        // PRIORIDADE 2: Calcular via segundosParaEncerramento (fallback)
        if (Array.isArray(itemsList)) {
            for (const item of itemsList) {
                if (item.dataHoraFimContagem && item.segundosParaEncerramento !== undefined && item.segundosParaEncerramento >= 0) {
                    const endTime = new Date(item.dataHoraFimContagem).getTime();
                    if (!isNaN(endTime)) {
                        this.serverTimeAtLastUpdate = (endTime - item.segundosParaEncerramento * 1000) + (rtt / 2);
                        this.localTimeAtLastUpdate = now;
                        return;
                    }
                }
            }
        }
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
        this.lastBestValues = new Map();  // ⚡ Guerra: rastrea valorAtual por item para detectar mudança
        this.warModeCycles = new Map();   // ⚡ Guerra: conta ciclos consecutivos com mudança de valor
        this.realtimeItems = null;        // 🎯 Dados injetados via WebSocket (elimina polling)
        this.realtimeItemsAt = 0;         // Timestamp da última injeção
        this.lastBidValues = new Map();   // 🛡️ Último valor enviado por item (dedup frontend+backend)
        this.lastBidTimes = new Map();    // ⏱️ Timestamp do último lance por item
        this._wsFieldsLogged = false;     // 🔍 WebSocket field validation já foi logada?
        this._latencySamples = { ws: [], http: [] }; // 📊 Amostras de latência para o tracker
        this._429count = 0;              // 🚦 Contagem de 429 na janela atual
        this._429windowStart = Date.now(); // 🚦 Início da janela de contagem de 429
        this._429backoffMs = 0;          // 🚦 Backoff preventivo extra por excesso de 429
    }

    injectRealtimeItems(items) {
        if (Array.isArray(items) && items.length > 0) {
            this.realtimeItems = items;
            this.realtimeItemsAt = Date.now();

            // 🔍 VALIDAÇÃO DE CAMPOS WEBSOCKET (v3.8.131): verifica se todos os campos críticos existem
            const requiredFields = [
                'identificador', 'situacaoParticipanteDisputa',
                'melhorValorGeral', 'melhorValorFornecedor',
                'segundosParaEncerramento', 'dataHoraFimContagem',
                'fase', 'variacaoMinimaEntreLances'
            ];
            if (!this._wsFieldsLogged) {
                let allPresent = true;
                const sample = items[0] || {};
                for (const field of requiredFields) {
                    if (sample[field] === undefined) {
                        console.warn(`[WS FIELD CHECK] ⚠️ Campo ausente no WebSocket: "${field}" — motor usará fallback/undefined`);
                        allPresent = false;
                    }
                }
                if (allPresent) {
                    console.log(`[WS FIELD CHECK] ✅ WebSocket contém todos os ${requiredFields.length} campos críticos!`);
                } else {
                    // Lista todos os campos presentes no WebSocket para comparação
                    const presentFields = Object.keys(sample).sort();
                    console.log(`[WS FIELD CHECK] 📋 Campos presentes no WebSocket (${presentFields.length}): ${presentFields.join(', ')}`);
                }
                this._wsFieldsLogged = true;
            }

            // Se o runner está dormindo, acorda imediatamente
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
                setImmediate(() => this.run());
            }
        }
    }

    // 📊 LATÊNCIA TRACKER (v3.8.131): amostra latência por ciclo
    _trackLatency(type, ms) {
        if (!this._latencySamples) return;
        const samples = this._latencySamples[type];
        if (!samples) return;
        samples.push(ms);
        // Mantém no máximo 100 amostras por tipo
        if (samples.length > 100) samples.shift();
    }

    // 📊 LOG PERIÓDICO DE LATÊNCIA (v3.8.131): imprime stats a cada 30s
    _logLatencyStats() {
        const bb = this.biddingRunner;
        if (!bb || !bb.latencyStats) return;
        const now = Date.now();
        if (now - bb.lastLatencyLog < 30000) return;
        bb.lastLatencyLog = now;

        const report = {};
        for (const type of ['ws', 'http']) {
            const samples = this._latencySamples[type] || [];
            if (samples.length === 0) continue;
            const sum = samples.reduce((a, b) => a + b, 0);
            const avg = (sum / samples.length).toFixed(1);
            const min = Math.min(...samples);
            const max = Math.max(...samples);
            const stats = bb.latencyStats[type];
            stats.count += samples.length;
            stats.totalMs += sum;
            stats.min = Math.min(stats.min, min);
            stats.max = Math.max(stats.max, max);
            report[type] = { samples: samples.length, avg: avg + 'ms', min: min + 'ms', max: max + 'ms' };
            // Limpa amostras após log
            this._latencySamples[type] = [];
        }
        if (Object.keys(report).length > 0) {
            const wsStr = report.ws ? `WS: ${report.ws.avg} (${report.ws.min}-${report.ws.max}, ${report.ws.samples} amostras)` : 'WS: sem dados';
            const httpStr = report.http ? `HTTP: ${report.http.avg} (${report.http.min}-${report.http.max}, ${report.http.samples} amostras)` : 'HTTP: sem dados';
            const logMsg = `[LATÊNCIA 📊] ${wsStr} | ${httpStr}`;
            console.log(logMsg);
            // Envia para o frontend dashboard também
            if (this.webContents && !this.webContents.isDestroyed()) {
                this.webContents.send('bidding-update-log', logMsg);
            }
        }
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

            let itemsList, tStart, tEnd;

            // 🎯 Se temos dados frescos do WebSocket (< 60s), usa direto sem HTTP fetch (v3.8.181)
            // Dados WS NÃO são limpos após uso — persistem até expirar o TTL ou chegar novos dados WS
            const wsAge = this.realtimeItems ? (Date.now() - this.realtimeItemsAt) : Infinity;
            if (this.realtimeItems && wsAge < 60000) {
                itemsList = this.realtimeItems;
                tStart = Date.now();
                tEnd = tStart;
                this.clockSync.update(null, itemsList, tStart, tEnd);
                if (Math.random() < 0.05) {
                    console.log(`[POLARYON MOTOR] 🎯 WS data (${Math.round(wsAge)}ms de idade, ${itemsList.length} itens) — sem HTTP!`);
                }
                // 📊 Registra latência zero (WebSocket é instantâneo no backend)
                this._trackLatency('ws', 0);
            } else {
                if (this.realtimeItems && Math.random() < 0.05) {
                    console.log(`[POLARYON MOTOR] ⏳ WS data stale (${Math.round(wsAge/1000)}s > 60s TTL) — fallback HTTP fetch (${this.idCompra})`);
                }
                const startFetch = Date.now();
                const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/em-disputa?configs=false&captcha1=${captchas.captcha1}&captcha2=${captchas.captcha2}&captcha3=${captchas.captcha3}`;
                tStart = Date.now();
                const res = await axios.get(url, {
                    httpsAgent: this.agent,
                    headers: { 
                        'Authorization': token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'x-device-platform': 'web',
                        'x-version-number': '6.0.2'
                    }
                });
                tEnd = Date.now();
                itemsList = Array.isArray(res.data) ? res.data : (res.data.itens || []);
                this.clockSync.update(res.headers.date, itemsList, tStart, tEnd);
                const httpLatency = tEnd - startFetch;
                // 📊 Registra latência HTTP
                this._trackLatency('http', httpLatency);
            }
            
            let minTimer = Infinity;

            if (itemsList.length > 0) {
                const serverNow = this.clockSync.getServerTime();
                const mappedItems = itemsList.map(item => {
                    const itemIdStr = String(item.identificador || item.numero);
                    const cachedRanking = this.itemRankingsMap.get(itemIdStr);
                    
                    const spd = item.situacaoParticipanteDisputa;
                    let posicaoTxt = item.classificacao || item.posicao || (item.melhorValorFornecedor && (item.melhorValorFornecedor.classificacao || item.melhorValorFornecedor.posicao)) || item.situacaoParticipanteDisputaTraduzido || (spd === 'G' ? 'GANHANDO' : (spd === 'P' || spd === 'E' ? 'PERDENDO' : '?'));
                    if (cachedRanking && cachedRanking.realPosicao) {
                        posicaoTxt = cachedRanking.realPosicao;
                    }
                    
                    let secondsLeft = item.segundosParaEncerramento;
                    if (item.dataHoraFimContagem && serverNow) {
                        const endTime = new Date(item.dataHoraFimContagem).getTime();
                        secondsLeft = Math.max(0, (endTime - serverNow) / 1000);
                    } else if (secondsLeft !== undefined && secondsLeft !== null && secondsLeft >= 0) {
                        const rttSeconds = (tEnd - tStart) / 2000;
                        secondsLeft = Math.max(0, secondsLeft - rttSeconds);
                    } else {
                        secondsLeft = -1;
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

                    var ds = (this.realtimeItems && wsAge < 60000) ? 'ws' : 'http';
                    return {
                        itemId: itemIdStr,
                        purchaseId: this.idCompra,
                        dataSource: ds,
                        valorAtual,
                        meuValor,
                        ganhador: posicaoTxt === '1' || posicaoTxt === '1º' || posicaoTxt === '1°' || posicaoTxt === 'G' || posicaoTxt === 'V' || posicaoTxt === 'GANHANDO' || posicaoTxt === 'VENCEDOR' ? 'Você' : 'Outro',
                        status: item.faseTraduzido || item.fase || 'Em Disputa',
                        posicao: posicaoTxt,
                        timerSeconds: secondsLeft,
                        segundosParaEncerramento: item.segundosParaEncerramento,
                        dataHoraFimContagem: item.dataHoraFimContagem,
                        officialMargin: item.variacaoMinimaEntreLances != null ? item.variacaoMinimaEntreLances : 1,
                        officialMarginType: item.tipoVariacaoMinimaEntreLances || 'V',
                        desc: item.descricao,
                        rankingLances: cachedRanking ? cachedRanking.rankingLances : []
                    };
                });

                // 🎯 SUB-ITENS DE GRUPO: busca itens internos via /itens-grupo
                const hasGroup = itemsList.some(i => i.tipo === 'G' || i.numero === -1 || String(i.identificador || i.numero) === 'G1');
                if (hasGroup) {
                    try {
                        const subUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/em-disputa/-1/itens-grupo?captcha1=${captchas.captcha1}&captcha2=${captchas.captcha2}&captcha3=${captchas.captcha3}`;
                        const subRes = await axios.get(subUrl, {
                            httpsAgent: this.agent,
                            headers: {
                                'Authorization': token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                                'x-device-platform': 'web',
                                'x-version-number': '6.0.2'
                            }
                        });
                        const subList = Array.isArray(subRes.data) ? subRes.data : (subRes.data.itens || []);
                        if (subList.length > 0) {
                            const subMapped = subList.map(si => {
                                const itemIdStr = String(si.identificador || si.numero);
                                const secondsLeft = si.segundosParaEncerramento !== undefined && si.segundosParaEncerramento !== null && si.segundosParaEncerramento >= 0
                                    ? si.segundosParaEncerramento
                                    : (si.dataHoraFimContagem ? Math.max(0, (new Date(si.dataHoraFimContagem).getTime() - Date.now()) / 1000) : -1);
                                // Só adiciona se ainda não estiver em mappedItems
                                if (!mappedItems.some(m => m.itemId === itemIdStr)) {
                                    return {
                                        itemId: itemIdStr,
                                        purchaseId: this.idCompra,
                                        valorAtual: 0,
                                        meuValor: 999999999,
                                        ganhador: 'Outro',
                                        status: 'Em Disputa',
                                        posicao: '?',
                                        timerSeconds: secondsLeft,
                                        segundosParaEncerramento: si.segundosParaEncerramento,
                                        dataHoraFimContagem: si.dataHoraFimContagem,
                                        officialMargin: si.variacaoMinimaEntreLances != null ? si.variacaoMinimaEntreLances : 1,
                                        officialMarginType: si.tipoVariacaoMinimaEntreLances || 'V',
                                        desc: si.descricao,
                                        isGroup: false,
                                        isGroupItem: true,
                                        rankingLances: []
                                    };
                                }
                                return null;
                            }).filter(Boolean);
                            mappedItems.push(...subMapped);
                            console.log(`[BACKEND GRUPO] ➕ ${subMapped.length} sub-itens adicionados ao motor (grupo detectado)`);
                        }
                    } catch(e) {
                        console.log(`[BACKEND GRUPO] ⚠️ Erro ao buscar sub-itens: ${e.message}`);
                    }
                }

                // ⚡ GUERRA DE LANCES: detecta rajada de lances por mudança rápida de valorAtual
                for (const mappedItem of mappedItems) {
                    const sId = String(mappedItem.itemId);
                    const prevBest = this.lastBestValues.get(sId);
                    const currBest = mappedItem.valorAtual;
                    if (prevBest !== undefined && prevBest !== currBest && currBest > 0) {
                        this.warModeCycles.set(sId, (this.warModeCycles.get(sId) || 0) + 1);
                    } else if (prevBest === currBest) {
                        const w = this.warModeCycles.get(sId) || 0;
                        if (w > 0) this.warModeCycles.set(sId, w - 1);
                    }
                    this.lastBestValues.set(sId, currBest);
                    // 🏴‍☠️ Sinaliza guerra para o frontend
                    mappedItem.inWarMode = (this.warModeCycles.get(sId) || 0) >= 1;
                }

                // Envia a sala COMPLETA para o dashboard
                const dispNum = parseInt(this.idCompra.substring(8, 13), 10);
                const dispAno = this.idCompra.substring(13, 17);
                this.webContents.send('bidding-update', {
                    sessionId: this.sessionId,
                    backendActive: true, // 🏠 Backend RoomRunner está gerenciando esta sala (v3.8.175)
                    uasg: this.idCompra.substring(0, 6),
                    sessionTitle: `Disputa Oficial - ${dispNum}/${dispAno}`,
                    log: `[MOTOR KAMIKAZE] Escaneamento Limpo: ${mappedItems.length} itens detectados.`,
                    items: mappedItems,
                    serverOffset: this.clockSync.getServerTime() - Date.now()
                });

                // 🏆 RANKING REAL via /lances/por-participante — busca assíncrona sem bloquear o polling
                // Em modo de guerra: atualiza em TODOS os ciclos. Normal: 1 item a cada 5s.
                const activeItems = mappedItems.filter(it => {
                    const statusLower = String(it.status).toLowerCase();
                    const isClosed = statusLower.includes('encerrad') || statusLower.includes('finaliz') || statusLower.includes('cancel');
                    return !isClosed;
                });
                // Verifica se QUALQUER item ativo está em guerra
                const itemsInWar = activeItems.filter(it => (this.warModeCycles.get(String(it.itemId)) || 0) >= 1);
                const inWarMode = itemsInWar.length > 0;

                if (activeItems.length > 0 && token) {
                    // Em guerra: busca todos os itens em guerra; fora: rotaciona 1 item a cada 5s
                    const itemsToFetch = inWarMode ? itemsInWar : [activeItems[Math.floor(Date.now() / 5000) % activeItems.length]];
                    const itemToCheck = itemsToFetch[0];
                    
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

                        let itemsComEstrategia = 0;
                        let itemsBloqueados = 0;
                        let itemsAtivos = 0;

                        for (const mappedItem of mappedItems) {
                            const sId = String(mappedItem.itemId);
                            const strat = sessionConfig.itemsConfig[sId] || {};

                            if (!strat.active) { itemsBloqueados++; continue; }

                            const myMin = Number(strat.minPrice || 0);
                            if (myMin <= 0) {
                                itemsBloqueados++;
                                if (!this.webContents.isDestroyed()) {
                                    this.webContents.send('bidding-update-log', `⏸️ [MOTOR] Item ${sId}: BLOQUEADO - Mínimo não configurado.`);
                                }
                                continue;
                            }

                            itemsAtivos++;

                            const tSeconds = Number(mappedItem.timerSeconds);
                            const isKamikaze = strat.kamikazeMode || false;
                            const isTimerActive = (tSeconds >= 0);
                            const snipeDelaySeconds = Number(strat.snipeDelaySeconds !== undefined ? strat.snipeDelaySeconds : 0);

                            // ⏳ SNIPER COM RETARDO: espera até o timer chegar no limite configurado
                            // snipeDelaySeconds = 30 → espera faltar 30s para começar (estilo concorrente)
                            // snipeDelaySeconds = 0 → dispara imediatamente (comportamento antigo)
                            if (snipeDelaySeconds > 0 && isTimerActive && tSeconds > snipeDelaySeconds) {
                                if (this._snipeLogTimers && (this._snipeLogTimers.get(sId) || 0) < Date.now() - 5000) {
                                    console.log(`[BACKEND SNIPER] Item ${sId}: AGUARDANDO (timer=${tSeconds}s > snipeDelay=${snipeDelaySeconds}s).`);
                                    if (!this._snipeLogTimers) this._snipeLogTimers = new Map();
                                    this._snipeLogTimers.set(sId, Date.now());
                                }
                                continue;
                            }

                            // Verifica se está perdendo
                            const posicao = String(mappedItem.posicao || '').toUpperCase().trim();
                            // 🔧 FIX: verifica se GANHANDO explicitamente; 'PERDENDO' confirma que deve disparar
                            const isGanhando = (posicao === '1' || posicao === '1º' || posicao === '1°' || posicao === 'G' || posicao === 'V' || posicao === 'GANHANDO' || posicao === 'VENCEDOR');
                            const isPerdendo = (posicao === 'PERDENDO' || posicao === 'P' || posicao === 'L' || posicao === 'LOSING');
                            // 🔧 FIX v3.8.127: GANHANDO mas com lance acima do mínimo → reduz gradualmente
                            // Antes: dava continue e congelava o lance. Agora: reduz toward minPrice.
                            if (isGanhando) {
                                console.log(`[BACKEND SNIPER] Item ${sId}: GANHANDO (pos=${posicao}), mas continuando para avaliar redução.`);
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

                            // Cooldown adaptativo (v3.8.173): mínimo de 1000ms para evitar 422 de tempo entre lances
                            const now = Date.now();
                            const itemWarCycles = this.warModeCycles.get(sId) || 0;
                            const isInWarMode = itemWarCycles >= 1;
                            const isInSnipeWindow = (isTimerActive && tSeconds <= snipeDelaySeconds && snipeDelaySeconds > 0);
                            const cooldown = Math.max(1000, (isInWarMode ? 100 : (isKamikaze ? 200 : (isInSnipeWindow ? 100 : (tSeconds <= 30 ? 300 : 1000)))));
                            if (isInWarMode) console.log(`[BACKEND SNIPER] ⚔️ Item ${sId}: MODO GUERRA ATIVO (${itemWarCycles} rajadas) | cooldown=${cooldown}ms`);
                            if (isInSnipeWindow && !isInWarMode) console.log(`[BACKEND SNIPER] 🎯 Item ${sId}: MODO SNIPER (timer=${tSeconds}s ≤ snipeDelay=${snipeDelaySeconds}s) | cooldown=${cooldown}ms`);
                            const lastBidAt = this.lastBidTimes.get(sId) || 0;
                            if (now - lastBidAt < cooldown) continue;

                            // Calcular margem obrigatória do Serpro (baseada no líder para assumir a ponta)
                            const officialMarginVal = Number(mappedItem.officialMargin || 0);
                            const officialMarginType = mappedItem.officialMarginType || 'V';
                            const mandatorySerproMargin = officialMarginType === 'P'
                                ? currentBest * (officialMarginVal / 100)
                                : officialMarginVal;
                            const maxAllowedToTakeLead = currentBest - mandatorySerproMargin;

                            console.log(`[BACKEND MARGEM] Item ${sId}: officialMarginVal=${officialMarginVal} type=${officialMarginType} mandatorySerproMargin=${mandatorySerproMargin} marginUser=${margin} maxDecrement=${Math.max(margin, mandatorySerproMargin)} lowestPossibleBid=${myCurrentBid !== 999999999 ? (myCurrentBid - Math.max(margin, mandatorySerproMargin)).toFixed(4) : 'N/A'} currentBest=${currentBest} myCurrentBid=${myCurrentBid}`);

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

                                    // 🔧 FIX v3.8.127: Margem valida degrau do MEU lance anterior, não desconta do concorrente
                                    // Antes: nextBid = competitorBid - margin (desperdiçava margem)
                                    // Agora: nextBid = max(myMin, min(competitorBid - beatingAmount, myCurrentBid - maxDecrement))
                                    const maxDecrement = Math.max(margin, officialMarginVal > 0
                                        ? (officialMarginType === 'P' ? currentBest * (officialMarginVal / 100) : officialMarginVal)
                                        : 0);
                                    const lowestPossibleBid = myCurrentBid !== 999999999 ? myCurrentBid - maxDecrement : myMin;
                                    const beatingAmount = allow4 ? 0.0001 : 0.01;

                                    let targetCompetitorBid = null;
                                    for (const c of competitorBids) {
                                        const beatingBid = c - beatingAmount;
                                        const candidateBid = Math.max(myMin, Math.min(beatingBid, lowestPossibleBid));
                                        if (candidateBid < c && candidateBid < myCurrentBid) {
                                            targetCompetitorBid = c;
                                            break;
                                        }
                                    }

                                    if (targetCompetitorBid !== null) {
                                        nextBid = Math.max(myMin, Math.min(targetCompetitorBid - beatingAmount, lowestPossibleBid));
                                        console.log(`[BACKEND SNIPER] Item ${sId}: Ranking - Mirando R$ ${targetCompetitorBid}. nextBid=R$ ${nextBid} (beatingAmount=${beatingAmount}, lowest=R$ ${lowestPossibleBid})`);
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
                                    const beatingAmount = allow4 ? 0.0001 : 0.01;
                                    const maxDecrement = Math.max(margin, mandatorySerproMargin);
                                    const lowestPossibleBid = myCurrentBid !== 999999999 ? myCurrentBid - maxDecrement : myMin;
                                    const beatingBid = currentBest > 0 ? currentBest - beatingAmount : 0;
                                    const candidateBid = Math.max(myMin, Math.min(beatingBid, lowestPossibleBid));
                                    const isLeaderBeatable = currentBest > 0 && candidateBid < currentBest && candidateBid < myCurrentBid;

                                    if (isLeaderBeatable) {
                                        nextBid = candidateBid;
                                        console.log(`[BACKEND SNIPER] Item ${sId}: FALLBACK - Líder batível. nextBid=${nextBid} (lider=${currentBest}, beatingAmount=${beatingAmount})`);
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
                                                        // 🔧 FIX v3.8.127: Se está ganhando mas com lance acima do mínimo, reduz direto para o mínimo
                                                        if (isGanhando) {
                                                            nextBid = myMin;
                                                            console.log(`[BACKEND SNIPER] Item ${sId}: GANHANDO no fallback → reduzindo de R$ ${myCurrentBid} para o mínimo R$ ${myMin}.`);
                                                        } else {
                                                            let decrementToUse = margin;
                                                            if (officialMarginVal > 0) {
                                                                const requiredDecrement = officialMarginType === 'P' 
                                                                    ? currentBest * (officialMarginVal / 100) 
                                                                    : officialMarginVal;
                                                                decrementToUse = Math.max(margin, requiredDecrement);
                                                            }
                                                            nextBid = myCurrentBid - decrementToUse;
                                                        }
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

                            // 🛡️ NUNCA bidar acima do líder atual (previne bugs de cálculo como R$5125 com líder a R$250)
                            if (currentBest > 0 && nextBid > currentBest) {
                                console.log(`[BACKEND SNIPER] 🛡️ Item ${sId}: Lance R$ ${nextBid} ACIMA do líder R$ ${currentBest}. Bloqueado (safety).`);
                                continue;
                            }
                            
                            // Bloqueia se o lance não melhorar o PRÓPRIO lance
                            if (myCurrentBid !== 999999999 && nextBid >= myCurrentBid) {
                                console.log(`[BACKEND SNIPER] Item ${sId}: Já estamos na posição ideal ou lance (R$ ${nextBid}) não melhora o atual. Protegendo margem.`);
                                continue;
                            }

                            // 🛡️ DEDUP: mesmo valor enviado nos últimos 5s? (v3.8.130 — frontend pode ter disparado antes)
                            const lastSentValue = this.lastBidValues.get(sId);
                            const lastSentAt = this.lastBidTimes.get(sId) || 0;
                            if (lastSentValue !== undefined && lastSentValue === nextBid && (now - lastSentAt) < 5000) {
                                console.log(`[BACKEND SNIPER] 🛡️ Item ${sId}: Valor R$ ${nextBid} já enviado há ${(now-lastSentAt)/1000}s. Pulando (dedup).`);
                                continue;
                            }

                            // 🔥 DISPARO BACKEND DIRETO!
                            this.lastBidTimes.set(sId, now);
                            this.lastBidValues.set(sId, nextBid);
                            console.log(`%c🎯 [BACKEND SNIPER] DISPARANDO: R$ ${nextBid} → Item ${sId} | Timer: ${tSeconds}s | Lider: R$ ${currentBest}`, 'color: #10b981; font-weight: bold;');

                            if (!this.webContents.isDestroyed()) {
                                this.webContents.send('bidding-update-log', `🎯 [SNIPER BACKEND] Disparando R$ ${nextBid} → Item ${sId} (${tSeconds}s restantes)`);
                            }

                            // 🔒 Verifica se já há um bid em andamento para este item (mutex v3.8.174)
                            if (this.biddingRunner.isBidInProgress(sId)) {
                                console.log(`[BACKEND SNIPER] ⏭️ Item ${sId} — bid em andamento, pulando.`);
                                return;
                            }

                            // Disparo assíncrono - não bloqueia o polling
                            this.biddingRunner.sendBid({
                                purchaseId: mappedItem.purchaseId,
                                itemId: sId,
                                value: nextBid
                            }).catch(err => {
                                console.error(`[BACKEND SNIPER] Falha no disparo do Item ${sId}:`, err.message);
                                if (!this.webContents.isDestroyed()) {
                                    this.webContents.send('bidding-update-log', `❌ [MOTOR] Falha ao enviar lance do Item ${sId}: ${err.message}`);
                                }
                            });
                        }
                        if (!this.webContents.isDestroyed() && itemsAtivos > 0 && Math.random() < 0.05) {
                            this.webContents.send('bidding-update-log', `📊 [MOTOR] Scan: ${itemsAtivos} ativos, ${itemsBloqueados} bloqueados de ${mappedItems.length} itens`);
                        }
                    }
                } else if (!this.webContents.isDestroyed() && Math.random() < 0.02) {
                    this.webContents.send('bidding-update-log', `⏳ [MOTOR] Aguardando configuração de estratégia...`);
                }
            }

            // ⚡ POLLING ADAPTATIVO MULTI-MODO (v3.8.141 - Agressivo)
            // Guerra de lances → 50ms | Reta final 30s → 300ms | Reta final 60s → 500ms | Ativo normal → 800ms | Passivo → 10s
            let nextInterval = 10000;
            const isBiddingActive = this.biddingRunner && this.biddingRunner.isSessionActive(this.sessionId);

            // 🚦 ANTI-429: Se recebemos 429 recentemente, aumenta intervalo preventivamente
            if (this._429count > 0 && Date.now() - this._429windowStart < 30000) {
                const penalty = Math.min(this._429count * 500, 5000);
                this._429backoffMs = Math.max(this._429backoffMs, penalty);
            } else {
                this._429count = 0;
                this._429backoffMs = 0;
            }

            // Verifica se há algum item em modo de guerra (≥1 ciclo para reagir mais rápido)
            let anyItemInWar = false;
            for (const [, cycles] of this.warModeCycles) {
                if (cycles >= 1) { anyItemInWar = true; break; }
            }

            // 🌐 Se WS está fresco (< 3s), HTTP polling vira heartbeat — dados reais vêm pelo WS
            const wsFresh = this.realtimeItems && (Date.now() - this.realtimeItemsAt) < 3000;

            if (isBiddingActive) {
                if (anyItemInWar) {
                    nextInterval = wsFresh ? 500 : 30; // WS fresco → heartbeat 500ms, senão 30ms agressivo
                    if (this._429backoffMs > 0) {
                        nextInterval += this._429backoffMs;
                        console.log(`[POLARYON MOTOR] ⚔️ GUERRA (${this.sessionId}) WS=${wsFresh ? 'fresco' : 'stale'} backoff 429: ${nextInterval}ms`);
                    }
                } else if (minTimer <= 30) {
                    nextInterval = wsFresh ? 500 : 300; // 🔥 Reta final <30s
                    if (this._429backoffMs > 0) nextInterval += this._429backoffMs;
                } else if (minTimer <= 60) {
                    nextInterval = wsFresh ? 1500 : 500; // ⚡ Reta final <60s
                    if (this._429backoffMs > 0) nextInterval += this._429backoffMs;
                } else {
                    nextInterval = wsFresh ? 3000 : 800; // Ativo estável
                }
            } else {
                if (Math.random() < 0.1) {
                    console.log(`[POLARYON MOTOR] 💤 Radar Passivo (${this.sessionId}) a 10s (Anti-429).`);
                }
            }

            // 📊 Log periódico de latência (a cada 30s)
            this._logLatencyStats();

            this.timeoutId = setTimeout(() => this.run(), nextInterval);

        } catch (e) {
            const statusError = e.response ? e.response.status : 0;

            if (statusError === 429) {
                // 🛑 RATE-LIMIT DETECTADO: Backoff Exponencial Anti-429
                this.backoffCount = (this.backoffCount || 0) + 1;
                // 🚦 Atualiza janela deslizante de 429
                const now = Date.now();
                if (now - this._429windowStart > 30000) {
                    this._429count = 0;
                    this._429windowStart = now;
                }
                this._429count++;
                this._429backoffMs = Math.min(this._429count * 500, 5000);
                const backoffMs = Math.min(15000 * this.backoffCount, 60000);
                console.warn(`[POLARYON MOTOR] 🚦 429 Rate-Limit na sala ${this.sessionId}! count=${this._429count} Backoff: ${backoffMs/1000}s`);
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
        this.bidAgent = null;       // 🔌 Pool dedicado para envio de lances (não compete com polling)
        this.recentBids = new Map();   // 🛡️ Global dedup: { 'itemId': { value, timestamp } } (v3.8.130)
        this.bidsInProgress = new Map(); // 🔒 Mutex bid em andamento: { itemKey: timestamp } (v3.8.174)
        this.bidsInProgress = new Map(); // 🔒 Mutex: itemId → timestamp de bid em andamento (v3.8.174)
        // 📊 LATÊNCIA TRACKER (v3.8.131): monitora WebSocket vs HTTP fetch
        this.latencyStats = {
            ws: { count: 0, totalMs: 0, min: Infinity, max: 0 },
            http: { count: 0, totalMs: 0, min: Infinity, max: 0 }
        };
        this.lastLatencyLog = 0;
        
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
            rejectUnauthorized: false,
            keepAlive: true,
            maxSockets: 8,
            keepAliveMsecs: 30000
        });

        // 🔌 Pool DEDICADO para envio de lances (maxSockets=8, não compete com polling)
        this.bidAgent = new https.Agent({
            pfx: vault && vault.pfxBase64 ? Buffer.from(vault.pfxBase64, 'base64') : null,
            passphrase: vault && vault.password ? vault.password : null,
            rejectUnauthorized: false,
            keepAlive: true,
            maxSockets: 8,
            keepAliveMsecs: 600000, // 10min — evita que socket esfrie entre lances
            scheduling: 'lifo'      // FIFO distribui, LIFO reusa socket quente com mais frequência
        });
        // 🔥 Mantém socket do bidAgent aquecido — ping a cada 15s no REAL endpoint de lances
        // Usa /participacoes (endpoint confirmado) + /compras/{id}/itens/{id}/lances (socket do mesmo server)
        if (!this._bidKeepaliveTimers) this._bidKeepaliveTimers = [];
        this._bidKeepaliveTimers.push(setInterval(() => {
            const paths = [
                '/comprasnet-fase-externa/v1/compras/participacoes?tamanhoPagina=1',
                '/comprasnet-disputa/v1/compras/participacoes?tamanhoPagina=1'
            ];
            for (const path of paths) {
                const req = https.get('https://cnetmobile.estaleiro.serpro.gov.br' + path, {
                    agent: this.bidAgent,
                    timeout: 5000,
                    headers: { 'Accept': 'application/json' }
                });
                req.on('error', () => {});
                req.end();
            }
        }, 15000));

        // 🔄 Pre-fetch de captcha contínuo: mantém tokens SEMPRE frescos (refresca a cada 12s, antes do TTL de 15s)
        if (!this._captchaPrefetchTimer) {
            this._captchaPrefetchTimer = setInterval(() => {
                captchaManager.getTokens().catch(() => {});
            }, 12000);
        }

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

    /**
     * 🎯 Injeta dados de itens em tempo real (WebSocket) em TODOS os RoomRunners ativos
     */
    injectRealtimeItems(codigo, items) {
        for (const [sessionId, runner] of this.activeRunners) {
            if (runner.active && runner.idCompra === String(codigo)) {
                runner.injectRealtimeItems(items);
            }
        }
    }

    /**
     * 🛡️ Notifica que um lance foi enviado (pelo frontend ou outro processo)
     * Atualiza cooldown + último valor do RoomRunner para evitar duplicação
     */
    notifyBidSent(purchaseId, itemId, value) {
        const dedupKey = `${purchaseId}_${itemId}`;
        this.recentBids.set(dedupKey, { value, timestamp: Date.now() });
        for (const [sessionId, runner] of this.activeRunners) {
            if (runner.active && runner.idCompra === purchaseId) {
                const now = Date.now();
                runner.lastBidTimes.set(String(itemId), now);
                runner.lastBidValues.set(String(itemId), value);
                console.log(`[BACKEND SNIPER] 🛡️ Cooldown sincronizado: Item ${itemId} (R$ ${value}) — notificado pelo frontend.`);
            }
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
     * 🔒 Verifica se há um bid em andamento para este item (mutex frontend/backend)
     */
    isBidInProgress(itemId) {
        const lock = this.bidsInProgress.get(String(itemId));
        return lock && (Date.now() - lock) < 5000;
    }

    /**
     * 🔫 Disparo Rest Direto! Sem Depender de Janela Visual!
     */
    async sendBid({ purchaseId, itemId, value }) {
        const now = Date.now();
        const itemKey = String(itemId);
        const dedupKey = `${purchaseId}_${itemId}`;

        // 🛡️ DEDUP GLOBAL: qualquer lance p/ mesmo item nos últimos 500ms? (v3.8.175 — reduzido de 1000ms, mutex protege)
        const recent = this.recentBids.get(dedupKey);
        if (recent && (now - recent.timestamp) < 500) {
            console.log(`[KAMIKAZE SNIPER] 🛡️ Dedup temporal: R$ ${value} ignorado para Item ${itemId} — último lance foi há ${(now-recent.timestamp)/1000}s (mínimo 500ms, mutex ativo).`);
            return;
        }
        this.recentBids.set(dedupKey, { value, timestamp: now });

        // 🔒 Mutex: marca item com bid em andamento (impede RoomRunner de disparar concorrente)
        this.bidsInProgress.set(itemKey, now);
        try {

        // 🔄 Tenta até 2x com captcha fresco em caso de 400 (captcha expirado)
        for (let attempt = 1; attempt <= 2; attempt++) {
            const bidStart = Date.now();
            try {
                console.log(`[KAMIKAZE SNIPER] [Tentativa ${attempt}] Engatilhando Lance HTTP Invisível: Item ${itemId} | Valor: ${value}`);
                const captchas = await captchaManager.getTokens();
                
                let token = global.serproToken;

                if (!token) {
                    throw new Error("Token de Sessão não capturado. Disparo Abortado.");
                }

                // Na 2ª tentativa, força captchaManager a renovar os tokens (ignora cache)
                if (attempt === 2) {
                    captchaManager.lastFetch = 0;
                    captchaManager.token1 = '';
                    captchaManager.token2 = '';
                    const fresh = await captchaManager.getTokens();
                    fresh.captcha1 = fresh.captcha1 || captchas.captcha1;
                    fresh.captcha2 = fresh.captcha2 || captchas.captcha2;
                    const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances?captcha1=${fresh.captcha1}&captcha2=${fresh.captcha2}&captcha3=${fresh.captcha1}`;
                    const payload = { valorInformado: parseFloat(value), faseItem: "LA" };
                    const response = await axios.post(targetUrl, payload, {
                        httpsAgent: this.bidAgent || this.agent,
                        headers: {
                            'Authorization': token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                            'x-device-platform': 'web',
                            'x-version-number': '6.0.2'
                        }
                    });
                    const bidLatency2 = Date.now() - bidStart;
                    console.log(`[KAMIKAZE SNIPER] 🎯 Headshot Confirmado! Status API Serpro: ${response.status} (${bidLatency2}ms)`);
                    if (this.webContents && !this.webContents.isDestroyed()) {
                        this.webContents.send('bidding-update-log', `🎯 Lance Kamikaze de R$ ${value} no Item ${itemId} ACERTOU O ALVO! (${bidLatency2}ms)`);
                    }
                    return; // Sucesso
                }

                const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${purchaseId}/itens/${itemId}/lances?captcha1=${captchas.captcha1}&captcha2=${captchas.captcha2}&captcha3=${captchas.captcha3}`;

                const payload = {
                    valorInformado: parseFloat(value),
                    faseItem: "LA"
                };

                const response = await axios.post(targetUrl, payload, {
                    httpsAgent: this.bidAgent || this.agent,
                    headers: {
                        'Authorization': token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'x-device-platform': 'web',
                        'x-version-number': '6.0.2'
                    }
                });

                const bidLatency = Date.now() - bidStart;
                console.log(`[KAMIKAZE SNIPER] 🎯 Headshot Confirmado! Status API Serpro: ${response.status} (${bidLatency}ms)`);
                
                if (this.webContents && !this.webContents.isDestroyed()) {
                    this.webContents.send('bidding-update-log', `🎯 Lance Kamikaze de R$ ${value} no Item ${itemId} ACERTOU O ALVO! (${bidLatency}ms)`);
                }
                return; // Sucesso — sai do loop
            } catch (e) {
                const bidLatency = Date.now() - bidStart;
                const statusCode = e.response ? e.response.status : 0;
                if (statusCode === 400 && attempt === 1) {
                    console.warn(`[KAMIKAZE SNIPER] ⚠️ 400 na tentativa ${attempt}. Captcha possivelmente expirado — forçando renovação e tentando novamente...`);
                    continue; // 🔄 Retry com captcha fresco
                }
                const errData = e.response ? e.response.data : null;
                const errMsg = typeof errData === 'object' ? (errData.message || JSON.stringify(errData)) : (errData || e.message);
                console.error(`[KAMIKAZE SNIPER] ❌ O disparo travou (${bidLatency}ms):`, errMsg);

                if (statusCode === 422) {
                    // 📋 Loga a RESPOSTA REAL DA SERPRO para debug (v3.8.174)
                    const serproResponse = errData ? JSON.stringify(errData) : 'sem resposta';
                    console.warn(`[KAMIKAZE SNIPER] ⚠️ 422 — Resposta Serpro: ${serproResponse}`);
                    console.warn(`[KAMIKAZE SNIPER] ⚠️ 422 — Revertendo optimistic update. Item ${itemId}, valor R$ ${value}, latência ${bidLatency}ms.`);
                    if (this.webContents && !this.webContents.isDestroyed()) {
                        this.webContents.send('bidding-update-log', `❌ [422] Serpro: ${serproResponse} | Lance R$ ${value} no Item ${itemId} rejeitado.`);
                        this.webContents.send('bid-failed', { purchaseId, itemId, value, reason: 'min_interval', status: 422, serproResponse });
                    }
                    return;
                }

                if (this.webContents && !this.webContents.isDestroyed()) {
                    this.webContents.send('bidding-update-log', `❌ Falha ao tentar atirar no Item ${itemId} (${bidLatency}ms). Erro: ${errMsg}`);
                }
                return; // Erro não-recuperável — aborta
            }
            }
        } finally {
            // 🔒 Limpa mutex de bid em andamento (sucesso ou falha)
            this.bidsInProgress.delete(itemKey);
        }
    }
}

module.exports = BiddingRunner;
module.exports.getCaptchaTokens = () => captchaManager.getTokens();
module.exports.getFreshCaptchaToken = () => captchaManager.getFreshToken();
