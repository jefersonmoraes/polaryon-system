const axios = require('axios');
const https = require('https');
const { ipcMain } = require('electron');

/**
 * ClockSync - Sincronizador de Relógio Atômico
 */
class ClockSync {
    constructor() {
        this.offset = 0;
    }
    update(serverDateHeader) {
        if (!serverDateHeader) return;
        const serverTime = new Date(serverDateHeader).getTime();
        this.offset = serverTime - Date.now();
    }
    getServerTime() {
        return Date.now() + this.offset;
    }
}

/**
 * ItemRunner v3.6.22 - Dynamic Sync & Logs
 */
class ItemRunner {
    constructor(itemId, idCompra, agent, webContents, config, clockSync) {
        this.itemId = itemId;
        this.idCompra = idCompra;
        this.agent = agent;
        this.webContents = webContents;
        this.config = config;
        this.clockSync = clockSync;
        this.active = true;
        this.timeoutId = null;
        this.purchaseTitle = '';
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
            const data = res.data;

            const itemsList = Array.isArray(data) ? data : (data.itens || []);
            const item = itemsList.find(it => String(it.numero) === String(this.itemId) || String(it.identificador) === String(this.itemId));
            
            if (item) {
                const posicaoTxt = item.situacaoParticipanteDisputaTraduzido || (item.situacaoParticipanteDisputa === 'G' ? 'GANHANDO' : 'PERDENDO');
                this.purchaseTitle = data.termoObjeto || item.descricao || `Dispensa ${this.idCompra.substring(8, 13)}/${this.idCompra.substring(13, 17)}`;

                let secondsLeft = item.segundosParaEncerramento;
                if (secondsLeft === undefined || secondsLeft === null) {
                    if (item.dataHoraFimContagem) {
                        const endTime = new Date(item.dataHoraFimContagem).getTime();
                        const nowTime = new Date().getTime();
                        secondsLeft = Math.max(0, (endTime - nowTime) / 1000);
                    } else {
                        secondsLeft = -1;
                    }
                }

                this.webContents.send('bidding-update', {
                    sessionId: this.idCompra,
                    uasg: this.idCompra.substring(0, 6),
                    sessionTitle: this.purchaseTitle,
                    log: `[MOTOR] Item ${this.itemId}: ${posicaoTxt} | T: ${Math.floor(secondsLeft)}s`,
                    items: [{
                        itemId: this.itemId,
                        valorAtual: item.melhorValorGeral ? item.melhorValorGeral.valorCalculado : item.melhorLance,
                        meuValor: item.melhorValorFornecedor ? item.melhorValorFornecedor.valorCalculado : item.valorLanceProposta,
                        status: item.faseTraduzido || item.fase,
                        posicao: posicaoTxt,
                        timerSeconds: secondsLeft,
                        desc: item.descricao
                    }]
                });

                const nextInterval = (secondsLeft > 0 && secondsLeft < 45) ? 100 : 2000;
                this.timeoutId = setTimeout(() => this.run(), nextInterval);
            } else {
                this.timeoutId = setTimeout(() => this.run(), 5000);
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
        if (this.activeSessions.has(idCompra)) return;

        const agent = new https.Agent({
            pfx: Buffer.from(vault.pfxBase64, 'base64'),
            passphrase: vault.password,
            rejectUnauthorized: false
        });

        this.activeSessions.add(idCompra);
        const itemsConfig = vault.itemsConfig || {};
        for (const itemId in itemsConfig) {
            const runner = new ItemRunner(itemId, idCompra, agent, this.webContents, itemsConfig[itemId], this.clockSync);
            this.activeRunners.set(`${idCompra}_${itemId}`, runner);
            runner.run();
        }
    }

    stop(sessionId, uasg, numero, ano, modality = '06') {
        const idCompra = `${uasg}${modality}${String(numero).padStart(5, '0')}${ano}`;
        for (const [key, runner] of this.activeRunners.entries()) {
            if (key.startsWith(idCompra)) {
                runner.stop();
                this.activeRunners.delete(key);
            }
        }
        this.activeSessions.delete(idCompra);
    }

    updateConfig(sessionId, config, uasg, numero, ano, modality = '06') {
        const idCompra = `${uasg}${modality}${String(numero).padStart(5, '0')}${ano}`;
        const itemsConfig = config.itemsConfig || {};
        for (const itemId in itemsConfig) {
            const runner = this.activeRunners.get(`${idCompra}_${itemId}`);
            if (runner) runner.config = itemsConfig[itemId];
        }
    }
}

module.exports = BiddingRunner;
