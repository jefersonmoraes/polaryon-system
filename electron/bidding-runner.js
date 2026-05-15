const axios = require('axios');
const https = require('https');
const { ipcMain } = require('electron');

/**
 * ClockSync - Sincronizador de Relógio Atômico (Governo vs Local)
 */
class ClockSync {
    constructor() {
        this.offset = 0;
        this.lastSync = 0;
    }

    update(serverDateHeader) {
        if (!serverDateHeader) return;
        const serverTime = new Date(serverDateHeader).getTime();
        const localTime = Date.now();
        this.offset = serverTime - localTime;
        this.lastSync = localTime;
    }

    getServerTime() {
        return Date.now() + this.offset;
    }
}

/**
 * ItemRunner - Controlador independente para cada item (Multithread Style)
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
        this.lastBid = 0;
        this.prevStatus = null;
        this.isPaused = false;
    }

    async run() {
        if (!this.active || this.isPaused) return;

        try {
            // Polling de status do item
            const itemUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${this.idCompra}/itens/${this.itemId}`;
            const res = await axios.get(itemUrl, { 
                timeout: 3000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SIGAClient/0.7.2 Electron/24.1.3 Safari/537.36' }
            });
            
            this.clockSync.update(res.headers.date);
            const item = res.data;

            // Sincronia de Tempo para Sniper
            const serverTime = this.clockSync.getServerTime();
            const endTime = item.dataHoraFimContagem ? new Date(item.dataHoraFimContagem).getTime() : 0;
            const secondsLeft = endTime ? Math.max(0, (endTime - serverTime) / 1000) : -1;

            if (this.prevStatus !== item.fase) {
                this.webContents.send('bidding-log', { 
                    itemId: this.itemId, 
                    message: `Fase: ${item.fase} | Sniper: ${secondsLeft > 0 ? secondsLeft.toFixed(1)+'s' : 'N/A'}` 
                });
                this.prevStatus = item.fase;
            }

            await this.evaluateAndBid(item, secondsLeft);

            // INTERVALO DINÂMICO (Algoritmo Sniper v3.6.11)
            let nextInterval = 2000;
            if (item.fase === 'DISPUTA' || item.fase === 'IMINENTE') {
                if (secondsLeft > 0 && secondsLeft < 45) {
                    nextInterval = 100; // TURBO MODE (10 FPS de monitoramento)
                } else {
                    nextInterval = 350; // Monitoramento agressivo padrão
                }
            }

            this.timeoutId = setTimeout(() => this.run(), nextInterval);

        } catch (e) {
            // TRATAMENTO DE ERROS DO SERPRO (Estilo Siga)
            if (e.response && e.response.status === 422) {
                this.webContents.send('bidding-log', { 
                    itemId: this.itemId, 
                    message: '⚠️ Erro 422: Resfriando conexão por 10 segundos...' 
                });
                this.isPaused = true;
                setTimeout(() => { this.isPaused = false; this.run(); }, 10000);
            } else {
                this.timeoutId = setTimeout(() => this.run(), 5000);
            }
        }
    }

    async evaluateAndBid(item, secondsLeft) {
        const myPosition = item.melhorLance === item.valorLanceProposta ? 1 : 0;
        if (myPosition === 1) return;

        const currentVal = item.melhorLance || item.valorEstimado;
        const minPrice = this.config.minPrice || 0.1;
        const decrement = this.config.decrementValue || 0.01;

        if (currentVal <= minPrice) return;

        let targetValue = currentVal - (this.config.decrementType === 'fixed' ? decrement : (currentVal * decrement / 100));
        targetValue = Math.max(targetValue, minPrice);
        targetValue = Math.round(targetValue * 100) / 100;

        // Disparo nos últimos 2.8s (Safe-zone do Serpro para garantir entrada no 59s/29s)
        const isSniperWindow = secondsLeft > 0 && secondsLeft <= 2.8;
        const isNormalFollower = this.config.mode === 'follower' && (item.fase === 'DISPUTA' || item.fase === 'IMINENTE');

        if (isSniperWindow || isNormalFollower) {
            if (targetValue === this.lastBid) return; 
            
            try {
                await this.executeBid(targetValue);
                this.lastBid = targetValue;
                this.webContents.send('bidding-action', {
                    itemId: this.itemId,
                    value: targetValue,
                    status: 'success',
                    reason: isSniperWindow ? `Sniper T-${secondsLeft.toFixed(1)}s` : 'Seguindo'
                });
            } catch (err) {
                this.webContents.send('bidding-action', {
                    itemId: this.itemId,
                    value: targetValue,
                    status: 'error',
                    error: err.message
                });
            }
        }
    }

    async executeBid(value) {
        const bidUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api/v1/lances';
        const payload = {
            sequencialItem: parseInt(this.itemId),
            valorLance: value
        };

        const token = await ipcMain.invoke('get-login-token'); 
        
        await axios.post(bidUrl, payload, {
            httpsAgent: this.agent,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SIGAClient/0.7.2 Electron/24.1.3 Safari/537.36'
            }
        });
    }

    stop() {
        this.active = false;
        if (this.timeoutId) clearTimeout(this.timeoutId);
    }
}

/**
 * BiddingRunner v3.6.11 - Elite Sniper
 */
class BiddingRunner {
    constructor(webContents) {
        this.webContents = webContents;
        this.clockSync = new ClockSync();
        this.activeRunners = new Map(); // key: idCompra_itemId
        this.activeSessions = new Set(); // key: idCompra (Bloqueio de duplicidade)
    }

    async start(sessionId, uasg, numero, ano, vault, modality = '06') {
        const paddedNum = String(numero).padStart(5, '0');
        const internalModality = modality === '14' ? '91' : modality;
        const idCompra = `${uasg}${internalModality}${paddedNum}${ano}`;

        // BLOQUEIO DE DUPLICIDADE POR ID COMPRA
        if (this.activeSessions.has(idCompra)) {
            console.log(`[v3.6.11] Sessão para ${idCompra} já ativa. Ignorando duplicata.`);
            return;
        }

        const agent = new https.Agent({
            pfx: Buffer.from(vault.pfxBase64, 'base64'),
            passphrase: vault.password,
            rejectUnauthorized: false
        });

        this.activeSessions.add(idCompra);

        const itemsConfig = vault.itemsConfig || {};
        for (const itemId in itemsConfig) {
            const key = `${idCompra}_${itemId}`;
            if (!this.activeRunners.has(key)) {
                const runner = new ItemRunner(itemId, idCompra, agent, this.webContents, itemsConfig[itemId], this.clockSync);
                this.activeRunners.set(key, runner);
                runner.run();
            }
        }

        console.log(`[v3.6.11] Motor Sniper ATÔMICO iniciado para ${idCompra}`);
    }

    stop(sessionId, uasg, numero, ano, modality = '06') {
        const paddedNum = String(numero).padStart(5, '0');
        const internalModality = modality === '14' ? '91' : modality;
        const idCompra = `${uasg}${internalModality}${paddedNum}${ano}`;

        for (const [key, runner] of this.activeRunners.entries()) {
            if (key.startsWith(idCompra)) {
                runner.stop();
                this.activeRunners.delete(key);
            }
        }
        this.activeSessions.delete(idCompra);
    }

    updateConfig(sessionId, config, uasg, numero, ano, modality = '06') {
        const paddedNum = String(numero).padStart(5, '0');
        const internalModality = modality === '14' ? '91' : modality;
        const idCompra = `${uasg}${internalModality}${paddedNum}${ano}`;

        const itemsConfig = config.itemsConfig || {};
        for (const itemId in itemsConfig) {
            const runner = this.activeRunners.get(`${idCompra}_${itemId}`);
            if (runner) runner.config = itemsConfig[itemId];
        }
    }
}

module.exports = BiddingRunner;
