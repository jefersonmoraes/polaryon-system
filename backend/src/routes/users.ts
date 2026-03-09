import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_7281';

// Custom interface for Request with user
interface AuthRequest extends Request {
    user?: any;
}

// Authentication & Authorization Middleware
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;

        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Apply middleware to all routes in this router
router.use(requireAdmin);

// GET /api/users - List all users
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                picture: true,
                role: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/users/:id/role - Update user role
router.put('/:id/role', async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    const { role } = req.body;

    if (!['admin', 'default', 'disabled', 'pending'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role provided' });
    }

    // Prevent removing your own admin status (self-lockout)
    if (req.user.id === id && role !== 'admin') {
        return res.status(403).json({ error: 'You cannot downgrade your own admin privileges.' });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { role },
            select: { id: true, email: true, name: true, role: true }
        });
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Could not update user role' });
    }
});

export default router;
