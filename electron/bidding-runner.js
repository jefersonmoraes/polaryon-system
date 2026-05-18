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
                axios.get('https://capgen.sigapregao.com.br/capgen/captcha-dispensas', { headers }).catch(() => ({data: ''})),
                axios.get('https://capgen.sigapregao.com.br/capgen/captcha-dispensas-2', { headers }).catch(() => ({data: ''}))
            ]);

            if (res1.data) this.token1 = res1.data;
            if (res2.data) this.token2 = res2.data;
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
 * ItemRunner v3.6.26 - Final Strike (Type Consistency & Value Mapping)
 */
class ItemRunner {
    constructor(itemId, idCompra, originalSessionId, agent, webContents, config, clockSync) {
        this.itemId = String(itemId); // Força ID como String para bater com o Frontend
        this.idCompra = idCompra;
        this.originalSessionId = originalSessionId;
        this.agent = agent;
        this.webContents = webContents;
        this.config = config;
        this.clockSync = clockSync;
        this.active = true;
        this.timeoutId = null;
    }

    async run() {
        if (!this.active) return;

        try {
            const captchas = await captchaManager.getTokens();
            const token = await ipcMain.invoke('get-login-token');
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/em-disputa?configs=false&captcha1=${captchas.captcha1}&captcha2=${captchas.captcha2}&captcha3=${captchas.captcha3}`;
            
            const res = await axios.get(url, {
                httpsAgent: this.agent,
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            this.clockSync.update(res.headers.date);
            const itemsList = Array.isArray(res.data) ? res.data : (res.data.itens || []);
            
            // Busca o item garantindo comparação de string
            const item = itemsList.find(it => 
                String(it.numero) === this.itemId || 
                String(it.identificador) === this.itemId ||
                (it.descricao && it.descricao.toLowerCase().includes('lâmpada'))
            );
            
            if (item) {
                const posicaoTxt = item.situacaoParticipanteDisputaTraduzido || (item.situacaoParticipanteDisputa === 'G' ? 'GANHANDO' : 'PERDENDO');
                const title = item.descricao || `Item ${this.itemId}`;

                let secondsLeft = item.segundosParaEncerramento;
                if (secondsLeft === undefined || secondsLeft === null) {
                    if (item.dataHoraFimContagem) {
                        const endTime = new Date(item.dataHoraFimContagem).getTime();
                        const serverNow = this.clockSync.getServerTime();
                        secondsLeft = Math.max(0, (endTime - serverNow) / 1000);
                    } else {
                        secondsLeft = -1;
                    }
                }

                // 🏁 Envio de dados com consistência de tipos
                this.webContents.send('bidding-update', {
                    sessionId: this.originalSessionId,
                    uasg: this.idCompra.substring(0, 6),
                    sessionTitle: title,
                    log: `[MOTOR] Item ${this.itemId}: ${posicaoTxt} | ${Math.floor(secondsLeft)}s`,
                    items: [{
                        itemId: this.itemId, // Mantém como String
                        valorAtual: item.melhorValorGeral ? item.melhorValorGeral.valorCalculado : (item.melhorValorGeral ? item.melhorValorGeral.valorInformado : 0),
                        meuValor: item.melhorValorFornecedor ? item.melhorValorFornecedor.valorCalculado : (item.melhorValorFornecedor ? item.melhorValorFornecedor.valorInformado : 0),
                        status: item.faseTraduzido || item.fase || 'Em Disputa',
                        posicao: posicaoTxt,
                        timerSeconds: secondsLeft,
                        desc: item.descricao
                    }]
                });

                const nextInterval = (secondsLeft > 0 && secondsLeft < 45) ? 100 : 1500;
                this.timeoutId = setTimeout(() => this.run(), nextInterval);
            } else {
                this.timeoutId = setTimeout(() => this.run(), 4000);
            }

        } catch (e) {
            this.timeoutId = setTimeout(() => this.run(), 5000);
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
        this.activeRunners = new Map();
        this.activeSessions = new Set();
    }

    async start(sessionId, uasg, numero, ano, vault, modality = '06') {
        const idCompra = `${uasg}${modality}${String(numero).padStart(5, '0')}${ano}`;
        if (this.activeSessions.has(sessionId)) return;

        const agent = new https.Agent({
            pfx: Buffer.from(vault.pfxBase64, 'base64'),
            passphrase: vault.password,
            rejectUnauthorized: false
        });

        this.activeSessions.add(sessionId);
        const itemsConfig = vault.itemsConfig || {};
        for (const itemId in itemsConfig) {
            const runner = new ItemRunner(itemId, idCompra, sessionId, agent, this.webContents, itemsConfig[itemId], this.clockSync);
            this.activeRunners.set(`${sessionId}_${itemId}`, runner);
            runner.run();
        }
    }

    stop(sessionId) {
        for (const [key, runner] of this.activeRunners.entries()) {
            if (key.startsWith(sessionId)) {
                runner.stop();
                this.activeRunners.delete(key);
            }
        }
        this.activeSessions.delete(sessionId);
    }

    updateConfig(sessionId, config) {
        const itemsConfig = config.itemsConfig || {};
        for (const itemId in itemsConfig) {
            const runner = this.activeRunners.get(`${sessionId}_${itemId}`);
            if (runner) runner.config = itemsConfig[itemId];
        }
    }
}

module.exports = BiddingRunner;
