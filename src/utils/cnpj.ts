export interface UnifiedCnpjResult {
    cnpj: string;
    razao_social: string;
    nome_fantasia: string;
    descricao_situacao_cadastral: string;
    data_inicio_atividade: string;
    cnae_fiscal_descricao: string;
    cnae_fiscal?: string | number;
    cnaes_secundarios?: Array<{ codigo: string | number; descricao: string }>;
    cep: string;
    uf: string;
    municipio: string;
    bairro: string;
    logradouro: string;
    numero: string;
    complemento: string;
    ddd_telefone_1: string;
    ddd_telefone_2: string;
    email: string;
    opcao_pelo_simples?: boolean | null;
    opcao_pelo_mei?: boolean | null;
    porte?: string;
    natureza_juridica?: string;
    dataSource?: string;
}

export async function fetchCnpjUnified(cnpjInput: string): Promise<UnifiedCnpjResult> {
    const cleanCnpj = cnpjInput.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
        throw new Error('CNPJ deve conter 14 dígitos');
    }

    const errors: string[] = [];

    // 1. MinhaReceita.org (Sem restrições CORS, resposta ultra-rápida)
    try {
        const response = await fetch(`https://minhareceita.org/${cleanCnpj}`);
        if (response.ok) {
            const data = await response.json();
            if (data.cnpj || data.razao_social) {
                return {
                    cnpj: data.cnpj || cleanCnpj,
                    razao_social: data.razao_social || '',
                    nome_fantasia: data.nome_fantasia || '',
                    descricao_situacao_cadastral: (data.descricao_situacao_cadastral || 'ATIVA').toUpperCase(),
                    data_inicio_atividade: data.data_inicio_atividade || '',
                    cnae_fiscal_descricao: data.cnae_fiscal_descricao || '',
                    cnae_fiscal: data.cnae_fiscal || '',
                    cnaes_secundarios: (data.cnaes_secundarios || []).map((c: any) => ({
                        codigo: c.codigo?.toString() || '',
                        descricao: c.descricao || ''
                    })),
                    cep: data.cep || '',
                    uf: data.uf || '',
                    municipio: data.municipio || '',
                    bairro: data.bairro || '',
                    logradouro: data.logradouro || '',
                    numero: data.numero || '',
                    complemento: data.complemento || '',
                    ddd_telefone_1: data.ddd_telefone_1 || '',
                    ddd_telefone_2: data.ddd_telefone_2 || '',
                    email: data.email || data.correio_eletronico || '',
                    opcao_pelo_simples: data.opcao_pelo_simples ?? null,
                    opcao_pelo_mei: data.opcao_pelo_mei ?? null,
                    porte: data.porte || '',
                    natureza_juridica: data.natureza_juridica || '',
                    dataSource: 'Minha Receita (Oficial)'
                };
            }
        }
    } catch (err: any) {
        console.warn('MinhaReceita falhou, tentando próxima API...', err?.message || err);
        errors.push(`MinhaReceita: ${err?.message || err}`);
    }

    // 2. BrasilAPI
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (response.ok) {
            const data = await response.json();
            return {
                cnpj: data.cnpj || cleanCnpj,
                razao_social: data.razao_social || '',
                nome_fantasia: data.nome_fantasia || '',
                descricao_situacao_cadastral: (data.descricao_situacao_cadastral || 'ATIVA').toUpperCase(),
                data_inicio_atividade: data.data_inicio_atividade || '',
                cnae_fiscal_descricao: data.cnae_fiscal_descricao || '',
                cnae_fiscal: data.cnae_fiscal || '',
                cnaes_secundarios: (data.cnaes_secundarios || []).map((c: any) => ({
                    codigo: c.codigo?.toString() || '',
                    descricao: c.descricao || ''
                })),
                cep: data.cep || '',
                uf: data.uf || '',
                municipio: data.municipio || '',
                bairro: data.bairro || '',
                logradouro: data.logradouro || '',
                numero: data.numero || '',
                complemento: data.complemento || '',
                ddd_telefone_1: data.ddd_telefone_1 || '',
                ddd_telefone_2: data.ddd_telefone_2 || '',
                email: data.email || data.correio_eletronico || data.correioEletronico || '',
                opcao_pelo_simples: data.opcao_pelo_simples ?? null,
                opcao_pelo_mei: data.opcao_pelo_mei ?? null,
                porte: data.porte || '',
                natureza_juridica: data.natureza_juridica || '',
                dataSource: 'Brasil API'
            };
        }
    } catch (err: any) {
        console.warn('BrasilAPI falhou, tentando fallback CNPJ.ws...', err?.message || err);
        errors.push(`BrasilAPI: ${err?.message || err}`);
    }

    // 3. CNPJ.ws
    try {
        const response = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`);
        if (response.ok) {
            const data = await response.json();
            const est = data.estabelecimento || {};
            return {
                cnpj: cleanCnpj,
                razao_social: data.razao_social || '',
                nome_fantasia: est.nome_fantasia || '',
                descricao_situacao_cadastral: (est.situacao_cadastral || 'ATIVA').toUpperCase(),
                data_inicio_atividade: est.data_inicio_atividade || '',
                cnae_fiscal_descricao: est.atividade_principal?.descricao || '',
                cnae_fiscal: est.atividade_principal?.id || '',
                cnaes_secundarios: (est.atividades_secundarias || []).map((c: any) => ({
                    codigo: c.id?.toString() || '',
                    descricao: c.descricao || ''
                })),
                cep: est.cep || '',
                uf: est.estado?.sigla || '',
                municipio: est.cidade?.nome || '',
                bairro: est.bairro || '',
                logradouro: est.logradouro || '',
                numero: est.numero || '',
                complemento: est.complemento || '',
                ddd_telefone_1: est.telefone1 || '',
                ddd_telefone_2: est.telefone2 || '',
                email: est.email || '',
                opcao_pelo_simples: data.simples?.simples === 'Sim',
                opcao_pelo_mei: data.simples?.mei === 'Sim',
                porte: data.porte?.descricao || '',
                natureza_juridica: data.natureza_juridica?.descricao || '',
                dataSource: 'CNPJ.ws'
            };
        }
    } catch (err: any) {
        console.warn('CNPJ.ws falhou:', err?.message || err);
        errors.push(`CNPJ.ws: ${err?.message || err}`);
    }

    throw new Error(`Falha ao consultar CNPJ nas APIs públicas: ${errors.join(' | ')}`);
}
