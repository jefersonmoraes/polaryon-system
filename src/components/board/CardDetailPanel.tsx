import { useKanbanStore } from '@/store/kanban-store';
import { PREDEFINED_LABEL_COLORS, Attachment, Milestone } from '@/types/kanban';
import {
  X, Calendar, Tag, CheckSquare, MessageSquare, Clock, Trash2, Plus,
  Play, Square, RotateCcw, FileText, User, Timer, AlignLeft,
  Paperclip, GripVertical, Bold, Italic, Underline, List, Table, Link2,
  Archive, Undo2, Image, Calculator, Building2, ExternalLink, Truck
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import BudgetModal from '../budgets/BudgetModal';
import { Budget, BudgetStatus, BudgetType } from '@/types/kanban';
import { useAuthStore } from '@/store/auth-store';
import DOMPurify from 'dompurify';
import { getFaviconUrl } from '@/lib/utils';

const statusStyles: Record<BudgetStatus, string> = {
  Aguardando: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  Cotado: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Aprovado: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  Recusado: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

interface Props {
  cardId: string;
  onClose: () => void;
}

const DEFAULT_SECTIONS = ['summary', 'labels', 'assignee', 'dates', 'estimated', 'description', 'attachments', 'budgets', 'checklist', 'timer', 'comments'];

const SECTION_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  summary: { icon: <FileText className="h-3.5 w-3.5" />, label: 'Resumo' },
  labels: { icon: <Tag className="h-3.5 w-3.5" />, label: 'Etiquetas' },
  assignee: { icon: <User className="h-3.5 w-3.5" />, label: 'Responsável' },
  dates: { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Datas' },
  estimated: { icon: <Timer className="h-3.5 w-3.5" />, label: 'Estimativa' },
  description: { icon: <AlignLeft className="h-3.5 w-3.5" />, label: 'Descrição' },
  attachments: { icon: <Paperclip className="h-3.5 w-3.5" />, label: 'Anexos' },
  budgets: { icon: <Calculator className="h-3.5 w-3.5" />, label: 'Orçamentos' },
  checklist: { icon: <CheckSquare className="h-3.5 w-3.5" />, label: 'Checklist' },
  timer: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Rastreador' },
  comments: { icon: <MessageSquare className="h-3.5 w-3.5" />, label: 'Comentários' },
};

const CardDetailPanel = ({ cardId, onClose }: Props) => {
  const {
    cards, labels, lists, boards, updateCard, deleteCard, moveCard,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem,
    addComment, startTimer, stopTimer, resetTimer,
    addLabel, updateLabel, deleteLabel,
    setUndoAction,
    recentMilestoneTitles, addRecentMilestoneTitle, budgets, companies,
    fetchCardDetails
  } = useKanbanStore();
  const card = cards.find(c => c.id === cardId);
  const list = card ? lists.find(l => l.id === card.listId) : null;
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const allMembers = useKanbanStore(state => state.members);
  const members = allMembers || [];
  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit;
  const canDownload = currentUser?.role === 'ADMIN' || currentUser?.permissions?.canDownload;

  const getCompanyFavicon = (id?: string) => {
    if (!id) return undefined;
    const c = companies.find(c => c.id === id);
    return c?.customLink ? getFaviconUrl(c.customLink) : undefined;
  };

  const getCompanyName = (id?: string) => {
    if (!id) return '';
    const c = companies.find(c => c.id === id);
    return c ? (c.nickname || c.nome_fantasia || c.razao_social) : 'Empresa Indisponível';
  };

  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('polaryon_card_section_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return DEFAULT_SECTIONS;
    } catch { return DEFAULT_SECTIONS; }
  });

  useEffect(() => {
    localStorage.setItem('polaryon_card_section_order', JSON.stringify(sectionOrder));
  }, [sectionOrder]);
  const [title, setTitle] = useState(card?.title || '');
  const [summary, setSummary] = useState(card?.summary || '');
  const [customLink, setCustomLink] = useState(card?.customLink || '');
  const handleSaveCustomLink = () => { if (canEdit) updateCard(cardId, { customLink: customLink.trim() || undefined }); };
  const [description, setDescription] = useState(card?.description || '');
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [dueDate, setDueDate] = useState(card?.dueDate || '');
  const [startDate, setStartDate] = useState(card?.startDate || '');
  const [assignee, setAssignee] = useState(card?.assignee || '');
  const [estimatedTime, setEstimatedTime] = useState(card?.estimatedTime?.toString() || '');

  // Budget editing state
  const [selectedBudgetToEdit, setSelectedBudgetToEdit] = useState<Budget | undefined>();
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // Label editor
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#3b82f6');
  const [labelHex, setLabelHex] = useState('#3b82f6');
  const [labelIcon, setLabelIcon] = useState<string | undefined>();
  const [editLabelId, setEditLabelId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState((card?.comments.length || 0) > 0);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // Constants
  const ICONS = [
    '📋', '📝', '✅', '☑️', '✔️', '❌', '🚫', '⚠️', '❗', '❓',
    '🔄', '🔁', '🚀', '🛸', '⭐', '🌟', '✨', '🔥', '💥', '💡',
    '🎯', '📌', '📍', '🏷️', '🔖', '🛠️', '🔧', '🔨', '⚙️', '📊',
    '📈', '📉', '📅', '📆', '⏳', '⌛', '⏰', '⏱️', '📦', '📫',
    '📥', '📤', '✉️', '📱', '💻', '🖥️', '🔍', '🔎', '🗑️', '📁',
    '📂', '🗂️', '📄', '📑', '🔐', '🔓', '🔑', '🔗', '📎', '💼',
    '🏆', '🥇', '🎉', '🎈', '🎁', '🏃', '🚶', '🛑', '🚧'
  ];

  // Rich text toolbar
  const descRef = useRef<HTMLDivElement>(null);

  // Timer display
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const activeEntry = card?.timeEntries.find(e => !e.endedAt);
  const intervalRef = useRef<number>();

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeEntry) {
      const update = () => {
        const elapsed = Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000);
        const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        setTimerDisplay(`${h}:${m}:${s}`);
      };
      update();
      intervalRef.current = window.setInterval(update, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeEntry]);

  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (cardId) {
      setIsLoadingDetails(true);
      fetchCardDetails(cardId).finally(() => setIsLoadingDetails(false));
    }
  }, [cardId, fetchCardDetails]);

  if (!card) return null;

  const handleSaveTitle = () => { if (title.trim()) updateCard(cardId, { title: title.trim() }); };
  const handleSaveSummary = () => updateCard(cardId, { summary });
  const handleSaveDesc = () => {
    if (descRef.current) {
      updateCard(cardId, { description: DOMPurify.sanitize(descRef.current.innerHTML) });
    }
  };
  const handleToggleLabel = (labelId: string) => {
    const next = card.labels.includes(labelId) ? card.labels.filter(l => l !== labelId) : [...card.labels, labelId];
    updateCard(cardId, { labels: next });
  };
  const handleAddCheckItem = () => {
    if (!canEdit) return;
    if (newCheckItem.trim()) { addChecklistItem(cardId, newCheckItem.trim()); setNewCheckItem(''); }
  };
  const handleAddComment = () => {
    if (!canEdit) return;
    if (newComment.trim()) { 
      addComment(cardId, newComment.trim()); 
      
      // Parse mentions
      const mentionRegex = /@([\w\s]+)/g;
      const mentions = [...newComment.matchAll(mentionRegex)].map(m => m[1].toLowerCase().trim());
      
      if (mentions.length > 0) {
        mentions.forEach(mention => {
          // Find member by first name or generic include
          const matchingMember = members.find(m => m.name.toLowerCase().includes(mention.split(' ')[0]));
          if (matchingMember && list && matchingMember.id !== currentUser?.id) {
             useKanbanStore.getState().addNotification(
                'Nova Menção',
                `Você foi mencionado no cartão "${card.title}" por ${currentUser?.name || 'Alguém'}.`,
                `/board/${list.boardId}`,
                'info',
                matchingMember.id
             );
          }
        });
      }

      setNewComment(''); 
      setShowMentionSuggestions(false);
    }
  };
  const handleSetDueDate = (val: string) => { setDueDate(val); updateCard(cardId, { dueDate: val || undefined }); };
  const handleSetStartDate = (val: string) => { setStartDate(val); updateCard(cardId, { startDate: val || undefined }); };
  const handleSetAssignee = (val: string) => {
    setAssignee(val);
    updateCard(cardId, { assignee: val || undefined });
    if (val && val !== card.assignee) {
      const member = members.find(m => m.id === val);
      const list = lists.find(l => l.id === card.listId);
      if (member && list) {
        useKanbanStore.getState().addNotification(
          'Nova Atribuição',
          `O cartão "${card.title}" foi atribuído a ${member.name}.`,
          `/board/${list.boardId}`
        );
      }
    }
  };
  const handleSetEstimatedTime = (val: string) => {
    setEstimatedTime(val);
    updateCard(cardId, { estimatedTime: val ? parseInt(val) : undefined });
  };
  const handleSaveLabel = () => {
    if (!labelName.trim()) return;
    if (editLabelId) updateLabel(editLabelId, { name: labelName.trim(), color: labelColor, icon: labelIcon });
    else addLabel(labelName.trim(), labelColor);
    setLabelName(''); setLabelColor('#3b82f6'); setLabelHex('#3b82f6'); setLabelIcon(undefined);
    setEditingLabel(false); setEditLabelId(null);
  };
  const handleEditLabel = (label: { id: string; name: string; color: string; icon?: string }) => {
    setEditLabelId(label.id); setLabelName(label.name); setLabelColor(label.color); setLabelHex(label.color); setLabelIcon(label.icon); setEditingLabel(true);
  };
  const handleColorHexChange = (hex: string) => {
    let val = hex;
    if (val && !val.startsWith('#')) val = '#' + val;
    setLabelHex(val);
    
    // Only update the actual color state if it's a valid 3, 4, 6 or 7 char hex
    const isValidHex = /^#([0-9A-F]{3}){1,2}$/i.test(val);
    if (isValidHex) {
      setLabelColor(val);
    }
  };
  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    descRef.current?.focus();
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let loaded = 0;
    const newAttachments: Attachment[] = [];

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        newAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: reader.result as string,
          type: file.type,
          addedAt: new Date().toISOString(),
        });
        loaded++;
        if (loaded === files.length) {
          updateCard(cardId, { attachments: [...card.attachments, ...newAttachments] });
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const handleRemoveAttachment = (attId: string) => {
    updateCard(cardId, { attachments: card.attachments.filter(a => a.id !== attId) });
  };

  const checkDone = card.checklist.filter(i => i.completed).length;
  const checkTotal = card.checklist.length;
  const totalTimeSecs = card.timeEntries.reduce((t, e) => t + e.duration, 0);
  const totalH = Math.floor(totalTimeSecs / 3600);
  const totalM = Math.floor((totalTimeSecs % 3600) / 60);

  const recalculateCardDates = (milestones: Milestone[]) => {
    let latest: string | undefined;
    milestones.forEach(m => {
      if (m.dueDate) {
        if (!latest || new Date(m.dueDate) > new Date(latest)) latest = m.dueDate;
      }
    });
    return { dueDate: latest };
  };

  const handleAddMilestone = (title: string) => {
    if (!title.trim()) return;
    const newMs: Milestone = { id: crypto.randomUUID(), title: title.trim(), completed: false };
    const updated = [...(card.milestones || []), newMs];
    updateCard(cardId, { milestones: updated, ...recalculateCardDates(updated) });
    addRecentMilestoneTitle(title.trim());
    setNewMilestoneTitle('');
  };

  const handleUpdateMilestone = (id: string, partial: Partial<Milestone>) => {
    const updated = (card.milestones || []).map(m => m.id === id ? { ...m, ...partial } : m);
    updateCard(cardId, { milestones: updated, ...recalculateCardDates(updated) });
  };

  const handleDeleteMilestone = (id: string) => {
    const updated = (card.milestones || []).filter(m => m.id !== id);
    updateCard(cardId, { milestones: updated, ...recalculateCardDates(updated) });
  };

  const renderSection = (section: string) => {
    switch (section) {
      case 'summary':
        return (
          <div key={section}>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <FileText className="h-3.5 w-3.5" /> Resumo
            </label>
            <input value={summary} onChange={e => setSummary(e.target.value)} onBlur={handleSaveSummary}
              disabled={!canEdit}
              placeholder="Breve resumo da tarefa..."
              className="w-full bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
        );
      case 'labels':
        return (
          <div key={section}>
            <button onClick={() => setShowLabels(!showLabels)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors">
              <Tag className="h-3.5 w-3.5" /> Etiquetas
            </button>
            {card.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {labels.filter(l => card.labels.includes(l.id)).map(label => (
                  <span key={label.id} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded text-white" style={{ backgroundColor: label.color }}>
                    {label.icon && <span>{label.icon}</span>}
                    {label.name}
                  </span>
                ))}
              </div>
            )}
            {showLabels && (
              <div className="p-3 bg-secondary rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {labels.map(label => (
                    <div key={label.id} className="flex items-center gap-1">
                      <button onClick={() => canEdit && handleToggleLabel(label.id)}
                        disabled={!canEdit}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed ${card.labels.includes(label.id) ? 'ring-2 ring-foreground' : ''}`}
                        style={{ backgroundColor: label.color }}>
                        {label.icon && <span>{label.icon}</span>}
                        {label.name}
                      </button>
                      <button onClick={() => handleEditLabel(label)} className="p-1 rounded hover:bg-background/50 text-muted-foreground">
                        <FileText className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {canEdit && <button onClick={() => { setEditingLabel(true); setEditLabelId(null); setLabelName(''); setLabelColor('#3b82f6'); setLabelHex('#3b82f6'); }}
                  className="text-[11px] text-primary hover:underline">+ Criar nova etiqueta</button>}
                {editingLabel && canEdit && (
                  <div className="p-2 bg-background rounded-lg border border-border space-y-2">
                    <input value={labelName} onChange={e => setLabelName(e.target.value)} placeholder="Nome da etiqueta"
                      className="w-full bg-secondary rounded px-2 py-1 text-xs outline-none border border-border focus:border-primary" />
                    <div className="flex flex-wrap gap-1">
                      {PREDEFINED_LABEL_COLORS.map(c => (
                        <button key={c} onClick={() => { setLabelColor(c); setLabelHex(c); }}
                          className={`w-5 h-5 rounded-sm transition-transform hover:scale-110 ${labelColor === c ? 'ring-2 ring-foreground ring-offset-1' : ''}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex gap-2 items-center mb-2">
                      <label className="text-[10px] text-muted-foreground">HEX:</label>
                      <input value={labelHex} onChange={e => handleColorHexChange(e.target.value)} maxLength={7}
                        className="w-20 bg-secondary rounded px-2 py-1 text-xs outline-none border border-border font-mono" />
                      <div className="w-6 h-6 rounded border border-border flex items-center justify-center text-xs" style={{ backgroundColor: labelColor }}>
                        {labelIcon}
                      </div>
                    </div>

                    <div className="grid grid-cols-8 gap-1 mb-2 max-h-[120px] overflow-y-auto p-1 custom-scrollbar bg-background rounded border border-border">
                      <button onClick={() => setLabelIcon(undefined)} className="w-6 h-6 rounded flex items-center justify-center text-[10px] text-muted-foreground hover:bg-secondary border border-dashed border-muted-foreground/30">✕</button>
                      {ICONS.map(icon => (
                        <button key={icon} onClick={() => setLabelIcon(icon)} className={`w-6 h-6 rounded flex items-center justify-center text-[12px] hover:bg-secondary ${labelIcon === icon ? 'ring-1 ring-primary' : ''}`}>
                          {icon}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleSaveLabel} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">{editLabelId ? 'Salvar' : 'Criar'}</button>
                      <button onClick={() => setEditingLabel(false)} className="text-xs text-muted-foreground">Cancelar</button>
                      {editLabelId && (
                        <button onClick={() => { deleteLabel(editLabelId); setEditingLabel(false); setEditLabelId(null); }} className="text-xs text-destructive ml-auto">Excluir</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'assignee': {
        const assignedMember = members.find(m => 
          m.id === assignee || 
          (m.email && assignee && m.email.toLowerCase() === assignee.toLowerCase())
        );
        return (
          <div key={section}>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <User className="h-3.5 w-3.5" /> Responsável
            </label>
            <div className="flex items-center gap-2">
              {assignedMember && (
                <img src={assignedMember.avatar} alt={assignedMember.name} className="w-8 h-8 rounded-full border border-border object-cover" />
              )}
              <select
                value={assignedMember?.id || ''}
                onChange={e => handleSetAssignee(e.target.value)}
                disabled={!canEdit}
                className="flex-1 bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Sem responsável</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        );
      }
      case 'dates':
        return (
          <div key={section}>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
              <Calendar className="h-3.5 w-3.5" /> Etapas (Milestones)
            </div>

            <div className="space-y-3 mb-3">
              {(card.milestones || []).map(ms => (
                <div key={ms.id} className="flex flex-col gap-2 p-3 bg-secondary/50 rounded-lg border border-border group focus-within:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={ms.completed} onChange={() => handleUpdateMilestone(ms.id, { completed: !ms.completed })} disabled={!canEdit} className="rounded cursor-pointer disabled:cursor-not-allowed" />
                    <input value={ms.title} onChange={(e) => handleUpdateMilestone(ms.id, { title: e.target.value })} disabled={!canEdit} className={`flex-1 text-xs bg-transparent outline-none font-medium disabled:opacity-70 ${ms.completed ? 'line-through text-muted-foreground' : ''}`} />
                    {canEdit && (
                      <button onClick={() => handleDeleteMilestone(ms.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-colors text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 pl-5">
                    <div className="flex items-center gap-1.5 w-full sm:flex-1">
                      <span className="text-[10px] text-muted-foreground w-max font-semibold">Data de Entrega:</span>
                      <input type="date" value={ms.dueDate ? ms.dueDate.split('T')[0] : ''} onChange={(e) => handleUpdateMilestone(ms.id, { dueDate: e.target.value })} className="bg-background cursor-pointer rounded px-1.5 py-1 text-[10px] outline-none border border-border flex-1 focus:border-primary" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <input value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMilestone(newMilestoneTitle)} placeholder="Nova etapa (ex: Planejamento)" className="flex-1 bg-secondary rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary" />
              <button onClick={() => handleAddMilestone(newMilestoneTitle)} className="px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Adicionar</button>
            </div>

            {recentMilestoneTitles.length > 0 && canEdit && (
              <div className="flex gap-2 flex-wrap mb-4">
                <span className="text-[10px] text-muted-foreground w-full">Etapas recentes usadas:</span>
                {recentMilestoneTitles.map(sug => (
                  <button key={sug} onClick={() => handleAddMilestone(sug)} className="px-2 py-1 rounded bg-secondary text-[10px] font-medium hover:bg-primary hover:text-primary-foreground transition-colors text-foreground">{sug}</button>
                ))}
              </div>
            )}

            <label className={`flex items-center gap-1.5 text-xs text-muted-foreground mt-4 pt-3 border-t border-border focus-within:text-foreground transition-colors ${canEdit ? 'cursor-pointer' : 'opacity-80'}`}>
              <input type="checkbox" checked={card.completed} onChange={() => updateCard(cardId, { completed: !card.completed })} disabled={!canEdit} className="rounded disabled:cursor-not-allowed" />
              Cartão concluído geral
            </label>
          </div>
        );
      case 'estimated':
        return (
          <div key={section}>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <Timer className="h-3.5 w-3.5" /> Estimativa de Tempo (minutos)
            </label>
            <input type="number" value={estimatedTime} onChange={e => handleSetEstimatedTime(e.target.value)} placeholder="Ex: 120"
              disabled={!canEdit}
              className="w-32 bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
        );
      case 'description':
        return (
          <div key={section}>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <AlignLeft className="h-3.5 w-3.5" /> Descrição
            </label>
            {/* Rich text toolbar */}
            {canEdit && (
              <div className="flex items-center gap-0.5 mb-1 p-1 bg-secondary rounded-t-lg border border-b-0 border-border">
                <button onClick={() => execCommand('bold')} className="p-1.5 rounded hover:bg-background transition-colors" title="Negrito">
                  <Bold className="h-3 w-3" />
                </button>
                <button onClick={() => execCommand('italic')} className="p-1.5 rounded hover:bg-background transition-colors" title="Itálico">
                  <Italic className="h-3 w-3" />
                </button>
                <button onClick={() => execCommand('underline')} className="p-1.5 rounded hover:bg-background transition-colors" title="Sublinhado">
                  <Underline className="h-3 w-3" />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-background transition-colors" title="Lista">
                  <List className="h-3 w-3" />
                </button>
                <button onClick={() => execCommand('insertHTML', '<table border="1" style="border-collapse:collapse;width:100%"><tr><td style="padding:4px;border:1px solid #ccc">&nbsp;</td><td style="padding:4px;border:1px solid #ccc">&nbsp;</td></tr><tr><td style="padding:4px;border:1px solid #ccc">&nbsp;</td><td style="padding:4px;border:1px solid #ccc">&nbsp;</td></tr></table>')}
                  className="p-1.5 rounded hover:bg-background transition-colors" title="Tabela">
                  <Table className="h-3 w-3" />
                </button>
                <button onClick={() => { const url = prompt('URL do link:'); if (url) execCommand('createLink', url); }}
                  className="p-1.5 rounded hover:bg-background transition-colors" title="Link">
                  <Link2 className="h-3 w-3" />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <select onChange={e => { if (e.target.value) execCommand('formatBlock', e.target.value); e.target.value = ''; }}
                  className="text-[10px] bg-transparent outline-none text-muted-foreground" defaultValue="">
                  <option value="" disabled>Cabeçalho</option>
                  <option value="h1">H1</option>
                  <option value="h2">H2</option>
                  <option value="h3">H3</option>
                  <option value="p">Normal</option>
                </select>
              </div>
            )}
            <div className="relative">
              <div
                ref={descRef}
                contentEditable={canEdit}
                onBlur={handleSaveDesc}
                onClick={() => !isDescExpanded && setIsDescExpanded(true)}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(card.description) }}
                className={`w-full bg-secondary rounded-b-lg px-3 py-2 text-xs outline-none border border-border focus:border-primary prose prose-sm max-w-none transition-all duration-300 ${isDescExpanded ? 'min-h-[120px]' : 'max-h-[60px] overflow-hidden cursor-pointer hover:bg-secondary/80'}`}
                style={{ lineHeight: 1.6 }}
              />
              {!isDescExpanded && card.description && card.description.length > 50 && (
                <button onClick={() => setIsDescExpanded(true)} className="absolute bottom-1 right-2 text-[10px] text-primary bg-background shadow px-2 py-0.5 rounded-full cursor-pointer hover:underline border border-border">Ver mais</button>
              )}
            </div>
            {isDescExpanded && (
              <button onClick={() => setIsDescExpanded(false)} className="text-[10px] text-muted-foreground mt-1 hover:underline cursor-pointer block ml-auto px-1">Ocultar</button>
            )}
          </div>
        );
      case 'attachments':
        return (
          <div key={section}>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <Paperclip className="h-3.5 w-3.5" /> Anexos
            </label>
            {canEdit && (
              <>
                <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-secondary text-xs hover:bg-secondary/80 transition-colors border border-border mb-2">
                  <Plus className="h-3 w-3" /> Anexar arquivo
                </button>
              </>
            )}
            {isLoadingDetails && (!card.attachments || card.attachments.length === 0) ? (
              <div className="space-y-2">
                <div className="h-10 bg-secondary animate-pulse rounded" />
                <div className="h-10 bg-secondary animate-pulse rounded" />
              </div>
            ) : card.attachments.length > 0 && (
              <div className="space-y-1.5">
                {card.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 bg-secondary rounded p-2 group">
                    {att.type.startsWith('image/') ? (
                      <img src={att.url} alt={att.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate">{att.name}</p>
                      <p className="text-[9px] text-muted-foreground">{new Date(att.addedAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    {canDownload && (
                      <a href={att.url} download={att.name} className="p-1 rounded hover:bg-background transition-colors text-muted-foreground" title="Download">
                        <Image className="h-3 w-3" />
                      </a>
                    )}
                    {canEdit && (
                      <button onClick={() => handleRemoveAttachment(att.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                        <X className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'budgets':
        const linkedBudgets = budgets.filter(b => b.cardId === cardId && !b.trashed);
        if (linkedBudgets.length === 0) return null;

        return (
          <div key={section}>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <Calculator className="h-3.5 w-3.5" /> Orçamentos Vinculados
            </label>
            <div className="space-y-2">
              {linkedBudgets.map(budget => {
                const isApproved = budget.status === 'Aprovado';
                return (
                  <div
                    key={budget.id}
                    onClick={() => {
                      if (!canEdit) return;
                      setSelectedBudgetToEdit(budget);
                      setIsBudgetModalOpen(true);
                    }}
                    className={`bg-secondary/50 rounded-lg p-3 border border-border group transition-colors flex flex-col gap-2 ${canEdit ? 'hover:border-primary/50 cursor-pointer' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{budget.title}</h4>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${statusStyles[budget.status]}`}>
                              {budget.status}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            {(() => {
                              const suppliers = Array.from(new Set(budget.items?.filter(i => i.companyId).map(i => i.companyId) || []));
                              const transporters = Array.from(new Set(budget.items?.filter(i => i.transporterId).map(i => i.transporterId) || []));
                              return (
                                <>
                                  <div className="flex items-center gap-1 min-w-0 truncate" title={suppliers.map(getCompanyName).join(', ')}>
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    {suppliers.length > 0 ? (
                                      <span className="truncate">{suppliers.length} Fornecedor{suppliers.length > 1 ? 'es' : ''}</span>
                                    ) : 'Sem Fornecedor'}
                                  </div>
                                  {transporters.length > 0 && (
                                    <div className="flex items-center gap-1 shrink-0 text-primary/80" title={transporters.map(getCompanyName).join(', ')}>
                                      <Truck className="h-3 w-3" /> {transporters.length} Transportadora{transporters.length > 1 ? 's' : ''}
                                    </div>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Preço Final</span>
                        {(() => {
                          if (!budget.items || budget.items.length === 0) {
                            return <span className="text-xs font-bold text-muted-foreground">R$ 0,00</span>;
                          }
                          const winningQuotation = [...budget.items].sort((a, b) => (a.totalPrice || 0) - (b.totalPrice || 0))[0];
                          return (
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-green-600 dark:text-green-400">
                                {(winningQuotation.totalPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <span className="text-[9px] text-muted-foreground max-w-[120px] truncate flex items-center justify-end gap-1" title={getCompanyName(winningQuotation.companyId)}>
                                {(() => {
                                  const fav = getCompanyFavicon(winningQuotation.companyId);
                                  return fav ? (
                                    <img 
                                      src={fav} 
                                      alt=""
                                      className="w-5 h-5 rounded-sm shrink-0"
                                      onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                  ) : null;
                                })()}
                                {getCompanyName(winningQuotation.companyId)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      case 'checklist':
        return (
          <div key={section}>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <CheckSquare className="h-3.5 w-3.5" /> Checklist
              {checkTotal > 0 && <span className="text-[10px] font-normal">({checkDone}/{checkTotal})</span>}
            </div>
            {checkTotal > 0 && (
              <div className="h-1.5 bg-secondary rounded-full mb-2 overflow-hidden">
                <div className="h-full bg-label-green rounded-full transition-all" style={{ width: `${(checkDone / checkTotal) * 100}%` }} />
              </div>
            )}
            <div className="space-y-1 mb-2">
              {card.checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={item.completed} onChange={() => toggleChecklistItem(cardId, item.id)} disabled={!canEdit} className="rounded disabled:cursor-not-allowed" />
                  <span className={`flex-1 text-xs ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.text}</span>
                  {canEdit && (
                    <button onClick={() => deleteChecklistItem(cardId, item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-secondary transition-all">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCheckItem()} placeholder="Novo item..."
                  className="flex-1 bg-secondary rounded px-2 py-1 text-xs outline-none border border-border focus:border-primary" />
                <button onClick={handleAddCheckItem} className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      case 'timer':
        return (
          <div key={section}>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <Clock className="h-3.5 w-3.5" /> Rastreador de Tempo
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {activeEntry ? (
                <>
                  <span className="text-xl font-mono font-bold text-accent">{timerDisplay}</span>
                  {canEdit && (
                    <button onClick={() => stopTimer(cardId)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors">
                      <Square className="h-3 w-3" /> Parar
                    </button>
                  )}
                </>
              ) : (
                <>
                  {canEdit && (
                    <>
                      <button onClick={() => startTimer(cardId)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                        <Play className="h-3 w-3" /> Iniciar
                      </button>
                      <button onClick={() => resetTimer(cardId)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
                        <RotateCcw className="h-3 w-3" /> Resetar
                      </button>
                    </>
                  )}
                </>
              )}
              {totalTimeSecs > 0 && <span className="text-xs text-muted-foreground">Total: {totalH}h {totalM}min</span>}
              {card.estimatedTime && <span className="text-xs text-muted-foreground">Estimado: {card.estimatedTime}min</span>}
            </div>
          </div>
        );
      case 'comments':
        return null; // Comentários agora ficam no painel lateral
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full ${showChat ? 'max-w-[95vw]' : 'max-w-[85vw]'} bg-background border border-border shadow-2xl rounded-xl overflow-hidden flex max-h-[95vh] transition-all duration-300`}
        >
          {/* Main content scrollable area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">em {list?.title || 'Lista'}</p>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                    disabled={!canEdit}
                    className="w-full text-lg font-bold bg-transparent outline-none border-b border-transparent focus:border-primary pb-1 disabled:opacity-80 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setShowChat(!showChat)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors ${showChat ? 'bg-primary/20 text-primary' : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'} text-xs font-semibold`} title="Alternar Chat">
                    <MessageSquare className="h-4 w-4" /> <span className="hidden sm:inline">Comentários</span> {card.comments.length > 0 && `(${card.comments.length})`}
                  </button>
                  <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Status badges */}
              {(card.archived || card.trashed) && (
                <div className="flex items-center gap-2">
                  {card.archived && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded bg-accent/20 text-accent text-[10px] font-medium">
                      <Archive className="h-3 w-3" /> Arquivado
                    </span>
                  )}
                  {card.trashed && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/20 text-destructive text-[10px] font-medium">
                      <Trash2 className="h-3 w-3" /> Na Lixeira
                    </span>
                  )}
                  <button onClick={() => updateCard(cardId, { archived: false, trashed: false })}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-secondary text-[10px] font-medium hover:bg-secondary/80">
                    <Undo2 className="h-3 w-3" /> Restaurar
                  </button>
                </div>
              )}

              {/* Custom Link & PNCP Integration - Only for PNCP Exported Cards */}
              {card.pncpId && (
                <div className="flex flex-wrap items-center gap-3 bg-secondary/30 p-3 rounded-lg border border-border">
                  <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      value={customLink}
                      onChange={e => setCustomLink(e.target.value)}
                      onBlur={handleSaveCustomLink}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCustomLink();
                        }
                      }}
                      disabled={!canEdit}
                      placeholder="Adicionar link externo (ex: Edital PNCP)..."
                      className="w-full bg-transparent text-xs outline-none border-b border-transparent focus:border-primary disabled:opacity-80 disabled:cursor-not-allowed"
                    />
                    {customLink && (
                      <a href={customLink.startsWith('http') ? customLink : `https://${customLink}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-primary/20 bg-primary/10 text-primary transition-colors shrink-0" title="Abrir Link Externo">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <button onClick={() => { onClose(); navigate('/oportunidades/busca', { state: { openPncpId: card.pncpId } }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0 shadow-sm" title="Abrir painel de busca do PNCP">
                    <Building2 className="h-3.5 w-3.5" /> Acessar Oportunidade no Sistema
                  </button>
                </div>
              )}

              {/* Modular sections - reorderable */}
              <Reorder.Group axis="y" values={sectionOrder.filter(s => s !== 'comments' && s !== 'budgets')} onReorder={setSectionOrder} className="space-y-5">
                {sectionOrder.filter(s => s !== 'comments' && s !== 'budgets').map(section => (
                  <Reorder.Item key={section} value={section} className="relative group">
                    <div className="absolute -left-5 top-1 opacity-0 group-hover:opacity-50 cursor-grab">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    {renderSection(section)}
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <div className="space-y-5 mt-5">
                {renderSection('budgets')}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border flex flex-wrap gap-2">
                {card.automationUndoAction && (
                  <button onClick={() => {
                    updateCard(cardId, { archived: false, trashed: false, automationUndoAction: undefined });
                    moveCard(cardId, card.automationUndoAction!.previousListId, 0);
                    onClose();
                  }}
                    className="flex items-center gap-2 text-xs text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded transition-colors mr-auto"
                    title={card.automationUndoAction.message}>
                    <Undo2 className="h-3.5 w-3.5" /> Desfazer Automação
                  </button>
                )}

                <button onClick={() => {
                  if (!canEdit) return;
                  updateCard(cardId, { archived: true });
                  if (list) setUndoAction({ cardId, previousListId: list.id, previousPosition: card.position, message: `"${card.title}" foi arquivado`, type: 'archived' });
                  onClose();
                }}
                  disabled={!canEdit}
                  className={`flex items-center gap-2 text-xs text-muted-foreground hover:bg-secondary px-3 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${!card.automationUndoAction ? 'ml-auto' : ''}`}>
                  <Archive className="h-3.5 w-3.5" /> Arquivar
                </button>
                <button onClick={() => {
                  if (!canEdit) return;
                  updateCard(cardId, { trashed: true });
                  if (list) setUndoAction({ cardId, previousListId: list.id, previousPosition: card.position, message: `"${card.title}" foi enviado para lixeira`, type: 'trashed' });
                  onClose();
                }}
                  disabled={!canEdit}
                  className="flex items-center gap-2 text-xs text-destructive hover:bg-destructive/10 px-3 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Trash2 className="h-3.5 w-3.5" /> Lixeira
                </button>
                {card.trashed && canEdit && (
                  <button onClick={() => { deleteCard(cardId); onClose(); }}
                    className="flex items-center gap-2 text-xs text-destructive hover:bg-destructive/10 px-3 py-2 rounded transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir permanentemente
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chat Side Pane */}
          {showChat && (
            <div className="w-[320px] md:w-[380px] border-l border-border bg-muted/20 flex flex-col shrink-0">
              <div className="p-4 border-b border-border flex items-center justify-between bg-card text-foreground font-semibold">
                <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat & Comentários</span>
                <button onClick={() => setShowChat(false)} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                {card.comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center mt-10">Nenhum comentário ainda. Inicie a conversa abaixo.</p>
                ) : (
                  card.comments.slice().reverse().map(comment => (
                    <div key={comment.id} className="bg-background border border-border rounded-lg p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-1.5 border-b border-border pb-1.5">
                        <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold text-accent-foreground">{comment.author[0]}</div>
                        <span className="text-[11px] font-medium text-foreground">{comment.author}</span>
                        <span className="text-[9px] text-muted-foreground ml-auto">
                          {new Date(comment.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>
              {canEdit && (
                <div className="p-3 bg-card border-t border-border">
                  <div className="flex flex-col gap-2 relative">
                    {showMentionSuggestions && (
                      <div className="absolute bottom-full left-0 mb-1 w-full bg-popover border border-border shadow-lg rounded-md z-50 overflow-hidden max-h-40 overflow-y-auto">
                        {members.filter(m => m.name.toLowerCase().includes(mentionQuery)).map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              const words = newComment.split(/(?=\s)/); // split but keep spaces
                              // find the last word that starts with @ and ends with the query
                              for (let i = words.length - 1; i >= 0; i--) {
                                if (words[i].trim().startsWith('@')) {
                                  words[i] = words[i].replace(/@\S*$/, `@${m.name} `);
                                  break;
                                }
                              }
                              setNewComment(words.join(''));
                              setShowMentionSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2"
                          >
                            <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                            <span className="font-medium text-foreground">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea value={newComment} 
                      onChange={e => {
                        const text = e.target.value;
                        setNewComment(text);
                        const match = text.match(/@(\S*)$/);
                        if (match) {
                           setMentionQuery(match[1].toLowerCase());
                           setShowMentionSuggestions(true);
                        } else {
                           setShowMentionSuggestions(false);
                        }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                      placeholder="Escreva um comentário... Use @nome para mencionar"
                      className="w-full bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary resize-none min-h-[60px]" />
                    <button onClick={handleAddComment} className="self-end px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm">
                      Enviar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
      {isBudgetModalOpen && (
        <BudgetModal
          budget={selectedBudgetToEdit}
          onClose={() => {
            setIsBudgetModalOpen(false);
            setSelectedBudgetToEdit(undefined);
          }}
        />
      )}
    </AnimatePresence>
  );
};

export default CardDetailPanel;
