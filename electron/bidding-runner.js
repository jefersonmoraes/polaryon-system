const axios = require('axios');
const https = require('https');
const { ipcMain } = require('electron');

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
                    const posicaoTxt = item.classificacao || item.posicao || (item.melhorValorFornecedor && (item.melhorValorFornecedor.classificacao || item.melhorValorFornecedor.posicao)) || item.situacaoParticipanteDisputaTraduzido || (item.situacaoParticipanteDisputa === 'G' ? 'GANHANDO' : 'PERDENDO');
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

                    return {
                        itemId: String(item.numero || item.identificador),
                        purchaseId: this.idCompra,
                        valorAtual: item.melhorValorGeral ? item.melhorValorGeral.valorCalculado : (item.melhorValorGeral ? item.melhorValorGeral.valorInformado : 0),
                        meuValor: item.melhorValorFornecedor ? item.melhorValorFornecedor.valorCalculado : (item.melhorValorFornecedor ? item.melhorValorFornecedor.valorInformado : 0),
                        status: item.faseTraduzido || item.fase || 'Em Disputa',
                        posicao: posicaoTxt,
                        timerSeconds: secondsLeft,
                        dataHoraFimContagem: item.dataHoraFimContagem,
                        officialMargin: item.variacaoMinimaEntreLances || 1,
                        officialMarginType: item.tipoVariacaoMinimaEntreLances || 'V',
                        desc: item.descricao
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

                            // Só dispara nos 30 segundos finais OU em modo kamikaze
                            if (!((tSeconds <= 30 && tSeconds > 0) || isKamikaze)) continue;

                            // Verifica se está perdendo
                            const posicao = String(mappedItem.posicao || '');
                            const isWinning = (posicao === '1' || posicao === '1º' || posicao === '1°' || posicao === 'V' || posicao === 'VENCEDOR');
                            if (isWinning) continue;

                            const currentBest = Number(mappedItem.valorAtual || 0);
                            const myCurrentBid = Number(mappedItem.meuValor || 999999999);
                            const margin = Number(strat.decrementValue || 1);
                            const allow4 = strat.useFourDecimals || false;

                            // Cooldown para não spammar (Kamikaze: 500ms, Normal: 2000ms)
                            const now = Date.now();
                            const cooldown = isKamikaze ? 500 : 2000;
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
                            const isLeaderBeatable = (currentBest > 0 && (currentBest - margin) >= myMin && maxAllowedToTakeLead >= myMin);

                            if (isLeaderBeatable) {
                                // Tenta assumir a ponta usando nossa margem ou a margem obrigatória
                                nextBid = Math.min(currentBest - margin, maxAllowedToTakeLead);
                            } else {
                                // Líder imbatível ou não podemos cobrir a margem oficial:
                                // Envia o MÍNIMO para garantir a melhor posição possível no ranking (ex: 2º lugar)
                                nextBid = myMin;
                            }

                            if (nextBid < myMin) nextBid = myMin;
                            nextBid = allow4
                                ? Math.floor(nextBid * 10000) / 10000
                                : Math.floor(nextBid * 100) / 100;

                            // Validações de segurança
                            if (nextBid < myMin) {
                                console.log(`[BACKEND SNIPER] Item ${sId}: Lance R$ ${nextBid} abaixo do mínimo R$ ${myMin}. Bloqueado.`);
                                continue;
                            }
                            
                            // Bloqueia apenas se o lance não melhorar o PRÓPRIO lance atual do usuário
                            if (myCurrentBid !== 999999999 && nextBid >= myCurrentBid) {
                                console.log(`[BACKEND SNIPER] Item ${sId}: Lance R$ ${nextBid} não melhora meu atual R$ ${myCurrentBid}. Bloqueado.`);
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
                // 🛑 RATE-LIMIT DETECTADO: Backoff Exponencial Anti-429 (v3.8.2)
                this.backoffCount = (this.backoffCount || 0) + 1;
                const backoffMs = Math.min(15000 * this.backoffCount, 60000); // 15s, 30s, 45s, 60s max
                console.warn(`[POLARYON MOTOR] 🚦 429 Rate-Limit na sala ${this.sessionId}! Backoff exponencial: ${backoffMs/1000}s (tentativa ${this.backoffCount})`);
                // Força renovação de captcha na próxima rodada
                captchaManager.lastFetch = 0;
                captchaManager.token1 = '';
                captchaManager.token2 = '';
                if (!this.webContents.isDestroyed()) {
                    this.webContents.send('bidding-update-log', `⏳ [ANTI-429] Servidor pediu pausa. Aguardando ${backoffMs/1000}s antes de retomar radar...`);
                }
                this.timeoutId = setTimeout(() => this.run(), backoffMs);
                return;
            }

            this.backoffCount = 0; // Reset backoff em erro diferente de 429
            console.error('[POLARYON MOTOR] Erro na varredura da sala:', e.message);
            
            // Anti-Ghost: Se houver erro de rede, 401 ou 403, avisa o painel imediatamente para pausar a sessão e solicitar re-auth
            if (statusError === 401 || statusError === 403 || statusError >= 500 || (e.message && e.message.includes('network'))) {
                console.warn(`[POLARYON MOTOR] 🚨 Queda de Sessão detectada (Anti-Ghost ativado). Código: ${statusError}`);
                if (!this.webContents.isDestroyed()) {
                    this.webContents.send('bidding-error', {
                        sessionId: this.sessionId,
                        error: 'Conexão perdida ou Token expirado. A sessão foi desativada por segurança.',
                        code: statusError,
                        action: 'REQUIRE_REAUTH'
                    });
                }
            }

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
