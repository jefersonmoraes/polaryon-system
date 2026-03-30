import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { pushEventToGoogle, deleteEventFromGoogle } from '../services/GoogleCalendarService';

const router = express.Router();
const prisma = new PrismaClient();

const DEFAULT_LABELS = [
    { id: 'l1', name: 'Urgente', color: '#ef4444' },
    { id: 'l2', name: 'Importante', color: '#f97316' },
    { id: 'l3', name: 'Em progresso', color: '#eab308' },
    { id: 'l4', name: 'Concluído', color: '#22c55e' },
    { id: 'l5', name: 'Bug', color: '#a855f7' },
    { id: 'l6', name: 'Feature', color: '#3b82f6' },
    { id: 'l7', name: 'Design', color: '#14b8a6' },
    { id: 'l8', name: 'Review', color: '#ec4899' },
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
        const { boards, ...data } = req.body;
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
        const { lists, ...data } = req.body;
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
        const { cards, ...data } = req.body;
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
        const label = await prisma.label.create({ data: req.body });
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
        if (labels && labels.length > 0) {
            await prisma.cardLabel.createMany({
                data: labels.map((labelId: string) => ({ cardId: card.id, labelId }))
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

        // Auto-sync to Google Calendar if due date is present
        if (card.dueDate && !card.completed && !card.archived && !card.trashed) {
            pushEventToGoogle({
                summary: `[Polaryon] ${(card as any).title}`,
                description: '*[Gerado automaticamente pelo Polaryon]*\n\nEste é um evento automático criado através do seu quadro Kanban.',
                start: { date: new Date(card.dueDate).toISOString().split('T')[0] },
                end: { date: new Date(card.dueDate).toISOString().split('T')[0] }
            }, card.id).catch(err => console.error("Background sync failed:", err));
        }

        res.json(card);
    } catch (e: any) {
        console.error("Card Create Error:", e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/cards/:id', async (req: Request, res: Response) => {
    try {
        const { labels, checklist, items, descriptionEntries, comments, attachments, timeEntries, milestones, automationUndoAction, force, ...updateData } = req.body;
        const cardId = req.params.id as string;
        
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
            select: { description: true, title: true }
        });

        if (currentCard && updateData.description !== undefined) {
            const oldDesc = currentCard.description || '';
            const newDesc = updateData.description || '';

            // 2. Version History Log: If description changed and old was significant, log it
            if (oldDesc !== newDesc && oldDesc.length > 50) {
                await prisma.auditLog.create({
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

        // Update Labels relationship (Array of Strings to link table)
        if (labels !== undefined) {
            await prisma.cardLabel.deleteMany({ where: { cardId } });
            if (labels.length > 0) {
                await prisma.cardLabel.createMany({
                    data: labels.map((labelId: string) => ({ cardId, labelId }))
                }).catch(e => console.error("Failed to link labels:", e));
            }
        }

        if (checklist !== undefined) {
            await prisma.checklistItem.deleteMany({ where: { cardId } });
            if (checklist.length > 0) {
                await prisma.checklistItem.createMany({
                    data: checklist.map((i: any) => ({ ...i, cardId }))
                });
            }
        }

        if (items !== undefined) {
            await prisma.cardItem.deleteMany({ where: { cardId } });
            if (items.length > 0) {
                await prisma.cardItem.createMany({
                    data: items.map((i: any) => ({ ...i, cardId }))
                });
            }
        }

        if (descriptionEntries !== undefined) {
            await prisma.cardDescriptionEntry.deleteMany({ where: { cardId } });
            if (descriptionEntries.length > 0) {
                await prisma.cardDescriptionEntry.createMany({
                    data: descriptionEntries.map((i: any) => ({ 
                        id: i.id || undefined, // Keep ID if present for sync
                        text: i.text,
                        createdAt: i.createdAt || new Date(),
                        cardId 
                    }))
                });
            }
        }

        if (comments !== undefined) {
            await prisma.comment.deleteMany({ where: { cardId } });
            if (comments.length > 0) {
                await prisma.comment.createMany({
                    data: comments.map((i: any) => ({ ...i, cardId }))
                });
            }
        }

        if (timeEntries !== undefined) {
            await prisma.timeEntry.deleteMany({ where: { cardId } });
            if (timeEntries.length > 0) {
                await prisma.timeEntry.createMany({
                    data: timeEntries.map((i: any) => ({ ...i, cardId }))
                });
            }
        }

        if (milestones !== undefined) {
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
        }

        if (attachments !== undefined) {
            await prisma.attachment.deleteMany({ where: { cardId } });
            if (attachments.length > 0) {
                for (const att of attachments) {
                    // Create one by one to avoid large payload errors or handle them gracefully
                    await prisma.attachment.create({ data: { ...att, cardId } });
                }
            }
        }

        // Auto-sync or cleanup Google Calendar based on state
        if (card.completed || card.archived || card.trashed) {
            deleteEventFromGoogle(card.id).catch(err => console.error("Background sync delete failed:", err));
        } else if (card.dueDate) {
            pushEventToGoogle({
                summary: `[Polaryon] ${(card as any).title}`,
                description: '*[Gerado automaticamente pelo Polaryon]*\n\nEste é um evento automático atualizado do seu quadro Kanban.',
                start: { date: new Date(card.dueDate).toISOString().split('T')[0] },
                end: { date: new Date(card.dueDate).toISOString().split('T')[0] }
            }, card.id).catch(err => console.error("Background sync failed:", err));
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
        await prisma.card.delete({ where: { id: req.params.id as string } });

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
        res.json(budgets);
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
        const budget = await prisma.budget.update({ where: { id: req.params.id as string }, data });
        res.json(budget);
    } catch (e: any) {
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

// SYNC ALL (Pull state to client)
router.get('/sync', async (req: Request, res: Response) => {
    try {
        // Guarantee default labels exist in postgres to prevent FK errors when cards link them
        await prisma.label.createMany({
            data: DEFAULT_LABELS,
            skipDuplicates: true
        }).catch(e => console.error("Label seed skipped", e));

        const [folders, boards, lists, cards, companies, mainCompanies, routes, budgets, notifications, usersDb, labels, companyDocs, essentialDocs, certificates, accountingCategories, bankAccounts, accountingEntries, recurringExpenses, invoices, bankTransactions, taxObligations, accountingSettings, accountantExports, auditLogs] = await Promise.all([
            prisma.folder.findMany(),
            prisma.board.findMany(),
            prisma.kanbanList.findMany(),
            prisma.card.findMany({
                // Incluindo anexos e comentários para garantir persistência na UI
                include: { labels: true, checklist: true, items: true, milestones: true, timeEntries: true, attachments: true, comments: true }
            }),
            prisma.company.findMany(),
            prisma.mainCompanyProfile.findMany({ orderBy: { id: 'asc' } }),
            prisma.route.findMany(),
            prisma.budget.findMany(),
            prisma.notification.findMany(),
            prisma.user.findMany({
                where: {
                    role: {
                        notIn: ['disabled', 'pending']
                    }
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    picture: true
                }
            }),
            prisma.label.findMany(),
            prisma.companyDocument.findMany(),
            prisma.essentialDocument.findMany(),
            prisma.certificate.findMany({ include: { attachments: true } }),
            prisma.accountingCategory.findMany(),
            prisma.bankAccount.findMany(),
            prisma.accountingEntry.findMany(),
            prisma.recurringExpense.findMany(),
            prisma.invoice.findMany(),
            prisma.bankTransaction.findMany(),
            prisma.taxObligation.findMany(),
            prisma.accountingSettings.findMany(),
            prisma.accountantExport.findMany(),
            prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 5000 })
        ]);

        const members = usersDb
            .filter((u: any) => u.email !== 'jjcorporation2018@gmail.com')
            .map((u: any) => ({
                id: u.id,
                name: u.name || u.email.split('@')[0],
                email: u.email,
                avatar: u.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email.split('@')[0])}&background=random`
            }));

        const formattedCards = cards.map((c: any) => ({
            ...c,
            labels: (c.labels || []).map((l: any) => l.labelId), // flatten intersection table into string array
            attachments: c.attachments || [],
            comments: c.comments || [],
            milestones: c.milestones || [],
            checklist: c.checklist || [],
            items: c.items || [],
            timeEntries: c.timeEntries || []
        }));

        res.json({ 
            folders, boards, lists, cards: formattedCards, companies, 
            mainCompanies, routes, budgets, notifications, members, 
            labels, companyDocs, essentialDocs, certificates,
            accounting: {
                categories: accountingCategories,
                bankAccounts,
                entries: accountingEntries,
                recurringExpenses,
                invoices,
                bankTransactions,
                taxObligations,
                settings: accountingSettings.reduce((acc: any, curr: any) => ({ ...acc, [curr.companyId]: curr }), {}),
                exports: accountantExports
            },
            auditLogs
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
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
