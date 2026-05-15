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
 * ItemRunner v3.6.16 - Visão de Águia (Format Fix)
 */
class ItemRunner {
    constructor(itemId, idCompra, agent, webContents, config, clockSync) {
        this.itemId = itemId;
        this.idCompra = idCompra; // UASG + MOD + NUM + ANO
        this.agent = agent;
        this.webContents = webContents;
        this.config = config;
        this.clockSync = clockSync;
        this.active = true;
        this.timeoutId = null;
        this.currentRank = '?';
        this.purchaseTitle = '';
    }

    async run() {
        if (!this.active) return;

        try {
            // 1. Captura de Dados (Busca em Massa para evitar 204)
            const itemsUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${this.idCompra}/itens`;
            const res = await axios.get(itemsUrl, { 
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            
            this.clockSync.update(res.headers.date);
            const itemsList = res.data;
            const item = itemsList.find(it => String(it.numero) === String(this.itemId) || String(it.identificador) === String(this.itemId));

            if (item) {
                this.currentRank = String(item.posicaoParticipanteDisputa || item.posicao || '?');
                
                // 2. Busca de Título (Se ainda não tiver)
                if (!this.purchaseTitle || this.purchaseTitle.includes('UNDEFINED')) {
                    try {
                        const compraUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${this.idCompra}`;
                        const compraRes = await axios.get(compraUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                        if (compraRes.data) {
                            const c = compraRes.data;
                            this.purchaseTitle = `${c.modalidadeTraduzido} ${c.numero}/${c.ano} | ${c.uasgNome}`;
                        }
                    } catch (e) {
                        this.purchaseTitle = `Dispensa ${this.idCompra.substring(8, 13)}/${this.idCompra.substring(13, 17)} | UASG ${this.idCompra.substring(0, 6)}`;
                    }
                }

                // 3. Cronômetro Real
                let secondsLeft = item.segundosParaEncerramento;
                if (secondsLeft === undefined || secondsLeft === null) {
                    const endTime = item.dataHoraFimContagem ? new Date(item.dataHoraFimContagem).getTime() : 0;
                    secondsLeft = endTime ? Math.max(0, (endTime - this.clockSync.getServerTime()) / 1000) : -1;
                }

                // 4. Notifica UI
                this.webContents.send('bidding-update', {
                    sessionId: this.idCompra,
                    uasg: this.idCompra.substring(0, 6),
                    sessionTitle: this.purchaseTitle,
                    items: [{
                        itemId: this.itemId,
                        valorAtual: item.melhorLance || item.valorEstimado,
                        meuValor: item.valorLanceProposta,
                        status: item.faseTraduzido || item.fase,
                        posicao: this.currentRank,
                        timerSeconds: secondsLeft,
                        desc: item.descricao
                    }]
                });

                const nextInterval = (secondsLeft > 0 && secondsLeft < 45) ? 100 : 2000;
                this.timeoutId = setTimeout(() => this.run(), nextInterval);
            } else {
                // Item não encontrado na lista, tenta de novo em 5s
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
        // Formato ID Compra: UASG + MOD + NUM + ANO (17 chars)
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
