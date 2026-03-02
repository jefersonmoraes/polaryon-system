import { useState, useMemo } from 'react';
import { useKanbanStore } from '@/store/kanban-store';
import { Search, MapPin, Phone, Mail, Globe, Calendar, Star, Trash2, Building2, Truck, Copy, Check, Link2, ExternalLink, Heart, Briefcase } from 'lucide-react';
// utils not needed
interface CompanyListPageProps {
    type: 'Fornecedor' | 'Transportadora';
}

const CompanyListPage = ({ type }: CompanyListPageProps) => {
    const { companies, removeCompany, updateCompany } = useKanbanStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    const filteredCompanies = useMemo(() => {
        const list = companies.filter(c => {
            if (c.type !== type || c.trashed) return false;
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

            const ratingA = a.rating || 0;
            const ratingB = b.rating || 0;
            if (ratingB !== ratingA) return ratingB - ratingA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [companies, type, searchTerm]);

    const selectedCompany = useMemo(() => {
        return companies.find(c => c.id === selectedCompanyId);
    }, [companies, selectedCompanyId]);

    // Select the first company by default if none selected and results exist
    useMemo(() => {
        if (!selectedCompanyId && filteredCompanies.length > 0) {
            setSelectedCompanyId(filteredCompanies[0].id);
        } else if (filteredCompanies.length === 0 && selectedCompanyId) {
            setSelectedCompanyId(null);
        }
    }, [filteredCompanies, selectedCompanyId]);


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

                    {/* Search bar */}
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
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-6xl mx-auto w-full">

                {/* Left pane: List */}
                <div className="w-full md:w-1/3 border-r border-border overflow-y-auto custom-scrollbar flex flex-col bg-muted/10">
                    {filteredCompanies.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <Building2 className="h-12 w-12 mb-3 opacity-20" />
                            <p className="font-medium">Nenhum registro encontrado</p>
                            <p className="text-xs mt-1">Busque {type === 'Fornecedor' ? 'fornecedores' : 'transportadoras'} pelo CNPJ na página de pesquisa.</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-2">
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
                                        {company.rating ? (
                                            <div className="flex items-center shrink-0">
                                                <Star className={`h-3 w-3 ${selectedCompanyId === company.id ? 'fill-yellow-400 text-yellow-400' : 'fill-yellow-500 text-yellow-500'}`} />
                                                <span className={`text-[10px] font-bold ml-0.5 ${selectedCompanyId === company.id ? 'text-primary-foreground' : 'text-foreground'}`}>{company.rating}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                    <p className={`text-xs mt-1 truncate ${selectedCompanyId === company.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{company.cnpj}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right pane: Details */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
                    {!selectedCompany ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                            <Building2 className="h-16 w-16 mb-4 opacity-10" />
                            <p>Selecione um item da lista para ver os detalhes</p>
                        </div>
                    ) : (
                        <div className="p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

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
                                        <div className="flex items-center gap-1 border-l pl-4 border-border">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    onClick={() => updateCompany(selectedCompany.id, { rating: star })}
                                                    className={`p-0.5 transition-colors ${(selectedCompany.rating || 0) >= star
                                                        ? "text-yellow-400 hover:text-yellow-500"
                                                        : "text-muted-foreground/30 hover:text-yellow-400/50"
                                                        }`}
                                                    title={`Avaliar com ${star} estrela${star > 1 ? 's' : ''}`}
                                                >
                                                    <Star className="h-5 w-5 fill-current" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

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
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center gap-1"><MapPin className="h-4 w-4" /> Endereço</p>
                                    <p className="text-foreground">{selectedCompany.logradouro}, {selectedCompany.numero} {selectedCompany.complemento ? `- ${selectedCompany.complemento}` : ''}</p>
                                    <p className="text-muted-foreground">{selectedCompany.bairro} - {selectedCompany.municipio} / {selectedCompany.uf}</p>
                                    <p className="text-muted-foreground mt-1 font-medium">CEP: {selectedCompany.cep}</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><Phone className="h-4 w-4" /> Contato</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-foreground">{selectedCompany.ddd_telefone_1}</p>
                                        {selectedCompany.ddd_telefone_1 && (
                                            <a href={`https://wa.me/55${selectedCompany.ddd_telefone_1.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1 bg-green-500/10 text-green-600 rounded hover:bg-green-500/20 transition-colors" title="Chamar no WhatsApp">
                                                <Phone className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                    {selectedCompany.ddd_telefone_2 && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-sm font-medium text-foreground">{selectedCompany.ddd_telefone_2}</p>
                                            <a href={`https://wa.me/55${selectedCompany.ddd_telefone_2.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1 bg-green-500/10 text-green-600 rounded hover:bg-green-500/20 transition-colors" title="Chamar no WhatsApp">
                                                <Phone className="h-3 w-3" />
                                            </a>
                                        </div>
                                    )}
                                    {!selectedCompany.ddd_telefone_1 && !selectedCompany.ddd_telefone_2 && <span className="text-xs text-muted-foreground italic">Não informado</span>}
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><Mail className="h-4 w-4" /> E-mail</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-foreground break-all">{selectedCompany.email || <span className="text-xs text-muted-foreground italic">Não informado</span>}</p>
                                        {selectedCompany.email && (
                                            <a href={`mailto:${selectedCompany.email}`} className="p-1 bg-blue-500/10 text-blue-600 rounded hover:bg-blue-500/20 transition-colors min-w-fit" title="Enviar E-mail">
                                                <Mail className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanyListPage;
