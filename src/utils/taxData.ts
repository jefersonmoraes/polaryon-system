export const STATES = [
    { short: 'AC', name: 'Acre' },
    { short: 'AL', name: 'Alagoas' },
    { short: 'AP', name: 'Amapá' },
    { short: 'AM', name: 'Amazonas' },
    { short: 'BA', name: 'Bahia' },
    { short: 'CE', name: 'Ceará' },
    { short: 'DF', name: 'Distrito Federal' },
    { short: 'ES', name: 'Espírito Santo' },
    { short: 'GO', name: 'Goiás' },
    { short: 'MA', name: 'Maranhão' },
    { short: 'MT', name: 'Mato Grosso' },
    { short: 'MS', name: 'Mato Grosso do Sul' },
    { short: 'MG', name: 'Mininas Gerais' }, // fixing typo later if needed
    { short: 'PA', name: 'Pará' },
    { short: 'PB', name: 'Paraíba' },
    { short: 'PR', name: 'Paraná' },
    { short: 'PE', name: 'Pernambuco' },
    { short: 'PI', name: 'Piauí' },
    { short: 'RJ', name: 'Rio de Janeiro' },
    { short: 'RN', name: 'Rio Grande do Norte' },
    { short: 'RS', name: 'Rio Grande do Sul' },
    { short: 'RO', name: 'Rondônia' },
    { short: 'RR', name: 'Roraima' },
    { short: 'SC', name: 'Santa Catarina' },
    { short: 'SP', name: 'São Paulo' },
    { short: 'SE', name: 'Sergipe' },
    { short: 'TO', name: 'Tocantins' }
];

// Reference ICMS internal aliquots for each state (base 2024)
export const ICMS_INTERNAL_ALIQUOTS: Record<string, number> = {
    AC: 19, AL: 19, AP: 18, AM: 20, BA: 20.5, CE: 20, DF: 22, ES: 17,
    GO: 19, MA: 22, MT: 17, MS: 17, MG: 18, PA: 19, PB: 18, PR: 19.5,
    PE: 20.5, PI: 21, RJ: 22, RN: 20, RS: 17, RO: 19.5, RR: 20, SC: 17,
    SP: 18, SE: 22, TO: 20
};

// Returns the interstate ICMS rate based on Origin and Destination regions
export const getInterstateIcms = (origin: string, destination: string): number => {
    if (origin === destination) return ICMS_INTERNAL_ALIQUOTS[origin];

    const originRegion = getRegion(origin);
    const destRegion = getRegion(destination);

    // States from South/Southeast (Except ES) sending to North, Northeast, Center-West and ES -> 7%
    // The rest -> 12%
    const S_SE_NO_ES = ['PR', 'RS', 'SC', 'MG', 'RJ', 'SP'];
    const N_NE_CO_ES = ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO', 'AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE', 'DF', 'GO', 'MT', 'MS', 'ES'];

    if (S_SE_NO_ES.includes(origin) && N_NE_CO_ES.includes(destination)) {
        return 7;
    }
    return 12;
}

const getRegion = (uf: string) => {
    const regions: Record<string, string[]> = {
        Norte: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
        Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
        CentroOeste: ['DF', 'GO', 'MT', 'MS'],
        Sudeste: ['ES', 'MG', 'RJ', 'SP'],
        Sul: ['PR', 'RS', 'SC']
    };
    for (const [region, states] of Object.entries(regions)) {
        if (states.includes(uf)) return region;
    }
    return 'Sudeste';
}

export const calculateDifal = (originState: string, destinationState: string): number => {
    if (!originState || !destinationState) return 0;
    if (originState === destinationState) return 0; // No DIFAL intrastate

    const internal = ICMS_INTERNAL_ALIQUOTS[destinationState] || 18;
    const interstate = getInterstateIcms(originState, destinationState);

    const difal = internal - interstate;
    return Math.max(0, difal);
};

export const SIMPLES_NACIONAL_RATES = {
    // Approximate effective base rates for first bracket
    'Anexo I': { // Comércio
        irpj: 0.22, csll: 0.21, cofins: 0.86, pis: 0.18, cpp: 1.66, icms: 1.25, iss: 0, ipi: 0
    },
    'Anexo II': { // Indústria
        irpj: 0.25, csll: 0.24, cofins: 0.95, pis: 0.20, cpp: 1.80, icms: 1.06, iss: 0, ipi: 0.50
    },
    'Anexo III': { // Serviços (manutenção, instalação...)
        irpj: 0.24, csll: 0.21, cofins: 0.77, pis: 0.16, cpp: 2.62, icms: 0, iss: 2.00, ipi: 0
    },
    'Anexo IV': { // Serviços (limpeza, vigilância...)
        irpj: 0.72, csll: 0.63, cofins: 0.69, pis: 0.15, cpp: 0, icms: 0, iss: 2.31, ipi: 0
    },
    'Anexo V': { // Serviços (tecnologia, auditoria...)
        irpj: 0.79, csll: 0.69, cofins: 1.99, pis: 0.43, cpp: 4.45, icms: 0, iss: 7.15, ipi: 0
    }
};

export const PRESUMIDO_RATES = {
    // Approximate standard rates (Commerce/Service)
    irpj: 1.20, // 15% on 8% presuntion (commerce) - simplification. Services is 4.8%
    csll: 1.08, // 9% on 12% presuntion (commerce)
    cofins: 3.00,
    pis: 0.65,
    cpp: 20.00, // INSS patronal
    icms: 18.00, // typically internal average
    iss: 5.00,
    ipi: 0
};

export const REAL_RATES = {
    irpj: 15.00,
    csll: 9.00,
    cofins: 7.60, // Non-cumulative
    pis: 1.65, // Non-cumulative
    cpp: 20.00,
    icms: 18.00,
    iss: 5.00,
    ipi: 0
};

// Simplified Heuristic mapping of CNAE to Simples Nacional Annexes
export const inferAnnexFromCnae = (cnaeCode: string): string => {
    if (!cnaeCode) return '';
    // Strip non-numeric characters for safety
    const cleanCnae = cnaeCode.replace(/\D/g, '');
    if (cleanCnae.length < 2) return '';

    const prefix = cleanCnae.substring(0, 2);

    // Section C (Manufacturing) 10-33 -> Anexo II
    const num = parseInt(prefix, 10);
    if (num >= 10 && num <= 33) return 'Anexo II';

    // Section F (Construction) 41-43 -> Anexo IV (Usually IV, sometimes III depending on specific)
    if (num >= 41 && num <= 43) return 'Anexo IV';

    // Section G (Commerce/Trade) 45-47 -> Anexo I
    if (num >= 45 && num <= 47) return 'Anexo I';

    // Section H (Transport) 49-53 -> Anexo III
    if (num >= 49 && num <= 53) return 'Anexo III';

    // Section J (Information and Communication) 58-63 -> Anexo V (Usually V, somtimes III)
    if (num >= 58 && num <= 63) return 'Anexo V';

    // Section M (Professional, Scientific, Technical) 69-75 -> Anexo V or III
    if (num === 69 || num === 70 || num === 71) return 'Anexo V'; // Legal, accounting, architecture, eng
    if (num >= 72 && num <= 75) return 'Anexo III';

    // Section N (Administrative/Support) 77-82 -> Anexo IV (Cleaning/Security) or Anexo III
    if (num === 81) return 'Anexo IV'; // Cleaning/maintenance
    if (num === 80) return 'Anexo IV'; // Security

    // Default to Anexo III for other services
    return 'Anexo III';
};
