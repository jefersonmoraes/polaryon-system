import axios from 'axios';
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { pushEventToGoogle, deleteEventFromGoogle } from '../services/GoogleCalendarService';

const router = express.Router();
const prisma = new PrismaClient();

// PROXY ROUTE to bypass external security blocks (CORS, X-Frame-Options)
router.get('/file-proxy', async (req: Request, res: Response) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }
        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        // Remove security headers that prevent iframing
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        
        // Force PDF type for direct rendering
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        
        response.data.pipe(res);
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to fetch file' });
    }
});

const DEFAULT_LABELS = [
    { id: 'l1', name: 'URGENTE', color: '#ef4444' },
    { id: 'l2', name: 'IMPORTANTE', color: '#f97316' },
    { id: 'l3', name: 'EM PROGRESSO', color: '#eab308' },
    { id: 'l4', name: 'CONCLUÍDO', color: '#22c55e' },
    { id: 'l5', name: 'BUG', color: '#a855f7' },
    { id: 'l6', name: 'FEATURE', color: '#3b82f6' },
    { id: 'l7', name: 'DESIGN', color: '#14b8a6' },
    { id: 'l8', name: 'REVIEW', color: '#ec4899' },
];

// FOLDERS
router.get('/folders', async (req: Request, res: Response) => {
    try {
        const folders = await prisma.folder.findMany({ include: { boards: true } });
        res.json(folders);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/folders', async (req: Request, res: Response) => {
    try {
        const { boards, createdAt, updatedAt, ...data } = req.body;
        const folder = await prisma.folder.create({ data });
        res.json(folder);
    } catch (e: any) {
        console.error("Folder Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/folders/:id', async (req: Request, res: Response) => {
    try {
        const { boards, id, createdAt, updatedAt, ...data } = req.body;
        
        console.log(`[Folder Update] ID: ${req.params.id}`);
        console.log(`[Folder Update] Received keys:`, Object.keys(req.body));
        
        if (data.sideImage) {
            console.log(`[Folder Update] Received sideImage of length: ${data.sideImage.length}`);
        } else {
            console.log(`[Folder Update] No sideImage received in payload.`);
        }

        const folder = await prisma.folder.update({ where: { id: req.params.id as string }, data });
        res.json(folder);
    } catch (e: any) {
        console.error("Folder Update Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/folders/:id', async (req: Request, res: Response) => {
    try {
        await prisma.folder.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// BOARDS
router.get('/boards', async (req: Request, res: Response) => {
    try {
        const boards = await prisma.board.findMany({ include: { lists: true } });
        res.json(boards);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/boards', async (req: Request, res: Response) => {
    try {
        const { lists, createdAt, updatedAt, ...data } = req.body;
        const board = await prisma.board.create({ data });
        res.json(board);
    } catch (e: any) {
        console.error("Board Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/boards/:id', async (req: Request, res: Response) => {
    try {
        const { lists, id, createdAt, updatedAt, ...data } = req.body;
        const board = await prisma.board.update({ where: { id: req.params.id as string }, data });
        res.json(board);
    } catch (e: any) {
        console.error("Board Update Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/boards/:id', async (req: Request, res: Response) => {
    try {
        await prisma.board.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// BOARD HYDRATION: Fetch all cards of a board with full details
router.get('/boards/:id/cards', async (req: Request, res: Response) => {
    try {
        const boardId = req.params.id as string;
        const lists = await prisma.kanbanList.findMany({ 
            where: { boardId },
            select: { id: true }
        });
        const listIds = lists.map(l => l.id);
        
        const cards = await prisma.card.findMany({
            where: { listId: { in: listIds } },
            include: { 
                labels: true, 
                checklist: true, 
                items: true, 
                comments: { take: 5, orderBy: { createdAt: 'desc' } }, 
                attachments: true, 
                milestones: true, 
                timeEntries: true,
                descriptionEntries: true
            }
        });

        // Flatten labels
        const formattedCards = cards.map(card => ({
            ...card,
            labels: (card as any).labels?.map((l: any) => l.labelId) || []
        }));

        res.json(formattedCards);
    } catch (e: any) {
        console.error("Board Hydration Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// LISTS
router.get('/lists', async (req: Request, res: Response) => {
    try {
        const lists = await prisma.kanbanList.findMany({ include: { cards: true } });
        res.json(lists);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/lists', async (req: Request, res: Response) => {
    try {
        const { cards, createdAt, updatedAt, ...data } = req.body;
        const list = await prisma.kanbanList.create({ data });
        res.json(list);
    } catch (e: any) {
        console.error("List Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/lists/:id', async (req: Request, res: Response) => {
    try {
        const { cards, id, createdAt, updatedAt, ...data } = req.body;
        const list = await prisma.kanbanList.update({ where: { id: req.params.id as string }, data });
        res.json(list);
    } catch (e: any) {
        console.error("List Update Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/lists/:id', async (req: Request, res: Response) => {
    try {
        await prisma.kanbanList.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// LABELS
router.post('/labels', async (req: Request, res: Response) => {
    try {
        const { id, createdAt, updatedAt, ...data } = req.body;
        if (data.name) data.name = data.name.toUpperCase();
        const label = await prisma.label.create({ data });
        res.json(label);
    } catch (e: any) {
        // Just mock it if table doesn't exist to prevent crashes
        console.error("Label Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/labels/:id', async (req: Request, res: Response) => {
    try {
        const { id, createdAt, ...data } = req.body;
        if (data.name) data.name = data.name.toUpperCase();
        const label = await prisma.label.update({ where: { id: req.params.id as string }, data });
        res.json(label);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/labels/:id', async (req: Request, res: Response) => {
    try {
        await prisma.label.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// CARDS
router.get('/cards/:id', async (req: Request, res: Response) => {
    try {
        const cardId = req.params.id as string;
        let card = await prisma.card.findUnique({
            where: { id: cardId },
            include: { labels: true, checklist: true, items: true, comments: true, attachments: true, milestones: true, timeEntries: true }
        });
        if (!card) return res.status(404).json({ error: 'Card not found' });
        
        // Flatten labels
        const formattedCard = {
            ...card,
            labels: (card as any).labels?.map((l: any) => l.labelId) || []
        };
        
        res.json(formattedCard);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/cards', async (req: Request, res: Response) => {
    try {
        const cards = await prisma.card.findMany({
            include: { labels: true, checklist: true, milestones: true }
        });
        res.json(cards);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/cards', async (req: Request, res: Response) => {
    try {
        const { labels, checklist, items, comments, descriptionEntries, attachments, timeEntries, milestones, automationUndoAction, ...data } = req.body;
        
        let finalLabels = labels || [];

        // Automation check on Create
        if (data.listId) {
            const list = await prisma.kanbanList.findUnique({ where: { id: data.listId } });
            const automations = (list?.automations as any[]) || [];
            
            for (const action of automations) {
                if (action.type === 'add-label' && action.targetLabelName) {
                    const labelName = action.targetLabelName.toUpperCase();
                    let label = await prisma.label.findFirst({ where: { name: labelName } });
                    if (!label) {
                        label = await prisma.label.create({ data: { name: labelName, color: '#838C91' } });
                    }
                    if (!finalLabels.includes(label.id)) {
                        finalLabels.push(label.id);
                    }
                }
            }
        }

        if (data.dueDate === '') data.dueDate = null;
        else if (data.dueDate && typeof data.dueDate === 'string' && data.dueDate.length === 10) {
            data.dueDate = new Date(data.dueDate).toISOString();
        }
        if (data.startDate === '') data.startDate = null;
        else if (data.startDate && typeof data.startDate === 'string' && data.startDate.length === 10) {
            data.startDate = new Date(data.startDate).toISOString();
        }

        const card = await prisma.card.create({ data });

        // Link nested collections on create
        if (finalLabels && finalLabels.length > 0) {
            await prisma.cardLabel.createMany({
                data: finalLabels.map((labelId: string) => ({ cardId: card.id, labelId }))
            }).catch(e => console.error("Failed to link labels on create:", e));
        }

        if (checklist && checklist.length > 0) {
            await prisma.checklistItem.createMany({
                data: checklist.map((i: any) => ({ ...i, cardId: card.id }))
            }).catch(e => console.error("Failed to link checklist on create:", e));
        }

        if (items && items.length > 0) {
            await prisma.cardItem.createMany({
                data: items.map((i: any) => ({ ...i, cardId: card.id }))
            }).catch(e => console.error("Failed to link items on create:", e));
        }

        if (descriptionEntries && descriptionEntries.length > 0) {
            await prisma.cardDescriptionEntry.createMany({
                data: descriptionEntries.map((i: any) => ({ ...i, cardId: card.id }))
            }).catch(e => console.error("Failed to link description entries on create:", e));
        }

        if (milestones && milestones.length > 0) {
            await prisma.milestone.createMany({
                data: milestones.map((i: any) => ({
                    title: i.title,
                    dueDate: i.dueDate ? new Date(i.dueDate) : null,
                    hour: i.hour || null,
                    completed: !!i.completed,
                    cardId: card.id
                }))
            }).catch(e => console.error("Failed to link milestones on create:", e));
        }

        if (attachments && attachments.length > 0) {
            await prisma.attachment.createMany({
                data: attachments.map((att: any) => ({
                    cardId: card.id,
                    name: att.name,
                    url: att.url,
                    type: att.type,
                    addedAt: att.addedAt ? new Date(att.addedAt) : new Date()
                }))
            }).catch(e => console.error("Failed to link attachments on create:", e));
        }

        // Auto-sync to Google Calendar - No await to respond faster
        const list = await prisma.kanbanList.findUnique({ where: { id: card.listId } });
        const hasGoogleSync = ((list?.automations as any[]) || []).some((a: any) => a.type === 'sync-google-calendar');

        if (hasGoogleSync && !card.archived && !card.trashed) {
            if (card.dueDate && !card.completed) {
                pushEventToGoogle({
                    summary: `[Polaryon] ${(card as any).title}`,
                    description: '*[Gerado automaticamente pelo Polaryon]*\n\nEste é um evento automático criado através do seu quadro Kanban.',
                    start: { date: new Date(card.dueDate).toISOString().split('T')[0] },
                    end: { date: new Date(card.dueDate).toISOString().split('T')[0] }
                }, card.id).catch(err => console.log("[CALENDAR_SYNC_SILENT_FAIL] - Card create:", err.message));
            }
            if (milestones && milestones.length > 0) {
                 milestones.forEach((m: any) => {
                     if (m.dueDate && !m.completed) {
                          pushEventToGoogle({
                               summary: `[Etapa] ${m.title}`,
                               description: `*[Gerado pelo Polaryon]*\nEtapa do cartão: ${(card as any).title}`,
                               start: { date: new Date(m.dueDate).toISOString().split('T')[0] },
                               end: { date: new Date(m.dueDate).toISOString().split('T')[0] }
                          }, `${card.id}_milestone_${m.id}`).catch(err => console.log("[CALENDAR_SYNC_SILENT_FAIL] - Milestone create:", err.message));
                     }
                 });
            }
        }

        res.json(card);
    } catch (e: any) {
        console.error("Card Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/cards/:id', async (req: Request, res: Response) => {
    try {
        console.log(`[DEBUG_DB] --- INÍCIO DE REQUISIÇÃO PUT /cards/${req.params.id} ---`);
        console.log(`[DEBUG_DB] Chaves no req.body:`, Object.keys(req.body));
        
        const { labels, checklist, items, descriptionEntries, comments, attachments, timeEntries, milestones, automationUndoAction, force, ...updateData } = req.body;
        const cardId = req.params.id as string;
        
        const oldCard = await prisma.card.findUnique({ where: { id: cardId }, include: { labels: true } });
        let currentLabels = labels || oldCard?.labels.map(l => l.labelId) || [];

        // Automation check on Move (PUT)
        if (updateData.listId && updateData.listId !== oldCard?.listId) {
            const list = await prisma.kanbanList.findUnique({ where: { id: updateData.listId } });
            const automations = (list?.automations as any[]) || [];
            
            for (const action of automations) {
                if (action.type === 'add-label' && action.targetLabelName) {
                    const labelName = action.targetLabelName.toUpperCase();
                    let label = await prisma.label.findFirst({ where: { name: labelName } });
                    if (!label) {
                        label = await prisma.label.create({ data: { name: labelName, color: '#838C91' } });
                    }
                    if (!currentLabels.includes(label.id)) {
                        currentLabels.push(label.id);
                    }
                } else if (action.type === 'remove-label' && action.targetLabelName) {
                    const labelName = action.targetLabelName.toUpperCase();
                    const label = await prisma.label.findFirst({ where: { name: labelName } });
                    if (label) {
                        currentLabels = currentLabels.filter((id: string) => id !== label.id);
                    }
                }
            }
        }

        if (updateData.assignee !== undefined) {
            console.log(`[DEBUG_PERSISTENCE] Recebendo atualização de RESPONSÁVEL para card ${cardId}:`, updateData.assignee);
        }
        
        if (updateData.description !== undefined) {
            console.log(`[DEBUG_DB] Recebendo atualização de descrição para o card ${cardId}: "${updateData.description.substring(0, 50)}..." (${updateData.description.length} chars)`);
        }

        delete (updateData as any).updatedAt;

        if (updateData.dueDate === '') updateData.dueDate = null;
        else if (updateData.dueDate && typeof updateData.dueDate === 'string' && updateData.dueDate.length === 10) {
            updateData.dueDate = new Date(updateData.dueDate).toISOString();
        }
        if (updateData.startDate === '') updateData.startDate = null;
        else if (updateData.startDate && typeof updateData.startDate === 'string' && updateData.startDate.length === 10) {
            updateData.startDate = new Date(updateData.startDate).toISOString();
        }

        // --- ZERO LOSS POLICY ---
        // Fetch current card state before update
        const currentCard = await prisma.card.findUnique({
            where: { id: cardId },
            include: { milestones: true }
        });

        if (currentCard && updateData.description !== undefined) {
            const oldDesc = currentCard.description || '';
            const newDesc = updateData.description || '';

            // 2. Version History Log: If description changed and old was significant, log it
            if (oldDesc !== newDesc && oldDesc.length > 50) {
                // Background task - do not await to avoid blocking the user
                prisma.auditLog.create({
                    data: {
                        userId: (req as any).user?.id || 'system',
                        userName: (req as any).user?.name || 'Sistema',
                        action: 'SISTEMA',
                        entity: 'CARTÃO',
                        details: `HISTÓRICO_RECUPERÁVEL: Versão anterior da descrição do cartão "${currentCard.title}" preservada. [Tamanho: ${oldDesc.length}]`
                    }
                }).catch(e => console.error("Failed to log recovery version:", e));
                
                // Log specifically to server console for deep retrieval if needed
                console.log(`[RECOVERY_BACKUP] Card ${cardId} Old Desc: ${oldDesc.substring(0, 100)}...`);
            }
        }
        // --- END ZERO LOSS POLICY ---

        console.log(`[DEBUG_DB] Chaves para o Prisma Update: ${Object.keys(updateData).join(', ')}`);
        
        const card = await prisma.card.update({ 
            where: { id: cardId }, 
            data: updateData 
        });

        // --- PARALLEL RELATED UPDATES ---
        const updatePromises: Promise<any>[] = [];

        // --- CASCADING BUDGETS ---
        // If archived or trashed status changed, update linked budgets
        if (updateData.archived !== undefined || updateData.trashed !== undefined) {
            updatePromises.push((async () => {
                // Find affected budgets first to know their IDs for broadcasting
                const affectedBudgets = await prisma.budget.findMany({
                    where: { cardId },
                    select: { id: true }
                });

                if (affectedBudgets.length > 0) {
                    const budgetIds = affectedBudgets.map(b => b.id);

                    if (updateData.archived !== undefined) {
                        await prisma.budget.updateMany({
                            where: { id: { in: budgetIds } },
                            data: { archived: updateData.archived }
                        });
                        
                        // Broadcast update to each budget
                        try {
                            const { getIO } = require('../socket');
                            const io = getIO();
                            budgetIds.forEach(id => {
                                io.emit('system_sync', { 
                                    store: 'KANBAN', 
                                    type: 'UPDATE_BUDGET', 
                                    payload: { id, data: { archived: updateData.archived } } 
                                });
                            });
                        } catch (err) { console.error("Socket broadcast failed:", err); }
                    }

                    if (updateData.trashed !== undefined) {
                        await prisma.budget.updateMany({
                            where: { id: { in: budgetIds } },
                            data: { 
                                trashed: updateData.trashed,
                                trashedAt: updateData.trashed ? new Date() : null
                            }
                        });

                        // Broadcast trash/restore to each budget
                        try {
                            const { getIO } = require('../socket');
                            const io = getIO();
                            budgetIds.forEach(id => {
                                io.emit('system_sync', { 
                                    store: 'KANBAN', 
                                    type: updateData.trashed ? 'TRASH_BUDGET' : 'RESTORE_BUDGET', 
                                    payload: { id } 
                                });
                            });
                        } catch (err) { console.error("Socket broadcast failed:", err); }
                    }
                }
            })());
        }

        // Update Labels relationship (Array of Strings to link table)
        if (currentLabels !== undefined) {
            updatePromises.push((async () => {
                await prisma.cardLabel.deleteMany({ where: { cardId } });
                if (currentLabels.length > 0) {
                    await prisma.cardLabel.createMany({
                        data: currentLabels.map((l: string) => ({ cardId, labelId: l }))
                    });
                }
            })());
        }

        if (checklist !== undefined) {
            updatePromises.push((async () => {
                await prisma.checklistItem.deleteMany({ where: { cardId } });
                if (checklist.length > 0) {
                    await prisma.checklistItem.createMany({
                        data: checklist.map((i: any) => ({ ...i, cardId }))
                    });
                }
            })());
        }

        if (items !== undefined) {
            updatePromises.push((async () => {
                await prisma.cardItem.deleteMany({ where: { cardId } });
                if (items.length > 0) {
                    await prisma.cardItem.createMany({
                        data: items.map((i: any) => ({ ...i, cardId }))
                    });
                }
            })());
        }

        if (descriptionEntries !== undefined) {
            updatePromises.push((async () => {
                await prisma.cardDescriptionEntry.deleteMany({ where: { cardId } });
                if (descriptionEntries.length > 0) {
                    await prisma.cardDescriptionEntry.createMany({
                        data: descriptionEntries.map((i: any) => ({ 
                            id: i.id || undefined,
                            text: i.text,
                            createdAt: i.createdAt || new Date(),
                            cardId 
                        }))
                    });
                }
            })());
        }

        if (comments !== undefined) {
            updatePromises.push((async () => {
                await prisma.comment.deleteMany({ where: { cardId } });
                if (comments.length > 0) {
                    await prisma.comment.createMany({
                        data: comments.map((i: any) => ({ ...i, cardId }))
                    });
                }
            })());
        }

        if (timeEntries !== undefined) {
            updatePromises.push((async () => {
                await prisma.timeEntry.deleteMany({ where: { cardId } });
                if (timeEntries.length > 0) {
                    await prisma.timeEntry.createMany({
                        data: timeEntries.map((i: any) => ({ ...i, cardId }))
                    });
                }
            })());
        }

        if (milestones !== undefined) {
            updatePromises.push((async () => {
                await prisma.milestone.deleteMany({ where: { cardId } });
                if (milestones.length > 0) {
                    await prisma.milestone.createMany({
                        data: milestones.map((i: any) => {
                            let parsedDate = i.dueDate;
                            if (parsedDate === '') parsedDate = null;
                            return { 
                                title: i.title, 
                                dueDate: parsedDate ? new Date(parsedDate) : null, 
                                hour: i.hour || null,
                                completed: !!i.completed,
                                cardId 
                            };
                        })
                    });
                }
            })());
        }

        if (attachments !== undefined) {
            updatePromises.push((async () => {
                await prisma.attachment.deleteMany({ where: { cardId } });
                if (attachments.length > 0) {
                    await prisma.attachment.createMany({
                        data: attachments.map((att: any) => ({ ...att, cardId }))
                    });
                }
            })());
        }

        // Execute all updates in parallel to maximize performance and minimize response time
        await Promise.all(updatePromises).catch(err => {
            console.error("[CRITICAL_DB_SYNC_ERROR] - Async sub-table updates failed:", err);
            // We don't throw here to ensure the main card update is at least returned, 
            // but in a real prod environment we might want to handle this more strictly.
        });

        // Auto-sync or cleanup Google Calendar - No await to respond faster
        const targetListId = card.listId;
        const list = await prisma.kanbanList.findUnique({ where: { id: targetListId } });
        const hasGoogleSync = ((list?.automations as any[]) || []).some((a: any) => a.type === 'sync-google-calendar');

        if (card.trashed || card.archived) {
            deleteEventFromGoogle(card.id).catch(err => console.log("[CALENDAR_SYNC_SILENT_FAIL] - Card delete:", err.message));
            if (milestones && milestones.length > 0) {
                 milestones.forEach((m: any) => deleteEventFromGoogle(`${card.id}_milestone_${m.id}`).catch(() => {}));
            } else if (currentCard?.milestones && Array.isArray(currentCard.milestones)) {
                 currentCard.milestones.forEach((m: any) => deleteEventFromGoogle(`${card.id}_milestone_${m.id}`).catch(() => {}));
            }
        } else {
            if (card.completed && card.dueDate) {
                pushEventToGoogle({
                    summary: `[✓] ${(card as any).title}`,
                    description: '*[Concluído no Polaryon]*\n\nEste evento foi marcado como finalizado no seu quadro Kanban.',
                    start: { date: new Date(card.dueDate).toISOString().split('T')[0] },
                    end: { date: new Date(card.dueDate).toISOString().split('T')[0] }
                }, card.id).catch(err => console.log("[CALENDAR_SYNC_SILENT_FAIL] - Card completed update:", err.message));
            } else if (hasGoogleSync && card.dueDate) {
                pushEventToGoogle({
                    summary: `[Polaryon] ${(card as any).title}`,
                    description: '*[Gerado automaticamente pelo Polaryon]*\n\nEste é um evento automático atualizado do seu quadro Kanban.',
                    start: { date: new Date(card.dueDate).toISOString().split('T')[0] },
                    end: { date: new Date(card.dueDate).toISOString().split('T')[0] }
                }, card.id).catch(err => console.log("[CALENDAR_SYNC_SILENT_FAIL] - Card update:", err.message));
            }

            const msToSync = milestones !== undefined ? milestones : (currentCard as any)?.milestones || [];
            if (milestones !== undefined && (currentCard as any)?.milestones) {
                 const newMsIds = milestones.map((m: any) => m.id);
                 const deletedMs = (currentCard as any).milestones.filter((oldMs: any) => !newMsIds.includes(oldMs.id));
                 deletedMs.forEach((oldMs: any) => {
                      deleteEventFromGoogle(`${card.id}_milestone_${oldMs.id}`).catch(() => {});
                 });
            }

            msToSync.forEach((m: any) => {
                if (m.completed || card.completed) {
                    if (m.dueDate) {
                         pushEventToGoogle({
                             summary: `[✓] ${m.title}`,
                             description: `*[Gerado pelo Polaryon]*\nEtapa Concluída!\nCartão: ${(card as any).title}`,
                             start: { date: new Date(m.dueDate).toISOString().split('T')[0] },
                             end: { date: new Date(m.dueDate).toISOString().split('T')[0] }
                         }, `${card.id}_milestone_${m.id}`).catch(() => {});
                    }
                } else if (hasGoogleSync && m.dueDate) {
                    pushEventToGoogle({
                        summary: `[Etapa] ${m.title}`,
                        description: `*[Gerado pelo Polaryon]*\nEtapa do cartão: ${(card as any).title}`,
                        start: { date: new Date(m.dueDate).toISOString().split('T')[0] },
                        end: { date: new Date(m.dueDate).toISOString().split('T')[0] }
                    }, `${card.id}_milestone_${m.id}`).catch(() => {});
                }
            });
        }


        res.json(card);
    } catch (e: any) {
        console.error("Card Update Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/cards/reorder', async (req: Request, res: Response) => {
    try {
        const { listId, cardIds } = req.body;
        if (!listId || !Array.isArray(cardIds)) {
            return res.status(400).json({ error: 'listId and cardIds array are required' });
        }

        // Use transaction to ensure all positions are updated correctly
        await prisma.$transaction(
            cardIds.map((id, index) =>
                prisma.card.update({
                    where: { id },
                    data: { listId, position: index }
                })
            )
        );

        res.json({ success: true });
    } catch (e: any) {
        console.error("Card Reorder Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/cards/:id', async (req: Request, res: Response) => {
    try {
        const cardId = req.params.id as string;

        // Find budgets to delete for broadcasting
        const budgetsToDelete = await prisma.budget.findMany({
            where: { cardId },
            select: { id: true }
        });

        // Manual Cascading Delete for Budgets
        await prisma.budget.deleteMany({ where: { cardId } });

        // Broadcast budget deletion
        if (budgetsToDelete.length > 0) {
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                budgetsToDelete.forEach(b => {
                    io.emit('system_sync', { store: 'KANBAN', type: 'DELETE_BUDGET', payload: { id: b.id } });
                });
            } catch (err) { console.error("Socket broadcast failed:", err); }
        }

        await prisma.card.delete({ where: { id: cardId } });

        // Auto-cleanup on hard delete
        deleteEventFromGoogle(req.params.id as string).catch(err => console.error("Background sync delete failed:", err));

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// COMPANIES
router.get('/companies', async (req: Request, res: Response) => {
    try {
        const companies = await prisma.company.findMany();
        res.json(companies);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/companies', async (req: Request, res: Response) => {
    try {
        const company = await prisma.company.create({ data: req.body });
        res.json(company);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/companies/:id', async (req: Request, res: Response) => {
    try {
        const { id, createdAt, ...data } = req.body;
        const company = await prisma.company.update({ where: { id: req.params.id as string }, data });
        res.json(company);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/companies/:id', async (req: Request, res: Response) => {
    try {
        await prisma.company.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// MAIN COMPANY PROFILES
router.get('/main-companies', async (req: Request, res: Response) => {
    try {
        const mainCompanies = await prisma.mainCompanyProfile.findMany();
        res.json(mainCompanies);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/main-companies', async (req: Request, res: Response) => {
    try {
        const mainComp = await prisma.mainCompanyProfile.create({ data: req.body });
        res.json(mainComp);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/main-companies/:id', async (req: Request, res: Response) => {
    try {
        const { id, createdAt, ...data } = req.body;
        const mainComp = await prisma.mainCompanyProfile.update({ where: { id: req.params.id as string }, data });
        res.json(mainComp);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/main-companies/:id', async (req: Request, res: Response) => {
    try {
        await prisma.mainCompanyProfile.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ROUTES
router.get('/routes', async (req: Request, res: Response) => {
    try {
        const routes = await prisma.route.findMany();
        res.json(routes);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/routes', async (req: Request, res: Response) => {
    try {
        const route = await prisma.route.create({ data: req.body });
        res.json(route);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/routes/:id', async (req: Request, res: Response) => {
    try {
        const { id, createdAt, ...data } = req.body;
        const route = await prisma.route.update({ where: { id: req.params.id as string }, data });
        res.json(route);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/routes/:id', async (req: Request, res: Response) => {
    try {
        await prisma.route.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// BUDGETS
router.get('/budgets', async (req: Request, res: Response) => {
    try {
        const budgets = await prisma.budget.findMany();
        // Strip heavy base64 url from items JSON for the general listing if needed
        const stripped = budgets.map(b => ({
            ...b,
            items: (b.items as any[] || []).map(item => ({
                ...item,
                attachments: (item.attachments || []).map((a: any) => ({ ...a, url: "" }))
            }))
        }));
        res.json(stripped);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// New endpoint for single budget full detail (with attachments)
router.get('/budgets/:id', async (req: Request, res: Response) => {
    try {
        const budget = await prisma.budget.findUnique({ where: { id: req.params.id as string } });
        res.json(budget);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// New endpoint for specific attachment content inside a budget
router.get('/budgets/:budgetId/attachment-content/:attachmentId', async (req: Request, res: Response) => {
    try {
        const budget = await prisma.budget.findUnique({ where: { id: req.params.budgetId as string } });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });
        
        const items = budget.items as any[] || [];
        for (const item of items) {
           const att = (item.attachments || []).find((a: any) => a.id === (req.params.attachmentId as string));
           if (att) {
               if (!att.url || att.url.trim() === "") {
                   return res.status(404).json({ error: 'Attachment exists but has no content (URL is empty)' });
               }
               return res.json({ url: att.url });
           }
        }
        res.status(404).json({ error: 'Attachment not found in budget items' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/budgets', async (req: Request, res: Response) => {
    try {
        const budget = await prisma.budget.create({ data: req.body });
        res.json(budget);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/budgets/:id', async (req: Request, res: Response) => {
    try {
        const { id, createdAt, ...data } = req.body;
        const budgetId = req.params.id as string;

        // --- DATA INTEGRITY PROTECTION [V6] ---
        // If items are being updated, preserve existing attachment URLs if incoming are empty
        if (data.items && Array.isArray(data.items)) {
            const existingBudget = await prisma.budget.findUnique({ where: { id: budgetId } });
            if (existingBudget && existingBudget.items) {
                const oldItems = existingBudget.items as any[];
                data.items = data.items.map((newItem: any) => {
                    const oldItem = oldItems.find((oi: any) => oi.id === newItem.id);
                    if (oldItem && oldItem.attachments && newItem.attachments) {
                        newItem.attachments = newItem.attachments.map((newAtt: any) => {
                            const oldAtt = oldItem.attachments.find((oa: any) => oa.id === newAtt.id);
                            // If new URL is empty but old one wasn't, preserve the old content
                            if ((!newAtt.url || newAtt.url === "") && (oldAtt && oldAtt.url && oldAtt.url !== "")) {
                                return { ...newAtt, url: oldAtt.url };
                            }
                            return newAtt;
                        });
                    }
                    return newItem;
                });
            }
        }
        // --- END PROTECTION ---

        const budget = await prisma.budget.update({ where: { id: budgetId }, data });
        res.json(budget);
    } catch (e: any) {
        console.error("Budget Update Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/budgets/:id', async (req: Request, res: Response) => {
    try {
        await prisma.budget.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// NOTIFICATIONS
router.get('/notifications', async (req: Request, res: Response) => {
    try {
        const notifications = await prisma.notification.findMany();
        res.json(notifications);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/notifications', async (req: Request, res: Response) => {
    try {
        const notification = await prisma.notification.create({ data: req.body });
        res.json(notification);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/notifications/:id', async (req: Request, res: Response) => {
    try {
        const notification = await prisma.notification.update({ where: { id: req.params.id as string }, data: req.body });
        res.json(notification);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/notifications/:id', async (req: Request, res: Response) => {
    try {
        await prisma.notification.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// New endpoint for standalone attachment content (Card Attachments)
router.get('/attachments/:id/content', async (req: Request, res: Response) => {
    try {
        const att = await prisma.attachment.findUnique({ where: { id: req.params.id as string } });
        if (!att) return res.status(404).json({ error: 'Not found' });
        res.json({ url: att.url });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// SYNC CORE (Pull minimal state to client board) [V7.1.0 - Resilient Trash Support]
router.get('/sync', async (req: Request, res: Response) => {
    try {
        // Use Promise.allSettled to prevent one missing table from crashing the whole Kanban sync
        const results = await Promise.allSettled([
            prisma.folder.findMany(),
            prisma.board.findMany(),
            prisma.kanbanList.findMany(),
            prisma.card.findMany({
                // Include recently active cards and a subset of trashed/archived for the trash bin
                // For performance, we could skip very old items, but for now we pull all to support the Lixeira view
                select: {
                    id: true, title: true, listId: true, position: true,
                    dueDate: true, startDate: true, completed: true, archived: true,
                    trashed: true, pncpId: true, assignee: true, createdAt: true,
                    customLink: true, summary: true,
                    labels: { select: { labelId: true } },
                    milestones: {
                        select: { id: true, title: true, dueDate: true, hour: true, completed: true }
                    },
                    _count: {
                        select: {
                            comments: true,
                            attachments: true,
                            checklist: true,
                            milestones: true,
                            items: true,
                            descriptionEntries: true
                        }
                    }
                }
            }),
            prisma.budget.findMany({
                select: { id: true, title: true, status: true, totalValue: true, trashed: true, archived: true, cardId: true, createdAt: true }
            }),
            prisma.notification.findMany({ take: 30, orderBy: { createdAt: 'desc' } }),
            prisma.user.findMany({
                where: { role: { notIn: ['disabled', 'pending'] } },
                select: { id: true, name: true, email: true, picture: true }
            }),
            prisma.mainCompanyProfile.findMany(),
            prisma.label.findMany(),
            prisma.companyDocument.findMany({
                select: { id: true, title: true, expirationDate: true, status: true, type: true, trashed: true }
            }),
            prisma.taxObligation.findMany({
                select: { id: true, name: true, dueDate: true, status: true, amount: true, trashed: true }
            }),
        ]);

        // Helper to extract value or empty array on failure
        const getValue = (result: any) => result.status === 'fulfilled' ? result.value : [];
        if (results.some(r => r.status === 'rejected')) {
            const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
            rejected.forEach(r => console.error("[SYNC_PARTIAL_FAILURE]:", r.reason));
        }

        const folders = getValue(results[0]);
        const boards = getValue(results[1]);
        const lists = getValue(results[2]);
        const cardsRaw = getValue(results[3]);
        const budgetsRaw = getValue(results[4]);
        const notifications = getValue(results[5]);
        const usersDb = getValue(results[6]);
        const mainCompanies = getValue(results[7]);
        const labels = getValue(results[8]);
        const documents = getValue(results[9]);
        const taxes = getValue(results[10]);

        const members = usersDb
            .filter((u: any) => u.email !== 'jjcorporation2018@gmail.com')
            .map((u: any) => ({
                id: u.id,
                name: u.name || u.email.split('@')[0],
                email: u.email,
                avatar: u.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email.split('@')[0])}&background=random`
            }));

        const skeletalCards = cardsRaw.map((c: any) => ({
            ...c,
            labels: (c.labels || []).map((l: any) => l.labelId),
            isSkeleton: true,
            comments: Array(c._count.comments).fill({ isSkeleton: true }),
            attachments: Array(c._count.attachments).fill({ isSkeleton: true }),
            checklist: Array(c._count.checklist).fill({ isSkeleton: true }),
            milestones: c.milestones || [],
            items: Array(c._count.items).fill({ isSkeleton: true }),
            descriptionEntries: Array(c._count.descriptionEntries).fill({ isSkeleton: true })
        }));

        const skeletalBudgets = budgetsRaw.map((b: any) => ({
            ...b,
            isSkeleton: true
        }));

        res.json({ 
            folders, boards, lists, cards: skeletalCards, budgets: skeletalBudgets, 
            notifications, members, mainCompanies, labels,
            documents, taxes
        });
    } catch (e: any) {
        console.error("SYNK_FATAL_ERROR:", e);
        res.status(500).json({ error: e.message });
    }
});

// FAVICON PROXY (Silences 404 console errors by returning a default image on failure)
router.get('/favicon-proxy', async (req: Request, res: Response) => {
    let { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).send('Domain is required');
    }

    const axios = require('axios');
    const domain = url.trim().toLowerCase();
    
    // Fallback Icon SVG
    const fallbackSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
    `;

    const tryFetch = async (targetUrl: string) => {
        try {
            console.log(`[FAVICON_PROXY] Fetching: ${targetUrl}`);
            const response = await axios({
                method: 'get',
                url: targetUrl,
                responseType: 'arraybuffer',
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                }
            });
            
            // Check if it's actually an image (Google sometimes returns 200 with HTML/text if blocked)
            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('text/html')) {
                console.warn(`[FAVICON_PROXY] Warning: Received HTML instead of image from ${targetUrl}`);
                return null;
            }

            console.log(`[FAVICON_PROXY] Success: ${targetUrl} (${contentType})`);
            return {
                data: response.data,
                contentType: contentType
            };
        } catch (e: any) {
            console.error(`[FAVICON_PROXY] Error fetching ${targetUrl}: ${e.message}`);
            return null;
        }
    };

    try {
        const variations = [
            domain,
            domain.startsWith('www.') ? domain.replace('www.', '') : `www.${domain}`
        ];

        let result = null;

        // Attempt Chain
        for (const variant of variations) {
            // Attempt 1: Google S2 (The most reliable for many domains)
            result = await tryFetch(`https://www.google.com/s2/favicons?domain=${variant}&sz=64`);
            if (result) break;

            // Attempt 2: DuckDuckGo
            result = await tryFetch(`https://icons.duckduckgo.com/ip3/${variant}.ico`);
            if (result) break;
        }

        if (result) {
            res.set('Content-Type', result.contentType || 'image/x-icon');
            res.set('Cache-Control', 'public, max-age=86400'); // 24h cache
            return res.send(result.data);
        }

        // Final Fallback: Internal SVG
        console.log(`[FAVICON_PROXY] No icon found for ${domain}. Serving fallback SVG.`);
        res.set('Content-Type', 'image/svg+xml');
        res.set('Cache-Control', 'public, max-age=3600');
        res.status(200).send(fallbackSvg);
    } catch (error) {
        res.set('Content-Type', 'image/svg+xml');
        res.status(200).send(fallbackSvg);
    }
});

// SOCKET PROXY (Allows frontend to trigger broadcasts via server)
router.post('/socketproxy', async (req: Request, res: Response) => {
    try {
        const { store, type, payload } = req.body;
        if (!store || !type) {
            return res.status(400).json({ error: 'Store and type are required' });
        }

        const { getIO } = require('../socket');
        const io = getIO();
        
        // Broadcast to all connected clients
        io.emit('system_sync', { store, type, payload });
        
        console.log(`📡 Broadcasted ${type} for store ${store} via proxy.`);
        res.json({ success: true });
    } catch (e: any) {
        console.error("Socket Proxy Error:", e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
