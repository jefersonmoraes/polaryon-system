import React from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Bell, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export const CobrancasPanel = () => {
    const { invoices, entries, updateInvoice } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    // Get pending revenues from entries
    const pendingRevenues = entries.filter(e => e.companyId === activeCompany?.id && e.type === 'revenue' && e.status === 'pending');

    const handleSendReminder = (id: string, type: 'invoice' | 'entry') => {
        // Simila process of sending email/whatsapp reminder
        toast.promise(
            new Promise((resolve) => setTimeout(resolve, 1500)),
            {
                loading: 'Gerando e disparando lembrete de cobrança...',
                success: 'Lembrete enviado com sucesso via E-mail / WhatsApp simulado.',
                error: 'Erro enviar lembrete'
            }
        );
    };

    return (
        <div className="kanban-card rounded-xl border border-border shadow-sm flex flex-col h-full">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-rose-500">
                    <Bell className="h-4 w-4" />
                    Régua de Cobrança (Automação)
                </h3>
            </div>

            <div className="p-4 flex-1 overflow-auto">
                <p className="text-sm text-muted-foreground mb-4">
                    Gerencie recebimentos pendentes. O sistema simula o envio de e-mails de cobrança automatizados baseados no vencimento.
                </p>

                {pendingRevenues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-muted/10">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                        <span className="text-sm font-medium text-foreground">Inadimplência Zero</span>
                        <span className="text-xs text-muted-foreground text-center mt-1">Nenhum recebimento pendente no momento.</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingRevenues.map(revenue => {
                            const isOverdue = new Date(revenue.date) < new Date(); // Simplificação para demonstração

                            return (
                                <div key={revenue.id} className="flex justify-between items-center bg-muted/20 p-4 rounded-xl border border-border/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isOverdue ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            <Bell className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-foreground">{revenue.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOverdue ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                                    {isOverdue ? 'ATRASADO' : 'A VENCER'}
                                                </span>
                                                <p className="text-[10px] text-muted-foreground">Datado: {new Date(revenue.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-bold text-sm text-foreground">R$ {revenue.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <button
                                            onClick={() => handleSendReminder(revenue.id, 'entry')}
                                            className="bg-primary/10 hover:bg-primary/20 text-primary p-2 rounded-lg transition-colors tooltip-trigger"
                                            title="Enviar Lembrete Automático"
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
