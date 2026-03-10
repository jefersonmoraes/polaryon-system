import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
// @ts-ignore
import xss from 'xss-clean';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import calendarRoutes from './routes/calendar';
import kanbanRoutes from './routes/kanban';

// Security and Parsing Middlewares
app.use(helmet({
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
}));

// Rate Limiting (Anti-DDoS / Brute Force)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000, // Limit each IP to 1000 requests per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'ERROR', message: 'Muitas requisições originadas deste IP. Tente novamente mais tarde.' }
});
app.use('/api', apiLimiter);

app.use(cors({
    origin: '*', // To be restricted in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Data sanitization against XSS (Cross Site Scripting)
app.use(xss());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Basic Health Check Route
app.get('/health', async (req: Request, res: Response) => {
    try {
        // Ping DB to test connection
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'OK', message: 'Polaryon Backend is alive and DB is connected!' });
    } catch (error) {
        console.error('Database connection failed:', error);
        res.status(500).json({ status: 'ERROR', message: 'API is running but DB is disconnected.' });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/kanban', kanbanRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Polaryon Backend Kernel running on port ${PORT}`);
});
