import axios from 'axios';
import { getSocketServer } from '../socket';
import { prisma } from '../lib/prisma';

import { BiddingStrategyEngine, ItemStrategyConfig } from './bidding-strategy-engine';
import { BiddingAuthService } from './BiddingAuthService';

// In Etapa 4 we will use mutual TLS with the A1 certificate here
const apiClient = axios.create({
    baseURL: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api', 
    timeout: 5000,
    headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

interface PollingJob {
    sessionId: string;
    intervalId: NodeJS.Timeout;
}

export class BiddingListener {
    private static activeJobs: Map<string, PollingJob> = new Map();

    /**
     * Inicia o radar de monitoramento para uma sessão específica
     */
    static async startMonitoring(sessionId: string, uasg: string, numeroPregao: string) {
        if (this.activeJobs.has(sessionId)) {
            console.log(`[PBE] Listener já ativo para sessão ${sessionId}`);
            return;
        }

        console.log(`[PBE] Iniciando Radar (Listener) para UASG: ${uasg} / Pregão: ${numeroPregao}`);
        
        // Simulação do loop de Polling
        const io = getSocketServer();
        
        // Clock Synchronization state
        let serverOffset = 0;
        let chatCounter = 0;

        const intervalId = setInterval(async () => {
            try {
                // 1. Fetch current session and credentials
                const session = await prisma.biddingSession.findUnique({ 
                    where: { id: sessionId },
                    include: { credential: true }
                });
                
                const itemsConfig = (session?.itemsConfig as any) || {};
                const simulationMode = itemsConfig.__global__?.simulationMode ?? itemsConfig.simulationMode ?? true;

                // 2. BUSCA DADOS REAIS NO SERPRO
                const modalidade = '06'; 
                const paddedNum = String(numeroPregao).padStart(5, '0');
                const ano = session?.anoPregao || '2026';
                const idCompra = `${uasg}${modalidade}${paddedNum}${ano}`;
                
                const publicApiUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${idCompra}/itens`;
                
                let realItems: any[] = [];
                try {
                    const response = await axios.get(publicApiUrl, { 
                        timeout: 5000,
                        headers: { 'User-Agent': 'Mozilla/5.0 Polaryon/1.0' }
                    });

                    // CLOCK SYNC: Extract server time from header
                    if (response.headers.date) {
                        const serverTime = new Date(response.headers.date).getTime();
                        serverOffset = serverTime - Date.now();
                    }
                    
                    if (response.status === 204) {
                         if (io) io.to(`bidding_room_${sessionId}`).emit('bidding_alert', { type: 'CAPTCHA_BLOCK', message: 'Bloqueio de hCaptcha detectado.', critical: true });
                    } else if (response.data && Array.isArray(response.data)) {
                        realItems = response.data.map((item: any) => ({
                            itemId: String(item.numeroItem || item.sequencial),
                            valorAtual: item.melhorLance || item.valorEstimado || 0,
                            ganhador: item.fase === 'DISPUTA' ? 'Em Disputa' : (item.melhorLance ? 'Concorrente' : 'Aguardando'),
                            status: item.situacao || item.fase || 'Aberto',
                            descricao: item.descricao,
                            tempoRestante: item.segundosParaEncerramento || -1 // Serpro as vezes fornece isso
                        }));
                    }
                } catch (apiErr: any) {
                    console.error(`[PBE] Polling API Error: ${apiErr.message}`);
                    return; 
                }

                // 3. MONITORAMENTO DE CHAT (A cada 3 ciclos = aprox 10s)
                chatCounter++;
                if (chatCounter >= 3) {
                    chatCounter = 0;
                    try {
                        const messages = await this.fetchChatMessages(session?.credentialId, idCompra);
                        if (messages && messages.length > 0 && io) {
                            io.to(`bidding_room_${sessionId}`).emit('biddingChat', { messages });
                            
                            // Ações automáticas baseadas em palavras-chave
                            const lastMsg = messages[messages.length - 1];
                            const content = lastMsg.texto?.toUpperCase() || '';
                            if (content.includes('SUSPENSO') || content.includes('CANCELADO') || content.includes('ADIADO')) {
                                console.warn(`[PBE] ATENÇÃO: Palavra-chave de parada detectada no chat: ${content}`);
                                if (io) io.to(`bidding_room_${sessionId}`).emit('bidding_alert', { 
                                    type: 'CHAT_SUSPENSION', 
                                    message: `Chat detectou: "${content}". Operação sugerida: PAUSA.`, 
                                    critical: false 
                                });
                            }
                        }
                    } catch (chatErr) {
                        console.error(`[PBE] Falha ao buscar chat: ${chatErr.message}`);
                    }
                }

                if (realItems.length === 0) return;

                // 4. Evaluate Strategies
                const executedActions: any[] = [];
                const nowWithOffset = Date.now() + serverOffset;

                for (const item of realItems) {
                    const config: ItemStrategyConfig = itemsConfig[item.itemId] || { mode: 'follower', minPrice: 0.10, decrementValue: 0.01, decrementType: 'fixed' };

                    const decision = BiddingStrategyEngine.evaluate(item, config, nowWithOffset);
                    
                    if (decision.action === 'bid') {
                        const actionLog = { itemId: item.itemId, value: decision.value, reason: decision.reason, type: simulationMode ? 'SIMULATED' : 'REAL', status: 'pending', timestamp: new Date(nowWithOffset).toISOString() };
                        
                        if (simulationMode) {
                            actionLog.status = 'success';
                        } else if (session?.credentialId) {
                            try {
                                await this.executeRealBid(session.id, session.credentialId, item.itemId, decision.value);
                                actionLog.status = 'success';
                            } catch (e: any) {
                                actionLog.status = 'error';
                                (actionLog as any).error = e.message;
                            }
                        } else {
                            actionLog.status = 'error';
                            (actionLog as any).error = 'Credencial não configurada.';
                        }
                        executedActions.push(actionLog);
                    }
                }
                
                if (io) {
                    io.to(`bidding_room_${sessionId}`).emit('biddingUpdate', {
                        timestamp: new Date(nowWithOffset).toISOString(),
                        uasg,
                        numeroPregao,
                        items: realItems,
                        actions: executedActions,
                        isAuthenticated: !!session?.credentialId,
                        serverOffset
                    });
                }
                
                if (executedActions.length > 0) {
                    const existingLogs = (session?.logs as any[]) || [];
                    await prisma.biddingSession.update({
                        where: { id: sessionId },
                        data: { logs: [...existingLogs, ...executedActions].slice(-100) }
                    });
                }
                
            } catch (error: any) {
                console.error(`[PBE] Polling Error ${sessionId}: ${error.message}`);
            }
        }, 3000); 

        this.activeJobs.set(sessionId, { sessionId, intervalId });
        await prisma.biddingSession.update({
            where: { id: sessionId },
            data: { sessionStatus: 'active' }
        });
    }

    /**
     * Executa um lance real no portal Compras.gov.br
     */
    private static async executeRealBid(sessionId: string, credentialId: string, itemId: string, value: number) {
        try {
            const token = await BiddingAuthService.login(credentialId);
            const agent = await BiddingAuthService.getHttpsAgent(credentialId);
            
            const bidUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api/v1/lances';
            
            const response = await axios.post(bidUrl, {
                sequencialItem: parseInt(itemId),
                valorLance: value
            }, {
                httpsAgent: agent,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Polaryon/1.0'
                }
            });

            return response.data;
        } catch (error: any) {
            if (error.response?.status === 401) {
                BiddingAuthService.invalidateToken(credentialId);
            }
            const msg = error.response?.data?.message || error.message;
            throw new Error(`Erro ao enviar lance real: ${msg}`);
        }
    }

    /**
     * Busca mensagens do chat (Exige mTLS em modo real, ou modo público se disponível)
     */
    private static async fetchChatMessages(credentialId: string | undefined, idCompra: string) {
        try {
            // Se tiver credencial, tenta modo autenticado (mais estável)
            if (credentialId) {
                const token = await BiddingAuthService.login(credentialId);
                const agent = await BiddingAuthService.getHttpsAgent(credentialId);
                const chatUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-mensagens/api/v1/mensagens/compra/${idCompra}`;
                
                const response = await axios.get(chatUrl, {
                    httpsAgent: agent,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': 'Mozilla/5.0 Polaryon/1.0'
                    }
                });
                return response.data;
            }
            
            // Fallback para modo público se disponível (Geralmente não é para chat em tempo real)
            return [];
        } catch (e) {
            console.error(`[PBE] Erro ao buscar mensagens: ${e.message}`);
            return [];
        }
    }

    /**
     * Desliga o radar
     */
    static async stopMonitoring(sessionId: string) {
        const job = this.activeJobs.get(sessionId);
        if (job) {
            clearInterval(job.intervalId);
            this.activeJobs.delete(sessionId);
            console.log(`[PBE] Radar desligado para sessão ${sessionId}`);

            await prisma.biddingSession.update({
                where: { id: sessionId },
                data: { sessionStatus: 'paused' }
            });
        }
    }

    static getActiveJobsCount() {
        return this.activeJobs.size;
    }
}
