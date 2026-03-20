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

// Apply middleware to all routes in this router EXCEPT profile
// Wait, router.use applies to all routes defined AFTER it.
// So let's define the profile route here first.

// PUT /api/users/:id/profile - Update own user profile
router.put('/:id/profile', async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const id = req.params.id as string;
        
        // Prevent updating other users' profiles unless admin
        if (decoded.id !== id && decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Você só pode alterar seu próprio perfil.' });
        }

        const { name, picture } = req.body;
        
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (picture !== undefined) updateData.picture = picture;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            // @ts-ignore
            select: { id: true, email: true, name: true, picture: true, role: true, permissions: true }
        });
        
        res.status(200).json(updatedUser);
    } catch (err) {
        console.error('Error updating profile:', err);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});

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
                // @ts-ignore: permissions will be available after prisma generate on server
                permissions: true,
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

// POST /api/users - Create a new user (Pending / Invited)
router.post('/', async (req: AuthRequest, res: Response) => {
    const { email, name, role } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const newUser = await prisma.user.create({
            data: {
                email,
                name: name || email.split('@')[0],
                role: role || 'pending',
                picture: ''
            }
        });

        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Could not create user' });
    }
});

// PUT /api/users/:id/role - Update user role and permissions
router.put('/:id/role', async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    const { role, permissions } = req.body;

    if (role !== undefined && !['admin', 'default', 'disabled', 'pending', 'contador'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role provided' });
    }

    // Prevent removing your own admin status (self-lockout)
    if (req.user.id === id && role !== 'admin') {
        return res.status(403).json({ error: 'You cannot downgrade your own admin privileges.' });
    }

    try {
        const updateData: any = {};
        if (role) updateData.role = role;
        if (permissions !== undefined) updateData.permissions = permissions;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            // @ts-ignore
            select: { id: true, email: true, name: true, role: true, permissions: true }
        });
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Could not update user role' });
    }
});

// DELETE /api/users/:id - Delete a user
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;

    // Prevent deleting yourself
    if (req.user.id === id) {
        return res.status(403).json({ error: 'Você não pode excluir sua própria conta.' });
    }

    try {
        await prisma.user.update({
            where: { id },
            data: { role: 'disabled' }
        });
        res.status(200).json({ message: 'User disabled successfully (Soft-delete)' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Could not delete user' });
    }
});

export default router;
