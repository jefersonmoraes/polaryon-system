import https from 'https';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { decryptStringToBuffer, decryptString } from '../utils/crypto';

export interface BiddingSessionToken {
    token: string;
    expiresAt: number;
}

export class BiddingAuthService {
    private static tokenCache: Map<string, BiddingSessionToken> = new Map(); // credentialId -> token

    /**
     * Obtém um Agente HTTPS configurado com o certificado mTLS da credencial.
     */
    static async getHttpsAgent(credentialId: string) {
        const credential = await prisma.biddingCredential.findUnique({
            where: { id: credentialId }
        });

        if (!credential) {
            throw new Error(`Credencial ${credentialId} não encontrada no banco.`);
        }

        const pfxBuffer = decryptStringToBuffer(credential.certificateData);
        const passphrase = decryptString(credential.certificatePassword);

        return new https.Agent({
            pfx: pfxBuffer,
            passphrase: passphrase,
            rejectUnauthorized: false // Em homologação Serpro costuma ser necessário
        });
    }

    /**
     * Realiza o login no portal do Governo usando mTLS e retorna o JWT.
     */
    static async login(credentialId: string): Promise<string> {
        // 1. Check Cache
        const cached = this.tokenCache.get(credentialId);
        if (cached && cached.expiresAt > Date.now() + 60000) {
            return cached.token;
        }

        console.log(`[PBE] Iniciando login mTLS para credencial: ${credentialId}`);

        try {
            const agent = await this.getHttpsAgent(credentialId);
            
            // Endpoint Serpro para login via certificado (mTLS)
            const loginUrl = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sala-disputa-fornecedor/api/v1/login-certificado';
            
            const response = await axios.post(loginUrl, {}, {
                httpsAgent: agent,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Polaryon/1.0'
                }
            });

            if (response.data && response.data.token) {
                const token = response.data.token;
                // Cache for 2 hours (Serpro tokens often last 8h-12h, but we play safe)
                this.tokenCache.set(credentialId, {
                    token,
                    expiresAt: Date.now() + 2 * 60 * 60 * 1000
                });
                return token;
            }

            throw new Error('Resposta de login não contém token.');
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`[PBE] Falha no login mTLS: ${errorMsg}`);
            throw new Error(`Falha na autenticação com o Governo: ${errorMsg}`);
        }
    }

    /**
     * Limpa o cache se o token for rejeitado pela API
     */
    static invalidateToken(credentialId: string) {
        this.tokenCache.delete(credentialId);
    }
}
