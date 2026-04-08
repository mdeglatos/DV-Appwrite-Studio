
import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, CloseIcon } from '../../Icons';

interface ResourceSearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    total?: number;
    isLoading?: boolean;
    className?: string;
}

export const ResourceSearchBar: React.FC<ResourceSearchBarProps> = ({
    value,
    onChange,
    placeholder = 'Search...',
    total,
    isLoading = false,
    className = '',
}) => {
    const [localValue, setLocalValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync external value changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (newValue: string) => {
        setLocalValue(newValue);
        onChange(newValue);
    };

    const handleClear = () => {
        setLocalValue('');
        onChange('');
        inputRef.current?.focus();
    };

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500">
                    <SearchIcon size={14} />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={localValue}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                />
                {localValue && (
                    <button
                        onClick={handleClear}
                        className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                        title="Clear search"
                    >
                        <CloseIcon size={14} />
                    </button>
                )}
            </div>
            {total !== undefined && localValue.trim() && (
                <span className={`text-xs font-medium whitespace-nowrap ${isLoading ? 'text-gray-600' : 'text-gray-400'}`}>
                    {total.toLocaleString()} {total === 1 ? 'result' : 'results'}
                </span>
            )}
        </div>
    );
};
