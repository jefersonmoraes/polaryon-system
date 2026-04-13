import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { PORT } from './config';
import { prisma } from './lib/prisma';


const app = express();


import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import calendarRoutes from './routes/calendar';
import kanbanRoutes from './routes/kanban';
import documentsRoutes from './routes/documents';
import certificatesRoutes from './routes/certificates';
import accountingRoutes from './routes/accounting';
import auditRoutes from './routes/audit';
import sidebarLinksRoutes from './routes/sidebar-links';
import connectionRoutes from './routes/connections';
import transparencyRoutes from './routes/transparency';
import activityRoutes from './routes/activity';
import maintenanceRoutes from './routes/maintenance';
import transferegovRoutes from './routes/transferegov';
import biddingRoutes from './routes/bidding';
import backupsRoutes from './routes/backups';
import { initSocket } from './socket';
import { initComplianceCron } from './services/compliance-service';
import { initBackupCron } from './services/backup-service';
import { PncpRadarService } from './services/pncp-radar-service';

// Initialize Scheduled Tasks
initComplianceCron();
initBackupCron();
PncpRadarService.getInstance().start();

// Security and Parsing Middlewares
app.use(compression());
app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
            "script-src-elem": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
            "script-src-attr": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "img-src": ["'self'", "data:", "https:", "https://lh3.googleusercontent.com"],
            "connect-src": ["'self'", "https:", "wss:", "ws:"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "object-src": ["'none'"],
            "media-src": ["'self'"],
            "frame-src": ["'self'", "https://*.google.com"],
        },
    },
}));

// Rate Limiting (Anti-DDoS / Brute Force)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Limit each IP to 5000 requests per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'ERROR', message: 'Muitas requisições originadas deste IP. Tente novamente mais tarde.' }
});

app.use('/api', apiLimiter);

// Restrict CORS for Production
const allowedOrigins = ['https://polaryon.com.br', 'https://www.polaryon.com.br'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Data Sanitization against XSS
// xss-clean removed due to Express 5 getter issue. 
// Helmet and manual sanitization in controllers are preferred.

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Basic Health Check Route
app.get('/api/health', async (req: Request, res: Response) => {
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
app.use('/api/documents', documentsRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/sidebar-links', sidebarLinksRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/transparency', transparencyRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/transferegov', transferegovRoutes);
app.use('/api/bidding', biddingRoutes);
app.use('/api/backups', backupsRoutes);

// Start Server
const server = app.listen(PORT, () => {
    console.log(`🚀 Polaryon Backend Kernel running on port ${PORT}`);
});

// Initialize WebSockets
initSocket(server);
