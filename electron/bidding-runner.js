const axios = require('axios');
const https = require('https');

/**
 * BiddingRunner - Motor de Lances Local (Rodando no PC do Usuário)
 * Esta classe emula o comportamento do BiddingListener do servidor, 
 * mas roda dentro do processo principal do Electron.
 */
class BiddingRunner {
    constructor(webContents) {
        this.webContents = webContents;
        this.activeSessions = new Map(); // sessionId -> { intervalId, config, vault }
    }

    /**
     * Inicia o monitoramento de uma sala de disputa
     */
    async start(sessionId, uasg, numero, ano, vault) {
        if (this.activeSessions.has(sessionId)) return;

        console.log(`[LOCAL_RUNNER] Iniciando monitoramento para ${uasg}/${numero}-${ano}`);

        const agent = new https.Agent({
            pfx: Buffer.from(vault.pfxBase64, 'base64'),
            passphrase: vault.password,
            rejectUnauthorized: false
        });

        const paddedNum = String(numero).padStart(5, '0');
        const idCompra = `${uasg}06${paddedNum}${ano}`;

        const intervalId = setInterval(async () => {
            try {
                // 1. Busca Itens (Modo Público)
                const publicApiUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${idCompra}/itens`;
                const response = await axios.get(publicApiUrl, { 
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0 Polaryon-Desktop/1.0' }
                });

                if (response.data && Array.isArray(response.data)) {
                    const items = response.data.map(item => ({
                        itemId: String(item.numeroItem || item.sequencial),
                        valorAtual: item.melhorLance || item.valorEstimado || 0,
                        ganhador: item.fase === 'DISPUTA' ? 'Em Disputa' : (item.melhorLance ? 'Concorrente' : 'Aguardando'),
                        status: item.situacao || item.fase || 'Aberto',
                        descricao: item.descricao,
                        tempoRestante: item.segundosParaEncerramento || -1
                    }));

                    // 2. BUSCAR CONFIGURAÇÕES ATUALIZADAS (Simulando o que o backend faz)
                    // No Desktop, as configs vêm do "vault" ou de uma mensagem anterior.
                    // Para simplificar, assumimos que o Runner recebeu as configs iniciais.
                    const itemsConfig = vault.itemsConfig || {};
                    const simulationMode = vault.simulationMode ?? true;

                    const executedActions = [];

                    for (const item of items) {
                        const config = itemsConfig[item.itemId] || { mode: 'follower', minPrice: 0.10, decrementValue: 0.01, decrementType: 'fixed' };
                        
                        // Lógica de Decisão (Cópia da BiddingStrategyEngine para evitar problemas de import)
                        const decision = this.evaluateStrategy(item, config);
                        
                        if (decision.action === 'bid') {
                            const actionLog = { 
                                itemId: item.itemId, 
                                value: decision.value, 
                                reason: decision.reason, 
                                type: simulationMode ? 'SIMULATED' : 'REAL', 
                                status: 'pending', 
                                timestamp: new Date().toISOString() 
                            };
                            
                            if (simulationMode) {
                                actionLog.status = 'success';
                            } else {
                                try {
                                    await this.executeRealBid(idCompra, item.itemId, decision.value, agent);
                                    actionLog.status = 'success';
                                } catch (e) {
                                    actionLog.status = 'error';
                                    actionLog.error = e.message;
                                }
                            }
                            executedActions.push(actionLog);
                        }
                    }

                    // 3. Enviar atualização para o Frontend (React)
                    this.webContents.send('bidding-update', {
                        sessionId,
                        items,
                        actions: executedActions,
                        timestamp: new Date().toISOString(),
                        source: 'LOCAL'
                    });
                }
            } catch (error) {
                console.error(`[LOCAL_RUNNER] Erro no polling: ${error.message}`);
                this.webContents.send('bidding-error', { sessionId, error: error.message });
            }
        }, 3000);

        this.activeSessions.set(sessionId, { intervalId, uasg, numero, vault });
    }

    /**
     * Para o monitoramento
     */
    stop(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            clearInterval(session.intervalId);
            this.activeSessions.delete(sessionId);
            console.log(`[LOCAL_RUNNER] Monitoramento parado para ${sessionId}`);
        }
    }

    updateConfig(sessionId, config) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.vault = { ...session.vault, ...config };
            console.log(`[LOCAL_RUNNER] Configuração atualizada para ${sessionId}`);
        }
    }

    async executeRealBid(idCompra, itemId, value, agent) {
        console.log(`[LOCAL_RUNNER] ENVIANDO LANCE REAL: Item ${itemId} -> R$ ${value}`);
        
        try {
            // 1. LOGIN (mTLS) para obter JWT se necessário
            // No Serpro, geralmente precisamos de um token. 
            // Para simplificar no Desktop, podemos tentar o login a cada execução ou manter um cache.
            const token = await this.getLocalLoginToken(agent);

            const bidUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api/v1/lances';
            await axios.post(bidUrl, {
                sequencialItem: parseInt(itemId),
                valorLance: value
            }, {
                httpsAgent: agent,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 Polaryon-Desktop/1.0'
                }
            });

            return { success: true };
        } catch (error) {
            const msg = error.response?.data?.message || error.message;
            throw new Error(msg);
        }
    }

    async getLocalLoginToken(agent) {
        // Cache simples no processo do Electron
        if (this.lastToken && this.lastTokenExpiry > Date.now()) {
            return this.lastToken;
        }

        const loginUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api/v1/login-certificado';
        const response = await axios.post(loginUrl, {}, {
            httpsAgent: agent,
            headers: { 'User-Agent': 'Mozilla/5.0 Polaryon-Desktop/1.0' }
        });

        if (response.data && response.data.token) {
            this.lastToken = response.data.token;
            this.lastTokenExpiry = Date.now() + 3600000; // 1h
            return this.lastToken;
        }
        throw new Error("Falha na autenticação mTLS local.");
    }

    evaluateStrategy(currentItem, config) {
        const { mode, minPrice, decrementValue, decrementType } = config;
        
        if (currentItem.ganhador === 'Você') return { action: 'hold' };
        if (currentItem.valorAtual <= minPrice) return { action: 'stop' };

        let nextBid = 0;
        if (decrementType === 'fixed') {
            nextBid = currentItem.valorAtual - decrementValue;
        } else {
            nextBid = currentItem.valorAtual * (1 - decrementValue / 100);
        }

        nextBid = Math.round(nextBid * 100) / 100;
        if (nextBid < minPrice) nextBid = minPrice;

        switch (mode) {
            case 'follower': 
                return { action: 'bid', value: nextBid, reason: 'Seguindo concorrente (Local).' };
            case 'cover':
                return { action: 'bid', value: nextBid, reason: 'Cobertura ativa (Local).' };
            case 'sniper':
                const timeLeft = currentItem.tempoRestante;
                if (timeLeft > 0 && timeLeft <= 5) {
                    return { action: 'bid', value: nextBid, reason: 'Sniper Local disparado.' };
                }
                return { action: 'hold' };
            default:
                return { action: 'hold' };
        }
    }
}

module.exports = BiddingRunner;
