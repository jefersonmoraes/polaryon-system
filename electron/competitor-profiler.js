/**
 * CompetitorProfiler — Motor de Inteligência Competitiva
 * 
 * Rastreia histórico de lances por concorrente, identifica padrões,
 * e alimenta o PredictiveEngine com dados para estimar próximos lances.
 * 
 * v3.8.326 — Competitor Profiling + Predictive Bidding
 */

let PrismaClient = null;
try {
    const path = require('path');
    ({ PrismaClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client')));
} catch (_e) {
    // No packaged Electron (asar), @prisma/client is unavailable — memory-only mode
}

class CompetitorProfiler {
    constructor() {
        this.prisma = PrismaClient ? new PrismaClient({ log: ['error'] }) : null;
        
        // Cache em memória para acesso rápido (persiste via Prisma)
        this.bidHistory = new Map();       // key: `${purchaseId}_${itemId}` → BidRecord[]
        this.profiles = new Map();         // key: participantId → CompetitorProfile (in-memory)
        this.rounds = new Map();           // key: `${purchaseId}_${itemId}` → round data
        this.rateLimitWindows = [];        // Track rate limit patterns
        
        // Configurações
        this.HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 24h de histórico em memória
        this.MIN_BIDS_FOR_PROFILE = 3;               // Mínimo de lances para criar perfil
        this.FLUSH_INTERVAL_MS = 30000;              // Flush para DB a cada 30s
        
        // Timer de flush periódico
        this._flushTimer = setInterval(() => this._flushToDb(), this.FLUSH_INTERVAL_MS);
    }

    /**
     * Registra um lance observado (nossa ou concorrente)
     * Chamado pelo RoomRunner quando ranking data chega
     */
    recordBid(purchaseId, itemId, participantId, value, position, isOurBid = false, source = 'ranking') {
        const key = `${purchaseId}_${itemId}`;
        
        if (!this.bidHistory.has(key)) {
            this.bidHistory.set(key, []);
        }
        
        const history = this.bidHistory.get(key);
        const now = Date.now();
        
        // Dedup: não registra o mesmo lance novamente
        const isDuplicate = history.some(b => 
            b.participantId === participantId && 
            Math.abs(b.value - value) < 0.001 &&
            (now - b.observedAt) < 5000 // 5s dedup window
        );
        if (isDuplicate) return false;
        
        // Registra o lance
        const record = {
            purchaseId, itemId, participantId, value, position,
            isOurBid, source, observedAt: now
        };
        history.push(record);
        
        // Limpa histórico antigo (>24h)
        const cutoff = now - this.HISTORY_TTL_MS;
        while (history.length > 0 && history[0].observedAt < cutoff) {
            history.shift();
        }
        
        // Atualiza perfil do concorrente (se não for nosso lance)
        if (!isOurBid && participantId) {
            this._updateProfile(purchaseId, itemId, participantId, value, position, now, history);
        }
        
        return true;
    }

    /**
     * Registra uma rodada de disputa completa
     */
    recordRound(purchaseId, itemId, roundData) {
        const key = `${purchaseId}_${itemId}`;
        if (!this.rounds.has(key)) {
            this.rounds.set(key, { currentRound: 0, data: [] });
        }
        const roundInfo = this.rounds.get(key);
        roundInfo.currentRound++;
        
        const round = {
            purchaseId, itemId,
            roundNumber: roundInfo.currentRound,
            leaderId: roundData.leaderId,
            leaderValue: roundData.leaderValue,
            secondValue: roundData.secondValue,
            totalBids: roundData.totalBids || 0,
            priceDroppedBy: roundData.priceDroppedBy || 0,
            wasWarRound: roundData.wasWar || false,
            observedAt: Date.now()
        };
        roundInfo.data.push(round);
        
        return round;
    }

    /**
     * Registra resultado final de uma disputa
     */
    async recordAuctionResult(result) {
        if (!this.prisma) return;
        try {
            await this.prisma.auctionResult.upsert({
                where: {
                    purchaseId_itemId: {
                        purchaseId: result.purchaseId,
                        itemId: result.itemId
                    }
                },
                create: {
                    purchaseId: result.purchaseId,
                    itemId: result.itemId,
                    itemDescription: result.itemDescription,
                    winnerId: result.winnerId,
                    winnerName: result.winnerName,
                    finalPrice: result.finalPrice,
                    ourBestBid: result.ourBestBid,
                    ourMinPrice: result.ourMinPrice,
                    startingPrice: result.startingPrice,
                    totalRounds: result.totalRounds || 0,
                    totalCompetitors: result.totalCompetitors || 0,
                    warCycles: result.warCycles || 0,
                    durationMinutes: result.durationMinutes,
                    result: result.result,
                    strategy: result.strategy
                },
                update: {
                    winnerId: result.winnerId,
                    winnerName: result.winnerName,
                    finalPrice: result.finalPrice,
                    result: result.result,
                    totalRounds: result.totalRounds || 0,
                    warCycles: result.warCycles || 0
                }
            });
        } catch (err) {
            console.error('[COMPETITOR PROFILER] Erro ao salvar AuctionResult:', err.message);
        }
    }

    /**
     * Atualiza o perfil de um concorrente baseado em novos dados
     */
    _updateProfile(purchaseId, itemId, participantId, value, position, now, history) {
        let profile = this.profiles.get(participantId);
        
        if (!profile) {
            profile = {
                participantId,
                totalBids: 0,
                bidValues: [],          // Últimos 50 valores para cálculos
                bidTimestamps: [],      // Últimos 50 timestamps
                bidReductions: [],      // Reduções entre lances consecutivos
                bidHours: new Array(24).fill(0), // Distribuição por hora
                aggressiveScore: 0,
                firstSeenAt: now,
                lastBidAt: now,
                timesWon: 0,
                timesLostToUs: 0,
                timesWeLostToThem: 0
            };
            this.profiles.set(participantId, profile);
        }
        
        // Atualiza contadores
        profile.totalBids++;
        profile.lastBidAt = now;
        
        // Armazena valor e timestamp (últimos 50)
        profile.bidValues.push(value);
        if (profile.bidValues.length > 50) profile.bidValues.shift();
        
        profile.bidTimestamps.push(now);
        if (profile.bidTimestamps.length > 50) profile.bidTimestamps.shift();
        
        // Calcula redução em relação ao lance anterior deste concorrente neste item
        const sameItemBids = history.filter(b => b.participantId === participantId && !b.isOurBid);
        if (sameItemBids.length >= 2) {
            const prev = sameItemBids[sameItemBids.length - 2];
            const curr = sameItemBids[sameItemBids.length - 1];
            const reduction = prev.value - curr.value;
            if (reduction > 0) {
                profile.bidReductions.push(reduction);
                if (profile.bidReductions.length > 50) profile.bidReductions.shift();
            }
        }
        
        // Distribuição por hora
        const hour = new Date(now).getHours();
        profile.bidHours[hour]++;
        
        // Calcula métricas agregadas
        this._computeMetrics(profile);
    }

    /**
     * Calcula métricas agregadas do perfil
     */
    _computeMetrics(profile) {
        const reductions = profile.bidReductions;
        if (reductions.length > 0) {
            // Média
            profile.avgReductionPerBid = reductions.reduce((a, b) => a + b, 0) / reductions.length;
            
            // Mediana (mais resistente a outliers)
            const sorted = [...reductions].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            profile.medianReductionPerBid = sorted.length % 2 !== 0
                ? sorted[mid]
                : (sorted[mid - 1] + sorted[mid]) / 2;
            
            // Máxima redução
            profile.maxSingleReduction = Math.max(...reductions);
        }
        
        // Tempo médio entre lances
        const timestamps = profile.bidTimestamps;
        if (timestamps.length >= 2) {
            const gaps = [];
            for (let i = 1; i < timestamps.length; i++) {
                gaps.push(timestamps[i] - timestamps[i - 1]);
            }
            profile.avgTimeBetweenBids = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        }
        
        // Lances nos últimos 10min
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        profile.bidCountLast10min = profile.bidTimestamps.filter(t => t > tenMinAgo).length;
        
        // Score de agressividade (0-100)
        // Fatores: redução média alta, tempo entre lances baixo, muitos lances recentes
        const reductionScore = Math.min(50, (profile.avgReductionPerBid / 100) * 50);
        const frequencyScore = Math.min(30, profile.avgTimeBetweenBids > 0 
            ? (60000 / profile.avgTimeBetweenBids) * 10  // Mais lances por min = mais pontos
            : 0);
        const recencyScore = Math.min(20, profile.bidCountLast10min * 4);
        
        profile.aggressiveScore = Math.min(100, reductionScore + frequencyScore + recencyScore);
    }

    /**
     * Retorna o perfil de um concorrente
     */
    getProfile(participantId) {
        const p = this.profiles.get(participantId);
        if (!p) return null;
        
        return {
            participantId: p.participantId,
            totalBids: p.totalBids,
            avgReductionPerBid: Math.round(p.avgReductionPerBid * 100) / 100,
            medianReductionPerBid: Math.round(p.medianReductionPerBid * 100) / 100,
            avgTimeBetweenBids: Math.round(p.avgTimeBetweenBids),
            bidCountLast10min: p.bidCountLast10min,
            maxSingleReduction: Math.round(p.maxSingleReduction * 100) / 100,
            aggressiveScore: Math.round(p.aggressiveScore),
            lastBidAt: p.lastBidAt,
            preferredHours: this._getPreferredHours(p.bidHours)
        };
    }

    /**
     * Retorna todos os concorrentes ativos (que bidaram nos últimos 30min)
     */
    getActiveCompetitors(purchaseId, itemId) {
        const key = `${purchaseId}_${itemId}`;
        const history = this.bidHistory.get(key) || [];
        const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
        
        const activeIds = new Set();
        history
            .filter(b => !b.isOurBid && b.observedAt > thirtyMinAgo)
            .forEach(b => activeIds.add(b.participantId));
        
        return [...activeIds].map(id => this.getProfile(id)).filter(Boolean);
    }

    /**
     * Retorna histórico de lances de um item específico
     */
    getItemHistory(purchaseId, itemId) {
        const key = `${purchaseId}_${itemId}`;
        return this.bidHistory.get(key) || [];
    }

    /**
     * Retorna o ranking atual (último lance por participante) de um item
     */
    getCurrentRanking(purchaseId, itemId) {
        const history = this.getItemHistory(purchaseId, itemId);
        const lastBids = new Map();
        
        // Pega o último lance de cada participante
        for (const bid of history) {
            const existing = lastBids.get(bid.participantId);
            if (!existing || bid.observedAt > existing.observedAt) {
                lastBids.set(bid.participantId, bid);
            }
        }
        
        // Ordena por valor (menor = melhor em licitação)
        return [...lastBids.values()]
            .sort((a, b) => a.value - b.value)
            .map((bid, idx) => ({
                position: idx + 1,
                participantId: bid.participantId,
                value: bid.value,
                isOurBid: bid.isOurBid,
                observedAt: bid.observedAt
            }));
    }

    /**
     * Identifica padrão de redução de um concorrente
     */
    getReductionPattern(participantId) {
        const profile = this.profiles.get(participantId);
        if (!profile || profile.bidReductions.length < 3) {
            return { type: 'unknown', description: 'Dados insuficientes' };
        }
        
        const reductions = profile.bidReductions;
        const avg = profile.avgReductionPerBid;
        const median = profile.medianReductionPerBid;
        const variance = reductions.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / reductions.length;
        const cv = avg > 0 ? Math.sqrt(variance) / avg : 0; // Coeficiente de variação
        
        // Classifica o padrão
        if (cv < 0.2) {
            // Baixa variância = padrão consistente
            return {
                type: 'consistent',
                description: `Reduz ~R$${median.toFixed(2)} por lance (muito consistente)`,
                medianReduction: median,
                confidence: 0.9
            };
        } else if (cv < 0.5) {
            // Variância moderada
            return {
                type: 'moderate',
                description: `Reduz entre R$${(median * 0.7).toFixed(2)} e R$${(median * 1.3).toFixed(2)} por lance`,
                medianReduction: median,
                confidence: 0.7
            };
        } else {
            // Alta variância = imprevisível
            return {
                type: 'erratic',
                description: `Reduções variadas (R$${Math.min(...reductions).toFixed(2)} a R$${Math.max(...reductions).toFixed(2)})`,
                medianReduction: median,
                confidence: 0.4
            };
        }
    }

    /**
     * Estima próxima redução de um concorrente
     */
    estimateNextReduction(participantId) {
        const profile = this.profiles.get(participantId);
        if (!profile || profile.bidReductions.length < 2) {
            return null;
        }
        
        const pattern = this.getReductionPattern(participantId);
        
        // Para padrões consistentes, usa mediana
        if (pattern.type === 'consistent') {
            return {
                estimated: pattern.medianReduction,
                confidence: pattern.confidence,
                method: 'median'
            };
        }
        
        // Para outros padrões, usa média ponderada (lances recentes pesam mais)
        const reductions = profile.bidReductions;
        const weights = reductions.map((_, i) => i + 1); // Peso linear crescente
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const weightedAvg = reductions.reduce((sum, r, i) => sum + r * weights[i], 0) / totalWeight;
        
        return {
            estimated: weightedAvg,
            confidence: pattern.confidence * 0.8,
            method: 'weighted_average'
        };
    }

    /**
     * Retorna horas preferidas de lance de um concorrente
     */
    _getPreferredHours(hoursArray) {
        if (!hoursArray) return [];
        const max = Math.max(...hoursArray);
        if (max === 0) return [];
        return hoursArray
            .map((count, hour) => ({ hour, count }))
            .filter(h => h.count >= max * 0.5) // Horas com pelo menos 50% da atividade máxima
            .map(h => h.hour);
    }

    /**
     * Registra evento de rate limit para modelagem
     */
    recordRateLimit(endpoint, status, responseMs) {
        this.rateLimitWindows.push({
            endpoint, status, responseMs,
            timestamp: Date.now()
        });
        
        // Mantém apenas últimos 1000 registros
        if (this.rateLimitWindows.length > 1000) {
            this.rateLimitWindows = this.rateLimitWindows.slice(-500);
        }
    }

    /**
     * Estima janela de rate limit do endpoint
     */
    estimateRateLimit(endpoint) {
        const recent = this.rateLimitWindows.filter(w => 
            w.endpoint === endpoint && 
            (Date.now() - w.timestamp) < 5 * 60 * 1000 // Últimos 5min
        );
        
        if (recent.length < 5) return null;
        
        const hits429 = recent.filter(w => w.status === 429);
        const successRate = 1 - (hits429.length / recent.length);
        const avgMs = recent.reduce((a, w) => a + w.responseMs, 0) / recent.length;
        
        return {
            successRate: Math.round(successRate * 100),
            avgResponseMs: Math.round(avgMs),
            sampleSize: recent.length,
            hitRate429: hits429.length
        };
    }

    /**
     * Persiste dados acumulados no banco (batch)
     */
    async _flushToDb() {
        if (!this.prisma) return;
        try {
            // Persiste BidHistory em batch (últimos 30s não persistidos)
            const allBids = [];
            for (const [key, history] of this.bidHistory) {
                for (const bid of history) {
                    if (!bid._persisted && (Date.now() - bid.observedAt) > 5000) {
                        allBids.push({
                            purchaseId: bid.purchaseId,
                            itemId: bid.itemId,
                            participantId: bid.participantId,
                            value: bid.value,
                            position: bid.position,
                            isOurBid: bid.isOurBid,
                            source: bid.source,
                            observedAt: new Date(bid.observedAt)
                        });
                        bid._persisted = true;
                    }
                }
            }
            
            if (allBids.length > 0) {
                // Batch insert com skipDuplicates
                await this.prisma.bidHistory.createMany({
                    data: allBids.slice(0, 500), // Max 500 por batch
                    skipDuplicates: true
                });
                console.log(`%c[COMPETITOR PROFILER] 💾 ${allBids.length} lances persistidos no DB`, 'color:#8b5cf6;font-size:9px;');
            }
            
            // Persiste profiles atualizados
            for (const [id, profile] of this.profiles) {
                if (profile.totalBids >= this.MIN_BIDS_FOR_PROFILE) {
                    try {
                        await this.prisma.competitorProfile.upsert({
                            where: { participantId: id },
                            create: {
                                participantId: id,
                                totalBids: profile.totalBids,
                                avgReductionPerBid: profile.avgReductionPerBid,
                                medianReductionPerBid: profile.medianReductionPerBid,
                                avgTimeBetweenBids: profile.avgTimeBetweenBids,
                                bidCountLast10min: profile.bidCountLast10min,
                                maxSingleReduction: profile.maxSingleReduction,
                                aggressiveScore: profile.aggressiveScore,
                                preferredBidHours: JSON.stringify(this._getPreferredHours(profile.bidHours)),
                                lastBidAt: profile.lastBidAt ? new Date(profile.lastBidAt) : null,
                                firstSeenAt: new Date(profile.firstSeenAt)
                            },
                            update: {
                                totalBids: profile.totalBids,
                                avgReductionPerBid: profile.avgReductionPerBid,
                                medianReductionPerBid: profile.medianReductionPerBid,
                                avgTimeBetweenBids: profile.avgTimeBetweenBids,
                                bidCountLast10min: profile.bidCountLast10min,
                                maxSingleReduction: profile.maxSingleReduction,
                                aggressiveScore: profile.aggressiveScore,
                                preferredBidHours: JSON.stringify(this._getPreferredHours(profile.bidHours)),
                                lastBidAt: profile.lastBidAt ? new Date(profile.lastBidAt) : null
                            }
                        });
                    } catch (err) {
                        // Ignora erros de upsert individual
                    }
                }
            }
        } catch (err) {
            console.error('[COMPETITOR PROFILER] Erro no flush:', err.message);
        }
    }

    /**
     * Retorna estatísticas gerais
     */
    getStats() {
        return {
            totalBidsTracked: [...this.bidHistory.values()].reduce((sum, h) => sum + h.length, 0),
            totalCompetitors: this.profiles.size,
            activeItems: this.bidHistory.size,
            rateLimitSamples: this.rateLimitWindows.length,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }

    /**
     * Cleanup
     */
    async destroy() {
        clearInterval(this._flushTimer);
        await this._flushToDb();
        if (this.prisma) await this.prisma.$disconnect();
    }
}

module.exports = { CompetitorProfiler };
