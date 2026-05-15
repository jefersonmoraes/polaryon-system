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
    }

    async run() {
        if (!this.active) return;

        try {
            // Polling de status do item
            const itemUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${this.idCompra}/itens/${this.itemId}`;
            const res = await axios.get(itemUrl, { timeout: 3000 });
            
            this.clockSync.update(res.headers.date);
            const item = res.data;

            // Lógica de Sniper e Disparo
            const serverTime = this.clockSync.getServerTime();
            const endTime = item.dataHoraFimContagem ? new Date(item.dataHoraFimContagem).getTime() : 0;
            const secondsLeft = endTime ? Math.max(0, (endTime - serverTime) / 1000) : -1;

            // Notificações de mudança de fase
            if (this.prevStatus !== item.fase) {
                this.webContents.send('bidding-log', { 
                    itemId: this.itemId, 
                    message: `Fase alterada: ${this.prevStatus || 'Início'} -> ${item.fase}` 
                });
                this.prevStatus = item.fase;
            }

            // AVALIAÇÃO DE LANCE
            await this.evaluateAndBid(item, secondsLeft);

            // INTERVALO DINÂMICO (Janela Sniper)
            // Se estiver em disputa e faltando menos de 45 segundos, entra em modo TURBO (100ms)
            let nextInterval = 2000;
            if (item.fase === 'DISPUTA' || item.fase === 'IMINENTE') {
                if (secondsLeft > 0 && secondsLeft < 45) {
                    nextInterval = 100; // MODO SNIPER ATIVADO
                } else {
                    nextInterval = 400; // MODO DISPUTA PADRÃO
                }
            }

            this.timeoutId = setTimeout(() => this.run(), nextInterval);

        } catch (e) {
            this.timeoutId = setTimeout(() => this.run(), 5000); // Retry em erro
        }
    }

    async evaluateAndBid(item, secondsLeft) {
        const myPosition = item.melhorLance === item.valorLanceProposta ? 1 : 0;
        if (myPosition === 1) return; // Já ganhando

        const currentVal = item.melhorLance || item.valorEstimado;
        const minPrice = this.config.minPrice || 0.1;
        const decrement = this.config.decrementValue || 0.01;

        if (currentVal <= minPrice) return;

        let targetValue = currentVal - (this.config.decrementType === 'fixed' ? decrement : (currentVal * decrement / 100));
        targetValue = Math.max(targetValue, minPrice);
        targetValue = Math.round(targetValue * 100) / 100;

        // ESTRATÉGIA SNIPER: Disparar nos últimos 3 segundos sincronizados
        const isSniperWindow = secondsLeft > 0 && secondsLeft <= 3.5;
        const isNormalFollower = this.config.mode === 'follower' && (item.fase === 'DISPUTA' || item.fase === 'IMINENTE');

        if (isSniperWindow || isNormalFollower) {
            if (targetValue === this.lastBid) return; // Evita lances duplicados
            
            try {
                await this.executeBid(targetValue);
                this.lastBid = targetValue;
                this.webContents.send('bidding-action', {
                    itemId: this.itemId,
                    value: targetValue,
                    status: 'success',
                    reason: isSniperWindow ? 'Sniper Sincronizado' : 'Seguidor Automático'
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
        // Implementação real do POST para o Serpro (Sala de Disputa)
        // Aqui usamos o token mTLS e os headers que extraímos da engenharia reversa
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
 * BiddingRunner v3.6.11 - O Orquestrador Sniper
 */
class BiddingRunner {
    constructor(webContents) {
        this.webContents = webContents;
        this.clockSync = new ClockSync();
        this.activeRunners = new Map(); // sessionId_itemId -> ItemRunner
        this.sessions = new Map(); // sessionId -> sessionData
    }

    async start(sessionId, uasg, numero, ano, vault, modality = '06') {
        if (this.sessions.has(sessionId)) return;

        const agent = new https.Agent({
            pfx: Buffer.from(vault.pfxBase64, 'base64'),
            passphrase: vault.password,
            rejectUnauthorized: false
        });

        const paddedNum = String(numero).padStart(5, '0');
        const internalModality = modality === '14' ? '91' : modality;
        const idCompra = `${uasg}${internalModality}${paddedNum}${ano}`;

        this.sessions.set(sessionId, { idCompra, agent, vault });

        // Inicia runners para cada item configurado
        const itemsConfig = vault.itemsConfig || {};
        for (const itemId in itemsConfig) {
            const key = `${sessionId}_${itemId}`;
            if (!this.activeRunners.has(key)) {
                const runner = new ItemRunner(itemId, idCompra, agent, this.webContents, itemsConfig[itemId], this.clockSync);
                this.activeRunners.set(key, runner);
                runner.run();
            }
        }

        console.log(`[v3.6.11] Motor Sniper iniciado para ${idCompra}`);
    }

    stop(sessionId) {
        for (const [key, runner] of this.activeRunners.entries()) {
            if (key.startsWith(sessionId)) {
                runner.stop();
                this.activeRunners.delete(key);
            }
        }
        this.sessions.delete(sessionId);
    }

    updateConfig(sessionId, config) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.vault.itemsConfig = config.itemsConfig || session.vault.itemsConfig;
            // Atualiza runners existentes
            for (const itemId in session.vault.itemsConfig) {
                const runner = this.activeRunners.get(`${sessionId}_${itemId}`);
                if (runner) runner.config = session.vault.itemsConfig[itemId];
            }
        }
    }
}

module.exports = BiddingRunner;
