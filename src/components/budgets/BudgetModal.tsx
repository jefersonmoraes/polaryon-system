import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { useKanbanStore } from '@/store/kanban-store';
import { Budget, BudgetStatus, BudgetType, BudgetItem, QuotationSubItem, Company, MainCompanyProfile } from '@/types/kanban';
import {
    X, Plus, Calculator, Trash2, Building2, Calendar, FileText,
    CheckCircle2, Clock, XCircle, FileSearch, Save, Link as LinkIcon, Truck, Search, ChevronsUpDown, ChevronDown, ChevronUp, MapPin, DollarSign, Percent, Star, AlertTriangle,
    Phone, Mail, MessageCircle, ExternalLink, ClipboardList, Package, Info, ChevronLeft
} from 'lucide-react';
import { calculateDifal, calculateDifalDetailed, STATES, inferAnnexFromCnae } from '@/utils/taxData';
import { cn, getFaviconUrl } from '@/lib/utils';

interface BudgetModalProps {
    budget?: Budget;
    onClose: () => void;
}

const statusColors: Record<BudgetStatus, string> = {
    Aguardando: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    Cotado: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    Aprovado: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
    Recusado: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
};

const statusIcons: Record<BudgetStatus, React.ReactNode> = {
    Aguardando: <Clock className="h-4 w-4" />,
    Cotado: <FileSearch className="h-4 w-4" />,
    Aprovado: <CheckCircle2 className="h-4 w-4" />,
    Recusado: <XCircle className="h-4 w-4" />,
};

interface QuotationItemCardProps {
    item: BudgetItem;
    budgetType: 'Produto' | 'Serviço' | 'Frete'; // Passed from parent
    totalQuotes: number;
    highestCost: number;
    lowestCost: number;
    companies: Company[];
    mainCompanies: MainCompanyProfile[];
    updateItem: (id: string, fieldOrObject: keyof BudgetItem | Partial<BudgetItem>, value?: any, markDirty?: boolean) => void;
    removeItem: (id: string) => void;
    cloneItem: (id: string) => void;
    formatCurrency: (val: number) => string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    canEdit: boolean;
}

const QuotationItemCard: React.FC<QuotationItemCardProps> = ({ item, budgetType, totalQuotes, highestCost, lowestCost, companies, mainCompanies, updateItem, removeItem, cloneItem, formatCurrency, isExpanded, onToggleExpand, canEdit }) => {
    const { routes } = useKanbanStore();
    const [supplierSearch, setSupplierSearch] = useState('');
    const [transporterSearch, setTransporterSearch] = useState('');
    const [selectedSupplierArea, setSelectedSupplierArea] = useState<string | null>(null);
    const [selectedTransporterRoute, setSelectedTransporterRoute] = useState<string | null>(null);
    const [isSupplierOpen, setIsSupplierOpen] = useState(false);
    const [isTransporterOpen, setIsTransporterOpen] = useState(false);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [isUfOpen, setIsUfOpen] = useState(false);
    const [isTaxTooltipOpen, setIsTaxTooltipOpen] = useState(false); // Novo state para o balão de impostos
    const [isDifalTooltipOpen, setIsDifalTooltipOpen] = useState(false); // Novo state para o balão de DIFAL
    const [isNotesExpanded, setIsNotesExpanded] = useState(false); // Estado para expandir/recolher observações

    const supRef = useRef<HTMLDivElement>(null);
    const transRef = useRef<HTMLDivElement>(null);
    const adminRef = useRef<HTMLDivElement>(null);
    const ufRef = useRef<HTMLDivElement>(null);
    const taxRef = useRef<HTMLDivElement>(null); // Nova ref para fechar no click outside
    const difalRef = useRef<HTMLDivElement>(null); // Nova ref para fechar no click outside

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (supRef.current && !supRef.current.contains(event.target as Node)) setIsSupplierOpen(false);
            if (transRef.current && !transRef.current.contains(event.target as Node)) setIsTransporterOpen(false);
            if (adminRef.current && !adminRef.current.contains(event.target as Node)) setIsAdminOpen(false);
            if (ufRef.current && !ufRef.current.contains(event.target as Node)) setIsUfOpen(false);
            if (taxRef.current && !taxRef.current.contains(event.target as Node)) setIsTaxTooltipOpen(false);
            if (difalRef.current && !difalRef.current.contains(event.target as Node)) setIsDifalTooltipOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredSuppliers = companies
        .filter(c => {
            if (c.trashed || c.type !== 'Fornecedor') return false;
            if (selectedSupplierArea && !(c.areasAtuacao || []).includes(selectedSupplierArea)) return false;
            if (!supplierSearch) return true;

            const term = supplierSearch.toLowerCase();
            const numericTerm = supplierSearch.replace(/\D/g, '');

            const matchesText = (c.nickname && c.nickname.toLowerCase().includes(term)) ||
                (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
                c.razao_social.toLowerCase().includes(term) ||
                (numericTerm !== '' && c.cnpj?.includes(numericTerm)) ||
                (c.municipio && c.municipio.toLowerCase().includes(term)) ||
                (c.uf && c.uf.toLowerCase().includes(term));

            const matchesAreas = (c.areasAtuacao || []).some(area => area.toLowerCase().includes(term));

            return matchesText || matchesAreas;
        })
        .sort((a, b) => {
            // 1. Favorites first
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;

            // 2. Highest Rating second
            const ratingA = a.rating || 0;
            const ratingB = b.rating || 0;
            if (ratingA !== ratingB) return ratingB - ratingA;

            // 3. Alphabetical order last
            const nameA = a.nickname || a.nome_fantasia || a.razao_social;
            const nameB = b.nickname || b.nome_fantasia || b.razao_social;
            return nameA.localeCompare(nameB);
        });

    const filteredTransporters = companies
        .filter(c => {
            if (c.trashed || c.type !== 'Transportadora') return false;

            if (selectedTransporterRoute) {
                const routeObj = routes.find(r => r.name === selectedTransporterRoute);
                if (!routeObj || !routeObj.transporterIds.includes(c.id)) return false;
            }

            if (!transporterSearch) return true;

            const term = transporterSearch.toLowerCase();
            const numericTerm = transporterSearch.replace(/\D/g, '');

            const matchesText = (c.nickname && c.nickname.toLowerCase().includes(term)) ||
                (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
                c.razao_social.toLowerCase().includes(term) ||
                (numericTerm !== '' && c.cnpj?.includes(numericTerm)) ||
                (c.municipio && c.municipio.toLowerCase().includes(term)) ||
                (c.uf && c.uf.toLowerCase().includes(term));

            const transporterRoutes = routes.filter(r => r.transporterIds.includes(c.id)).map(r => r.name);
            const matchesRoutes = transporterRoutes.some(area => area.toLowerCase().includes(term));

            return matchesText || matchesRoutes;
        })
        .sort((a, b) => {
            // 1. Favorites first
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;

            // 2. Highest Rating second
            const ratingA = a.rating || 0;
            const ratingB = b.rating || 0;
            if (ratingA !== ratingB) return ratingB - ratingA;

            // 3. Alphabetical order last
            const nameA = a.nickname || a.nome_fantasia || a.razao_social;
            const nameB = b.nickname || b.nome_fantasia || b.razao_social;
            return nameA.localeCompare(nameB);
        });

    // Get Active Admin companies
    const adminCompanies = mainCompanies;
    const defaultAdmin = adminCompanies.find(c => c.isDefault) || adminCompanies[0];
    const selectedAdmin = adminCompanies.find(c => c.id === item.mainCompanyId);
    const adminLabel = selectedAdmin
        ? `${selectedAdmin.nomeFantasia || selectedAdmin.razaoSocial} ${selectedAdmin.isDefault ? '(Padrão)' : ''}`
        : "Selecione Administradora...";

    // Auto-select Admin if missing (Defaults to the Default Admin Company)
    useEffect(() => {
        if (!item.mainCompanyId && defaultAdmin) {
            updateItem(item.id, 'mainCompanyId', defaultAdmin.id);
        }
    }, [item.mainCompanyId, defaultAdmin, item.id, updateItem]);

    const supplierParams = companies.find(c => c.id === item.companyId);
    const supplierName = supplierParams ? (supplierParams.nickname || supplierParams.nome_fantasia || supplierParams.razao_social) : "Sem fornecedor";

    const addSubItem = () => {
        const newSubItem = {
            id: crypto.randomUUID(),
            description: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0
        };
        const newItems = [...(item.items || []), newSubItem];
        updateItem(item.id, 'items', newItems);
    };

    const recalculateTotal = useCallback((
        currentItems: QuotationSubItem[],
        freight: number,
        discountPercent: number,
        isDiscountActive: boolean,
        adminId?: string,
        destState?: string,
        marginPercent?: number,
        installmentsCost: number = 0 // Stubbing backwards compatibility
    ) => {
        const productsTotal = currentItems.reduce((sum: number, sub: any) => sum + (sub.totalPrice || 0), 0);
        let baseTotal = productsTotal + freight;

        if (isDiscountActive && discountPercent > 0) {
            baseTotal -= baseTotal * (discountPercent / 100);
        }

        // 1. Calculate Base Cost before taxes
        let cost = Math.max(0, baseTotal);

        // 2. Identify Admin Company and Calculate Taxes
        let difalPercent = 0;
        let taxRate = 0;
        let adminP = { pis: 0, cofins: 0, csll: 0, irpj: 0, cpp: 0, iss: 0, icms: 0, ipi: 0 };
        let breakdown = { pis: 0, cofins: 0, csll: 0, irpj: 0, cpp: 0, iss: 0, icms: 0, ipi: 0, total: 0 };
        let difalBreakdown = null;

        const adminCompany = mainCompanies.find(c => c.id === adminId);

        if (adminCompany) {
            // DIFAL (only for Products logically, but system allows configuration)
            // Reativado para Simples Nacional/MEI conforme pedido do usuário (ignorando ADI 5464 por opção estratégica/conservadora).
            const isSimplesOrMei = adminCompany.porte === 'MEI' || adminCompany.taxRegime === 'Simples Nacional';
            if (budgetType === 'Produto' && adminCompany.state && destState && adminCompany.state !== destState) {
                const difalDetails = calculateDifalDetailed(adminCompany.state, destState);
                if (difalDetails && difalDetails.percent > 0) {
                    difalPercent = difalDetails.percent;
                    difalBreakdown = difalDetails;
                }
            }

            // Normal Taxes if NOT MEI
            if (adminCompany.porte !== 'MEI') {
                // Apply specific rule: Services pay ISS, Products pay ICMS and IPI
                const isService = budgetType === 'Serviço';

                adminP.pis = adminCompany.pis || 0;
                adminP.cofins = adminCompany.cofins || 0;
                adminP.csll = adminCompany.csll || 0;
                adminP.irpj = adminCompany.irpj || 0;
                adminP.cpp = adminCompany.cpp || 0;

                adminP.iss = isService ? (adminCompany.iss || 0) : 0;
                adminP.icms = !isService ? (adminCompany.icms || 0) : 0;
                adminP.ipi = !isService ? (adminCompany.ipi || 0) : 0;

                taxRate = adminP.pis + adminP.cofins + adminP.csll + adminP.irpj + adminP.cpp + adminP.iss + adminP.icms + adminP.ipi;
            }
        }

        // Custo Efetivo de Aquisição/Transferência: (DIFAL is now treated as sales tax out of Gross Revenue)
        const effectiveCost = cost;

        // 3. Aplicação do Markup Divisor Contábil Real (Preço de Venda)
        // O imposto no Brasil (Simples/Presumido e DIFAL EC 87/15) recai sobre o RECEITA BRUTA (Preço Final), não sobre Custo.
        // Formula: Preço = Custo / (1 - (AlíquotaImposto% + AliquotaDIFAL% + MargemLucro%) / 100)

        let finalPrice = effectiveCost;
        // The fixed cost allocation is a vital metric; if not provided, assume 0 for exact cost mode.
        const fixedCostsRate = 0; // In future updates, we can let user input this. For now, it secures the parameter.
        const totalDeductionPercent = taxRate + difalPercent + fixedCostsRate + (marginPercent || 0);

        if (totalDeductionPercent > 0 && totalDeductionPercent < 100) {
            finalPrice = effectiveCost / (1 - (totalDeductionPercent / 100));
        } else if (totalDeductionPercent >= 100) {
            // Safety against division by zero or negative pricing
            finalPrice = effectiveCost; // Fallback
        }

        // 4. Agora calculamos o valor Nominal dos impostos a partir do Preço Final
        let taxNominal = 0;
        let difalNominal = 0;

        if (difalPercent > 0) {
            difalNominal = finalPrice * (difalPercent / 100);
        }

        if (taxRate > 0) {
            taxNominal = finalPrice * (taxRate / 100);

            breakdown = {
                pis: finalPrice * (adminP.pis / 100),
                cofins: finalPrice * (adminP.cofins / 100),
                csll: finalPrice * (adminP.csll / 100),
                irpj: finalPrice * (adminP.irpj / 100),
                cpp: finalPrice * (adminP.cpp / 100),
                iss: finalPrice * (adminP.iss / 100),
                icms: finalPrice * (adminP.icms / 100),
                ipi: finalPrice * (adminP.ipi / 100),
                total: taxNominal
            };
        }

        return { cost: effectiveCost, taxNominal, difalNominal, finalPrice, breakdown, difalBreakdown };
    }, [budgetType, mainCompanies]);

    const flushRecalculation = useCallback((
        subItems: QuotationSubItem[],
        freight: number,
        discountOpt: boolean,
        discountValue: number,
        adminId: string | undefined,
        destState: string | undefined,
        margin: number | undefined
    ) => {
        const result = recalculateTotal(
            subItems, freight, discountValue, discountOpt, adminId, destState, margin
        );

        // Batch update all calculated fields at once
        // Use markDirty: false because these are automatic SIDE EFFECTS of a change.
        // The original change (e.g. unitPrice update) already marked the item as dirty.
        // If this was triggered by a REMOTE sync, we definitely DON'T want to mark it dirty.
        setTimeout(() => {
            updateItem(item.id, {
                totalPrice: result.cost,
                taxValue: result.taxNominal,
                difalValue: result.difalNominal,
                taxesBreakdown: result.breakdown,
                finalSellingPrice: result.finalPrice,
                difalBreakdown: result.difalBreakdown || undefined
            }, undefined, false);
        }, 0);
    }, [item.id, updateItem, recalculateTotal]);

    // Effect to trigger recalculation when relevant item properties change
    useEffect(() => {
        flushRecalculation(
            item.items || [],
            Number(item.freightValue || 0),
            !!item.hasCashDiscount,
            Number(item.cashDiscount || 0),
            item.mainCompanyId,
            item.destinationState,
            item.profitMargin
        );
    }, [
        item.items,
        item.freightValue,
        item.hasCashDiscount,
        item.cashDiscount,
        item.mainCompanyId,
        item.destinationState,
        item.profitMargin,
        flushRecalculation
    ]);

    const updateSubItem = (subId: string, field: string, value: any) => {
        const newItems = (item.items || []).map((sub: any) => {
            if (sub.id === subId) {
                const updated = { ...sub, [field]: value };
                if (field === 'quantity' || field === 'unitPrice') {
                    updated.totalPrice = Number(updated.quantity || 0) * Number(updated.unitPrice || 0);
                }
                return updated;
            }
            return sub;
        });

        updateItem(item.id, 'items', newItems);
        // flushRecalculation will be triggered by the useEffect above
    };

    const handleFreightChange = (newFreightValue: string) => {
        const numericFreight = Number(newFreightValue);
        updateItem(item.id, 'freightValue', numericFreight);
        // flushRecalculation will be triggered by the useEffect above
    };

    const removeSubItem = (subId: string) => {
        const newItems = (item.items || []).filter((sub: any) => sub.id !== subId);
        updateItem(item.id, 'items', newItems);
        // flushRecalculation will be triggered by the useEffect above
    };

    // Helper to generic field update that impacts Total
    const handleFieldChangeImpactingTotal = (field: keyof BudgetItem, value: any) => {
        updateItem(item.id, field, value);
        // flushRecalculation will be triggered by the useEffect above
    }

    return (
        <div className="bg-secondary/30 rounded-xl border border-border group relative flex flex-col transition-all">
            {/* ... Header and Toggle are unchanged ... */}
            <div
                className={`p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors ${isExpanded ? 'border-b border-border/50 bg-secondary/20' : ''}`}
                onClick={onToggleExpand}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold flex items-center gap-2 w-full">
                            <button
                                onClick={(e) => { e.stopPropagation(); updateItem(item.id, 'isFavorite', !item.isFavorite); }}
                                disabled={!canEdit}
                                className={`transition-all hover:scale-125 focus:outline-none disabled:cursor-not-allowed ${item.isFavorite ? 'text-yellow-500 drop-shadow-md' : 'text-muted-foreground/30 hover:text-yellow-500/50'}`}
                                title={item.isFavorite ? "Remover Favorito" : "Tornar Vencedora (Favorita)"}
                            >
                                ★
                            </button>
                            {supplierParams?.customLink && (
                                <img
                                    src={getFaviconUrl(supplierParams.customLink)}
                                    alt=""
                                    className="w-6 h-6 rounded-sm shrink-0"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            )}
                            {(() => {
                                const transporter = companies.find(c => c.id === item.transporterId);
                                if (transporter?.customLink) {
                                    return (
                                        <img
                                            src={getFaviconUrl(transporter.customLink)}
                                            alt=""
                                            className="w-6 h-6 rounded-sm shrink-0"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                    );
                                }
                                return null;
                            })()}
                            <span className="truncate flex-1">{supplierName}</span>
                        </h4>
                        <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="shrink-0">{(item.items || []).length} {((item.items || []).length === 1) ? 'item' : 'itens'}</span>
                            {item.freightValue ? (
                                <>
                                    <span className="text-muted-foreground/30">•</span>
                                    <span className="text-primary/70 flex items-center gap-0.5 shrink-0"><Truck className="h-3 w-3" /> Frete: R$ {item.freightValue}</span>
                                </>
                            ) : null}
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-6 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-border/50 sm:border-0">
                    <div className="text-right flex flex-col items-end sm:mr-4 sm:border-r sm:border-border/50 sm:pr-4">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Custo Fornecedor</span>
                        <span className="text-sm font-mono font-medium text-muted-foreground">{formatCurrency(item.totalPrice || 0)}</span>
                        {(() => {
                            const cost = item.totalPrice || 0;
                            const sell = item.finalSellingPrice || cost;
                            if (cost > 0) {
                                const markup = ((sell / cost) - 1) * 100;
                                // Se a empresa tem muitos impostos, um markup baixo vai gerar lucro negativo. 
                                // O limiar conservador é de 30% para revenda com NF, mas deixamos 20% de base.
                                const isBad = markup < 20;
                                return (
                                    <div className="flex items-center gap-1 mt-0.5" title={isBad ? "Atenção: Mark-up muito baixo (abaixo de 20%)! O Risco de Prejuízo devido a impostos é alto." : "Mark-up aplicado sobre o Custo Efetivo"}>
                                        <span className="text-[8px] uppercase font-bold text-muted-foreground mt-0.5">Mark-Up:</span>
                                        <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 ${isBad ? 'text-red-500' : 'text-green-600'}`}>
                                            {markup.toFixed(1)}%
                                            {isBad && <AlertTriangle className="h-2.5 w-2.5" />}
                                        </span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                    <div className="text-right flex flex-col items-end max-w-[50%] sm:max-w-none">
                        <span className="text-[10px] sm:text-[11px] uppercase font-bold text-primary block truncate w-full text-right leading-none mb-1">Preço Final (Venda)</span>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                            {(() => {
                                // FIXED BUG: item.totalPrice already includes DIFAL as part of the Effective Cost.
                                // Subtracting it again would lead to double deduction.
                                // NOTE: In the latest accounting fix, DIFAL was moved out of effective cost and calculated over the final sale price.
                                const sell = item.finalSellingPrice || item.totalPrice || 0;
                                const cost = item.totalPrice || 0;
                                const itemProfit = sell - cost - (item.taxValue || 0) - (item.difalValue || 0);

                                if (sell > 0) {
                                    const netMargin = (itemProfit / sell) * 100;
                                    const isLoss = itemProfit < 0;
                                    const isLowMargin = netMargin < 10 && !isLoss;

                                    let colorClass = 'text-green-600 bg-green-500/10 border-green-500/20';
                                    if (isLoss) colorClass = 'text-red-600 bg-red-500/10 border-red-500/20';
                                    else if (isLowMargin) colorClass = 'text-orange-600 bg-orange-500/10 border-orange-500/20';

                                    return (
                                        <div
                                            className={`text-[8px] sm:text-[10px] uppercase font-bold px-1 sm:px-2 py-0.5 rounded border flex items-center gap-1 shrink-0 ${colorClass}`}
                                            title={isLoss ? "PREJUÍZO TRIBUTÁRIO DETECTADO!" : "Margem de Lucro Líquida Real (Após Impostos)"}
                                        >
                                            {isLoss ? <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : null}
                                            <span className="truncate max-w-[90px] sm:max-w-none">
                                                {isLoss ? 'PREJ' : 'LUCRO'}: {formatCurrency(itemProfit)}
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            <span className="text-sm sm:text-base font-mono font-bold text-primary bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded shrink-0">{formatCurrency(item.finalSellingPrice || item.totalPrice || 0)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {item.isFavorite && (
                            <span className="text-[10px] tracking-widest text-yellow-600 bg-yellow-500/10 px-2 font-bold py-1 uppercase rounded-full mr-2">
                                Escolha
                            </span>
                        )}
                        <div className="p-1 rounded-full hover:bg-secondary/80 text-muted-foreground cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Body */}
            {isExpanded && (
                <div className="p-4 flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* Basic Companies Link */}

                    {/* --- PARAMS BOX: ADMIN, STATE AND MARGIN --- */}
                    <div className="bg-card border border-border/60 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end shadow-sm mb-2">

                        <div className="space-y-1.5 flex flex-col justify-end h-full relative z-[60]" ref={adminRef}>
                            <label className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 text-muted-foreground">
                                <Building2 className="h-3 w-3" /> Administradora Local
                            </label>
                            <button
                                onClick={() => setIsAdminOpen(!isAdminOpen)}
                                disabled={!canEdit}
                                className="w-full bg-background border border-border rounded text-xs px-2 py-1.5 text-left flex items-center justify-between focus:ring-1 focus:ring-primary/30 outline-none text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="truncate">
                                    {adminLabel}
                                </span>
                                <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                            </button>
                            {isAdminOpen && (
                                <div className="absolute z-[100] top-[calc(100%+4px)] left-0 w-full min-w-[200px] bg-popover border border-border rounded-lg shadow-lg">
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                        {adminCompanies.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma encontrada</div>}
                                        {adminCompanies.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => { handleFieldChangeImpactingTotal('mainCompanyId', c.id); setIsAdminOpen(false); }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors hover:bg-secondary truncate ${item.mainCompanyId === c.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                                            >
                                                {c.nomeFantasia || c.razaoSocial} {c.isDefault ? '(Padrão)' : ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 flex flex-col justify-end h-full relative z-[60]" ref={ufRef}>
                            <label className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" /> UF Destino (DIFAL)
                            </label>
                            <button
                                onClick={() => setIsUfOpen(!isUfOpen)}
                                disabled={!canEdit}
                                className="w-full bg-background border border-border rounded text-xs px-2 py-1.5 text-left flex items-center justify-between focus:ring-1 focus:ring-primary/30 outline-none text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="truncate">
                                    {item.destinationState
                                        ? STATES.find(s => s.short === item.destinationState)?.name
                                        : "Sem Destino (Isento)"}
                                </span>
                                <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                            </button>

                            {isUfOpen && (
                                <div className="absolute z-[100] top-[calc(100%+4px)] left-0 w-full min-w-[200px] bg-popover border border-border rounded-lg shadow-lg">
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                                        <button
                                            onClick={() => { handleFieldChangeImpactingTotal('destinationState', undefined); setIsUfOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors hover:bg-secondary truncate ${!item.destinationState ? 'bg-primary/10 text-primary font-medium' : ''}`}
                                        >
                                            Sem Destino (Isento)
                                        </button>
                                        {STATES.map(st => (
                                            <button
                                                key={st.short}
                                                onClick={() => { handleFieldChangeImpactingTotal('destinationState', st.short); setIsUfOpen(false); }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors hover:bg-secondary truncate ${item.destinationState === st.short ? 'bg-primary/10 text-primary font-medium' : ''}`}
                                            >
                                                {st.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 flex flex-col justify-end h-full relative">
                            <label className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 text-primary">
                                <Percent className="h-3 w-3" /> MARGEM DE LUCRO
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="99.9"
                                    step="0.1"
                                    value={item.profitMargin || ''}
                                    disabled={!canEdit}
                                    onChange={e => {
                                        let val = Number(e.target.value);
                                        if (val >= 100) val = 99.9; // Prevent division by zero
                                        if (val < 0) val = 0;
                                        handleFieldChangeImpactingTotal('profitMargin', val);
                                    }}
                                    className="w-full bg-primary/10 border-primary/30 text-primary font-bold rounded text-xs pr-6 pl-2 py-1.5 focus:ring-1 focus:ring-primary/50 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-primary">%</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end justify-center h-full gap-0.5 mt-2 sm:mt-0 z-0 relative">
                            {(item.difalValue || 0) > 0 && (
                                <div className="w-full relative" ref={difalRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsDifalTooltipOpen(!isDifalTooltipOpen)}
                                        className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded w-full text-right cursor-pointer hover:bg-orange-500/20 transition-colors"
                                        title="Clique para ver Detalhes do DIFAL Aplicado"
                                    >
                                        + DIFAL: {formatCurrency(item.difalValue || 0)}
                                    </button>

                                    {/* DIFAL Tooltip Click Breakdown */}
                                    <div className={`absolute right-0 bottom-full mb-1 w-48 bg-popover border border-border rounded-lg shadow-xl p-2 text-[10px] space-y-1 transition-opacity z-50 ${isDifalTooltipOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                        <div className="font-bold text-muted-foreground pb-1 border-b border-border mb-1">Cálculo DIFAL</div>
                                        {item.difalBreakdown && (
                                            <>
                                                <div className="flex justify-between"><span>Origem ({item.difalBreakdown.origin})</span> <span>{item.difalBreakdown.interstate.toFixed(1)}%</span></div>
                                                <div className="flex justify-between"><span>Destino ({item.difalBreakdown.destination})</span> <span>{item.difalBreakdown.internal.toFixed(1)}%</span></div>
                                                <div className="flex justify-between font-bold pt-1 mt-1 border-t border-border/50 text-orange-500">
                                                    <span>Diferença Aplicada</span> <span>{item.difalBreakdown.percent.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between text-muted-foreground text-[9px] pt-1">
                                                    <span>Sobre Custo Base</span> <span>{formatCurrency(item.difalValue / (item.difalBreakdown.percent / 100))}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                            {(item.taxValue || 0) > 0 && (
                                <div className="w-full relative" ref={taxRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsTaxTooltipOpen(!isTaxTooltipOpen)}
                                        className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded w-full text-right cursor-pointer hover:bg-red-500/20 transition-colors"
                                        title="Clique para ver Detalhes dos Impostos sobre Venda"
                                    >
                                        + NFs/Imposto: {formatCurrency(item.taxValue || 0)}
                                    </button>

                                    {/* Tooltip Click Breakdown */}
                                    <div className={`absolute right-0 bottom-full mb-1 w-48 bg-popover border border-border rounded-lg shadow-xl p-2 text-[10px] space-y-1 transition-opacity z-50 ${isTaxTooltipOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                        <div className="font-bold text-muted-foreground pb-1 border-b border-border mb-1">Detalhamento de Impostos</div>
                                        {item.taxesBreakdown?.pis > 0 && <div className="flex justify-between"><span>PIS</span> <span>{formatCurrency(item.taxesBreakdown.pis)}</span></div>}
                                        {item.taxesBreakdown?.cofins > 0 && <div className="flex justify-between"><span>COFINS</span> <span>{formatCurrency(item.taxesBreakdown.cofins)}</span></div>}
                                        {item.taxesBreakdown?.csll > 0 && <div className="flex justify-between"><span>CSLL</span> <span>{formatCurrency(item.taxesBreakdown.csll)}</span></div>}
                                        {item.taxesBreakdown?.irpj > 0 && <div className="flex justify-between"><span>IRPJ</span> <span>{formatCurrency(item.taxesBreakdown.irpj)}</span></div>}
                                        {item.taxesBreakdown?.cpp > 0 && <div className="flex justify-between"><span>CPP</span> <span>{formatCurrency(item.taxesBreakdown.cpp)}</span></div>}
                                        {item.taxesBreakdown?.iss > 0 && <div className="flex justify-between"><span>ISS</span> <span>{formatCurrency(item.taxesBreakdown.iss)}</span></div>}
                                        {item.taxesBreakdown?.icms > 0 && <div className="flex justify-between"><span>ICMS</span> <span>{formatCurrency(item.taxesBreakdown.icms)}</span></div>}
                                        {item.taxesBreakdown?.ipi > 0 && <div className="flex justify-between"><span>IPI</span> <span>{formatCurrency(item.taxesBreakdown.ipi)}</span></div>}
                                        <div className="flex justify-between font-bold pt-1 mt-1 border-t border-border/50 text-red-500">
                                            <span>TOTAL</span> <span>{formatCurrency(item.taxesBreakdown?.total || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {(!item.taxValue && !item.difalValue) && (
                                <p className="text-[10px] font-medium text-muted-foreground italic w-full text-right py-0.5">Sem encargos extras</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 relative" ref={supRef}>
                            <label className="text-[10px] uppercase tracking-wider font-bold flex items-center justify-between text-muted-foreground mb-1">
                                <span>Fornecedor</span>
                                <div className="flex items-center gap-1.5 bg-background/50 px-2 py-0.5 rounded-full border border-border/40" title="Avaliação da Empresa">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => updateItem(item.id, 'supplierRating', star)}
                                            disabled={!canEdit}
                                            className={`outline-none transition-all p-0.5 hover:scale-125 disabled:cursor-not-allowed ${item.supplierRating && item.supplierRating >= star ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground/30 hover:text-yellow-500/60'}`}
                                            title={`${star} Estrela${star > 1 ? 's' : ''}`}
                                        >
                                            <Star className="h-3.5 w-3.5 fill-current" />
                                        </button>
                                    ))}
                                </div>
                            </label>
                            <button
                                onClick={() => setIsSupplierOpen(!isSupplierOpen)}
                                disabled={!canEdit}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="truncate">{supplierName}</span>
                                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                            </button>
                            {isSupplierOpen && (
                                <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden flex flex-col">
                                    <div className="p-2.5 border-b border-border flex items-center gap-2 bg-muted/30">
                                        <Search className="h-4 w-4 text-muted-foreground opacity-70 shrink-0" />
                                        <input
                                            autoFocus
                                            value={supplierSearch}
                                            onChange={e => setSupplierSearch(e.target.value)}
                                            placeholder="Buscar por nome ou CNPJ..."
                                            className="w-full bg-transparent text-sm placeholder:text-muted-foreground/60 outline-none"
                                        />
                                        {supplierSearch && (
                                            <button onClick={() => setSupplierSearch('')} className="p-1 hover:bg-black/10 rounded-full transition-colors text-muted-foreground">
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="px-2.5 py-1.5 border-b border-border bg-muted/10 overflow-x-auto custom-scrollbar flex gap-1.5">
                                        {Array.from(new Set(companies.filter(c => c.type === 'Fornecedor' && !c.trashed).flatMap(c => c.areasAtuacao || []))).sort().map(area => {
                                            const isSelected = selectedSupplierArea === area;
                                            return (
                                                <button
                                                    key={area}
                                                    onClick={(e) => { e.preventDefault(); setSelectedSupplierArea(isSelected ? null : area); }}
                                                    className={`shrink-0 text-[10px] px-2 py-1 rounded-full border transition-colors ${isSelected
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-background hover:bg-secondary border-border/60 text-muted-foreground'}`}
                                                >
                                                    {area}
                                                </button>
                                            )
                                        })}
                                        {Array.from(new Set(companies.filter(c => c.type === 'Fornecedor' && !c.trashed).flatMap(c => c.areasAtuacao || []))).length === 0 && (
                                            <span className="text-[10px] text-muted-foreground/50 italic py-1">Nenhuma área cadastrada</span>
                                        )}
                                    </div>
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                                        <button
                                            onClick={() => { updateItem(item.id, 'companyId', undefined); setIsSupplierOpen(false); }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary/80 text-muted-foreground font-medium flex items-center gap-2"
                                        >
                                            <XCircle className="h-3.5 w-3.5 opacity-70" /> Nenhum Fornecedor
                                        </button>

                                        {filteredSuppliers.length === 0 ? (
                                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum fornecedor encontrado.</div>
                                        ) : (
                                            filteredSuppliers.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => { updateItem(item.id, 'companyId', c.id); setIsSupplierOpen(false); }}
                                                    className={`w-full text-left px-3 py-2 rounded-md transition-all hover:bg-primary/5 border border-transparent hover:border-primary/20 flex flex-col gap-0.5 group ${c.isFavorite ? 'bg-primary/5 border-primary/10' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start w-full gap-2">
                                                        <div className="flex items-center gap-2 truncate">
                                                            {c.customLink && (
                                                                <img
                                                                    src={getFaviconUrl(c.customLink)}
                                                                    alt=""
                                                                    className="w-6 h-6 rounded-sm shrink-0"
                                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                />
                                                            )}
                                                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                                                {c.nickname || c.nome_fantasia || c.razao_social}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {c.isFavorite && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Destaque</span>}
                                                            {c.rating ? (
                                                                <div className="flex items-center gap-0.5 text-yellow-500">
                                                                    <span className="text-xs font-bold leading-none">{c.rating}</span>
                                                                    <Star className="h-2.5 w-2.5 fill-current" />
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 w-full">
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground w-full">
                                                            {c.cnpj && <span className="font-mono truncate">{c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>}
                                                            {(c.cnpj && c.municipio) && <span>•</span>}
                                                            {c.municipio && <span className="truncate">{c.municipio} - {c.uf}</span>}
                                                        </div>
                                                        {c.areasAtuacao && c.areasAtuacao.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                                {c.areasAtuacao.slice(0, 3).map((area, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedSupplierArea(area); }}
                                                                        className="text-[9px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border/50 hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                                                                        title="Filtrar por esta área"
                                                                    >
                                                                        {area}
                                                                    </span>
                                                                ))}
                                                                {c.areasAtuacao.length > 3 && (
                                                                    <span className="text-[9px] bg-secondary/50 text-muted-foreground px-1 py-0.5 rounded">
                                                                        +{c.areasAtuacao.length - 3}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 relative" ref={transRef}>
                            <label className="text-[10px] uppercase tracking-wider font-bold flex items-center justify-between text-muted-foreground mb-1">
                                <span>Transportadora</span>
                                <div className="flex items-center gap-1.5 bg-background/50 px-2 py-0.5 rounded-full border border-border/40" title="Avaliação da Transportadora">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => updateItem(item.id, 'transporterRating', star)}
                                            disabled={!canEdit}
                                            className={`outline-none transition-all p-0.5 hover:scale-125 disabled:cursor-not-allowed ${item.transporterRating && item.transporterRating >= star ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground/30 hover:text-yellow-500/60'}`}
                                            title={`${star} Estrela${star > 1 ? 's' : ''}`}
                                        >
                                            <Star className="h-3.5 w-3.5 fill-current" />
                                        </button>
                                    ))}
                                </div>
                            </label>
                            <button
                                onClick={() => setIsTransporterOpen(!isTransporterOpen)}
                                disabled={!canEdit}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="truncate">
                                    {item.transporterId
                                        ? (companies.find(c => c.id === item.transporterId)?.nome_fantasia || companies.find(c => c.id === item.transporterId)?.razao_social)
                                        : "Nenhuma (FOB / Incluso)"}
                                </span>
                                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                            </button>
                            {isTransporterOpen && (
                                <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden flex flex-col">
                                    <div className="p-2.5 border-b border-border flex items-center gap-2 bg-muted/30">
                                        <Search className="h-4 w-4 text-muted-foreground opacity-70 shrink-0" />
                                        <input
                                            autoFocus
                                            value={transporterSearch}
                                            onChange={e => setTransporterSearch(e.target.value)}
                                            placeholder="Buscar por nome ou CNPJ..."
                                            className="w-full bg-transparent text-sm placeholder:text-muted-foreground/60 outline-none"
                                        />
                                        {transporterSearch && (
                                            <button onClick={() => setTransporterSearch('')} className="p-1 hover:bg-black/10 rounded-full transition-colors text-muted-foreground">
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="px-2.5 py-1.5 border-b border-border bg-muted/10 overflow-x-auto custom-scrollbar flex gap-1.5">
                                        {Array.from(new Set(routes.filter(r => !r.trashed).map(r => r.name))).sort().map(area => {
                                            const isSelected = selectedTransporterRoute === area;
                                            return (
                                                <button
                                                    key={area}
                                                    onClick={(e) => { e.preventDefault(); setSelectedTransporterRoute(isSelected ? null : area); }}
                                                    className={`shrink-0 text-[10px] px-2 py-1 rounded-full border transition-colors flex items-center gap-1 ${isSelected
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-background hover:bg-secondary border-border/60 text-muted-foreground'}`}
                                                >
                                                    <MapPin className="h-2.5 w-2.5" /> {area}
                                                </button>
                                            )
                                        })}
                                        {Array.from(new Set(routes.filter(r => !r.trashed).map(r => r.name))).length === 0 && (
                                            <span className="text-[10px] text-muted-foreground/50 italic py-1">Nenhuma rota cadastrada</span>
                                        )}
                                    </div>
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                                        <button
                                            onClick={() => { updateItem(item.id, 'transporterId', undefined); setIsTransporterOpen(false); }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary/80 text-muted-foreground font-medium flex items-center gap-2"
                                        >
                                            <Truck className="h-3.5 w-3.5 opacity-70" /> Nenhuma (Incluso / FOB)
                                        </button>

                                        {filteredTransporters.length === 0 ? (
                                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma transportadora encontrada.</div>
                                        ) : (
                                            filteredTransporters.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => { updateItem(item.id, 'transporterId', c.id); setIsTransporterOpen(false); }}
                                                    className={`w-full text-left px-3 py-2 rounded-md transition-all hover:bg-primary/5 border border-transparent hover:border-primary/20 flex flex-col gap-0.5 group ${c.isFavorite ? 'bg-primary/5 border-primary/10' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start w-full gap-2">
                                                        <div className="flex items-center gap-2 truncate">
                                                            {c.customLink && (
                                                                <img
                                                                    src={getFaviconUrl(c.customLink)}
                                                                    alt=""
                                                                    className="w-6 h-6 rounded-sm shrink-0"
                                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                />
                                                            )}
                                                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                                                {c.nome_fantasia || c.razao_social}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {c.isFavorite && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Destaque</span>}
                                                            {c.rating ? (
                                                                <div className="flex items-center gap-0.5 text-yellow-500">
                                                                    <span className="text-xs font-bold leading-none">{c.rating}</span>
                                                                    <Star className="h-2.5 w-2.5 fill-current" />
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 w-full">
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground w-full">
                                                            {c.cnpj && <span className="font-mono truncate">{c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>}
                                                            {(c.cnpj && c.municipio) && <span>•</span>}
                                                            {c.municipio && <span className="truncate">{c.municipio} - {c.uf}</span>}
                                                        </div>
                                                        {(() => {
                                                            const transpRoutes = routes.filter(r => r.transporterIds.includes(c.id) && !r.trashed).map(r => r.name);
                                                            if (transpRoutes.length === 0) return null;
                                                            return (
                                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                                    {transpRoutes.slice(0, 3).map((area, idx) => (
                                                                        <span
                                                                            key={idx}
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedTransporterRoute(area); }}
                                                                            className="text-[9px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border/50 hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer flex items-center gap-0.5"
                                                                            title="Filtrar por esta rota"
                                                                        >
                                                                            <MapPin className="h-2 w-2" /> {area}
                                                                        </span>
                                                                    ))}
                                                                    {transpRoutes.length > 3 && (
                                                                        <span className="text-[9px] bg-secondary/50 text-muted-foreground px-1 py-0.5 rounded">
                                                                            +{transpRoutes.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grid of Negotiation Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 bg-card border border-border/50 rounded-lg p-3 shadow-sm">

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Valor do Frete</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.freightValue || ''}
                                    disabled={!canEdit}
                                    onChange={e => handleFreightChange(e.target.value)}
                                    placeholder="CIF..."
                                    className="w-full bg-background border border-border rounded text-xs pl-7 pr-2 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer mt-1 group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={!!item.hasInvoiceTriangulation}
                                        onChange={e => updateItem(item.id, 'hasInvoiceTriangulation', e.target.checked)}
                                        disabled={!canEdit}
                                        className="peer sr-only"
                                    />
                                    <div className="h-3 w-3 border border-input rounded flex-shrink-0 bg-background peer-checked:bg-primary peer-checked:border-primary peer-focus:ring-1 transition-all flex items-center justify-center">
                                        {item.hasInvoiceTriangulation && <svg width="8" height="8" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary-foreground"><path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L6.28284 12.8222C6.10444 13.0959 5.75163 13.2307 5.43825 13.1444C5.12487 13.058 4.90806 12.7846 4.86981 12.46L4.01529 5.33534C3.96203 4.89133 4.41727 4.56702 4.82512 4.69749L10.7428 6.58988C11.0772 6.69679 11.4582 6.5501 11.6214 6.24227L11.4669 3.72684Z" fill="currentColor" /></svg>}
                                    </div>
                                </div>
                                <span className="text-[9px] text-muted-foreground font-medium select-none group-hover:text-primary transition-colors">Triangulação de Nf</span>
                            </label>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">VALIDADE DA PROPOSTA</label>
                            <input
                                value={item.validity || ''}
                                onChange={e => updateItem(item.id, 'validity', e.target.value)}
                                disabled={!canEdit}
                                placeholder="30 dias..."
                                className="w-full bg-background border border-border rounded text-xs px-2.5 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">Prazo de Entrega</label>
                            <div className="flex flex-col gap-1.5">
                                <input
                                    type="date"
                                    value={item.deliveryDate || ''}
                                    disabled={!canEdit}
                                    onChange={e => updateItem(item.id, 'deliveryDate', e.target.value)}
                                    className="w-full bg-background border border-border rounded text-[11px] px-2 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <input
                                    value={item.deliveryTime || ''}
                                    disabled={!canEdit}
                                    onChange={e => updateItem(item.id, 'deliveryTime', e.target.value)}
                                    placeholder="Ex: 5 dias úteis..."
                                    className="w-full bg-background border border-border rounded text-[11px] px-2 py-1 focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">Garantia</label>
                            <input
                                value={item.warrantyDays || ''}
                                disabled={!canEdit}
                                onChange={e => updateItem(item.id, 'warrantyDays', e.target.value)}
                                placeholder="Nenhuma / 1 Ano"
                                className="w-full bg-background border border-border rounded text-xs px-2.5 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">VENDE FATURADO?</label>
                            <div className="flex flex-col gap-1.5">
                                <div className={`flex border border-border rounded overflow-hidden select-none bg-background ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <span onClick={() => canEdit && updateItem(item.id, 'invoicedSales', false)} className={`flex-1 text-center py-1 text-[11px] cursor-pointer font-medium ${item.invoicedSales !== true ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}>Não</span>
                                    <span onClick={() => canEdit && updateItem(item.id, 'invoicedSales', true)} className={`flex-1 text-center py-1 text-[11px] cursor-pointer font-medium border-l border-border ${item.invoicedSales === true ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}>Sim</span>
                                </div>
                                {item.invoicedSales && (
                                    <input
                                        value={item.invoiceTerm || ''}
                                        disabled={!canEdit}
                                        onChange={e => updateItem(item.id, 'invoiceTerm', e.target.value)}
                                        placeholder="Prazos: 15/30/45..."
                                        className="w-full animate-in fade-in bg-background border border-primary/30 rounded text-[11px] px-2 py-1 focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">Forma de Pagamento</label>
                            <select
                                value={item.paymentTerms || ''}
                                disabled={!canEdit}
                                onChange={e => handleFieldChangeImpactingTotal('paymentTerms', e.target.value)}
                                className="w-full bg-background border border-border text-foreground rounded text-xs px-2 py-1.5 focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">Não informado</option>
                                <option value="À vista">Dinheiro (À vista)</option>
                                <option value="PIX">PIX</option>
                                <option value="Boleto">Boleto Bancário</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Cartão de Débito">Cartão de Débito</option>
                                <option value="Transferência Bancária">Transferência (TED/DOC)</option>
                            </select>
                        </div>

                        {/* Desconto Híbrido Conditional */}
                        <div className="space-y-1.5 p-1.5 border border-dashed border-border/60 rounded">
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={!!item.hasCashDiscount}
                                        disabled={!canEdit}
                                        onChange={e => handleFieldChangeImpactingTotal('hasCashDiscount', e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="h-3.5 w-3.5 border border-input rounded flex-shrink-0 bg-background peer-checked:bg-green-500/80 peer-checked:border-green-500 peer-focus:ring-2 disabled:cursor-not-allowed transition-all flex items-center justify-center">
                                        {item.hasCashDiscount && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                                    </div>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-muted-foreground select-none">Aplicar Desconto?</span>
                            </label>

                            {item.hasCashDiscount && (
                                <div className="animate-in fade-in slide-in-from-top-1 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        max="100"
                                        disabled={!canEdit}
                                        value={item.cashDiscount || ''}
                                        onChange={e => handleFieldChangeImpactingTotal('cashDiscount', Number(e.target.value))}
                                        placeholder="Porcentagem (Ex: 5, 12, 18.5)..."
                                        className="w-full bg-green-500/10 border-green-500/30 text-green-600 border rounded text-xs pl-6 pr-2 py-1 focus:ring-1 focus:ring-green-500/50 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Juros Condicionais Baseado na Forma de Pagamento */}
                        {['Cartão de Crédito', 'Boleto'].includes(item.paymentTerms || '') ? (
                            <div className="space-y-1.5 lg:col-span-2 p-1.5 bg-orange-500/5 border border-orange-500/20 rounded">
                                <label className="text-[9px] uppercase tracking-widest font-bold text-orange-600/70 flex items-center gap-1">
                                    <Calculator className="h-3 w-3" /> Condição de Parcelamento
                                </label>
                                <div className="flex gap-2 animate-in fade-in">
                                    <div className="flex-1 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground ml-1">Parcelas</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.installmentsCount || ''}
                                            onChange={e => handleFieldChangeImpactingTotal('installmentsCount', Number(e.target.value))}
                                            placeholder="Ex: 5"
                                            className="w-full bg-background border border-border rounded text-xs pl-14 pr-1 py-1 focus:ring-1 focus:ring-orange-500/30 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Empty placeholder div to keep grid balance if no installments allowed
                            <div className="hidden lg:block lg:col-span-2"></div>
                        )}

                        <div className="space-y-1.5 lg:col-span-2">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">Checkbox Adicionais</label>
                            <div className="flex gap-4 items-center bg-background border border-border rounded px-3 py-1.5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={!!item.hasInsurance}
                                            onChange={e => updateItem(item.id, 'hasInsurance', e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-4 w-4 border border-input rounded-sm bg-transparent peer-checked:bg-primary peer-checked:border-primary peer-focus:ring-2 disabled:cursor-not-allowed transition-all flex items-center justify-center">
                                            {item.hasInsurance && <svg width="10" height="10" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary-foreground"><path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L6.28284 12.8222C6.10444 13.0959 5.75163 13.2307 5.43825 13.1444C5.12487 13.058 4.90806 12.7846 4.86981 12.46L4.01529 5.33534C3.96203 4.89133 4.41727 4.56702 4.82512 4.69749L10.7428 6.58988C11.0772 6.69679 11.4582 6.5501 11.6214 6.24227L11.4669 3.72684Z" fill="currentColor" /></svg>}
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium select-none">Seguro de Carga</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={!!item.hasServiceContract}
                                            onChange={e => updateItem(item.id, 'hasServiceContract', e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-4 w-4 border border-input rounded-sm bg-transparent peer-checked:bg-primary peer-checked:border-primary peer-focus:ring-2 disabled:cursor-not-allowed transition-all flex items-center justify-center">
                                            {item.hasServiceContract && <svg width="10" height="10" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary-foreground"><path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L6.28284 12.8222C6.10444 13.0959 5.75163 13.2307 5.43825 13.1444C5.12487 13.058 4.90806 12.7846 4.86981 12.46L4.01529 5.33534C3.96203 4.89133 4.41727 4.56702 4.82512 4.69749L10.7428 6.58988C11.0772 6.69679 11.4582 6.5501 11.6214 6.24227L11.4669 3.72684Z" fill="currentColor" /></svg>}
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium select-none">Fornece Contrato Serviço</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={!!item.emitsResaleInvoice}
                                            onChange={e => updateItem(item.id, 'emitsResaleInvoice', e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-4 w-4 border border-input rounded-sm bg-transparent peer-checked:bg-primary peer-checked:border-primary peer-focus:ring-2 disabled:cursor-not-allowed transition-all flex items-center justify-center">
                                            {item.emitsResaleInvoice && <svg width="10" height="10" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary-foreground"><path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L6.28284 12.8222C6.10444 13.0959 5.75163 13.2307 5.43825 13.1444C5.12487 13.058 4.90806 12.7846 4.86981 12.46L4.01529 5.33534C3.96203 4.89133 4.41727 4.56702 4.82512 4.69749L10.7428 6.58988C11.0772 6.69679 11.4582 6.5501 11.6214 6.24227L11.4669 3.72684Z" fill="currentColor" /></svg>}
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium select-none">Emite NF de Revenda?</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* SubItems Array */}
                    <div className="bg-background/50 rounded border border-border/50 p-3 mt-2">
                        <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                            <h5 className="text-xs font-bold text-muted-foreground">Itens da Cotação</h5>
                            {canEdit && (
                                <button
                                    onClick={addSubItem}
                                    className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-2 py-1 rounded transition-colors"
                                >
                                    <Plus className="h-3 w-3" /> ADICIONAR ITEM
                                </button>
                            )}
                        </div>

                        {(item.items?.length === 0 || !item.items) ? (
                            <div className="text-center py-4 text-xs text-muted-foreground italic">
                                Nenhum produto ou serviço listado neste fornecedor.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Desktop Header */}
                                <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                                    <div className="col-span-1 border-r border-border/50 text-center">#</div>
                                    <div className="col-span-4">Descrição</div>
                                    <div className="col-span-2 text-right">Qtd</div>
                                    <div className="col-span-2 text-right">V. Unit</div>
                                    <div className="col-span-3 text-right pr-6">Total</div>
                                </div>

                                {item.items.map((sub: any, subIdx: number) => (
                                    <div key={sub.id} className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-2 items-start sm:items-center bg-secondary/50 p-3 sm:p-2 rounded-lg border border-border group/sub">
                                        {/* Mobile Header with Index and Delete */}
                                        <div className="flex sm:hidden items-center justify-between w-full border-b border-border/50 pb-2 mb-1">
                                            <span className="text-[10px] font-bold text-muted-foreground">ITEM #{subIdx + 1}</span>
                                            {canEdit && (
                                                <button
                                                    onClick={() => removeSubItem(sub.id)}
                                                    className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="hidden sm:block col-span-1 text-[10px] text-muted-foreground text-center font-medium border-r border-border/50">
                                            {subIdx + 1}
                                        </div>

                                        <div className="w-full sm:col-span-4 relative">
                                            <label className="sm:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1 block">Descrição</label>
                                            <input
                                                value={sub.description}
                                                disabled={!canEdit}
                                                onChange={e => updateSubItem(sub.id, 'description', e.target.value)}
                                                placeholder="Nome do produto ou serviço..."
                                                className="w-full bg-background sm:bg-transparent border border-border sm:border-none text-xs px-2 sm:px-1 py-1.5 sm:py-1 focus:ring-1 focus:ring-primary/20 rounded outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 sm:contents gap-3 w-full">
                                            <div className="sm:col-span-2">
                                                <label className="sm:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1 block">Qtd</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    disabled={!canEdit}
                                                    value={sub.quantity || ''}
                                                    onChange={e => updateSubItem(sub.id, 'quantity', Number(e.target.value))}
                                                    className="w-full bg-background border border-border/50 rounded text-xs px-2 py-1.5 focus:ring-1 focus:ring-primary/20 outline-none text-right font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                            <div className="sm:col-span-2 relative">
                                                <label className="sm:hidden text-[9px] font-bold text-muted-foreground uppercase mb-1 block">V. Unit</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        disabled={!canEdit}
                                                        value={sub.unitPrice || ''}
                                                        onChange={e => updateSubItem(sub.id, 'unitPrice', Number(e.target.value))}
                                                        className="w-full bg-background border border-border/50 rounded text-xs pl-6 pr-2 py-1.5 focus:ring-1 focus:ring-primary/20 outline-none text-right font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-full sm:col-span-3 text-right text-xs font-mono font-bold text-primary flex justify-between items-center sm:pl-1 border-t sm:border-none border-border/50 pt-2 sm:pt-0">
                                            <div className="flex flex-col sm:contents items-end w-full">
                                                <label className="sm:hidden text-[9px] font-bold text-muted-foreground uppercase mb-0.5 block">Total Item</label>
                                                <span className="truncate flex items-center gap-1 justify-end w-full">
                                                    <DollarSign className="h-3 w-3 inline text-muted-foreground mr-1" />
                                                    {formatCurrency(sub.totalPrice || 0)}
                                                </span>
                                            </div>
                                            {canEdit && (
                                                <button
                                                    onClick={() => removeSubItem(sub.id)}
                                                    className="hidden sm:block p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover/sub:opacity-100 ml-2"
                                                    title="Remover Item"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes Field */}
                    <div className="space-y-2 mt-2">
                        <button
                            type="button"
                            onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                            className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors mb-1"
                        >
                            {isNotesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Observações Específicas
                        </button>

                        {isNotesExpanded && (
                            <textarea
                                value={item.notes || ''}
                                onChange={e => updateItem(item.id, 'notes', e.target.value)}
                                placeholder="Condições de frete, impostos aplicáveis ou isenções..."
                                rows={3}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-y custom-scrollbar min-h-[80px] animate-in slide-in-from-top-2 duration-200"
                            />
                        )}

                        {!isNotesExpanded && item.notes && (
                            <p className="text-xs text-muted-foreground px-2 py-1 bg-secondary/30 rounded border border-border/10 truncate cursor-pointer hover:bg-secondary/50" onClick={() => setIsNotesExpanded(true)}>
                                {item.notes}
                            </p>
                        )}
                    </div>

                    {/* Danger Zone Actions */}
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-border/50">
                        <button
                            onClick={() => cloneItem(item.id)}
                            className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded"
                            title="Duplicar cotação idêntica de forma autônoma"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> CLONAR COTAÇÃO
                        </button>
                        <button
                            onClick={() => removeItem(item.id)}
                            className="text-[10px] font-bold text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded"
                            title="Excluir Cotação Inteira Permanente"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> EXCLUIR COTAÇÃO
                        </button>
                    </div>
                </div>
            )
            }
        </div >
    );
};

const BudgetModal = ({ budget, onClose }: BudgetModalProps) => {
    const { 
        addBudget, 
        updateBudget, 
        companies, 
        mainCompanies, 
        budgets,
        cards,
        lists,
        boards,
        routes
    } = useKanbanStore();
    const { currentUser } = useAuthStore();
    const canEdit = currentUser?.role === 'ADMIN' || currentUser?.permissions?.canEdit;
    const navigate = useNavigate();

    const [activeBudgetId, setActiveBudgetId] = useState<string | undefined>(budget?.id);
    const budgetFromStore = budgets.find(b => b.id === activeBudgetId);

    const [formData, setFormData] = useState<Partial<Budget>>(budget || {
        title: '',
        address: '',
        deliveryTime: '',
        type: 'Produto',
        status: 'Aguardando',
        cardId: '',
        items: [],
        totalValue: 0
    });

    const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
    const [mobileTab, setMobileTab] = useState<'details' | 'supplier' | 'transporter'>('details');


    const allowedCards = cards.filter(c => {
        if (c.archived || c.trashed) return false;
        const list = lists.find(l => l.id === c.listId);
        if (!list) return true;
        const board = boards.find(b => b.id === list.boardId);
        if (!board) return true;
        const boardName = board.name.toLowerCase();

        // Ignorar cartões que estão dentro de boards feitos exclusivamente para cadastro antigo de empresas
        if (boardName.includes('fornecedor') || boardName.includes('transportadora') || boardName.includes('empresas')) {
            return false;
        }
        return true;
    });

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    // Mobile Search States
    const [mobileSupplierSearch, setMobileSupplierSearch] = useState('');
    const [mobileTransporterSearch, setMobileTransporterSearch] = useState('');
    const [isChangingSupplier, setIsChangingSupplier] = useState(false);
    const [isChangingTransporter, setIsChangingTransporter] = useState(false);
    const isDirtyRef = useRef(false);
    const saveStatusRef = useRef<'idle' | 'saving' | 'saved' | 'error'>(saveStatus);
    useEffect(() => {
        saveStatusRef.current = saveStatus;
    }, [saveStatus]);

    const lastSavedDataRef = useRef<string>('');
    const saveTimeoutRef = useRef<NodeJS.Timeout>();
    const syncLockRef = useRef<number>(0);
    const dirtyFieldsRef = useRef<Set<string>>(new Set());
    const dirtyItemIdsRef = useRef<Set<string>>(new Set());

    // STABLE COMPARISON: Deep equality check that ignores metadata 
    const stableStringify = (obj: any): string => {
        if (obj === null || obj === undefined) return 'null';
        if (typeof obj !== 'object') return String(obj);
        if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
        const keys = Object.keys(obj).sort().filter(k => ![
            'id', 'createdAt', 'updatedAt', 'trashedAt', 
            'userId', 'lastCnpjCheck', 'archived'
        ].includes(k));
        return `{${keys.map(k => `${k}:${stableStringify(obj[k])}`).join(',')}}`;
    };

    const getRelevantData = (data: any) => stableStringify(data);

    // INITIALIZATION: Only run when the prop budget ID changes or component mounts
    useEffect(() => {
        const initialBudget = budgets.find(b => b.id === budget?.id) || budget;

        if (initialBudget?.id && initialBudget.id !== activeBudgetId) {
            setActiveBudgetId(initialBudget.id);
            setFormData(initialBudget);
            isDirtyRef.current = false;
            dirtyFieldsRef.current.clear();
            lastSavedDataRef.current = getRelevantData(initialBudget);
        } else if (!initialBudget?.id && !activeBudgetId) {
            const newId = crypto.randomUUID();
            const initialData = {
                title: 'Novo Orçamento',
                address: '',
                deliveryTime: '',
                type: 'Produto' as BudgetType,
                status: 'Aguardando' as BudgetStatus,
                items: [],
                totalValue: 0,
                createdAt: new Date().toISOString()
            };
            
            setFormData({ ...initialData, id: newId } as unknown as Budget);
            setActiveBudgetId(newId);
            isDirtyRef.current = false;
            dirtyFieldsRef.current.clear();
            lastSavedDataRef.current = getRelevantData(initialData);

            setTimeout(() => {
                addBudget({ ...initialData, id: newId });
            }, 0);
        }
    }, [budget?.id, activeBudgetId, addBudget]);

    // Track latest formData for unmount save
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    // Track in-flight saving promise to avoid parallel request conflicts
    const savingPromiseRef = useRef<Promise<any> | null>(null);

    // Auto-Save Effect (Debounce)
    const currentDataStr = getRelevantData(formData);
    useEffect(() => {
        if (!activeBudgetId || !isDirtyRef.current) return;
        
        // If data is already saved, just clear the dirty flag and return
        if (currentDataStr === lastSavedDataRef.current) {
            isDirtyRef.current = false;
            return;
        }

        const timer = setTimeout(async () => {
            // Wait for any in-flight save to finish
            if (savingPromiseRef.current) {
                await savingPromiseRef.current;
            }

            // Check if we are still dirty after waiting
            if (!isDirtyRef.current) return;

            const currentFormData = formDataRef.current;
            
            // SIMULTANEOUS EDITING: Only send the fields that actually changed
            const dataToSave: any = {};
            dirtyFieldsRef.current.forEach(field => {
                dataToSave[field] = (currentFormData as any)[field];
            });

            // If no fields are actually dirty after all, skip
            if (Object.keys(dataToSave).length === 0) {
                isDirtyRef.current = false;
                return;
            }
            
            console.log("BudgetModal - Saving delta:", Object.keys(dataToSave));
            setSaveStatus('saving');

            try {
                const savePromise = updateBudget(activeBudgetId, dataToSave);
                savingPromiseRef.current = savePromise;
                
                await savePromise;
                
                console.log("BudgetModal - Delta save successful!");
                lastSavedDataRef.current = getRelevantData(currentFormData);
                isDirtyRef.current = false;
                dirtyFieldsRef.current.clear();
                dirtyItemIdsRef.current.clear(); // Limpa itens alterados após persistência
                syncLockRef.current = Date.now();
                setSaveStatus('saved');
            } catch (err) {
                console.error("BudgetModal - Save failed:", err);
                setSaveStatus('error');
            } finally {
                savingPromiseRef.current = null;
            }
        }, 1500); 

        return () => clearTimeout(timer);
    }, [currentDataStr, activeBudgetId, updateBudget]);

    // EXTERNAL SYNC: Update local formData if budget from store changes (Socket updates)
    const liveBudget = budgetFromStore || budgets.find(b => b.id === activeBudgetId);
    const storeDataStr = getRelevantData(liveBudget);
    useEffect(() => {
        if (!liveBudget || !activeBudgetId) return;

        // Skip if recently saved by us to avoid immediate feedback jitter
        const isRecentlySavedByMe = (Date.now() - syncLockRef.current) < 3000;
        if (isRecentlySavedByMe || savingPromiseRef.current) return;

        setFormData(prev => {
            const localDataStr = getRelevantData(prev);
            // If nothing changed in the store relative to what we see, skip
            if (storeDataStr === localDataStr) return prev;

            console.log("BudgetModal - Performing smart merge from remote...");
            const merged = { ...prev };
            let hasChanges = false;

            Object.keys(liveBudget).forEach(key => {
                const k = key as keyof Budget;
                
                // CRITICAL: SPECIAL GRANULAR MERGE FOR ITEMS ARRAY
                if (k === 'items') {
                    const remoteItems = (liveBudget as any).items || [];
                    const localItems = prev.items || [];
                    
                    let itemsMerged = false;
                    const mergedItems = [...localItems];

                    // 1. Process Remote Items (Update or Add)
                    remoteItems.forEach((remoteItem: any) => {
                        const localIdx = mergedItems.findIndex(li => li.id === remoteItem.id);
                        
                        if (localIdx === -1) {
                            // New item added by someone else
                            console.log(`BudgetModal Sync - Adding new remote item: ${remoteItem.id}`);
                            mergedItems.push(remoteItem);
                            itemsMerged = true;
                        } else {
                            const remoteItemStr = stableStringify(remoteItem);
                            const localItemStr = stableStringify(mergedItems[localIdx]);
                            const isCurrentlyDirty = dirtyItemIdsRef.current.has(remoteItem.id);

                            if (isCurrentlyDirty) {
                                // If local item is dirty but now IDENTICAL to remote (e.g. after a save), clear dirty flag
                                if (remoteItemStr === localItemStr) {
                                    console.log(`BudgetModal Sync - Local item ${remoteItem.id} is now in sync. Clearing dirty flag.`);
                                    dirtyItemIdsRef.current.delete(remoteItem.id);
                                }
                                // Otherwise, keep local version since it's dirty
                            } else if (remoteItemStr !== localItemStr) {
                                // Existing item NOT being edited by us and DIFFERENT from remote
                                console.log(`BudgetModal Sync - Updating remote item: ${remoteItem.id}`);
                                mergedItems[localIdx] = remoteItem;
                                itemsMerged = true;
                            }
                        }
                    });

                    // 2. Handle Deletions (Items present locally but gone remotely)
                    // Only remove if NOT locally dirty
                    const remoteIds = new Set(remoteItems.map((ri: any) => ri.id));
                    const filteredItems = mergedItems.filter(li => {
                        if (remoteIds.has(li.id)) return true;
                        if (dirtyItemIdsRef.current.has(li.id)) return true; // Keep local if we are editing it (race condition)
                        
                        console.log(`BudgetModal Sync - Removing item deleted remotely: ${li.id}`);
                        itemsMerged = true;
                        return false;
                    });

                    if (itemsMerged) {
                        merged.items = filteredItems;
                        hasChanges = true;
                    }
                } 
                // ONLY UPDATE OTHER FIELDS WE ARE NOT CURRENTLY EDITING
                else if (!dirtyFieldsRef.current.has(key)) {
                    const storeValueStr = stableStringify((liveBudget as any)[key]);
                    const localValueStr = stableStringify(prev[k]);
                    
                    if (storeValueStr !== localValueStr) {
                        (merged as any)[key] = (liveBudget as any)[key];
                        hasChanges = true;
                    }
                }
            });

            if (!hasChanges) return prev;
            return merged;
        });
        
        lastSavedDataRef.current = storeDataStr;
    }, [storeDataStr, activeBudgetId]);

    // Reset Saved feedback status
    useEffect(() => {
        if (saveStatus === 'saved') {
            const t = setTimeout(() => setSaveStatus('idle'), 3000);
            return () => clearTimeout(t);
        }
    }, [saveStatus]);

    // User Edit Handler
    const handleUpdateField = (field: keyof Budget, value: any) => {
        isDirtyRef.current = true;
        dirtyFieldsRef.current.add(field as string);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Final Unmount Save
    useEffect(() => {
        return () => {
            if (activeBudgetId && isDirtyRef.current && formDataRef.current) {
                updateBudget(activeBudgetId, formDataRef.current);
            }
        };
    }, [activeBudgetId, updateBudget]);


    // Combobox states
    const [cardSearch, setCardSearch] = useState('');
    const [isCardDropdownOpen, setIsCardDropdownOpen] = useState(false);

    const filteredCards = allowedCards.filter(c => c.title.toLowerCase().includes(cardSearch.toLowerCase()) ||
        lists.find(l => l.id === c.listId)?.title.toLowerCase().includes(cardSearch.toLowerCase()));

    const mobileFilteredSuppliers = companies.filter(c => {
        if (c.trashed || c.type !== 'Fornecedor') return false;
        if (!mobileSupplierSearch) return true;
        const term = mobileSupplierSearch.toLowerCase();
        const numericTerm = mobileSupplierSearch.replace(/\D/g, '');
        return (c.nickname || '').toLowerCase().includes(term) ||
               (c.nome_fantasia || '').toLowerCase().includes(term) ||
               c.razao_social.toLowerCase().includes(term) ||
               (numericTerm !== '' && (c.cnpj || '').includes(numericTerm));
    }).sort((a,b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (a.nickname || a.nome_fantasia || a.razao_social).localeCompare(b.nickname || b.nome_fantasia || b.razao_social);
    });

    const mobileFilteredTransporters = companies.filter(c => {
        if (c.trashed || c.type !== 'Transportadora') return false;
        if (!mobileTransporterSearch) return true;
        const term = mobileTransporterSearch.toLowerCase();
        const numericTerm = mobileTransporterSearch.replace(/\D/g, '');
        return (c.nickname || '').toLowerCase().includes(term) ||
               (c.nome_fantasia || '').toLowerCase().includes(term) ||
               c.razao_social.toLowerCase().includes(term) ||
               (numericTerm !== '' && (c.cnpj || '').includes(numericTerm));
    }).sort((a,b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (a.nickname || a.nome_fantasia || a.razao_social).localeCompare(b.nickname || b.nome_fantasia || b.razao_social);
    });

    // Refs for clicking outside
    const cardDropdownRef = useRef<HTMLDivElement>(null);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);
    const transporterDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (cardDropdownRef.current && !cardDropdownRef.current.contains(event.target as Node)) {
                setIsCardDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const calculateTotal = (items: BudgetItem[]) => {
        return items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
    };

    const addItem = () => {
        const newGroup: BudgetItem = {
            id: crypto.randomUUID(),
            companyId: undefined,
            transporterId: undefined,
            validity: '',
            notes: '',
            items: [],
            totalPrice: 0,
            taxValue: 0,
            difalValue: 0,
            finalSellingPrice: 0,
            taxesBreakdown: { pis: 0, cofins: 0, csll: 0, irpj: 0, cpp: 0, iss: 0, icms: 0, ipi: 0, total: 0 }
        };
        // CRITICAL: Mark as DIRTY for the item add too
        isDirtyRef.current = true;
        dirtyFieldsRef.current.add('items');
        // When adding a new quote group, we don't have its ID yet easily in a granular way, 
        // but 'items' being dirty at top level will block the array structure update until save.
        setFormData(prev => {
            const newItems = [...(prev.items || []), newGroup];
            return {
                ...prev,
                items: newItems,
                totalValue: calculateTotal(newItems)
            };
        });
    };

    const addQuoteSubItem = (itemId: string) => {
        setFormData(prev => {
            const newItems = (prev.items || []).map(item => {
                if (item.id === itemId) {
                    const newItem = {
                        id: crypto.randomUUID(),
                        description: '',
                        quantity: 1,
                        unitPrice: 0,
                        totalPrice: 0
                    };
                    return { ...item, items: [...(item.items || []), newItem] };
                }
                return item;
            });
            isDirtyRef.current = true;
            dirtyFieldsRef.current.add('items');
            return { ...prev, items: newItems };
        });
    };

    const removeQuoteSubItem = (itemId: string, subId: string) => {
        setFormData(prev => {
            const newItems = (prev.items || []).map(item => {
                if (item.id === itemId) {
                    const newSubItems = (item.items || []).filter(sub => sub.id !== subId);
                    const totalPrice = newSubItems.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
                    return { ...item, items: newSubItems, totalPrice };
                }
                return item;
            });
            isDirtyRef.current = true;
            dirtyFieldsRef.current.add('items');
            return { ...prev, items: newItems, totalValue: calculateTotal(newItems) };
        });
    };

    const cloneQuoteItem = (id: string) => {
        const itemToClone = formData.items?.find(i => i.id === id);
        if (!itemToClone) return;

        const cloned = {
            ...JSON.parse(JSON.stringify(itemToClone)),
            id: crypto.randomUUID(),
            items: itemToClone.items?.map(sub => ({ ...sub, id: crypto.randomUUID() }))
        };

        setFormData(prev => {
            const newItems = [...(prev.items || []), cloned];
            isDirtyRef.current = true;
            dirtyFieldsRef.current.add('items');
            return {
                ...prev,
                items: newItems,
                totalValue: calculateTotal(newItems)
            };
        });
    };

    const updateQuoteSubItem = (itemId: string, subId: string, field: string, value: any) => {
        setFormData(prev => {
            const newItems = (prev.items || []).map(item => {
                if (item.id === itemId) {
                    const newSubItems = (item.items || []).map(sub => {
                        if (sub.id === subId) {
                            const updated = { ...sub, [field]: value };
                            if (field === 'quantity' || field === 'unitPrice') {
                                updated.totalPrice = Number(updated.quantity || 0) * Number(updated.unitPrice || 0);
                            }
                            return updated;
                        }
                        return sub;
                    });
                    
                    const totalPrice = newSubItems.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
                    return { ...item, items: newSubItems, totalPrice };
                }
                return item;
            });

            isDirtyRef.current = true;
            dirtyFieldsRef.current.add('items');
            dirtyItemIdsRef.current.add(itemId);

            return {
                ...prev,
                items: newItems,
                totalValue: calculateTotal(newItems)
            };
        });
    };

    const updateItemField = (id: string, fieldOrObject: keyof BudgetItem | Partial<BudgetItem>, value?: any, markDirty: boolean = true) => {
        setFormData(prev => {
            if (!canEdit) return prev;
            
            let hasTrueChanges = false;
            const newItems = (prev.items || []).map(group => {
                if (group.id === id) {
                    const changes: any = typeof fieldOrObject === 'string' ? { [fieldOrObject]: value } : fieldOrObject;
                    
                    // Check if there's actually a change to avoid unnecessary renders
                    const willChange = Object.entries(changes).some(([k, v]) => stableStringify(group[k as keyof BudgetItem]) !== stableStringify(v));
                    if (!willChange) return group;

                    hasTrueChanges = true;
                    const updated = { ...group, ...changes };
                    
                    // If 'items' (sub-items) are updated, recalculate totalPrice for the group
                    if (changes.items) {
                        updated.totalPrice = (changes.items as QuotationSubItem[]).reduce((sum, sub) => sum + (sub.totalPrice || 0), 0);
                    }
                    return updated;
                }
                return group;
            });

            if (!hasTrueChanges) return prev;

            if (markDirty) {
                isDirtyRef.current = true;
                dirtyFieldsRef.current.add('items');
                dirtyItemIdsRef.current.add(id);
            }

            return {
                ...prev,
                items: newItems,
                totalValue: calculateTotal(newItems)
            };
        });
    };

    const removeItem = (id: string) => {
        setFormData(prev => {
            const newItems = (prev.items || []).filter(item => item.id !== id);
            return {
                ...prev,
                items: newItems,
                totalValue: calculateTotal(newItems)
            };
        });
        isDirtyRef.current = true;
        dirtyFieldsRef.current.add('items');
        dirtyItemIdsRef.current.add(id);
    };

    const cloneItem = (id: string) => {
        setFormData(prev => {
            const items = prev.items || [];
            const itemToClone = items.find(item => item.id === id);

            if (!itemToClone) return prev;

            // Deep clone to ensure all inner items and inputs get fresh IDs and pure copies
            const clonedItem = {
                ...itemToClone,
                id: crypto.randomUUID(),
                items: (itemToClone.items || []).map(subItem => ({
                    ...subItem,
                    id: crypto.randomUUID()
                }))
            };

            const newItems = [...items, clonedItem];

            return {
                ...prev,
                items: newItems,
                // The total value of the general budget doesn't change by just having a copy of a quote.
                // Only the "cheapest" quote counts for the outer view, so saving the cloned card is enough.
                totalValue: calculateTotal(newItems)
            };
        });
        isDirtyRef.current = true;
        dirtyFieldsRef.current.add('items');
        // Para clone, marcamos apenas 'items' como dirty (estrutura mudou), 
        // o merge de itens existentes continuará funcionando.
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Math for budget mini component:
    const activeQuotes = formData.items?.length || 0;
    const isBudgetEmpty = activeQuotes === 0;

    // Highest / Lowest
    // Change logic: Using `finalSellingPrice` as the main best quote marker instead of cost
    const prices = (formData.items || []).map(i => i.finalSellingPrice || i.totalPrice || 0).filter(v => v > 0);
    const lowestCost = prices.length > 0 ? Math.min(...prices) : 0;
    const highestCost = prices.length > 0 ? Math.max(...prices) : 0;
    const savings = highestCost - lowestCost;

    // Sidebar data
    const expandedQuote = formData.items?.find(i => i.id === expandedQuoteId);
    const supplierProfile = companies.find(c => c.id === expandedQuote?.companyId);
    const transporterProfile = companies.find(c => c.id === expandedQuote?.transporterId);

    return (
        <div className="fixed inset-0 bg-background z-[100] flex flex-col overflow-hidden">
            <div className="bg-background w-full h-full flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-card">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-primary/10 text-primary`}>
                            <Calculator className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold tracking-tight">
                                {budget ? 'Editar Orçamento' : 'Novo Orçamento'}
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-muted-foreground">
                                    {budget ? `ID: ${budget.id}` : 'Rascunho inicial'}
                                </p>
                                {saveStatus !== 'idle' && (
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-in fade-in duration-300",
                                        saveStatus === 'saving' ? "bg-blue-500/10 text-blue-500" :
                                        saveStatus === 'saved' ? "bg-green-500/10 text-green-500" :
                                        "bg-red-500/10 text-red-500"
                                    )}>
                                        {saveStatus === 'saving' ? (
                                            <>
                                                Salvando...
                                            </>
                                        ) : saveStatus === 'saved' ? (
                                            <>
                                                <CheckCircle2 className="h-2.5 w-2.5" />
                                                Salvo no Banco
                                            </>
                                        ) : (
                                            "Erro ao Salvar"
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content Area with Sidebars */}
                <div className="flex-1 flex overflow-hidden relative">
                    {/* Panel de Detalhes da Cotação (Mobile Only) */}
                    {expandedQuoteId && mobileTab === 'details' && (
                        <div className="fixed lg:hidden inset-0 bg-background z-[115] flex flex-col animate-in slide-in-from-bottom-10">
                            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                                    <ClipboardList className="h-4 w-4" /> Detalhes da Cotação
                                </h3>
                                <button onClick={() => setExpandedQuoteId(null)} className="p-2 hover:bg-secondary rounded-full">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                                {/* Supplier & Transporter Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => setMobileTab('supplier')}
                                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-all group"
                                    >
                                        <div className="p-2 rounded-full bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                                            <Building2 className="h-6 w-6" />
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Fornecedor</span>
                                        <span className="text-[10px] text-primary font-medium truncate w-full text-center px-2">
                                            {supplierProfile?.nickname || supplierProfile?.nome_fantasia || 'Não selecionado'}
                                        </span>
                                    </button>

                                    <button 
                                        onClick={() => setMobileTab('transporter')}
                                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-all group"
                                    >
                                        <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform">
                                            <Truck className="h-6 w-6" />
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Transportadora</span>
                                        <span className="text-[10px] text-primary font-medium truncate w-full text-center px-2">
                                            {transporterProfile?.nickname || transporterProfile?.nome_fantasia || 'FOB / Incluso'}
                                        </span>
                                    </button>
                                </div>

                                {/* Financial Summary Mobile (EDITABLE) */}
                                <div className="space-y-3 bg-card border border-border rounded-xl p-4 shadow-sm">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center justify-between border-b border-border pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <DollarSign className="h-3 w-3" /> Resumo Financeiro
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-1.5 cursor-pointer lowercase font-normal italic">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!expandedQuote?.hasCashDiscount}
                                                    onChange={(e) => updateItemField(expandedQuote?.id as string, 'hasCashDiscount', e.target.checked)}
                                                    className="h-3 w-3 accent-green-600"
                                                />
                                                Desc. à vista?
                                            </label>
                                        </div>
                                    </h4>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">Custo Total (Fornecedor)</span>
                                            <span className="font-mono font-bold">{formatCurrency(expandedQuote?.totalPrice || 0)}</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold uppercase text-muted-foreground block">Vl. Frete (R$)</label>
                                                <input 
                                                    type="number"
                                                    disabled={!canEdit}
                                                    value={expandedQuote?.freightValue || ''}
                                                    onChange={(e) => updateItemField(expandedQuote?.id as string, 'freightValue', Number(e.target.value))}
                                                    className="w-full bg-secondary/20 border border-border rounded p-2 text-xs font-mono font-bold"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold uppercase text-muted-foreground block">Margem de Lucro (%)</label>
                                                <input 
                                                    type="number"
                                                    disabled={!canEdit}
                                                    value={expandedQuote?.profitMargin || ''}
                                                    onChange={(e) => updateItemField(expandedQuote?.id as string, 'profitMargin', Number(e.target.value))}
                                                    className="w-full bg-secondary/20 border border-border rounded p-2 text-xs font-mono font-bold"
                                                    placeholder="20%"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">Total Impostos Estimados</span>
                                            <span className="font-mono text-destructive">{formatCurrency(expandedQuote?.taxValue || 0)}</span>
                                        </div>

                                        <div className="pt-2 border-t border-border flex justify-between items-center">
                                            <span className="text-sm font-bold">PREÇO FINAL DE VENDA</span>
                                            <span className="text-lg font-mono font-bold text-primary">{formatCurrency(expandedQuote?.finalSellingPrice || 0)}</span>
                                        </div>
                                        
                                        {/* Profit Badge */}
                                        {(() => {
                                            const sell = expandedQuote?.finalSellingPrice || expandedQuote?.totalPrice || 0;
                                            const cost = expandedQuote?.totalPrice || 0;
                                            const tax = expandedQuote?.taxValue || 0;
                                            const difal = expandedQuote?.difalValue || 0;
                                            const profitAmount = sell - cost - tax - difal;
                                            const profitPercentage = sell > 0 ? (profitAmount / sell) * 100 : 0;
                                            const isLoss = profitAmount < 0;

                                            if (sell === 0) return null;

                                            return (
                                                <div className={cn(
                                                    "w-full py-2 rounded-lg text-center font-bold text-xs uppercase tracking-widest mt-2",
                                                    !isLoss ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                                                )}>
                                                    {!isLoss ? 'Lucro Bruto: ' : 'Prejuízo Bruto: '}
                                                    {profitPercentage.toFixed(1)}% ({formatCurrency(profitAmount)})
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Items List Mobile (EDITABLE) */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-border pb-2">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                            <Package className="h-3 w-3" /> Itens da Cotação ({expandedQuote?.items?.length || 0})
                                        </h4>
                                        {canEdit && (
                                            <button 
                                                onClick={() => addQuoteSubItem(expandedQuote?.id as string)}
                                                className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md active:scale-95 transition-all flex items-center gap-1"
                                            >
                                                <Plus className="h-3 w-3" /> ADICIONAR ITEM
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        {(expandedQuote?.items || []).map((subI: any, sIdx: number) => (
                                            <div key={subI.id} className="bg-secondary/20 border border-border/50 rounded-xl p-3 space-y-3 relative group">
                                                {canEdit && (
                                                    <button 
                                                        onClick={() => removeQuoteSubItem(expandedQuote?.id as string, subI.id)}
                                                        className="absolute top-2 right-2 p-1.5 text-destructive rounded hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                <div className="space-y-1 pr-6">
                                                    <label className="text-[9px] uppercase font-bold text-muted-foreground">Descrição do Item #{sIdx + 1}</label>
                                                    <input 
                                                        disabled={!canEdit}
                                                        value={subI.description}
                                                        onChange={(e) => updateQuoteSubItem(expandedQuote?.id as string, subI.id, 'description', e.target.value)}
                                                        className="w-full bg-background border border-border rounded text-xs p-1.5"
                                                        placeholder="Ex: Nome do produto..."
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 pb-1">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] uppercase font-bold text-muted-foreground">Qtd</label>
                                                        <input 
                                                            type="number"
                                                            disabled={!canEdit}
                                                            value={subI.quantity}
                                                            onChange={(e) => updateQuoteSubItem(expandedQuote?.id as string, subI.id, 'quantity', Number(e.target.value))}
                                                            className="w-full bg-background border border-border rounded text-xs p-1.5 font-mono"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] uppercase font-bold text-muted-foreground">P. Unit (R$)</label>
                                                        <input 
                                                            type="number"
                                                            disabled={!canEdit}
                                                            value={subI.unitPrice}
                                                            onChange={(e) => updateQuoteSubItem(expandedQuote?.id as string, subI.id, 'unitPrice', Number(e.target.value))}
                                                            className="w-full bg-background border border-border rounded text-xs p-1.5 font-mono"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Additional Info (EDITABLE) */}
                                <div className="space-y-4 pt-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                                        <Info className="h-3 w-3" /> Condições Gerais
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <span className="block text-[9px] font-bold text-muted-foreground uppercase">Cond. Pagamento</span>
                                            <select 
                                                disabled={!canEdit}
                                                value={expandedQuote?.paymentTerms || ''}
                                                onChange={(e) => updateItemField(expandedQuote?.id as string, 'paymentTerms', e.target.value)}
                                                className="w-full bg-secondary/10 border border-border/40 rounded text-xs p-1.5"
                                            >
                                                <option value="">Não inf.</option>
                                                <option value="À vista">À vista</option>
                                                <option value="Boleto">Boleto</option>
                                                <option value="PIX">PIX</option>
                                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                                <option value="Transferência Bancária">Transferência</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="block text-[9px] font-bold text-muted-foreground uppercase">Validade</span>
                                            <input 
                                                disabled={!canEdit}
                                                value={expandedQuote?.validity || ''}
                                                onChange={(e) => updateItemField(expandedQuote?.id as string, 'validity', e.target.value)}
                                                className="w-full bg-secondary/10 border border-border/40 rounded text-xs p-1.5"
                                                placeholder="ex: 15 dias"
                                            />
                                        </div>
                                    </div>

                                    {/* Parcelas Condicionais */}
                                    {['Cartão de Crédito', 'Boleto'].includes(expandedQuote?.paymentTerms || '') && (
                                        <div className="space-y-1 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg animate-in fade-in">
                                            <label className="text-[9px] font-bold uppercase text-orange-600 block">Número de Parcelas</label>
                                            <input 
                                                type="number"
                                                min="1"
                                                disabled={!canEdit}
                                                value={expandedQuote?.installmentsCount || ''}
                                                onChange={(e) => updateItemField(expandedQuote?.id as string, 'installmentsCount', Number(e.target.value))}
                                                className="w-full bg-background border border-orange-500/20 rounded p-2 text-xs font-mono font-bold"
                                                placeholder="Ex: 5"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <span className="block text-[9px] font-bold text-muted-foreground uppercase">Data Entrega</span>
                                            <input 
                                                type="date"
                                                disabled={!canEdit}
                                                value={expandedQuote?.deliveryDate || ''}
                                                onChange={(e) => updateItemField(expandedQuote?.id as string, 'deliveryDate', e.target.value)}
                                                className="w-full bg-secondary/10 border border-border/40 rounded text-xs p-1.5"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="block text-[9px] font-bold text-muted-foreground uppercase">Garantia</span>
                                            <input 
                                                disabled={!canEdit}
                                                value={expandedQuote?.warrantyDays || ''}
                                                onChange={(e) => updateItemField(expandedQuote?.id as string, 'warrantyDays', e.target.value)}
                                                className="w-full bg-secondary/10 border border-border/40 rounded text-xs p-1.5"
                                                placeholder="Padrão"
                                            />
                                        </div>
                                    </div>

                                    {/* Mobile Checkboxes Section */}
                                    <div className="space-y-2 bg-secondary/20 p-3 rounded-xl border border-border/50">
                                        <span className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">Checkboxes Adicionais</span>
                                        <div className="flex flex-col gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-background/40 rounded transition-colors border border-transparent hover:border-border/30">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!expandedQuote?.hasInsurance}
                                                    onChange={(e) => updateItemField(expandedQuote?.id as string, 'hasInsurance', e.target.checked)}
                                                    className="h-4 w-4 accent-primary"
                                                />
                                                <span className="text-[11px] font-medium text-muted-foreground">Seguro de Carga</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-background/40 rounded transition-colors border border-transparent hover:border-border/30">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!expandedQuote?.hasServiceContract}
                                                    onChange={(e) => updateItemField(expandedQuote?.id as string, 'hasServiceContract', e.target.checked)}
                                                    className="h-4 w-4 accent-primary"
                                                />
                                                <span className="text-[11px] font-medium text-muted-foreground">Fornece Contrato Serviço</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-background/40 rounded transition-colors border border-transparent hover:border-border/30">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!expandedQuote?.emitsResaleInvoice}
                                                    onChange={(e) => updateItemField(expandedQuote?.id as string, 'emitsResaleInvoice', e.target.checked)}
                                                    className="h-4 w-4 accent-primary"
                                                />
                                                <span className="text-[11px] font-medium text-muted-foreground">Emite NF de Revenda?</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="space-y-1 mt-2">
                                        <span className="block text-[10px] font-bold text-muted-foreground uppercase">Observações:</span>
                                        <textarea 
                                            disabled={!canEdit}
                                            value={expandedQuote?.notes || ''}
                                            onChange={(e) => updateItemField(expandedQuote?.id as string, 'notes', e.target.value)}
                                            className="w-full bg-yellow-500/5 border border-yellow-500/20 p-3 rounded-lg text-xs italic leading-relaxed min-h-[80px]"
                                            placeholder="Adicione observações para esta cotação..."
                                        />
                                    </div>

                                    {/* Danger Zone Actions Mobile */}
                                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border mt-4">
                                        <button 
                                            onClick={() => cloneQuoteItem(expandedQuote?.id as string)}
                                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-secondary/80 text-[10px] font-bold uppercase rounded-lg border border-border active:scale-95 transition-all text-muted-foreground"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> CLONAR
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if(confirm('Tem certeza que deseja excluir esta cotação?')) {
                                                    removeItem(expandedQuote?.id as string);
                                                    setExpandedQuoteId(null);
                                                }
                                            }}
                                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-red-500/10 text-red-600 text-[10px] font-bold uppercase rounded-lg border border-red-500/20 active:scale-95 transition-all"
                                        >
                                            <Trash2 className="h-4 w-4" /> EXCLUIR
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-border bg-card">
                                <button 
                                    onClick={() => setExpandedQuoteId(null)}
                                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-[0.98]"
                                >
                                    VOLTAR PARA O ORÇAMENTO
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Left Sidebar (Supplier) */}
                    {expandedQuoteId && (expandedQuoteId !== null && (mobileTab === 'supplier' || window.innerWidth >= 1024)) && (
                        <div className={cn(
                            "fixed lg:relative inset-y-0 left-0 w-full sm:w-80 lg:w-96 border-r border-border bg-background lg:bg-secondary/10 p-5 overflow-y-auto custom-scrollbar shrink-0 flex flex-col gap-4 shadow-xl lg:shadow-[inset_-10px_0_20px_-20px_rgba(0,0,0,0.1)] z-[110] lg:z-0 transition-all animate-in",
                            mobileTab === 'supplier' ? "slide-in-from-left-8" : "hidden lg:flex"
                        )}>
                            <div className="flex items-center justify-between lg:hidden mb-2">
                                <button onClick={() => setMobileTab('details')} className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform">
                                    <ChevronLeft className="h-4 w-4" /> VOLTAR AOS DETALHES
                                </button>
                                <button onClick={() => setExpandedQuoteId(null)} className="p-2 hover:bg-secondary rounded-full">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                                    <Building2 className="h-4 w-4" /> Perfil do Fornecedor
                                </h3>
                                <button 
                                    onClick={() => setIsChangingSupplier(!isChangingSupplier)}
                                    className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold uppercase tracking-wider hover:bg-primary/20 transition-all"
                                >
                                    {isChangingSupplier ? 'CANCELAR' : 'TROCAR'}
                                </button>
                            </div>

                            {isChangingSupplier ? (
                                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                                        <input 
                                            autoFocus
                                            value={mobileSupplierSearch}
                                            onChange={(e) => setMobileSupplierSearch(e.target.value)}
                                            placeholder="Buscar fornecedor..."
                                            className="w-full bg-secondary/30 border-none rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                                        {mobileFilteredSuppliers.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-10 italic">Nenhum fornecedor encontrado.</p>
                                        ) : (
                                            mobileFilteredSuppliers.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        updateItemField(expandedQuote?.id as string, 'companyId', c.id);
                                                        setIsChangingSupplier(false);
                                                        setMobileSupplierSearch('');
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-all text-left group"
                                                >
                                                    {c.customLink && (
                                                        <img src={getFaviconUrl(c.customLink)} alt="" className="w-8 h-8 rounded shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="text-xs font-bold text-foreground truncate group-hover:text-primary">{c.nickname || c.nome_fantasia || c.razao_social}</h5>
                                                        <p className="text-[10px] text-muted-foreground truncate">{c.cnpj ? c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : (c.municipio || 'Sem CNPJ')}</p>
                                                    </div>
                                                    {c.isFavorite && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : supplierProfile ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        {supplierProfile.customLink && (
                                            <img
                                                src={getFaviconUrl(supplierProfile.customLink)}
                                                alt=""
                                                className="w-10 h-10 rounded-md shrink-0"
                                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                            />
                                        )}
                                        <div>
                                            <h4 className="font-bold text-foreground text-sm">{supplierProfile.nickname || supplierProfile.nome_fantasia || supplierProfile.razao_social}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">{supplierProfile.razao_social}</p>
                                        </div>
                                    </div>

                                    {supplierProfile.customLink && (
                                        <a href={supplierProfile.customLink} target="_blank" rel="noopener noreferrer" className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors">
                                            <ExternalLink className="w-3.5 h-3.5" /> Acessar Link Externo
                                        </a>
                                    )}

                                    <div className="space-y-2 text-xs">
                                        {supplierProfile.cnpj && (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">CNPJ</span>
                                                <span className="font-mono">{supplierProfile.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>
                                            </div>
                                        )}
                                        {(supplierProfile.logradouro || supplierProfile.municipio) && (
                                            <div className="flex flex-col">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Endereço Completo</span>
                                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${supplierProfile.logradouro || ''} ${supplierProfile.numero || ''} ${supplierProfile.bairro || ''} ${supplierProfile.municipio || ''} ${supplierProfile.uf || ''} ${supplierProfile.cep || ''}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 transition-colors">
                                                        <MapPin className="h-3 w-3" /> Ver no mapa
                                                    </a>
                                                </div>
                                                <span className="leading-tight mt-0.5">
                                                    {supplierProfile.logradouro}{supplierProfile.numero ? `, ${supplierProfile.numero}` : ''}{supplierProfile.complemento ? ` - ${supplierProfile.complemento}` : ''}
                                                    <br />
                                                    {supplierProfile.bairro && `${supplierProfile.bairro} - `}
                                                    {supplierProfile.municipio} - {supplierProfile.uf}
                                                    <br />
                                                    {supplierProfile.cep && `CEP: ${supplierProfile.cep}`}
                                                </span>
                                            </div>
                                        )}
                                        {supplierProfile.email && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">E-mails</span>
                                                {supplierProfile.email.split(/[,;/]+/).map(e => e.trim()).filter(Boolean).map((em, idx) => (
                                                    <div key={idx} className="flex items-center justify-between gap-2 bg-secondary/10 p-1.5 rounded border border-border/50">
                                                        <span className="truncate text-xs" title={em}>{em}</span>
                                                        <a href={`mailto:${em}`} className="shrink-0 p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded transition-colors" title="Enviar E-mail">
                                                            <Mail className="h-3.5 w-3.5" />
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {(supplierProfile.ddd_telefone_1 || supplierProfile.ddd_telefone_2) && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Telefones</span>
                                                {supplierProfile.ddd_telefone_1 && (
                                                    <div className="flex items-center justify-between gap-2 bg-secondary/10 p-1.5 rounded border border-border/50">
                                                        <span className="text-xs">{supplierProfile.ddd_telefone_1}</span>
                                                        <div className="flex gap-1 shrink-0">
                                                            <a href={`https://wa.me/55${supplierProfile.ddd_telefone_1.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded transition-colors" title="WhatsApp">
                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                            </a>
                                                            <a href={`tel:${supplierProfile.ddd_telefone_1.replace(/\D/g, '')}`} className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors" title="Ligar">
                                                                <Phone className="h-3.5 w-3.5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                {supplierProfile.ddd_telefone_2 && (
                                                    <div className="flex items-center justify-between gap-2 bg-secondary/10 p-1.5 rounded border border-border/50">
                                                        <span className="text-xs">{supplierProfile.ddd_telefone_2}</span>
                                                        <div className="flex gap-1 shrink-0">
                                                            <a href={`https://wa.me/55${supplierProfile.ddd_telefone_2.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded transition-colors" title="WhatsApp">
                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                            </a>
                                                            <a href={`tel:${supplierProfile.ddd_telefone_2.replace(/\D/g, '')}`} className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors" title="Ligar">
                                                                <Phone className="h-3.5 w-3.5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {supplierProfile.areasAtuacao && supplierProfile.areasAtuacao.length > 0 && (
                                        <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Áreas de Atuação</span>
                                            <div className="flex flex-wrap gap-1">
                                                {supplierProfile.areasAtuacao.map(area => (
                                                    <span key={area} className="text-[9px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border/50">
                                                        {area}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {supplierProfile.contacts && supplierProfile.contacts.length > 0 && (
                                        <div className="flex flex-col gap-2 pt-2 border-t border-border">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Contatos Adicionais</span>
                                            {supplierProfile.contacts.map(c => (
                                                <div key={c.id} className="text-[11px] bg-background border border-border rounded p-2 flex flex-col gap-1">
                                                    <span className="font-bold flex items-center justify-between">
                                                        {c.label}
                                                        <div className="flex gap-1">
                                                            {c.phone && <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1 hover:bg-green-500/20 text-green-600 rounded"><MessageCircle className="h-3 w-3" /></a>}
                                                            {c.email && <a href={`mailto:${c.email}`} className="p-1 hover:bg-blue-500/20 text-blue-600 rounded"><Mail className="h-3 w-3" /></a>}
                                                        </div>
                                                    </span>
                                                    {c.email && <span className="text-muted-foreground truncate" title={c.email}>{c.email}</span>}
                                                    {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {supplierProfile.comments && (
                                        <div className="flex flex-col gap-2 pt-2 border-t border-border">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Observações do Cadastro</span>
                                            <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-background border border-border/50 rounded p-2">
                                                {supplierProfile.comments}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic text-center mt-10">
                                    Nenhum fornecedor selecionado para esta cotação.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Main Center */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">

                            {/* Top Area (Main Info) */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border pb-2">
                                        <FileText className="h-4 w-4 text-primary" /> Informações Básicas
                                    </h3>

                                    <div className="space-y-2 relative" ref={cardDropdownRef}>
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cartão Referente (opcional)</label>
                                            {formData.cardId && (
                                                <button
                                                    onClick={() => {
                                                        const card = cards.find(c => c.id === formData.cardId);
                                                        if (card) {
                                                            const list = lists.find(l => l.id === card.listId);
                                                            if (list) {
                                                                // Close modal and navigate
                                                                onClose();
                                                                navigate(`/board/${list.boardId}?cardId=${card.id}`);
                                                            }
                                                        }
                                                    }}
                                                    className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors font-bold flex items-center gap-1"
                                                >
                                                    <ExternalLink className="h-2.5 w-2.5" /> ACESSAR CARTÃO
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setIsCardDropdownOpen(!isCardDropdownOpen)}
                                            disabled={!canEdit}
                                            className="w-full bg-secondary border border-border/50 rounded-lg px-4 py-2 text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary/20 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="truncate">
                                                {formData.cardId
                                                    ? cards.find(c => c.id === formData.cardId)?.title
                                                    : "Nenhum (Avulso)"}
                                            </span>
                                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                        </button>

                                        {isCardDropdownOpen && (
                                            <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                                                <div className="p-2 border-b border-border flex items-center gap-2">
                                                    <Search className="h-4 w-4 text-muted-foreground opacity-50 shrink-0" />
                                                    <input
                                                        autoFocus
                                                        value={cardSearch}
                                                        onChange={e => setCardSearch(e.target.value)}
                                                        placeholder="Buscar cartões..."
                                                        autoComplete="off"
                                                        spellCheck="false"
                                                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                                    />
                                                </div>
                                                <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
                                                    <button
                                                        onClick={() => {
                                                            handleUpdateField('cardId', undefined);
                                                            setIsCardDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary ${!formData.cardId ? 'bg-primary/10 text-primary font-medium' : ''}`}
                                                    >
                                                        Nenhum (Avulso)
                                                    </button>
                                                    {filteredCards.length === 0 ? (
                                                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum cartão encontrado.</p>
                                                    ) : (
                                                        filteredCards.map(c => {
                                                            const list = lists.find(l => l.id === c.listId);
                                                            const board = list ? boards.find(b => b.id === list.boardId) : null;
                                                            return (
                                                                <button
                                                                    key={c.id}
                                                                    onClick={() => {
                                                                        handleUpdateField('cardId', c.id);
                                                                        handleUpdateField('title', c.title);
                                                                        setIsCardDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left flex flex-col px-3 py-2 rounded-md transition-colors hover:bg-secondary ${formData.cardId === c.id ? 'bg-primary/10 text-primary font-medium' : 'text-sm'}`}
                                                                >
                                                                    <span>{c.title}</span>
                                                                    {board && <span className="text-[10px] text-muted-foreground mt-0.5">{board.name} {' > '} {list?.title}</span>}
                                                                </button>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título do Orçamento</label>
                                        <input
                                            value={formData.title}
                                            onChange={e => handleUpdateField('title', e.target.value)}
                                            disabled={!canEdit}
                                            placeholder="Ex: Aquisição de Computadores Desktop"
                                            className="w-full bg-secondary border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                                            <input
                                                value={formData.address || ''}
                                                onChange={e => handleUpdateField('address', e.target.value)}
                                                disabled={!canEdit}
                                                placeholder="Endereço para entrega ou referência..."
                                                className="w-full bg-secondary border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prazo de Entrega</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                                            <input
                                                value={formData.deliveryTime || ''}
                                                onChange={e => handleUpdateField('deliveryTime', e.target.value)}
                                                disabled={!canEdit}
                                                placeholder="Ex: 5 dias úteis, Imediato, etc."
                                                className="w-full bg-secondary border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</label>
                                            <select
                                                value={formData.type}
                                                onChange={e => handleUpdateField('type', e.target.value as BudgetType)}
                                                disabled={!canEdit}
                                                className="w-full bg-secondary border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <option value="Produto">Produto</option>
                                                <option value="Serviço">Serviço</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                                            <select
                                                value={formData.status}
                                                onChange={e => handleUpdateField('status', e.target.value as BudgetStatus)}
                                                disabled={!canEdit}
                                                className="w-full bg-secondary border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <option value="Aguardando">Aguardando</option>
                                                <option value="Cotado">Cotado</option>
                                                <option value="Aprovado">Aprovado</option>
                                                <option value="Recusado">Recusado</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-border pb-2 mt-6">
                                        <h3 className="text-sm font-semibold flex items-center gap-2">
                                            <Calculator className="h-4 w-4 text-primary" /> Cotações
                                        </h3>
                                        {canEdit && (
                                            <button onClick={addItem} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                                                <Plus className="h-3.5 w-3.5" /> Adicionar cotação
                                            </button>
                                        )}
                                    </div>

                                    {formData.items?.length === 0 ? (
                                        <div className="text-center py-8 bg-secondary/50 rounded-lg border border-dashed border-border">
                                            <Calculator className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                            <p className="text-sm text-muted-foreground">Nenhuma cotação adicionada a este orçamento.</p>
                                            {canEdit && (
                                                <button onClick={addItem} className="mt-3 text-xs font-medium text-primary hover:underline">
                                                    Adicionar a primeira cotação
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {[...(formData.items || [])].sort((a, b) => {
                                                if (a.isFavorite && !b.isFavorite) return -1;
                                                if (!a.isFavorite && b.isFavorite) return 1;
                                                return (a.totalPrice || 0) - (b.totalPrice || 0);
                                            }).map((item, idx) => (
                                                <QuotationItemCard
                                                    key={item.id}
                                                    item={item}
                                                    budgetType={formData.type as BudgetType}
                                                    totalQuotes={formData.items?.length || 0}
                                                    highestCost={highestCost}
                                                    lowestCost={lowestCost}
                                                    companies={companies}
                                                    mainCompanies={mainCompanies}
                                                    updateItem={updateItemField}
                                                    removeItem={removeItem}
                                                    cloneItem={cloneItem}
                                                    formatCurrency={formatCurrency}
                                                    isExpanded={expandedQuoteId === item.id}
                                                    onToggleExpand={() => {
                                                        const newVal = expandedQuoteId === item.id ? null : item.id;
                                                        setExpandedQuoteId(newVal);
                                                        if (newVal) setMobileTab('details'); // Reset para 'detalhes' ao abrir nova cotação
                                                    }}
                                                    canEdit={!!canEdit}
                                                />
                                            ))}

                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Right Sidebar (Transporter) */}
                    {expandedQuoteId && (expandedQuoteId !== null && (mobileTab === 'transporter' || window.innerWidth >= 1024)) && (
                        <div className={cn(
                            "fixed lg:relative inset-y-0 right-0 w-full sm:w-80 lg:w-96 border-l border-border bg-background lg:bg-secondary/10 p-5 overflow-y-auto custom-scrollbar shrink-0 flex flex-col gap-4 shadow-xl lg:shadow-[inset_10px_0_20px_-20px_rgba(0,0,0,0.1)] z-[110] lg:z-0 transition-all animate-in",
                            mobileTab === 'transporter' ? "slide-in-from-right-8" : "hidden lg:flex"
                        )}>
                            <div className="flex items-center justify-between lg:hidden mb-2">
                                <button onClick={() => setMobileTab('details')} className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform">
                                    <ChevronLeft className="h-4 w-4" /> VOLTAR AOS DETALHES
                                </button>
                                <button onClick={() => setExpandedQuoteId(null)} className="p-2 hover:bg-secondary rounded-full">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                                    <Truck className="h-4 w-4" /> Perfil Transportadora
                                </h3>
                                <button 
                                    onClick={() => setIsChangingTransporter(!isChangingTransporter)}
                                    className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold uppercase tracking-wider hover:bg-primary/20 transition-all"
                                >
                                    {isChangingTransporter ? 'CANCELAR' : 'TROCAR'}
                                </button>
                            </div>

                            {isChangingTransporter ? (
                                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                                        <input 
                                            autoFocus
                                            value={mobileTransporterSearch}
                                            onChange={(e) => setMobileTransporterSearch(e.target.value)}
                                            placeholder="Buscar transportadora..."
                                            className="w-full bg-secondary/30 border-none rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                                        <button
                                            onClick={() => {
                                                updateItemField(expandedQuote?.id as string, 'transporterId', undefined);
                                                setIsChangingTransporter(false);
                                                setMobileTransporterSearch('');
                                            }}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-secondary/10 hover:border-primary/50 transition-all text-left group"
                                        >
                                            <Truck className="h-8 w-8 text-muted-foreground opacity-50" />
                                            <div className="flex-1 min-w-0">
                                                <h5 className="text-xs font-bold text-foreground truncate group-hover:text-primary">Nenhuma (Incluso / FOB)</h5>
                                                <p className="text-[10px] text-muted-foreground">Remover transportadora selecionada</p>
                                            </div>
                                        </button>
                                        {mobileFilteredTransporters.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-10 italic">Nenhuma transportadora encontrada.</p>
                                        ) : (
                                            mobileFilteredTransporters.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        updateItemField(expandedQuote?.id as string, 'transporterId', c.id);
                                                        setIsChangingTransporter(false);
                                                        setMobileTransporterSearch('');
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-all text-left group"
                                                >
                                                    {c.customLink && (
                                                        <img src={getFaviconUrl(c.customLink)} alt="" className="w-8 h-8 rounded shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="text-xs font-bold text-foreground truncate group-hover:text-primary">{c.nickname || c.nome_fantasia || c.razao_social}</h5>
                                                        <p className="text-[10px] text-muted-foreground truncate">{c.cnpj ? c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : (c.municipio || 'Sem CNPJ')}</p>
                                                    </div>
                                                    {c.isFavorite && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : transporterProfile ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        {transporterProfile.customLink && (
                                            <img
                                                src={getFaviconUrl(transporterProfile.customLink)}
                                                alt=""
                                                className="w-10 h-10 rounded-md shrink-0"
                                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                            />
                                        )}
                                        <div>
                                            <h4 className="font-bold text-foreground text-sm">{transporterProfile.nickname || transporterProfile.nome_fantasia || transporterProfile.razao_social}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">{transporterProfile.razao_social}</p>
                                        </div>
                                    </div>

                                    {transporterProfile.customLink && (
                                        <a href={transporterProfile.customLink} target="_blank" rel="noopener noreferrer" className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors">
                                            <ExternalLink className="w-3.5 h-3.5" /> Acessar Link Externo
                                        </a>
                                    )}

                                    <div className="space-y-2 text-xs">
                                        {transporterProfile.cnpj && (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">CNPJ</span>
                                                <span className="font-mono">{transporterProfile.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>
                                            </div>
                                        )}
                                        {(transporterProfile.logradouro || transporterProfile.municipio) && (
                                            <div className="flex flex-col">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Endereço Completo</span>
                                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${transporterProfile.logradouro || ''} ${transporterProfile.numero || ''} ${transporterProfile.bairro || ''} ${transporterProfile.municipio || ''} ${transporterProfile.uf || ''} ${transporterProfile.cep || ''}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 transition-colors">
                                                        <MapPin className="h-3 w-3" /> Ver no mapa
                                                    </a>
                                                </div>
                                                <span className="leading-tight mt-0.5">
                                                    {transporterProfile.logradouro}{transporterProfile.numero ? `, ${transporterProfile.numero}` : ''}{transporterProfile.complemento ? ` - ${transporterProfile.complemento}` : ''}
                                                    <br />
                                                    {transporterProfile.bairro && `${transporterProfile.bairro} - `}
                                                    {transporterProfile.municipio} - {transporterProfile.uf}
                                                    <br />
                                                    {transporterProfile.cep && `CEP: ${transporterProfile.cep}`}
                                                </span>
                                            </div>
                                        )}
                                        {transporterProfile.email && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">E-mails</span>
                                                {transporterProfile.email.split(/[,;/]+/).map(e => e.trim()).filter(Boolean).map((em, idx) => (
                                                    <div key={idx} className="flex items-center justify-between gap-2 bg-secondary/10 p-1.5 rounded border border-border/50">
                                                        <span className="truncate text-xs" title={em}>{em}</span>
                                                        <a href={`mailto:${em}`} className="shrink-0 p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded transition-colors" title="Enviar E-mail">
                                                            <Mail className="h-3.5 w-3.5" />
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {(transporterProfile.ddd_telefone_1 || transporterProfile.ddd_telefone_2) && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Telefones</span>
                                                {transporterProfile.ddd_telefone_1 && (
                                                    <div className="flex items-center justify-between gap-2 bg-secondary/10 p-1.5 rounded border border-border/50">
                                                        <span className="text-xs">{transporterProfile.ddd_telefone_1}</span>
                                                        <div className="flex gap-1 shrink-0">
                                                            <a href={`https://wa.me/55${transporterProfile.ddd_telefone_1.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded transition-colors" title="WhatsApp">
                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                            </a>
                                                            <a href={`tel:${transporterProfile.ddd_telefone_1.replace(/\D/g, '')}`} className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors" title="Ligar">
                                                                <Phone className="h-3.5 w-3.5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                {transporterProfile.ddd_telefone_2 && (
                                                    <div className="flex items-center justify-between gap-2 bg-secondary/10 p-1.5 rounded border border-border/50">
                                                        <span className="text-xs">{transporterProfile.ddd_telefone_2}</span>
                                                        <div className="flex gap-1 shrink-0">
                                                            <a href={`https://wa.me/55${transporterProfile.ddd_telefone_2.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded transition-colors" title="WhatsApp">
                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                            </a>
                                                            <a href={`tel:${transporterProfile.ddd_telefone_2.replace(/\D/g, '')}`} className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors" title="Ligar">
                                                                <Phone className="h-3.5 w-3.5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Rotas de Atuacao */}
                                    {routes && (() => {
                                        const transporterRoutes = routes.filter(r => r.transporterIds.includes(transporterProfile.id));
                                        if (transporterRoutes.length === 0) return null;
                                        return (
                                            <div className="flex flex-col gap-2 pt-2 border-t border-border">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Rotas de Atuação</span>
                                                <div className="flex flex-col gap-1.5">
                                                    {transporterRoutes.map((route) => {
                                                        const rank = route.transporterIds.indexOf(transporterProfile.id) + 1;
                                                        return (
                                                            <div key={route.id} className="flex justify-between items-center bg-background border border-border/50 rounded px-2 py-1.5">
                                                                <span className="text-[11px] font-medium">{route.name}</span>
                                                                <span className="text-[9px] bg-primary/10 text-primary uppercase font-bold px-1.5 py-0.5 rounded shadow-sm">
                                                                    Rank #{rank}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {transporterProfile.contacts && transporterProfile.contacts.length > 0 && (
                                        <div className="flex flex-col gap-2 pt-2 border-t border-border">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Contatos Adicionais</span>
                                            {transporterProfile.contacts.map(c => (
                                                <div key={c.id} className="text-[11px] bg-background border border-border rounded p-2 flex flex-col gap-1">
                                                    <span className="font-bold flex items-center justify-between">
                                                        {c.label}
                                                        <div className="flex gap-1">
                                                            {c.phone && <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1 hover:bg-green-500/20 text-green-600 rounded"><MessageCircle className="h-3 w-3" /></a>}
                                                            {c.email && <a href={`mailto:${c.email}`} className="p-1 hover:bg-blue-500/20 text-blue-600 rounded"><Mail className="h-3 w-3" /></a>}
                                                        </div>
                                                    </span>
                                                    {c.email && <span className="text-muted-foreground truncate" title={c.email}>{c.email}</span>}
                                                    {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {transporterProfile.comments && (
                                        <div className="flex flex-col gap-2 pt-2 border-t border-border">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Observações do Cadastro</span>
                                            <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-background border border-border/50 rounded p-2">
                                                {transporterProfile.comments}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic text-center mt-10">
                                    Nenhuma transportadora selecionada para esta cotação (FOB/Incluso).
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer (Removido - Será trocado pelo Auto-Save) */}
                <div className="flex justify-end p-6 border-t border-border mt-2 bg-secondary/10">
                    {/* Actions will be replaced or omitted depending on the exact UX need - For now just spacing */}
                </div>
            </div>
        </div>
    );
};

export default BudgetModal;
