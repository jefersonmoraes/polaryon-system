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
