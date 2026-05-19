import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Activity, RefreshCw, Play, Square, Settings2, Target, Zap, Shield, Key, History, AlertTriangle, CheckCircle2, Plus as PlusIcon, Check, Trophy, ChevronDown, ChevronUp, Clock, XCircle, LogOut, Search, StopCircle, Briefcase } from 'lucide-react';
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
}

interface ItemStrategy {
    mode: 'follower' | 'sniper' | 'cover' | 'shadow';
    minPrice: number;
    decrementValue: number;
    decrementType: 'fixed' | 'percent';
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
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [itemStrategies, setItemStrategies] = useState<Record<string, ItemStrategy>>({});
    const [simulationMode, setSimulationMode] = useState(true);
    const { credentials, fetchCredentials: fetchVaultCredentials } = useVaultStore();
    const [selectedCredentialId, setSelectedCredentialId] = useState<string>('');
    const [modality, setModality] = useState<string>('05'); // Default: 05 - Pregão
    const [actionLogs, setActionLogs] = useState<any[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showRealModeWarning, setShowRealModeWarning] = useState(false);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [serverOffset, setServerOffset] = useState(0);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [coveredItems, setCoveredItems] = useState<Set<string>>(new Set());
    const [isDesktop] = useState(!!(window as any).electronAPI?.isDesktop);
    const [isLocalRunning, setIsLocalRunning] = useState(false);
    const [networkTraffic, setNetworkTraffic] = useState<any[]>([]);
    const [hybridRooms, setHybridRooms] = useState<string[]>([]);
    const [apiStatus, setApiStatus] = useState<string>('OFFLINE');
    const [uasgFilter, setUasgFilter] = useState('');
    const [lastAutoBidTimes, setLastAutoBidTimes] = useState<Record<string, number>>({});
    const [appVersion, setAppVersion] = useState('...');
    const [serverTime, setServerTime] = useState<number>(Date.now());

    useEffect(() => {
        if (isDesktop && (window as any).electronAPI) {
            (window as any).electronAPI.getAppVersion().then((v: string) => setAppVersion(v));
        }
    }, [isDesktop]);
    
    // 🧠 REFERÊNCIAS ESTÁVEIS PARA AUTOMAÇÃO (v3.5.89)
    const itemsRef = useRef(items);
    const configsRef = useRef<any>({});
    const lastBidTimesRef = useRef<Record<string, number>>({});

    useEffect(() => { 
        if (items && items.length > 0) {
            itemsRef.current = items; 
        }
    }, [items]);
    
    useEffect(() => { 
        configsRef.current = itemStrategies; 
        (window as any).polaryonStrategies = itemStrategies;
    }, [itemStrategies]);

    useEffect(() => { lastBidTimesRef.current = lastAutoBidTimes; }, [lastAutoBidTimes]);

    // 🎯 MOTOR DE SINCRONIA DE RELÓGIO v3.6.13
    useEffect(() => {
        const timer = setInterval(() => {
            setServerTime(Date.now() + serverOffset);
        }, 1000);
        return () => clearInterval(timer);
    }, [serverOffset]);

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
                // Garantimos que o ID bata (String ou Number)
                const sId = String(item.itemId);
                const strat = configs[sId] || configs[item.itemId] || {};
                const isActive = strat.active || false;
                
                if (!isActive) return;

                const tSeconds = Number(item.timerSeconds);
                if (isNaN(tSeconds)) return;

                // 🔍 LOG DE DIAGNÓSTICO ATIVO (v3.5.89)
                if (tSeconds <= 40 && tSeconds > 0) {
                    console.debug(`[SNIPER BRAIN] Item ${sId}: Tempo ${tSeconds}s | Perdedor: ${item.posicao !== '1'}`);
                }

                // 30 Segundos Finais
                if (tSeconds <= 30 && tSeconds > 0) {
                    const myBid = Number(item.meuValor || 99999999);
                    const bestBid = Number(item.valorAtual || 0);
                    
                    const isWinningByValue = (myBid > 0 && bestBid > 0 && myBid <= bestBid);
                    const isLosingPos = (item.posicao !== '1' && item.posicao !== '1º' && item.posicao !== 'V' && item.posicao !== 'VENCEDOR' && item.posicao !== '1°');
                    
                    // 🔥 LÓGICA DE DISPARO ULTRA-AGRESSIVA (Se a posição é desconhecida mas o valor indica perda, atira!)
                    const isLosing = isLosingPos || (!isWinningByValue && item.posicao === '?');
                    
                    if (isLosing) {
                        const now = Date.now();
                        const lastBid = lastAutoBidTimesLocal[sId] || lastAutoBidTimesLocal[item.itemId] || 0;
                        
                        const myMin = Number(strat.minPrice || 0);
                        const margin = Number(strat.decrementValue || 1);
                        const isKamikaze = strat.kamikazeMode || false;
                        const allow4 = strat.useFourDecimals || false;

                        let cooldown = isKamikaze ? 350 : 1500;
                        if (tSeconds <= 10) cooldown = 250; 

                        if (now - lastBid > cooldown) {
                            const currentBest = Number(item.valorAtual || 0);
                            const myCurrentBid = Number(item.meuValor || 999999999);
                            
                            // CALCULAR MARGEM OBRIGATÓRIA DO SERPRO
                            const officialMarginVal = Number(item.officialMargin || 0);
                            const officialMarginType = item.officialMarginType || 'V';
                            const mandatorySerproMargin = officialMarginType === 'P' ? myCurrentBid * (officialMarginVal / 100) : officialMarginVal;
                            
                            // O limite máximo que o Serpro aceita
                            const maxAllowedBidBySerpro = myCurrentBid - mandatorySerproMargin;
                            
                            let nextBid = 0;
                            const isLeaderBeatable = (currentBest > 0 && currentBest - margin >= myMin);
                            
                            if (isLeaderBeatable) {
                                nextBid = Math.min(currentBest - margin, maxAllowedBidBySerpro);
                            } else {
                                // Se não pode bater o líder, no mínimo ajusta para o maxAllowed ou myMin para continuar reduzindo
                                nextBid = Math.min(myMin, maxAllowedBidBySerpro);
                            }
                            
                            if (nextBid < myMin) nextBid = myMin;
                            nextBid = allow4 ? Math.floor(nextBid * 10000) / 10000 : Math.floor(nextBid * 100) / 100; // Floor para garantir q fica abaixo

                            if (nextBid > maxAllowedBidBySerpro) {
                                console.log(`[SNIPER] Lance bloqueado: R$ ${nextBid} viola margem Serpro (Máximo permitido: R$ ${maxAllowedBidBySerpro})`);
                            } else if (nextBid < myCurrentBid && nextBid >= myMin) {
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

                                handleSendBid(item.purchaseId, sId, item.bidId, nextBid, isKamikaze, allow4);
                                
                                const nowUpdate = Date.now();
                                lastBidTimesRef.current[sId] = nowUpdate;
                                setLastAutoBidTimes(prev => ({ ...prev, [sId]: nowUpdate }));
                            }
                        }
                    }
                }
            });
        }, 500); 

        return () => clearInterval(autoBidInterval);
    }, [isListening]);

    // MODO MULTI-UASG (v2.0 War Flow)
    const [sessions, setSessions] = useState<Record<string, {
        uasg: string;
        numero: string;
        items: BiddingItem[];
        chatMessages: any[];
        lastUpdate: string;
        isAuthenticated: boolean;
        simulationMode: boolean;
    }>>({});

    // [MODO SIGA v3.2] VIEW STATE
    const [viewMode, setViewMode] = useState<'card' | 'grid'>('grid');
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [modalityTab, setModalityTab] = useState<'PREGAO' | 'DISPENSA'>('DISPENSA');

    // --- MONITOR DE ATUALIZAÇÃO v3.5.37 ---
    const [updateInfo, setUpdateInfo] = useState<any>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);

    const handleManualBid = (purchaseId: string, itemId: string, bidId: string, value: number) => {
        handleSendBid(purchaseId, itemId, bidId, value);
        toast.info(`🚀 Gatilho Disparado: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    };

    const handleSendBid = (purchaseId: string, itemId: string, bidId: string, value: number, isKamikaze: boolean = false, allow4: boolean = false) => {
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
            await api.post(`/bidding/sessions/${targetSid}/items/${itemId}/bid`, { value });
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
                            itemsConfig: itemStrategies
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
            const aIsWinning = a.ganhador === 'Você' || String(a.posicao) === '1';
            const bIsWinning = b.ganhador === 'Você' || String(b.posicao) === '1';
            
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
                        itemMap.set(it.itemId, { ...(itemMap.get(it.itemId) || {}), ...it });
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

                    // 🔥 FUSÃO AGRESSIVA (v3.6.15)
                    // Se temos uma sala com UASG real, matamos qualquer outra que seja genérica ou duplicada
                    if (data.uasg && data.uasg !== 'LOGIN') {
                        Object.keys(updated).forEach(k => {
                            if (k !== sid && (updated[k].uasg === 'LOGIN' || updated[k].uasg === data.uasg)) {
                                delete updated[k];
                            }
                        });
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
                const { roomCode, items: newItems, timestamp } = data;
                
                // Força desbloqueio defensivo se dados de lances estão entrando (v3.6.45)
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
                    if (!sid) {
                        sid = `virtual_${roomCode}`;
                        updated[sid] = {
                            uasg: roomCode.substring(0, 6),
                            numero: parseInt(roomCode.substring(8, 13)),
                            ano: roomCode.substring(13, 17),
                            items: [],
                            sessionTitle: `SALA DETECTADA: ${roomCode.substring(0, 6)}`,
                            lastUpdate: timestamp
                        };
                    }

                    if (sid) {
                        const sessionData = updated[sid];
                        const existingItems = sessionData.items || [];
                        const itemMap = new Map(existingItems.map((it: any) => [String(it.id || it.itemId), it]));
                        
                        (newItems || []).forEach((it: any) => {
                            const key = String(it.itemId);
                            itemMap.set(key, { ...(itemMap.get(key) || {}), ...it, id: key });
                        });

                        updated[sid] = {
                            ...sessionData,
                            items: Array.from(itemMap.values()),
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

            (window as any).electronAPI.onBiddingUpdate(handleUpdate);
            (window as any).electronAPI.onBiddingChat(handleChat);
            
            if ((window as any).electronAPI.onBiddingError) {
                (window as any).electronAPI.onBiddingError((data: any) => {
                    const { sessionId: errSid, error, code, action } = data;
                    if (action === 'REQUIRE_REAUTH') {
                        setIsAuthenticated(false);
                        setIsListening(false);
                        toast.error(`⚠️ Queda de Sessão (Cod: ${code}): O token expirou ou falhou. Clique em "Continuar com Gov.br" para reconectar.`, { duration: 10000 });
                    } else {
                        toast.error(`[POLARYON MOTOR] ${error}`);
                    }
                });
            }

            if ((window as any).electronAPI.onPortalDataUpdate) {
                (window as any).electronAPI.onPortalDataUpdate(handlePortalSync);
            }

            if ((window as any).electronAPI.onBiddingNetworkTraffic) {
                (window as any).electronAPI.onBiddingNetworkTraffic((data: any) => {
                    setNetworkTraffic(prev => [data, ...(prev || [])].slice(0, 50));
                });
            }

            if ((window as any).electronAPI.onBiddingDetectedRoom) {
                (window as any).electronAPI.onBiddingDetectedRoom((data: any) => {
                    const { url } = data;
                    const match = url.match(/compra=(\d{6})06(\d{5})(\d{4})/);
                    if (match) {
                        const [, detectedUasg, detectedNum, detectedAno] = match;
                        setUasg(detectedUasg);
                        setNumeroPregao(detectedNum);
                        setAnoPregao(detectedAno);
                        toast.success(`Sala Detectada: UASG ${detectedUasg} - Pregão ${detectedNum}. Sincronizando... ⚡`);
                    }
                });
            }

            if ((window as any).electronAPI.onBiddingLoginFinished) {
                (window as any).electronAPI.onBiddingLoginFinished(() => {
                    toast.success("Login confirmado! Ocultando janela e iniciando radar silencioso... 🛡️");
                    setIsListening(true);
                    setIsAuthenticated(true);
                });
            }

            if ((window as any).electronAPI.onBiddingHybridDump) {
                (window as any).electronAPI.onBiddingHybridDump((pkg: any) => {
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

                                 const melhorGeral = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                                 const melhorMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
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
                                     itemId: item.identificador || (item.numero ? item.numero.toString() : '0'),
                                     valorAtual: melhorGeral, 
                                     meuValor: melhorMeu, 
                                     uasgName: uasgCode, 
                                     ganhador: isWinner ? 'Você' : 'Outro',
                                     status: item.situacao === '1' ? 'Disputa' : (item.situacao === '2' ? 'Iminência' : 'Encerrado'),
                                     position: pos, 
                                     timerSeconds: item.segundosParaEncerramento || -1, 
                                     desc: item.descricao || `Item ${item.numero}`,
                                     officialMargin: item.variacaoMinimaEntreLances || 1,
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
                });
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
        }
    }, [isDesktop, sessionId]);

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
            const isSimulated = sid.startsWith('virtual_') || sid.startsWith('HYBRID_');
            if (!isSimulated) {
                await api.patch(`/bidding/sessions/${sid}/items/${itemId}`, strategy);
            }
            setItemStrategies(prev => ({ ...prev, [itemId]: strategy }));
            if (isLocalRunning && (window as any).electronAPI) {
                (window as any).electronAPI.updateLocalBiddingConfig(sid, { itemsConfig: { ...itemStrategies, [itemId]: strategy } });
            }
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        if (sessionId && isLocalRunning && (window as any).electronAPI) {
            (window as any).electronAPI.updateLocalBiddingConfig(sessionId, { 
                itemsConfig: itemStrategies
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
                    (window as any).electronAPI.startVisualBidding({ sessionId: sid, uasg: u, numero: n, ano: a, vault: { itemsConfig: itemStrategies } });
                    setIsLocalRunning(true);
                }
            }
        } catch (e) { console.error(e); }
    };

    const checkUpdate = () => {
        if (isDesktop && (window as any).electronAPI) {
            (window as any).electronAPI.getAppVersion().then((v: string) => {
                toast.info(`Versão Atual: v${v}. Verificando servidores...`);
                (window as any).electronAPI.checkForUpdates();
            });
        } else {
            toast.warning("Verificação manual disponível apenas no Polaryon Desktop.");
        }
    };

    // --- MONITOR DE ATUALIZAÇÃO AUTOMÁTICA v3.6.10 ---
    useEffect(() => {
        if (isDesktop && (window as any).electronAPI) {
            const electron = (window as any).electronAPI;
            
            if (electron.onUpdateLog) {
                electron.onUpdateLog((msg: string) => {
                    console.log("[UPDATE-LOG]", msg);
                });
            }

            if (electron.onUpdateAvailable) {
                electron.onUpdateAvailable((info: any) => {
                    toast.success(`🚀 Nova versão v${info.version} disponível! Baixando automaticamente...`, {
                        position: "top-center",
                        autoClose: 10000
                    });
                });
            }

            if (electron.onUpdateDownloaded) {
                electron.onUpdateDownloaded((info: any) => {
                    toast.success(`✅ Versão v${info.version} baixada! O robô será reiniciado em instantes.`, {
                        position: "top-center",
                        autoClose: false
                    });
                });
            }
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
                    
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={checkUpdate}
                        className="h-9 border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
                    >
                        Verificar Atualizações
                    </Button>
                </div>
            </header>


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
            <div className="mt-8">
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
            </div>

                      <div className="space-y-6">
                {Object.entries(sessions).map(([sid, session]: [string, any]) => (
                    <Accordion type="single" collapsible key={sid} defaultValue="items">
                        <AccordionItem value="items" className="border rounded-xl bg-white shadow-sm overflow-hidden">
                            <AccordionTrigger className="px-6 py-4 hover:bg-slate-50 transition-all border-b">
                                <div className="flex items-center gap-4 w-full text-left">
                                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-black text-slate-900 uppercase">
                                                {session.sessionTitle || `UASG ${session.uasg} - ${session.numero}/${session.ano}`}
                                            </h3>
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-600 border-emerald-200 bg-emerald-50">Sessão Ativa</Badge>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                            {session.items?.length || 0} Itens Detectados • Sincronização Estável
                                        </p>
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
                                        session.items.map((item: any) => (
                                            <SigaItemRow 
                                                key={item.itemId || item.numero} 
                                                item={item} 
                                                sid={sid} 
                                                onSaveStrategy={onSaveStrategy}
                                                onManualBid={handleManualBid}
                                            />
                                        ))
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

function BiddingSigaView({ items, sessions, onSaveStrategy, onQuickBid, onStopRadar }: any) {
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
                <ProcessCard key={sid} sid={sid} session={session} items={groupedItems[sid] || []} onSaveStrategy={onSaveStrategy} onQuickBid={onQuickBid} onStopRadar={() => onStopRadar(sid)} appVersion="3.6.1" />
            ))}
        </div>
    );
}

function ProcessCard({ sid, session, items, onSaveStrategy, onQuickBid, onStopRadar }: any) {
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
                            <SigaItemRow key={item.itemId || item.numero} item={item} sid={sid} onSaveStrategy={onSaveStrategy} onManualBid={onQuickBid} />
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

function SigaItemRow({ item, sid, onSaveStrategy, onManualBid }: any) {
    const isWinning = item.ganhador === 'Você' || item.position === 1;
    
    const defaultMargin = item.officialMargin || 1.00;
    const defaultType = item.officialMarginType || 'fixed';

    const [minPrice, setMinPrice] = useState(item.minPrice || 0);
    const [margin, setMargin] = useState(item.decrementValue || defaultMargin);
    const [marginType, setMarginType] = useState(item.decrementType || defaultType);
    const [strategy, setStrategy] = useState<'follower' | 'sniper' | 'shadow'>(item.mode || 'follower');
    const [active, setActive] = useState(item.active || false);
    const [timeLeft, setTimeLeft] = useState(item.timerSeconds || 0);

    const [useFourDecimals, setUseFourDecimals] = useState(item.useFourDecimals || false);
    const [kamikazeMode, setKamikazeMode] = useState(item.kamikazeMode || false);
    const [manualTime, setManualTime] = useState('');

    // 🔥 FIX CRONÔMETRO: Sincronia absoluta
    useEffect(() => {
        if (item.timerSeconds !== undefined && item.timerSeconds !== null && item.timerSeconds > 0) {
            setTimeLeft(item.timerSeconds);
        }
    }, [item.timerSeconds]);

    // ✨ AJUSTE MANUAL DE TEMPO (v3.5.80)
    const handleManualTimeSync = (val: string) => {
        setManualTime(val);
        if (val.length >= 4) {
            try {
                const parts = val.replace(/\D/g, '').match(/.{1,2}/g);
                if (parts && parts.length >= 2) {
                    const h = parseInt(parts[0]);
                    const m = parseInt(parts[1]);
                    const s = parts[2] ? parseInt(parts[2]) : 0;
                    
                    const now = new Date();
                    const target = new Date();
                    target.setHours(h, m, s, 0);
                    
                    // Se o horário já passou hoje, assume que é para o dia seguinte (ex: amanhã cedo)
                    if (target.getTime() <= now.getTime()) {
                        target.setDate(target.getDate() + 1);
                    }
                    
                    const diff = Math.floor((target.getTime() - now.getTime()) / 1000);
                    if (diff > 0) {
                        setTimeLeft(diff);
                        toast.success(`CRONÔMETRO SINCRONIZADO PARA ${h}:${m}:${s}`);
                    }
                }
            } catch (e) { console.error('Erro ao sincronizar tempo manual', e); }
        }
    };

    useEffect(() => {
        let interval: any;
        if (timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timeLeft]);

    const handleSave = (extraParams = {}) => {
        onSaveStrategy(sid, item.itemId, {
            mode: strategy,
            minPrice: Number(minPrice),
            decrementValue: Number(margin),
            decrementType: marginType,
            active: active,
            useFourDecimals,
            kamikazeMode,
            ...extraParams
        });
    };

    const handleToggle = () => {
        const newState = !active;
        setActive(newState);
        handleSave({ active: newState });
        
        if (newState) toast.success(`ITEM ${item.itemId} ATIVO`);
        else toast.warning(`ITEM ${item.itemId} PAUSADO`);
    };

    const handleManualBid = () => {
        const currentBest = Number(item.valorAtual || 0);
        let marginVal = Number(margin);
        if (marginType === 'percentage') marginVal = currentBest * (marginVal / 100);
        
        // 🔥 LÓGICA VENCEDORA: Sempre subtrai do MELHOR lance atual
        let val = currentBest - marginVal;
        
        if (minPrice > 0 && val < Number(minPrice)) val = Number(minPrice);
        
        console.log(`🚀 [GATILHO MANUAL] Disparando R$ ${val} (Leader: ${currentBest}, Margin: ${marginVal})`);
        onManualBid(item.purchaseId, item.itemId, item.bidId, val);
    };

    const formatTime = (seconds: number) => {
        if (seconds <= 0) return '00:00:00';
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
            <div className="grid grid-cols-12 gap-8 items-center">
                <div className="col-span-3 flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-2 h-2 rounded-full ${isWinning ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                                ITEM {item.itemId} <span className="text-slate-400 font-medium ml-1">— {item.desc || 'Sem Descrição'}</span>
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Badge variant="secondary" className={`text-[10px] font-bold uppercase px-2 py-1 ${
                                isWinning ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {isWinning ? 'LIDERANDO' : 'PERDENDO'}
                            </Badge>
                            
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border transition-all ${
                                timeLeft < 30 && timeLeft > 0 && !isWinning 
                                    ? 'bg-red-500 text-white border-red-600 animate-bounce shadow-lg shadow-red-500/50' 
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                                <span className="text-[9px] font-black uppercase opacity-60">POSIÇÃO</span>
                                <span className="text-xs font-black">{item.posicao || '?'}º</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-span-3 flex gap-4">
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Mínimo (R$)</label>
                        <Input 
                            type="number" 
                            className="h-10 text-xs font-bold bg-slate-50 border-slate-200" 
                            value={minPrice} 
                            onChange={(e) => setMinPrice(Number(e.target.value))}
                            onBlur={() => handleSave()}
                            step={useFourDecimals ? "0.0001" : "0.01"}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Margem</label>
                        <Input 
                            type="number" 
                            className="h-10 text-xs font-bold bg-slate-50 border-slate-200" 
                            value={margin} 
                            onChange={(e) => setMargin(Number(e.target.value))}
                            onBlur={() => handleSave()}
                            step={useFourDecimals ? "0.0001" : "0.01"}
                        />
                    </div>
                </div>

                <div className="col-span-3 grid grid-cols-2 gap-4 border-l border-slate-100 pl-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Melhor</span>
                        <span className={`text-lg font-bold tracking-tight ${isWinning ? 'text-emerald-500' : 'text-red-500'}`}>
                            R$ {item.valorAtual?.toLocaleString('pt-BR', { minimumFractionDigits: useFourDecimals ? 4 : 2 })}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Meu Lance</span>
                        <span className="text-lg font-bold tracking-tight text-slate-800">
                            R$ {item.meuValor?.toLocaleString('pt-BR', { minimumFractionDigits: useFourDecimals ? 4 : 2 })}
                        </span>
                    </div>
                </div>

                <div className="col-span-3 flex items-center justify-end gap-5">
                    <div className="flex flex-col gap-1">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                            timeLeft < 60 && timeLeft > 0 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-600'
                        }`}>
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-bold font-mono">{formatTime(timeLeft)}</span>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Ajuste HH:mm"
                            className="text-[9px] font-bold text-center bg-transparent border-b border-slate-200 outline-none focus:border-emerald-400 text-slate-400"
                            value={manualTime}
                            onChange={(e) => handleManualTimeSync(e.target.value)}
                        />
                    </div>
                    
                    <Button 
                        size="sm" 
                        onClick={handleManualBid}
                        className="h-10 px-4 text-[10px] font-bold uppercase bg-slate-900 hover:bg-black text-white"
                    >
                        Gatilho
                    </Button>
                    
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
                            onCheckedChange={(val) => { setUseFourDecimals(!!val); handleSave({ useFourDecimals: !!val }); }}
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
                </div>
            </div>
        </div>
    );
}
