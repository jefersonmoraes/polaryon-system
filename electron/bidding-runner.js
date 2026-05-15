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
 * ItemRunner v3.6.15 - Visão de Águia (Estabilidade Total)
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
        this.currentRank = '?';
        this.purchaseTitle = '';
    }

    async run() {
        if (!this.active) return;

        try {
            // 1. Dados Públicos (Garantidos)
            const itemUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${this.idCompra}/itens/${this.itemId}`;
            const res = await axios.get(itemUrl, { 
                timeout: 3000,
                headers: { 'User-Agent': 'SIGAClient/0.7.2' }
            });
            this.clockSync.update(res.headers.date);
            const item = res.data;

            // Extração de Ranking e Título da API de Itens (Fallback Seguro)
            this.currentRank = String(item.posicaoParticipanteDisputa || item.posicao || '?');
            
            // Tenta pegar o título oficial da compra
            if (!this.purchaseTitle) {
                try {
                    const compraUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${this.idCompra}`;
                    const compraRes = await axios.get(compraUrl, { headers: { 'User-Agent': 'SIGAClient/0.7.2' } });
                    if (compraRes.data) {
                        const c = compraRes.data;
                        this.purchaseTitle = `${c.modalidadeTraduzido} ${c.numero}/${c.ano} | ${c.uasgNome}`;
                    }
                } catch (e) {
                    this.purchaseTitle = `Dispensa ${this.idCompra.substring(8, 13)}/${this.idCompra.substring(13, 17)} | UASG ${this.idCompra.substring(0, 6)}`;
                }
            }

            // 2. Cronômetro Real
            let secondsLeft = item.segundosParaEncerramento;
            if (secondsLeft === undefined || secondsLeft === null) {
                const endTime = item.dataHoraFimContagem ? new Date(item.dataHoraFimContagem).getTime() : 0;
                secondsLeft = endTime ? Math.max(0, (endTime - this.clockSync.getServerTime()) / 1000) : -1;
            }

            // 3. Tenta Ranking Privado (Apenas se tiver Token)
            try {
                const token = await ipcMain.invoke('get-login-token');
                if (token) {
                    const salaUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api/v1/lances/compra/${this.idCompra}/item/${this.itemId}`;
                    const salaRes = await axios.get(salaUrl, {
                        httpsAgent: this.agent,
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (salaRes.data && salaRes.data.posicaoParticipante) {
                        this.currentRank = String(salaRes.data.posicaoParticipante);
                    }
                }
            } catch (e) { /* Fallback já definido no passo 1 */ }

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
