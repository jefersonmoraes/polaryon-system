import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET all accounting data
router.get('/sync', async (req: Request, res: Response) => {
    try {
        const categories = await prisma.accountingCategory.findMany();
        const bankAccounts = await prisma.bankAccount.findMany();
        const entries = await prisma.accountingEntry.findMany();
        const recurringExpenses = await prisma.recurringExpense.findMany();
        const invoices = await prisma.invoice.findMany();
        const bankTransactions = await prisma.bankTransaction.findMany();
        const taxObligations = await prisma.taxObligation.findMany();
        const settings = await prisma.accountingSettings.findMany();
        const exportsList = await prisma.accountantExport.findMany();

        res.json({
            categories,
            bankAccounts,
            entries,
            recurringExpenses,
            invoices,
            bankTransactions,
            taxObligations,
            settings: settings.reduce((acc: any, curr: any) => ({ ...acc, [curr.companyId]: curr }), {}),
            exports: exportsList
        });
    } catch (error) {
        console.error('Falha ao buscar dados contábeis:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Generic UPSERT and DELETE for entities
router.post('/:entity', async (req: Request, res: Response) => {
    const { entity } = req.params;
    const data = req.body;
    try {
        let result;
        switch(entity) {
            case 'category': result = await prisma.accountingCategory.create({ data }); break;
            case 'bankAccount': result = await prisma.bankAccount.create({ data }); break;
            case 'entry': result = await prisma.accountingEntry.create({ data }); break;
            case 'recurringExpense': result = await prisma.recurringExpense.create({ data }); break;
            case 'invoice': result = await prisma.invoice.create({ data }); break;
            case 'bankTransaction': result = await prisma.bankTransaction.create({ data }); break;
            case 'taxObligation': result = await prisma.taxObligation.create({ data }); break;
            case 'export': result = await prisma.accountantExport.create({ data }); break;
            default: return res.status(400).json({ error: 'Entidade inválida' });
        }
        res.json(result);
    } catch (error) {
        console.error(`Erro ao criar ${entity}:`, error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

router.put('/:entity/:id', async (req: Request, res: Response) => {
    const { entity, id } = req.params;
    const data = req.body;
    try {
        let result;
        switch(entity) {
            case 'category': result = await prisma.accountingCategory.update({ where: { id: id as string }, data }); break;
            case 'bankAccount': result = await prisma.bankAccount.update({ where: { id: id as string }, data }); break;
            case 'entry': result = await prisma.accountingEntry.update({ where: { id: id as string }, data }); break;
            case 'recurringExpense': result = await prisma.recurringExpense.update({ where: { id: id as string }, data }); break;
            case 'invoice': result = await prisma.invoice.update({ where: { id: id as string }, data }); break;
            case 'bankTransaction': result = await prisma.bankTransaction.update({ where: { id: id as string }, data }); break;
            case 'taxObligation': result = await prisma.taxObligation.update({ where: { id: id as string }, data }); break;
            case 'export': result = await prisma.accountantExport.update({ where: { id: id as string }, data }); break;
            default: return res.status(400).json({ error: 'Entidade inválida' });
        }
        res.json(result);
    } catch (error) {
        console.error(`Erro ao atualizar ${entity}:`, error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

router.delete('/:entity/:id', async (req: Request, res: Response) => {
    const { entity, id } = req.params;
    try {
        switch(entity) {
            case 'category': await prisma.accountingCategory.delete({ where: { id: id as string } }); break;
            case 'bankAccount': await prisma.bankAccount.delete({ where: { id: id as string } }); break;
            case 'entry': await prisma.accountingEntry.delete({ where: { id: id as string } }); break;
            case 'recurringExpense': await prisma.recurringExpense.delete({ where: { id: id as string } }); break;
            case 'invoice': await prisma.invoice.delete({ where: { id: id as string } }); break;
            case 'bankTransaction': await prisma.bankTransaction.delete({ where: { id: id as string } }); break;
            case 'taxObligation': await prisma.taxObligation.delete({ where: { id: id as string } }); break;
            case 'export': await prisma.accountantExport.delete({ where: { id: id as string } }); break;
            default: return res.status(400).json({ error: 'Entidade inválida' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error(`Erro ao deletar ${entity}:`, error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Special endpoint for Settings
router.post('/settings/:companyId', async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const data = req.body;
    try {
        const result = await prisma.accountingSettings.upsert({
            where: { companyId: companyId as string },
            update: data,
            create: { companyId, ...data }
        });
        res.json(result);
    } catch (error) {
        console.error(`Erro ao salvar settings:`, error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

export default router;
