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
        
        const intervalId = setInterval(async () => {
            try {
                // 1. Fetch current session to get strategy configs
                const session = await prisma.biddingSession.findUnique({ 
                    where: { id: sessionId },
                    include: { credential: true }
                });
                
                const itemsConfig = (session?.itemsConfig as any) || {};
                const simulationMode = itemsConfig.__global__?.simulationMode ?? itemsConfig.simulationMode ?? true;

                // 2. BUSCA DADOS REAIS NO SERPRO (MODO PÚBLICO / TRANSPARÊNCIA)
                const modalidade = '06'; // Dispensa Eletrônica
                const paddedNum = String(numeroPregao).padStart(5, '0');
                const ano = session?.anoPregao || '2026';
                const idCompra = `${uasg}${modalidade}${paddedNum}${ano}`;
                
                const publicApiUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1/compras/${idCompra}/itens`;
                
                let realItems: any[] = [];
                try {
                    const response = await axios.get(publicApiUrl, { 
                        timeout: 5000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'Accept': 'application/json, text/plain, */*'
                        }
                    });
                    
                    if (response.status === 204) {
                         console.warn(`[PBE] Bloqueio hCaptcha Detectado para ${idCompra}`);
                         if (io) {
                             io.to(`bidding_room_${sessionId}`).emit('bidding_alert', {
                                 type: 'CAPTCHA_BLOCK',
                                 message: 'Bloqueio de hCaptcha detectado pelo portal Gov.br.',
                                 critical: true
                             });
                         }
                    } else if (response.data && Array.isArray(response.data)) {
                        realItems = response.data.map((item: any) => ({
                            itemId: String(item.numeroItem || item.sequencial),
                            valorAtual: item.melhorLance || item.valorEstimado || 0,
                            ganhador: item.fase === 'DISPUTA' ? 'Em Disputa' : (item.melhorLance ? 'Concorrente' : 'Aguardando'),
                            status: item.situacao || item.fase || 'Aberto',
                            descricao: item.descricao
                        }));
                    }
                } catch (apiErr: any) {
                    console.error(`[PBE] API Error: ${apiErr.message}`);
                    return; 
                }

                if (realItems.length === 0) return;

                // 3. Evaluate Strategies and Handle Execution
                const executedActions: any[] = [];

                for (const item of realItems) {
                    const config: ItemStrategyConfig = itemsConfig[item.itemId] || {
                        mode: 'follower',
                        minPrice: 0.10,
                        decrementValue: 0.01,
                        decrementType: 'fixed'
                    };

                    const decision = BiddingStrategyEngine.evaluate(item, config);
                    
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
                            console.log(`[PBE] SIMULAÇÃO: Item ${item.itemId} -> R$ ${decision.value}`);
                        } else if (session?.credentialId) {
                            // REAL BIDDING DISPATCH
                            try {
                                const result = await this.executeRealBid(session.id, session.credentialId, item.itemId, decision.value);
                                actionLog.status = 'success';
                                console.log(`[PBE] LANCE REAL SUCESSO: Item ${item.itemId} -> R$ ${decision.value}`);
                            } catch (e: any) {
                                actionLog.status = 'error';
                                (actionLog as any).error = e.message;
                                console.error(`[PBE] LANCE REAL FALHA: ${e.message}`);
                            }
                        } else {
                            actionLog.status = 'error';
                            (actionLog as any).error = 'Credencial (Certificado A1) não configurado.';
                        }
                        
                        executedActions.push(actionLog);
                    }
                }
                
                // Emite os dados e ações para o front-end
                if (io) {
                    io.to(`bidding_room_${sessionId}`).emit('biddingUpdate', {
                        timestamp: new Date().toISOString(),
                        uasg,
                        numeroPregao,
                        items: realItems,
                        actions: executedActions,
                        isAuthenticated: !!session?.credentialId
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
