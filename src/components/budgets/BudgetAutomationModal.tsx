import { Budget, BudgetStatus, KanbanList } from '@/types/kanban';
import { useKanbanStore } from '@/store/kanban-store';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Plus, Trash2, Layout, Settings2, CheckCircle2, Clock, XCircle, FileSearch } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  budget: Budget;
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

const BudgetAutomationModal = ({ budget, onClose }: Props) => {
  const { lists, boards, updateBudget } = useKanbanStore();
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<BudgetStatus>('Aguardando');

  const activeAutomations = budget.automations || [];

  const handleAddRule = () => {
    if (!selectedListId) {
      toast.error('Selecione uma lista de destino');
      return;
    }

    // Check if rule already exists for this list
    if (activeAutomations.some(a => a.listId === selectedListId)) {
        toast.error('Já existe uma automação para esta lista');
        return;
    }

    const newAutomation = {
      type: 'kanban-move-status' as const,
      listId: selectedListId,
      status: selectedStatus,
    };

    updateBudget(budget.id, { 
        automations: [...activeAutomations, newAutomation] 
    });
    
    toast.success('Regra de automação adicionada');
    setSelectedListId('');
  };

  const handleRemoveRule = (listId: string) => {
    const updated = activeAutomations.filter(a => a.listId !== listId);
    updateBudget(budget.id, { automations: updated });
    toast.info('Regra removida');
  };

  const getListName = (id: string) => {
    const list = lists.find(l => l.id === id);
    if (!list) return 'Lista não encontrada';
    const board = boards.find(b => b.id === list.boardId);
    return `${board?.name || 'Quadro'} > ${list.title}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Automações de Status</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Vincule movimentos no Kanban ao status do orçamento</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="mt-4 p-3 bg-secondary/30 rounded-lg border border-border/50">
             <div className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1">Orçamento Selecionado</div>
             <div className="text-sm font-semibold truncate">{budget.title}</div>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
          {/* New Rule Form */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> 
                Nova Regra
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Se o cartão entrar na lista:</label>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none h-10"
                >
                  <option value="">Selecione a fase do Kanban...</option>
                  {boards.map(board => (
                      <optgroup key={board.id} label={board.name}>
                          {lists.filter(l => l.boardId === board.id).map(list => (
                              <option key={list.id} value={list.id}>
                                  {list.title}
                              </option>
                          ))}
                      </optgroup>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Mudar status do orçamento para:</label>
                <div className="flex flex-wrap gap-2">
                    {(['Aguardando', 'Cotado', 'Aprovado', 'Recusado'] as BudgetStatus[]).map(status => (
                        <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${selectedStatus === status ? statusColors[status] : 'bg-background hover:bg-secondary border-border text-muted-foreground opacity-60'}`}
                        >
                            {statusIcons[status]}
                            {status}
                        </button>
                    ))}
                </div>
              </div>

              <button
                onClick={handleAddRule}
                className="w-full bg-primary text-primary-foreground h-10 rounded-lg font-bold text-sm shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Ativar Automação
              </button>
            </div>
          </div>

          {/* Active Rules */}
          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
                <Layout className="h-4 w-4 text-primary" /> 
                Regras Ativas ({activeAutomations.length})
            </h3>
            
            {activeAutomations.length === 0 ? (
                <div className="text-center py-12 bg-secondary/20 rounded-xl border border-dashed border-border">
                    <Settings2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-xs text-muted-foreground">Nenhuma automação configurada para este orçamento.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {activeAutomations.map((rule, idx) => (
                        <motion.div
                            key={rule.listId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-secondary/40 border border-border rounded-xl p-3 flex items-center justify-between group hover:border-primary/30 transition-colors"
                        >
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase">Ao entrar em:</div>
                                <div className="text-xs font-bold truncate">{getListName(rule.listId)}</div>
                                <div className="mt-2 flex items-center gap-2">
                                     <span className="text-[9px] font-bold uppercase text-muted-foreground/50">Muda para:</span>
                                     <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${statusColors[rule.status]}`}>
                                         {statusIcons[rule.status]}
                                         {rule.status}
                                     </span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemoveRule(rule.listId)}
                                className="p-2 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </motion.div>
                    ))}
                </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-secondary/10 border-t border-border mt-auto">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-border rounded-lg text-sm font-bold bg-background hover:bg-secondary transition-colors"
            >
              Fechar
            </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BudgetAutomationModal;
