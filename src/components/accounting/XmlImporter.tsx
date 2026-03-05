import React, { useState } from 'react';
import { useAccountingStore } from '@/store/accounting-store';
import { FileUp, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useKanbanStore } from '@/store/kanban-store';

export const XmlImporter = () => {
    const [isDragging, setIsDragging] = useState(false);
    const { addEntry } = useAccountingStore();
    const { mainCompanies } = useKanbanStore();
    const activeCompany = mainCompanies.find((c) => c.isDefault) || mainCompanies[0];

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const processXml = (xmlText: string, fileName: string) => {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            // Basic parsing simulating a Brazilian NF-e XML
            // We look for common tags: <vNF> (total amount), <xNome> (supplier name), <dhEmi> (issue date)
            const vNFNode = xmlDoc.getElementsByTagName("vNF")[0];
            const dhEmiNode = xmlDoc.getElementsByTagName("dhEmi")[0] || xmlDoc.getElementsByTagName("dEmi")[0];

            // Getting supplier name, usually the first <emit><xNome>
            const emitNode = xmlDoc.getElementsByTagName("emit")[0];
            const xNomeNode = emitNode ? emitNode.getElementsByTagName("xNome")[0] : null;

            const amountStr = vNFNode?.textContent;
            const supplierName = xNomeNode?.textContent || "Fornecedor Desconhecido (XML)";
            const dateStr = dhEmiNode?.textContent;

            if (!amountStr) {
                toast.error("Não foi possível encontrar o valor da NF no XML.");
                return;
            }

            const amount = parseFloat(amountStr);
            const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

            if (!activeCompany) {
                toast.error("Nenhuma empresa ativa selecionada.");
                return;
            }

            // Create an expense entry for the imported XML
            addEntry({
                companyId: activeCompany.id,
                title: `NF-e Importada: ${supplierName}`,
                description: `Importado do arquivo ${fileName}`,
                amount: amount,
                date: date,
                type: 'expense', // XML import usually implies incoming NF-e (purchases)
                categoryId: 'cat-exp-3', // Default to Fornecedores
                status: 'pending'
            });

            toast.success("XML importado e lançamento criado com sucesso!");
        } catch (error) {
            console.error("Erro ao processar XML:", error);
            toast.error("Erro ao processar o arquivo XML.");
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (!file) return;

        if (file.type !== "text/xml" && !file.name.endsWith(".xml")) {
            toast.error("Por favor, envie apenas arquivos XML.");
            return;
        }

        const text = await file.text();
        processXml(text, file.name);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        processXml(text, file.name);

        // Reset input so the same file can be uploaded again if needed
        e.target.value = '';
    };

    return (
        <div className="kanban-card rounded-xl border border-border shadow-sm flex flex-col h-full">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-primary" />
                    Importação de NF-e (XML)
                </h3>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center">
                <div
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                    <h4 className="font-medium text-foreground mb-1">Arraste e solte seu XML aqui</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                        O sistema fará a leitura automática da Nota Fiscal e criará um lançamento de despesa.
                    </p>
                    <label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Selecionar Arquivo
                        <input type="file" className="hidden" accept=".xml,text/xml" onChange={handleFileChange} />
                    </label>
                </div>
            </div>
        </div>
    );
};
