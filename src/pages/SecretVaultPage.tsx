import { useState, useEffect } from 'react';
import { Shield, Key, Plus, Trash2, Lock, FileKey2, Loader2, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { useVaultStore } from '@/store/vault-store';
import { useKanbanStore } from '@/store/kanban-store';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SecretVaultPage() {
    const { credentials, isLoading, fetchCredentials, addCredential, deleteCredential } = useVaultStore();
    const { mainCompanies, fetchMainCompanyProfiles } = useKanbanStore();
    const { currentUser } = useAuthStore();
    
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form States
    const [alias, setAlias] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [password, setPassword] = useState('');
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        fetchMainCompanyProfiles();
    }, [fetchMainCompanyProfiles]);

    useEffect(() => {
        // Assume first ADM as default
        const mainCompany = mainCompanies.find(c => c.isDefault) || mainCompanies[0];
        if (mainCompany) {
            setCompanyId(mainCompany.id);
            fetchCredentials(mainCompany.id);
        }
    }, [mainCompanies, fetchCredentials]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (!selectedFile.name.endsWith('.pfx') && !selectedFile.name.endsWith('.p12')) {
                toast.error('O arquivo deve ser .pfx ou .p12');
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!alias || !companyId || !password || !file) {
            toast.error('Preencha todos os campos e selecione o arquivo.');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('alias', alias);
            formData.append('companyId', companyId);
            formData.append('password', password);
            formData.append('certificate', file);

            await addCredential(formData);
            toast.success('Certificado cadastrado com sucesso!');
            setIsAddModalOpen(false);
            resetForm();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao cadastrar certificado.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setAlias('');
        setPassword('');
        setFile(null);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta credencial? O robô não poderá mais dar lances com ela.')) {
            await deleteCredential(id);
            toast.success('Credencial removida.');
        }
    };

    return (
        <div className="flex-1 bg-[#020617] p-8 overflow-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                            <Shield className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tighter">Cofre de Certificados</h1>
                            <p className="text-slate-400 text-sm font-medium mt-1">Gerencie suas credenciais A1 (.pfx) com criptografia de nível militar.</p>
                        </div>
                    </div>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 px-6 rounded-xl shadow-lg transition-all hover:scale-105">
                                <Plus className="w-5 h-5 mr-2" />
                                Novo Certificado
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    <FileKey2 className="w-5 h-5 text-emerald-400" />
                                    Cadastrar Certificado A1
                                </DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    O arquivo será criptografado antes de ser armazenado.
                                </DialogDescription>
                            </DialogHeader>
                            
                            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Empresa / Detentor</Label>
                                    <Select value={companyId} onValueChange={setCompanyId}>
                                        <SelectTrigger className="bg-slate-950 border-white/5 h-11">
                                            <SelectValue placeholder="Selecione a empresa" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                                            {mainCompanies.map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.nome_fantasia || c.razao_social} ({c.cnpj})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Apelido da Credencial</Label>
                                    <Input 
                                        placeholder="Ex: Token Principal - Empresa X"
                                        value={alias}
                                        onChange={(e) => setAlias(e.target.value)}
                                        className="bg-slate-950 border-white/5 h-11"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Senha do PFX</Label>
                                    <div className="relative">
                                        <Input 
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="bg-slate-950 border-white/5 h-11 pl-10"
                                        />
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Arquivo do Certificado (.pfx)</Label>
                                    <Input 
                                        type="file"
                                        accept=".pfx,.p12"
                                        onChange={handleFileChange}
                                        className="bg-slate-950 border-white/5 h-11 file:bg-transparent file:text-emerald-400 file:font-bold file:border-none cursor-pointer"
                                    />
                                </div>

                                <DialogFooter className="pt-4">
                                    <Button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12">
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CRIPTOGRAFAR E SALVAR'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Grid Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-slate-900/40 border-white/5 backdrop-blur-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Status do Sistema</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-lg font-black text-white">PROTEGIDO</p>
                                    <p className="text-[10px] text-slate-500 font-bold">AES-256 BIT ENCRYPTION</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900/40 border-white/5 backdrop-blur-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Credenciais Ativas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                                    <Key className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-lg font-black text-white">{credentials.length}</p>
                                    <p className="text-[10px] text-slate-500 font-bold">TOKENS DISPONÍVEIS</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900/40 border-white/5 backdrop-blur-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Dica de Segurança</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                "Nunca compartilhe a senha do seu certificado. O Polaryon nunca solicitará sua senha por e-mail ou chat oficial."
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Credentials List */}
                <div className="space-y-4">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                        <Building2 className="w-4 h-4" /> Certificados Cadastrados
                    </h2>
                    
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 rounded-3xl border border-white/5 animate-pulse">
                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                            <p className="text-slate-500 font-bold">Sincronizando cofre...</p>
                        </div>
                    ) : credentials.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-white/10">
                            <div className="p-4 bg-slate-800 rounded-full mb-4">
                                <Key className="w-8 h-8 text-slate-600" />
                            </div>
                            <p className="text-white font-bold text-lg mb-1">Cofre Vazio</p>
                            <p className="text-slate-500 text-sm">Adicione um certificado A1 (.pfx) para começar a dar lances.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {credentials.map(cred => (
                                <div key={cred.id} className="group relative p-6 bg-slate-900/60 border border-white/5 rounded-2xl hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:scale-110 transition-transform">
                                                <FileKey2 className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold">{cred.alias}</h3>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-white/5 font-bold">
                                                        CNPJ: {cred.cnpj}
                                                    </span>
                                                    <span className="text-[10px] text-emerald-500 font-black flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> ATIVO
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleDelete(cred.id)}
                                            className="text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    
                                    <div className="absolute bottom-2 right-4 text-[9px] text-slate-700 font-mono">
                                        ID: {cred.id.substring(0,8)}...
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="flex items-center gap-4 p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                    <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                    <div>
                        <h4 className="text-amber-500 text-xs font-black uppercase tracking-widest">Informação Importante</h4>
                        <p className="text-slate-400 text-[11px] leading-relaxed mt-1">
                            O Polaryon utiliza criptografia simétrica AES para proteger seus certificados e senhas. Os dados são descriptografados apenas em tempo de execução no seu robô para autenticação junto ao portal Compras.gov.br.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
