import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fixDateToBRT(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    
    // If it's just a date YYYY-MM-DD, force 12:00 to avoid UTC shifts to previous day
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(`${dateStr}T12:00:00`);
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    // For ISO strings that might have 'Z' or offset, we want to treat them as local date
    // if they represent a full day (midnight). 
    // This neutralizes the "one day off" issue when parsing UTC dates in local time.
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
    }

    return d;
}
export function getFaviconUrl(url?: string): string | undefined {
    if (!url) return undefined;
    try {
        let domain = url.trim();
        if (!domain.startsWith('http')) {
            domain = 'https://' + domain;
        }
        const urlObj = new URL(domain);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch (e) {
        return undefined;
    }
}

export function hexToRgba(hex: string | undefined, alpha: number): string {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`;
    if (hex.startsWith('rgba')) return hex;

    let r = 0, g = 0, b = 0;
    
    // Remove # if present
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

    if (cleanHex.length === 3) {
        r = parseInt(cleanHex[0] + cleanHex[0], 16);
        g = parseInt(cleanHex[1] + cleanHex[1], 16);
        b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
        r = parseInt(cleanHex.slice(0, 2), 16);
        g = parseInt(cleanHex.slice(2, 4), 16);
        b = parseInt(cleanHex.slice(4, 6), 16);
    } else {
        return `rgba(0, 0, 0, ${alpha})`;
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Comprime uma imagem via Canvas no Client-side para reduzir o tamanho do Base64.
 * Redimensiona proporcionalmente se exceder o maxWidth/maxHeight.
 */
export async function compressImage(
    file: File | string,
    maxWidth: number = 1920,
    maxHeight: number = 1080,
    quality: number = 0.7
): Promise<string> {
    return new Promise((resolve, reject) => {
        const process = (src: string) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error("Não foi possível obter o contexto do Canvas"));

                // Desenha a imagem no canvas redimensionada
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converte para WebP (muito menor que PNG/JPG)
                // O navegador faz fallback automático se não suportar webp (raro hoje em dia)
                const result = canvas.toDataURL('image/webp', quality);
                resolve(result);
            };
            img.onerror = (e) => reject(new Error("Falha ao carregar a imagem para compressão"));
        };

        if (typeof file === 'string') {
            process(file);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => process(e.target?.result as string);
            reader.onerror = (e) => reject(new Error("Falha ao ler o arquivo de imagem"));
            reader.readAsDataURL(file);
        }
    });
}
/**
 * Normaliza URLs de arquivos, tratando Base64 puro para Data URLs.
 */
export function normalizeFileUrl(fileUrl: string | undefined | null, fileName: string = ''): string {
    if (!fileUrl) return '';
    if (!fileUrl.startsWith('http') && !fileUrl.startsWith('data:') && !fileUrl.startsWith('blob:')) {
        if (fileName.toLowerCase().endsWith('.pdf')) {
            return `data:application/pdf;base64,${fileUrl}`;
        } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => fileName.toLowerCase().endsWith(ext))) {
            const ext = fileName.split('.').pop()?.toLowerCase();
            return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${fileUrl}`;
        }
    }
    return fileUrl;
}

/**
 * Retorna uma URL segura mapeada pelo proxy interno para contornar headers de download
 * e forçar a exibição in-line do arquivo no navegador.
 */
export const getSafeProxyUrl = (url: string | undefined | null) => {
    if (!url) return '';
    if (url.startsWith('http') && !url.includes('localhost') && !url.includes('polaryon.com.br')) {
        return `/api/kanban/file-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
};
/**
 * Abre um arquivo em uma nova aba com segurança.
 * Se for Base64 (Data URL), converte para Blob URL para evitar bloqueios do navegador.
 * Se for HTTP externo, utiliza o proxy de segurança.
 */
export async function openFileInNewTab(fileUrl: string | undefined | null, fileName: string = '') {
    if (!fileUrl) return;
    
    // 1. Normalizar (tratar base64 puro -> data url se necessário)
    const normalized = normalizeFileUrl(fileUrl, fileName);
    
    // 2. Se for Data URL, converter para Blob para contornar restrições de navegação do browser
    if (normalized.startsWith('data:')) {
        try {
            // Extrair mime type da data url
            const mimeMatch = normalized.match(/^data:([^;]+);/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            
            // Converter data URL para array buffer
            const base64Content = normalized.split(',')[1];
            const binaryString = window.atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const blob = new Blob([bytes], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
            
            // Nota: O ideal seria revogar, mas como abre em nova aba, mantemos para visualização
        } catch (e) {
            console.error("Erro ao converter data URL para blob:", e);
            window.open(normalized, '_blank'); // Fallback (provavelmente será bloqueado pelo browser)
        }
    } else {
        // Se for URL externa, usar proxy e abrir normalmente
        window.open(getSafeProxyUrl(normalized), '_blank');
    }
}
