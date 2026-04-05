import express, { Request, Response } from 'express';
import { getAuthUrl, saveTokens, fetchGoogleEvents, pushEventToGoogle } from '../services/GoogleCalendarService';

const router = express.Router();
const FRONTEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://polaryon.com.br'
    : (process.env.FRONTEND_URL || 'http://localhost:5173');
router.get('/auth', (req: Request, res: Response) => {
    const url = getAuthUrl();
    res.redirect(url);
});

router.get('/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    if (!code) {
        return res.status(400).send("Código de autorização não recebido do Google.");
    }

    try {
        await saveTokens(code);
        // Após autorizar com sucesso, redireciona de volta para a tela de calendário do frontend
        res.redirect(`${FRONTEND_URL}/calendar?sync=success`);
    } catch (err) {
        console.error("Erro ao salvar tokens do Google:", err);
        res.status(500).send("Falha ao autorizar o Google Calendar. Verifique os logs.");
    }
});

router.get('/events', async (req: Request, res: Response) => {
    try {
        const gEvents = await fetchGoogleEvents();
        const mappedEvents = gEvents.map((item: any) => ({
            id: item.id,
            title: item.summary,
            date: item.start?.date || item.start?.dateTime,
            url: item.htmlLink,
            type: 'google_agenda'
        }));
        res.status(200).json({ success: true, events: mappedEvents });
    } catch (err: any) {
        if (err.message === 'NEEDS_AUTH' || err?.message?.includes('No refresh token')) {
            return res.status(401).json({ error: 'NEEDS_AUTH', authUrl: getAuthUrl() });
        }
        console.error("Fetch Events Error:", err);
        res.status(500).json({ error: 'Falha na busca', details: err.message });
    }
});

router.post('/sync', async (req: Request, res: Response) => {
    try {
        const { eventsToPush } = req.body;

        // Basic one-way push from Polaryon to Google
        if (eventsToPush && Array.isArray(eventsToPush)) {
            console.log(`🚀 Starting sync of ${eventsToPush.length} events to Google...`);
            for (const ev of eventsToPush) {
                const pureDate = ev.date.split('T')[0];
                
                let start, end;

                if (ev.time) {
                    // Combine date and time (format HH:mm)
                    const [hours, minutes] = ev.time.split(':').map(Number);
                    const startD = new Date(pureDate + 'T00:00:00');
                    startD.setHours(hours, minutes, 0);
                    
                    const endD = new Date(startD);
                    endD.setHours(startD.getHours() + 1); // 1 hour duration default

                    start = { dateTime: startD.toISOString() };
                    end = { dateTime: endD.toISOString() };
                } else {
                    // All day event
                    const endD = new Date(pureDate + 'T00:00:00');
                    endD.setDate(endD.getDate() + 1);
                    const endDate = endD.toISOString().split('T')[0];

                    start = { date: pureDate };
                    end = { date: endDate };
                }

                await pushEventToGoogle({
                    summary: ev.title,
                    description: '*[Gerado automaticamente pelo Polaryon]*\n\nEste é um evento criado pelo sistema de gestão. Não o apague para manter a sincronia.',
                    start,
                    end
                }, ev.id);
            }
        }

        // Fetch back Google's own events
        const gEvents = await fetchGoogleEvents();

        const mappedEvents = gEvents.map((item: any) => ({
            id: item.id,
            title: item.summary,
            description: item.description || '',
            location: item.location || '',
            date: item.start?.date || item.start?.dateTime,
            url: item.htmlLink,
            type: 'google_agenda'
        }));

        res.status(200).json({ success: true, events: mappedEvents });
    } catch (err: any) {
        if (err.message === 'NEEDS_AUTH' || err?.message?.includes('No refresh token')) {
            return res.status(401).json({ error: 'NEEDS_AUTH', authUrl: getAuthUrl() });
        }
        console.error("Sync Error:", err);
        res.status(500).json({ error: 'Falha na sincronização', details: err.message });
    }
});

export default router;
