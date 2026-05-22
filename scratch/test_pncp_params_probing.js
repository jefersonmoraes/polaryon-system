import axios from 'axios';

async function probe() {
    const baseUrl = 'https://pncp.gov.br/api/search/?pagina=1&tam_pagina=1&status=recebendo_proposta&tipos_documento=edital';
    
    // Baseline
    let baselineTotal = 0;
    try {
        const res = await axios.get(baseUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        baselineTotal = res.data.total;
        console.log('Baseline Total:', baselineTotal);
    } catch (e) {
        console.error('Baseline failed:', e.message);
        return;
    }

    const testParams = [
        { name: 'data_publicacao_inicial/final', params: { data_publicacao_inicial: '20260501', data_publicacao_final: '20260510' } },
        { name: 'dataPublicacaoInicial/Final', params: { dataPublicacaoInicial: '20260501', dataPublicacaoFinal: '20260510' } },
        { name: 'dataInicial/Final', params: { dataInicial: '20260501', dataFinal: '20260510' } },
        { name: 'data_inicial/final', params: { data_inicial: '20260501', data_final: '20260510' } },
        { name: 'data_publicacao', params: { data_publicacao: '20260501' } },
        { name: 'dataPublicacao', params: { dataPublicacao: '20260501' } },
        { name: 'dataInicio/Fim', params: { dataInicio: '20260501', dataFim: '20260510' } },
        { name: 'data_inicio/fim', params: { data_inicio: '20260501', data_fim: '20260510' } },
        { name: 'dataCadastroInicial/Final', params: { dataCadastroInicial: '20260501', dataCadastroFinal: '20260510' } },
        { name: 'data_cadastro_inicial/final', params: { data_cadastro_inicial: '20260501', data_cadastro_final: '20260510' } },
        { name: 'data_encerramento_inicial/final', params: { data_encerramento_inicial: '20260501', data_encerramento_final: '20260510' } },
        { name: 'dataEncerramentoInicial/Final', params: { dataEncerramentoInicial: '20260501', dataEncerramentoFinal: '20260510' } },
        { name: 'data_fim_vigencia_inicial/final', params: { data_fim_vigencia_inicial: '20260501', data_fim_vigencia_final: '20260510' } },
        { name: 'dataFimVigenciaInicial/Final', params: { dataFimVigenciaInicial: '20260501', dataFimVigenciaFinal: '20260510' } },
        { name: 'dataInicial/Final YYYY-MM-DD', params: { dataInicial: '2026-05-01', dataFinal: '2026-05-10' } }
    ];

    for (const test of testParams) {
        try {
            const res = await axios.get(baseUrl, {
                params: test.params,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            console.log(`Test: ${test.name} -> Total: ${res.data.total} (${res.data.total === baselineTotal ? 'IGNORED/NO CHANGE' : 'FILTERED!'})`);
        } catch (e) {
            console.log(`Test: ${test.name} -> FAILED:`, e.message);
        }
    }
}

probe();
