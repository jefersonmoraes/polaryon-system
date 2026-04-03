import express, { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

import { GOOGLE_CLIENT_ID, JWT_SECRET } from '../config';

const router = express.Router();
const prisma = new PrismaClient();

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post('/google', async (req: Request, res: Response) => {
    const { credential, accessToken } = req.body;

    if (!credential && !accessToken) {
        return res.status(400).json({ error: 'Token missing from request body' });
    }

    try {
        let payload: any;

        if (accessToken) {
            // Force fetch HD Profile from Google UserInfo API using Access Token
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                 return res.status(401).json({ error: 'Invalid Google Access Token' });
            }
            payload = await response.json();
        } else {
            // 1. Verify the Google Token (Legacy fallback)
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        }

        if (!payload || !payload.email) {
            return res.status(401).json({ error: 'Invalid Google Token Payload' });
        }
        
        console.log("GOOGLE PAYLOAD RECEIVED:", JSON.stringify(payload, null, 2));

        const { email, name, picture, sub: googleId } = payload;

        // 2. Find or Create the User in our Database
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            const isAdmin = [
                'jjcorporation2018@gmail.com'
            ].includes(email.toLowerCase());
            if (isAdmin) {
                user = await prisma.user.create({
                    data: {
                        email,
                        name: name || 'Usuário',
                        picture: picture || '',
                        googleId,
                        role: 'admin'
                    }
                });
            } else {
                 return res.status(403).json({ error: 'Você não possui cadastro e permissão para acessar o sistema. Solicite acesso ao administrador.' });
            }
        }

        // Checking if user was banned/disabled or is pending
        if (user.role === 'disabled') {
            return res.status(403).json({ error: 'Sua conta foi desativada pelo administrador.' });
        }
        if (user.role === 'pending' || user.role === 'invited') {
            // Auto-activate pending user upon first Google login (only if they were registered by admin)
            user = await prisma.user.update({
                where: { email },
                data: { role: 'user', name: name || user.name, picture: picture || user.picture, googleId }
            });
        } else {
            // STRICT GOOGLE SYNC: Always overwrite the local DB name and picture with Google's payload
            // This guarantees no massive manual base64 images remain and data is fresh
            user = await prisma.user.update({
                where: { email },
                data: {
                    name: name || user.name,
                    picture: picture || user.picture,
                    googleId
                }
            });
        }

        // 3. Issue our own internal JWT Session Token
        // SECURITY/STABILITY: NEVER include 'picture' (which can be a 10KB+ Base64 string) in the JWT!
        // Nginx has a default 8KB header limit. If the JWT exceeds 8KB, Nginx will return 400 Bad Request
        // and instantly crash all user syncing.
        const sessionToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name
            },
            JWT_SECRET,
            { expiresIn: '90d' } // 90 Dias logado (Fluidez Máxima)
        );

        res.status(200).json({
            token: sessionToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                picture: user.picture,
                role: user.role,
                // @ts-ignore
                permissions: user.permissions
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Authentication failed. Token may be expired or invalid.' });
    }
});

// GET /api/auth/verify - Quick check if session is valid
router.get('/verify', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Session invalid' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        res.status(200).json({ 
            valid: true, 
            user: { 
                id: decoded.id, 
                email: decoded.email, 
                role: decoded.role,
                name: decoded.name
            } 
        });
    } catch (err) {
        res.status(401).json({ error: 'Session expired' });
    }
});

export default router;
