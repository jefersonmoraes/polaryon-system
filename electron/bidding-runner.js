const axios = require('axios');
const https = require('https');
const { ipcMain } = require('electron');

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
 * ItemRunner v3.6.24 - Absolute Precision (Serpro DNA)
 */
class ItemRunner {
    constructor(itemId, idCompra, originalSessionId, agent, webContents, config, clockSync) {
        this.itemId = itemId;
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
            const token = await ipcMain.invoke('get-login-token');
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/${this.idCompra}/itens/em-disputa?configs=false&captcha1=&captcha2=&captcha3=`;
            
            const res = await axios.get(url, {
                httpsAgent: this.agent,
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            this.clockSync.update(res.headers.date);
            const itemsList = Array.isArray(res.data) ? res.data : (res.data.itens || []);
            
            const item = itemsList.find(it => String(it.numero) === String(this.itemId) || String(it.identificador) === String(this.itemId));
            
            if (item) {
                // 🏆 Mapeamento SIGA-DNA (v3.6.24)
                const posicaoTxt = item.situacaoParticipanteDisputaTraduzido || (item.situacaoParticipanteDisputa === 'G' ? 'GANHANDO' : 'PERDENDO');
                const title = item.descricao || `Item ${this.itemId}`;

                // ⏱️ Cálculo de Tempo com Sincronia de Servidor
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

                // 🏁 Envio de Dados com ID Original (Bridge Fix)
                this.webContents.send('bidding-update', {
                    sessionId: this.originalSessionId,
                    uasg: this.idCompra.substring(0, 6),
                    sessionTitle: title,
                    log: `[MOTOR] Sincronizado: ${posicaoTxt} | Relógio: ${Math.floor(secondsLeft)}s`,
                    items: [{
                        itemId: this.itemId,
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
