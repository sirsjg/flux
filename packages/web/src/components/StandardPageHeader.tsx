import type { JSX } from 'preact';
import { ComponentChildren } from 'preact';

interface StandardPageHeaderProps {
    title: string;
    badge?: string; // e.g. "Active" badge next to title
    subtitle?: ComponentChildren; // e.g. "Day 8 of 42" or breadcrumb-like info
    toolbar?: ComponentChildren;
    className?: string;
}

export function StandardPageHeader({ title, badge, subtitle, toolbar, className = '' }: StandardPageHeaderProps): JSX.Element {
    return (
        <div className={`mb-6 ${className}`}>
            {/* Title Row */}
            <div className="flex items-center gap-3 mb-4">
                <h1 className="text-[24px] font-semibold text-text-high flex items-center gap-3 tracking-[-0.02em] mb-1">
                    {title}
                    {badge !== undefined && badge !== "" && (
                        <span className="text-xs bg-[#3ecf8e]/10 text-[#3ecf8e] px-2 py-1 rounded-xl font-semibold uppercase">
                            {badge}
                        </span>
                    )}
                </h1>
            </div>
            <div className="flex items-center gap-3 mb-4">
                {subtitle !== undefined && (
                    <h2 className="text-text-medium text-sm ml-1 font-medium">
                        {subtitle}
                    </h2>
                )}

            </div>

            {/* Toolbar Row */}
            {toolbar !== undefined && (
                <div className="flex items-center gap-3">
                    {toolbar}
                </div>
            )}
        </div>
    );
}
