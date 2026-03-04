import React, { useEffect, useState } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { Building2, Save, Calculator, MapPin, Percent, Search } from 'lucide-react';
import { STATES, calculateDifal, SIMPLES_NACIONAL_RATES, PRESUMIDO_RATES, REAL_RATES, inferAnnexFromCnae } from '@/utils/taxData';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';

const initialFormData = {
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    state: '',
    porte: '',
    taxRegime: '' as any,
    simplesAnnexes: [] as string[],
    pis: 0, cofins: 0, csll: 0, irpj: 0, cpp: 0, iss: 0, icms: 0, ipi: 0,
    naturezaJuridica: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', telefone: '', email: '',
    cnaes: [] as { code: string; description: string }[],
    annexRates: {} as Record<string, { pis: number; cofins: number; csll: number; irpj: number; cpp: number; iss: number; icms: number; ipi: number; }>,
    lastSynced: '',
    dataSource: '',
};

export default function CompanyProfilePage() {
    const { mainCompanies, addMainCompany, updateMainCompany, deleteMainCompany, setDefaultMainCompany, isDark } = useKanbanStore();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const companyId = searchParams.get('id');

    const [isFetching, setIsFetching] = useState(false);

    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        if (companyId) {
            const company = mainCompanies.find(c => c.id === companyId);
            if (company) {
                setFormData({
                    ...initialFormData,
                    ...company,
                    simplesAnnexes: company.simplesAnnexes || [],
                    cnaes: company.cnaes || [],
                    annexRates: company.annexRates || {}
                });
            } else {
                navigate('/company', { replace: true });
            }
        } else {
            setFormData(initialFormData);
        }
    }, [companyId, mainCompanies, navigate]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRegimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const regime = e.target.value;
        setFormData(prev => {
            let newData = { ...prev, taxRegime: regime, simplesAnnexes: [] };
            if (regime === 'Lucro Presumido') {
                newData = { ...newData, ...PRESUMIDO_RATES };
            } else if (regime === 'Lucro Real') {
                newData = { ...newData, ...REAL_RATES };
            } else if (regime === '') {
                newData = { ...newData, pis: 0, cofins: 0, csll: 0, irpj: 0, cpp: 0, iss: 0, icms: 0, ipi: 0 };
            }
            return newData;
        });
    };

    const handleAnnexToggle = (annex: string) => {
        setFormData(prev => {
            const isSelected = prev.simplesAnnexes.includes(annex);
            const newAnnexes = isSelected
                ? prev.simplesAnnexes.filter(a => a !== annex)
                : [...prev.simplesAnnexes, annex];

            let updatedRates = { pis: 0, cofins: 0, csll: 0, irpj: 0, cpp: 0, iss: 0, icms: 0, ipi: 0 };

            // Build the new annexRates object
            const newAnnexRates: Record<string, any> = { ...prev.annexRates };

            if (isSelected) {
                delete newAnnexRates[annex];
            } else {
                newAnnexRates[annex] = { ...SIMPLES_NACIONAL_RATES[annex as keyof typeof SIMPLES_NACIONAL_RATES] };
            }

            // Set base rates to the first selected annex for simplicity/compatibility 
            // but the UI will render each annex from `newAnnexRates` independently.
            if (newAnnexes.length > 0) {
                const primaryAnnex = newAnnexes[0] as keyof typeof SIMPLES_NACIONAL_RATES;
                updatedRates = { ...SIMPLES_NACIONAL_RATES[primaryAnnex] };
            }

            return {
                ...prev,
                simplesAnnexes: newAnnexes,
                annexRates: newAnnexRates,
                ...updatedRates
            };
        });
    };

    const handleAnnexRateChange = (annex: string, tax: string, value: number) => {
        setFormData(prev => {
            if (!prev.annexRates) return prev;
            return {
                ...prev,
                annexRates: {
                    ...prev.annexRates,
                    [annex]: {
                        ...prev.annexRates[annex],
                        [tax]: value
                    }
                }
            };
        });
    };

    const fetchCnpjData = async () => {
        const cleanCnpj = formData.cnpj.replace(/\D/g, '');
        if (cleanCnpj.length !== 14) {
            toast.error('CNPJ inválido (deve conter 14 dígitos)');
            return;
        }

        setIsFetching(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (!response.ok) throw new Error('Falha ao buscar CNPJ');
            const data = await response.json();

            // Format CNAEs
            const cnaes = [];
            if (data.cnae_fiscal) cnaes.push({ code: data.cnae_fiscal.toString(), description: data.cnae_fiscal_descricao });
            if (data.cnaes_secundarios) {
                data.cnaes_secundarios.forEach((cnae: any) => {
                    cnaes.push({ code: cnae.codigo.toString(), description: cnae.descricao });
                });
            }

            // Automate Porte and Regime based on API's direct answers
            let porte = formData.porte;
            let newRegime = formData.taxRegime;

            if (data.opcao_pelo_mei) {
                porte = 'MEI';
                newRegime = 'Simples Nacional';
            } else if (data.opcao_pelo_simples) {
                newRegime = 'Simples Nacional';
                if (data.porte && data.porte.includes('MICRO EMPRESA')) porte = 'ME';
                else if (data.porte && data.porte.includes('EMPRESA DE PEQUENO PORTE')) porte = 'EPP';
                else porte = 'Médio';
            } else {
                // If not Simples, safely assume Presumido for standard cases or let user fill if needed, 
                // but the prompt asked for automatic, so we'll guess Presumido.
                newRegime = 'Lucro Presumido';
                if (data.porte && data.porte.includes('DEMAIS')) porte = 'Médio';
            }

            // Estimate Regimes/Annexes based on primary CNAE
            let newAnnexes: string[] = [];

            if (cnaes.length > 0 && newRegime === 'Simples Nacional') {
                const inferredAnnex = inferAnnexFromCnae(cnaes[0].code);
                if (inferredAnnex) {
                    newAnnexes.push(inferredAnnex);
                    toast.success(`Regime e Anexo (${inferredAnnex}) configurados automaticamente via Receita Federal.`);
                }
            }

            setFormData(prev => {
                let newData = {
                    ...prev,
                    razaoSocial: data.razao_social || prev.razaoSocial,
                    nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
                    state: data.uf || prev.state,
                    naturezaJuridica: data.natureza_juridica || prev.naturezaJuridica,
                    cep: data.cep || prev.cep,
                    logradouro: data.logradouro || prev.logradouro,
                    numero: data.numero || prev.numero,
                    complemento: data.complemento || prev.complemento,
                    bairro: data.bairro || prev.bairro,
                    municipio: data.municipio || prev.municipio,
                    telefone: data.ddd_telefone_1 || prev.telefone,
                    email: data.email || prev.email,
                    cnaes: cnaes,
                    porte: porte,
                    taxRegime: newRegime,
                    simplesAnnexes: newAnnexes,
                    lastSynced: new Date().toISOString(),
                    dataSource: 'Brasil API',
                };

                // If we added a new annex automatically, let's trigger the annex change logic
                if (newRegime === 'Simples Nacional' && newAnnexes.length > 0) {
                    const primaryAnnex = newAnnexes[0] as keyof typeof SIMPLES_NACIONAL_RATES;
                    newData = { ...newData, ...SIMPLES_NACIONAL_RATES[primaryAnnex] } as any;
                    newData.annexRates = {
                        [primaryAnnex]: { ...SIMPLES_NACIONAL_RATES[primaryAnnex] }
                    };
                } else if (newRegime === 'Lucro Presumido') {
                    newData = { ...newData, ...PRESUMIDO_RATES, simplesAnnexes: [], annexRates: {} } as any;
                } else if (newRegime === 'Lucro Real') {
                    newData = { ...newData, ...REAL_RATES, simplesAnnexes: [], annexRates: {} } as any;
                }

                return newData;
            });

            toast.success('Dados da empresa atualizados com sucesso!');
        } catch (error) {
            console.error("Error fetching CNPJ:", error);
            toast.error('Erro ao buscar dados do CNPJ na Brasil API.');
        } finally {
            setIsFetching(false);
        }
    };

    const handleSave = () => {
        if (!formData.razaoSocial || !formData.cnpj) {
            toast.error("Razão Social e CNPJ são obrigatórios.");
            return;
        }

        if (companyId) {
            updateMainCompany(companyId, formData);
            toast.success('Administradora atualizada com sucesso!');
        } else {
            const newId = addMainCompany(formData);
            toast.success('Administradora criada com sucesso!');
            navigate(`/company?id=${newId}`);
        }
    };

    const handleDelete = () => {
        if (companyId) {
            if (window.confirm("Tem certeza que deseja remover esta administradora?")) {
                deleteMainCompany(companyId);
                toast.success('Administradora removida com sucesso!');
                navigate('/company');
            }
        }
    };

    const handleSetDefault = () => {
        if (companyId) {
            setDefaultMainCompany(companyId);
            toast.success('Administradora definida como Padrão!');
        }
    };

    const currentCompany = mainCompanies.find(c => c.id === companyId);
    const isDefault = currentCompany?.isDefault;

    return (
        <div className={`flex-1 h-full overflow-y-auto ${isDark ? 'bg-[#1e1e2d] text-white' : 'bg-gray-50 text-gray-900'} custom-scrollbar`}>
            <header className="p-6 pb-4 border-b border-white/10 flex justify-between items-end bg-black/20">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        {companyId ? 'Editar Administradora' : 'Nova Administradora'}
                        {isDefault && (
                            <span className="ml-2 text-[10px] uppercase font-bold bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded border border-yellow-500/20 shadow-sm flex items-center gap-1">Padrão</span>
                        )}
                    </h1>
                    <p className="text-sm text-foreground/60 mt-1">
                        Gerencie as informações fiscais desta empresa administradora.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {companyId && !isDefault && (
                        <button
                            onClick={handleSetDefault}
                            className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 text-yellow-600 rounded border border-yellow-500/20 font-medium hover:bg-yellow-500/20 transition-colors shadow-sm text-sm"
                            title="Tornar esta a empresa principal utilizada nos cálculos"
                        >
                            Definir como Padrão
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded font-medium hover:bg-primary/90 transition-colors shadow-lg"
                    >
                        <Save className="h-4 w-4" />
                        {companyId ? 'Salvar Alterações' : 'Criar Administradora'}
                    </button>
                </div>
            </header>

            <div className="p-6 max-w-5xl space-y-8">
                {/* Status Section */}
                {formData.lastSynced && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 text-primary rounded-md">
                                <Search className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Fonte de Dados</p>
                                <p className="text-sm font-semibold text-foreground">{formData.dataSource || 'Brasil API'}</p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Última Atualização</p>
                            <p className="text-sm font-medium text-foreground">
                                {new Date(formData.lastSynced).toLocaleString('pt-BR')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Dados Básicos */}
                <section className="bg-card border border-border rounded-lg p-5 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Dados Básicos
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">Razão Social</label>
                            <input
                                type="text" name="razaoSocial" value={formData.razaoSocial} onChange={handleInputChange}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                                placeholder="Ex: Polaryon Tecnologia Ltda"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">Nome Fantasia</label>
                            <input
                                type="text" name="nomeFantasia" value={formData.nomeFantasia} onChange={handleInputChange}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                                placeholder="Ex: Polaryon"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">CNPJ</label>
                            <div className="flex gap-2">
                                <input
                                    type="text" name="cnpj" value={formData.cnpj} onChange={handleInputChange}
                                    className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                                    placeholder="00.000.000/0000-00"
                                />
                                <button
                                    onClick={fetchCnpjData}
                                    disabled={isFetching || !formData.cnpj}
                                    className="px-3 py-2 bg-secondary text-secondary-foreground rounded border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    title="Buscar dados na Receita (Brasil API)"
                                >
                                    <Search className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">Estado (Origem)</label>
                            <select
                                name="state" value={formData.state} onChange={handleInputChange}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors disabled:opacity-70 disabled:bg-muted"
                                disabled={!!formData.cnpj && formData.state !== ''}
                            >
                                <option value="">Selecione o Estado...</option>
                                {STATES.map(s => <option key={s.short} value={s.short}>{s.name} ({s.short})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">Porte da Empresa</label>
                            <select
                                name="porte" value={formData.porte} onChange={handleInputChange}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors disabled:opacity-70 disabled:bg-muted"
                                disabled={true}
                                title="Preenchido automaticamente via Receita Federal"
                            >
                                <option value="">Pendente Consulta...</option>
                                <option value="MEI">MEI (Microempreendedor Individual)</option>
                                <option value="ME">ME (Microempresa)</option>
                                <option value="EPP">EPP (Empresa de Pequeno Porte)</option>
                                <option value="Médio">Médio/Outros</option>
                                <option value="Grande">Grande Porte</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80 pointer-events-none">
                        <div>
                            <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">Natureza Jurídica</label>
                            <input
                                type="text" name="naturezaJuridica" value={formData.naturezaJuridica} onChange={handleInputChange}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">Telefone</label>
                            <input
                                type="text" name="telefone" value={formData.telefone} onChange={handleInputChange}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">Email</label>
                            <input
                                type="text" name="email" value={formData.email} onChange={handleInputChange}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-3 rounded border border-border/50">
                            <div>
                                <label className="block text-[10px] font-bold text-foreground/50 mb-1 uppercase">CEP</label>
                                <input type="text" name="cep" value={formData.cep} onChange={handleInputChange} className="w-full bg-background border border-border rounded px-2 py-1 text-xs outline-none" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-foreground/50 mb-1 uppercase">Logradouro</label>
                                <div className="flex gap-2">
                                    <input type="text" name="logradouro" value={formData.logradouro} onChange={handleInputChange} className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs outline-none" />
                                    <input type="text" name="numero" value={formData.numero} onChange={handleInputChange} placeholder="Nº" className="w-16 bg-background border border-border rounded px-2 py-1 text-xs outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-foreground/50 mb-1 uppercase">Complemento</label>
                                <input type="text" name="complemento" value={formData.complemento} onChange={handleInputChange} className="w-full bg-background border border-border rounded px-2 py-1 text-xs outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-foreground/50 mb-1 uppercase">Bairro</label>
                                <input type="text" name="bairro" value={formData.bairro} onChange={handleInputChange} className="w-full bg-background border border-border rounded px-2 py-1 text-xs outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-foreground/50 mb-1 uppercase">Município</label>
                                <input type="text" name="municipio" value={formData.municipio} onChange={handleInputChange} className="w-full bg-background border border-border rounded px-2 py-1 text-xs outline-none" />
                            </div>
                        </div>

                        {formData.cnaes?.length > 0 && (
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-xs font-bold text-foreground/70 mb-2 uppercase">Atividades Econômicas (CNAE)</label>
                                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-muted/30 border border-border rounded">
                                    {formData.cnaes.map((cnae, index) => (
                                        <div key={index} className="text-[11px] flex gap-2">
                                            <span className="font-mono font-bold text-primary shrink-0">{cnae.code}</span>
                                            <span className="text-foreground/80 leading-tight">{cnae.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Regime Tributário */}
                <section className="bg-card border border-border rounded-lg p-5 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-primary" />
                        Regime Tributário
                    </h2>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-foreground/70 mb-1 uppercase">Regime</label>
                        <select
                            name="taxRegime" value={formData.taxRegime} onChange={handleRegimeChange}
                            className="w-full max-w-xs bg-muted border border-border rounded px-3 py-2 text-sm outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                            disabled={true}
                            title="Regime Tributário detectado automaticamente."
                        >
                            <option value="">Aguardando Consulta...</option>
                            <option value="Simples Nacional">Simples Nacional</option>
                            <option value="Lucro Presumido">Lucro Presumido</option>
                            <option value="Lucro Real">Lucro Real</option>
                        </select>
                    </div>

                    {formData.taxRegime === 'Simples Nacional' && (
                        <div className="mb-4 space-y-2 border-t border-border pt-4">
                            <label className="block text-xs font-bold text-foreground/70 uppercase">Anexos (Atividades)</label>
                            <div className="flex flex-wrap gap-3 pointer-events-none opacity-80">
                                {Object.keys(SIMPLES_NACIONAL_RATES).map(anexo => (
                                    <label key={anexo} className={`flex items-center gap-2 px-3 py-1.5 rounded border ${formData.simplesAnnexes.includes(anexo) ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/30 border-border'}`}>
                                        <input
                                            type="checkbox"
                                            checked={formData.simplesAnnexes.includes(anexo)}
                                            readOnly
                                            className="rounded text-primary bg-background border-border"
                                        />
                                        <span className="text-sm font-medium">{anexo}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                                Os anexos e alíquotas foram travados no modo automático pela Receita Federal.
                            </p>
                        </div>
                    )}

                    {formData.porte === 'MEI' ? (
                        <div className="mt-4 p-4 border border-border rounded bg-muted/30">
                            <h3 className="text-sm font-bold text-primary mb-2">Impostos Simplificados (MEI)</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                Microempreendedores Individuais (MEI) são isentos da maioria dos tributos federais e pagam um <strong>valor fixo mensal (DAS MEI)</strong> que engloba o INSS e, dependendo da atividade, ICMS e ISS. Suas alíquotas percentuais são zeradas no sistema.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-px bg-border max-w-2xl opacity-50 pointer-events-none">
                                {['pis', 'cofins', 'csll', 'irpj', 'cpp', 'iss', 'icms', 'ipi'].map((tax) => (
                                    <div key={tax} className="bg-card p-3 flex flex-col gap-1 items-center justify-center">
                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{tax}</span>
                                        <input
                                            type="number" value="0.00" readOnly
                                            className="w-16 bg-background border border-border rounded px-1 py-1 text-xs text-center outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        formData.taxRegime && (
                            <div className="mt-6 border border-border rounded overflow-hidden">
                                {formData.taxRegime === 'Simples Nacional' && formData.simplesAnnexes?.length > 0 ? (
                                    // Render multiple annexes if selected
                                    <div className="flex flex-col gap-0 divide-y divide-border">
                                        {formData.simplesAnnexes.map(anexo => (
                                            <div key={anexo} className="bg-card">
                                                <div className="bg-muted px-3 py-2 border-b border-border flex items-center justify-between">
                                                    <h3 className="text-xs font-bold uppercase text-foreground/80 flex items-center gap-1">
                                                        <Percent className="h-3 w-3" />
                                                        Alíquotas do {anexo} (%)
                                                    </h3>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-px bg-border">
                                                    {['pis', 'cofins', 'csll', 'irpj', 'cpp', 'iss', 'icms', 'ipi'].map((tax) => {
                                                        const val = formData.annexRates?.[anexo]?.[tax as keyof typeof formData] as number || 0;
                                                        return (
                                                            <div key={tax} className="bg-card p-3 flex flex-col gap-1 items-center justify-center">
                                                                <span className="text-[10px] font-bold uppercase text-muted-foreground">{tax}</span>
                                                                <input
                                                                    type="number"
                                                                    value={val}
                                                                    readOnly={true}
                                                                    className="w-16 bg-muted/50 border border-border rounded px-1 py-1 text-xs text-center outline-none select-none pointer-events-none"
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    // Standard generic render
                                    <>
                                        <div className="bg-muted p-2 border-b border-border">
                                            <h3 className="text-xs font-bold uppercase text-foreground/70 flex items-center gap-1">
                                                <Percent className="h-3 w-3" />
                                                Alíquotas de Impostos Base (%)
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-px bg-border pointer-events-none">
                                            {['pis', 'cofins', 'csll', 'irpj', 'cpp', 'iss', 'icms', 'ipi'].map((tax) => (
                                                <div key={tax} className="bg-card p-3 flex flex-col gap-1 items-center justify-center">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{tax}</span>
                                                    <input
                                                        type="number"
                                                        name={tax}
                                                        value={formData[tax as keyof typeof formData] as number}
                                                        readOnly={true}
                                                        className="w-16 bg-muted/50 border border-border rounded px-1 py-1 text-xs text-center outline-none select-none pointer-events-none"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    )}
                </section>

                {/* DIFAL Section */}
                {formData.state ? (
                    <section className="bg-card border border-border rounded-lg p-5 shadow-sm">
                        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            DIFAL Nacional (Venda Interestadual)
                        </h2>
                        <p className="text-xs text-foreground/70 mb-4">
                            Baseado no seu estado de origem <strong>({STATES.find(s => s.short === formData.state)?.name})</strong>, aqui estão as porcentagens automáticas estimadas do Diferencial de Alíquota (DIFAL) para vendas a não contribuintes nos demais estados.
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {STATES.filter(s => s.short !== formData.state).map(dest => {
                                const difalVal = calculateDifal(formData.state, dest.short);
                                return (
                                    <div key={dest.short} className="bg-muted/30 border border-border rounded p-2 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-muted/50 transition-colors">
                                        {difalVal > 0 && (
                                            <div className="absolute top-0 right-0 w-8 h-8 bg-destructive/10 text-destructive text-[9px] font-bold flex items-center justify-center rounded-bl-full rotate-12 -mr-2 -mt-2 opacity-50">
                                                !!
                                            </div>
                                        )}
                                        <span className="font-bold text-sm">{dest.short}</span>
                                        <span className={`text-xl font-black ${difalVal > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{difalVal.toFixed(1)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : (
                    <div className="bg-muted/30 border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
                        Selecione o <strong>Estado (Origem)</strong> nos Dados Básicos para calcular o DIFAL automaticamente.
                    </div>
                )}

                {companyId && (
                    <section className="bg-destructive/5 flex flex-col sm:flex-row items-start sm:items-center justify-between border border-destructive/20 rounded-lg p-5 mt-8 gap-4">
                        <div>
                            <h2 className="text-sm font-semibold text-destructive mb-1">Zona de Perigo</h2>
                            <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita. Isso excluirá permanentemente os dados desta administradora.</p>
                        </div>
                        <button
                            onClick={handleDelete}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
                        >
                            Excluir Administradora
                        </button>
                    </section>
                )}
            </div>
        </div>
    );
}
