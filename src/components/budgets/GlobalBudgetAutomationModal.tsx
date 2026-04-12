import { BudgetStatus, KanbanList } from '@/types/kanban';
import { useKanbanStore } from '@/store/kanban-store';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Plus, Trash2, Layout, Settings2, CheckCircle2, Clock, XCircle, FileSearch, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const statusIcons: Record<BudgetStatus, React.ReactNode> = {
  Aguardando: <Clock className="h-4 w-4" />,
  Cotado: <FileSearch className="h-4 w-4" />,
  Aprovado: <CheckCircle2 className="h-4 w-4" />,
  Recusado: <XCircle className="h-4 w-4" />,
};

const statusColors: Record<BudgetStatus, string> = {
  Aguardando: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  Cotado: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  Aprovado: 'text-green-500 bg-green-500/10 border-green-500/20',
  Recusado: 'text-red-500 bg-red-500/10 border-red-500/20',
};

const GlobalBudgetAutomationModal = ({ onClose }: Props) => {
  const { lists, boards, updateList } = useKanbanStore();
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<BudgetStatus>('Aguardando');

  // Encontrar todas as automações de orçamento em todas as listas
  const globalRules = lists.flatMap(list => {
    const budgetAutoms = (list.automations || []).filter(a => a.type === 'change-budget-status');
    return budgetAutoms.map(a => ({
      listId: list.id,
      listTitle: list.title,
      boardName: boards.find(b => b.id === list.boardId)?.name || 'Quadro',
      status: a.targetBudgetStatus as BudgetStatus
    }));
  });

  const handleAddRule = () => {
    if (!selectedListId) {
      toast.error('Selecione uma lista de destino');
      return;
    }

    const targetList = lists.find(l => l.id === selectedListId);
    if (!targetList) return;

    const currentAutoms = targetList.automations || [];
    
    // Evitar duplicados para a mesma lista
    if (currentAutoms.some(a => a.type === 'change-budget-status')) {
        toast.error('Esta lista já possui uma regra de orçamento. Remova a antiga primeiro.');
        return;
    }

    const newAction = {
      type: 'change-budget-status' as const,
      targetBudgetStatus: selectedStatus,
    };

    updateList(selectedListId, { 
        automations: [...currentAutoms, newAction] 
    });
    
    toast.success('Regra global ativada para esta lista');
    setSelectedListId('');
  };

  const handleRemoveRule = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const updated = (list.automations || []).filter(a => a.type !== 'change-budget-status');
    updateList(listId, { automations: updated });
    toast.info('Regra removida');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="bg-card border border-border rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Premium */}
        <div className="p-8 border-b border-border bg-gradient-to-br from-primary/10 via-transparent to-transparent relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
             <Zap className="h-32 w-32 text-primary" />
          </div>
          
          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20">
                <Zap className="h-7 w-7 fill-current" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight uppercase italic">Automações Globais</h2>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest opacity-60">Motor de Status Inteligente</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-full transition-all hover:rotate-90 text-muted-foreground"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-8 bg-secondary/5">
          
          {/* Form Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <Plus className="h-4 w-4" /> 
                Criar Nova Regra de Fluxo
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Se o cartão entrar na fase:</label>
                
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger className="w-full bg-secondary/30 border-border/50 rounded-xl px-4 py-6 text-sm font-bold focus:ring-primary/20 transition-all shadow-inner h-auto">
                    <SelectValue placeholder="Selecione uma fase do funil..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card/95 backdrop-blur-xl border-border rounded-xl shadow-2xl z-[110]">
                    {boards.map(board => (
                      <SelectGroup key={board.id}>
                        <SelectLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 py-3 bg-secondary/20 px-4">
                          {board.name}
                        </SelectLabel>
                        {lists.filter(l => l.boardId === board.id).map(list => (
                          <SelectItem 
                            key={list.id} 
                            value={list.id}
                            className="font-bold py-3 px-4 focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
                          >
                            {list.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Mudar Orçamento para:</label>
                <div className="flex gap-2">
                    {(['Aguardando', 'Cotado', 'Aprovado', 'Recusado'] as BudgetStatus[]).map(status => (
                        <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={`flex-1 p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 group ${selectedStatus === status ? statusColors[status].replace('border-', 'border-').replace('/10', '/30') : 'bg-secondary/20 border-transparent grayscale opacity-40 hover:grayscale-0 hover:opacity-100 hover:bg-secondary/40'}`}
                            title={status}
                        >
                            <div className="p-1.5 rounded-lg bg-background/50 group-hover:scale-110 transition-transform">
                                {statusIcons[status]}
                            </div>
                            <span className="text-[8px] font-black uppercase">{status}</span>
                        </button>
                    ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleAddRule}
              className="w-full bg-primary text-primary-foreground h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3"
            >
              <Zap className="h-4 w-4 fill-current" />
              Ativar Automação de Fluxo
            </button>
          </div>

          {/* Active Rules List */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                <Layout className="h-4 w-4" /> 
                Escopo de Regras Ativas ({globalRules.length})
            </h3>
            
            {globalRules.length === 0 ? (
                <div className="text-center py-16 bg-card border-2 border-dashed border-border/50 rounded-3xl">
                    <Settings2 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4 animate-pulse" />
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Nenhuma regra configurada ainda.</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase">Defina o comportamento automático acima.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {globalRules.map((rule, idx) => (
                        <motion.div
                            key={`${rule.listId}-${rule.status}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between group hover:shadow-lg hover:border-primary/20 transition-all"
                        >
                            <div className="flex items-center gap-5 min-w-0">
                                <div className="hidden sm:flex flex-col items-center">
                                    <div className="h-10 w-1 pt-1 bg-primary/20 rounded-full" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
                                        <span className="text-[9px] font-black bg-secondary px-2 py-0.5 rounded text-muted-foreground uppercase shrink-0 truncate max-w-[100px]">{rule.boardName}</span>
                                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                                        <span className="text-sm font-black truncate">{rule.listTitle}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground/50 italic">Status Alvo:</span>
                                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-tighter shadow-sm ${statusColors[rule.status]}`}>
                                            {statusIcons[rule.status]}
                                            {rule.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemoveRule(rule.listId)}
                                className="p-3 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all group-hover:scale-105"
                                title="Desativar Regra"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </motion.div>
                    ))}
                </div>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div className="p-6 bg-primary/5 border-t border-border mt-auto">
            <div className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-[0.3em] opacity-50 italic">
                Polaryon Engine - Inteligência de Pipeline ⚡
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default GlobalBudgetAutomationModal;
