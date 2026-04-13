import axios from 'axios';
import { prisma } from '../lib/prisma';
import { getIO } from '../socket';

export interface PncpOpportunity {
    id: string;
    description: string;
    orgao: string;
    cnpjOrgao: string;
    ano: string;
    sequencial: string;
    valorEstimado: number;
    dataPublicacao: string;
    link: string;
}

export class PncpRadarService {
    private static instance: PncpRadarService;
    private intervalId: NodeJS.Timeout | null = null;
    private seenIds: Set<string> = new Set();
    private isRunning = false;

    private constructor() {}

    static getInstance(): PncpRadarService {
        if (!PncpRadarService.instance) {
            PncpRadarService.instance = new PncpRadarService();
        }
        return PncpRadarService.instance;
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('📡 [RADAR] Polaryon Radar PNCP iniciado.');
        
        // Polling every 5 minutes
        this.intervalId = setInterval(() => this.scan(), 5 * 60 * 1000);
        
        // Initial scan
        this.scan();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('📡 [RADAR] Polaryon Radar PNCP desligado.');
    }

    private async scan() {
        try {
            console.log('📡 [RADAR] Varrendo PNCP por novas oportunidades...');
            
            // 1. Get Keywords from Main Company Profile
            const profile = await prisma.mainCompanyProfile.findFirst({ where: { isDefault: true } });
            let keywords: string[] = [];
            
            if (profile && profile.cnaes) {
                const cnaes = profile.cnaes as any[];
                keywords = cnaes.map(c => c.descricao || '').filter(d => d.length > 5);
            }

            // Fallback keywords if profile is empty
            if (keywords.length === 0) {
                keywords = ['Arroz', 'Informática', 'Cadeira', 'Limpeza', 'Manutenção'];
            }

            // 2. Query PNCP for today's "Dispensas Eletrônicas"
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const PNCP_SEARCH_URL = `https://pncp.gov.br/api/search/?pagina=1&tam_pagina=100&data_publicacao_inicial=${today}&status=recebendo_proposta&tipos_documento=edital`;

            const response = await axios.get(PNCP_SEARCH_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0 Polaryon-Radar/1.0' },
                timeout: 10000
            });

            const items = response.data.items || [];
            const matches: PncpOpportunity[] = [];

            for (const item of items) {
                const desc = (item.description || '').toLowerCase();
                const opportunityId = `${item.orgao_cnpj}/${item.ano}/${item.numero_sequencial}`;

                if (this.seenIds.has(opportunityId)) continue;
                
                // Match with keywords
                const isMatch = keywords.some(kw => desc.includes(kw.toLowerCase()));
                
                if (isMatch) {
                    const opp: PncpOpportunity = {
                        id: opportunityId,
                        description: item.description,
                        orgao: item.orgao_nome,
                        cnpjOrgao: item.orgao_cnpj,
                        ano: item.ano,
                        sequencial: item.numero_sequencial,
                        valorEstimado: item.valor_global || 0,
                        dataPublicacao: item.data_publicacao_pncp,
                        link: `https://pncp.gov.br/app/editais/${item.orgao_cnpj}/${item.ano}/${item.numero_sequencial}`
                    };
                    matches.push(opp);
                    this.seenIds.add(opportunityId);
                }
            }

            // 3. Notify Online Users via Socket
            if (matches.length > 0) {
                console.log(`🎯 [RADAR] Encontradas ${matches.length} novas oportunidades!`);
                const io = getIO();
                io.emit('bidding_alert', {
                    type: 'PNCP_RADAR_MATCH',
                    message: `O Radar encontrou ${matches.length} novas Dispensas Eletrônicas para você!`,
                    critical: true,
                    data: { opportunities: matches }
                });
            }

        } catch (error: any) {
            console.error('❌ [RADAR] Erro ao varrer PNCP:', error.message);
        }
    }
}
