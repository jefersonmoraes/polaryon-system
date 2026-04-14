import { useKanbanStore } from '@/store/kanban-store';
import { PREDEFINED_LABEL_COLORS, Attachment, Milestone } from '@/types/kanban';
import {
  X, Calendar, Tag, CheckSquare, MessageSquare, Clock, Trash2, Plus,
  Play, Square, RotateCcw, FileText, User, Timer, AlignLeft,
  Paperclip, GripVertical, Bold, Italic, Underline, List, Table, Link2,
  Archive, Undo2, Image, Calculator, Building2, ExternalLink, Truck, MapPin, Check,
  ShoppingCart, Package, RefreshCw, Search, Download
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import BudgetModal from '../budgets/BudgetModal';
import { Budget, BudgetStatus, BudgetType } from '@/types/kanban';
import { useAuthStore } from '@/store/auth-store';
import DOMPurify from 'dompurify';
import { getFaviconUrl, cn, compressImage, openFileInNewTab } from '@/lib/utils';
import { CompanyFavicon } from '../ui/CompanyFavicon';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from 'sonner';

const ICONS = [
  '📋', '📝', '✅', '☑️', '✔️', '❌', '🚫', '⚠️', '❗', '❓',
  '🔄', '🔁', '🚀', '🛸', '⭐', '🌟', '✨', '🔥', '💥', '💡',
  '🎯', '📌', '📍', '🏷️', '🔖', '🛠️', '🔧', '🔨', '⚙️', '📊',
  '📈', '📉', '📅', '📆', '⏳', '⌛', '⏰', '⏱️', '📦', '📫',
  '📥', '📤', '✉️', '📱', '💻', '🖥️', '🔍', '🔎', '🗑️', '📁',
  '📂', '🗂️', '📄', '📑', '🔐', '🔓', '🔑', '🔗', '📎', '💼',
  '🏆', '🥇', '🎉', '🎈', '🎁', '🚀', '🏃', '🚶', '🛑', '🚧'
];

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

const DEFAULT_SECTIONS = ['summary', 'labels', 'assignee', 'dates', 'deliveryAddress', 'deliveryTime', 'estimated', 'description', 'items', 'attachments', 'budgets', 'checklist', 'timer', 'comments'];

const SECTION_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  summary: { icon: <FileText className="h-3.5 w-3.5" />, label: 'Resumo' },
  labels: { icon: <Tag className="h-3.5 w-3.5" />, label: 'Etiquetas' },
  assignee: { icon: <User className="h-3.5 w-3.5" />, label: 'Responsável' },
  dates: { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Datas' },
  deliveryAddress: { icon: <MapPin className="h-3.5 w-3.5" />, label: 'Endereço de entrega' },
  deliveryTime: { icon: <Truck className="h-3.5 w-3.5" />, label: 'Prazo de Entrega' },
  estimated: { icon: <Timer className="h-3.5 w-3.5" />, label: 'Estimativa' },
  description: { icon: <AlignLeft className="h-3.5 w-3.5" />, label: 'Descrição' },
  items: { icon: <ShoppingCart className="h-3.5 w-3.5" />, label: 'Itens' },
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
    addCardItem, updateCardItem, deleteCardItem,
    addDescriptionEntry, deleteDescriptionEntry,
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


  const getCompanyName = (id?: string) => {
    if (!id) return '';
    const c = companies.find(c => c.id === id);
    return c ? (c.nickname || c.nome_fantasia || c.razao_social) : 'Empresa Indisponível';
  };

  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('polaryon_card_section_order');
      if (saved) {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const newSections = DEFAULT_SECTIONS.filter(s => !parsed.includes(s));
          if (newSections.length > 0) parsed = [...parsed, ...newSections];
          return parsed;
        }
      }
      return DEFAULT_SECTIONS;
    } catch { return DEFAULT_SECTIONS; }
  });

  const [title, setTitle] = useState(card?.title || '');
  const [summary, setSummary] = useState(card?.summary || '');
  const [customLink, setCustomLink] = useState(card?.customLink || '');
  const [description, setDescription] = useState(card?.description || '');
  const [localDescription, setLocalDescription] = useState(card?.description || '');
  const [isDirty, setIsDirty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [dueDate, setDueDate] = useState(card?.dueDate || '');
  const [startDate, setStartDate] = useState(card?.startDate || '');
  const [assignee, setAssignee] = useState(card?.assignee || '');
  const [estimatedTime, setEstimatedTime] = useState(card?.estimatedTime?.toString() || '');
  const [deliveryAddress, setDeliveryAddress] = useState(card?.deliveryAddress || '');
  const [deliveryTime, setDeliveryTime] = useState(card?.deliveryTime || '');
  const [newItemName, setNewItemName] = useState('');
  const [newItemValue, setNewItemValue] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<string>('1');
  const [selectedBudgetToEdit, setSelectedBudgetToEdit] = useState<Budget | undefined>();
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#3b82f6');
  const [labelHex, setLabelHex] = useState('#3b82f6');
  const [labelIcon, setLabelIcon] = useState<string | undefined>();
  const [editLabelId, setEditLabelId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<{ isOpen: boolean; url: string; name: string; type?: string }>({ isOpen: false, url: '', name: '' });
  const [showDescriptionPane, setShowDescriptionPane] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');

  const dragCounter = useRef(0);
  const lastSaveTime = useRef<number>(0);
  const lastSavedDescription = useRef<string>(card?.description || '');
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingSaveHTML = useRef<string | null>(null);
  const intervalRef = useRef<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // EFFECTS
  useEffect(() => {
    localStorage.setItem('polaryon_card_section_order', JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  useEffect(() => {
    if (cardId) {
      setIsLoadingDetails(true);
      fetchCardDetails(cardId).finally(() => setIsLoadingDetails(false));
    }
  }, [cardId]);

  useEffect(() => {
    if (card) {
      if (card.description) setShowDescriptionPane(true);
      else if (card.comments.length > 0) setShowChat(true);
      
      // Keep simple fields in sync with store (optimistic or remote)
      // but only if we are NOT currently editing them to avoid input resets
      if (document.activeElement?.id !== 'card-title') setTitle(card.title || '');
      setSummary(card.summary || '');
      setCustomLink(card.customLink || '');
      setDueDate(card.dueDate || '');
      setStartDate(card.startDate || '');
      setAssignee(card.assignee || '');
    }
  }, [cardId, card?.title, card?.summary, card?.customLink, card?.dueDate, card?.startDate, card?.assignee]);

  useEffect(() => {
    let timeout: number;
    if (!card) {
      timeout = window.setTimeout(() => setLoadError(true), 5000);
    }
    return () => clearTimeout(timeout);
  }, [card]);

  useEffect(() => {
    if (!editorRef.current) return;
    const storeDesc = card?.description || '';
    const now = Date.now();
    const recentlySaved = now - lastSaveTime.current < 2000; 
    const editorHTML = editorRef.current.innerHTML;
    if (editorHTML !== storeDesc) {
       if (!isDirty || (editorHTML === '' && storeDesc !== '')) {
         const store = useKanbanStore.getState();
         if (!store.savingCards.has(cardId) && !recentlySaved) {
            editorRef.current.innerHTML = DOMPurify.sanitize(storeDesc);
            setLocalDescription(storeDesc);
            lastSavedDescription.current = storeDesc;
         }
       }
    }
  }, [cardId, card?.description, isDirty, showDescriptionPane]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(async () => {
        if (localDescription !== lastSavedDescription.current) {
            await performSave(localDescription);
        }
    }, 1500);
    return () => clearTimeout(timer);
  }, [localDescription, cardId, isDirty]);

  const activeEntry = card?.timeEntries.find(e => !e.endedAt);
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

  // EARLY RETURNS (Allowed after all hooks)
  if (loadError && !card) {
      return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-end">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
              <div className="relative w-full max-w-4xl h-full bg-card shadow-2xl flex items-center justify-center border-l border-border">
                  <div className="flex flex-col items-center gap-6 text-center p-12">
                       <X className="h-10 w-10 text-destructive" />
                       <h3 className="text-xl font-bold">Cartão não encontrado</h3>
                       <button onClick={onClose} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg">VOLTAR AO PAINEL</button>
                  </div>
              </div>
          </motion.div>
      );
  }

  if (!card) {
      return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-end">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
              <div className="relative w-full max-w-4xl h-full bg-background/95 backdrop-blur-sm shadow-2xl flex items-center justify-center border-l border-border">
                   <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
          </motion.div>
      );
  }
  const handleSaveCustomLink = () => { if (canEdit) updateCard(cardId, { customLink: customLink.trim() || undefined }); };

  const performSave = async (html: string) => {
    if (html === lastSavedDescription.current) return;
    setSaveStatus('saving');
    try {
        await updateCard(cardId, { description: html });
        lastSaveTime.current = Date.now();
        lastSavedDescription.current = html;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 3000);
    } catch (err) {
        setSaveStatus('error');
    }
  };

  const toggleDescriptionPane = async (val: boolean) => {
    if (isDirty && editorRef.current) {
        const html = editorRef.current.innerHTML;
        await performSave(html);
        setIsDirty(false);
    }
    setShowDescriptionPane(val);
    if (val) setShowChat(false);
  };
  
  const toggleChat = async (val: boolean) => {
    if (isDirty && editorRef.current) {
        const html = editorRef.current.innerHTML;
        await performSave(html);
        setIsDirty(false);
    }
    setShowChat(val);
    if (val) setShowDescriptionPane(false);
  };

  const handleClose = async () => {
    const currentHTML = editorRef.current?.innerHTML;
    if (isDirty && currentHTML !== undefined) {
        await performSave(currentHTML);
    }
    setIsDirty(false);
    onClose();
  };




  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
        setLocalDescription(editorRef.current.innerHTML);
        setIsDirty(true);
    }
  };

  const insertTable = () => {
    const rows = prompt("Linhas:", "3");
    const cols = prompt("Colunas:", "3");
    if (rows && cols) {
        const table = `
            <div class="table-wrapper" style="overflow-x: auto; margin: 15px 0; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%;">
                <table style="width: 100%; border-collapse: collapse; min-width: 400px; font-size: 13px;">
                    ${Array(parseInt(rows)).fill(0).map(() => `
                        <tr>
                            ${Array(parseInt(cols)).fill(0).map(() => `<td style="border: 1px solid #cbd5e1; padding: 10px; min-width: 50px; background: white;">...</td>`).join('')}
                        </tr>
                    `).join('')}
                </table>
            </div>
        `;
        execCommand('insertHTML', table);
    }
  };

  const getActiveTable = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    let node = selection.getRangeAt(0).startContainer;
    while (node && node !== editorRef.current) {
        if (node.nodeName === 'TABLE') return node as HTMLTableElement;
        node = node.parentNode as any;
    }
    return null;
  };

  const tableAction = (action: 'addRow' | 'delRow' | 'addCol' | 'delCol') => {
    const table = getActiveTable();
    if (!table) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    let cell = selection.getRangeAt(0).startContainer;
    while (cell && cell.nodeName !== 'TD' && cell.nodeName !== 'TH') {
        cell = cell.parentNode as any;
    }
    if (!cell) return;
    
    const td = cell as HTMLTableCellElement;
    const tr = td.parentNode as HTMLTableRowElement;
    const rowIndex = tr.rowIndex;
    const colIndex = td.cellIndex;

    if (action === 'addRow') {
        const newRow = table.insertRow(rowIndex + 1);
        for (let i = 0; i < table.rows[0].cells.length; i++) {
            const newCell = newRow.insertCell(i);
            newCell.style.border = '1px solid #cbd5e1';
            newCell.style.padding = '10px';
            newCell.innerHTML = '...';
        }
    } else if (action === 'delRow') {
        if (table.rows.length > 1) table.deleteRow(rowIndex);
    } else if (action === 'addCol') {
        for (let i = 0; i < table.rows.length; i++) {
            const newCell = table.rows[i].insertCell(colIndex + 1);
            newCell.style.border = '1px solid #cbd5e1';
            newCell.style.padding = '10px';
            newCell.innerHTML = '...';
        }
    } else if (action === 'delCol') {
        if (table.rows[0].cells.length > 1) {
            for (let i = 0; i < table.rows.length; i++) {
                table.rows[i].deleteCell(colIndex);
            }
        }
    }
    
    if (editorRef.current) {
        setLocalDescription(editorRef.current.innerHTML);
    }
  };



  if (!card) return null;

  const handleSaveTitle = () => { if (title.trim()) updateCard(cardId, { title: title.trim() }); };
  const handleSaveSummary = () => updateCard(cardId, { summary });
  const handleSaveDesc = async () => {
    if (editorRef.current) {
      await performSave(DOMPurify.sanitize(editorRef.current.innerHTML));
    }
  };
  const handleToggleLabel = (labelId: string) => {
    const currentLabels = card.labels || [];
    const next = currentLabels.includes(labelId) ? currentLabels.filter(l => l !== labelId) : [...currentLabels, labelId];
    updateCard(cardId, { labels: next });
  };
  const handleAddCheckItem = () => {
    if (!canEdit) return;
    if (newCheckItem.trim()) { addChecklistItem(cardId, newCheckItem.trim()); setNewCheckItem(''); }
  };
  const handleAddCardItem = () => {
    if (!canEdit) return;
    if (newItemName.trim()) {
        const val = parseFloat(newItemValue.replace(',', '.')) || 0;
        const qty = parseInt(newItemQuantity) || 1;
        addCardItem(cardId, newItemName.trim(), val, qty);
        setNewItemName('');
        setNewItemValue('');
        setNewItemQuantity('1');
    }
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
  const handleSetDueDate = (val: string) => { setDueDate(val); updateCard(cardId, { dueDate: val || null }); };
  const handleSetStartDate = (val: string) => { setStartDate(val); updateCard(cardId, { startDate: val || null }); };
  const handleSetAssignee = (val: string) => {
    setAssignee(val);
    updateCard(cardId, { assignee: val || null });
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
    updateCard(cardId, { estimatedTime: val ? parseInt(val) : null });
  };
  const handleSaveLabel = () => {
    if (!labelName.trim()) return;
    if (editLabelId) updateLabel(editLabelId, { name: labelName.trim(), color: labelColor, icon: labelIcon });
    else addLabel(labelName.trim(), labelColor);
    setLabelName(''); setLabelColor('#3b82f6'); setLabelHex('#3b82f6'); setLabelIcon(undefined);
    setEditingLabel(false); setEditLabelId(null);
  };
  const handleEditLabel = (label: { id: string; name: string; color: string; icon?: string }) => {
    setEditLabelId(label.id); 
    setLabelName(label.name || ''); 
    setLabelColor(label.color || '#3b82f6'); 
    setLabelHex(label.color || '#3b82f6'); 
    setLabelIcon(label.icon); 
    setEditingLabel(true);
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
  const processFiles = async (files: File[]) => {
    if (!files.length || !cardId) return;
    
    setIsUploading(true);
    const toastId = toast.loading(`Processando ${files.length} arquivo(s)...`);
    
    try {
      const newAttachments: Attachment[] = [];
      
      for (const file of files) {
        let fileUrl: string;

        // Turbo-Upload: Compress images but keep PDFs/others intact
        if (file.type.startsWith('image/') && !file.type.includes('svg')) {
          try {
            fileUrl = await compressImage(file);
          } catch (err) {
            console.error("Compression failed, using original", err);
            fileUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
          }
        } else {
          // Non-image or SVG: Original file
          fileUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        }

        newAttachments.push({
          id: crypto.randomUUID(),
          name: file.name.split('.')[0] + (file.type.startsWith('image/') ? '.webp' : `.${file.name.split('.').pop()}`),
          url: fileUrl,
          type: file.type.startsWith('image/') ? 'image/webp' : file.type,
          addedAt: new Date().toISOString(),
        });
      }

      updateCard(cardId, { attachments: [...card.attachments, ...newAttachments] });
      toast.success(`${files.length} arquivo(s) anexado(s) com sucesso!`, { id: toastId });
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Erro ao processar arquivos.", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    e.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
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
      case 'summary': {
        return (
          <div key={section}>
            <label htmlFor="card-summary" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <FileText className="h-3.5 w-3.5" /> Resumo
            </label>
            <input id="card-summary" name="summary" value={summary} onChange={e => setSummary(e.target.value)} onBlur={handleSaveSummary}
              disabled={!canEdit}
              placeholder="Breve resumo da tarefa..."
              className="w-full bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
        );
      }
      case 'labels': {
        return (
          <div key={section}>
            <button onClick={() => setShowLabels(!showLabels)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors">
              <Tag className="h-3.5 w-3.5" /> Etiquetas
            </button>
            {card.labels?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {labels.filter(l => (card.labels || []).includes(l.id)).map(label => (
                  <span key={label.id} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded text-white" style={{ backgroundColor: label.color || '#3b82f6' }}>
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
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed ${card.labels?.includes(label.id) ? 'ring-2 ring-foreground' : ''}`}
                        style={{ backgroundColor: label.color || '#3b82f6' }}>
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
                      <label htmlFor="card-label-hex" className="text-[10px] text-muted-foreground">HEX:</label>
                      <input id="card-label-hex" name="labelHex" value={labelHex} onChange={e => handleColorHexChange(e.target.value)} maxLength={7}
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
      }
      case 'assignee': {
        const assignedMember = members.find(m => 
          m.id === assignee || 
          m.email === assignee
        );
        return (
          <div key={section}>
            <label htmlFor="card-assignee" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <User className="h-3.5 w-3.5" /> Responsável
            </label>
            <div className="flex items-center gap-2">
              {assignedMember && (
                <img src={assignedMember.avatar} alt={assignedMember.name} className="w-8 h-8 rounded-full border border-border object-cover" />
              )}
              <Select
                value={assignedMember?.id || "none"}
                onValueChange={(val) => handleSetAssignee(val === "none" ? "" : val)}
                disabled={!canEdit}
              >
                <SelectTrigger className="flex-1 bg-secondary border-border rounded px-3 h-8 text-xs focus:ring-1 focus:ring-primary/30 outline-none">
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                  <SelectItem value="none" className="text-xs font-bold">Sem responsável</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-bold">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      }
      case 'dates': {
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
                      <label htmlFor={`card-ms-date-${ms.id}`} className="text-[10px] text-muted-foreground w-max font-semibold shrink-0">Prazo:</label>
                      <input id={`card-ms-date-${ms.id}`} name={`ms-due-date-${ms.id}`} type="date" value={ms.dueDate ? ms.dueDate.split('T')[0] : ''} onChange={(e) => handleUpdateMilestone(ms.id, { dueDate: e.target.value })} className="bg-background cursor-pointer rounded px-1.5 py-1 text-[10px] outline-none border border-border flex-1 focus:border-primary shrink-0" />
                      <input id={`card-ms-hour-${ms.id}`} name={`ms-hour-${ms.id}`} type="time" value={ms.hour || ''} onChange={(e) => handleUpdateMilestone(ms.id, { hour: e.target.value })} className="bg-background cursor-pointer rounded px-1.5 py-1 text-[10px] outline-none border border-border w-[85px] focus:border-primary shrink-0" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <input id="card-new-ms-title" name="newMilestoneTitle" value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMilestone(newMilestoneTitle)} placeholder="Nova etapa (ex: Planejamento)" className="flex-1 bg-secondary rounded px-2 py-1.5 text-xs outline-none border border-border focus:border-primary" />
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
          </div>
        );
      }
      case 'items': {
        const items = card.items || [];
        const grandTotal = items.reduce((acc, item) => acc + (item.unitValue * item.quantity), 0);

        return (
          <div key={section} className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-3.5 w-3.5" /> Itens da Oportunidade
              </div>
              {items.length > 0 && (
                <div className="text-green-600 dark:text-green-400 font-bold">
                  Total: {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              )}
            </div>

            <div className="bg-secondary/30 rounded-lg overflow-hidden border border-border/50">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-secondary/50 text-muted-foreground border-b border-border/50">
                    <th className="px-3 py-2 font-bold uppercase tracking-wider">Nome do Item</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider w-24">Valor Unit.</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider w-16">Qtd.</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider w-24 text-right">Subtotal</th>
                    {canEdit && <th className="px-2 py-2 w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 5 : 4} className="px-3 py-4 text-center text-muted-foreground italic">
                        Nenhum item cadastrado.
                      </td>
                    </tr>
                  ) : (
                    items.map(item => (
                      <tr key={item.id} className="hover:bg-secondary/40 transition-colors group">
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <input 
                              value={item.name}
                              onChange={e => updateCardItem(cardId, item.id, { name: e.target.value })}
                              className="w-full bg-transparent outline-none focus:text-primary"
                            />
                          ) : item.name}
                        </td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <input 
                              value={item.unitValue}
                              type="number"
                              step="0.01"
                              onChange={e => updateCardItem(cardId, item.id, { unitValue: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent outline-none focus:text-primary"
                            />
                          ) : item.unitValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <input 
                              value={item.quantity}
                              type="number"
                              onChange={e => updateCardItem(cardId, item.id, { quantity: parseInt(e.target.value) || 1 })}
                              className="w-full bg-transparent outline-none focus:text-primary"
                            />
                          ) : item.quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {(item.unitValue * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        {canEdit && (
                          <td className="px-2 py-2 text-center">
                            <button 
                              onClick={() => deleteCardItem(cardId, item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {canEdit && (
              <div className="grid grid-cols-[1fr,100px,70px,auto] gap-2 items-end bg-secondary/20 p-2 rounded-lg border border-dashed border-border/60">
                <div className="space-y-1">
                  <label htmlFor="card-new-item-name" className="text-[9px] uppercase font-bold text-muted-foreground px-1">Novo Item</label>
                  <input 
                    id="card-new-item-name"
                    name="newItemName"
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                    placeholder="Descrição do item..."
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="card-new-item-value" className="text-[9px] uppercase font-bold text-muted-foreground px-1">Valor Unit.</label>
                  <input 
                    id="card-new-item-value"
                    name="newItemValue"
                    value={newItemValue}
                    onChange={e => setNewItemValue(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="card-new-item-qty" className="text-[9px] uppercase font-bold text-muted-foreground px-1">Qtd</label>
                  <input 
                    id="card-new-item-qty"
                    name="newItemQuantity"
                    value={newItemQuantity}
                    onChange={e => setNewItemQuantity(e.target.value)}
                    type="number"
                    min="1"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <button 
                  onClick={handleAddCardItem}
                  disabled={!newItemName.trim()}
                  className="bg-primary text-primary-foreground p-2 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                  title="Adicionar Item"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        );
      }
      case 'deliveryAddress': {
        return (
          <div key={section}>
            <label htmlFor="card-delivery-address" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <MapPin className="h-3.5 w-3.5" /> Endereço de entrega
            </label>
            <textarea
              id="card-delivery-address"
              name="deliveryAddress"
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              onBlur={() => updateCard(cardId, { deliveryAddress: deliveryAddress.trim() || null })}
              disabled={!canEdit}
              placeholder="Digite o local para entrega..."
              className="w-full bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed min-h-[60px]"
            />
          </div>
        );
      }
      case 'deliveryTime': {
        return (
          <div key={section}>
            <label htmlFor="card-delivery-time" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <Truck className="h-3.5 w-3.5" /> Prazo de Entrega
            </label>
            <input
              id="card-delivery-time"
              name="deliveryTime"
              value={deliveryTime}
              onChange={e => setDeliveryTime(e.target.value)}
              onBlur={() => updateCard(cardId, { deliveryTime: deliveryTime.trim() || null })}
              disabled={!canEdit}
              placeholder="Ex: 5 dias úteis, Imediata..."
              className="w-full bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        );
      }
      case 'estimated': {
        return (
          <div key={section}>
            <label htmlFor="card-estimated-time" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <Timer className="h-3.5 w-3.5" /> Estimativa de Tempo (minutos)
            </label>
            <input id="card-estimated-time" name="estimatedTime" type="number" value={estimatedTime} onChange={e => handleSetEstimatedTime(e.target.value)} placeholder="Ex: 120"
              disabled={!canEdit}
              className="w-32 bg-secondary rounded px-3 py-2 text-xs outline-none border border-border focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
        );
      }
      case 'description': {
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
                <Select onValueChange={(val) => { if (val) execCommand('formatBlock', val); }}>
                  <SelectTrigger className="w-[100px] bg-transparent border-none text-[10px] h-6 text-muted-foreground focus:ring-0">
                    <SelectValue placeholder="Cabeçalho" />
                  </SelectTrigger>
                  <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                    <SelectItem value="p" className="text-[10px] font-bold">Normal</SelectItem>
                    <SelectItem value="h1" className="text-[10px] font-bold">H1</SelectItem>
                    <SelectItem value="h2" className="text-[10px] font-bold">H2</SelectItem>
                    <SelectItem value="h3" className="text-[10px] font-bold">H3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable={canEdit}
                onBlur={handleSaveDesc}
                onInput={() => setIsDirty(true)}
                onClick={() => !isDescExpanded && setIsDescExpanded(true)}
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
      }
      case 'attachments': {
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
                    {att.type?.startsWith('image/') ? (
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
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setPreviewData({ isOpen: true, url: att.url, name: att.name, type: att.type?.startsWith('image/') ? 'image' : att.type === 'application/pdf' ? 'pdf' : undefined })}
                        className="p-1 rounded hover:bg-primary/20 text-primary transition-colors"
                        title="Visualizar"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => openFileInNewTab(att.url, att.name)} 
                        className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-primary" 
                        title="Abrir em Nova Aba"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      {canDownload && (
                        <a href={att.url} download={att.name} className="p-1 rounded hover:bg-background transition-colors text-muted-foreground" title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
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
      }
      case 'budgets': {
        const linkedBudgets = budgets.filter(b => b.cardId === cardId && !b.trashed);

        return (
          <div key={section} className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Calculator className="h-3.5 w-3.5" /> Orçamentos Vinculados
              </label>
              {canEdit && (
                <button 
                  onClick={() => setIsBudgetModalOpen(true)}
                  className="text-[10px] font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                >
                  <Plus className="h-3 w-3" /> ADICIONAR
                </button>
              )}
            </div>
            
            {linkedBudgets.length === 0 ? (
              <div className="text-center py-6 bg-secondary/30 rounded-lg border border-dashed border-border">
                <p className="text-[11px] text-muted-foreground italic">Nenhum orçamento vinculado</p>
                {canEdit && (
                  <button 
                    onClick={() => setIsBudgetModalOpen(true)}
                    className="mt-2 text-[10px] font-bold text-primary hover:underline"
                  >
                    Criar primeiro orçamento
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
              {linkedBudgets.map(budget => {
                const isApproved = budget.status === 'Aprovado';
                return (
                  <div
                    key={budget.id}
                    onClick={() => {
                      if (!canEdit) return;
                      // REDIRECT to full budget page to ensure complete context and all features are available ⚒️🚀⚙️
                      navigate(`/budgets?budgetId=${budget.id}`);
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
                            {(() => {
                              const favorites = (budget.items || []).filter(i => i.isFavorite);
                              if (favorites.length === 0) return null; // So mostra tipo na miniatura se tiver favorito
                              const typesSet = new Set(favorites.map(i => i.type || budget.type || 'Produto'));
                              const types = Array.from(typesSet);
                              
                              return types.map(t => (
                                <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 bg-primary/10 text-primary">
                                  {t}
                                </span>
                              ));
                            })()}
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
                              );
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
                          const favorites = budget.items.filter(i => i.isFavorite);
                          
                          if (favorites.length > 0) {
                              const companiesList = Array.from(new Set(favorites.map(f => getCompanyName(f.companyId)))).join(', ');
                              const totalSum = favorites.reduce((acc, f) => acc + (f.finalSellingPrice || f.totalPrice || 0), 0);
                              const totalProfit = favorites.reduce((acc, f) => {
                                const sell = f.finalSellingPrice || f.totalPrice || 0;
                                const cost = f.totalPrice || 0;
                                const tax = f.taxValue || 0;
                                const difal = f.difalValue || 0;
                                return acc + (sell - cost - tax - difal);
                              }, 0);

                              return (
                                <div className="flex flex-col items-end gap-0.5">
                                  {totalProfit !== 0 && (
                                    <div className={cn(
                                      "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter whitespace-nowrap",
                                      totalProfit > 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                                    )}>
                                      LUCRO EMPRESA: {totalProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">$</span>
                                    <span className="text-xs font-bold text-primary/90">
                                      {totalSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-muted-foreground max-w-[120px] truncate flex items-center justify-end gap-1" title={companiesList}>
                                    {favorites.length > 1 ? 'Múltiplos Favoritos' : (getCompanyName(favorites[0].companyId))}
                                  </span>
                                </div>
                              );
                          }
                          
                          // Fallback to lowest overall (when no favorites exist)
                          const winningQuotation = [...budget.items].sort((a, b) => {
                              const vA = a.finalSellingPrice || a.totalPrice || 0;
                              const vB = b.finalSellingPrice || b.totalPrice || 0;
                              return vA - vB;
                          })[0];

                          const fallbackSell = winningQuotation.finalSellingPrice || winningQuotation.totalPrice || 0;
                          const fallbackCost = winningQuotation.totalPrice || 0;
                          const fallbackTax = winningQuotation.taxValue || 0;
                          const fallbackDifal = winningQuotation.difalValue || 0;
                          const fallbackProfit = fallbackSell - fallbackCost - fallbackTax - fallbackDifal;
                          
                          return (
                            <div className="flex flex-col items-end gap-0.5">
                              {fallbackProfit !== 0 && (
                                <div className={cn(
                                  "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter whitespace-nowrap",
                                  fallbackProfit > 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                                )}>
                                  LUCRO EMPRESA: {fallbackProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">$</span>
                                <span className="text-xs font-bold text-green-600 dark:text-green-400">
                                  {fallbackSell.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                              <span className="text-[9px] text-muted-foreground max-w-[120px] truncate flex items-center justify-end gap-1" title={getCompanyName(winningQuotation.companyId)}>
                                <CompanyFavicon company={companies.find(c => c.id === winningQuotation.companyId)} size="sm" className="ring-1 ring-background" />
                                {getCompanyName(winningQuotation.companyId)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
      case 'checklist': {
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
      }
      case 'timer': {
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
      }
      case 'comments':
        return null;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
        <motion.div
           initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
           transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative w-full ${showChat || showDescriptionPane ? 'max-w-[98vw]' : 'max-w-[85vw]'} bg-background border border-border shadow-2xl rounded-xl overflow-hidden flex max-h-[98vh] transition-all duration-300`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
          {/* Drag & Drop Overlay */}
          <AnimatePresence>
            {isDragging && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] bg-primary/10 backdrop-blur-[2px] border-4 border-dashed border-primary flex flex-col items-center justify-center p-6 pointer-events-none"
              >
                <div className="bg-background/90 p-8 rounded-full shadow-2xl border-2 border-primary animate-pulse">
                  <Paperclip className="h-16 w-16 text-primary" />
                </div>
                <h3 className="mt-6 text-2xl font-black text-primary uppercase tracking-tighter">Solte para anexar ao Card</h3>
                <p className="text-sm font-bold text-muted-foreground mt-2">Imagens serão comprimidas automaticamente (Turbo-Upload)</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Description Side Pane (Left 50%) */}
          {showDescriptionPane && (
            <div className="w-[50%] border-r border-border bg-card flex flex-col shrink-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-900/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Editor de Descrição</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => toggleDescriptionPane(false)} className="text-muted-foreground hover:text-white transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
              </div>

              {/* Advanced Superior Toolbar */}
              {canEdit && (
                <div className="p-2 bg-muted/20 border-b border-border flex flex-wrap gap-1 items-center sticky top-0 z-10 backdrop-blur-sm">
                  {/* Text Style */}
                  <div className="flex items-center gap-0.5 bg-background rounded-md border border-border p-1">
                    <button onClick={() => execCommand('bold')} className="p-1.5 rounded hover:bg-primary/10 transition-colors" title="Negrito"><Bold className="h-3.5 w-3.5" /></button>
                    <button onClick={() => execCommand('italic')} className="p-1.5 rounded hover:bg-primary/10 transition-colors" title="Itálico"><Italic className="h-3.5 w-3.5" /></button>
                    <button onClick={() => execCommand('underline')} className="p-1.5 rounded hover:bg-primary/10 transition-colors" title="Sublinhado"><Underline className="h-3.5 w-3.5" /></button>
                  </div>

                  {/* Font Size */}
                  <div className="flex items-center gap-0.5 bg-background rounded-md border border-border p-1">
                    <Select 
                        defaultValue="3"
                        onValueChange={(val) => execCommand('fontSize', val)}
                    >
                        <SelectTrigger className="w-[85px] bg-transparent border-none text-[10px] h-6 font-bold px-1 focus:ring-0">
                            <SelectValue placeholder="Médio" />
                        </SelectTrigger>
                        <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                            <SelectItem value="1" className="text-[10px] font-bold">Pequeno</SelectItem>
                            <SelectItem value="2" className="text-[10px] font-bold">Normal</SelectItem>
                            <SelectItem value="3" className="text-[10px] font-bold">Médio</SelectItem>
                            <SelectItem value="4" className="text-[10px] font-bold">Grande</SelectItem>
                            <SelectItem value="5" className="text-[10px] font-bold">Título 3</SelectItem>
                            <SelectItem value="6" className="text-[10px] font-bold">Título 2</SelectItem>
                            <SelectItem value="7" className="text-[10px] font-bold">Título 1</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>

                  {/* Colors */}
                  <div className="flex items-center gap-0.5 bg-background rounded-md border border-border p-1">
                    <input type="color" className="w-5 h-5 p-0 bg-transparent border-none cursor-pointer rounded overflow-hidden" 
                           onChange={(e) => execCommand('foreColor', e.target.value)} title="Cor do Texto" />
                    <input type="color" className="w-5 h-5 p-0 bg-transparent border-none cursor-pointer rounded overflow-hidden" defaultValue="#ffff00"
                           onChange={(e) => execCommand('hiliteColor', e.target.value)} title="Destaque" />
                  </div>

                  {/* Alignment */}
                  <div className="flex items-center gap-0.5 bg-background rounded-md border border-border p-1">
                    <button onClick={() => execCommand('justifyLeft')} className="p-1.5 rounded hover:bg-primary/10 transition-colors"><AlignLeft className="h-3.5 w-3.5" /></button>
                    <button onClick={() => execCommand('justifyCenter')} className="p-1.5 rounded hover:bg-primary/10 transition-colors"><Plus className="h-3.5 w-3.5 rotate-45" /></button>
                  </div>

                  {/* Lists */}
                  <div className="flex items-center gap-0.5 bg-background rounded-md border border-border p-1">
                    <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-primary/10 transition-colors"><List className="h-3.5 w-3.5" /></button>
                  </div>

                  {/* SPREADSHEET / TABLE CONTROLS */}
                  <div className="flex items-center gap-0.5 bg-primary/5 rounded-md border border-primary/20 p-1">
                    <button onClick={insertTable} className="p-1.5 rounded hover:bg-primary/20 text-primary transition-colors font-bold" title="Criar Planilha/Tabela"><Table className="h-3.5 w-3.5" /></button>
                    <div className="w-px h-3 bg-primary/20 mx-1" />
                    <button onClick={() => tableAction('addRow')} className="p-1 group relative rounded hover:bg-green-500/10 text-green-600 transition-colors" title="Adicionar Linha Abaixo">
                        <Plus className="h-3 w-3" />
                        <span className="absolute -bottom-1 -right-1 text-[7px] font-black">R</span>
                    </button>
                    <button onClick={() => tableAction('addCol')} className="p-1 group relative rounded hover:bg-blue-500/10 text-blue-600 transition-colors" title="Adicionar Coluna Direita">
                        <Plus className="h-3 w-3" />
                        <span className="absolute -bottom-1 -right-1 text-[7px] font-black">C</span>
                    </button>
                    <button onClick={() => tableAction('delRow')} className="p-1 group relative rounded hover:bg-red-500/10 text-red-600 transition-colors" title="Excluir Linha">
                        <Trash2 className="h-3 w-3" />
                        <span className="absolute -bottom-1 -right-1 text-[7px] font-black">R</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                        const url = prompt("URL do Link:");
                        if (url) execCommand('createLink', url);
                    }} 
                    className="p-1.5 bg-background rounded-md border border-border hover:bg-primary/10 transition-colors"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-zinc-950 relative">
                <div
                    ref={editorRef}
                    contentEditable={canEdit}
                    onInput={(e) => {
                        const html = e.currentTarget.innerHTML;
                        setLocalDescription(html);
                        setIsDirty(true);
                        // SOURCE OF TRUTH: Update global store immediately so other 
                        // components see the change and fetchCardDetails doesn't override it easily
                        useKanbanStore.getState().updateCardDescriptionSync(cardId, html);
                    }}
                    onFocus={() => setIsDirty(true)}
                    onBlur={async (e) => {
                        const html = e.currentTarget.innerHTML;
                        await performSave(html);
                        setIsDirty(false);
                    }}
                    className="w-full min-h-full outline-none prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed selection:bg-primary/30"
                    style={{ 
                        fontSize: '14px',
                        lineHeight: '1.6',
                        fontFamily: 'Inter, system-ui, sans-serif'
                    }}
                />
                
                {/* Status de Salvamento Badge */}
                <AnimatePresence>
                  {saveStatus !== 'idle' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        "absolute bottom-4 right-4 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm border",
                        saveStatus === 'saving' && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                        saveStatus === 'saved' && "bg-green-500/10 text-green-600 border-green-500/20",
                        saveStatus === 'error' && "bg-red-500/10 text-red-600 border-red-500/20"
                      )}
                    >
                      {saveStatus === 'saving' && <RefreshCw className="h-2.5 w-2.5 animate-spin" />}
                      {saveStatus === 'saved' && <Check className="h-2.5 w-2.5" />}
                      {saveStatus === 'error' && <X className="h-2.5 w-2.5" />}
                      {saveStatus === 'saving' ? 'Gravando...' : saveStatus === 'saved' ? 'Salvo no Banco' : 'Erro ao Salvar'}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <style>{`
                .prose table { border-collapse: collapse; width: 100%; margin: 2em 0; }
                .prose td { border: 1px solid #e2e8f0; padding: 12px; min-width: 80px; vertical-align: top; }
                .prose tr:nth-child(even) { background-color: rgba(0,0,0,0.02); }
                .dark .prose td { border-color: #27272a; }
                .prose tr:hover td { border-color: #3b82f6 !important; }
              `}</style>
            </div>
          )}
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
                  <button 
                    onClick={() => updateCard(cardId, { completed: !card.completed })} 
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-tighter shadow-sm active:scale-95",
                      card.completed 
                        ? "bg-green-500 text-white hover:bg-green-600 ring-4 ring-green-500/20" 
                        : "bg-green-600 text-white hover:bg-green-700 shadow-lg"
                    )}
                    title={card.completed ? "Reabrir Tarefa" : "Marcar como Concluída"}
                  >
                    <Check className={cn("h-3.5 w-3.5", card.completed ? "scale-110" : "scale-90 opacity-70")} />
                    <span>{card.completed ? "CONCLUÍDO" : "CONCLUIR"}</span>
                  </button>
                  <button 
                    onClick={() => toggleDescriptionPane(!showDescriptionPane)} 
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-all text-xs font-semibold",
                      showDescriptionPane ? "bg-primary text-primary-foreground ring-2 ring-primary/20" : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                    )}
                    title="Histórico da Descrição"
                  >
                    <AlignLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Descrição</span>
                    {card.descriptionEntries?.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded-full text-[9px]">{card.descriptionEntries.length}</span>
                    )}
                  </button>

                  <button 
                    onClick={() => toggleChat(!showChat)} 
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-all text-xs font-semibold relative",
                      showChat ? "bg-primary text-primary-foreground ring-2 ring-primary/20" : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                    )}
                    title="Alternar Chat"
                  >
                    <MessageSquare className="h-4 w-4" /> 
                    <span className="hidden sm:inline">Comentários</span> 
                    {card.comments.length > 0 && (
                      <>
                        <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded-full text-[9px]">({card.comments.length})</span>
                        {!showChat && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                          </span>
                        )}
                      </>
                    )}
                  </button>
                  <button onClick={handleClose} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground">
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
                      <a href={customLink?.startsWith('http') ? customLink : `https://${customLink}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-primary/20 bg-primary/10 text-primary transition-colors shrink-0" title="Abrir Link Externo">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                </div>
              )}

              {/* COMBAT TERMINAL TRIGGER - ALWAYS VISIBLE OUTSIDE CONDITIONAL */}
              <div className="mt-4 flex flex-col gap-3 bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.15)] overflow-hidden relative group/combat">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/combat:opacity-30 transition-opacity">
                      <Zap className="h-12 w-12 text-emerald-500" />
                  </div>
                  <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                         <strong className="text-emerald-500 font-black uppercase tracking-[0.2em] text-[10px]">Polaryon Combat Tactical</strong>
                      </div>
                      <p className="text-[11px] text-white/60 mb-3">Engajamento imediato com o Compras.gov.br via Terminal Militar.</p>
                      
                      <div className="flex gap-2">
                        {(() => {
                          let uasg = '', numero = '', ano = '';
                          if (card.pncpId) {
                              const parts = card.pncpId.split('-');
                              if (parts.length >= 4) {
                                  uasg = parts[0];
                                  numero = parseInt(parts[2], 10).toString();
                                  ano = parts[3];
                              }
                          }
                          return (
                              <button 
                                onClick={() => { 
                                  const url = uasg && numero && ano 
                                    ? `polaryon://combat?uasg=${uasg}&numero=${numero}&ano=${ano}`
                                    : `polaryon://combat`;
                                  
                                  // Abre o link
                                  window.location.href = url;
                                  
                                  // Fallback se não abrir em 2 segundos
                                  setTimeout(() => {
                                      if (document.hasFocus()) {
                                          toast.error("O Terminal Desktop não respondeu. Certifique-se de que a V1.2.16+ está instalada.");
                                      }
                                  }, 2500);
                                }} 
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 text-white text-xs font-black shadow-[0_0_20px_rgba(5,150,105,0.4)] hover:bg-emerald-500 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter"
                              >
                                <Play className="h-4 w-4 fill-white" /> INICIAR LANCES AGORA
                              </button>
                          );
                        })()}
                        
                        <button onClick={() => { onClose(); navigate('/oportunidades/busca', { state: { openPncpId: card.pncpId } }); }} className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition-all" title="Ver no Explorador PNCP">
                          <Building2 className="h-4 w-4" />
                        </button>
                      </div>
                  </div>
              </div>

              {/* Modular sections - reorderable */}
              <Reorder.Group axis="y" values={sectionOrder.filter(s => s !== 'comments' && s !== 'budgets')} 
                onReorder={(newOrder) => {
                  const hidden = sectionOrder.filter(s => s === 'comments' || s === 'budgets');
                  setSectionOrder([...newOrder, ...hidden]);
                }} 
                className="space-y-5">
                {sectionOrder.filter(s => s !== 'comments' && s !== 'budgets').map(section => (
                  <Reorder.Item key={section} value={section} className="relative group">
                    <div className="absolute -left-5 top-1 opacity-0 group-hover:opacity-50 cursor-grab">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    {section === 'description' ? null : renderSection(section)}
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

          {/* Chat Side Pane (Fixed Width) */}
          {showChat && (
            <div className="w-[320px] md:w-[380px] border-l border-border bg-muted/20 flex flex-col shrink-0 flex-1">
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
                        <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold text-accent-foreground">{comment.author?.[0]?.toUpperCase() || 'U'}</div>
                        <span className="text-[11px] font-medium text-foreground">{comment.author || 'Usuário Desconhecido'}</span>
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
                    <textarea 
                      id="card-new-comment"
                      name="newComment"
                      value={newComment} 
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
          initialCardId={cardId}
          onClose={() => {
            setIsBudgetModalOpen(false);
            setSelectedBudgetToEdit(undefined);
          }}
        />
      )}

      <FilePreviewModal 
        isOpen={previewData.isOpen}
        onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
        fileUrl={previewData.url}
        fileName={previewData.name}
        fileType={previewData.type}
      />
    </AnimatePresence>
  );
};

export default CardDetailPanel;
