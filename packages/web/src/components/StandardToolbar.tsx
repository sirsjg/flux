import { JSX, ComponentChildren, VNode } from 'preact';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

// --- Standard Search Bar ---
interface StandardSearchBarProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

export function StandardSearchBar({ value, onChange, placeholder = 'Search...' }: StandardSearchBarProps): JSX.Element {
    return (
        <div className="flex items-center gap-2">
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                className="bg-bg-surface border border-border-subtle px-3 py-2 rounded-md text-text-high text-[13px] w-[240px] outline-none focus:border-brand-primary placeholder:text-text-medium/50 transition-colors"
            />
            <button className="p-2 border border-border-subtle bg-bg-surface rounded-md text-text-medium hover:text-text-high hover:border-text-medium/30 transition-colors pointer-events-none">
                <MagnifyingGlassIcon className="w-4 h-4" />
            </button>
        </div>
    );
}

// --- Standard View Toggle ---
interface StandardViewToggleProps<T extends string = string> {
    value: T;
    onChange: (val: T) => void;
    options: { value: T; icon: JSX.Element; label?: string }[];
}

export function StandardViewToggle<T extends string = string>({ value, onChange, options }: StandardViewToggleProps<T>): JSX.Element {
    return (
        <div className="flex bg-bg-surface p-0.5 rounded-md border border-border-subtle">
            {options.map((opt) => {
                const isActive = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`px-2.5 py-1.5 border-none rounded transition-all duration-200 ${isActive
                            ? 'bg-bg-surface-hover text-text-high shadow-sm'
                            : 'bg-transparent text-text-medium hover:text-text-high'
                            }`}
                        title={opt.label !== undefined && opt.label !== '' ? opt.label : opt.value}
                    >
                        {opt.icon}
                    </button>
                );
            })}
        </div>
    );
}

// --- Standard Button (Secondary) ---
interface StandardButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
    children?: ComponentChildren;
    icon?: JSX.Element | VNode;
    variant?: 'secondary' | 'primary';
    onClick?: JSX.MouseEventHandler<HTMLButtonElement>;
}

export function StandardButton({ children, icon, variant = 'secondary', className = '', ...props }: StandardButtonProps): JSX.Element {
    const baseClasses = "flex items-center gap-1.5 h-9 px-3 rounded-md font-medium text-sm transition-colors";
    const variants = {
        secondary: "bg-bg-surface border border-border-subtle text-text-medium hover:text-text-high hover:border-text-medium/30",
        primary: "bg-brand-primary text-black border-none hover:opacity-90 px-4"
    };

    const classNameStr = typeof className === 'string' ? className : '';

    return (
        <button
            className={`${baseClasses} ${variants[variant]} ${classNameStr}`}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
}
