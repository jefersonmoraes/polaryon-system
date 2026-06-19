/**
 * PredictiveEngine — Motor de Bidding Preditivo
 * 
 * Usa dados do CompetitorProfiler para estimar:
 * - Próximo lance de cada concorrente
 * - Timing do próximo lance
 * - Melhor momento para contra-atacar
 * - Custo estimado de uma guerra
 * 
 * v3.8.326 — Predictive Bidding Engine
 */

class PredictiveEngine {
    constructor(profiler) {
        this.profiler = profiler;
        
        // Cache de previsões (renovado a cada ciclo)
        this._predictionCache = new Map(); // key: `${purchaseId}_${itemId}` → Prediction
        this._cacheTTL = 2000; // 2s cache TTL
    }

    /**
     * Gera previsão completa para um item
     */
    predict(purchaseId, itemId, myCurrentBid, myMin, timeRemainingSec) {
        const cacheKey = `${purchaseId}_${itemId}`;
        const cached = this._predictionCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this._cacheTTL) {
            return cached.prediction;
        }
        
        const competitors = this.profiler.getActiveCompetitors(purchaseId, itemId);
        const history = this.profiler.getItemHistory(purchaseId, itemId);
        
        if (competitors.length === 0 && history.length === 0) {
            return this._noDataPrediction(myCurrentBid, myMin, timeRemainingSec);
        }
        
        // Previsão por concorrente
        const competitorPredictions = competitors.map(comp => {
            return this._predictCompetitor(comp, purchaseId, itemId, myCurrentBid, timeRemainingSec);
        }).filter(Boolean);
        
        // Melhor lance estimado do concorrente mais perigoso
        const mostDangerous = competitorPredictions.length > 0
            ? competitorPredictions.reduce((best, curr) => 
                curr.estimatedNextBid < best.estimatedNextBid ? curr : best
            )
            : null;
        
        // Previsão de timing: quando o próximo lance vai chegar?
        const timingPrediction = this._predictTiming(competitors, timeRemainingSec);
        
        // Custo estimado de guerra
        const warCost = this._estimateWarCost(competitors, myCurrentBid, myMin, timeRemainingSec);
        
        // Melhor lance para colocar agora
        const optimalBid = this._calculateOptimalBid(
            myCurrentBid, myMin, mostDangerous, timingPrediction, timeRemainingSec
        );
        
        const prediction = {
            timestamp: Date.now(),
            purchaseId,
            itemId,
            
            // Dados dos concorrentes
            competitorCount: competitors.length,
            competitorPredictions,
            mostDangerousCompetitor: mostDangerous,
            
            // Previsões
            estimatedNextCompetitorBid: mostDangerous ? mostDangerous.estimatedNextBid : null,
            estimatedTimeToNextBid: timingPrediction.estimatedMs,
            confidenceLevel: timingPrediction.confidence,
            
            // Recomendação
            recommendedBid: optimalBid.value,
            recommendedAction: optimalBid.action,
            reasoning: optimalBid.reasoning,
            
            // Custo de guerra
            estimatedWarCost: warCost,
            
            // Score de urgência (0-100)
            urgencyScore: this._calculateUrgencyScore(
                myCurrentBid, myMin, mostDangerous, timeRemainingSec
            )
        };
        
        this._predictionCache.set(cacheKey, { prediction, timestamp: Date.now() });
        return prediction;
    }

    /**
     * Previsão para um concorrente específico
     */
    _predictCompetitor(profile, purchaseId, itemId, myCurrentBid, timeRemainingSec) {
        const reduction = this.profiler.estimateNextReduction(profile.participantId);
        const pattern = this.profiler.getReductionPattern(profile.participantId);
        
        // Último lance conhecido deste concorrente
        const history = this.profiler.getItemHistory(purchaseId, itemId);
        const compBids = history
            .filter(b => b.participantId === profile.participantId && !b.isOurBid)
            .sort((a, b) => a.observedAt - b.observedAt);
        
        if (compBids.length === 0) return null;
        
        const lastBid = compBids[compBids.length - 1];
        
        // Estima próximo lance
        let estimatedNextBid = lastBid.value;
        if (reduction && reduction.estimated > 0) {
            estimatedNextBid = lastBid.value - reduction.estimated;
        }
        
        // Não pode ser menor que zero
        estimatedNextBid = Math.max(0, estimatedNextBid);
        
        // Estima timing baseado no padrão de frequência
        let estimatedTimeMs = profile.avgTimeBetweenBids || 30000; // Default 30s
        
        // Se está em reta final, concorrentes agressivos bidam mais rápido
        if (timeRemainingSec < 60) {
            estimatedTimeMs = Math.min(estimatedTimeMs, 5000); // Máximo 5s na reta
        }
        if (timeRemainingSec < 30) {
            estimatedTimeMs = Math.min(estimatedTimeMs, 2000); // Máximo 2s nos últimos 30s
        }
        
        // Penaliza se concorrente é lento (tempo entre lances alto)
        if (profile.avgTimeBetweenBids > 120000) {
            estimatedTimeMs *= 1.5; // Concorrentes lentos são menos urgentes
        }
        
        return {
            participantId: profile.participantId,
            currentBid: lastBid.value,
            estimatedNextBid: Math.round(estimatedNextBid * 100) / 100,
            estimatedTimeMs: Math.round(estimatedTimeMs),
            reductionEstimate: reduction,
            pattern,
            aggressionLevel: profile.aggressiveScore,
            confidence: reduction ? reduction.confidence : 0.3,
            beatsUs: estimatedNextBid < myCurrentBid,
            beatsOurMin: estimatedNextBid < myMin
        };
    }

    /**
     * Previsão de timing: quando o próximo lance vai chegar?
     */
    _predictTiming(competitors, timeRemainingSec) {
        if (competitors.length === 0) {
            return {
                estimatedMs: 30000,
                confidence: 0.2,
                reason: 'Sem dados de concorrentes'
            };
        }
        
        // Pega o menor tempo estimado entre todos os concorrentes
        const timings = competitors
            .filter(c => c.avgTimeBetweenBids > 0)
            .map(c => c.avgTimeBetweenBids);
        
        if (timings.length === 0) {
            return {
                estimatedMs: 15000,
                confidence: 0.3,
                reason: 'Sem timing disponível'
            };
        }
        
        // Usa o menor tempo (concorrente mais rápido)
        const fastestBid = Math.min(...timings);
        
        // Ajusta baseado no tempo restante
        let multiplier = 1.0;
        if (timeRemainingSec < 30) multiplier = 0.3; // 3x mais rápido
        else if (timeRemainingSec < 60) multiplier = 0.5; // 2x mais rápido
        else if (timeRemainingSec < 180) multiplier = 0.7;
        
        const estimated = fastestBid * multiplier;
        
        // Confiança baseada em quantos concorrentes têm timing confiável
        const confidence = Math.min(0.9, timings.length / competitors.length * 0.7);
        
        return {
            estimatedMs: Math.round(estimated),
            confidence: Math.round(confidence * 100) / 100,
            reason: `Baseado em ${timings.length} concorrente(s), ajustado para ${timeRemainingSec}s restantes`
        };
    }

    /**
     * Calcula custo estimado de uma guerra
     */
    _estimateWarCost(competitors, myCurrentBid, myMin, timeRemainingSec) {
        if (competitors.length === 0 || myCurrentBid <= myMin) {
            return { total: 0, captchaTokens: 0, bidCount: 0 };
        }
        
        const headroom = myCurrentBid - myMin;
        let totalReduction = 0;
        let bidCount = 0;
        
        // Simula lance a lance até atingir o mínimo
        let currentBid = myCurrentBid;
        while (currentBid > myMin && bidCount < 100) {
            // Estima a próxima redução baseada no concorrente mais perigoso
            const avgReduction = competitors.reduce((sum, c) => 
                sum + (c.avgReductionPerBid || 50), 0) / competitors.length;
            
            const reduction = Math.min(avgReduction, currentBid - myMin);
            if (reduction <= 0) break;
            
            currentBid -= reduction;
            totalReduction += reduction;
            bidCount++;
        }
        
        return {
            estimatedReduction: Math.round(totalReduction * 100) / 100,
            estimatedBids: bidCount,
            estimatedCaptchaTokens: bidCount, // 1 captcha por lance
            estimatedDurationMs: bidCount * 500, // ~500ms por ciclo de lance
            marginImpact: Math.round((totalReduction / myCurrentBid) * 10000) / 100 // % do preço
        };
    }

    /**
     * Calcula o lance ótimo para colocar agora
     */
    _calculateOptimalBid(myCurrentBid, myMin, mostDangerous, timingPrediction, timeRemainingSec) {
        // Sem dados preditivos → usa lógica básica
        if (!mostDangerous) {
            return {
                value: myCurrentBid,
                action: 'wait',
                reasoning: 'Sem dados de concorrentes suficientes para predição'
            };
        }
        
        const { estimatedNextBid, estimatedTimeMs, confidence, beatsUs } = mostDangerous;
        
        // Se o concorrente estimado já está abaixo do nosso mínimo, não podemos vencer
        if (estimatedNextBid < myMin) {
            // Mas se podemos EMPATAR (myMin == estimatedNextBid), vale a pena
            if (Math.abs(myMin - estimatedNextBid) < 0.01) {
                return {
                    value: myMin,
                    action: 'tie',
                    reasoning: `Empate estimado: concorrente vai a R$${estimatedNextBid.toFixed(2)}`
                };
            }
            return {
                value: myCurrentBid,
                action: 'hold',
                reasoning: `Concorrente estimado R$${estimatedNextBid.toFixed(2)} < nosso mínimo R$${myMin.toFixed(2)}`
            };
        }
        
        // Se o concorrente vai nos superar em breve
        if (beatsUs && estimatedTimeMs < 5000) {
            // Ataque preventivo: vai logo abaixo do estimado
            const beatingAmount = timeRemainingSec < 30 ? 0.0001 : 0.01;
            const targetBid = Math.max(myMin, estimatedNextBid - beatingAmount);
            
            if (targetBid >= myMin) {
                return {
                    value: Math.round(targetBid * 10000) / 10000,
                    action: 'preemptive_strike',
                    reasoning: `Ataque preventivo: concorrente estimado R$${estimatedNextBid.toFixed(2)} em ~${(estimatedTimeMs/1000).toFixed(1)}s`
                };
            }
        }
        
        // Situação normal: calcula lance baseado na urgência
        const urgencyFactor = timeRemainingSec < 30 ? 0.8 : (timeRemainingSec < 60 ? 0.6 : 0.4);
        const gap = myCurrentBid - myMin;
        const safeReduction = gap * urgencyFactor;
        
        // Não vai abaixo do concorrente estimado (com margem mínima)
        const beatingAmount = timeRemainingSec < 30 ? 0.0001 : 0.01;
        const targetBid = Math.max(myMin, estimatedNextBid - beatingAmount);
        const safeBid = Math.max(myMin, myCurrentBid - safeReduction);
        
        // Escolhe o menor que satisfaz (mais agressivo = mais baixo)
        const recommendedBid = Math.min(targetBid, safeBid);
        
        if (recommendedBid < myCurrentBid) {
            return {
                value: Math.round(recommendedBid * 10000) / 10000,
                action: confidence > 0.6 ? 'predictive_bid' : 'conservative_bid',
                reasoning: `Predição: concorrente estimado R$${estimatedNextBid.toFixed(2)} (confiança: ${(confidence*100).toFixed(0)}%), lance recomendado R$${recommendedBid.toFixed(2)}`
            };
        }
        
        return {
            value: myCurrentBid,
            action: 'hold',
            reasoning: 'Lance atual já é competitivo'
        };
    }

    /**
     * Calcula score de urgência (0-100)
     */
    _calculateUrgencyScore(myCurrentBid, myMin, mostDangerous, timeRemainingSec) {
        let score = 0;
        
        // Fator 1: Tempo restante (quase sem tempo = urgente)
        if (timeRemainingSec < 10) score += 40;
        else if (timeRemainingSec < 30) score += 30;
        else if (timeRemainingSec < 60) score += 20;
        else if (timeRemainingSec < 180) score += 10;
        
        // Fator 2: Concorrentes nos superando
        if (mostDangerous && mostDangerous.beatsUs) {
            score += 30;
            if (mostDangerous.estimatedTimeMs < 3000) score += 20; // Muito em breve
        }
        
        // Fator 3: Margem apertada
        const margin = myCurrentBid - myMin;
        if (margin < 1) score += 10;
        else if (margin < 10) score += 5;
        
        return Math.min(100, score);
    }

    /**
     * Predição quando não há dados
     */
    _noDataPrediction(myCurrentBid, myMin, timeRemainingSec) {
        return {
            timestamp: Date.now(),
            competitorCount: 0,
            competitorPredictions: [],
            mostDangerousCompetitor: null,
            estimatedNextCompetitorBid: null,
            estimatedTimeToNextBid: null,
            confidenceLevel: 0,
            recommendedBid: myCurrentBid,
            recommendedAction: 'wait',
            reasoning: 'Sem dados históricos disponíveis — usando lógica reativa',
            estimatedWarCost: { total: 0, captchaTokens: 0, bidCount: 0 },
            urgencyScore: timeRemainingSec < 30 ? 60 : (timeRemainingSec < 60 ? 30 : 10)
        };
    }

    /**
     * Limpa cache de predições
     */
    clearCache() {
        this._predictionCache.clear();
    }
}

module.exports = { PredictiveEngine };
