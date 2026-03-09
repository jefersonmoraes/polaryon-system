import { useState, useEffect } from 'react';
import { useAuthStore, SystemUser, UserRole } from '@/store/auth-store';
import { toast } from 'sonner';
import {
    Users, ShieldAlert, KeyRound, Mail, Trash2,
    Save, Plus, ShieldCheck, RefreshCcw
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { AuditMetricsDash } from './AuditMetricsDash';
import api from '@/lib/api';

export default function AdminDashboardPage() {
    const { currentUser, addUser, updateUser, removeUser } = useAuthStore();
    const [systemsUsersDb, setSystemsUsersDb] = useState<SystemUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Prevent non-admins from rendering this (fallback as layout should protect it ideally)
    if (currentUser?.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    const [isAdding, setIsAdding] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('USER');
    const [newPerms, setNewPerms] = useState({ canView: true, canEdit: false, canDownload: false });

    // Fetch REAL users from PostgreSQL (Hetzner Nuvem)
    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const res = await api.get('/users');
            // Map the pure database user to our frontend structure
            const mappedUsers = res.data.map((u: any) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                photoURL: u.picture,
                role: u.role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER',
                permissions: u.role === 'admin'
                    ? { canView: true, canEdit: true, canDownload: true }
                    : { canView: true, canEdit: false, canDownload: false },
                status: u.role === 'disabled' ? 'disabled' : (u.role === 'pending' ? 'invited' : 'active'),
                createdAt: u.createdAt
            }));
            setSystemsUsersDb(mappedUsers);
        } catch (error) {
            console.error("Failed to load users", error);
            toast.error("Erro ao carregar a lista de usuários da Nuvem.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleAddUser = () => {
        if (!newEmail.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g)) {
            toast.error("Por favor, informe um e-mail válido.");
            return;
        }

        if (systemsUsersDb.some(u => u.email.toLowerCase() === newEmail.toLowerCase())) {
            toast.error("Este e-mail já está cadastrado no sistema.");
            return;
        }

        toast.info(
            "O novo sistema não exige pré-cadastro. Peça ao colaborador que faça Login com o Google diretamente, e seu e-mail aparecerá aqui para ser Aprovado (como Usuário Normal ou Administrador).",
            { duration: 8000 }
        );

        setIsAdding(false);
        setNewEmail('');
        setNewName('');
    };

    const togglePermission = (userId: string, perm: keyof SystemUser['permissions']) => {
        toast.info("Permissões individuais em breve. Por hora defina os Papéis via Nível (Admin/Normal).");
    };

    const toggleRole = async (userId: string) => {
        const user = systemsUsersDb.find(u => u.id === userId);
        if (user && user.id !== currentUser?.id) {
            const newRoleInDb = user.role === 'ADMIN' ? 'default' : 'admin';
            try {
                toast.loading("Alterando privilégios no Banco de Dados...", { id: `role-${userId}` });
                await api.put(`/users/${userId}/role`, { role: newRoleInDb });
                toast.success("Nível de acesso alterado na nuvem.", { id: `role-${userId}` });
                loadUsers(); // refresh the list
            } catch (error) {
                console.error(error);
                toast.error("Falha ao atualizar papel.", { id: `role-${userId}` });
            }
        }
    };

    const toggleStatus = async (userId: string) => {
        const user = systemsUsersDb.find(u => u.id === userId);
        if (user && user.id !== currentUser?.id) {
            const newRoleStatus = user.status === 'active' ? 'disabled' : (user.role === 'ADMIN' ? 'admin' : 'default');
            try {
                toast.loading(`${user.status === 'active' ? 'Desativando' : 'Ativando'} conta...`, { id: `status-${userId}` });
                await api.put(`/users/${userId}/role`, { role: newRoleStatus });
                toast.success(`Conta ${user.status === 'active' ? 'desativada bloqueando acesso' : 'ativada com sucesso'}.`, { id: `status-${userId}` });
                loadUsers();
            } catch (error) {
                console.error(error);
                toast.error("Falha ao atualizar status.", { id: `status-${userId}` });
            }
        }
    };

    const handleDeleteUser = (userId: string) => {
        if (userId === currentUser?.id) {
            toast.error("Você não pode excluir sua própria conta aqui.");
            return;
        }
        if (window.confirm("Certeza que deseja remover este acesso permanentemente?")) {
            toast.info("A exclusão definitiva será implementada na Fase 45. Por enquanto, Desative o Status da conta para revogar o acesso imediato.");
        }
    };

    return (
        <div className="h-full flex flex-col pt-6 px-8 max-w-7xl mx-auto animate-in fade-in duration-300 relative overflow-y-auto custom-scrollbar pb-10">
            <div className="flex justify-between items-end mb-8 relative z-10 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                        Acesso e Permissões
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie quem pode acessar o Polaryon, seus níveis de edição administrativa e permissões.
                    </p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-bold text-sm tracking-wide transition-all shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Cadastrar E-mail Autorizado
                    </button>
                )}
            </div>

            <div className="mb-10">
                <AuditMetricsDash />
            </div>

            {isAdding && (
                <div className="bg-neutral-900 border border-primary/20 p-6 rounded-xl mb-8 relative z-10 shadow-lg animate-in slide-in-from-top-4">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary" /> Adicionar Novo Acesso
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="text-xs uppercase font-bold text-muted-foreground mb-1.5 block">E-mail do Google (Conta de Login)</label>
                            <input
                                autoFocus
                                type="email"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                placeholder="exemplo@gmail.com"
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="text-xs uppercase font-bold text-muted-foreground mb-1.5 block">Nome do Colaborador (Opcional)</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Nome Completo"
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="bg-background rounded-lg p-4 border border-border flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <label className="text-xs uppercase font-bold text-muted-foreground mb-2 block">Nível de Acesso (Cargo)</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setNewRole('USER')}
                                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors ${newRole === 'USER' ? 'bg-secondary text-foreground' : 'bg-transparent text-muted-foreground border border-border/50 hover:bg-secondary/50'}`}
                                >
                                    <Users className="w-3.5 h-3.5" /> Normal
                                </button>
                                <button
                                    onClick={() => setNewRole('ADMIN')}
                                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors ${newRole === 'ADMIN' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-transparent text-muted-foreground border border-border/50 hover:bg-secondary/50'}`}
                                >
                                    <ShieldAlert className="w-3.5 h-3.5" /> Administrador
                                </button>
                            </div>
                        </div>

                        <div className="w-px bg-border hidden md:block" />

                        <div className="flex-[2]">
                            <label className="text-xs uppercase font-bold text-muted-foreground mb-3 block">Permissões Específicas {newRole === 'ADMIN' && '(Admins têm acesso total)'}</label>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 cursor-pointer opacity-50">
                                    <input type="checkbox" checked={newPerms.canView} readOnly className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4" />
                                    <span className="text-sm">Visualizar (Sempre)</span>
                                </label>
                                <label className={`flex items-center gap-2 cursor-pointer ${newRole === 'ADMIN' ? 'opacity-50' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={newRole === 'ADMIN' ? true : newPerms.canEdit}
                                        onChange={() => newRole !== 'ADMIN' && setNewPerms(p => ({ ...p, canEdit: !p.canEdit }))}
                                        disabled={newRole === 'ADMIN'}
                                        className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
                                    />
                                    <span className="text-sm">Editar e Inserir</span>
                                </label>
                                <label className={`flex items-center gap-2 cursor-pointer ${newRole === 'ADMIN' ? 'opacity-50' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={newRole === 'ADMIN' ? true : newPerms.canDownload}
                                        onChange={() => newRole !== 'ADMIN' && setNewPerms(p => ({ ...p, canDownload: !p.canDownload }))}
                                        disabled={newRole === 'ADMIN'}
                                        className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
                                    />
                                    <span className="text-sm">Exportar / Baixar PDFs</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                        <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-md transition-colors">Cancelar</button>
                        <button onClick={handleAddUser} className="px-5 py-2 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors flex items-center gap-2">
                            <Save className="w-4 h-4" /> Concluir e Enviar Convite
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-neutral-900 border border-border rounded-xl flex-1 flex flex-col relative z-10 shadow-lg mt-8">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-bold tracking-wider relative border-b border-border">
                            <tr>
                                <th className="px-5 py-3">Usuário</th>
                                <th className="px-5 py-3">E-mail</th>
                                <th className="px-5 py-3 text-center">Nível (Cargo)</th>
                                <th className="px-5 py-3">Permissões (Se Normal)</th>
                                <th className="px-5 py-3 text-center">Status</th>
                                <th className="px-5 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground animate-pulse">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCcw className="w-5 h-5 animate-spin text-primary" />
                                            Sincronizando Banco de Dados PostgreSQL...
                                        </div>
                                    </td>
                                </tr>
                            ) : systemsUsersDb.map(user => {
                                const isMe = user.id === currentUser?.id;
                                return (
                                    <tr key={user.id} className="hover:bg-secondary/30 transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-xs shrink-0 truncate overflow-hidden">
                                                    {user.photoURL ? <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground flex items-center gap-2">
                                                        {user.name}
                                                        {isMe && <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded uppercase">Você</span>}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">Adicionado em {new Date(user.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 font-mono text-xs">{user.email}</td>
                                        <td className="px-5 py-4 text-center">
                                            <button
                                                onClick={() => toggleRole(user.id)}
                                                disabled={isMe}
                                                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${user.role === 'ADMIN'
                                                    ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                                                    } ${isMe ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <span className="flex items-center gap-1.5 justify-center">
                                                    {user.role === 'ADMIN' ? <ShieldAlert className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                                    {user.role}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-5 py-4">
                                            {user.role === 'ADMIN' ? (
                                                <span className="text-xs text-muted-foreground italic flex items-center gap-1"><KeyRound className="w-3 h-3" /> Acesso Total</span>
                                            ) : (
                                                <div className="flex items-center gap-3 text-xs">
                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={user.permissions.canEdit}
                                                            onChange={() => togglePermission(user.id, 'canEdit')}
                                                            className="rounded text-primary focus:ring-primary h-3.5 w-3.5 bg-background border-border"
                                                        /> Escrever
                                                    </label>
                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={user.permissions.canDownload}
                                                            onChange={() => togglePermission(user.id, 'canDownload')}
                                                            className="rounded text-primary focus:ring-primary h-3.5 w-3.5 bg-background border-border"
                                                        /> Exportar
                                                    </label>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <button
                                                onClick={() => toggleStatus(user.id)}
                                                disabled={isMe}
                                                className={`text-xs font-bold px-2 py-1 rounded transition-colors ${user.status === 'active'
                                                        ? 'text-emerald-500 hover:bg-emerald-500/10'
                                                        : user.status === 'invited'
                                                            ? 'text-amber-500 hover:bg-amber-500/10 border border-amber-500/30'
                                                            : 'text-destructive hover:bg-destructive/10'
                                                    } ${isMe ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {user.status === 'active' ? 'Ativo' : (user.status === 'invited' ? 'Aprovar (Pendente)' : 'Desativado')}
                                            </button>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                disabled={isMe}
                                                className={`p-2 rounded hover:bg-destructive/10 text-destructive/50 hover:text-destructive transition-colors ${isMe ? 'opacity-0 cursor-default' : 'opacity-0 group-hover:opacity-100'}`}
                                                title="Excluir Usuário"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
