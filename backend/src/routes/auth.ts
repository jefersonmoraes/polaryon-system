import express, { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Use an environment variable or a fallback for dev
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "MOCK_CLIENT_ID_REQUIRED";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_7281';

router.post('/google', async (req: Request, res: Response) => {
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ error: 'Token (credential) missing from request body' });
    }

    try {
        // 1. Verify the Google Token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return res.status(401).json({ error: 'Invalid Google Token Payload' });
        }

        const { email, name, picture, sub: googleId } = payload;

        // 2. Find or Create the User in our Database (Polaryon DB -> Hetzner)
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            const isAdmin = ['jjcorporation2018@gmail.com', 'jefersonvilela72@gmail.com'].includes(email.toLowerCase());
            // Auto-register first-time users as 'pending' unless they are admins
            user = await prisma.user.create({
                data: {
                    email,
                    name: name || 'Usuário',
                    picture: picture || '',
                    googleId,
                    role: isAdmin ? 'admin' : 'pending'
                }
            });
        }

        // Checking if user was banned/disabled or is pending
        if (user.role === 'disabled') {
            return res.status(403).json({ error: 'Sua conta foi desativada pelo administrador.' });
        }
        if (user.role === 'pending') {
            return res.status(403).json({ error: 'Conta registrada! Aguarde a aprovação de um Administrador.' });
        }

        // 3. Issue our own internal JWT Session Token
        const sessionToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                picture: user.picture
            },
            JWT_SECRET,
            { expiresIn: '7d' } // 7 Dias logado
        );

        res.status(200).json({
            token: sessionToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                picture: user.picture,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Authentication failed. Token may be expired or invalid.' });
    }
});

export default router;
