import axios from 'axios';

// Focus NFe API Documentation: https://focusnfe.com.br/doc/
// This service simulates or connects to the Focus NFe API for emitting legally valid NF-e / NFS-e.

export type NfeEnvironment = 'homologacao' | 'producao';

interface EmitNfeParams {
    environment?: NfeEnvironment;
    apiToken?: string;
    invoiceData: any; // Ideally mapped to Focus NFe payload structure
    type: 's' | 'e'; // 's' para NFS-e (Serviço), 'e' para NF-e (Produto)
}

export const emitirNfe = async ({ environment = 'homologacao', apiToken, invoiceData, type }: EmitNfeParams) => {
    // If no real token is provided, we simulate the Focus NFe response
    // to maintain the application functional without blocking the user.
    if (!apiToken || apiToken === '') {
        console.warn('Simulating NF emission. Provide a real Focus NFe token for production.');

        // Simular latência de rede da SEFAZ
        await new Promise(resolve => setTimeout(resolve, 2000));

        return {
            success: true,
            status: 'autorizado',
            numero: `NF-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
            // O caminho do PDF seria retornado pela Focus (url)
            caminho_danfe: 'simulated_danfe.pdf',
            caminho_xml: 'simulated_xml.xml',
            mensagem: 'Nota Autorizada com Sucesso (Simulação)',
            data: new Date().toISOString()
        };
    }

    try {
        const baseURL = environment === 'producao'
            ? 'https://api.focusnfe.com.br'
            : 'https://homologacao.focusnfe.com.br';

        // Endpoint varia entre NFe (Produto) de NFS-e (Serviço)
        const endpoint = type === 's' ? '/v2/nfse' : '/v2/nfe';

        const response = await axios.post(`${baseURL}${endpoint}`, invoiceData, {
            headers: {
                'Authorization': `Basic ${btoa(apiToken + ':')}`,
                'Content-Type': 'application/json'
            }
        });

        // O response.data da Focus contém o status d autorização (processando, autorizado, erro)
        if (response.status === 200 || response.status === 201) {
            return {
                success: true,
                status: response.data.status,
                numero: response.data.numero || `NF-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
                caminho_danfe: response.data.caminho_danfe || response.data.url,
                caminho_xml: response.data.caminho_xml_nota_fiscal,
                mensagem: response.data.mensagem || 'Nota emitida com sucesso.',
                data: new Date().toISOString(),
            };
        } else {
            throw new Error(response.data?.mensagem || 'Erro desconhecido na emissão da nota.');
        }

    } catch (error: any) {
        console.error('Focus NFe Integration Error:', error);
        return {
            success: false,
            mensagem: error.response?.data?.mensagem || error.message || 'Erro de comunicação com a SEFAZ.',
        };
    }
};
