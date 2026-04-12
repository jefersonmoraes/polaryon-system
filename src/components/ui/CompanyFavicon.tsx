import React from 'react';
import { Building2, Truck } from 'lucide-react';
import { cn, getFaviconUrl } from '@/lib/utils';
import { Company } from '@/types/kanban';

interface CompanyFaviconProps {
    company?: Company;
    className?: string;
    iconClassName?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const CompanyFavicon: React.FC<CompanyFaviconProps> = ({ 
    company, 
    className, 
    iconClassName,
    size = 'md' 
}) => {
    const faviconUrl = company?.customLink ? getFaviconUrl(company.customLink) : undefined;
    
    // Size mapping
    const sizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-7 h-7',
        lg: 'w-10 h-10'
    };
    
    const iconSizeClasses = {
        sm: 'h-3 w-3',
        md: 'h-4 w-4',
        lg: 'h-6 w-6'
    };

    const isTransporter = company?.type === 'Transportadora';
    const DefaultIcon = isTransporter ? Truck : Building2;
    const bgColor = isTransporter ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary';

    return (
        <div className={cn("relative shrink-0 flex items-center justify-center rounded-md overflow-hidden", sizeClasses[size], bgColor, className)}>
            <DefaultIcon className={cn(iconSizeClasses[size], iconClassName)} />
            
            {faviconUrl && (
                <img
                    src={faviconUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain bg-background"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                />
            )}
        </div>
    );
};
