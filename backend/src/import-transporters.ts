import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const ODS_FILE_PATH = path.join(__dirname, '..', '..', 'importar', 'TRANSPORTADORAS.ods');

function cleanNumber(val: any): string {
    if (val === undefined || val === null) return '';
    return String(val).replace(/\D/g, '');
}

async function fetchCnpjData(cnpj: string, retryCount = 0): Promise<any> {
    const MAX_RETRIES = 5;
    try {
        const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PolaryonSystem/1.0'
            }
        });
        
        if (response.status === 429 || response.status === 403) {
            if (retryCount < MAX_RETRIES) {
                const waitTime = 60000;
                console.warn(`  ⏳ Bloqueio/Limite (${response.status}) detectado. Aguardando ${waitTime/1000}s para tentar novamente (Tentativa ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return await fetchCnpjData(cnpj, retryCount + 1);
            }
            console.error(`  ❌ Falha crítica com status ${response.status} após retentativas para ${cnpj}`);
            return null;
        }

        if (!response.ok) {
            console.error(`  ⚠️ Erro API ${response.status} para CNPJ ${cnpj}`);
            return null;
        }
        
        return await response.json();
    } catch (err: any) {
        console.error(`  ❌ Exceção na busca do CNPJ ${cnpj}: ${err.message}`);
        return null;
    }
}

async function main() {
    console.log(`🚀 Iniciando importação de Transportadoras: ${ODS_FILE_PATH}`);

    if (!fs.existsSync(ODS_FILE_PATH)) {
        console.error("❌ Arquivo não encontrado!");
        return;
    }

    const workbook = XLSX.readFile(ODS_FILE_PATH);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });

    console.log(`📊 Total de ${data.length} linhas na planilha.`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rawCnpj = row.CNPJ || '';
        const cnpj = cleanNumber(rawCnpj);
        
        console.log(`[${i + 1}/${data.length}] Processando Transportadora: ${cnpj}`);

        if (cnpj.length !== 14) {
            console.warn(`  ⚠️ CNPJ Inválido: ${rawCnpj}`);
            errorCount++;
            continue;
        }

        // Check for duplicates
        const exists = await prisma.company.findFirst({ where: { cnpj } });
        if (exists) {
            console.log(`  ⏭️ Já existe no banco. Pulando.`);
            skipCount++;
            continue;
        }

        const apiData = await fetchCnpjData(cnpj);
        if (!apiData) {
            errorCount++;
            continue;
        }

        const contacts: any[] = [];
        const addContact = (label: string, value: any, type: 'Telefone' | 'Email', isWhatsapp: boolean = false) => {
            if (!value) return;
            const cleaned = type === 'Telefone' ? cleanNumber(value) : String(value).trim();
            if (!cleaned) return;
            contacts.push({ id: crypto.randomUUID(), label, type, [type === 'Telefone' ? 'phone' : 'email']: cleaned, isWhatsapp });
        };

        // Adding contacts from spreadsheet - Matching columns from TRANSPORTADORAS.ods
        addContact('Email Planilha 1', row['EMAIL 1'], 'Email');
        addContact('Telefone Planilha 1', row['TELEFONE 1'], 'Telefone', true);
        addContact('Email Planilha 2', row['EMAIL 2'], 'Email');
        addContact('Telefone Planilha 2', row['TELEFONE 2'], 'Telefone', true);
        addContact('Email Planilha 3', row['EMAIL 3'], 'Email');
        addContact('Telefone Planilha 3', row['TELEFONE 3'], 'Telefone', true);

        try {
            await prisma.company.create({
                data: {
                    type: 'Transportadora',
                    cnpj: apiData.cnpj,
                    razao_social: apiData.razao_social,
                    nome_fantasia: apiData.nome_fantasia || apiData.razao_social,
                    descricao_situacao_cadastral: apiData.descricao_situacao_cadastral,
                    cnae_fiscal_descricao: apiData.cnae_fiscal_descricao,
                    cep: cleanNumber(apiData.cep),
                    uf: apiData.uf,
                    municipio: apiData.municipio,
                    bairro: apiData.bairro,
                    logradouro: apiData.logradouro,
                    numero: apiData.numero,
                    complemento: apiData.complemento || '',
                    ddd_telefone_1: cleanNumber(apiData.ddd_telefone_1),
                    ddd_telefone_2: cleanNumber(apiData.ddd_telefone_2),
                    email: apiData.email || '',
                    contacts: contacts as any,
                    comments: '', // No observation column in this ODS
                    customLink: row.link || '',
                    lastCnpjCheck: new Date(),
                    createdAt: new Date()
                }
            });
            console.log(`  ✅ ${apiData.razao_social} importada.`);
            successCount++;
        } catch (err: any) {
            console.error(`  ❌ Erro DB: ${err.message}`);
            errorCount++;
        }

        // Delay 3s to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`\n✅ Sucessos: ${successCount}\n⏭️ Pulados: ${skipCount}\n❌ Erros: ${errorCount}`);
}

main().finally(async () => await prisma.$disconnect());
