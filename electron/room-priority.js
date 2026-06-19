/**
 * RoomPriorityScorer — Priorização Inteligente de Salas
 * 
 * Aloca recursos (sockets, polling, captchas) de forma inteligente
 * baseado em urgência, probabilidade de vitória e margem.
 * 
 * WarEscalation — Escada de 4 níveis de agressividade
 * 
 * v3.8.326 — Multi-Room Priority + War Escalation
 */

// ==========================================
// ROOM PRIORITY SCORER
// ==========================================

class RoomPriorityScorer {
    constructor() {
        // Pesos para cálculo de score (soma = 1.0)
        this.WEIGHTS = {
            timerUrgency:    0.30, // Quanto menos tempo, maior a urgência
            winProbability:  0.25, // Probabilidade de vencer
            marginHeadroom:  0.20, // Espaço entre lance atual e mínimo
            competitorThreat:0.15, // Nível de ameaça dos concorrentes
            strategicValue:  0.10  // Valor estratégico da sala
        };
        
        // Cache de scores
        this._scores = new Map(); // key: sessionId → { score, details }
        this._allocation = new Map(); // key: sessionId → allocation level
    }

    /**
     * Calcula score de prioridade para uma sala
     */
    score(sessionData) {
        const {
            sessionId,
            timeRemainingSec,
            myCurrentBid,
            myMin,
            isWinning,
            competitorCount,
            isWarMode,
            itemCount,
            totalValue,
            hasRankingData
        } = sessionData;
        
        // 1. Score de urgência do timer (0-100)
        let timerScore;
        if (timeRemainingSec < 0) timerScore = 0; // Encerrada
        else if (timeRemainingSec < 10) timerScore = 100;
        else if (timeRemainingSec < 30) timerScore = 90;
        else if (timeRemainingSec < 60) timerScore = 75;
        else if (timeRemainingSec < 120) timerScore = 60;
        else if (timeRemainingSec < 300) timerScore = 40;
        else if (timeRemainingSec < 600) timerScore = 25;
        else timerScore = 10;
        
        // 2. Score de probabilidade de vitória (0-100)
        let winScore;
        if (isWinning) {
            winScore = 80; // Já ganhando — manter posição
        } else if (myMin > 0 && myCurrentBid > myMin) {
            const margin = (myCurrentBid - myMin) / myCurrentBid;
            if (margin > 0.5) winScore = 70; // Muita margem
            else if (margin > 0.2) winScore = 50;
            else if (margin > 0.05) winScore = 30;
            else winScore = 10; // Margem mínima
        } else {
            winScore = 0; // Sem margem
        }
        
        // 3. Score de margem (0-100)
        let marginScore;
        if (myMin <= 0 || myCurrentBid <= 0) {
            marginScore = 50; // Dados não disponíveis
        } else {
            const headroom = myCurrentBid - myMin;
            if (headroom > 1000) marginScore = 100;
            else if (headroom > 500) marginScore = 80;
            else if (headroom > 100) marginScore = 60;
            else if (headroom > 10) marginScore = 40;
            else if (headroom > 1) marginScore = 20;
            else marginScore = 5;
        }
        
        // 4. Score de ameaça concorrente (0-100)
        let threatScore;
        if (isWarMode) {
            threatScore = 90; // Guerra = alta ameaça
        } else if (competitorCount > 5) {
            threatScore = 70;
        } else if (competitorCount > 2) {
            threatScore = 50;
        } else if (competitorCount > 0) {
            threatScore = 30;
        } else {
            threatScore = 10; // Sem concorrentes = baixa ameaça
        }
        
        // 5. Score estratégico (0-100)
        let strategicScore = 50; // Base
        if (totalValue > 100000) strategicScore += 20; // Item valioso
        if (itemCount > 1) strategicScore += 10; // Múltiplos itens
        if (hasRankingData) strategicScore += 15; // Tem dados de ranking
        if (!isWinning) strategicScore += 5; // Competitivo
        strategicScore = Math.min(100, strategicScore);
        
        // Score final ponderado
        const finalScore = (
            timerScore * this.WEIGHTS.timerUrgency +
            winScore * this.WEIGHTS.winProbability +
            marginScore * this.WEIGHTS.marginHeadroom +
            threatScore * this.WEIGHTS.competitorThreat +
            strategicScore * this.WEIGHTS.strategicValue
        );
        
        const score = Math.round(finalScore * 100) / 100;
        
        // Determina nível de alocação
        let allocation;
        if (score >= 80) allocation = 'critical';   // Máximo recursos
        else if (score >= 60) allocation = 'high';   // Recursos altos
        else if (score >= 40) allocation = 'normal';  // Recursos padrão
        else if (score >= 20) allocation = 'low';     // Recursos mínimos
        else allocation = 'idle';                     // Só heartbeat
        
        const details = {
            sessionId,
            score,
            allocation,
            timer: timerScore,
            win: winScore,
            margin: marginScore,
            threat: threatScore,
            strategic: strategicScore,
            timeRemainingSec,
            isWinning,
            isWarMode,
            competitorCount
        };
        
        this._scores.set(sessionId, details);
        this._allocation.set(sessionId, allocation);
        
        return details;
    }

    /**
     * Retorna configuração de polling baseada no nível de alocação
     */
    getPollingConfig(allocation) {
        const configs = {
            critical: {
                pollIntervalMs: 20,    // polling ultra-rápido
                cooldownMs: 200,       // cooldown mínimo
                captchaPriority: true, // captcha prioritário
                maxConcurrent: 4       // requisições simultâneas
            },
            high: {
                pollIntervalMs: 50,
                cooldownMs: 300,
                captchaPriority: true,
                maxConcurrent: 3
            },
            normal: {
                pollIntervalMs: 200,
                cooldownMs: 500,
                captchaPriority: false,
                maxConcurrent: 2
            },
            low: {
                pollIntervalMs: 500,
                cooldownMs: 1000,
                captchaPriority: false,
                maxConcurrent: 1
            },
            idle: {
                pollIntervalMs: 5000,
                cooldownMs: 5000,
                captchaPriority: false,
                maxConcurrent: 1
            }
        };
        
        return configs[allocation] || configs.normal;
    }

    /**
     * Retorna todas as salas ordenadas por prioridade
     */
    getRankedSessions() {
        return [...this._scores.values()]
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Retorna estatísticas de alocação
     */
    getAllocationStats() {
        const stats = { critical: 0, high: 0, normal: 0, low: 0, idle: 0 };
        for (const alloc of this._allocation.values()) {
            stats[alloc] = (stats[alloc] || 0) + 1;
        }
        return stats;
    }
}

// ==========================================
// WAR ESCALATION ENGINE
// ==========================================

class WarEscalationEngine {
    constructor() {
        // Níveis de escalação
        this.LEVELS = {
            0: { // NORMAL
                name: 'normal',
                description: 'Modo normal — monitoramento padrão',
                pollingMultiplier: 1.0,
                bidAggression: 'conservative',  // Só bate o concorrente
                marginMode: 'full',             // Usa margem completa
                maxBidsPerMinute: 5,
                captchaBudget: 2
            },
            1: { // ALERTA — concorrente reduziu rápido
                name: 'alert',
                description: 'Concorrente agressivo detectado — aumentando vigilância',
                pollingMultiplier: 0.5,         // 2x mais rápido
                bidAggression: 'moderate',      // Reduz mais agressivamente
                marginMode: 'moderate',         // Usa 70% da margem
                maxBidsPerMinute: 10,
                captchaBudget: 4
            },
            2: { // GUERRA — múltiplos lances em sequência
                name: 'war',
                description: 'Guerra de lances — modo agressivo',
                pollingMultiplier: 0.1,         // 10x mais rápido (20ms)
                bidAggression: 'aggressive',    // Reduz agressivamente
                marginMode: 'aggressive',       // Usa 90% da margem
                maxBidsPerMinute: 30,
                captchaBudget: 8
            },
            3: { // TOTAL — última tentativa
                name: 'total',
                description: 'Guerra total — vai ao mínimo se necessário',
                pollingMultiplier: 0.05,        // 20x mais rápido (10ms)
                bidAggression: 'maximum',       // Vai ao mínimo
                marginMode: 'maximum',          // Usa 100% da margem
                maxBidsPerMinute: 60,
                captchaBudget: 15
            },
            4: { // DESISTÊNCIA — margem esgotada
                name: 'withdraw',
                description: 'Margem esgotada — parando de disputar',
                pollingMultiplier: 2.0,         // Polling lento
                bidAggression: 'none',          // Não bate mais
                marginMode: 'none',
                maxBidsPerMinute: 0,
                captchaBudget: 0
            }
        };
        
        // Estado por sala
        this._roomStates = new Map(); // key: sessionId → WarState
    }

    /**
     * Avalia e atualiza o nível de escalação de uma sala
     */
    evaluate(sessionId, context) {
        const {
            warModeCycles,          // Ciclos de guerra detectados
            recentBidCount,         // Lances nos últimos 60s
            margin,                 // myCurrentBid - myMin
            isWinning,              // Se estamos em 1º lugar
            competitorAggression,   // Score de agressividade do concorrente mais perigoso
            timeRemainingSec,       // Tempo restante
            bidCount,               // Total de lances que demos
            captchaConsumed         // Captchas consumidos
        } = context;
        
        let state = this._roomStates.get(sessionId);
        if (!state) {
            state = {
                currentLevel: 0,
                levelChangedAt: Date.now(),
                history: [],
                totalBidsInWar: 0,
                totalCaptchaInWar: 0,
                warStartedAt: null
            };
            this._roomStates.set(sessionId, state);
        }
        
        // Determina nível recomendado
        let recommendedLevel = 0;
        
        // Lógica de detecção de nível
        if (margin <= 0 || captchaConsumed > 50) {
            recommendedLevel = 4; // Desistir
        } else if (warModeCycles >= 5 || recentBidCount >= 20) {
            recommendedLevel = 3; // Guerra total
        } else if (warModeCycles >= 2 || recentBidCount >= 8) {
            recommendedLevel = 2; // Guerra
        } else if (warModeCycles >= 1 || recentBidCount >= 3 || competitorAggression > 60) {
            recommendedLevel = 1; // Alerta
        } else {
            recommendedLevel = 0; // Normal
        }
        
        // Histerese: não desce de nível imediatamente (precisa de 3 ciclos sem atividade)
        if (recommendedLevel < state.currentLevel) {
            const cyclesSinceLevelUp = (Date.now() - state.levelChangedAt) / 1000;
            if (cyclesSinceLevelUp < 10) { // Mantém nível por pelo menos 10s
                recommendedLevel = state.currentLevel;
            }
        }
        
        // Transição de nível
        if (recommendedLevel !== state.currentLevel) {
            const oldLevel = state.currentLevel;
            state.currentLevel = recommendedLevel;
            state.levelChangedAt = Date.now();
            
            if (recommendedLevel > 0 && !state.warStartedAt) {
                state.warStartedAt = Date.now();
            }
            
            state.history.push({
                from: oldLevel,
                to: recommendedLevel,
                timestamp: Date.now(),
                context: { warModeCycles, recentBidCount, margin, competitorAggression }
            });
            
            // Limita histórico
            if (state.history.length > 20) state.history = state.history.slice(-10);
            
            console.log(
                `%c[WAR ESCALATION] ${sessionId}: Nível ${oldLevel} → ${recommendedLevel} (${this.LEVELS[recommendedLevel].name})`,
                `color:${recommendedLevel >= 3 ? '#ef4444' : recommendedLevel >= 1 ? '#f59e0b' : '#10b981'};font-weight:bold;font-size:11px;`
            );
        }
        
        const levelConfig = this.LEVELS[state.currentLevel];
        
        return {
            level: state.currentLevel,
            config: levelConfig,
            timeInLevel: Date.now() - state.levelChangedAt,
            warDuration: state.warStartedAt ? Date.now() - state.warStartedAt : 0,
            totalBidsInWar: state.totalBidsInWar,
            history: state.history
        };
    }

    /**
     * Registra um lance dado durante a guerra
     */
    recordBid(sessionId) {
        const state = this._roomStates.get(sessionId);
        if (state) {
            state.totalBidsInWar++;
        }
    }

    /**
     * Registra captcha consumido
     */
    recordCaptcha(sessionId) {
        const state = this._roomStates.get(sessionId);
        if (state) {
            state.totalCaptchaInWar++;
        }
    }

    /**
     * Retorna estado de uma sala
     */
    getState(sessionId) {
        return this._roomStates.get(sessionId) || null;
    }

    /**
     * Reseta estado de uma sala (quando termina a disputa)
     */
    reset(sessionId) {
        const state = this._roomStates.get(sessionId);
        if (state) {
            console.log(
                `%c[WAR ESCALATION] ${sessionId}: Reset — duração total: ${state.warStartedAt ? Math.round((Date.now() - state.warStartedAt) / 1000) : 0}s, lances: ${state.totalBidsInWar}`,
                'color:#8b5cf6;font-size:10px;'
            );
        }
        this._roomStates.delete(sessionId);
    }
}

module.exports = { RoomPriorityScorer, WarEscalationEngine };
