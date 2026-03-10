import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useKanbanStore } from '@/store/kanban-store';
import { Search, MapPin, Phone, Mail, Globe, Calendar, Star, Trash2, Building2, Truck, Copy, Check, Link2, ExternalLink, Heart, Briefcase, Plus, X, MessageSquare, Info, Filter, ChevronDown, ChevronUp, GripVertical, ArchiveRestore, RefreshCcw, ArrowUp, ArrowDown, ChevronLeft } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { CompanyContact } from '@/types/kanban';
interface CompanyListPageProps {
    type: 'Fornecedor' | 'Transportadora';
}

const CompanyListPage = ({ type }: CompanyListPageProps) => {
    const { companies, budgets = [], removeCompany, updateCompany, routes = [], addRoute, updateRoute, deleteRoute, restoreRoute, permanentlyDeleteRoute } = useKanbanStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlId = searchParams.get('id');
    const tabOption = searchParams.get('tab');
    const { currentUser } = useAuthStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    // Initial URL Selection
    useEffect(() => {
        if (urlId && companies.some(c => c.id === urlId && c.type === type && !c.trashed)) {
            setSelectedCompanyId(urlId);
            // Optional: clean up the URL after selecting
            // setSearchParams({});
        }
    }, [urlId, companies, type]);

    // Route management state
    const [isCreatingRoute, setIsCreatingRoute] = useState(false);
    const [newRouteOrigin, setNewRouteOrigin] = useState('');
    const [newRouteDest, setNewRouteDest] = useState('');
    const [newRouteName, setNewRouteName] = useState('');

    // Route Global View State
    const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
    const [showRouteTrash, setShowRouteTrash] = useState(false);

    // Applied Filter states
    const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
    const [filterMinRating, setFilterMinRating] = useState<number>(0);
    const [filterState, setFilterState] = useState<string>('');
    const [filterArea, setFilterArea] = useState<string>('');

    // Temporary Filter states (UI)
    const [tempFilterFavorite, setTempFilterFavorite] = useState<boolean>(false);
    const [tempFilterMinRating, setTempFilterMinRating] = useState<number>(0);
    const [tempFilterState, setTempFilterState] = useState<string>('');
    const [tempFilterArea, setTempFilterArea] = useState<string>('');

    const [showFilters, setShowFilters] = useState(false);

    const applyFilters = () => {
        setFilterFavorite(tempFilterFavorite);
        setFilterMinRating(tempFilterMinRating);
        setFilterState(tempFilterState);
        setFilterArea(tempFilterArea);
        setShowFilters(false);
    };

    // Extract unique areas of expertise globally
    const allUniqueAreas = useMemo(() => {
        const areas = new Set<string>();
        companies.forEach(c => {
            if (c.type === 'Fornecedor' && c.areasAtuacao) {
                c.areasAtuacao.forEach(a => areas.add(a));
            }
        });
        return Array.from(areas).sort();
    }, [companies]);

    // Used for filtering area
    const availableAreas = allUniqueAreas.length > 0 ? allUniqueAreas : ["Tecnologia", "Logística", "Alimentação"];

    // Extract unique states from current companies
    const availableStates = useMemo(() => {
        const states = new Set(companies.filter(c => c.type === type && !c.trashed && c.uf).map(c => c.uf));
        return Array.from(states).sort();
    }, [companies, type]);

    // Calculate dynamic ratings from budgets
    const companyRatings = useMemo(() => {
        const ratingsMap: Record<string, { total: number; count: number }> = {};

        budgets.forEach(b => {
            b.items?.forEach(item => {
                // Fornecedor Rating
                if (item.companyId && item.supplierRating) {
                    if (!ratingsMap[item.companyId]) ratingsMap[item.companyId] = { total: 0, count: 0 };
                    ratingsMap[item.companyId].total += item.supplierRating;
                    ratingsMap[item.companyId].count++;
                }
                // Transportadora Rating
                if (item.transporterId && item.transporterRating) {
                    if (!ratingsMap[item.transporterId]) ratingsMap[item.transporterId] = { total: 0, count: 0 };
                    ratingsMap[item.transporterId].total += item.transporterRating;
                    ratingsMap[item.transporterId].count++;
                }
            });
        });

        const finalRatings: Record<string, number> = {};
        Object.keys(ratingsMap).forEach(key => {
            finalRatings[key] = Math.round(ratingsMap[key].total / ratingsMap[key].count);
        });

        return finalRatings;
    }, [budgets]);

    const filteredCompanies = useMemo(() => {
        const list = companies.filter(c => {
            if (c.type !== type || c.trashed) return false;

            // Advanced Filters
            const compRating = companyRatings[c.id] || 0;
            if (filterFavorite && !c.isFavorite) return false;
            if (filterMinRating > 0 && compRating < filterMinRating) return false;
            if (filterState && c.uf !== filterState) return false;
            if (filterArea && c.type === 'Fornecedor' && !(c.areasAtuacao || []).includes(filterArea)) return false;

            if (!searchTerm) return true;

            const searchLower = searchTerm.toLowerCase();
            return (
                c.razao_social.toLowerCase().includes(searchLower) ||
                (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(searchLower)) ||
                c.cnpj.includes(searchTerm)
            );
        });

        // Default sorting: Favorite -> Rating (high to low) -> then new to old
        return list.sort((a, b) => {
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;

            const ratingA = companyRatings[a.id] || 0;
            const ratingB = companyRatings[b.id] || 0;
            if (ratingB !== ratingA) return ratingB - ratingA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [companies, type, searchTerm, filterFavorite, filterMinRating, filterState, filterArea, companyRatings]);

    const selectedCompany = useMemo(() => {
        return companies.find(c => c.id === selectedCompanyId);
    }, [companies, selectedCompanyId]);

    // Select the first company by default if none selected and results exist (only if no URL ID is handling it)
    useMemo(() => {
        if (!selectedCompanyId && filteredCompanies.length > 0 && !urlId) {
            setSelectedCompanyId(filteredCompanies[0].id);
        } else if (filteredCompanies.length === 0 && selectedCompanyId) {
            setSelectedCompanyId(null);
        }
    }, [filteredCompanies, selectedCompanyId, urlId]);

    const handleAddContact = () => {
        if (!selectedCompany) return;
        const newContacts = [...(selectedCompany.contacts || []), { id: crypto.randomUUID(), label: 'Novo Contato', phone: '', email: '', isWhatsapp: false }];
        updateCompany(selectedCompany.id, { contacts: newContacts });
    };

    const handleUpdateContact = (contactId: string, data: Partial<CompanyContact>) => {
        if (!selectedCompany?.contacts) return;
        const newContacts = selectedCompany.contacts.map(c => c.id === contactId ? { ...c, ...data } : c);
        updateCompany(selectedCompany.id, { contacts: newContacts });
    };

    const handleRemoveContact = (contactId: string) => {
        if (!selectedCompany?.contacts) return;
        const newContacts = selectedCompany.contacts.filter(c => c.id !== contactId);
        updateCompany(selectedCompany.id, { contacts: newContacts });
    };

    const handleToggleArea = (area: string) => {
        if (!selectedCompany) return;
        const upperArea = area.trim().toUpperCase();
        const currentAreas = selectedCompany.areasAtuacao || [];
        const newAreas = currentAreas.includes(upperArea)
            ? currentAreas.filter(a => a !== upperArea)
            : [...currentAreas, upperArea];
        updateCompany(selectedCompany.id, { areasAtuacao: newAreas });
    };

    const handleCreateRoute = () => {
        if (!newRouteOrigin || !newRouteDest || !newRouteName) return;

        const newRoute = {
            id: crypto.randomUUID(),
            name: newRouteName,
            origin: newRouteOrigin,
            destination: newRouteDest,
            transporterIds: selectedCompany ? [selectedCompany.id] : [],
            isFavorite: false
        };

        addRoute(newRoute);
        setIsCreatingRoute(false);
        setNewRouteOrigin('');
        setNewRouteDest('');
        setNewRouteName('');
    };

    const handleAddTransporterToRoute = (routeId: string) => {
        if (!selectedCompany) return;
        const route = routes.find(r => r.id === routeId);
        if (!route) return;

        if (!route.transporterIds.includes(selectedCompany.id)) {
            updateRoute(routeId, { transporterIds: [...route.transporterIds, selectedCompany.id] });
        }
    };

    const handleRemoveTransporterFromRoute = (routeId: string) => {
        if (!selectedCompany) return;
        const route = routes.find(r => r.id === routeId);
        if (!route) return;

        updateRoute(routeId, { transporterIds: route.transporterIds.filter(id => id !== selectedCompany.id) });
    };


    return (
        <div className="flex-1 overflow-hidden bg-background flex flex-col h-full relative">
            {/* Header */}
            <div className="p-6 border-b border-border bg-card/50">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            {type === 'Fornecedor' ? <Briefcase className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Lista de {type === 'Fornecedor' ? 'Fornecedores' : 'Transportadoras'}</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Visualização de {type === 'Fornecedor' ? 'fornecedores' : 'transportadoras'} salvos no sistema.
                            </p>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por nome ou CNPJ..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-foreground hover:bg-muted'}`}
                        >
                            <Filter className="h-4 w-4" />
                            Filtros {(filterFavorite || filterMinRating > 0 || filterState || filterArea) ? <span className="flex h-2 w-2 rounded-full bg-primary" /> : null}
                        </button>
                    </div>
                </div>

                {/* Expanded Filters Panel */}
                {showFilters && (
                    <div className="max-w-6xl mx-auto mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        <label className="flex items-center gap-2 p-3 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                            <input
                                type="checkbox"
                                checked={tempFilterFavorite}
                                onChange={(e) => setTempFilterFavorite(e.target.checked)}
                                className="rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-medium flex items-center gap-1.5"><Heart className="h-4 w-4 text-red-500 fill-red-500" /> Apenas Favoritos</span>
                        </label>

                        <div className="space-y-1.5 p-2 bg-background border border-border rounded-lg">
                            <p className="text-xs font-semibold text-muted-foreground px-1">Avaliação Mínima</p>
                            <div className="flex items-center px-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setTempFilterMinRating(tempFilterMinRating === star ? 0 : star)}
                                        className={`p-0.5 transition-colors ${tempFilterMinRating >= star ? "text-yellow-500" : "text-muted-foreground/30 hover:text-yellow-400"}`}
                                    >
                                        <Star className="h-5 w-5 fill-current" />
                                    </button>
                                ))}
                                {tempFilterMinRating > 0 && <span className="ml-2 text-xs text-muted-foreground font-medium">{tempFilterMinRating}+ estrelas</span>}
                            </div>
                        </div>

                        <div className="space-y-1.5 p-2 bg-background border border-border rounded-lg">
                            <p className="text-xs font-semibold text-muted-foreground px-1">Localização (Estado)</p>
                            <select
                                value={tempFilterState}
                                onChange={(e) => setTempFilterState(e.target.value)}
                                className="w-full text-sm bg-background text-foreground outline-none focus:ring-0 px-1 py-0.5"
                            >
                                <option value="">Todos os Estados</option>
                                {availableStates.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                            </select>
                        </div>

                        {type === 'Fornecedor' && (
                            <div className="space-y-1.5 p-2 bg-background border border-border rounded-lg">
                                <p className="text-xs font-semibold text-muted-foreground px-1">Área de Atuação</p>
                                <select
                                    value={tempFilterArea}
                                    onChange={(e) => setTempFilterArea(e.target.value)}
                                    className="w-full text-sm bg-background text-foreground outline-none focus:ring-0 px-1 py-0.5"
                                >
                                    <option value="">Todas as Áreas</option>
                                    {availableAreas.map(area => <option key={area} value={area}>{area}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="sm:col-span-2 lg:col-span-4 flex justify-end mt-2">
                            <button
                                onClick={applyFilters}
                                className="bg-primary text-primary-foreground text-sm font-semibold px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                            >
                                Aplicar Filtros
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-6xl mx-auto w-full">

                {/* Left pane: List */}
                <div className={`w-full md:w-1/3 border-r border-border overflow-y-auto custom-scrollbar flex-col bg-muted/10 ${selectedCompanyId || (tabOption === 'routes' && expandedRouteId) ? 'hidden md:flex' : 'flex'}`}>
                    {tabOption === 'routes' && type === 'Transportadora' ? (
                        <div className="flex-1 flex flex-col p-4 space-y-4">
                            <div className="flex flex-col gap-2 mb-2">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" /> Gerenciamento de Rotas
                                </h2>
                                <p className="text-xs text-muted-foreground">Visualize e gerencie a ordem das transportadoras.</p>
                                <button
                                    onClick={() => setShowRouteTrash(true)}
                                    className="mt-2 flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-medium transition-colors bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground w-fit"
                                >
                                    <ArchiveRestore className="h-4 w-4" /> Lixeira de Rotas
                                </button>
                            </div>

                            {(() => {
                                const displayedRoutes = routes.filter(r => !r.trashed);

                                if (displayedRoutes.length === 0) {
                                    return (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                            <MapPin className="h-12 w-12 mb-3 opacity-20" />
                                            <p className="font-medium text-sm">Nenhuma rota cadastrada</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-2">
                                        {displayedRoutes.map(route => {
                                            const linkedTransporters = route.transporterIds
                                                .map(id => companies.find(c => c.id === id))
                                                .filter(Boolean);
                                            const isExpanded = expandedRouteId === route.id;

                                            return (
                                                <div
                                                    key={route.id}
                                                    onClick={() => setExpandedRouteId(route.id)}
                                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${isExpanded
                                                        ? 'bg-primary border-primary text-primary-foreground shadow-md'
                                                        : 'bg-card border-border hover:border-primary/50 hover:shadow-sm text-card-foreground'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5 line-clamp-1">
                                                                {route.isFavorite && <Heart className={`h-3 w-3 shrink-0 ${isExpanded ? 'fill-primary-foreground text-primary-foreground' : 'fill-red-500 text-red-500'}`} />}
                                                                <p className="font-bold text-sm truncate">{route.name}</p>
                                                            </div>
                                                            <div className={`flex items-center gap-2 text-[10px] font-semibold ${isExpanded ? 'text-primary-foreground/80' : 'text-muted-foreground'} flex-wrap mt-0.5`}>
                                                                <span>{route.origin}</span>
                                                                <Truck className="h-2.5 w-2.5 shrink-0" />
                                                                <span>{route.destination}</span>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isExpanded ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                                                            {linkedTransporters.length} transp.
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : filteredCompanies.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <Building2 className="h-12 w-12 mb-3 opacity-20" />
                            <p className="font-medium">Nenhum registro encontrado</p>
                            <p className="text-xs mt-1">Busque {type === 'Fornecedor' ? 'fornecedores' : 'transportadoras'} pelo CNPJ na página de pesquisa.</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {/* Destaques (Favorites) Section inside the list */}
                            {companies.some(c => !c.trashed && c.isFavorite && c.type === type) && !searchTerm && (
                                <div className="mb-6 space-y-3">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                        Em Destaque
                                    </h2>
                                    <div className="flex flex-col gap-2">
                                        {companies.filter(c => !c.trashed && c.isFavorite && c.type === type).map((company) => (
                                            <div
                                                key={`fav-${company.id}`}
                                                onClick={() => setSelectedCompanyId(company.id)}
                                                className={`p-3 rounded-lg border cursor-pointer border-yellow-500/30 transition-all ${selectedCompanyId === company.id
                                                    ? 'bg-yellow-500 text-white shadow-md border-yellow-500'
                                                    : 'bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/50 text-foreground'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {type === 'Fornecedor' ? <Briefcase className={`h-4 w-4 shrink-0 ${selectedCompanyId === company.id ? 'text-white' : 'text-yellow-600'}`} /> : <Truck className={`h-4 w-4 shrink-0 ${selectedCompanyId === company.id ? 'text-white' : 'text-yellow-600'}`} />}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-sm line-clamp-1">{company.nome_fantasia || company.razao_social}</p>
                                                        <p className={`text-[10px] truncate ${selectedCompanyId === company.id ? 'text-yellow-100' : 'text-muted-foreground'}`}>{company.cnpj}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-4 border-t border-border pt-4">Todos os Registros</h2>
                                </div>
                            )}

                            <div className="space-y-2">
                                {filteredCompanies.map(company => (
                                    <div
                                        key={company.id}
                                        onClick={() => setSelectedCompanyId(company.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedCompanyId === company.id
                                            ? 'bg-primary border-primary text-primary-foreground shadow-md'
                                            : 'bg-card border-border hover:border-primary/50 hover:shadow-sm text-card-foreground'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                                {company.isFavorite && <Heart className={`h-3.5 w-3.5 shrink-0 ${selectedCompanyId === company.id ? 'fill-primary-foreground text-primary-foreground' : 'fill-red-500 text-red-500'}`} />}
                                                <p className="font-bold text-sm line-clamp-1">{company.nome_fantasia || company.razao_social}</p>
                                            </div>
                                            {companyRatings[company.id] ? (
                                                <div className="flex items-center shrink-0" title={`Média das cotações (${companyRatings[company.id]} estrelas)`}>
                                                    <Star className={`h-3 w-3 ${selectedCompanyId === company.id ? 'fill-yellow-400 text-yellow-400' : 'fill-yellow-500 text-yellow-500'}`} />
                                                    <span className={`text-[10px] font-bold ml-0.5 ${selectedCompanyId === company.id ? 'text-primary-foreground' : 'text-foreground'}`}>{companyRatings[company.id]}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                        <p className={`text-xs mt-1 truncate ${selectedCompanyId === company.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{company.cnpj}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right pane: Details */}
                <div className={`flex-1 overflow-y-auto custom-scrollbar bg-background ${(!selectedCompanyId && !(tabOption === 'routes' && expandedRouteId)) ? 'hidden md:block' : 'block'}`}>
                    {tabOption === 'routes' && type === 'Transportadora' ? (
                        !expandedRouteId ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                                <MapPin className="h-16 w-16 mb-4 opacity-10" />
                                <p>Selecione uma rota para visualizar ou editar os detalhes</p>
                            </div>
                        ) : (() => {
                            const expandedRoute = routes.find(r => r.id === expandedRouteId);
                            if (!expandedRoute) return null;
                            const linkedTransporters = expandedRoute.transporterIds
                                .map(id => companies.find(c => c.id === id))
                                .filter(Boolean);

                            return (
                                <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <button onClick={() => setExpandedRouteId(null)} className="md:hidden flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/50 hover:bg-muted px-2 py-1.5 rounded-md transition-colors w-fit">
                                        <ChevronLeft className="h-4 w-4" /> Voltar para Rotas
                                    </button>
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-border">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => updateRoute(expandedRoute.id, { isFavorite: !expandedRoute.isFavorite })}
                                                    className={`p-1.5 rounded-full transition-colors ${expandedRoute.isFavorite ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground'}`}
                                                >
                                                    <Heart className={`h-5 w-5 ${expandedRoute.isFavorite ? 'fill-current' : ''}`} />
                                                </button>
                                                <h2 className="text-3xl font-bold tracking-tight text-foreground leading-tight">
                                                    {expandedRoute.name}
                                                </h2>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mt-3 ml-10">
                                                <span className="bg-muted px-2 py-0.5 rounded text-foreground">{expandedRoute.origin}</span>
                                                <Truck className="h-4 w-4 shrink-0" />
                                                <span className="bg-muted px-2 py-0.5 rounded text-foreground">{expandedRoute.destination}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit) return;
                                                deleteRoute(expandedRoute.id);
                                                setExpandedRouteId(null);
                                            }}
                                            disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Mover para Lixeira
                                        </button>
                                    </div>

                                    <div>
                                        <p className="text-xs uppercase font-bold text-muted-foreground mb-4 tracking-wider flex items-center gap-2">
                                            Ranking de Transportadoras <Info className="h-3 w-3" />
                                        </p>
                                        {linkedTransporters.length === 0 ? (
                                            <p className="text-sm italic text-muted-foreground text-center py-8 bg-muted/10 rounded-xl border border-border border-dashed">
                                                Nenhuma transportadora vinculada a esta rota.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {linkedTransporters.map((t, index) => (
                                                    <div key={t!.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                                                            {index + 1}
                                                        </div>
                                                        <div
                                                            className="flex-1 min-w-0 cursor-pointer group"
                                                            onClick={() => {
                                                                setSelectedCompanyId(t!.id);
                                                                setSearchParams({});
                                                            }}
                                                        >
                                                            <p className="text-base font-semibold truncate group-hover:text-primary transition-colors">{t!.nome_fantasia || t!.razao_social}</p>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                                <span className="truncate">{t!.cnpj}</span>
                                                                <span className="px-1.5 py-0.5 bg-muted rounded truncate">{t!.logradouro ? `${t!.municipio}/${t!.uf}` : 'Sem Endereço'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center shrink-0 border-l border-border pl-3 border-dashed gap-1">
                                                            <button
                                                                disabled={index === 0}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newArray = [...expandedRoute.transporterIds];
                                                                    const temp = newArray[index - 1];
                                                                    newArray[index - 1] = newArray[index];
                                                                    newArray[index] = temp;
                                                                    updateRoute(expandedRoute.id, { transporterIds: newArray });
                                                                }}
                                                                className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                <ArrowUp className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                disabled={index === linkedTransporters.length - 1}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newArray = [...expandedRoute.transporterIds];
                                                                    const temp = newArray[index + 1];
                                                                    newArray[index + 1] = newArray[index];
                                                                    newArray[index] = temp;
                                                                    updateRoute(expandedRoute.id, { transporterIds: newArray });
                                                                }}
                                                                className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                <ArrowDown className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()
                    ) : !selectedCompany ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                            <Building2 className="h-16 w-16 mb-4 opacity-10" />
                            <p>Selecione um item da lista para ver os detalhes</p>
                        </div>
                    ) : (
                        <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

                            {/* Mobile Back Button */}
                            <button onClick={() => setSelectedCompanyId(null)} className="md:hidden flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/50 hover:bg-muted px-2 py-1.5 rounded-md transition-colors w-fit">
                                <ChevronLeft className="h-4 w-4" /> Voltar para Lista
                            </button>

                            {/* Header Details */}
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-border">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => updateCompany(selectedCompany.id, { isFavorite: !selectedCompany.isFavorite })}
                                            className={`p-1.5 rounded-full transition-colors ${selectedCompany.isFavorite ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground'}`}
                                            title={selectedCompany.isFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                                        >
                                            <Heart className={`h-5 w-5 ${selectedCompany.isFavorite ? 'fill-current' : ''}`} />
                                        </button>
                                        <h2 className="text-3xl font-bold tracking-tight text-foreground leading-tight">
                                            {selectedCompany.nome_fantasia || selectedCompany.razao_social}
                                        </h2>
                                    </div>
                                    <p className="text-base font-medium text-muted-foreground mt-1 ml-10">{selectedCompany.razao_social}</p>
                                    <div className="flex flex-wrap items-center gap-4 mt-3 ml-10">
                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${selectedCompany.descricao_situacao_cadastral === 'ATIVA' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                                            {selectedCompany.descricao_situacao_cadastral}
                                        </span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            Adicionado em {new Date(selectedCompany.createdAt).toLocaleDateString()}
                                        </span>
                                        <div className="flex items-center gap-1 border-l pl-4 border-border" title="Avaliação Média nas Cotações">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <div
                                                    key={star}
                                                    className={`p-0.5 transition-colors cursor-default ${(companyRatings[selectedCompany.id] || 0) >= star
                                                        ? "text-yellow-400 drop-shadow-sm"
                                                        : "text-muted-foreground/20"
                                                        }`}
                                                >
                                                    <Star className="h-4 w-4 fill-current" />
                                                </div>
                                            ))}
                                            <span className="text-[10px] text-muted-foreground ml-1">
                                                (Avaliações de Cotações)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {currentUser?.role !== 'USER' && (
                                    <button
                                        onClick={() => {
                                            updateCompany(selectedCompany.id, { trashed: true });
                                            setSelectedCompanyId(null);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Mover para Lixeira
                                    </button>
                                )}
                            </div>

                            {/* Custom Link Setup */}
                            <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="flex-1 w-full relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                    <input
                                        type="url"
                                        placeholder="Adicione o site da empresa (ex: https://site.com.br)"
                                        value={selectedCompany.customLink || ''}
                                        onChange={(e) => updateCompany(selectedCompany.id, { customLink: e.target.value })}
                                        className="w-full bg-transparent border-none text-sm outline-none placeholder:text-muted-foreground/50 py-1 pl-9 pr-4"
                                    />
                                </div>
                                {selectedCompany.customLink && (
                                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                        <a
                                            href={selectedCompany.customLink.startsWith('http') ? selectedCompany.customLink : `https://${selectedCompany.customLink}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 rounded shadow-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
                                            title="Visitar link"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Acessar Link Externo
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><Briefcase className="h-4 w-4" /> CNPJ</p>
                                    <p className="text-sm font-medium text-foreground">{selectedCompany.cnpj}</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><MapPin className="h-4 w-4" /> Atividade Principal</p>
                                    <p className="text-sm font-medium text-foreground">{selectedCompany.cnae_fiscal_descricao}</p>
                                </div>

                                <div className="space-y-2 sm:col-span-2 bg-muted/30 p-4 rounded-xl border border-border/50 text-sm">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center justify-between gap-1">
                                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> Endereço</span>
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedCompany.logradouro}, ${selectedCompany.numero} ${selectedCompany.bairro} ${selectedCompany.municipio} ${selectedCompany.uf} ${selectedCompany.cep}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] flex items-center gap-1 hover:text-primary transition-colors bg-background px-2 py-1 rounded border shadow-sm"
                                        >
                                            <MapPin className="h-3 w-3" /> Abrir no Maps
                                        </a>
                                    </p>
                                    <p className="text-foreground">{selectedCompany.logradouro}, {selectedCompany.numero} {selectedCompany.complemento ? `- ${selectedCompany.complemento}` : ''}</p>
                                    <p className="text-muted-foreground">{selectedCompany.bairro} - {selectedCompany.municipio} / {selectedCompany.uf}</p>
                                    <p className="text-muted-foreground mt-1 font-medium">CEP: {selectedCompany.cep}</p>
                                </div>

                                <div className="space-y-4 sm:col-span-2 mt-4 border-t border-border pt-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><Phone className="h-4 w-4" /> Informações de Contato</p>
                                        <button
                                            onClick={handleAddContact}
                                            disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                            className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 font-semibold bg-primary/10 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Plus className="h-3 w-3" /> Adicionar Contato Dinâmico
                                        </button>
                                    </div>

                                    {/* Legacy Unified Contacts - Now Read-Only with Actions */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                        <div className="p-4 bg-muted/10 border border-border rounded-xl flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone Principal</p>
                                                <p className="text-sm font-semibold text-foreground mt-2">{selectedCompany.ddd_telefone_1 || 'Não informado'}</p>
                                            </div>
                                            {selectedCompany.ddd_telefone_1 && (
                                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                                                    <a href={`tel:${selectedCompany.ddd_telefone_1.replace(/\D/g, '')}`} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-background border border-border rounded shadow-sm text-xs font-medium hover:bg-muted transition-colors">
                                                        <Phone className="h-3 w-3" /> Ligar
                                                    </a>
                                                    <a href={`https://wa.me/55${selectedCompany.ddd_telefone_1.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-green-500/10 text-green-600 border border-transparent rounded shadow-sm text-xs font-medium hover:bg-green-500/20 transition-colors">
                                                        WhatsApp
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 bg-muted/10 border border-border rounded-xl flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-mail Principal</p>
                                                <p className="text-sm font-semibold text-foreground mt-2 break-all">{selectedCompany.email || 'Não informado'}</p>
                                            </div>
                                            {selectedCompany.email && (
                                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                                                    <a href={`mailto:${selectedCompany.email}`} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-primary/10 text-primary border border-transparent rounded shadow-sm text-xs font-medium hover:bg-primary/20 transition-colors">
                                                        <Mail className="h-3 w-3" /> Enviar E-mail
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        {selectedCompany.ddd_telefone_2 && (
                                            <div className="p-4 bg-muted/10 border border-border rounded-xl flex flex-col justify-between">
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone Secundário</p>
                                                    <p className="text-sm font-semibold text-foreground mt-2">{selectedCompany.ddd_telefone_2}</p>
                                                </div>
                                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                                                    <a href={`tel:${selectedCompany.ddd_telefone_2.replace(/\D/g, '')}`} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-background border border-border rounded shadow-sm text-xs font-medium hover:bg-muted transition-colors">
                                                        <Phone className="h-3 w-3" /> Ligar
                                                    </a>
                                                    <a href={`https://wa.me/55${selectedCompany.ddd_telefone_2.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-green-500/10 text-green-600 border border-transparent rounded shadow-sm text-xs font-medium hover:bg-green-500/20 transition-colors">
                                                        WhatsApp
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {(selectedCompany.contacts || []).length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Contatos Adicionais</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {(selectedCompany.contacts || []).map(contact => (
                                                    <div key={contact.id} className="p-3 bg-muted/20 border border-border rounded-xl space-y-3 relative group">
                                                        {currentUser?.role !== 'USER' && (
                                                            <button onClick={() => handleRemoveContact(contact.id)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-background rounded-md shadow-sm border border-border">
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        <div>
                                                            <input
                                                                type="text"
                                                                value={contact.label}
                                                                onChange={(e) => handleUpdateContact(contact.id, { label: e.target.value })}
                                                                placeholder="Rótulo (ex: Financeiro)"
                                                                className="text-sm font-semibold bg-transparent border-none outline-none p-0 focus:ring-0 placeholder:text-muted-foreground/50 w-full"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                <input
                                                                    type="text"
                                                                    value={contact.phone || ''}
                                                                    onChange={(e) => handleUpdateContact(contact.id, { phone: e.target.value })}
                                                                    placeholder="Telefone"
                                                                    className="text-xs bg-background border border-border rounded px-2 py-1 flex-1 outline-none focus:border-primary"
                                                                />
                                                                <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={contact.isWhatsapp || false}
                                                                        onChange={(e) => handleUpdateContact(contact.id, { isWhatsapp: e.target.checked })}
                                                                        className="rounded border-border text-green-500 focus:ring-green-500 h-3 w-3"
                                                                    />
                                                                    WhatsApp
                                                                </label>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                <input
                                                                    type="email"
                                                                    value={contact.email || ''}
                                                                    onChange={(e) => handleUpdateContact(contact.id, { email: e.target.value })}
                                                                    placeholder="E-mail"
                                                                    className="text-xs bg-background border border-border rounded px-2 py-1 w-full outline-none focus:border-primary"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Comments Field */}
                                <div className="space-y-2 sm:col-span-2 border-t border-border pt-6">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><MessageSquare className="h-4 w-4" /> Observações</p>
                                    <textarea
                                        value={selectedCompany.comments || ''}
                                        onChange={(e) => updateCompany(selectedCompany.id, { comments: e.target.value })}
                                        disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                        placeholder="Adicione notas, comentários ou histórico de negociações sobre esta empresa..."
                                        className="w-full bg-muted/20 border border-border rounded-xl p-3 text-sm min-h-[100px] outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y custom-scrollbar disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </div>

                                {/* Supplier Specific Fields */}
                                {selectedCompany.type === 'Fornecedor' && (
                                    <div className="sm:col-span-2 space-y-6 border-t border-border pt-6 bg-blue-50/30 dark:bg-blue-950/10 p-4 rounded-xl mt-4">
                                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> Informações Comerciais do Fornecedor</h3>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                            <div className="sm:col-span-3 space-y-3 bg-background p-3 rounded border border-border/50 shadow-sm">
                                                <p className="text-xs font-semibold text-muted-foreground">Área de Atuação</p>

                                                <div className="flex items-center gap-2 max-w-sm">
                                                    <input
                                                        type="text"
                                                        list="areas-atuacao-list"
                                                        placeholder="Digite e adicione uma área..."
                                                        className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const val = e.currentTarget.value.trim().toUpperCase();
                                                                if (val && !(selectedCompany.areasAtuacao || []).includes(val)) {
                                                                    handleToggleArea(val);
                                                                }
                                                                e.currentTarget.value = '';
                                                            }
                                                        }}
                                                    />
                                                    <datalist id="areas-atuacao-list">
                                                        {allUniqueAreas.map(area => <option key={area} value={area} />)}
                                                    </datalist>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">Pressione Enter na caixa de texto para adicionar à lista abaixo.</p>

                                                <div className="flex flex-wrap gap-2 mt-3 p-2 bg-muted/20 rounded min-h-[40px]">
                                                    {(!selectedCompany.areasAtuacao || selectedCompany.areasAtuacao.length === 0) && (
                                                        <p className="text-xs text-muted-foreground italic m-auto">Nenhuma área adicionada</p>
                                                    )}
                                                    {(selectedCompany.areasAtuacao || []).map(area => (
                                                        <span
                                                            key={area}
                                                            className="px-2 py-1 flex items-center gap-2 text-xs font-medium rounded-md bg-primary/10 text-primary border border-primary/20"
                                                        >
                                                            {area}
                                                            {currentUser?.role !== 'USER' && (
                                                                <button
                                                                    onClick={() => handleToggleArea(area)}
                                                                    className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                                                                    title="Remover Área"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground">Amostra</p>
                                                <select
                                                    value={selectedCompany.amostra ? 'Sim' : 'Não'}
                                                    onChange={(e) => updateCompany(selectedCompany.id, { amostra: e.target.value === 'Sim' })}
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                                                >
                                                    <option value="Não">Não</option>
                                                    <option value="Sim">Sim</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground">Tipo de Frete</p>
                                                <select
                                                    value={selectedCompany.frete || ''}
                                                    onChange={(e) => updateCompany(selectedCompany.id, { frete: e.target.value as any })}
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                                                >
                                                    <option value="">Não Especificado</option>
                                                    <option value="CIF">CIF (Por conta do Fornecedor)</option>
                                                    <option value="FOB">FOB (Por conta do Comprador)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground">Mantém a Oferta (Dias/Condições)</p>
                                                <input
                                                    type="text"
                                                    value={selectedCompany.mantemOferta || ''}
                                                    onChange={(e) => updateCompany(selectedCompany.id, { mantemOferta: e.target.value })}
                                                    placeholder="ex: 15 dias"
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                                                />
                                            </div>

                                        </div>
                                    </div>
                                )}

                                {/* Transporter Specific Information */}
                                {selectedCompany.type === 'Transportadora' && (
                                    <div className="sm:col-span-2 space-y-6 border-t border-border pt-6 mt-4 pb-4">
                                        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-5 rounded-xl border border-amber-200/30 dark:border-amber-900/30 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-2">
                                                    <Building2 className="h-4 w-4" /> Seguro de Carga
                                                </p>
                                                <p className="text-xs text-amber-900/70 dark:text-amber-200/70">Esta transportadora possui seguro de carga ativo?</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={selectedCompany.seguroCarga || false}
                                                    onChange={(e) => updateCompany(selectedCompany.id, { seguroCarga: e.target.checked })}
                                                />
                                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 dark:peer-checked:bg-amber-600"></div>
                                                <span className="ml-3 text-sm font-medium text-foreground min-w-[32px]">{selectedCompany.seguroCarga ? 'Sim' : 'Não'}</span>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Rotas de Atuação</h3>
                                            <button
                                                onClick={() => setIsCreatingRoute(!isCreatingRoute)}
                                                disabled={currentUser?.role !== 'ADMIN' && !currentUser?.permissions?.canEdit}
                                                className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 font-semibold bg-primary/10 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isCreatingRoute ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                                {isCreatingRoute ? 'Cancelar' : 'Nova Rota'}
                                            </button>
                                        </div>

                                        {isCreatingRoute && (
                                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-3 animate-in fade-in slide-in-from-top-2">
                                                <input
                                                    type="text"
                                                    placeholder="Nome da Rota (ex: Sul para Sudeste)"
                                                    value={newRouteName}
                                                    onChange={(e) => setNewRouteName(e.target.value)}
                                                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                                                />
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Origem (ex: RS)"
                                                        value={newRouteOrigin}
                                                        onChange={(e) => setNewRouteOrigin(e.target.value)}
                                                        className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                                                    />
                                                    <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <input
                                                        type="text"
                                                        placeholder="Destino (ex: SP)"
                                                        value={newRouteDest}
                                                        onChange={(e) => setNewRouteDest(e.target.value)}
                                                        className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleCreateRoute}
                                                    disabled={!newRouteOrigin || !newRouteDest || !newRouteName}
                                                    className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                                                >
                                                    Salvar e Adicionar Transportadora
                                                </button>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {/* Routes where this transporter is already included */}
                                            {routes.filter(r => r.transporterIds.includes(selectedCompany.id)).length > 0 ? (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rotas Atendidas</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {routes.filter(r => r.transporterIds.includes(selectedCompany.id)).map(route => (
                                                            <div key={route.id} className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2 relative group hover:shadow-sm transition-all">
                                                                {currentUser?.role !== 'USER' && (
                                                                    <button
                                                                        onClick={() => handleRemoveTransporterFromRoute(route.id)}
                                                                        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive bg-muted/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        title="Remover desta rota"
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                                <div className="flex items-center justify-between pr-6">
                                                                    <h4 className="font-semibold text-sm line-clamp-1">{route.name}</h4>
                                                                    {route.isFavorite && <Heart className="h-3 w-3 text-red-500 fill-red-500 shrink-0" />}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                    <span className="bg-muted px-2 py-0.5 rounded font-medium truncate max-w-[100px]">{route.origin}</span>
                                                                    <Truck className="h-3 w-3 shrink-0" />
                                                                    <span className="bg-muted px-2 py-0.5 rounded font-medium truncate max-w-[100px]">{route.destination}</span>
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground mt-1 py-1 px-2 bg-primary/5 rounded border border-primary/10 w-fit">
                                                                    Rank: #{route.transporterIds.indexOf(selectedCompany.id) + 1} de {route.transporterIds.length}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic bg-muted/20 p-4 border border-dashed rounded-xl text-center">
                                                    Esta transportadora não está associada a nenhuma rota ainda.
                                                </p>
                                            )}

                                            {/* Available routes to add */}
                                            {routes.filter(r => !r.transporterIds.includes(selectedCompany.id)).length > 0 && (
                                                <div className="pt-4 mt-2 border-t border-border/50">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Adicionar a Rotas Existentes</p>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {routes.filter(r => !r.transporterIds.includes(selectedCompany.id)).map(route => (
                                                            <button
                                                                key={route.id}
                                                                onClick={() => handleAddTransporterToRoute(route.id)}
                                                                className="flex items-center gap-1.5 text-xs bg-muted/50 border border-border hover:bg-muted hover:border-primary/50 text-foreground px-3 py-1.5 rounded-full transition-all"
                                                            >
                                                                <Plus className="h-3 w-3 text-primary" />
                                                                {route.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            </div>
            {/* Route Trash Modal */}
            {showRouteTrash && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl border border-border flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
                                    <Trash2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Lixeira de Rotas</h2>
                                    <p className="text-sm text-muted-foreground">Restaure ou exclua rotas permanentemente.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowRouteTrash(false)}
                                className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {(() => {
                                const trashedRoutes = routes.filter(r => r.trashed);
                                if (trashedRoutes.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                            <ArchiveRestore className="h-12 w-12 mb-4 opacity-20" />
                                            <p className="text-lg font-medium">Lixeira vazia</p>
                                            <p className="text-sm mt-1">Nenhuma rota foi excluída ainda.</p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="space-y-3">
                                        {trashedRoutes.map(route => (
                                            <div key={route.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-background border border-border/50 rounded-xl hover:bg-muted/30 transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-sm text-foreground mb-1">{route.name}</h3>
                                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                        <span className="bg-muted px-2 py-0.5 rounded text-foreground">{route.origin}</span>
                                                        <Truck className="h-3 w-3 shrink-0" />
                                                        <span className="bg-muted px-2 py-0.5 rounded text-foreground">{route.destination}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {currentUser?.role !== 'USER' && (
                                                        <>
                                                            <button onClick={() => restoreRoute(route.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                                                                <RefreshCcw className="h-4 w-4" /> Restaurar
                                                            </button>
                                                            <button onClick={() => permanentlyDeleteRoute(route.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                                                                <Trash2 className="h-4 w-4" /> Excluir
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyListPage;
