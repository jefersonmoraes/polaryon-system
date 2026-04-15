import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Shield, AlertTriangle, Zap, Info } from 'lucide-react';

interface LogEntry {
    id: string;
    timestamp: string;
    level: 'info' | 'action' | 'threat' | 'success';
    message: string;
    source?: string;
}

interface TacticalLogProps {
    logs: LogEntry[];
}

export const TacticalLog: React.FC<TacticalLogProps> = ({ logs }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getLevelIcon = (level: LogEntry['level']) => {
        switch (level) {
            case 'action': return <Zap className="w-3 h-3 text-emerald-400" />;
            case 'threat': return <AlertTriangle className="w-3 h-3 text-red-500" />;
            case 'success': return <Shield className="w-3 h-3 text-blue-400" />;
            default: return <Info className="w-3 h-3 text-white/40" />;
        }
    };

    const getLevelStyle = (level: LogEntry['level']) => {
        switch (level) {
            case 'action': return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400';
            case 'threat': return 'border-red-500/30 bg-red-500/5 text-red-400';
            case 'success': return 'border-blue-500/30 bg-blue-500/5 text-blue-400';
            default: return 'border-white/10 bg-white/5 text-white/60';
        }
    };

    return (
        <div className="flex flex-col h-full bg-black/40 border border-emerald-900/20 rounded-lg overflow-hidden backdrop-blur-sm">
            <div className="px-3 py-2 border-b border-emerald-900/30 bg-emerald-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Operações em Tempo Real</span>
                </div>
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30" />
                </div>
            </div>

            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-3 space-y-2 font-mono scroll-smooth custom-scrollbar"
            >
                <AnimatePresence initial={false}>
                    {logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-2 rounded border text-[10px] flex items-start gap-2 ${getLevelStyle(log.level)}`}
                        >
                            <div className="mt-0.5 opacity-70">{getLevelIcon(log.level)}</div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-bold opacity-40">[{log.timestamp}]</span>
                                    {log.source && <span className="px-1 bg-white/10 rounded uppercase text-[8px]">{log.source}</span>}
                                </div>
                                <div className="leading-relaxed tracking-tight">{log.message}</div>
                            </div>
                        </motion.div>
                    ))}
                    {logs.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3 grayscale">
                             <Terminal className="w-12 h-12" />
                             <span className="text-[10px] uppercase font-bold tracking-widest">Aguardando Engajamento...</span>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
