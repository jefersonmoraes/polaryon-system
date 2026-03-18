import { useState, useEffect } from 'react';
import { useAuthStore, SystemUser, UserRole } from '@/store/auth-store';
import { toast } from 'sonner';
import {
    Users, ShieldAlert, KeyRound, Mail, Trash2,
    Save, Plus, ShieldCheck, RefreshCcw, LayoutDashboard, Monitor
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { AuditMetricsDash } from './AuditMetricsDash';
import api from '@/lib/api';

const AVAILABLE_SCREENS = [
    { id: 'DASHBOARD', label: 'Painel Inicial' },
    { id: 'KUNBUN', label: 'Quadros Kanban' },
    { id: 'OPORTUNIDADES', label: 'Oportunidades' },
    { id: 'CALENDAR', label: 'Agenda Global' },
    { id: 'TEAM', label: 'Equipe' },
    { id: 'SUPPLIERS', label: 'Empresas' },
    { id: 'DOCUMENTATION', label: 'Documentação' },
    { id: 'ACCOUNTING', label: 'Contábil' },
    { id: 'BUDGETS', label: 'Orçamentos Financeiros' }
];

export default function AdminDashboardPage() {
    const { currentUser, addUser, updateUser, removeUser, onlineUsers } = useAuthStore();
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
                role: u.role.toUpperCase() === 'ADMIN' ? 'ADMIN' : (u.role.toUpperCase() === 'CONTADOR' ? 'CONTADOR' : 'USER'),
                permissions: u.permissions || (u.role === 'admin'
                    ? { canView: true, canEdit: true, canDownload: true, allowedScreens: ['ALL'] }
                    : (u.role === 'contador'
                        ? { canView: true, canEdit: false, canDownload: true, allowedScreens: ['ACCOUNTING'] }
                        : { canView: true, canEdit: false, canDownload: false, allowedScreens: ['DASHBOARD', 'KUNBUN', 'OPORTUNIDADES', 'CALENDAR', 'TEAM', 'SUPPLIERS', 'DOCUMENTATION', 'ACCOUNTING', 'BUDGETS'] })),
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

    const handleAddUser = async () => {
        if (!newEmail.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g)) {
            toast.error("Por favor, informe um e-mail válido.");
            return;
        }

        if (systemsUsersDb.some(u => u.email.toLowerCase() === newEmail.toLowerCase())) {
            toast.error("Este e-mail já está cadastrado no sistema.");
            return;
        }

        try {
            toast.loading("Autorizando e-mail...", { id: 'add-email' });
            await api.post('/users', {
                email: newEmail.toLowerCase(),
                name: newEmail.split('@')[0],
                role: 'pending' // Creates directly as pending
            });
            toast.success("E-mail autorizado com sucesso. Status: Pendente.", { id: 'add-email' });
            loadUsers();
            setIsAdding(false);
            setNewEmail('');
        } catch (error) {
            console.error(error);
            toast.error("Erro ao autorizar e-mail.", { id: 'add-email' });
        }
    };

    const togglePermission = async (userId: string, perm: keyof SystemUser['permissions']) => {
        const user = systemsUsersDb.find(u => u.id === userId);
        if (!user) return;

        const newPermissions = {
            ...user.permissions,
            [perm]: !user.permissions[perm]
        };

        try {
            toast.loading("Atualizando permissão...", { id: `perm-${userId}` });
            await api.put(`/users/${userId}/role`, { permissions: newPermissions });
            toast.success("Permissão atualizada na nuvem.", { id: `perm-${userId}` });
            loadUsers();
        } catch (error) {
            console.error(error);
            toast.error("Falha ao atualizar permissão.", { id: `perm-${userId}` });
        }
    };

    const toggleScreenAccess = async (userId: string, screenId: string) => {
        const user = systemsUsersDb.find(u => u.id === userId);
        if (!user) return;

        let currentScreens = user.permissions.allowedScreens || [];
        if (currentScreens.includes('ALL')) return; // Avoid toggling if they have ALL

        const hasScreen = currentScreens.includes(screenId);

        const newScreens = hasScreen
            ? currentScreens.filter(s => s !== screenId)
            : [...currentScreens, screenId];

        const newPermissions = {
            ...user.permissions,
            allowedScreens: newScreens
        };

        try {
            await api.put(`/users/${userId}/role`, { permissions: newPermissions });
            loadUsers();
        } catch (error) {
            console.error(error);
            toast.error("Falha ao atualizar acesso à tela.");
        }
    };

    const toggleRole = async (userId: string) => {
        const user = systemsUsersDb.find(u => u.id === userId);
        if (user && user.id !== currentUser?.id) {
            let newRoleInDb = 'default';
            if (user.role === 'USER') newRoleInDb = 'contador';
            else if (user.role === 'CONTADOR') newRoleInDb = 'admin';

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

    const handleDeleteUser = async (userId: string) => {
        if (userId === currentUser?.id) {
            toast.error("Você não pode excluir sua própria conta aqui.");
            return;
        }
        if (window.confirm("Certeza absoluta que deseja remover este acesso PRMANENTEMENTE da nuvem?")) {
            try {
                toast.loading("Excluindo usuário permanentemente...", { id: `del-${userId}` });
                await api.delete(`/users/${userId}`);
                toast.success("Usuário excluído definitivamente.", { id: `del-${userId}` });
                loadUsers();
            } catch (error) {
                console.error(error);
                toast.error("Erro ao excluir usuário da base de dados.", { id: `del-${userId}` });
            }
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

                    <div className="mb-6">
                        <label className="text-xs uppercase font-bold text-muted-foreground mb-1.5 block">E-mail a ser Autorizado</label>
                        <input
                            autoFocus
                            type="email"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            placeholder="exemplo@gmail.com"
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Ao registrar este e-mail, ele aparecerá na lista como <strong>Pendente</strong>. Assim que o usuário realizar o primeiro login com o Google, o acesso dele será alterado automaticamente para <strong>Ativo</strong>.
                        </p>
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
                                                         <div className={`w-2 h-2 rounded-full shrink-0 ${onlineUsers.includes(user.id) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-500/30'}`} title={onlineUsers.includes(user.id) ? 'Online agora' : 'Offline'} />
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
                                                    : user.role === 'CONTADOR'
                                                        ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
                                                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                                                    } ${isMe ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <span className="flex items-center gap-1.5 justify-center">
                                                    {user.role === 'ADMIN' ? <ShieldAlert className="w-3 h-3" /> : (user.role === 'CONTADOR' ? <KeyRound className="w-3 h-3" /> : <Users className="w-3 h-3" />)}
                                                    {user.role}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-5 py-4">
                                            {user.role === 'ADMIN' ? (
                                                <span className="text-xs text-muted-foreground italic flex items-center gap-1"><KeyRound className="w-3 h-3" /> Acesso Total</span>
                                            ) : user.role === 'CONTADOR' ? (
                                                <span className="text-xs text-muted-foreground italic flex items-center gap-1"><KeyRound className="w-3 h-3" /> Acesso Exportação</span>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-3 text-xs mb-1">
                                                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={user.permissions.canEdit}
                                                                onChange={() => togglePermission(user.id, 'canEdit')}
                                                                className="rounded text-primary focus:ring-primary h-3.5 w-3.5 bg-background border-border"
                                                            /> Escrever e Excluir
                                                        </label>
                                                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={user.permissions.canDownload}
                                                                onChange={() => togglePermission(user.id, 'canDownload')}
                                                                className="rounded text-primary focus:ring-primary h-3.5 w-3.5 bg-background border-border"
                                                            /> Exportar Planilhas
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center gap-1 bg-muted/40 p-1.5 rounded-md border border-border/50">
                                                        <Monitor className="w-3 h-3 text-muted-foreground ml-1" />
                                                        <div className="flex flex-wrap gap-1 ml-1.5 flex-1">
                                                            {AVAILABLE_SCREENS.map(screen => {
                                                                const hasAccess = user.permissions.allowedScreens?.includes('ALL') || user.permissions.allowedScreens?.includes(screen.id);
                                                                return (
                                                                    <button
                                                                        key={screen.id}
                                                                        onClick={() => toggleScreenAccess(user.id, screen.id)}
                                                                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${hasAccess ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-background border border-border text-muted-foreground hover:bg-secondary'}`}
                                                                        title={`Ativar/Desativar: ${screen.label}`}
                                                                    >
                                                                        {screen.label}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
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
