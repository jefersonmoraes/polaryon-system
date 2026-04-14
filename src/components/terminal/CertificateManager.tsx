import React, { useState, useEffect } from 'react';
import { Key, Upload, Lock, ShieldCheck, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export function CertificateManager() {
    const [isDesktop] = useState(!!(window as any).electronAPI);
    const [hasCert, setHasCert] = useState(false);
    const [password, setPassword] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isDesktop) {
            checkCert();
        }
    }, [isDesktop]);

    const checkCert = async () => {
        const result = await (window as any).electronAPI.hasA1Certificate();
        setHasCert(result);
    };

    const handleUpload = async () => {
        if (!file || !password) {
            toast.error("Selecione o arquivo .pfx e digite a senha.");
            return;
        }

        setIsLoading(true);
        try {
            const buffer = await file.arrayBuffer();
            const result = await (window as any).electronAPI.saveA1Certificate({
                fileName: file.name,
                buffer: buffer,
                password: password
            });

            if (result.success) {
                toast.success("Certificado A1 configurado com sucesso! 🛡️");
                setHasCert(true);
                setFile(null);
                setPassword('');
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar certificado.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isDesktop) return null;

    return (
        <Card className="bg-slate-950/50 border-white/5 overflow-hidden">
            <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Certificado Digital A1</span>
                    </div>
                    {hasCert ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase">Configurado</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                            <AlertCircle className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase">Pendente</span>
                        </div>
                    )}
                </div>

                {!hasCert ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="cert-file" className="text-[10px] text-slate-500 uppercase font-bold">Arquivo .pfx / .p12</Label>
                            <Input 
                                id="cert-file" 
                                type="file" 
                                accept=".pfx,.p12"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="bg-slate-900 border-white/10 text-xs h-9 cursor-pointer"
                            />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="cert-pass" className="text-[10px] text-slate-500 uppercase font-bold">Senha do Certificado</Label>
                            <Input 
                                id="cert-pass" 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Senha privativa"
                                className="bg-slate-900 border-white/10 text-xs h-9"
                            />
                        </div>
                        <Button 
                            onClick={handleUpload} 
                            disabled={isLoading}
                            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9"
                        >
                            <Upload className="w-3 h-3 mr-2" />
                            SALVAR NO DISPOSITIVO
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <Lock className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Armazenamento Local</span>
                                <span className="text-xs text-slate-200 font-black">Criptografado & Ativo</span>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-600 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => {
                                if (confirm("Deseja remover o certificado deste dispositivo?")) {
                                    // Adicionar IPC para deletar se necessário, ou só deletar o arquivo active.pfx
                                    setHasCert(false);
                                }
                            }}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
