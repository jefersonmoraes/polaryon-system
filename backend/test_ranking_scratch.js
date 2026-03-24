const axios = require('axios');

const PNCP_BASE_URL = 'https://pncp.gov.br/api/pncp/v1';
const PNCP_SEARCH_URL = 'https://pncp.gov.br/api/search/';

const extractBrand = (text) => {
    if (!text) return 'N/A';
    const brands = [
        'DELL', 'HP', 'LENOVO', 'APPLE', 'SAMSUNG', 'LG', 'ASUS', 'ACER', 'POSITIVO', 'MULTILASER',
        'CANNON', 'EPSON', 'BROTHER', 'LOGITECH', 'MICROSOFT', 'INTEL', 'AMD', 'NVIDIA', 'LOGITECH',
        'JBL', 'SONY', 'PHILIPS', 'AOC', 'VIEWSONIC', 'BENQ', 'MOTOROLA', 'XIAOMI', 'HUAWEI',
        'TCL', 'HISENSE', 'PANASONIC', 'BRASTEMP', 'CONSUL', 'ELECTROLUX', 'MOLIN', 'FABER-CASTELL',
        'PILOT', 'BIC', 'STABILO', 'PARKER', 'WATERMAN', 'CROSS', 'SHEAFFER', 'LAMY', 'PELIKAN'
    ];
    for (const brand of brands) {
        const regex = new RegExp(`\\b${brand}\\b`, 'i');
        if (regex.test(text)) return brand;
    }
    return 'N/A';
};

async function testRanking(termo) {
    console.log(`Testando ranking para: ${termo}`);
    const keywords = termo.toLowerCase().split(' ').filter(k => k.length > 2);
    const brandCounts = {};
    const fetchDepth = 1;
    const allProcesses = [];
    
    try {
        console.log('Buscando processos...');
        let searchUrl = `${PNCP_SEARCH_URL}/?q=${termo}&tipos_documento=edital%7Cata%7Ccontrato&ordenacao=-data&pagina=1&tam_pagina=50&situacao=concluido`;
        const searchRes = await axios.get(searchUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000 
        });
        
        if (searchRes.data && searchRes.data.items) {
            allProcesses.push(...searchRes.data.items);
            console.log(`Encontrados ${allProcesses.length} processos.`);
        }

        const batchSize = 10;
        for (let i = 0; i < allProcesses.length; i += batchSize) {
            const batch = allProcesses.slice(i, i + batchSize);
            console.log(`Processando lote ${i/batchSize + 1}...`);
            await Promise.all(batch.map(async (proc) => {
                try {
                    const itemsRes = await axios.get(`${PNCP_BASE_URL}/orgaos/${proc.orgao_cnpj}/compras/${proc.ano}/${proc.numero_sequencial}/itens`, { timeout: 4000 });
                    const items = itemsRes.data || [];
                    for (const item of items) {
                        const desc = (item.descricao || item.description || '').toLowerCase();
                        const matchCount = keywords.filter(k => desc.includes(k)).length;
                        const isMatch = keywords.length === 0 || (matchCount >= Math.ceil(keywords.length / 2)) || (keywords.length > 0 && desc.includes(keywords[0]));
                        
                        if (isMatch) {
                            let brand = extractBrand(item.descricao || item.description || '');
                            if (brand && brand !== 'N/A') {
                                if (!brandCounts[brand]) brandCounts[brand] = { value: 0 };
                                brandCounts[brand].value++;
                            }
                        }
                    }
                } catch (err) {
                    console.log(`Erro ao buscar itens de ${proc.numero_sequencial}: ${err.message}`);
                }
            }));
        }
        
        console.log('Ranking Final:', brandCounts);
    } catch (err) {
        console.error('Erro na busca principal:', err.message);
    }
}

testRanking('Cadeira de rodas');
