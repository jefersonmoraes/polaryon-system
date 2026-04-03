import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export interface AuthRequest extends Request {
    user?: any;
}

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;

        // Use case-insensitive check for extra safety
        const userRole = (decoded.role || '').toLowerCase();
        if (userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }

        next();
    } catch (err) {
        console.error('JWT Verification Error:', err);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
