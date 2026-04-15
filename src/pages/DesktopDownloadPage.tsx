import { Monitor, Download, ShieldCheck, Zap, ArrowRight, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';

export default function DesktopDownloadPage() {
    const version = "1.2.42";
    const downloadUrl = `/download/Polaryon-v${version}-Setup.exe`;

    return (
        <div className="min-h-screen bg-[#020817] text-slate-100 p-6 md:p-12 overflow-hidden relative">
            {/* Background Glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto flex flex-col items-center gap-12 relative z-10">
                
                {/* Header Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold tracking-widest uppercase mb-4">
                        <Zap className="h-3 w-3" /> Polaryon Desktop v{version}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        PODER MÁXIMO NO <br /> SEU COMPUTADOR
                    </h1>
                    <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        O robô de lances local permite que você utilize seu próprio IP e assinatura digital física, 
                        eliminando bloqueios e garantindo 100% de estabilidade nas disputas.
                    </p>
                </motion.div>

                {/* Main Action Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                    
                    {/* Left: Download Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    <Monitor className="text-emerald-500" /> Instalador Windows
                                </CardTitle>
                                <CardDescription>
                                    Compatível com Windows 10 e 11 (64-bit)
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 bg-emerald-500/20 p-1 rounded-full"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div>
                                        <div>
                                            <p className="font-semibold">IP Local (Sua Conexão)</p>
                                            <p className="text-xs text-slate-500">O Governo vê o seu endereço, não o de um servidor.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 bg-emerald-500/20 p-1 rounded-full"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div>
                                        <div>
                                            <p className="font-semibold">Certificado A1 & Token</p>
                                            <p className="text-xs text-slate-500">Suporte total para assinaturas digitais locais.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 bg-emerald-500/20 p-1 rounded-full"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div>
                                        <div>
                                            <p className="font-semibold">Velocidade Extrema</p>
                                            <p className="text-xs text-slate-500">Tempo de resposta reduzido para lances de última hora.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-800 space-y-4">
                                    <a href={downloadUrl} download>
                                        <Button className="w-full h-16 text-lg font-bold gap-3 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]">
                                            <Download className="h-5 w-5" /> BAIXAR INSTALADOR AGORA
                                        </Button>
                                    </a>
                                    
                                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex gap-3">
                                        <Zap className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-slate-400 leading-snug">
                                            <span className="text-emerald-500 font-bold uppercase">Auto-Update Ativo:</span> Se você já possui o Polaryon instalado, ele atualizará <span className="text-white">automaticamente</span> para a v{version} em instantes. Basta manter o app aberto.
                                        </p>
                                    </div>
                                    
                                    <div className="p-2 rounded bg-amber-500/5 border border-amber-500/10 flex gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                        <p className="text-[9px] text-amber-500/70 leading-tight italic">
                                            Nota: Após um lançamento, o instalador leva cerca de 8 minutos para ser gerado. Se o download falhar, aguarde um momento e tente novamente.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Right: Installation Guide */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md h-full">
                            <CardHeader>
                                <CardTitle className="text-2xl flex items-center gap-2">
                                    <ShieldCheck className="text-blue-500" /> Guia de Instalação
                                </CardTitle>
                                <CardDescription>Siga os passos abaixo para ativar seu Robô</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm shrink-0">1</div>
                                        <div>
                                            <p className="font-bold">Baixe e Mantenha</p>
                                            <p className="text-sm text-slate-400">Ao clicar em baixar, o navegador pode perguntar se deseja manter o arquivo. Clique em <span className="text-emerald-500 font-bold underline">Manter</span>.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm shrink-0">2</div>
                                        <div>
                                            <p className="font-bold">Alerta SmartScreen (Importante)</p>
                                            <p className="text-sm text-slate-400">O Windows dirá que o arquivo é desconhecido. Clique em <span className="font-bold italic">"Mais Informações"</span> e depois em <span className="text-white font-bold underline">"Executar mesmo assim"</span>.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-emerald-400">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">3</div>
                                        <div>
                                            <p className="font-bold">Login & Robô</p>
                                            <p className="text-sm">Abra o instalador, conclua a instalação e faça login. Pronto! Seu Robô Local estará rodando.</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex gap-3">
                                    <AlertTriangle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-blue-300 leading-snug">
                                        Aviso de Segurança: Como o Polaryon é um software especializado de alta performance, o Windows realiza uma verificação de reputação. Este alerta sumirá em breve conforme a comunidade cresce.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Features Highlights */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {[
                        { icon: <Cpu />, label: "Baixo Consumo", sub: "Memória otimizada" },
                        { icon: <ShieldCheck />, label: "Seguro", sub: "Dados encriptados" },
                        { icon: <Monitor />, label: "Multi-Telas", sub: "Suporte 4K" },
                        { icon: <ArrowRight />, label: "Auto-Update", sub: "Sempre atualizado" },
                    ].map((item, i) => (
                        <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center text-center gap-2">
                            <div className="text-slate-400 h-5 w-5">{item.icon}</div>
                            <span className="text-xs font-bold whitespace-nowrap">{item.label}</span>
                            <span className="text-[10px] text-slate-500">{item.sub}</span>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
