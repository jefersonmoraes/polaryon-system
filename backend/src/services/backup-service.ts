import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { prisma } from '../lib/prisma';

// Ensure backups directory exists
const backupDir = path.join(__dirname, '../../backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

export const runBackup = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const date = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `backup-${date}.sql`;
        const backupFilePath = path.join(backupDir, backupFileName);

        const databaseUrlStr = process.env.DATABASE_URL;

        if (!databaseUrlStr) {
            console.error('[Backup Service] DATABASE_URL is not set.');
            return reject(new Error('DATABASE_URL is not set.'));
        }

        // Remover os parâmetros de query string (ex: connection_limit, pool_timeout) que o pg_dump não reconhece
        let cleanDatabaseUrl = databaseUrlStr;
        try {
            const parsedUrl = new URL(databaseUrlStr);
            parsedUrl.search = ''; // Remove todos os parâmetros após o '?'
            cleanDatabaseUrl = parsedUrl.toString();
        } catch (err) {
            console.warn('[Backup Service] Aviso: Falha ao fazer parser da DATABASE_URL. Realizando fallback.');
        }

        // Executar pg_dump
        const command = `pg_dump "${cleanDatabaseUrl}" > "${backupFilePath}"`;
        console.log(`[Backup Service] Iniciando backup para ${backupFileName}...`);

        exec(command, async (error, stdout, stderr) => {
            if (error) {
                console.error(`[Backup Service] Falha ao executar pg_dump: ${error.message}`);
                // Registrar notificação de falha
                await createBackupNotification(`Falha no backup do banco de dados: ${error.message}`);
                return reject(error);
            }

            console.log(`[Backup Service] Backup concluído com sucesso: ${backupFileName}`);
            
            // Limpar backups antigos (manter apenas os dois últimos)
            try {
                cleanOldBackups();
            } catch (cleanupError: any) {
                console.error(`[Backup Service] Erro ao limpar backups antigos: ${cleanupError.message}`);
            }

            resolve();
        });
    });
};

const cleanOldBackups = () => {
    const files = fs.readdirSync(backupDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql'));

    // Ordenar do mais novo para o mais antigo baseado na data de alteração
    const sortedFiles = sqlFiles.sort((a, b) => {
        const aTime = fs.statSync(path.join(backupDir, a)).mtime.getTime();
        const bTime = fs.statSync(path.join(backupDir, b)).mtime.getTime();
        return bTime - aTime;
    });

    // Se tivermos mais de 2 arquivos, apagamos os antigos
    if (sortedFiles.length > 2) {
        const filesToDelete = sortedFiles.slice(2);
        for (const file of filesToDelete) {
            const filePath = path.join(backupDir, file);
            fs.unlinkSync(filePath);
            console.log(`[Backup Service] Backup antigo removido: ${file}`);
        }
    }
};

const createBackupNotification = async (message: string) => {
    try {
        await prisma.notification.create({
            data: {
                title: 'Alerta de Backup',
                message,
                type: 'error',
                link: '/admin/backups'
            }
        });
    } catch (e) {
        console.error('[Backup Service] Falha ao criar notificação:', e);
    }
};

export const initBackupCron = () => {
    // Agenda para rodar todo dia às 03:00 (timezone de São Paulo assumido como default da máquina, senão forçar)
    // 0 3 * * * corresponde às 03:00 da manhã.
    cron.schedule('0 3 * * *', async () => {
        console.log('[Backup Service] Rotina diária de backup iniciada (03:00)');
        try {
            await runBackup();
        } catch (error) {
            console.error('[Backup Service] Erro capturado na rotina de cron:', error);
        }
    }, {
        timezone: "America/Sao_Paulo"
    });
    console.log('[Backup Service] Cron Job agendado para 03:00 (America/Sao_Paulo).');
};
