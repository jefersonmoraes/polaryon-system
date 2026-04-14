const axios = require('axios');
const https = require('https');
const { ipcMain } = require('electron');

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

        let chatCounter = 0;
        let serverOffset = 0;

        const runPolling = async () => {
            if (!this.activeSessions.has(sessionId)) return;

                // 1. Busca Itens (Modo Público)
                const publicApiUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${idCompra}/itens`;
                const response = await axios.get(publicApiUrl, { 
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0 Polaryon-Desktop/1.0' }
                });

                if (response.data && Array.isArray(response.data)) {
                    let hasItemsInDispute = false;

                    // SYNC CLOCK (Header Date)
                    if (response.headers.date) {
                        const serverTime = new Date(response.headers.date).getTime();
                        serverOffset = serverTime - Date.now();
                    }

                    // 2. BUSCAR RANKING REAL (Se estiver logado no modo real)
                    const simulationMode = vault.simulationMode ?? true;
                    const itemsConfig = vault.itemsConfig || {};
                    const executedActions = [];

                    // 3. MONITORAMENTO DE CHAT (A cada 5 ciclos = ~15s)
                    chatCounter++;
                    if (chatCounter >= 5) {
                        chatCounter = 0;
                        try {
                            const token = await this.getLocalLoginToken(agent);
                            const chatUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-mensagens/api/v1/mensagens/compra/${idCompra}`;
                            const chatRes = await axios.get(chatUrl, {
                                httpsAgent: agent,
                                headers: { 
                                    'Authorization': `Bearer ${token}`,
                                    'User-Agent': 'Mozilla/5.0 Polaryon-Desktop/1.0' 
                                }
                            });
                            if (chatRes.data && Array.isArray(chatRes.data)) {
                                this.webContents.send('bidding-chat', { messages: chatRes.data });
                                
                                // Notificação de nova mensagem oficial
                                const lastMsg = chatRes.data[0];
                                const isOfficial = lastMsg?.tipo === 'OFICIAL' || lastMsg?.enviadoPeloPregoeiro;
                                if (isOfficial && lastMsg.id !== this.lastChatId) {
                                    this.lastChatId = lastMsg.id;
                                    ipcMain.emit('show-notification', null, { 
                                        title: 'Mensagem do Pregoeiro', 
                                        body: lastMsg.texto.substring(0, 100) + '...' 
                                    });
                                }
                            }
                        } catch (e) {
                            // Silently fail chat polling if not authenticated
                        }
                    }

                    const items = [];
                    for (const item of response.data) {
                        const itemId = String(item.numeroItem || item.sequencial);
                        
                        // Detectar se há itens em disputa para o Modo Turbo
                        if (item.fase === 'DISPUTA' || item.fase === 'IMINENTE') {
                            hasItemsInDispute = true;
                        }

                        let myPosition = item.melhorLance === item.valorLanceProposta ? 1 : 0;

                        // Se não estiver em 1º lugar e tiver certificado, tenta buscar ranking exato
                        if (myPosition === 0 && !simulationMode) {
                            try {
                                const token = await this.getLocalLoginToken(agent);
                                const rankingUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api/v1/lances/compra/${idCompra}/item/${itemId}`;
                                const rankingRes = await axios.get(rankingUrl, {
                                    httpsAgent: agent,
                                    headers: { 
                                        'Authorization': `Bearer ${token}`,
                                        'User-Agent': 'Mozilla/5.0 Polaryon-Desktop/1.0' 
                                    }
                                });
                                if (rankingRes.data && Array.isArray(rankingRes.data)) {
                                    const myBid = rankingRes.data.find(l => l.eMeuLance === true);
                                    if (myBid) myPosition = (myBid.index || 0) + 1;
                                }
                            } catch (e) { /* ignore ranking error */ }
                        }

                        const currentItem = {
                            itemId,
                            valorAtual: item.melhorLance || item.valorEstimado || 0,
                            ganhador: item.fase === 'DISPUTA' ? 'Em Disputa' : (item.melhorLance ? 'Concorrente' : 'Aguardando'),
                            status: item.situacao || item.fase || 'Aberto',
                            descricao: item.descricao,
                            tempoRestante: item.segundosParaEncerramento || -1,
                            position: myPosition
                        };

                        if (item.melhorLance && item.melhorLance === item.meuUltimoLance) {
                            currentItem.ganhador = 'Você';
                        }

                        // DETECÇÃO DE MUDANÇAS PARA NOTIFICAÇÕES
                        const prevItem = (this.prevItemsState || {})[itemId];
                        if (prevItem) {
                            // 1. Perda de 1º lugar
                            if (prevItem.ganhador === 'Você' && currentItem.ganhador !== 'Você') {
                                ipcMain.emit('show-notification', null, { 
                                    title: '🚨 Lance Superado!', 
                                    body: `Você perdeu o 1º lugar no Item ${itemId}.` 
                                });
                            }
                            // 2. Entrada em Iminente
                            if (!prevItem.status.includes('IMINENTE') && currentItem.status.includes('IMINENTE')) {
                                ipcMain.emit('show-notification', null, { 
                                    title: '🎯 Fase Iminente!', 
                                    body: `O Item ${itemId} entrou em fase iminente.` 
                                });
                            }
                        }

                        items.push(currentItem);

                        const config = itemsConfig[itemId] || { mode: 'follower', minPrice: 0.10, decrementValue: 0.01, decrementType: 'fixed' };
                        
                        // SEGURANÇA MÁXIMA: Recusar lance se já estivermos no limite
                        if (currentItem.valorAtual <= config.minPrice) {
                            continue; 
                        }

                        const decision = this.evaluateStrategy(currentItem, config);
                        
                        if (decision.action === 'bid') {
                            // Garantir que o valor decidido nunca seja inferior ao mínimo
                            const finalBidValue = Math.max(decision.value, config.minPrice);
                            
                            const actionLog = { 
                                itemId: itemId, 
                                value: finalBidValue, 
                                reason: decision.reason, 
                                type: simulationMode ? 'SIMULATED' : 'REAL', 
                                status: 'pending', 
                                timestamp: new Date(Date.now() + serverOffset).toISOString() 
                            };
                            
                            if (simulationMode) {
                                actionLog.status = 'success';
                            } else {
                                try {
                                    await this.executeRealBid(idCompra, itemId, finalBidValue, agent);
                                    actionLog.status = 'success';
                                } catch (e) {
                                    actionLog.status = 'error';
                                    actionLog.error = e.message;
                                }
                            }
                            executedActions.push(actionLog);
                        }
                    }

                    // Guardar estado atual para próxima comparação
                    this.prevItemsState = items.reduce((acc, item) => ({ ...acc, [item.itemId]: item }), {});

                    // Enviar atualização para o Frontend
                    this.webContents.send('bidding-update', {
                        sessionId,
                        items,
                        actions: executedActions,
                        timestamp: new Date(Date.now() + serverOffset).toISOString(),
                        source: 'LOCAL',
                        serverOffset,
                        turbo: hasItemsInDispute
                    });

                    // Agendar próxima execução
                    const nextInterval = hasItemsInDispute ? 1000 : 3000;
                    this.activeSessions.get(sessionId).timeoutId = setTimeout(runPolling, nextInterval);
                }
            } catch (error) {
                console.error(`[LOCAL_RUNNER] Erro no polling: ${error.message}`);
                this.webContents.send('bidding-error', { sessionId, error: error.message });
                // Tenta novamente em 5s se houver erro de rede
                this.activeSessions.get(sessionId).timeoutId = setTimeout(runPolling, 5000);
            }
        };

        const timeoutId = setTimeout(runPolling, 1000);
        this.activeSessions.set(sessionId, { timeoutId, uasg, numero, vault });
    }

    /**
     * Para o monitoramento
     */
    stop(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            if (session.timeoutId) clearTimeout(session.timeoutId);
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
        
        // Se eu já sou o ganhador, não faço nada
        if (currentItem.ganhador === 'Você') {
            return { action: 'hold', reason: 'Já ganhando. Aguardando.' };
        }

        // Se o valor atual já está abaixo do meu mínimo, paro
        if (currentItem.valorAtual <= minPrice) {
            return { action: 'stop', reason: 'Preço mínimo atingido.' };
        }

        let nextBid = 0;
        if (decrementType === 'fixed') {
            nextBid = currentItem.valorAtual - decrementValue;
        } else {
            nextBid = currentItem.valorAtual * (1 - decrementValue / 100);
        }

        nextBid = Math.round(nextBid * 100) / 100;
        if (nextBid < minPrice) nextBid = minPrice;

        const isImminente = currentItem.status?.toUpperCase().includes('IMINENTE') || 
                           (currentItem.tempoRestante > 0 && currentItem.tempoRestante < 60);

        switch (mode) {
            case 'follower': 
                const followerReason = isImminente ? 'Seguindo concorrente (FASE IMINENTE - Local).' : 'Seguindo concorrente (Local).';
                return { action: 'bid', value: nextBid, reason: followerReason };

            case 'cover':
                return { action: 'bid', value: nextBid, reason: 'Cobertura ativa (Local).' };

            case 'sniper':
                const timeLeft = currentItem.tempoRestante;
                const secondsToSnipe = 3; 

                if (timeLeft > 0 && timeLeft <= secondsToSnipe) {
                    return { action: 'bid', value: nextBid, reason: `Sniper Local disparado (T-${timeLeft}s).` };
                }
                
                if (isImminente && (timeLeft === -1 || timeLeft > secondsToSnipe)) {
                    return { action: 'hold', reason: 'Sniper em prontidão (Fase Iminente Local).' };
                }
                
                return { action: 'hold', reason: timeLeft > 0 ? `Sniper aguardando (T-${timeLeft}s)...` : 'Sniper aguardando (Local)...' };

            case 'shadow':
                // Tenta se manter em 2º lugar (na cola do 1º)
                if (currentItem.position === 2) {
                    return { action: 'hold', reason: 'Modo Sombra: Mantendo 2º lugar (Local).' };
                }
                return { action: 'bid', value: nextBid, reason: 'Modo Sombra: Buscando 2º lugar (Local).' };

            default:
                return { action: 'hold', reason: 'Sem estratégia definida.' };
        }
    }
}

module.exports = BiddingRunner;
