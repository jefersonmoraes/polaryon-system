import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Activity, RefreshCw, Play, Square, Settings2, Target, Zap, Shield, Key, History, AlertTriangle, CheckCircle2, Plus as PlusIcon, Check, Trophy, ChevronDown, ChevronRight, Clock, XCircle, LogOut, Search, StopCircle, Briefcase, MessageSquare } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { socketService } from '@/lib/socket';
import { useAuthStore } from '../store/auth-store';
import api from '@/lib/api';
import { useVaultStore } from '@/store/vault-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Link } from 'react-router-dom';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    } from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CertificateManager } from '@/components/terminal/CertificateManager';
import { Badge } from '@/components/ui/badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface BiddingItem {
    itemId: string;
    valorAtual: number;
    meuValor?: number;
    valorEstimado?: number;
    uasgName?: string;
    ganhador: string;
    status: string;
    position: number;
    posicao?: string; 
    timerSeconds?: number;
    timeout?: string;
    desc?: string;
    descricao?: string; // Fallback
    rankingLances?: any[];
    tipo?: string;
    isGroup?: boolean;
}

interface ItemStrategy {
    mode: 'follower' | 'sniper' | 'cover' | 'shadow';
    minPrice: number;
    decrementValue: number;
    decrementType: 'fixed' | 'percent';
    snipeDelaySeconds?: number;
}

export function safeParseNumber(val: any): number {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    
    let str = String(val).trim().replace(/R\$\s*/gi, '');
    
    if (str.includes(',') && str.includes('.')) {
        str = str.replace(/\./g, '').replace(/,/g, '.');
    } else if (str.includes(',')) {
        str = str.replace(/,/g, '.');
    }
    
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
}

export default function BiddingDashboardPage() {
    const { currentUser: authUser } = useAuthStore();
    const [searchParams] = useSearchParams();
    
    const [uasg, setUasg] = useState('');
    const [numeroPregao, setNumeroPregao] = useState('');
    const [anoPregao, setAnoPregao] = useState(new Date().getFullYear().toString());
    const [turbo, setTurbo] = useState<boolean>(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [items, setItems] = useState<BiddingItem[]>([]);
    
    // MODO MULTI-UASG (v2.0 War Flow)
    const [sessions, setSessions] = useState<Record<string, {
        uasg: string;
        numero: string;
        items: BiddingItem[];
        chatMessages: any[];
        lastUpdate: string;
        isAuthenticated: boolean;
        simulationMode: boolean;
        modality?: string;
        sessionTitle?: string;
        syncStatus?: string;
    }>>({});

    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [itemStrategies, setItemStrategies] = useState<Record<string, ItemStrategy>>({});
    const [simulationMode, setSimulationMode] = useState(true);
    const { credentials, fetchCredentials: fetchVaultCredentials } = useVaultStore();

    // Helper para obter a configuração de itens de uma sessão específica
    const [selectedCredentialId, setSelectedCredentialId] = useState<string>('');
    const [modality, setModality] = useState<string>('05'); // Default: 05 - Pregão
    const [actionLogs, setActionLogs] = useState<any[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showRealModeWarning, setShowRealModeWarning] = useState(false);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [serverOffset, setServerOffset] = useState(0);
    const [sigaTimerSeconds, setSigaTimerSeconds] = useState<number | undefined>(undefined);
    const [sigaTimerReceivedAt, setSigaTimerReceivedAt] = useState<number>(0);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [coveredItems, setCoveredItems] = useState<Set<string>>(new Set());
    const [isDesktop] = useState(!!(window as any).electronAPI?.isDesktop);
    const [isLocalRunning, setIsLocalRunning] = useState(false);
    const [networkTraffic, setNetworkTraffic] = useState<any[]>([]);
    const [trafficLogs, setTrafficLogs] = useState<string[]>([]);
    const [hybridRooms, setHybridRooms] = useState<string[]>([]);
    const [apiStatus, setApiStatus] = useState<string>('OFFLINE');
    const [uasgFilter, setUasgFilter] = useState('');
    const [lastAutoBidTimes, setLastAutoBidTimes] = useState<Record<string, number>>({});
    const [appVersion, setAppVersion] = useState('...');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [serverTime, setServerTime] = useState<number>(Date.now());
    const [now, setNow] = useState<number>(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isDesktop && (window as any).electronAPI) {
            (window as any).electronAPI.getAppVersion().then((v: string) => setAppVersion(v));
        }
    }, [isDesktop]);
    
    // 🧠 REFERÊNCIAS ESTÁVEIS PARA AUTOMAÇÃO (v3.5.89)
    const itemsRef = useRef(items);
    const configsRef = useRef<any>({});
    const lastBidTimesRef = useRef<Record<string, number>>({});
    const last422PenaltyRef = useRef<Record<string, number>>({}); // ⏳ Penalidade de 3s após 422
    const serverOffsetRef = useRef<number>(serverOffset);
    const clockSkewRef = useRef<number>(0); // Clock skew: sigaTimerSeconds - (endTime - Date.now())/1000
    const sigaTimerSecondsRef = useRef<number | undefined>(undefined);
    const sigaTimerReceivedAtRef = useRef<number>(0);
    const serverTimeMsRef = useRef<number>(0);
    const serverTimeReceivedAtRef = useRef<number>(0);
    // 🔒 DEDUPLICADOR COM TTL (v3.8.59): bloqueia redisparo do mesmo valor por 5s, independente do ciclo React
    const lastFiredBidRef = useRef<Record<string, { value: number; timestamp: number; previousValue?: any }>>({});
    // 🛡️ GUARDA INTERMEDIÁRIO (v4.1.1): após disparar bid de posicionamento, congela o item por 30s
    // para aguardar a API propagar nosso lance antes de re-avaliar concorrentes.
    const lastIntermediateBidRef = useRef<Record<string, { value: number; timestamp: number; duration?: number }>>({});
    // 🔇 THROTTLE DE LOGS (v4.3.0): Limita logs de estado a 1x/seg por item para evitar spam no console (lentidão visual)
    const lastLogRef = useRef<Record<string, number>>({});
    // 🔗 REFERÊNCIA DE SESSÃO ATIVA (v4.4.0): Fornece acesso síncrono ao sessionId nos callbacks assíncronos do IPC/Socket
    const sessionIdRef = useRef<string | null>(null);
    // ⚡ REFERÊNCIA DE DISPLAY INSTANTÂNEO (RAIO DIRETO): recebe meuValor, valorAtual, posicao diretamente do WebSocket
    // sem passar pelo pipeline pesado de processSerproData/clockSync/handlePortalSync.
    // Chave: `${codigo}_${itemId}`, Valor: { meuValor, valorAtual, posicao, ganhador }
    const wsFastBidsRef = useRef<Record<string, { meuValor: number; valorAtual: number; posicao: string; ganhador: string }>>({});
    // 🏠 BACKEND ATIVO: quando backend RoomRunner está gerenciando bids (v3.8.175), frontend sniper não dispara
    const backendActiveRef = useRef(false);
    // ⏱ TIMER OVERRIDE: força cronômetro para 40s fazendo sniper entender que está na reta final (v3.8.242)
    const timerOverrideRef = useRef<Record<string, number>>({});

    // 🏆 HELPERS DE SEGURANÇA E PROTEÇÃO CONTRA LAG DE REDE (v4.4.3)
    // Permitem buscar os locks de disparos recentes de forma flexível pelo itemId (sufixo),
    // ignorando qualquer incompatibilidade de prefixo de sessionId (GLOBAL_, virtual_, HYBRID_, UUID)
    const getRecentFiredBid = (itemId: string): { value: number; timestamp: number } | null => {
        let bestMatch: { value: number; timestamp: number } | null = null;
        const now = Date.now();
        const itemIdStr = String(itemId);
        
        for (const [k, fired] of Object.entries(lastFiredBidRef.current)) {
            if ((k === itemIdStr || k.endsWith(`_${itemIdStr}`)) && (now - fired.timestamp) < 15000) {
                if (!bestMatch || fired.timestamp > bestMatch.timestamp) {
                    bestMatch = fired;
                }
            }
        }
        return bestMatch;
    };

    const getRecentIntermediateBid = (itemId: string): { value: number; timestamp: number; duration?: number } | null => {
        let bestMatch: { value: number; timestamp: number; duration?: number } | null = null;
        const now = Date.now();
        const itemIdStr = String(itemId);

        for (const [k, inter] of Object.entries(lastIntermediateBidRef.current)) {
            if ((k === itemIdStr || k.endsWith(`_${itemIdStr}`))) {
                const duration = inter.duration !== undefined ? inter.duration : 30000;
                if ((now - inter.timestamp) < duration) {
                    if (!bestMatch || inter.timestamp > bestMatch.timestamp) {
                        bestMatch = inter;
                    }
                }
            }
        }
        return bestMatch;
    };

    useEffect(() => { 
        itemsRef.current = items || []; 
    }, [items]);

    useEffect(() => {
        serverOffsetRef.current = serverOffset;
    }, [serverOffset]);

    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    // 🔄 SINCRONIZADOR DE ESTADO DE ITENS ATIVOS EM TEMPO REAL (v3.8.54)
    useEffect(() => {
        if (sessionId && sessions[sessionId]) {
            const activeItems = sessions[sessionId].items || [];
            setItems(activeItems);
        }
    }, [sessions, sessionId]);
    
    useEffect(() => { 
        configsRef.current = itemStrategies; 
        (window as any).polaryonStrategies = itemStrategies;
    }, [itemStrategies]);

    useEffect(() => { lastBidTimesRef.current = lastAutoBidTimes; }, [lastAutoBidTimes]);

    // 🎯 NOTIFICA O MOTOR DO FOCO DA SESSÃO (Anti-429 Adaptive Polling v3.8.2)
    useEffect(() => {
        if (isDesktop && sessionId && (window as any).electronAPI?.setFocusedSession) {
            (window as any).electronAPI.setFocusedSession(sessionId);
        }
    }, [sessionId, isDesktop]);

    // 🎯 RELÓGIO LOCAL (v3.8.84) — só referência visual, não afeta lances
    useEffect(() => {
        const timer = setInterval(() => {
            setServerTime(Date.now());
        }, 100);
        return () => clearInterval(timer);
    }, []);

    // 🎯 MOTOR DE DISPARO INDEPENDENTE (v3.5.89)
    useEffect(() => {
        const fetchVersion = async () => {
            if (isDesktop && (window as any).electronAPI) {
                const v = await (window as any).electronAPI.getAppVersion();
                console.log(`%c🚀 [POLARYON] Motor Sniper v${v} Ativo e Monitorando.`, "color: #0ea5e9; font-weight: bold; font-size: 12px;");
            }
        };
        fetchVersion();
        
        const autoBidInterval = setInterval(() => {
            const currentItems = itemsRef.current;
            const configs = configsRef.current;
            const lastAutoBidTimesLocal = lastBidTimesRef.current;
            if (!currentItems || currentItems.length === 0) return;

            currentItems.forEach(item => {
                const sId = String(item.itemId);
                const itemSid = item.sid || '';
                const strat = configs[`${itemSid}_${sId}`] || configs[sId] || configs[item.itemId] || {};
                const isActive = strat.active || false;
                
                if (!isActive) {
                    if ((lastLogRef.current[`inactive_${sId}`] || 0) < Date.now() - 10000) {
                        console.log(`[SNIPER] ⏹️ Item ${sId}: sniper INATIVO (botão desligado).`);
                        lastLogRef.current[`inactive_${sId}`] = Date.now();
                    }
                    return;
                }

                // ⏱ TIMER OVERRIDE: se ativo (timestamp < 40s atrás), força o sniper a rodar com cronômetro em 40s (v3.8.242)
                const overrideTs = timerOverrideRef.current[`${itemSid}_${sId}`] || timerOverrideRef.current[sId] || 0;
                const isTimerOverridden = overrideTs > 0 && (Date.now() - overrideTs) < 40000;
                if (!isTimerOverridden && overrideTs > 0) {
                    timerOverrideRef.current[`${itemSid}_${sId}`] = 0;
                    timerOverrideRef.current[sId] = 0;
                }

                // 🏠 Se backend está ativo E não tem override, frontend sniper não precisa disparar
                if (backendActiveRef.current && !isTimerOverridden) {
                    return;
                }

                if ((lastLogRef.current[`loop_${sId}`] || 0) < Date.now() - 10000) {
                    console.log(`[SNIPER] 🔄 Item ${sId}: sniper ATIVO — avaliando lance...`);
                    lastLogRef.current[`loop_${sId}`] = Date.now();
                }

                // 🔥 Tempo restante: clockSkew ajusta dataHoraFimContagem para o relógio local
                let currentTimeLeft: number;
                // ⏱ Se override ativo, força timer para 40s (sniper entende que está na reta final)
                if (isTimerOverridden) {
                    currentTimeLeft = 40;
                } else {
                    const sts = sigaTimerSecondsRef.current;
                    const sta = sigaTimerReceivedAtRef.current;
                    if (sts !== undefined && sts >= 0 && sta > 0) {
                        currentTimeLeft = Math.max(0, Math.floor(sts - (Date.now() - sta) / 1000));
                    } else if (item.dataHoraFimContagem) {
                        const endTime = new Date(item.dataHoraFimContagem).getTime();
                        if (!isNaN(endTime)) {
                            currentTimeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000 + clockSkewRef.current));
                        } else {
                            currentTimeLeft = -1;
                        }
                    } else {
                        currentTimeLeft = -1;
                    }
                }
                const isRetaFinal = currentTimeLeft >= 0 && currentTimeLeft <= 30;

                // ⏳ SNIPER COM RETARDO: espera o timer chegar no limite (v3.8.130)
                const snipeDelay = Number(strat.snipeDelaySeconds !== undefined ? strat.snipeDelaySeconds : 0);
                if (snipeDelay > 0 && currentTimeLeft >= 0 && currentTimeLeft > snipeDelay) {
                    if ((lastLogRef.current[`delay_${sId}`] || 0) < Date.now() - 5000) {
                        console.log(`[SNIPER] ⏳ Item ${sId}: Aguardando snipeDelay (timer=${currentTimeLeft}s > snipeDelay=${snipeDelay}s).`);
                        lastLogRef.current[`delay_${sId}`] = Date.now();
                    }
                    return;
                }

                // 🔍 LOG DE DIAGNÓSTICO ATIVO (v3.5.89)
                if (currentTimeLeft <= 40 && currentTimeLeft > 0) {
                    // 🔇 Throttle: só loga 1x por segundo por item
                    const lastBrainLog = lastLogRef.current[`brain_${sId}`] || 0;
                    if (Date.now() - lastBrainLog >= 1000) {
                        console.debug(`[SNIPER BRAIN] Item ${sId}: Tempo ${currentTimeLeft}s | Perdedor: ${String(item.posicao) !== '1'}`);
                        lastLogRef.current[`brain_${sId}`] = Date.now();
                    }
                }

                // 🔥 SNIPER ATIVO IMEDIATAMENTE (sem trava de 30s)
                const isKamikaze = strat.kamikazeMode || false;
                if (isActive) {
                    const myBid = Number(item.meuValor || 99999999);
                    const bestBid = Number(item.valorAtual || 0);
                    
                    // Considera também o lastFired para evitar loop se a API estiver lenta
                    const lastFired = getRecentFiredBid(item.itemId);
                    const activeMyBid = lastFired ? Math.min(myBid, lastFired.value) : myBid;

                    const isWinningByValue = (activeMyBid > 0 && bestBid > 0 && activeMyBid <= bestBid);
                    const pos = String(item.posicao || '').toUpperCase().trim();
                    const isLosingPos = !(pos === '1' || pos === '1º' || pos === '1°' || pos === 'G' || pos === 'V' || pos === 'GANHANDO' || pos === 'VENCEDOR') && Number(item.position) !== 1;
                    
                    // 🔥 LÓGICA DE DISPARO ULTRA-AGRESSIVA (Se a posição ou o valor indica perda, atira! Evita congelamento por falso positivo na posição)
                    const isLosing = isLosingPos || (bestBid > 0 && activeMyBid > bestBid) || (!isWinningByValue && item.posicao === '?');
                    
                    if (isLosing) {
                        const myMin = Number(strat.minPrice || 0);
                        if (myMin <= 0) {
                            console.debug(`[SNIPER] Item ${sId}: BLOQUEADO - Valor mínimo não configurado.`);
                            return;
                        }

                        const now = Date.now();
                        const lastBid = lastAutoBidTimesLocal[sId] || lastAutoBidTimesLocal[item.itemId] || 0;
                        
                        // ⏳ Penalidade de 3s após 422 (evita retentar com dados stale)
                        const last422 = last422PenaltyRef.current[sId] || 0;
                        if (last422 > 0 && now - last422 < 3000) {
                            if ((lastLogRef.current[`422_${sId}`] || 0) < Date.now() - 2000) {
                                console.log(`[SNIPER] ⏳ Item ${sId}: Aguardando 3s após 422 (penalidade).`);
                                lastLogRef.current[`422_${sId}`] = Date.now();
                            }
                            return;
                        }

                        const margin = Number(strat.decrementValue || 1);
                        const allow4 = strat.useFourDecimals || false;

                        // ⚡ Cooldown adaptativo: mínimo entre lances (v3.8.175 — reduzido de 1000/1500 para 500/1000, mutex protege)
                        const cooldown = (isKamikaze || isRetaFinal) ? 500 : 1000;
                        if (now - lastBid > cooldown) {
                            const currentBest = Number(item.valorAtual || 0);
                            const myCurrentBid = Number(item.meuValor || 999999999);
                            
                            // CALCULAR MARGEM OBRIGATÓRIA DO SERPRO
                            const officialMarginVal = Number(item.officialMargin || 0);
                            const officialMarginType = item.officialMarginType || 'V';
                            const mandatorySerproMargin = officialMarginType === 'P' ? currentBest * (officialMarginVal / 100) : officialMarginVal;
                            
                            // O limite máximo que o Serpro aceita
                            // 🔧 FIX v3.8.240: Se myCurrentBid é 0 (nunca bidou), não travar
                            const maxAllowedBidBySerpro = myCurrentBid > 0 ? myCurrentBid - mandatorySerproMargin : 999999999;
                            
                            let nextBid = 0;
                            // 🔧 FIX v3.8.127: Margem valida degrau do MEU lance, não desconta do concorrente
                            const beatingAmount = allow4 ? 0.0001 : 0.01;
                            const maxDecrement = Math.max(margin, mandatorySerproMargin);
                            const lowestAllowed = myCurrentBid - maxDecrement;
                            const serproLowestAllowed = myCurrentBid - mandatorySerproMargin; // Só margem Serpro (sem preferência do usuário)
                            const beatingBid = currentBest > 0 ? currentBest - beatingAmount : 0;
                            const candidateBid = Math.max(myMin, Math.min(beatingBid, serproLowestAllowed));
                            const isLeaderBeatable = currentBest > 0 && candidateBid < currentBest && candidateBid < myCurrentBid;

                            console.log(`[FRONTEND MARGEM] Item ${sId}: officialMarginVal=${officialMarginVal} type=${officialMarginType} mandatorySerproMargin=${mandatorySerproMargin.toFixed(4)} marginUser=${margin} maxDecrement=${maxDecrement} lowestAllowed=${lowestAllowed.toFixed(4)} serproLowestAllowed=${serproLowestAllowed.toFixed(4)} beatingBid=${beatingBid.toFixed(4)} candidateBid=${candidateBid.toFixed(4)} isLeaderBeatable=${isLeaderBeatable} currentBest=${currentBest} myCurrentBid=${myCurrentBid} myMin=${myMin}`);

                            if (isLeaderBeatable) {
                                nextBid = candidateBid;
                            } else {
                                // 📊 ESTRATÉGIA DE BRIGA POR POSIÇÃO INTERMEDIÁRIA INTELIGENTE (v4.0.0)
                                // Se o líder não é batível, procuramos no ranking o melhor concorrente (menor valor)
                                // que conseguimos bater respeitando o nosso mínimo (myMin).
                                let targetCompetitorBid = null;
                                
                                // 🛡️ GUARDA INTERMEDIÁRIO (v4.1.1): se acabamos de disparar um bid intermediário,
                                // aguardamos a propagação da API para não cobrir o próprio lance (tempo reduzido ou nulo na reta final/kamikaze)
                                const lastInter = getRecentIntermediateBid(item.itemId);
                                if (lastInter) {
                                    const currentDuration = lastInter.duration !== undefined ? lastInter.duration : 30000;
                                    if ((Date.now() - lastInter.timestamp) < currentDuration) {
                                        // 🔇 Throttle de log: só loga 1x por segundo por item para evitar spam no console
                                        const lastFreezeLog = lastLogRef.current[`freeze_${sId}`] || 0;
                                        if (Date.now() - lastFreezeLog >= 1000) {
                                            const elapsed = Math.round((Date.now() - lastInter.timestamp)/1000);
                                            console.debug(`[SNIPER] Aguardando propagação do bid intermediário de R$ ${lastInter.value} (${elapsed}s atrás). Congelado por ${currentDuration/1000}s.`);
                                            lastLogRef.current[`freeze_${sId}`] = Date.now();
                                        }
                                        return;
                                    }
                                }

                                if (item.rankingLances && item.rankingLances.length > 0) {
                                    // 🏆 COMPILADOR DE RANKING PARTICIPATIVO INTELIGENTE (v4.1.1)
                                    // Agrupa e consolida o ranking para identificar a nós mesmos ('__EU__') usando meuCurrentBid.
                                    // Usa buildRankingPorParticipante para consolidar por participante único.
                                    const { ranking: computedRanking } = buildRankingPorParticipante(item.rankingLances, myCurrentBid);

                                    // Filtra lances que não são nossos (excluindo __EU__ E qualquer valor == myCurrentBid
                                    // como proteção dupla caso a API não propague a flag eMeuLance a tempo)
                                    const myBidRounded = Math.floor(myCurrentBid * 100) / 100;
                                    const lastFiredValRounded = lastFired ? Math.floor(lastFired.value * 100) / 100 : null;

                                    const competitorBids = computedRanking
                                        .filter(r => r.participante !== '__EU__')
                                        .map(r => safeParseNumber(r.valor))
                                        .filter(val => {
                                            if (val <= 0) return false;
                                            // 🛡️ Proteção dupla: exclui valores iguais ao nosso lance atual ou ao recém-enviado
                                            const valRounded = Math.floor(val * 100) / 100;
                                            if (Math.abs(valRounded - myBidRounded) <= 0.001) return false;
                                            if (lastFiredValRounded !== null && Math.abs(valRounded - lastFiredValRounded) <= 0.001) return false;
                                            return true;
                                        })
                                        .sort((a, b) => a - b); // Ordena do menor (melhor posição) para o maior

                                    // 🔧 FIX v3.8.127: Margem valida degrau do MEU lance, não desconta do concorrente
                                    // Antes: competidor batível se cBid - margin >= myMin
                                    // Agora: se lowestAllowed < cBid (consigo ir abaixo dele) E beatingBid >= myMin
                                    for (const cBid of competitorBids) {
                                        const beatingBid = cBid - beatingAmount;
                                        const candidateBid = Math.max(myMin, Math.min(beatingBid, serproLowestAllowed));
                                        if (candidateBid < cBid && candidateBid < myCurrentBid) {
                                            targetCompetitorBid = cBid;
                                            break;
                                        }
                                    }
                                }

                                if (targetCompetitorBid !== null) {
                                    const idealBid = Math.max(myMin, Math.min(targetCompetitorBid - beatingAmount, serproLowestAllowed));
                                    
                                    // 🔧 FIX v3.8.131: Compara diretamente contra o limiar de batida do concorrente, não contra idealBid
                                    // (idealBid é limitado por lowestAllowed = myCurrentBid - maxDecrement, então myCurrentBid <= idealBid é quase sempre falso)
                                    const beatingThreshold = targetCompetitorBid - beatingAmount;
                                    if (myCurrentBid <= beatingThreshold) {
                                        const lastLogTime = lastLogRef.current[`pos_${sId}`] || 0;
                                        if (Date.now() - lastLogTime >= 1000) {
                                            console.log(`[SNIPER] Posição ideal já garantida. Mantendo R$ ${myCurrentBid} (Concorrente R$ ${targetCompetitorBid}).`);
                                            lastLogRef.current[`pos_${sId}`] = Date.now();
                                        }
                                        return;
                                    } else {
                                        nextBid = idealBid;
                                        console.log(`[SNIPER POSITIONING] Mirando concorrente R$ ${targetCompetitorBid}. nextBid=R$ ${nextBid} (beatingAmount=${beatingAmount}, lowestAllowed=R$ ${lowestAllowed})`);
                                    }
                                } else {
                                    // 🔧 FIX v3.8.242: Nenhum concorrente batível — preserva valor
                                    // Reduzir não adianta se todos estão abaixo do mínimo (só queima captcha)
                                    const lastNobeatLog = lastLogRef.current[`nobeat_${sId}`] || 0;
                                    if (Date.now() - lastNobeatLog >= 2000) {
                                        console.log(`[SNIPER] Nenhum concorrente batível (todos abaixo do mínimo R$ ${myMin}). Preservando R$ ${myCurrentBid}.`);
                                        lastLogRef.current[`nobeat_${sId}`] = Date.now();
                                    }
                                    return; // Sai sem disparar
                                }
                            }
                            
                            if (nextBid < myMin) nextBid = myMin;
                            nextBid = allow4 ? Math.floor(nextBid * 10000) / 10000 : Math.floor(nextBid * 100) / 100; // Floor para garantir q fica abaixo

                            if (nextBid > maxAllowedBidBySerpro) {
                                console.log(`[SNIPER] Lance bloqueado: R$ ${nextBid} viola margem Serpro (Máximo permitido: R$ ${maxAllowedBidBySerpro})`);
                            } else if (nextBid >= myCurrentBid) {
                                console.log(`[SNIPER] Lance bloqueado: R$ ${nextBid} não é melhor que seu último lance (R$ ${myCurrentBid}). Evitando erro 422.`);
                            } else if ((() => {
                                // 🔒 DEDUP TTL: bloqueia redisparo do mesmo valor por 15 segundos (ignora ciclo React)
                                const fired = getRecentFiredBid(item.itemId);
                                return fired && fired.value === nextBid && (Date.now() - fired.timestamp) < 15000;
                            })()) {
                                console.debug(`[SNIPER] Dedup TTL: R$ ${nextBid} já foi enviado para Item ${sId} há menos de 15s. Aguardando confirmação...`);
                            } else if (nextBid >= myMin) {
                                if (nextBid >= currentBest && currentBest > 0) {
                                    console.log(`%c[SNIPER] Líder imbatível (R$ ${currentBest}). Enviando lance intermediário de R$ ${nextBid} para brigar por posição!`, "color: #eab308; font-weight: bold;");
                                }
                                console.log(`%c🎯 [SNIPER] DISPARANDO LANCE: R$ ${nextBid} para Item ${sId}`, "color: #10b981; font-weight: bold;");
                                
                                toast.success(`Sniper Disparando R$ ${nextBid} no Item ${sId}`, {
                                    position: "bottom-right",
                                    autoClose: 3000
                                });

                                // Notifica no painel de mensagens
                                setChatMessages(prev => [...prev, {
                                    id: Date.now(),
                                    sender: 'SISTEMA',
                                    text: `[SNIPER] Disparando Lance Automático: R$ ${nextBid} no Item ${sId}`,
                                    timestamp: new Date().toLocaleTimeString()
                                }]);

                                // 🔒 Grava o lock TTL ANTES de enviar para bloquear reenvios imediatos
                                const lockSessionId = itemSid || sessionId;
                                lastFiredBidRef.current[`${lockSessionId}_${item.itemId}`] = { value: nextBid, timestamp: Date.now() };
                                // 🛡️ Se este é um lance intermediário (líder imbatível), congela o item por 30s
                                if (!isLeaderBeatable) {
                                    const freezeDuration = (isKamikaze || currentTimeLeft <= 15 || isRetaFinal) ? 0 : 30000;
                                    lastIntermediateBidRef.current[`${lockSessionId}_${item.itemId}`] = { value: nextBid, timestamp: Date.now(), duration: freezeDuration };
                                }
                                handleSendBid(item.purchaseId, sId, item.bidId, nextBid, isKamikaze, allow4);
                                
                                const nowUpdate = Date.now();
                                lastBidTimesRef.current[sId] = nowUpdate;
                                setLastAutoBidTimes(prev => ({ ...prev, [sId]: nowUpdate }));
                            }
                        }
                    }
                }
            });
        }, 20); // ⚡ Loop ultra-rápido de 20ms (v3.8.141 — cenário agressivo)

        return () => clearInterval(autoBidInterval);
    }, [isListening, sessionId]);



    // Helper para obter a configuração de itens de uma sessão específica
    const getSessionItemsConfig = (sid: string) => {
        const config: Record<string, any> = {};
        Object.entries(itemStrategies).forEach(([key, val]) => {
            if (key.startsWith(`${sid}_`)) {
                const itemId = key.replace(`${sid}_`, '');
                config[itemId] = val;
            }
        });
        return config;
    };

    // Helper para buscar a estratégia de um item específico de uma sessão específica
    const getStrategy = (sid: string | null, itemId: string) => {
        if (!sid) return {};
        return itemStrategies[`${sid}_${itemId}`] || {};
    };

    // Helper para mapear um purchaseId para um sessionId
    const findSessionIdByPurchaseId = (purchaseId: string) => {
        for (const sid of Object.keys(sessions)) {
            if (sid.includes(purchaseId)) return sid;
            const s = sessions[sid];
            if (s) {
                const mod = s.modality === '05' || s.modality === 'PREGAO' ? '05' : '06';
                const num = String(s.numero || '').replace(/\D/g, '').padStart(5, '0');
                const yr = String(s.ano || '').replace(/\D/g, '').slice(-4);
                const targetPid = `${s.uasg}${mod}${num}${yr}`;
                if (targetPid === purchaseId) return sid;
            }
        }
        return sessionId;
    };

    // [MODO SIGA v3.2] VIEW STATE
    const [viewMode, setViewMode] = useState<'card' | 'grid'>('grid');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [modalityTab, setModalityTab] = useState<'PREGAO' | 'DISPENSA'>('DISPENSA');

    // --- MONITOR DE ATUALIZAÇÃO v3.5.37 ---
    const [updateInfo, setUpdateInfo] = useState<any>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isUpdateReady, setIsUpdateReady] = useState(false); // true quando download concluído
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

    const handleManualBid = (purchaseId: string, itemId: string, bidId: string, value: number) => {
        handleSendBid(purchaseId, itemId, bidId, value);
        toast.info(`🚀 Gatilho Disparado: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    };

    const handleSendBid = (purchaseId: string, itemId: string, bidId: string, value: number, isKamikaze: boolean = false, allow4: boolean = false) => {
        const sid = findSessionIdByPurchaseId(purchaseId);
        const strat = getStrategy(sid, itemId);
        const myMin = Number(strat.minPrice || 0);

        if (myMin > 0 && value < myMin) {
            console.warn(`[POLARYON SHIELD] Lance de R$ ${value} bloqueado para o Item ${itemId}. É inferior ao mínimo configurado (R$ ${myMin})!`);
            toast.error(`TRAVA PRIMORDIAL: Lance de R$ ${value} no Item ${itemId} violou o limite mínimo de R$ ${myMin}!`);
            return;
        }

        // 🔥 Grava o lock TTL do lance de forma global (evita múltiplos disparos manuais e automáticos)
        const activeSid = sid || sessionId;
        // Salva o valor anterior antes do optimistic update para poder reverter em caso de falha
        const prevItem = Array.isArray(itemsRef.current) ? itemsRef.current.find(it => String(it.itemId) === String(itemId)) : null;
        const prevMeuValor = prevItem ? prevItem.meuValor : null;
        if (activeSid) {
            lastFiredBidRef.current[`${activeSid}_${itemId}`] = { value, timestamp: Date.now(), previousValue: prevMeuValor };
        } else {
            lastFiredBidRef.current[itemId] = { value, timestamp: Date.now(), previousValue: prevMeuValor };
        }

        // 🔥 ATUALIZAÇÃO OTIMISTA IMEDIATA (v3.8.56): Evita múltiplos disparos do mesmo valor e erros 422 em tempo real
        if (activeSid) {
            // Atualiza a referência em tempo real do sniper instantaneamente
            if (Array.isArray(itemsRef.current)) {
                itemsRef.current = itemsRef.current.map((it) => {
                    if (String(it.itemId) === String(itemId)) {
                        const isNewBest = value <= Number(it.valorAtual || 99999999);
                        const nextPos = (simulationMode || isNewBest) ? "1" : it.posicao;
                        const nextGanhador = (simulationMode || isNewBest) ? "Você" : it.ganhador;
                        return {
                            ...it,
                            meuValor: value,
                            valorAtual: simulationMode ? value : Math.min(Number(it.valorAtual || 99999999), value),
                            posicao: nextPos,
                            ganhador: nextGanhador
                        };
                    }
                    return it;
                });
            }
            setSessions(prev => {
                const updated = { ...prev };
                if (updated[activeSid]) {
                    updated[activeSid].items = updated[activeSid].items.map((it: any) => {
                        if (String(it.itemId) === String(itemId)) {
                            const isNewBest = value <= Number(it.valorAtual || 99999999);
                            const nextPos = (simulationMode || isNewBest) ? "1" : it.posicao;
                            const nextGanhador = (simulationMode || isNewBest) ? "Você" : it.ganhador;
                            return {
                                ...it,
                                meuValor: value,
                                valorAtual: simulationMode ? value : Math.min(Number(it.valorAtual || 99999999), value),
                                posicao: nextPos,
                                ganhador: nextGanhador
                            };
                        }
                        return it;
                    });
                }
                return updated;
            });

            setItems(prev => {
                return prev.map(it => {
                    if (String(it.itemId) === String(itemId)) {
                        const isNewBest = value <= Number(it.valorAtual || 99999999);
                        const nextPos = (simulationMode || isNewBest) ? "1" : it.posicao;
                        const nextGanhador = (simulationMode || isNewBest) ? "Você" : it.ganhador;
                        return {
                            ...it,
                            meuValor: value,
                            valorAtual: simulationMode ? value : Math.min(Number(it.valorAtual || 99999999), value),
                            posicao: nextPos,
                            ganhador: nextGanhador
                        };
                    }
                    return it;
                });
            });

            if (simulationMode) {
                toast.success(`🎯 Sniper Atirou! R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: allow4 ? 4 : 2 })} enviado na simulação.`);
            }
        }

        if (isDesktop && (window as any).electronAPI) {
            (window as any).electronAPI.manualBid(purchaseId, itemId, bidId, value, { isKamikaze, allow4 });
        }
    };

    const quickBid = async (itemId: string, value: number, sid?: string) => {
        const targetSid = sid || sessionId;
        if (!targetSid || targetSid === 'undefined' || !itemId || itemId === 'undefined') {
            console.warn("[QUICK BID] Aborting due to invalid identifiers:", { targetSid, itemId });
            return;
        }
        try {
            toast.info(`Enviando lance R$ ${value.toFixed(2)}...`);
            const isLocalSession = targetSid.startsWith('virtual_') || targetSid.startsWith('HYBRID_') || targetSid.startsWith('GLOBAL_');
            if (!isLocalSession) {
                await api.post(`/bidding/sessions/${targetSid}/items/${itemId}/bid`, { value });
            }
        } catch (error) {
            console.error("Quick bid failed:", error);
            toast.error("Falha ao enviar lance rápido.");
        }
    };

    const dummyCredentialId = 'simulated-credential-id';

    const openPortalLogin = async () => {
        if (isDesktop && (window as any).electronAPI) {
            try {
                const res = await api.post('/bidding/sessions', {
                    credentialId: dummyCredentialId,
                    portal: 'compras_gov',
                    uasg: 'LOGIN',
                    numeroPregao: 'PORTAL',
                    anoPregao: new Date().getFullYear().toString()
                });

                if (res.data.success) {
                    const session = res.data.session;
                    setSessionId(session.id);
                    
                    (window as any).electronAPI.startVisualBidding({
                        sessionId: session.id,
                        uasg: 'LOGIN',
                        numero: 'PORTAL',
                        ano: new Date().getFullYear().toString(),
                        vault: {
                            simulationMode,
                            itemsConfig: getSessionItemsConfig(session.id)
                        },
                        modality: 'LOGIN_FLOW'
                    });
                    
                    setIsLocalRunning(true);
                    setIsListening(true);
                    toast.success("Abrindo Portal Compras.gov.br... Utilize seu Certificado Digital. 🔐");
                }
            } catch (error) {
                console.error("Failed to open portal:", error);
                toast.error("Erro ao abrir o portal de compras.");
            }
        } else {
            toast.warning("O login via Certificado Digital requer o Polaryon Desktop.");
        }
    };

    // v2.0 War Flow - Unified Item List (v3.6.14)
    const allItems = useMemo(() => {
        // Agrupamento por ID de Compra para evitar duplicidade visual
        const uniqueItems = new Map<string, (BiddingItem & { sid: string, uasgName: string })>();
        
        Object.entries(sessions).forEach(([sid, session]) => {
            if (!session) return;
            const sessionItems = Array.isArray(session.items) ? session.items : [];
            sessionItems.forEach(item => {
                if (!item) return;
                // Chave única: uasg + item
                const key = `${session.uasg}_${item.itemId}`;
                if (!uniqueItems.has(key) || (item.timerSeconds && item.timerSeconds > 0)) {
                    uniqueItems.set(key, { ...item, sid, uasgName: session.sessionTitle || session.uasg || '---' });
                }
            });
        });

        const list = Array.from(uniqueItems.values());

        // Ordenação inteligente: Perdedores e Urgentes primeiro
        return list.sort((a, b) => {
            const aMeuValor = safeParseNumber(a.meuValor);
            const aValorAtual = safeParseNumber(a.valorAtual);
            const aPos = String(a.posicao || '').toUpperCase().trim();
            const aIsWinning = !(aMeuValor > 0 && aValorAtual > 0 && aMeuValor > aValorAtual) && (
                a.ganhador === 'Você' || aPos === '1' || aPos === '1º' || aPos === '1°' || aPos === 'G' || aPos === 'V' || aPos === 'GANHANDO' || aPos === 'VENCEDOR'
            );
            
            const bMeuValor = safeParseNumber(b.meuValor);
            const bValorAtual = safeParseNumber(b.valorAtual);
            const bPos = String(b.posicao || '').toUpperCase().trim();
            const bIsWinning = !(bMeuValor > 0 && bValorAtual > 0 && bMeuValor > bValorAtual) && (
                b.ganhador === 'Você' || bPos === '1' || bPos === '1º' || bPos === '1°' || bPos === 'G' || bPos === 'V' || bPos === 'GANHANDO' || bPos === 'VENCEDOR'
            );
            
            if (!aIsWinning && bIsWinning) return -1;
            if (aIsWinning && !bIsWinning) return 1;
            
            return (a.timerSeconds || 9999) - (b.timerSeconds || 9999);
        });
    }, [sessions]);

    const stopRadar = async () => {
        if (!sessionId) return;
        try {
            if (isLocalRunning && (window as any).electronAPI) {
                (window as any).electronAPI.stopVisualBidding(sessionId);
                setIsLocalRunning(false);
            } else {
                await api.post(`/bidding/sessions/${sessionId}/stop`);
                if (socketService) {
                    socketService.emit('leave_bidding_room', sessionId);
                }
            }
            setIsListening(false);
            setSessionId(null);
        } catch (error) {
            console.error("Failed to stop radar:", error);
        }
    };

    const focusBiddingWindow = () => {
        if (isDesktop && (window as any).electronAPI && sessionId) {
            (window as any).electronAPI.focusVisualBidding(sessionId);
        }
    };

    useEffect(() => {
        const syncVault = async () => {
            try {
                const profileRes = await api.get('/kanban/main-companies');
                const defaultCompany = profileRes.data.find((p: any) => p.isDefault) || profileRes.data[0];
                if (defaultCompany) {
                    await fetchVaultCredentials(defaultCompany.id);
                }
            } catch (e) {
                console.error("Failed to sync vault", e);
            }
        };
        syncVault();
    }, [fetchVaultCredentials]);

    useEffect(() => {
        if (credentials.length > 0 && !selectedCredentialId) {
            setSelectedCredentialId(credentials[0].id);
        }
    }, [credentials, selectedCredentialId]);

    useEffect(() => {
        const uasgParam = searchParams.get('uasg');
        const numeroParam = searchParams.get('numero');
        const anoParam = searchParams.get('ano');
        const autoStart = searchParams.get('autoStart') === 'true';

        if (uasgParam) setUasg(uasgParam);
        if (numeroParam) setNumeroPregao(numeroParam);
        if (anoParam) setAnoPregao(anoParam);
        
        if (uasgParam && numeroParam) {
            if (autoStart && isDesktop) {
                 import('sonner').then(({ toast }) => toast.success("Auto-Iniciando Máquina de Lances..."));
                 setTimeout(() => {
                     startRadar(uasgParam, numeroParam, anoParam || new Date().getFullYear().toString());
                 }, 500);
            }
        }
    }, [searchParams]);

    // ELECTRON LOCAL RUNNER LISTENER
    useEffect(() => {
        if (isDesktop && (window as any).electronAPI) {
            const handleUpdate = (data: any) => {
                const { sessionId: sid, items: newItems, timestamp } = data;
                if (data.serverOffset !== undefined) setServerOffset(data.serverOffset);
                // 🏠 Backend RoomRunner ativo? Se sim, frontend sniper não precisa disparar (v3.8.175)
                if (data.backendActive) {
                    backendActiveRef.current = true;
                } else {
                    backendActiveRef.current = false;
                }
                if (newItems?.length > 0) {
                    console.log(`[BIDDING UPDATE] sid=${sid} items=${newItems.length} serverOffset=${data.serverOffset}`);
                    console.log(`[BIDDING UPDATE] first item: id=${newItems[0].itemId} dhfc=${newItems[0].dataHoraFimContagem} timer=${newItems[0].timerSeconds}`);
                }
                if (data.log) {
                    setTrafficLogs(prev => [`[${new Date().toLocaleTimeString()}] ${data.log}`, ...prev].slice(0, 50));
                }


                setSessions(prev => {
                    const updated = { ...prev };
                    const sessionData = updated[sid] || {};
                    
                    // Lógica de Fusão de Itens: Mantém apenas itens únicos por itemId
                    const existingItems = sessionData.items || [];
                    const itemMap = new Map(existingItems.map((it: any) => [it.itemId, it]));
                    
                    (newItems || []).forEach((it: any) => {
                        const existing = itemMap.get(it.itemId) || {};
                        // 🔒 PROTEÇÃO: Nunca apaga rankingLances ou posicao real já adquiridos com uma atualização vazia
                        const mergedRanking = (it.rankingLances && it.rankingLances.length > 0)
                            ? it.rankingLances
                            : (existing.rankingLances || []);

                        // 🛡️ Proteção contra regressão do lance otimista devido ao lag de rede do portal
                        let mergedMeuValor = it.meuValor;
                        let mergedValorAtual = it.valorAtual;
                        let mergedPosicao = it.posicao || existing.posicao;
                        let mergedGanhador = it.ganhador;

                        const lastFired = getRecentFiredBid(it.itemId);
                        if (lastFired && (Date.now() - lastFired.timestamp) < 3000) {
                            // 🛡️ Override otimista só nos primeiros 3s (se >3s, API já respondeu → lance falhou)
                            if (!it.meuValor || it.meuValor > lastFired.value) {
                                mergedMeuValor = lastFired.value;
                            }
                            if (!it.valorAtual || it.valorAtual > lastFired.value) {
                                mergedValorAtual = lastFired.value;
                            }
                        }

                        // --- CÁLCULO E VALIDAÇÃO MATEMÁTICA DO RANKING / POSIÇÃO (v4.2.0) ---
                        if (mergedRanking && mergedRanking.length > 0) {
                            const { minhaPosicao } = buildRankingPorParticipante(mergedRanking, mergedMeuValor);
                            if (minhaPosicao > 0) {
                                mergedPosicao = String(minhaPosicao);
                            }
                        }

                        // --- CORREÇÃO E ENFORCEMENT DE FALSOS POSITIVOS (v4.2.0) ---
                        if (mergedMeuValor > 0 && mergedValorAtual > 0 && mergedMeuValor > mergedValorAtual) {
                            const mergedPosNorm = String(mergedPosicao || '').toUpperCase().trim();
                            if (mergedPosNorm === '1' || mergedPosNorm === '1º' || mergedPosNorm === '1°' || mergedPosNorm === 'G' || mergedPosNorm === 'V' || mergedPosNorm === 'GANHANDO' || mergedPosNorm === 'VENCEDOR' || mergedGanhador === 'Você') {
                                const portalPos = String(it.posicao || '').toUpperCase().trim();
                                const isPortalPosWinning = portalPos === '1' || portalPos === '1º' || portalPos === '1°' || portalPos === 'G' || portalPos === 'V' || portalPos === 'GANHANDO' || portalPos === 'VENCEDOR';
                                mergedPosicao = (!isPortalPosWinning && portalPos) ? portalPos : '2';
                                mergedGanhador = 'Outro';
                            }
                        } else if (mergedMeuValor > 0 && mergedValorAtual > 0 && mergedMeuValor <= mergedValorAtual) {
                            mergedPosicao = '1';
                            mergedGanhador = 'Você';
                        }

                        itemMap.set(it.itemId, { 
                            ...existing, 
                            ...it, 
                            isGroup: it.isGroup !== undefined ? it.isGroup : existing.isGroup,
                            isGroupItem: it.isGroupItem !== undefined ? it.isGroupItem : existing.isGroupItem,
                            parentGroupId: it.parentGroupId !== undefined ? it.parentGroupId : existing.parentGroupId,
                            portalTimer: existing.portalTimer,
                            portalDataHoraFimContagem: existing.portalDataHoraFimContagem,
                            updatedAt: existing.updatedAt,
                            sid, 
                            meuValor: mergedMeuValor,
                            valorAtual: mergedValorAtual,
                            rankingLances: mergedRanking, 
                            posicao: mergedPosicao,
                            ganhador: mergedGanhador
                        });
                    });

                    updated[sid] = {
                        ...sessionData,
                        items: Array.from(itemMap.values()),
                        lastUpdate: timestamp,
                        uasg: data.uasg || sessionData.uasg || '---',
                        numero: data.numero !== '---' ? data.numero : (sessionData.numero || '---'),
                        ano: data.ano !== '---' ? data.ano : (sessionData.ano || '---'),
                        sessionTitle: data.sessionTitle || sessionData.sessionTitle || ''
                    };

                    // 🔥 FUSÃO AGRESSIVA (v3.6.15) — só apaga salas vazias/duplicadas
                    if (data.uasg && data.uasg !== 'LOGIN') {
                        Object.keys(updated).forEach(k => {
                            if (k !== sid && (updated[k].uasg === 'LOGIN' || updated[k].uasg === data.uasg)) {
                                // Só deleta se a sala estiver sem itens (evita loop criar/deletar com virtual_)
                                if (!updated[k].items?.length) {
                                    delete updated[k];
                                }
                            }
                        });
                    }
                    
                    // 🧹 DEDUP virtual → GLOBAL: se backend criou sessão real, funde virtual nela e deleta
                    if (sid && sid.startsWith('GLOBAL_')) {
                        const compraId = sid.replace('GLOBAL_', '');
                        const virtualSid = `virtual_${compraId}`;
                        if (updated[virtualSid] && updated[virtualSid].items?.length > 0) {
                            const virtualItems = updated[virtualSid].items || [];
                            const realItems = updated[sid].items || [];
                            const realItemMap = new Map(realItems.map((it: any) => [it.itemId, it]));
                            virtualItems.forEach((vit: any) => {
                                if (!realItemMap.has(vit.itemId)) {
                                    realItemMap.set(vit.itemId, vit);
                                }
                            });
                            updated[sid].items = Array.from(realItemMap.values());
                            delete updated[virtualSid];
                            console.log(`[DEDUP VIRTUAL] Fundido virtual_${compraId} → ${sid} (${virtualItems.length} itens)`);
                        }
                    }

                    return updated;
                });
            };
            
            const handleChat = (data: any) => {
                const { sessionId: sid, messages } = data;
                if (sid === sessionId) {
                    setChatMessages(messages || []);
                }
                setSessions(prev => ({
                    ...prev,
                    [sid]: {
                        ...(prev[sid] || {}),
                        chatMessages: Array.isArray(messages) ? messages : []
                    }
                }));
            };
            
            const handlePortalSync = (data: any) => {
                // 🕒 Server time via WebSocket /topic/dataHoraBrasilia (v3.8.89)
                if (data.type === 'server-time') {
                    console.log(`[SERVER TIME] WebSocket dataHoraBrasilia=${new Date(data.serverTimeMs).toISOString()}`);
                    serverTimeMsRef.current = data.serverTimeMs;
                    serverTimeReceivedAtRef.current = data.serverTimeReceivedAt;
                    if (data.clockSkew !== undefined && Math.abs(data.clockSkew) > 0.1) {
                        clockSkewRef.current = data.clockSkew;
                        console.log(`[CLOCK SKEW WS] set=${data.clockSkew.toFixed(3)}s`);
                    }
                    return;
                }
                // 🕒 Timer em tempo real vindo do DOM (injetor lê a cada 100ms)
                if (data.type === 'siga-timer') {
                    setSigaTimerSeconds(data.sigaTimerSeconds);
                    const now = Date.now();
                    setSigaTimerReceivedAt(now);
                    sigaTimerSecondsRef.current = data.sigaTimerSeconds;
                    sigaTimerReceivedAtRef.current = now;
                    return;
                }
                const { roomCode, items: newItems, timestamp, sigaTimerSeconds } = data;
                
                console.log(`[PORTAL SYNC] room=${roomCode} items=${newItems?.length} sigaTimer=${sigaTimerSeconds} serverOffset=${data.serverOffset} clockSkew=${data.clockSkew?.toFixed(2) || 'N/A'}`);
                if (newItems?.length > 0) {
                    console.log(`[PORTAL SYNC] first item: id=${newItems[0].itemId} dhfc=${newItems[0].dataHoraFimContagem} timer=${newItems[0].timerSeconds}`);
                }
                // 🕒 ClockSkew do preload (já suavizado com EMA 0.85/0.15 lá) — usa direto, sem suavização extra
                if (data.clockSkew !== undefined && Math.abs(data.clockSkew) > 0.1) {
                    clockSkewRef.current = data.clockSkew;
                    console.log(`[CLOCK SKEW] set=${data.clockSkew.toFixed(3)}s`);
                }
                if (sigaTimerSeconds !== undefined) {
                    setSigaTimerSeconds(sigaTimerSeconds);
                    const now = Date.now();
                    setSigaTimerReceivedAt(now);
                    sigaTimerSecondsRef.current = sigaTimerSeconds;
                    sigaTimerReceivedAtRef.current = now;
                }
                setIsAuthenticated(true);
                
                setSessions(prev => {
                    const updated = { ...prev };
                    // Procura uma sessão que tenha o UASG/Número batendo com o roomCode
                    let sid = Object.keys(updated).find(k => {
                        const s = updated[k];
                        const code = `${s.uasg}05${String(s.numero).padStart(5, '0')}${s.ano}`;
                        const codeAlt = `${s.uasg}06${String(s.numero).padStart(5, '0')}${s.ano}`;
                        return roomCode === code || roomCode === codeAlt;
                    });

                    // 🛠️ CRIAÇÃO VIRTUAL: Se a sala não existe, cria ela na hora!
                    // Mas primeiro verifica se já existe sessão GLOBAL_ com mesmo compraId (evita duplicatas)
                    if (!sid) {
                        const globalSid = `GLOBAL_${roomCode}`;
                        if (updated[globalSid]) {
                            sid = globalSid;
                        } else {
                            sid = `virtual_${roomCode}`;
                            updated[sid] = {
                                uasg: roomCode.substring(0, 6),
                                numero: parseInt(roomCode.substring(8, 13)),
                                ano: roomCode.substring(13, 17),
                                items: [],
                                sessionTitle: `SALA DETECTADA: ${parseInt(roomCode.substring(8, 13))}/${roomCode.substring(13, 17)}`,
                                lastUpdate: timestamp
                            };
                        }
                    }

                    if (sid) {
                        const sessionData = updated[sid];
                        const existingItems = sessionData.items || [];
                        const itemMap = new Map(existingItems.map((it: any) => [String(it.id || it.itemId), it]));
                        
                        (newItems || []).forEach((it: any) => {
                            const key = String(it.itemId);
                            const existing = itemMap.get(key) || {};
                            // 🔒 PROTEÇÃO: Preserva rankingLances e posicao se novo item não trouxer dados de ranking
                            const mergedRanking = (it.rankingLances && it.rankingLances.length > 0)
                                ? it.rankingLances
                                : (existing.rankingLances || []);

                            // 🛡️ Proteção contra regressão do lance otimista devido ao lag de rede do portal
                            let mergedMeuValor = it.meuValor;
                            let mergedValorAtual = it.valorAtual;
                            let mergedPosicao = (it.rankingLances && it.rankingLances.length > 0)
                                ? it.posicao
                                : (existing.posicao || it.posicao);
                            let mergedGanhador = it.ganhador;

                            const lastFired = getRecentFiredBid(it.itemId);
                            if (lastFired) {
                                if (!it.meuValor || it.meuValor > lastFired.value) {
                                    mergedMeuValor = lastFired.value;
                                }
                                if (!it.valorAtual || it.valorAtual > lastFired.value) {
                                    mergedValorAtual = lastFired.value;
                                }
                            }

                            // --- CÁLCULO E VALIDAÇÃO MATEMÁTICA DO RANKING / POSIÇÃO (v4.2.0) ---
                            if (mergedRanking && mergedRanking.length > 0) {
                                const { minhaPosicao } = buildRankingPorParticipante(mergedRanking, mergedMeuValor);
                                if (minhaPosicao > 0) {
                                    mergedPosicao = String(minhaPosicao);
                                }
                            }

                            // --- CORREÇÃO E ENFORCEMENT DE FALSOS POSITIVOS (v4.2.0) ---
                            if (mergedMeuValor > 0 && mergedValorAtual > 0 && mergedMeuValor > mergedValorAtual) {
                                const mergedPosNorm = String(mergedPosicao || '').toUpperCase().trim();
                                if (mergedPosNorm === '1' || mergedPosNorm === '1º' || mergedPosNorm === '1°' || mergedPosNorm === 'G' || mergedPosNorm === 'V' || mergedPosNorm === 'GANHANDO' || mergedPosNorm === 'VENCEDOR' || mergedGanhador === 'Você') {
                                    const portalPos = String(it.posicao || '').toUpperCase().trim();
                                    const isPortalPosWinning = portalPos === '1' || portalPos === '1º' || portalPos === '1°' || portalPos === 'G' || portalPos === 'V' || portalPos === 'GANHANDO' || portalPos === 'VENCEDOR';
                                    mergedPosicao = (!isPortalPosWinning && portalPos) ? portalPos : '2';
                                    mergedGanhador = 'Outro';
                                }
                            } else if (mergedMeuValor > 0 && mergedValorAtual > 0 && mergedMeuValor <= mergedValorAtual) {
                                mergedPosicao = '1';
                                mergedGanhador = 'Você';
                            }

                            // 🕒 Preserva timer do portal-preload e timestamp de quando foi recebido
                            const portalTimer = it.timerSeconds !== undefined ? it.timerSeconds : existing.portalTimer;
                            const portalDataHoraFimContagem = it.dataHoraFimContagem || existing.portalDataHoraFimContagem;
                            const updatedAt = timestamp || Date.now();

                            itemMap.set(key, { 
                                ...existing, 
                                ...it, 
                                isGroup: it.isGroup !== undefined ? it.isGroup : existing.isGroup,
                                isGroupItem: it.isGroupItem !== undefined ? it.isGroupItem : existing.isGroupItem,
                                parentGroupId: it.parentGroupId !== undefined ? it.parentGroupId : existing.parentGroupId,
                                portalTimer,
                                portalDataHoraFimContagem,
                                updatedAt,
                                sid, 
                                meuValor: mergedMeuValor,
                                valorAtual: mergedValorAtual,
                                rankingLances: mergedRanking, 
                                posicao: mergedPosicao, 
                                ganhador: mergedGanhador,
                                id: key 
                            });
                        });

                        const allItems = Array.from(itemMap.values());
                        // Propagar timer do grupo para sub-itens (se não tiverem próprio)
                        const grpTimer = allItems.find((i: any) => i.isGroup)?.dataHoraFimContagem;
                        if (grpTimer) {
                            allItems.forEach((i: any) => {
                                if (i.isGroupItem && !i.dataHoraFimContagem) {
                                    i.dataHoraFimContagem = grpTimer;
                                }
                            });
                        }
                        updated[sid] = {
                            ...sessionData,
                            items: allItems,
                            lastUpdate: timestamp,
                            syncStatus: 'PORTAL_DIRECT'
                        };

                        // 🔥 AUTO-IGNIÇÃO: Força o foco na sala detectada
                        if (!isListening || sessionId !== sid) {
                            setSessionId(sid);
                            setIsListening(true);
                            setItems(Array.from(itemMap.values()));
                        }
                    }
                    return updated;
                });
            };

            const unsubs = [];
            unsubs.push((window as any).electronAPI.onBiddingUpdate(handleUpdate));
            unsubs.push((window as any).electronAPI.onBiddingChat(handleChat));
            
            if ((window as any).electronAPI.onBiddingError) {
                unsubs.push((window as any).electronAPI.onBiddingError((data: any) => {
                    const { sessionId: errSid, error, code, action } = data;
                    if (action === 'REQUIRE_REAUTH') {
                        setIsAuthenticated(false);
                        setIsListening(false);
                        toast.error(`⚠️ Queda de Sessão (Cod: ${code}): O token expirou ou falhou. Clique em "Continuar com Gov.br" para reconectar.`, { duration: 10000 });
                    } else {
                        toast.error(`[POLARYON MOTOR] ${error}`);
                    }
                }));
            }

            if ((window as any).electronAPI.onPortalDataUpdate) {
                unsubs.push((window as any).electronAPI.onPortalDataUpdate(handlePortalSync));
            }

            if ((window as any).electronAPI.onBiddingNetworkTraffic) {
                unsubs.push((window as any).electronAPI.onBiddingNetworkTraffic((data: any) => {
                    setNetworkTraffic(prev => [data, ...(prev || [])].slice(0, 50));
                }));
            }

            // ⚡ RAIO DIRETO: atualiza display instantâneo sem React state batching
            if ((window as any).electronAPI.onWsFastBid) {
                unsubs.push((window as any).electronAPI.onWsFastBid((data: any) => {
                    if (!data || !data.codigo || !Array.isArray(data.items)) return;
                    const { codigo, items } = data;
                    const updated = { ...wsFastBidsRef.current };
                    for (const item of items) {
                        const key = `${codigo}_${item.itemId}`;
                        updated[key] = {
                            meuValor: item.meuValor,
                            valorAtual: item.valorAtual,
                            posicao: item.posicao,
                            ganhador: item.ganhador
                        };
                    }
                    wsFastBidsRef.current = updated;
                }));
            }

            if ((window as any).electronAPI.onBidFailed) {
                unsubs.push((window as any).electronAPI.onBidFailed((data: any) => {
                    if (!data || !data.itemId) return;
                    const { itemId, value, reason, status } = data;
                    console.warn(`[BID FAILED] 🚫 Lance R$ ${value} do Item ${itemId} rejeitado (${reason || status || 422}). Revertendo optimistic update.`);
                    if (status === 422 || reason === 'min_interval') {
                        last422PenaltyRef.current[String(itemId)] = Date.now();
                        console.warn(`[BID FAILED] ⏳ Penalidade de 3s ativada para Item ${itemId} (422).`);
                    }
                    const activeSid = sessionIdRef.current;
                    if (activeSid) {
                        const now = Date.now();
                        const firedKey1 = `${activeSid}_${itemId}`;
                        const firedKey2 = itemId;
                        if (lastFiredBidRef.current[firedKey1]?.value === value) {
                            delete lastFiredBidRef.current[firedKey1];
                        }
                        if (lastFiredBidRef.current[firedKey2]?.value === value) {
                            delete lastFiredBidRef.current[firedKey2];
                        }
                        // Restaura o valor anterior (ou null se não houver) para evitar que o sniper dispare myMin
                        const prevVal = lastFiredBidRef.current[firedKey1]?.previousValue
                            ?? lastFiredBidRef.current[firedKey2]?.previousValue
                            ?? null;
                        setSessions(prev => {
                            const updated = { ...prev };
                            if (updated[activeSid]) {
                                updated[activeSid].items = updated[activeSid].items.map((it: any) => {
                                    if (String(it.itemId) === String(itemId) && it.meuValor === value) {
                                        return { ...it, meuValor: prevVal, posicao: null, ganhador: null };
                                    }
                                    return it;
                                });
                            }
                            return updated;
                        });
                        setItems(prev => prev.map(it => {
                            if (String(it.itemId) === String(itemId) && it.meuValor === value) {
                                return { ...it, meuValor: prevVal, posicao: null, ganhador: null };
                            }
                            return it;
                        }));
                    }
                }));
            }

            if ((window as any).electronAPI.onBiddingDetectedRoom) {
                unsubs.push((window as any).electronAPI.onBiddingDetectedRoom((data: any) => {
                    const { url } = data;
                    const match = url.match(/compra=(\d{6})06(\d{5})(\d{4})/);
                    if (match) {
                        const [, detectedUasg, detectedNum, detectedAno] = match;
                        setUasg(detectedUasg);
                        setNumeroPregao(detectedNum);
                        setAnoPregao(detectedAno);
                        toast.success(`Sala Detectada: UASG ${detectedUasg} - Pregão ${detectedNum}. Sincronizando... ⚡`);
                    }
                }));
            }

            if ((window as any).electronAPI.onBiddingLoginFinished) {
                unsubs.push((window as any).electronAPI.onBiddingLoginFinished(() => {
                    toast.success("Login confirmado! Ocultando janela e iniciando radar silencioso... 🛡️");
                    setIsListening(true);
                    setIsAuthenticated(true);
                }));
            }

            if ((window as any).electronAPI.onBiddingHybridDump) {
                unsubs.push((window as any).electronAPI.onBiddingHybridDump((pkg: any) => {
                    const payload = pkg.data || {};
                    if (pkg.action === 'TOKEN_GRABBED') {
                         console.log("%c[POLARYON HYBRID] TOKEN CAPTURADO: ", "color: yellow; font-size: 14px; font-weight: bold;", payload.token);
                         import('sonner').then(({ toast }) => toast.warning("Radar Híbrido: Conexão Oculta Estabelecida! 🤫"));
                    } else if (pkg.action === 'HYBRID_API_RESULTS') {
                         const hybridItems = Array.isArray(payload.items) ? payload.items : [];
                         if (hybridItems.length > 0) {
                             const newSessions: Record<string, any> = {};
                             hybridItems.forEach((item: any) => {
                                 if (!item) return;
                                 const fullId = String(item.polaryon_purchaseId || '');
                                 const uasgCode = fullId.length === 17 ? fullId.substring(0, 6) : (item.uasg || item.codigoUasg || 'SISTEMA');
                                 const num = fullId.length === 17 ? parseInt(fullId.substring(8, 13), 10).toString() : (item.numeroCompra || item.numero || '0');
                                 const ano = item.polaryon_year || item.anoCompra || item.ano || '2026';
                                 const sid = `HYBRID_${uasgCode}_${num}_${ano}`;
                                 
                                 if (!newSessions[sid]) {
                                     newSessions[sid] = { 
                                          uasg: uasgCode, 
                                          numero: num, 
                                          items: [], 
                                          chatMessages: [], 
                                          lastUpdate: new Date().toLocaleTimeString(), 
                                          isAuthenticated: true, 
                                          simulationMode: true, 
                                          isHybrid: true 
                                     };
                                 }

                                 if (!sessionId) {
                                     setSessionId(sid);
                                     setIsListening(true);
                                 }

                                 let melhorGeral = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                                 let melhorMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
                                 const itemIdStr = String(item.identificador || item.numero || '0');
                                 const lastFired = getRecentFiredBid(itemIdStr);
                                 if (lastFired) {
                                      if (melhorMeu === 0 || melhorMeu > lastFired.value) melhorMeu = lastFired.value;
                                      if (melhorGeral === 0 || melhorGeral > lastFired.value) melhorGeral = lastFired.value;
                                 }
                                 let pos = String(item.posicaoParticipanteDisputa || '').trim().toUpperCase();
                                 if (!pos || pos === '0' || pos === '?') {
                                     const rows = Array.from(document.querySelectorAll('tr, .cp-item-row, .ng-star-inserted'));
                                     const itemRow = rows.find(r => r.textContent.includes(`Item ${item.identificador}`) || r.textContent.includes(`Item: ${item.identificador}`));
                                     if (itemRow) {
                                         const posCell = itemRow.querySelector('.col-posicao, [title="Posição"], td:nth-child(2), .posicao-label, .cp-posicao');
                                         if (posCell) pos = posCell.textContent.trim().replace('º', '').replace('°', '');
                                     }
                                 }
                                 const isWinner = pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°';
                                 
                                 newSessions[sid].items.push({
                                     itemId: itemIdStr,
                                     purchaseId: fullId,
                                     valorAtual: melhorGeral, 
                                     meuValor: melhorMeu, 
                                     uasgName: uasgCode, 
                                     ganhador: isWinner ? 'Você' : 'Outro',
                                     status: item.situacao === '1' ? 'Disputa' : (item.situacao === '2' ? 'Iminência' : 'Encerrado'),
                                     position: pos, 
                                     timerSeconds: item.segundosParaEncerramento || -1, 
                                     desc: item.descricao || `Item ${item.numero}`,
                                     officialMargin: item.variacaoMinimaEntreLances != null ? item.variacaoMinimaEntreLances : 1,
                                     officialMarginType: item.tipoVariacaoMinimaEntreLances || 'V'
                                 });
                             });
                             setSessions(prev => {
                                 const updated = { ...(prev || {}) };
                                 Object.entries(newSessions).forEach(([sid, session]) => {
                                     updated[sid] = { ...(updated[sid] || {}), ...session, chatMessages: updated[sid]?.chatMessages || [] };
                                 });
                                 return updated;
                             });
                         }
                    } else if (pkg.action === 'HYBRID_API_ERROR') {
                         console.log("%c[❌ POLARYON HYBRID ERROR]: ", "color: #ff0000; font-weight: bold;", payload);
                    }
                }));
            }

            // 🏆 RANKING REAL: Atualiza rankingLances quando o backend ou preload intercepta lances
            // FIX v3.8.20: O portal-preload envia sessionId como "GLOBAL_{compraId}" (ex: GLOBAL_153208306062026).
            // As sessões no mapa usam outros prefixos. Fazemos busca fuzzy pelo compraId em todos os itens.
            if ((window as any).electronAPI.onBiddingRankingUpdate) {
                unsubs.push((window as any).electronAPI.onBiddingRankingUpdate((data: any) => {
                    const { sessionId: sid, itemId, realPosicao, rankingLances } = data;
                    if (!rankingLances || rankingLances.length === 0) return;

                    // Extrai o compraId do sid (pode ser "GLOBAL_153208306062026", "virtual_153208306062026" ou "HYBRID_153208306062026")
                    let compraIdFromSid = null;
                    if (sid.startsWith('GLOBAL_') || sid.startsWith('virtual_') || sid.startsWith('HYBRID_')) {
                        compraIdFromSid = sid.replace(/^(GLOBAL_|virtual_|HYBRID_)/, '');
                    }

                    setSessions(prev => {
                        const updated = { ...prev };

                        // Auxiliar para fundir as propriedades atualizadas do item a partir do ranking (v4.4.0)
                        const mergeItemRankingData = (it: any) => {
                            const { ranking, minhaPosicao } = buildRankingPorParticipante(rankingLances, it.meuValor);
                            let posicaoFinal = minhaPosicao > 0
                                ? String(minhaPosicao)
                                : (realPosicao || it.posicao);

                            // Determinar meu lance e menor lance geral do ranking
                            let finalMeuValor = it.meuValor;
                            const meuLanceNoRanking = ranking.find(r => r.eMeuLance || r.participante === '__EU__');
                            if (meuLanceNoRanking) {
                                finalMeuValor = meuLanceNoRanking.valor;
                            }

                            // Proteção do lastFired recente (< 15s)
                            const lastFired = getRecentFiredBid(itemId);
                            if (lastFired) {
                                if (!finalMeuValor || lastFired.value < finalMeuValor) {
                                    finalMeuValor = lastFired.value;
                                }
                            }

                            let finalValorAtual = it.valorAtual;
                            if (ranking && ranking.length > 0) {
                                finalValorAtual = ranking[0].valor;
                            }
                            if (finalMeuValor && finalMeuValor > 0 && (!finalValorAtual || finalMeuValor < finalValorAtual)) {
                                finalValorAtual = finalMeuValor;
                            }

                            // --- CÁLCULO E VALIDAÇÃO MATEMÁTICA DO RANKING / POSIÇÃO (v4.2.0) ---
                            if (minhaPosicao > 0) {
                                posicaoFinal = String(minhaPosicao);
                            }

                            // --- CORREÇÃO E ENFORCEMENT DE FALSOS POSITIVOS (v4.2.0) ---
                            let finalGanhador = it.ganhador;
                            if (finalMeuValor > 0 && finalValorAtual > 0 && finalMeuValor > finalValorAtual) {
                                if (posicaoFinal === "1" || posicaoFinal === "1º" || posicaoFinal === "1°" || finalGanhador === "Você") {
                                    const portalPos = String(it.posicao || "");
                                    const isPortalPosWinning = portalPos === "1" || portalPos === "1º" || portalPos === "1°" || portalPos === "V" || portalPos === "VENCEDOR";
                                    posicaoFinal = (!isPortalPosWinning && portalPos) ? portalPos : "2";
                                    finalGanhador = "Outro";
                                }
                            } else if (finalMeuValor > 0 && finalValorAtual > 0 && finalMeuValor <= finalValorAtual) {
                                posicaoFinal = "1";
                                finalGanhador = "Você";
                            }

                            return {
                                ...it,
                                meuValor: finalMeuValor,
                                valorAtual: finalValorAtual,
                                posicao: posicaoFinal,
                                ganhador: finalGanhador,
                                rankingLances
                            };
                        };

                        const applyRankingToSession = (targetSid: string) => {
                            if (!updated[targetSid]) return;
                            updated[targetSid] = {
                                ...updated[targetSid],
                                items: updated[targetSid].items.map((it: any) => {
                                    const itItemId = String(it.itemId || it.numero || '');
                                    if (itItemId !== String(itemId)) return it;
                                    return mergeItemRankingData(it);
                                })
                            };

                            // Sincroniza o estado ativo se for a sessão selecionada (v4.4.0)
                            if (sessionIdRef.current === targetSid) {
                                setItems(prevItems => {
                                    return prevItems.map((it: any) => {
                                        const itItemId = String(it.itemId || it.numero || '');
                                        if (itItemId !== String(itemId)) return it;
                                        return mergeItemRankingData(it);
                                    });
                                });
                            }
                        };

                        // 1) Tentativa direta: sessionId bate exatamente
                        if (updated[sid]) {
                            applyRankingToSession(sid);
                            return updated;
                        }

                        // 2) Busca fuzzy: percorre todas as sessões procurando um item cujo purchaseId
                        //    contenha o compraId, OU cujo itemId bata com o itemId recebido
                        let matched = false;
                        for (const [existingSid, session] of Object.entries(updated)) {
                            const items: any[] = (session as any).items || [];
                            const hasMatchingItem = items.some((it: any) => {
                                const itItemId = String(it.itemId || it.numero || '');
                                if (itItemId !== String(itemId)) return false;
                                // Verifica se o purchaseId da sessão contém o compraId
                                if (compraIdFromSid) {
                                    const pid = String(it.purchaseId || '');
                                    // Match exato: compraId deve ser igual ao purchaseId OU o sid da sessão deve conter o compraId completo
                                    if (pid === compraIdFromSid || existingSid.includes(compraIdFromSid)) return true;
                                }
                                // Fallback: se só tem 1 sessão ativa, é ela
                                return Object.keys(updated).length === 1;
                            });
                            if (hasMatchingItem) {
                                applyRankingToSession(existingSid);
                                matched = true;
                                break;
                            }
                        }

                        // 3) Último recurso: se só existe 1 sessão, injeta nela
                        if (!matched) {
                            const existingSids = Object.keys(updated);
                            if (existingSids.length === 1) {
                                applyRankingToSession(existingSids[0]);
                            } else {
                                console.warn(`[POLARYON RANKING UI] ⚠️ Não foi possível encontrar sessão para sid="${sid}" compraId="${compraIdFromSid}" itemId="${itemId}". Sessões ativas:`, existingSids);
                            }
                        }

                        return updated;
                    });
                }));
            }



            const restore = async () => {
                const activeSessions = await (window as any).electronAPI.getRestoredSessions();
                const sessionIds = Object.keys(activeSessions || {});
                
                if (sessionIds.length > 0) {
                    toast.info(`Retomando ${sessionIds.length} sessões anteriores...`);
                    for (const id of sessionIds) {
                        const s = activeSessions[id];
                        const credId = s.vault?.credentialId;
                        if (credId) {
                            try {
                                const vaultRes = await api.get(`/bidding/credentials/${credId}/vault`);
                                if (vaultRes.data.success) {
                                    (window as any).electronAPI.startLocalBidding({
                                        sessionId: id,
                                        uasg: s.uasg,
                                        numero: s.numero,
                                        ano: s.ano || new Date().getFullYear().toString(),
                                        vault: {
                                            ...vaultRes.data.vault,
                                            itemsConfig: s.vault.itemsConfig,
                                            simulationMode: s.vault.simulationMode
                                        }
                                    });
                                    setSessionId(id);
                                    setIsLocalRunning(true);
                                    setIsListening(true);
                                }
                            } catch (e) { console.error(e); }
                        }
                    }
                }
            };
            restore();
            return () => {
                unsubs.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
            };
        }
    }, [isDesktop, sessionId]);

    // [PROXY BID REMOVIDO v3.8.85] — lance agora vai direto do BrowserView via fetch()

    // 🏆 SOCKET RANKING: Atualiza rankingLances via socket (modo web e desktop)
    useEffect(() => {
        const handleRankingUpdate = (data: any) => {
            const { sessionId: sid, itemId, realPosicao, rankingLances } = data;
            if (!rankingLances || rankingLances.length === 0) return;

            let compraIdFromSid = null;
            if (sid.startsWith('GLOBAL_') || sid.startsWith('virtual_') || sid.startsWith('HYBRID_')) {
                compraIdFromSid = sid.replace(/^(GLOBAL_|virtual_|HYBRID_)/, '');
            }

            setSessions(prev => {
                const updated = { ...prev };

                const applyRankingToSession = (targetSid: string) => {
                    if (!updated[targetSid]) return;
                    updated[targetSid] = {
                        ...updated[targetSid],
                        items: updated[targetSid].items.map((it: any) => {
                            const itItemId = String(it.itemId || it.numero || '');
                            if (itItemId !== String(itemId)) return it;

                            const { minhaPosicao } = buildRankingPorParticipante(rankingLances, it.meuValor);
                            const posicaoFinal = minhaPosicao > 0
                                ? String(minhaPosicao)
                                : (realPosicao || it.posicao);

                            console.log(`%c[POLARYON RANKING SOCKET] ✅ Ranking injetado: sessão=${targetSid} item=${itemId} posição=${posicaoFinal} participantes=${rankingLances.length}`, 'color:#10b981;font-weight:bold;');
                            return {
                                ...it,
                                posicao: posicaoFinal,
                                rankingLances
                            };
                        })
                    };
                };

                // 1) Tentativa direta: sessionId bate exatamente
                if (updated[sid]) {
                    applyRankingToSession(sid);
                    return updated;
                }

                // 2) Busca fuzzy
                let matched = false;
                for (const [existingSid, session] of Object.entries(updated)) {
                    const items: any[] = (session as any).items || [];
                    const hasMatchingItem = items.some((it: any) => {
                        const itItemId = String(it.itemId || it.numero || '');
                        if (itItemId !== String(itemId)) return false;
                        if (compraIdFromSid) {
                            const pid = String(it.purchaseId || '');
                            if (pid === compraIdFromSid || existingSid.includes(compraIdFromSid)) return true;
                        }
                        return Object.keys(updated).length === 1;
                    });
                    if (hasMatchingItem) {
                        applyRankingToSession(existingSid);
                        matched = true;
                        break;
                    }
                }

                // 3) Último recurso
                if (!matched) {
                    const existingSids = Object.keys(updated);
                    if (existingSids.length === 1) {
                        applyRankingToSession(existingSids[0]);
                    }
                }

                return updated;
            });
        };

        socketService.on('biddingRankingUpdate', handleRankingUpdate);

        return () => {
            socketService.off('biddingRankingUpdate', handleRankingUpdate);
        };
    }, []);


    const startSniperTest = (itemId: string, targetSid?: string) => {
        const activeSid = targetSid || sessionId;
        if (!activeSid) return;
        const currentStrat = getStrategy(activeSid, itemId);
        if (!currentStrat.active) {
            toast.error("Por favor, configure o Valor Mínimo e ATIVE o robô (botão verde) antes de iniciar o teste de batalha!");
            return;
        }

        toast.success("Batalha de 30 segundos iniciada! Assista ao Sniper lutar em tempo real!");

        const myMin = safeParseNumber(currentStrat.minPrice);

        // Inicializa valores da simulação no estado
        setSessions(prev => {
            const updated = { ...prev };
            if (updated[activeSid]) {
                updated[activeSid].items = updated[activeSid].items.map((it: any) => {
                    if (String(it.itemId) === String(itemId)) {
                        const best = Math.max(safeParseNumber(it.valorAtual) || 1000, myMin > 0 ? myMin + 10 : 1000);
                        return {
                            ...it,
                            timerSeconds: 30,
                            dataHoraFimContagem: undefined, // remove para forçar contagem regressiva local
                            valorAtual: best,
                            meuValor: best + 10,
                            posicao: "2",
                            status: "Disputa"
                        };
                    }
                    return it;
                });
            }
            return updated;
        });

        // Atualiza a lista de itens ativos também
        setItems(prev => {
            return prev.map(it => {
                if (String(it.itemId) === String(itemId)) {
                    const best = Math.max(safeParseNumber(it.valorAtual) || 1000, myMin > 0 ? myMin + 10 : 1000);
                    return {
                        ...it,
                        timerSeconds: 30,
                        dataHoraFimContagem: undefined,
                        valorAtual: best,
                        meuValor: best + 10,
                        posicao: "2",
                        status: "Disputa"
                    };
                }
                return it;
            });
        });

        let seconds = 30;
        const simInterval = setInterval(() => {
            seconds -= 1;

            setSessions(prev => {
                const updated = { ...prev };
                if (updated[activeSid]) {
                    updated[activeSid].items = updated[activeSid].items.map((it: any) => {
                        if (String(it.itemId) === String(itemId)) {
                            if (seconds <= 0) {
                                clearInterval(simInterval);
                                toast.success("Fim do teste de disputa! Simulação concluída com sucesso.");
                                return {
                                    ...it,
                                    timerSeconds: 0,
                                    posicao: "1"
                                };
                            }

                            let currentBest = safeParseNumber(it.valorAtual);
                            let myVal = safeParseNumber(it.meuValor);
                            let pos = it.posicao;

                            // Concorrente ataca a cada 4 segundos, respeitando o preço mínimo do usuário + margem
                            if (seconds % 4 === 0 && pos === "1") {
                                const decrement = safeParseNumber(currentStrat.decrementValue) || 1;
                                const nextCompetitorBid = currentBest - decrement;
                                
                                if (nextCompetitorBid > myMin) {
                                    currentBest = nextCompetitorBid;
                                    pos = "2"; // Concorrente tomou
                                    toast.info(`⚠️ Concorrente deu lance de R$ ${currentBest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} e tomou a liderança!`, { autoClose: 1500 });
                                } else {
                                    toast.info(`🏆 Concorrente desistiu! O lance atingiria o seu limite mínimo de R$ ${myMin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, { autoClose: 2000 });
                                }
                            }

                            return {
                                ...it,
                                timerSeconds: seconds,
                                valorAtual: currentBest,
                                meuValor: myVal,
                                posicao: pos
                            };
                        }
                        return it;
                    });
                }
                return updated;
            });

            setItems(prev => {
                return prev.map(it => {
                    if (String(it.itemId) === String(itemId)) {
                        if (seconds <= 0) {
                            return {
                                ...it,
                                timerSeconds: 0,
                                posicao: "1"
                            };
                        }

                        let currentBest = safeParseNumber(it.valorAtual);
                        let myVal = safeParseNumber(it.meuValor);
                        let pos = it.posicao;

                        if (seconds % 4 === 0 && pos === "1") {
                            const decrement = safeParseNumber(currentStrat.decrementValue) || 1;
                            const nextCompetitorBid = currentBest - decrement;
                            
                            if (nextCompetitorBid > myMin) {
                                currentBest = nextCompetitorBid;
                                pos = "2";
                            }
                        }

                        return {
                            ...it,
                            timerSeconds: seconds,
                            valorAtual: currentBest,
                            meuValor: myVal,
                            posicao: pos
                        };
                    }
                    return it;
                });
            });
        }, 1000);
    };

    // --- NOVO: AGRUPAMENTO DE ITENS POR SESSÃO v3.6.1 ---
    const groupedItems = useMemo(() => {
        const groups: Record<string, any[]> = {};
        Object.entries(sessions).forEach(([sid, s]) => {
            groups[sid] = s.items || [];
        });
        return groups;
    }, [sessions]);

    const onSaveStrategy = (sid: string, itemId: string, strategy: ItemStrategy) => {
        saveStrategy(itemId, strategy, sid);
    };

    const onStopRadar = (sid: string) => {
        if (isDesktop && (window as any).electronAPI) {
            (window as any).electronAPI.stopLocalBidding(sid);
            setSessions(prev => {
                const newSessions = { ...prev };
                delete newSessions[sid];
                return newSessions;
            });
        }
    };

    const saveStrategy = async (itemId: string, strategy: ItemStrategy, targetSid?: string) => {
        const sid = targetSid || sessionId;
        if (!sid || sid === 'undefined' || !itemId || itemId === 'undefined') return;
        try {
            const isSimulated = sid.startsWith('virtual_') || sid.startsWith('HYBRID_') || sid.startsWith('GLOBAL_');
            if (!isSimulated) {
                await api.patch(`/bidding/sessions/${sid}/items/${itemId}`, strategy);
            }
            setItemStrategies(prev => ({ ...prev, [`${sid}_${itemId}`]: strategy }));
            if (isLocalRunning && (window as any).electronAPI) {
                const updatedConfig = { ...getSessionItemsConfig(sid), [itemId]: strategy };
                (window as any).electronAPI.updateLocalBiddingConfig(sid, { itemsConfig: updatedConfig });
            }
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        if (sessionId && isLocalRunning && (window as any).electronAPI) {
            (window as any).electronAPI.updateLocalBiddingConfig(sessionId, { 
                itemsConfig: getSessionItemsConfig(sessionId)
            });
        }
    }, [itemStrategies, sessionId, isLocalRunning]);

    const startRadar = async (u: string, n: string, a: string) => {
        try {
            const res = await api.post('/bidding/sessions', { uasg: u, numeroPregao: n, anoPregao: a, portal: 'compras_gov', credentialId: selectedCredentialId || dummyCredentialId });
            if (res.data.success) {
                const sid = res.data.session.id;
                setSessionId(sid);
                setIsListening(true);
                if (isDesktop && (window as any).electronAPI) {
                    (window as any).electronAPI.startVisualBidding({ sessionId: sid, uasg: u, numero: n, ano: a, vault: { itemsConfig: getSessionItemsConfig(sid) } });
                    setIsLocalRunning(true);
                }
            }
        } catch (e) { console.error(e); }
    };

    const checkUpdate = (silent = false) => {
        if (isDesktop && (window as any).electronAPI) {
            setIsCheckingUpdate(true);
            (window as any).electronAPI.getAppVersion().then((v: string) => {
                setAppVersion(v);
                if (!silent) {
                    toast.info(`Versão Atual: v${v}. Verificando servidores...`);
                }
                (window as any).electronAPI.checkForUpdates();
                setTimeout(() => setIsCheckingUpdate(false), 8000);
            });
        } else if (!silent) {
            toast.warning("Verificação manual disponível apenas no Polaryon Desktop.");
        }
    };

    // --- MONITOR DE ATUALIZAÇÃO AUTOMÁTICA IMORTAL v4.0.0 ---
    // Verifica ao iniciar, ao focar a janela, e a cada 30 minutos.
    useEffect(() => {
        if (isDesktop && (window as any).electronAPI) {
            const electron = (window as any).electronAPI;
            const unsubs: (() => void)[] = [];

            // Busca versão e dispara verificação ao iniciar (silent)
            electron.getAppVersion?.().then((v: string) => {
                setAppVersion(v);
                electron.checkForUpdates?.();
            });

            // Verificação periódica: a cada 30 minutos
            const periodicCheck = setInterval(() => {
                electron.checkForUpdates?.();
            }, 30 * 60 * 1000);

            // Verificação ao recuperar o foco da janela
            const handleFocus = () => electron.checkForUpdates?.();
            window.addEventListener('focus', handleFocus);

            if (electron.onUpdateLog) {
                const unsub = electron.onUpdateLog((msg: string) => {
                    console.log('[POLARYON UPDATE]', msg);
                    
                    // 🔥 ATUALIZAÇÃO OTIMISTA IMEDIATA PÓS-CONFIRMAÇÃO HTTP (v4.4.2)
                    // Analisa os logs detalhadamente via regexes específicas e individuais para evitar falhas de precedência
                    let value: number | null = null;
                    let itemId: string | null = null;

                    if (msg.includes('ACERTOU O ALVO!') || msg.includes('Lance Kamikaze')) {
                        const m = msg.match(/Lance Kamikaze de R\$\s*([\d.]+)\s*no Item\s*(\w+)/i);
                        if (m) {
                            value = parseFloat(m[1]);
                            itemId = m[2];
                        }
                    }

                    if (!itemId && (msg.includes('Disparando R$') || msg.includes('DISPARANDO LANCE'))) {
                        const m = msg.match(/Disparando R\$\s*([\d.]+)\s*→\s*Item\s*(\w+)/i) ||
                                  msg.match(/DISPARANDO LANCE:\s*R\$\s*([\d.]+)\s*para\s*Item\s*(\w+)/i);
                        if (m) {
                            value = parseFloat(m[1]);
                            itemId = m[2];
                        }
                    }

                    if (itemId && value !== null && !isNaN(value)) {
                        const activeSid = sessionIdRef.current;
                        if (activeSid) {
                            setSessions(prev => {
                                const updated = { ...prev };
                                if (updated[activeSid]) {
                                    updated[activeSid].items = updated[activeSid].items.map((it: any) => {
                                        if (String(it.itemId) === String(itemId)) {
                                            const isNewBest = value! <= Number(it.valorAtual || 99999999);
                                            return {
                                                ...it,
                                                meuValor: value!,
                                                valorAtual: Math.min(Number(it.valorAtual || 99999999), value!),
                                                posicao: isNewBest ? "1" : it.posicao,
                                                ganhador: isNewBest ? "Você" : it.ganhador
                                            };
                                        }
                                        return it;
                                    });
                                }
                                return updated;
                            });

                            setItems(prev => {
                                return prev.map(it => {
                                    if (String(it.itemId) === String(itemId)) {
                                        const isNewBest = value! <= Number(it.valorAtual || 99999999);
                                        return {
                                            ...it,
                                            meuValor: value!,
                                            valorAtual: Math.min(Number(it.valorAtual || 99999999), value!),
                                            posicao: isNewBest ? "1" : it.posicao,
                                            ganhador: isNewBest ? "Você" : it.ganhador
                                        };
                                    }
                                    return it;
                                });
                            });
                        }
                    }
                });
                if (typeof unsub === 'function') unsubs.push(unsub);
            }

            if (electron.onUpdateAvailable) {
                const unsub = electron.onUpdateAvailable((info: any) => {
                    setUpdateInfo(info);
                    setIsUpdateReady(false);
                    setDownloadProgress(0);
                    toast.success(`🚀 Nova versão v${info.version} disponível! Baixando automaticamente...`, {
                        position: "top-center",
                        autoClose: 8000
                    });
                });
                if (typeof unsub === 'function') unsubs.push(unsub);
            }

            // Correção de correspondência: no preload é 'onDownloadProgress'
            const registerProgress = electron.onDownloadProgress || electron.onUpdateProgress;
            if (registerProgress) {
                const unsub = registerProgress((progress: any) => {
                    const pct = Math.round(progress?.percent || 0);
                    setDownloadProgress(pct);
                });
                if (typeof unsub === 'function') unsubs.push(unsub);
            }

            if (electron.onUpdateDownloaded) {
                const unsub = electron.onUpdateDownloaded((info: any) => {
                    setUpdateInfo(info);
                    setIsUpdateReady(true);
                    setDownloadProgress(100);
                    toast.success(`✅ Versão v${info.version} pronta! Clique em "Instalar Agora" para reiniciar.`, {
                        position: "top-center",
                        autoClose: false
                    });
                });
                if (typeof unsub === 'function') unsubs.push(unsub);
            }

            if (electron.onUpdateError) {
                const unsub = electron.onUpdateError((err: any) => {
                    console.error('[POLARYON UPDATE ERROR]', err);
                    toast.error(`❌ Falha ao processar atualização: ${err?.message || err}`);
                });
                if (typeof unsub === 'function') unsubs.push(unsub);
            }

            return () => {
                clearInterval(periodicCheck);
                window.removeEventListener('focus', handleFocus);
                unsubs.forEach(u => typeof u === 'function' && u());
            };
        }
    }, [isDesktop]);

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-x-hidden">
            <header className="w-full h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500 p-2 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            POLARYON
                        </h1>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SISTEMA OPERACIONAL</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-lg shadow-inner">
                                <Clock className="w-3 h-3 text-emerald-400" />
                                <span className="text-[11px] font-mono font-bold text-white tracking-tighter">
                                    {new Date(serverTime).toLocaleTimeString('pt-BR')}
                                </span>
                                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">SINCRONIZADO</span>
                                {sigaTimerSeconds !== undefined && (
                                    <span className="text-[10px] font-mono text-amber-400 ml-1">
                                        DOM:{sigaTimerSeconds.toFixed(1)}s
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase">STATUS API</span>
                            <span className="text-xs font-bold text-emerald-400">OPERACIONAL</span>
                        </div>
                    </div>
                    
                    {/* Bot\u00e3o de vers\u00e3o inteligente */}
                    {updateInfo && isUpdateReady ? (
                        <button
                            onClick={() => (window as any).electronAPI?.installUpdate?.()}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors shadow-md animate-pulse"
                        >
                            ⚡ Instalar v{updateInfo.version}
                        </button>
                    ) : updateInfo && !isUpdateReady ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                            <span className="text-[10px] font-black text-amber-700 uppercase">
                                {downloadProgress > 0 ? `${downloadProgress}%` : 'Baixando...'}
                            </span>
                        </div>
                    ) : (
                        <button
                            onClick={() => checkUpdate()}
                            disabled={isCheckingUpdate}
                            className="flex items-center gap-2 h-9 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                            {isCheckingUpdate ? 'Verificando...' : `v${appVersion}`}
                        </button>
                    )}
                </div>
            </header>

            {/* === BANNER DE NOVA VERSÃO DISPONÍVEL (PERSISTENTE) === */}
            {updateInfo && (
                <div className={`w-full px-6 py-2.5 flex items-center justify-between gap-4 text-white text-xs font-bold transition-all ${
                    isUpdateReady
                        ? 'bg-emerald-600'
                        : 'bg-slate-800'
                }`}>
                    <div className="flex items-center gap-3">
                        <span className="text-lg">{isUpdateReady ? '✅' : '📥'}</span>
                        <div>
                            <span className="font-black uppercase tracking-wide">
                                {isUpdateReady
                                    ? `Versão v${updateInfo.version} pronta para instalar!`
                                    : `Baixando atualização v${updateInfo.version}...`
                                }
                            </span>
                            {!isUpdateReady && downloadProgress > 0 && (
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="w-32 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                                            style={{ width: `${downloadProgress}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-emerald-400">{downloadProgress}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {isUpdateReady && (
                        <button
                            onClick={() => (window as any).electronAPI?.installUpdate?.()}
                            className="px-4 py-1.5 bg-white text-emerald-700 rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-emerald-50 transition-colors shadow-lg"
                        >
                            ⚡ Instalar Agora
                        </button>
                    )}
                </div>
            )}


                <div className="w-full bg-slate-900 border-b border-white/5 py-2 px-6 flex items-center gap-3 overflow-x-auto no-scrollbar">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-2">Salas Ativas:</span>
                    {Object.entries(sessions)
                        .filter(([sid, s]) => sid !== 'undefined' && s.uasg !== 'LOGIN') // Oculta login quando há salas reais
                        .map(([sid, s]) => (
                        <button 
                            key={sid}
                            onClick={() => { setSessionId(sid); setItems(s.items || []); setIsListening(true); }}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all whitespace-nowrap ${sessionId === sid ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                        >
                            <Activity className={`w-3 h-3 ${sessionId === sid ? 'text-white' : 'text-emerald-500'}`} />
                            <span className="text-[10px] font-black tracking-tight">{s.sessionTitle || `UASG ${s.uasg}`} | {(s.items || []).length} Itens</span>
                            {(s.items || []).some(it => (it.status || '').toLowerCase().includes('disputa')) && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                        </button>
                    ))}
                </div>

            <main className="container mx-auto px-4 py-8 max-w-[1800px]">
                {!isListening ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        <div className="bg-white border border-slate-200 p-12 rounded-[2.5rem] shadow-2xl text-center max-w-lg w-full relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                            <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-slate-100 transform rotate-12 group-hover:rotate-0 transition-transform duration-500"><Zap className="w-12 h-12 text-emerald-500 fill-current" /></div>
                            <h2 className="text-3xl font-black tracking-tighter mb-4 text-slate-900 uppercase">MÁQUINA DE LANCES</h2>
                            <p className="text-slate-500 text-xs mb-10 leading-relaxed px-4 font-bold uppercase tracking-widest">Inicie a automação visual. O robô abrirá o navegador oficial para você autenticar com seu Certificado Digital.</p>
                            <button onClick={openPortalLogin} className="w-full bg-black hover:bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center space-x-4 transition-all shadow-xl"><Shield className="w-6 h-6 text-emerald-400" /><span className="text-lg uppercase tracking-tight">LOGIN COMPRAS.GOV.BR</span></button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-12 gap-8 animate-in fade-in duration-700">
                        <div className={`${isChatOpen ? 'col-span-9' : 'col-span-12'} space-y-6`}>
                            {/* --- MONITOR DE TRÁFEGO v3.6.1 (DIAGNÓSTICO) --- */}
            <div className="mt-8 flex gap-3">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-slate-900 text-white hover:bg-black border-none gap-2 font-black text-[10px] uppercase tracking-tighter">
                            <Activity className="w-3 h-3" /> Monitor de Tráfego {networkTraffic.length > 0 && `(${networkTraffic.length})`}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[60vh] bg-slate-950 text-white border-slate-800">
                        <SheetHeader className="border-b border-slate-800 pb-4 mb-4">
                            <SheetTitle className="text-white font-black uppercase text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-500" /> Terminal de Diagnóstico Polaryon
                            </SheetTitle>
                            <SheetDescription className="text-slate-500 text-[10px] font-bold uppercase">
                                Visualização em tempo real das requisições à API do Serpro
                            </SheetDescription>
                        </SheetHeader>
                        <div className="overflow-auto h-full font-mono text-[10px] space-y-1 pb-20">
                            {networkTraffic.length === 0 ? (
                                <div className="text-center py-20 text-slate-700 font-bold uppercase tracking-widest">Aguardando tráfego de rede...</div>
                            ) : networkTraffic.map((req, idx) => (
                                <div key={idx} className="flex gap-4 border-b border-slate-900/50 py-1 hover:bg-white/5 transition-colors px-2">
                                    <span className="text-slate-600">[{new Date(req.timestamp).toLocaleTimeString()}]</span>
                                    <span className={`font-black ${req.statusCode === 200 ? 'text-emerald-500' : 'text-red-500'}`}>{req.statusCode}</span>
                                    <span className="text-slate-400">GET</span>
                                    <span className="text-slate-300 truncate flex-1">{req.url}</span>
                                </div>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>

                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`gap-2 font-black text-[10px] uppercase tracking-tighter transition-all h-9 ${
                        isChatOpen 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-none' 
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                >
                    <MessageSquare className="w-3.5 h-3.5" /> 
                    {isChatOpen ? 'Ocultar Fluxo & Mensagens' : 'Mostrar Fluxo & Mensagens'}
                </Button>
            </div>

                      <div className="space-y-6">
                {Object.entries(sessions).map(([sid, session]: [string, any]) => (
                    <Accordion type="single" collapsible key={sid}>
                        <AccordionItem value="items" className="border rounded-xl bg-white shadow-sm overflow-hidden">
                            <AccordionTrigger className="px-6 py-4 hover:bg-slate-50 transition-all border-b">
                                <div className="flex items-center gap-4 w-full text-left">
                                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-black text-slate-900 uppercase truncate">
                                                {session.sessionTitle || `UASG ${session.uasg || '?'} - ${session.numero || '?'}/${session.ano || '?'}`}
                                            </h3>
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-600 border-emerald-200 bg-emerald-50 shrink-0">Sessão Ativa</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] text-slate-500 font-semibold">
                                                UASG {session.uasg || '?'} • {session.numero || '?'}/{session.ano || '?'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold">
                                                {session.items?.length || 0} itens
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {(() => {
                                                let minEnd = Infinity;
                                                for (const item of (session.items || [])) {
                                                    if (item.dataHoraFimContagem) {
                                                        const end = new Date(item.dataHoraFimContagem).getTime();
                                                        if (end < minEnd) minEnd = end;
                                                    }
                                                }
                                                if (minEnd === Infinity) return null;
                                                const remaining = Math.max(0, Math.floor((minEnd - now) / 1000));
                                                const h = Math.floor(remaining / 3600);
                                                const m = Math.floor((remaining % 3600) / 60);
                                                const s = remaining % 60;
                                                return (
                                                    <span className={`text-[11px] font-black font-mono ${remaining <= 60 ? 'text-red-500' : remaining <= 300 ? 'text-amber-500' : 'text-slate-700'}`}>
                                                        <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
                                                        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 mr-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Status</span>
                                            <span className="text-[10px] font-black text-emerald-500 uppercase">Operacional</span>
                                        </div>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 bg-slate-50/30">
                                <div className="space-y-3">
                                    {session.items?.length > 0 ? (
                                        (() => {
                                            const groupItems = session.items.filter((i: any) => i.isGroup);
                                            const subItems = session.items.filter((i: any) => i.isGroupItem);
                                            const childItems = session.items.filter((i: any) => !i.isGroup && !i.isGroupItem);
                                            if (groupItems.length > 0) {
                                                const renderedGroups = groupItems.flatMap((grp: any) => {
                                                    const grpId = String(grp.itemId || grp.numero || '');
                                                    const mySubItems = subItems.filter((s: any) => {
                                                        const spg = String(s.parentGroupId || '');
                                                        return spg === grpId || spg === String(grp.numero) || spg === String(grp.identificador);
                                                    });
                                                    const subCount = mySubItems.length || grp.qtdeItensDoGrupo || '?';
                                                    return [
                                                        <div key={grp.itemId || 'grupo'} className="bg-amber-50 border border-amber-200 rounded-lg mb-3 p-3">
                                                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200/60">
                                                                <span className="font-bold text-amber-900 uppercase text-xs tracking-wider">{grp.desc || 'GRUPO'}</span>
                                                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-200 px-1.5 py-0.5 rounded">{subCount} itens internos</span>
                                                            </div>
                                                            {mySubItems.length > 0 && (
                                                                <div className="mt-4 pt-3 border-t-2 border-amber-300/60">
                                                                    <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider flex items-center gap-1.5 mb-3">
                                                                        <ChevronRight className="w-3 h-3" />
                                                                        Itens do grupo — lance individual em cada um
                                                                    </span>
                                                                    <div className="space-y-2">
                                            {mySubItems.map((sub: any) => (
                                                <SigaItemRow 
                                                    key={sub.itemId || sub.numero} 
                                                    item={sub} 
                                                    sid={sid} 
                                                    onSaveStrategy={onSaveStrategy}
                                                    onManualBid={handleManualBid}
                                                    serverTime={serverTime}
                                                    strategyConfig={getStrategy(sid, sub.itemId || sub.numero)}
                                                    onStartSniperTest={startSniperTest}
                                                    simulationMode={session.simulationMode}
                                                    clockSkew={clockSkewRef.current}
                                                    wsFastBidsRef={wsFastBidsRef}
                                                    timerOverrideRef={timerOverrideRef}
                                                />
                                            ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ];
                                                });
                                                return [...renderedGroups, ...childItems.map((item: any) => (
                                                    <SigaItemRow 
                                                        key={item.itemId || item.numero} 
                                                        item={item} 
                                                        sid={sid} 
                                                        onSaveStrategy={onSaveStrategy}
                                                        onManualBid={handleManualBid}
                                                        serverTime={serverTime}
                                                        strategyConfig={getStrategy(sid, item.itemId || item.numero)}
                                                        onStartSniperTest={startSniperTest}
                                                        simulationMode={session.simulationMode}
                                                        clockSkew={clockSkewRef.current}
                                                        wsFastBidsRef={wsFastBidsRef}
                                                        timerOverrideRef={timerOverrideRef}
                                                    />
                                                ))];
                                            }
                                            return childItems.map((item: any) => (
                                                <SigaItemRow 
                                                    key={item.itemId || item.numero} 
                                                    item={item} 
                                                    sid={sid} 
                                                    onSaveStrategy={onSaveStrategy}
                                                    onManualBid={handleManualBid}
                                                    serverTime={serverTime}
                                                    strategyConfig={getStrategy(sid, item.itemId || item.numero)}
                                                    onStartSniperTest={startSniperTest}
                                                    simulationMode={session.simulationMode}
                                                    clockSkew={clockSkewRef.current}
                                                    wsFastBidsRef={wsFastBidsRef}
                                                    timerOverrideRef={timerOverrideRef}
                                                />
                                            ));
                                        })()
                                    ) : (
                                        <div className="p-12 text-center">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Search className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-600 uppercase">Buscando Itens...</h4>
                                            <p className="text-xs text-slate-400 mt-1">Aguarde a sincronização com o portal do governo.</p>
                                        </div>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                ))}

                {Object.keys(sessions).length === 0 && (
                    <div className="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Zap className="w-12 h-12 text-emerald-500 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Modo Lobo Solitário</h3>
                        <p className="text-slate-400 mt-2 max-w-sm mx-auto font-medium mb-6">Insira a UASG e o Número do Edital (Sem barras ou traços) para que o motor de fundo se conecte de forma invisível.</p>
                        
                        {isAuthenticated ? (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                                <div className="flex gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                                    <Input 
                                        placeholder="UASG (Ex: 150002)" 
                                        className="w-40 h-12 text-sm font-bold bg-white text-center" 
                                        value={uasg}
                                        onChange={(e) => setUasg(e.target.value)}
                                    />
                                    <Input 
                                        placeholder="Nº Edital (Ex: 822026)" 
                                        className="w-40 h-12 text-sm font-bold bg-white text-center" 
                                        value={numeroPregao}
                                        onChange={(e) => setNumeroPregao(e.target.value)}
                                    />
                                </div>
                                <Button 
                                    className="bg-emerald-500 hover:bg-emerald-600 font-bold px-8 shadow-lg shadow-emerald-500/20 rounded-xl h-16 text-sm"
                                    onClick={() => startRadar(uasg, numeroPregao, anoPregao || new Date().getFullYear().toString())}
                                >
                                    ENGATAR KAMIKAZE <Target className="w-5 h-5 ml-2" />
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-8">
                                <p className="text-sm font-bold text-amber-500 bg-amber-50 py-3 px-6 rounded-xl inline-block">Faça Login no Compras.gov.br primeiro para liberar a conexão.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
                        </div>
                        {isChatOpen && (
                            <div className="col-span-3 space-y-6 sticky top-24 h-[calc(100vh-140px)] flex flex-col">
                                <Card className="bg-slate-900 border-none shadow-2xl rounded-2xl flex flex-col flex-1 overflow-hidden">
                                    <CardHeader className="bg-white/5 border-b border-white/5 py-3 px-5"><CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity className="w-3 h-3 text-emerald-500" /> Fluxo de Dados</CardTitle></CardHeader>
                                    <CardContent className="p-0 flex-1 overflow-y-auto font-mono text-[9px] p-2 space-y-1 custom-scrollbar">
                                        {(networkTraffic || []).length === 0 ? <div className="h-full flex items-center justify-center text-slate-600 italic">Capturando pacotes...</div> : networkTraffic.map((log, idx) => (
                                            <div key={idx} className="flex gap-2 border-b border-white/5 pb-1"><span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span><span className={log.statusCode >= 400 ? 'text-red-400' : 'text-emerald-400'}>{log.statusCode}</span><span className="truncate text-slate-300">GET {log.url.split('/').pop().split('?')[0]}</span></div>
                                        ))}
                                    </CardContent>
                                    <div className="p-3 bg-white/5 border-t border-white/5 flex justify-between text-[8px] font-black text-slate-500 uppercase"><span>Ping: {Math.abs(serverOffset)}ms</span><span className="text-emerald-500">SYNC: OK</span></div>
                                </Card>
                                <Card className="bg-white border-slate-200 shadow-xl rounded-2xl flex-1 flex flex-col overflow-hidden">
                                    <CardHeader className="py-3 px-5 border-b border-slate-100"><CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mensagens</CardTitle></CardHeader>
                                    <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                        {(chatMessages || []).length === 0 ? <p className="text-[10px] text-slate-300 italic text-center py-10">Nenhuma mensagem.</p> : chatMessages.map((msg, idx) => (
                                            <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100"><p className="text-[10px] text-slate-700">{msg.texto || msg.text}</p></div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <AlertDialog open={showRealModeWarning} onOpenChange={setShowRealModeWarning}>
                <AlertDialogContent className="bg-slate-950 border-white/10 text-slate-100 p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-4 text-3xl font-black italic tracking-tighter text-red-500"><ShieldAlert className="w-8 h-8 animate-pulse" /> MODO REAL ATIVADO</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400 text-sm leading-relaxed mt-4">Ao desativar o modo simulação, o robô irá realizar lances REAIS no portal Gov.br usando seu Certificado Digital.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-4">
                        <AlertDialogCancel className="bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700 h-12 font-black">CANCELAR</AlertDialogCancel>
                        <AlertDialogAction onClick={() => toggleSimulation(false)} className="bg-red-600 hover:bg-red-500 text-white font-black h-12 px-8 shadow-2xl shadow-red-900/50">ATIVAR DISPARO REAL</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function BiddingSigaView({ items, sessions, onSaveStrategy, onQuickBid, onStopRadar, serverTime, getStrategy, onStartSniperTest }: any) {
    const groupedItems = useMemo(() => {
        const groups: Record<string, any[]> = {};
        const safeItems = Array.isArray(items) ? items : [];
        safeItems.forEach(item => {
            if (!item.sid) return;
            if (!groups[item.sid]) groups[item.sid] = [];
            groups[item.sid].push(item);
        });
        return groups;
    }, [items]);

    return (
        <div className="space-y-8 pb-12">
            {Object.entries(sessions || {}).map(([sid, session]: [string, any]) => (
                <ProcessCard key={sid} sid={sid} session={session} items={groupedItems[sid] || []} onSaveStrategy={onSaveStrategy} onQuickBid={onQuickBid} onStopRadar={() => onStopRadar(sid)} appVersion="3.6.1" serverTime={serverTime} getStrategy={getStrategy} onStartSniperTest={onStartSniperTest} />
            ))}
        </div>
    );
}

function ProcessCard({ sid, session, items, onSaveStrategy, onQuickBid, onStopRadar, serverTime, getStrategy, onStartSniperTest }: any) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [tab, setTab] = useState<'WAIT' | 'DISPUTE' | 'CLOSED'>('DISPUTE');
    
    const filteredItems = useMemo(() => {
        const safeItems = Array.isArray(items) ? items : [];
        if (tab === 'WAIT') return safeItems.filter((i: any) => (i.status || '').toLowerCase().includes('aguardando'));
        if (tab === 'CLOSED') return safeItems.filter((i: any) => (i.status || '').toLowerCase().includes('encerrado'));
        return safeItems.filter((i: any) => !(i.status || '').toLowerCase().includes('aguardando') && !(i.status || '').toLowerCase().includes('encerrado'));
    }, [items, tab]);

    const counts = useMemo(() => {
        const safeItems = Array.isArray(items) ? items : [];
        return {
            wait: safeItems.filter((i: any) => (i.status || '').toLowerCase().includes('aguardando')).length,
            dispute: safeItems.filter((i: any) => !(i.status || '').toLowerCase().includes('aguardando') && !(i.status || '').toLowerCase().includes('encerrado')).length,
            closed: safeItems.filter((i: any) => (i.status || '').toLowerCase().includes('encerrado')).length
        };
    }, [items]);

    return (
        <Card className="bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden transition-all duration-500">
            <CardHeader className="bg-slate-50/80 py-4 px-6 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-center">
                    <div className="flex-1">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            {session.sessionTitle || `Dispensa ${session.numero}`} | UASG {session.uasg}
                        </h3>
                        <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] font-bold bg-white text-slate-400 border-slate-200">Modo Aberto</Badge>
                            <Badge className="bg-emerald-50 text-[10px] text-emerald-600 border-emerald-100 font-black">ELITE V3.6.10</Badge>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="p-6 bg-white">
                    <div className="flex justify-center items-center gap-2 mb-8 relative">
                        <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
                            <button onClick={() => setTab('WAIT')} className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${tab === 'WAIT' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Aguardando {counts.wait > 0 && `(${counts.wait})`}</button>
                            <button onClick={() => setTab('DISPUTE')} className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${tab === 'DISPUTE' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Em disputa ({counts.dispute})</button>
                            <button onClick={() => setTab('CLOSED')} className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${tab === 'CLOSED' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Encerrados {counts.closed > 0 && `(${counts.closed})`}</button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {filteredItems.length === 0 ? <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-2xl"><Search className="w-10 h-10 text-slate-200 mx-auto mb-4" /><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum item nesta categoria.</p></div> : filteredItems.map((item: any) => (
                            <SigaItemRow key={item.itemId || item.numero} item={item} sid={sid} onSaveStrategy={onSaveStrategy} onManualBid={handleManualBid} serverTime={serverTime} strategyConfig={getStrategy ? getStrategy(sid, item.itemId || item.numero) : {}} onStartSniperTest={onStartSniperTest} simulationMode={session.simulationMode} clockSkew={clockSkewRef.current} wsFastBidsRef={wsFastBidsRef} timerOverrideRef={timerOverrideRef} />
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

function formatNumberPT(val: any, useFour = false): string {
    if (val === undefined || val === null || val === '') return '';
    const num = safeParseNumber(val);
    if (num <= 0) return '';
    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: useFour ? 4 : 2,
        maximumFractionDigits: useFour ? 4 : 2
    });
}

/**
 * RANKING POR PARTICIPANTE (estilo SIGA)
 * Recebe a lista bruta de todos os lances/propostas e retorna um ranking
 * onde cada participante aparece UMA vez com seu MELHOR lance (menor valor).
 * Ordenado do menor para o maior (1º = vencedor).
 */
function buildRankingPorParticipante(lancesRaw: any[], meuValor?: number): {
    ranking: { participante: string; valor: number; origem: string; data: string; eMeuLance: boolean }[];
    minhaPosicao: number;
} {
    if (!lancesRaw || lancesRaw.length === 0) return { ranking: [], minhaPosicao: 0 };

    // Agrupa pelo identificador do participante (fornecedorId, cnpj, ou 'EU' se eMeuLance)
    const mapaParticipantes = new Map<string, { valor: number; origem: string; data: string; eMeuLance: boolean }>();

    lancesRaw.forEach((lance: any) => {
        const valor = safeParseNumber(lance.valor || lance.valorInformado || lance.valorCalculado || 0);
        if (valor <= 0) return;

        // Identifica o participante
        const eMeu = !!(lance.eMeuLance || lance.isMyBid || lance.meuLance);
        const participante = eMeu
            ? '__EU__'
            : (lance.participanteId || lance.fornecedorId || lance.cnpjFornecedor || lance.codigoParticipante || lance.codigoFornecedor || String(valor)); // fallback por valor

        const existente = mapaParticipantes.get(participante);
        // Mantemos apenas o menor lance de cada participante
        if (!existente || valor < existente.valor) {
            mapaParticipantes.set(participante, {
                valor,
                origem: lance.origem || lance.tipoLance || (eMeu ? 'Lance (Você)' : 'Lance'),
                data: lance.data || lance.dataHora || lance.dataRegistro || '',
                eMeuLance: eMeu
            });
        }
    });

    // Se o meuValor veio do item mas não havia nenhum lance marcado como "meu", tenta encontrar por valor ou injeta
    if (!mapaParticipantes.has('__EU__') && meuValor && meuValor > 0) {
        let matchingKey = null;
        for (const [key, d] of mapaParticipantes.entries()) {
            if (Math.abs(d.valor - meuValor) < 0.001) {
                matchingKey = key;
                break;
            }
        }
        if (matchingKey) {
            const d = mapaParticipantes.get(matchingKey);
            if (d) {
                mapaParticipantes.delete(matchingKey);
                mapaParticipantes.set('__EU__', {
                    ...d,
                    eMeuLance: true
                });
            }
        } else {
            mapaParticipantes.set('__EU__', {
                valor: meuValor,
                origem: 'Lance (Você)',
                data: new Date().toLocaleString('pt-BR'),
                eMeuLance: true
            });
        }
    }

    // Ordena do menor para o maior
    const ranking = Array.from(mapaParticipantes.entries())
        .map(([participante, dados]) => ({ participante, ...dados }))
        .sort((a, b) => a.valor - b.valor);

    // Descobre a posição real do usuário
    const minhaPosicao = ranking.findIndex(r => r.eMeuLance) + 1; // 0 = não encontrado, 1 = 1º

    return { ranking, minhaPosicao };
}

function SigaItemRow({ item, sid, onSaveStrategy, onManualBid, serverTime, strategyConfig, onStartSniperTest, simulationMode, clockSkew, wsFastBidsRef, timerOverrideRef }: any) {
    // ⚡ SOBRESCRITA INSTANTÂNEA VIA WEBSOCKET DIRETO (RAIO DIRETO): usa dados do wsFastBidsRef
    // para meuValor, valorAtual, posicao SEMPRE que disponíveis (mais recentes que o item prop)
    const wsFastKey = sid ? `${sid}_${item.itemId || item.numero}` : `${item.itemId || item.numero}`;
    const wsFastData = wsFastBidsRef?.current?.[wsFastKey];
    
    // RANKING CORRETO: monta por participante (melhor lance de cada um)
    const { ranking: rankingComputado, minhaPosicao: posicaoComputada } = useMemo(() => {
        return buildRankingPorParticipante(item.rankingLances || [], item.meuValor);
    }, [item.rankingLances, item.meuValor]);

    // Posição real: usa wsFastData se disponível, senão computada, senão item.posicao
    const posicaoReal = wsFastData?.posicao 
        ? wsFastData.posicao 
        : (posicaoComputada > 0 ? String(posicaoComputada) : (item.posicao || '?'));

    // ⚡ Usa wsFastData quando disponível (frescor do WebSocket em tempo real)
    const meuValorDisplay = wsFastData?.meuValor ?? safeParseNumber(item.meuValor);
    const valorAtualDisplay = wsFastData?.valorAtual ?? safeParseNumber(item.valorAtual);
    const ganhadorDisplay = wsFastData?.ganhador || item.ganhador || 'Outro';

    const myBidVal = meuValorDisplay;
    const bestBidVal = valorAtualDisplay;
    const isWinning = 
        !(myBidVal > 0 && bestBidVal > 0 && myBidVal > bestBidVal) && (
            ganhadorDisplay === 'Você' || 
            item.position === 1 ||
            posicaoReal === '1' ||
            String(posicaoReal) === '1' || 
            String(posicaoReal) === '1º' ||
            String(posicaoReal) === '1°' ||
            String(posicaoReal).toUpperCase() === 'G' ||
            String(posicaoReal).toUpperCase() === 'V' ||
            String(posicaoReal).toUpperCase() === 'GANHANDO' ||
            String(posicaoReal).toUpperCase() === 'VENCEDOR'
        );
    
    const defaultMargin = item.officialMargin || 1.00;
    const defaultType = item.officialMarginType || 'fixed';

    const currentStrat = strategyConfig || {};

    const [minPrice, setMinPrice] = useState<number | string>(
        currentStrat.minPrice !== undefined ? (currentStrat.minPrice > 0 ? currentStrat.minPrice : '') : (item.minPrice && item.minPrice > 0 ? item.minPrice : '')
    );
    const [margin, setMargin] = useState(
        currentStrat.decrementValue !== undefined ? currentStrat.decrementValue : (item.decrementValue || defaultMargin)
    );
    
    const initialMinVal = currentStrat.minPrice !== undefined ? currentStrat.minPrice : (item.minPrice || 0);
    const initialDecVal = currentStrat.decrementValue !== undefined ? currentStrat.decrementValue : (item.decrementValue || defaultMargin);
    const initialFour = currentStrat.useFourDecimals !== undefined ? currentStrat.useFourDecimals : (item.useFourDecimals || false);

    const [minPriceStr, setMinPriceStr] = useState<string>(formatNumberPT(initialMinVal, initialFour));
    const [marginStr, setMarginStr] = useState<string>(formatNumberPT(initialDecVal, initialFour));

    const [marginType, setMarginType] = useState(
        currentStrat.decrementType !== undefined ? currentStrat.decrementType : (item.decrementType || defaultType)
    );
    const [strategy, setStrategy] = useState<'follower' | 'sniper' | 'shadow'>(
        currentStrat.mode !== undefined ? currentStrat.mode : (item.mode || 'follower')
    );
    const [active, setActive] = useState(
        currentStrat.active !== undefined ? currentStrat.active : (item.active || false)
    );
    const [timeLeft, setTimeLeft] = useState<number>(item.timerSeconds || 0);

    const [useFourDecimals, setUseFourDecimals] = useState(
        currentStrat.useFourDecimals !== undefined ? currentStrat.useFourDecimals : (item.useFourDecimals || false)
    );
    const [kamikazeMode, setKamikazeMode] = useState(
        currentStrat.kamikazeMode !== undefined ? currentStrat.kamikazeMode : (item.kamikazeMode || false)
    );
    const [snipeDelaySeconds, setSnipeDelaySeconds] = useState<number>(
        currentStrat.snipeDelaySeconds !== undefined ? currentStrat.snipeDelaySeconds : 0
    );
    const [directBidValue, setDirectBidValue] = useState<string>('');
    const [showRankingModal, setShowRankingModal] = useState(false);
    // 🔄 TICK PARA COUNTDOWN DO TIMER OVERRIDE: força re-render a cada 1s para atualizar o display regressivo (v3.8.246)
    const [overrideTick, setOverrideTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setOverrideTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    // Sincronizar com strategyConfig dinâmico
    useEffect(() => {
        if (strategyConfig) {
            const isFour = strategyConfig.useFourDecimals !== undefined ? strategyConfig.useFourDecimals : useFourDecimals;
            if (strategyConfig.minPrice !== undefined) {
                setMinPrice(strategyConfig.minPrice > 0 ? strategyConfig.minPrice : '');
                setMinPriceStr(formatNumberPT(strategyConfig.minPrice, isFour));
            }
            if (strategyConfig.decrementValue !== undefined) {
                setMargin(strategyConfig.decrementValue);
                setMarginStr(formatNumberPT(strategyConfig.decrementValue, isFour));
            }
            if (strategyConfig.decrementType !== undefined) setMarginType(strategyConfig.decrementType);
            if (strategyConfig.mode !== undefined) setStrategy(strategyConfig.mode);
            if (strategyConfig.active !== undefined) setActive(strategyConfig.active);
            if (strategyConfig.useFourDecimals !== undefined) setUseFourDecimals(strategyConfig.useFourDecimals);
            if (strategyConfig.kamikazeMode !== undefined) setKamikazeMode(strategyConfig.kamikazeMode);
            if (strategyConfig.snipeDelaySeconds !== undefined) setSnipeDelaySeconds(strategyConfig.snipeDelaySeconds);
        }
    }, [strategyConfig]);

    // 🕒 CRONÔMETRO SUAVE: dataHoraFimContagem + clockSkew (sem flutuação, sem depender de segundosParaEncerramento)
    useEffect(() => {
        const endTimeStr = item.portalDataHoraFimContagem || item.dataHoraFimContagem;
        if (endTimeStr) {
            const endTime = new Date(endTimeStr).getTime();
            if (!isNaN(endTime)) {
                const tick = () => setTimeLeft(Math.max(0, (endTime - Date.now()) / 1000 + (clockSkew || 0)));
                tick();
                const interval = setInterval(tick, 100);
                return () => clearInterval(interval);
            }
        }
        const base = item.segundosParaEncerramento;
        if (base !== undefined && base !== null && base >= 0 && item.updatedAt) {
            const tick = () => setTimeLeft(Math.max(0, base - (Date.now() - item.updatedAt) / 1000));
            tick();
            const interval = setInterval(tick, 100);
            return () => clearInterval(interval);
        }
    }, [item.portalDataHoraFimContagem, item.dataHoraFimContagem, clockSkew, item.segundosParaEncerramento, item.updatedAt, item.itemId]);

    // 🎯 AUTO-FILL MARGEM OFICIAL DO GOVERNO
    useEffect(() => {
        if (item.officialMargin !== undefined && item.officialMargin !== null) {
            // Se a margem atual for menor que a oficial (ou for o valor default 1), forçamos a margem oficial!
            if (margin <= 1 || margin < item.officialMargin) {
                setMargin(item.officialMargin);
            }
        }
    }, [item.officialMargin]);

    useEffect(() => {
        if (item.officialMarginType !== undefined && item.officialMarginType !== null) {
            setMarginType(item.officialMarginType === 'P' ? 'percentage' : 'fixed');
        }
    }, [item.officialMarginType]);

    // O cronômetro agora é imortalizado pela extração automática de `dataHoraFimContagem` do Serpro.
    // Decrementador local apenas como fallback
    useEffect(() => {
        let interval: any;
        if (timeLeft > 0 && !item.dataHoraFimContagem) {
            interval = setInterval(() => {
                setTimeLeft(prev => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timeLeft, item.dataHoraFimContagem]);

    const handleSave = (extraParams = {}) => {
        const numMinPrice = Number(minPrice);
        const hasMin = minPrice !== '' && !isNaN(numMinPrice) && numMinPrice > 0;
        let nextActive = active;

        // Se o usuário desativou ou se não preencheu o mínimo, forçamos desativado
        if (!hasMin && active) {
            nextActive = false;
            setActive(false);
            toast.warning(`ITEM ${item.numero || item.itemId} DESATIVADO: Valor mínimo inválido ou não preenchido.`);
        }

        onSaveStrategy(sid, item.itemId, {
            mode: strategy,
            minPrice: hasMin ? numMinPrice : 0,
            decrementValue: Number(margin),
            decrementType: marginType,
            active: nextActive,
            useFourDecimals,
            kamikazeMode,
            snipeDelaySeconds,
            ...extraParams
        });
    };

    const handleToggle = () => {
        const numMinPrice = Number(minPrice);
        if (!minPrice || isNaN(numMinPrice) || numMinPrice <= 0) {
            toast.error('BLOQUEIO PRIMORDIAL: Defina um Valor Mínimo antes de ativar o robô!');
            return;
        }
        const newState = !active;
        setActive(newState);
        handleSave({ active: newState });
        
        if (newState) {
            toast.success(`ITEM ${item.numero || item.itemId} ATIVO`);
            // Se kamikaze ativado e bot ligado, dispara imediatamente
            if ((kamikazeMode || snipeDelaySeconds === 0) && !isWinning) {
                const currentBest = valorAtualDisplay;
                const numMin = numMinPrice;
                const beatingAmt = useFourDecimals ? 0.0001 : 0.01;
                const myCurrentBid = Number(item.meuValor || 0);
                
                // Margem obrigatória do Serpro
                const officialMarginVal = Number(item.officialMargin || 0);
                const officialMarginType = item.officialMarginType || 'V';
                const mandatorySerproMargin = officialMarginType === 'P' ? currentBest * (officialMarginVal / 100) : officialMarginVal;
                const serproLowestAllowed = myCurrentBid > 0 ? myCurrentBid - Math.max(mandatorySerproMargin, 0) : 999999999;
                
                let fireVal = 0;
                
                // 1) Tentar bater o líder
                if (currentBest > 0) {
                    const beatingBid = currentBest - beatingAmt;
                    const candidateBid = Math.max(numMin, Math.min(beatingBid, serproLowestAllowed));
                    if (candidateBid < currentBest && (myCurrentBid <= 0 || candidateBid < myCurrentBid)) {
                        fireVal = candidateBid;
                    }
                }
                
                // 2) Líder não batível (abaixo do mínimo) → procurar no ranking
                if (fireVal <= 0 && item.rankingLances && item.rankingLances.length > 0) {
                    const competitorBids = item.rankingLances
                        .filter(r => !r.eMeuLance)
                        .map(r => safeParseNumber(r.valor))
                        .filter(val => val > 0)
                        .sort((a, b) => a - b);
                    
                    for (const cBid of competitorBids) {
                        const beatingBid = cBid - beatingAmt;
                        const candidateBid = Math.max(numMin, Math.min(beatingBid, serproLowestAllowed));
                        if (candidateBid < cBid && (myCurrentBid <= 0 || candidateBid < myCurrentBid)) {
                            fireVal = candidateBid;
                            break;
                        }
                    }
                }
                
                // 3) Nada batível → usa mínimo
                if (fireVal <= 0) {
                    fireVal = numMin;
                }
                
                const myBid = meuValorDisplay;
                if (myBid <= 0 || fireVal < myBid) {
                    setTimeout(() => {
                        onManualBid(item.purchaseId, item.itemId, item.bidId, fireVal);
                        const mode = kamikazeMode ? 'KAMIKAZE' : 'SNIPER 0s';
                        toast.info(`💥 [${mode}] Disparando R$ ${fireVal.toFixed(4)} no Item ${item.numero || item.itemId}!`);
                    }, 500);
                }
            }
        } else {
            toast.warning(`ITEM ${item.numero || item.itemId} PAUSADO`);
        }
    };

    const handleManualBid = () => {
        const numMinPrice = safeParseNumber(minPrice);
        if (numMinPrice <= 0) {
            toast.error('BLOQUEIO PRIMORDIAL: Defina um Valor Mínimo antes de disparar o Gatilho!');
            return;
        }

        const currentBest = valorAtualDisplay;
        let val;

        const numDirectBid = safeParseNumber(directBidValue);
        if (numDirectBid > 0) {
            val = numDirectBid;
        } else {
            // Subtrai APENAS o mínimo para vencer (R$0,01 ou R$0,0001), não a margem configurada
            // A margem valida o degrau entre MEU lance anterior e o novo, não desconta do concorrente
            const beatingAmt = useFourDecimals ? 0.0001 : 0.01;
            val = currentBest > 0 ? currentBest - beatingAmt : numMinPrice;
        }

        // A Trava Primordial (aplica-se a directBidValue e ao cálculo)
        if (val < numMinPrice) {
            val = numMinPrice;
        }

        if (val < numMinPrice) {
            toast.error(`BLOQUEIO PRIMORDIAL: Lance de R$ ${val.toFixed(2)} é inferior ao Valor Mínimo de R$ ${numMinPrice.toFixed(2)}!`);
            return;
        }
        
        const myCurrentBid = meuValorDisplay;

        // Anti-Burrice: Se o usuário já tem um lance, não permitir mandar um lance PIOR ou IGUAL ao próprio lance
        if (!simulationMode && myCurrentBid > 0 && val >= myCurrentBid) {
            toast.error(`Lance Bloqueado: R$ ${val.toFixed(2)} não melhora o seu lance atual (R$ ${myCurrentBid.toFixed(2)}).`);
            return;
        }

        // Se estamos TENTANDO bater o líder (val < currentBest), verificamos a margem oficial do Serpro
        if (!simulationMode && currentBest > 0 && val < currentBest) {
            const officialMarginVal = safeParseNumber(item.officialMargin);
            const officialMarginType = item.officialMarginType || 'V';
            
            let requiredDecrement = 0;
            if (officialMarginVal > 0) {
                requiredDecrement = officialMarginType === 'P' ? currentBest * (officialMarginVal / 100) : officialMarginVal;
            }
            
            const actualDecrement = currentBest - val;
            if (actualDecrement < requiredDecrement - 0.0001) {
                toast.error(`Lance Bloqueado: O decremento (R$ ${actualDecrement.toFixed(2)}) é menor que o intervalo mínimo da sala (R$ ${requiredDecrement.toFixed(2)}). Erro 422 evitado.`);
                return;
            }
        }
        
        console.log(`🚀 [GATILHO MANUAL] Disparando R$ ${val} (Leader: ${currentBest}, DirectBid: ${directBidValue})`);
        onManualBid(item.purchaseId, item.itemId, item.bidId, val);
        setDirectBidValue(''); // Reseta após disparo
    };

    const formatTime = (seconds: number) => {
        if (seconds <= 0) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        if (h > 0) {
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`p-5 rounded-2xl border transition-all duration-300 mb-4 ${
            active 
                ? 'bg-white border-emerald-400 shadow-[0_10px_30px_-15px_rgba(16,185,129,0.2)]' 
                : 'bg-white border-slate-100 shadow-sm'
        }`}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center">
                <div className="col-span-1 md:col-span-3 flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-2 h-2 rounded-full ${isWinning ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                                ITEM {item.numero || item.itemId} <span className="text-slate-400 font-medium ml-1">— {item.desc || 'Sem Descrição'}</span>
                            </span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Badge variant="secondary" className={`text-[10px] font-bold uppercase px-2 py-1 ${
                                isWinning ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {isWinning ? 'LIDERANDO' : 'PERDENDO'}
                            </Badge>
                            
                            {item.inWarMode && (
                                <Badge className="text-[10px] font-bold uppercase px-2 py-1 bg-orange-500 text-white animate-pulse">
                                    ⚔️ GUERRA
                                </Badge>
                            )}
                            {item.dataSource === 'ws' && (
                                <Badge className="text-[10px] font-bold uppercase px-2 py-1 bg-blue-500 text-white">
                                    🌐 WS
                                </Badge>
                            )}
                            
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border transition-all ${
                                timeLeft < 30 && timeLeft > 0 && !isWinning 
                                    ? 'bg-red-500 text-white border-red-600 animate-bounce shadow-lg shadow-red-500/50' 
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                                <span className="text-[9px] font-black uppercase opacity-60">POSIÇÃO</span>
                                <span className="text-xs font-black">
                                    {posicaoReal}
                                    {/^\d+$/.test(String(posicaoReal || '')) ? 'º' : ''}
                                </span>
                            </div>

                            {/* Botão Classificação igual ao Siga */}
                            <button
                                onClick={() => setShowRankingModal(true)}
                                className="text-[10px] font-bold text-blue-500 hover:text-blue-700 underline underline-offset-2 transition-colors"
                                title="Ver melhores lances deste item"
                            >
                                Classificação
                                {rankingComputado.length > 0 && (
                                    <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-black">
                                        {rankingComputado.length}
                                    </span>
                                )}
                            </button>
                        </div>
                        {/* Mini-ranking Preview - mostra top 3 por participante */}
                        {rankingComputado.length > 0 && (
                            <div className="mt-3 flex flex-col gap-1 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Top 3 por Participante:</span>
                                {rankingComputado.slice(0, 3).map((lance: any, idx: number) => (
                                    <div key={idx} className={`flex justify-between items-center gap-2 ${lance.eMeuLance ? 'bg-blue-50 rounded px-1' : ''}`}>
                                        <span className="font-bold text-slate-600">
                                            {idx + 1}º {lance.eMeuLance ? <span className="text-blue-600 font-black">(Você)</span> : <span className="text-slate-400 font-medium">({lance.origem || 'Lance'})</span>}
                                        </span>
                                        <span className={`font-mono font-bold ${idx === 0 ? 'text-emerald-600' : lance.eMeuLance ? 'text-blue-600' : 'text-slate-700'}`}>
                                            R$ {Number(lance.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: useFourDecimals ? 4 : 2, maximumFractionDigits: useFourDecimals ? 4 : 2 })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-span-1 md:col-span-3 flex gap-4">
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1">
                            <span>⚠ Mínimo (R$)</span>
                            {(!minPrice || Number(minPrice) <= 0) && (
                                <span className="text-[8px] text-red-400 font-normal normal-case">obrigatório</span>
                            )}
                        </label>
                        <Input 
                            type="text"
                            className={`h-10 text-xs font-bold border-2 transition-colors ${
                                (!minPrice || Number(minPrice) <= 0)
                                    ? 'bg-red-50 border-red-300 focus:border-red-500 placeholder:text-red-300'
                                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            }`}
                            value={minPriceStr}
                            placeholder="Ex: 99.500,00"
                            onChange={(e) => {
                                const raw = e.target.value;
                                setMinPriceStr(raw);
                                const parsed = safeParseNumber(raw);
                                setMinPrice(parsed > 0 ? parsed : '');
                            }}
                            onBlur={() => {
                                const parsed = safeParseNumber(minPriceStr);
                                setMinPrice(parsed > 0 ? parsed : '');
                                setMinPriceStr(formatNumberPT(parsed, useFourDecimals));
                                handleSave({ minPrice: parsed });
                            }}
                            disabled={active}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                            <span className="flex items-center gap-1">
                                Margem 
                                {item.officialMargin && (
                                    <span className="text-[8px] text-slate-300 ml-1 font-mono">(Oficial: {item.officialMarginType === 'P' ? '%' : 'R$'} {item.officialMargin})</span>
                                )}
                            </span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md transition-all ${
                                marginType === 'percentage' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                                {marginType === 'percentage' ? '%' : 'R$'}
                            </span>
                        </label>
                        <Input 
                            type="text" 
                            className="h-10 text-xs font-bold bg-slate-50 border-slate-200" 
                            value={marginStr} 
                            placeholder="Ex: 1,00"
                            onChange={(e) => {
                                const raw = e.target.value;
                                setMarginStr(raw);
                                const parsed = safeParseNumber(raw);
                                setMargin(parsed > 0 ? parsed : 0);
                            }}
                            onBlur={() => {
                                const parsed = safeParseNumber(marginStr);
                                setMargin(parsed > 0 ? parsed : 0);
                                setMarginStr(formatNumberPT(parsed, useFourDecimals));
                                handleSave({ decrementValue: parsed });
                            }}
                            disabled={active}
                        />
                    </div>
                </div>

                <div className="col-span-1 md:col-span-3 grid grid-cols-2 gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Melhor {isWinning && <span className="text-blue-600 font-bold ml-1">(Você)</span>}
                        </span>
                        <span className={`text-lg font-bold tracking-tight ${isWinning ? 'text-emerald-500' : 'text-red-500'}`}>
                            R$ {valorAtualDisplay?.toLocaleString('pt-BR', { minimumFractionDigits: useFourDecimals ? 4 : 2 })}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Meu Lance {meuValorDisplay !== undefined && meuValorDisplay > 0 && <span className="text-blue-600 font-bold ml-1">(Você)</span>}
                        </span>
                        <span className="text-lg font-bold tracking-tight text-slate-800">
                            R$ {meuValorDisplay?.toLocaleString('pt-BR', { minimumFractionDigits: useFourDecimals ? 4 : 2 })}
                        </span>
                    </div>
                </div>

                <div className="col-span-1 md:col-span-3 flex flex-wrap md:flex-nowrap items-center justify-between md:justify-end gap-3 md:gap-5 border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                    {/* ⏱ TIMER DISPLAY: mostra countdown regressivo quando override ativo (v3.8.246) */}
                    {(() => {
                        const itemSid = item.sid || '';
                        const overrideKey = `${itemSid}_${item.itemId || item.numero}`;
                        const overrideTs = timerOverrideRef?.current?.[overrideKey] || 0;
                        const overrideLeft = overrideTs > 0 ? Math.max(0, 40 - Math.floor((Date.now() - overrideTs) / 1000)) : 0;
                        if (overrideLeft <= 0 && overrideTs > 0) { timerOverrideRef.current[overrideKey] = 0; }
                        const displaySeconds = overrideLeft > 0 ? overrideLeft : timeLeft;
                        return (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                                displaySeconds < 60 && displaySeconds > 0 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-600'
                            }`}>
                                <Clock className="w-4 h-4" />
                                <span className="text-sm font-bold font-mono">{formatTime(displaySeconds)}</span>
                                {overrideLeft > 0 && overrideLeft <= 10 && (
                                    <span className="text-[10px] font-black text-red-500 animate-ping">!</span>
                                )}
                            </div>
                        );
                    })()}
                    
                    {/* ⏱ Botão forçar 40s com countdown regressivo (v3.8.242) */}
                    {(() => {
                        const itemSid = item.sid || '';
                        const key = `${itemSid}_${item.itemId || item.numero}`;
                        const overrideTs = timerOverrideRef?.current?.[key] || 0;
                        const overrideActive = overrideTs > 0 && (Date.now() - overrideTs) < 40000;
                        const overrideLeft = overrideActive ? Math.max(0, 40 - Math.floor((Date.now() - overrideTs) / 1000)) : 0;
                        return (
                            <button
                                onClick={() => {
                                    timerOverrideRef.current[key] = overrideActive ? 0 : Date.now();
                                }}
                                className={`flex items-center gap-1 px-2.5 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                                    overrideActive
                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                                title={overrideActive ? `Timer forçado — ${overrideLeft}s restantes` : 'Forçar timer para 40s (sniper dispara na reta final)'}
                            >
                                <span>⏱</span>
                                <span>{overrideActive ? `${overrideLeft}s` : 'Forçar'}</span>
                            </button>
                        );
                    })()}

                    
                    <button 
                        onClick={handleToggle}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            active 
                                ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
                                : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                        }`}
                    >
                        {active ? <StopCircle className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5 fill-current" />}
                    </button>
                </div>

                <div className="col-span-12 flex gap-6 mt-2 pt-4 border-t border-slate-50">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id={`4dec-${item.itemId}`} 
                            checked={useFourDecimals}
                            onCheckedChange={(val) => { 
                                const nextFour = !!val;
                                setUseFourDecimals(nextFour); 
                                setMinPriceStr(formatNumberPT(safeParseNumber(minPriceStr), nextFour));
                                setMarginStr(formatNumberPT(safeParseNumber(marginStr), nextFour));
                                handleSave({ useFourDecimals: nextFour }); 
                            }}
                        />
                        <label htmlFor={`4dec-${item.itemId}`} className="text-[10px] font-bold text-slate-400 uppercase cursor-pointer hover:text-slate-600 transition-colors">Permitir 4 casas decimais</label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id={`kamikaze-${item.itemId}`} 
                            checked={kamikazeMode}
                            onCheckedChange={(val) => { setKamikazeMode(!!val); handleSave({ kamikazeMode: !!val }); }}
                        />
                        <label htmlFor={`kamikaze-${item.itemId}`} className="text-[10px] font-bold text-slate-400 uppercase cursor-pointer hover:text-slate-600 transition-colors">Modo Kamikaze (Sem Espera)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <label htmlFor={`snipeDelay-${item.itemId}`} className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Iniciar em</label>
                        <select
                            id={`snipeDelay-${item.itemId}`}
                            value={snipeDelaySeconds}
                            onChange={(e) => { const val = Number(e.target.value); setSnipeDelaySeconds(val); handleSave({ snipeDelaySeconds: val }); }}
                            className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            <option value={0}>0s (imediato)</option>
                            <option value={15}>15s</option>
                            <option value={30}>30s</option>
                            <option value={45}>45s</option>
                            <option value={60}>60s</option>
                            <option value={90}>90s</option>
                            <option value={120}>120s</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ===== MODAL RANKING: MELHORES LANCES DO ITEM (POR PARTICIPANTE) ===== */}
            {showRankingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowRankingModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <div>
                                <h2 className="text-sm font-bold text-slate-800">Ranking por Participante — Item {item.numero || item.itemId}</h2>
                                <p className="text-[10px] text-slate-400 mt-0.5">Melhor lance de cada fornecedor (menor vence)</p>
                            </div>
                            <button onClick={() => setShowRankingModal(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold leading-none">×</button>
                        </div>
                        <div className="overflow-y-auto flex-1 px-6 py-4">
                            {rankingComputado.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-slate-500 text-xs border-b">
                                            <th className="pb-2 font-bold w-8">#</th>
                                            <th className="pb-2 font-bold">Participante</th>
                                            <th className="pb-2 font-bold text-right">Melhor Lance</th>
                                            <th className="pb-2 font-bold text-right text-[10px]">Data/Hora</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rankingComputado.map((lance: any, idx: number) => (
                                            <tr key={idx} className={`border-b border-slate-50 transition-colors ${
                                                lance.eMeuLance
                                                    ? 'bg-blue-50 border-blue-100'
                                                    : idx === 0
                                                        ? 'bg-emerald-50'
                                                        : ''
                                            }`}>
                                                <td className="py-2.5 font-black text-slate-700">
                                                    {idx === 0 ? (
                                                        <span className="text-emerald-600">🏆</span>
                                                    ) : (
                                                        <span>{idx + 1}</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 text-slate-600">
                                                    {lance.eMeuLance ? (
                                                        <span className="text-blue-700 font-black flex items-center gap-1">
                                                            👤 Você
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-500">{lance.origem || 'Concorrente'}</span>
                                                    )}
                                                </td>
                                                <td className={`py-2.5 font-bold text-right ${
                                                    lance.eMeuLance ? 'text-blue-700' : idx === 0 ? 'text-emerald-600' : 'text-slate-800'
                                                }`}>
                                                    R$ {Number(lance.valor || 0).toLocaleString('pt-BR', {
                                                        minimumFractionDigits: 4,
                                                        maximumFractionDigits: 4
                                                    })}
                                                </td>
                                                <td className="py-2.5 text-slate-400 text-[10px] text-right">{lance.data || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                                    <span className="text-4xl">📊</span>
                                    <p className="text-sm font-medium">Nenhum lance registrado ainda.</p>
                                    <p className="text-xs text-center">Os lances aparecem aqui assim que o sistema detectar os dados via API.</p>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-3 border-t flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                                {rankingComputado.length > 0 ? `${rankingComputado.length} participante(s)` : 'Aguardando dados...'}
                            </span>
                            {posicaoComputada > 0 && (
                                <span className={`text-[11px] font-black px-3 py-1 rounded-full ${
                                    posicaoComputada === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    Sua Posição: {posicaoComputada}º
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
