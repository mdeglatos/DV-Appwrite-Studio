
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Database, Collection, Bucket, AppwriteFunction, AppwriteProject } from '../types';
import { LoadingSpinnerIcon, RefreshIcon, ChevronDownIcon, AddIcon, ExternalLinkIcon } from './Icons';
import { consoleLinks } from '../services/appwrite';

interface ContextBarProps {
    activeProject?: AppwriteProject | null;
    databases: Database[];
    collections: Collection[];
    buckets: Bucket[];
    functions: AppwriteFunction[];
    selectedDatabase: Database | null;
    selectedCollection: Collection | null;
    selectedBucket: Bucket | null;
    selectedFunction: AppwriteFunction | null;
    onDatabaseSelect: (db: Database | null) => void;
    onCollectionSelect: (collection: Collection | null) => void;
    onBucketSelect: (bucket: Bucket | null) => void;
    onFunctionSelect: (fn: AppwriteFunction | null) => void;
    isLoading: boolean;
    onRefresh: () => void;
    onAddFunction?: () => void;
}

// Custom Dropdown Component
interface CustomDropdownProps {
    value: string;
    onSelect: (id: string) => void;
    options: { $id: string; name: string }[];
    placeholder: string;
    disabled?: boolean;
    onConsoleLink?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ value, onSelect, options, placeholder, disabled, onConsoleLink }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{top: number, left: number, width: number, maxHeight: number} | null>(null);
    const selectedItem = options.find(o => o.$id === value);

    const toggleOpen = () => {
        if (disabled) return;
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom - 16;
            setCoords({
                top: rect.bottom + 6,
                left: rect.left,
                width: Math.max(rect.width, 256),
                maxHeight: Math.max(spaceBelow, 100)
            });
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = (e: Event) => {
            if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
            setIsOpen(false);
        };
        const handleResize = () => setIsOpen(false);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);

    return (
        <div className="relative flex items-center gap-1" ref={containerRef}>
            <div className="relative">
                <button
                    onClick={toggleOpen}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 min-w-[140px] justify-between
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        ${value 
                            ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200 shadow-[0_0_10px_rgba(8,145,178,0.1)] hover:bg-cyan-900/50' 
                            : 'bg-gray-900/50 border-gray-700/50 text-gray-400 hover:border-gray-500 hover:text-gray-300'}
                    `}
                    disabled={disabled}
                >
                    <span className="text-xs font-medium truncate max-w-[120px]">
                        {selectedItem ? selectedItem.name : placeholder}
                    </span>
                    <ChevronDownIcon size={12} className={value ? 'text-cyan-500' : 'text-gray-600'} />
                </button>

                {isOpen && coords && createPortal(
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} aria-hidden="true" />
                        <div 
                            ref={dropdownRef}
                            className="fixed z-[9999] overflow-y-auto bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl custom-scrollbar p-1 animate-fade-in"
                            style={{
                                top: `${coords.top}px`,
                                left: `${Math.min(coords.left, window.innerWidth - 265)}px`,
                                width: `${Math.min(coords.width, 320)}px`,
                                maxHeight: `${coords.maxHeight}px`
                            }}
                        >
                            {options.length > 0 ? (
                                <>
                                    <button
                                        onClick={() => { onSelect(''); setIsOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors italic"
                                    >
                                        None
                                    </button>
                                    {options.map(opt => (
                                        <button
                                            key={opt.$id}
                                            onClick={() => { onSelect(opt.$id); setIsOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors mb-0.5 ${value === opt.$id ? 'bg-cyan-900/30 text-cyan-300 font-medium' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            {opt.name}
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <div className="px-3 py-3 text-xs text-gray-500 text-center italic">No items found</div>
                            )}
                        </div>
                    </>,
                    document.body
                )}
            </div>
            
            {value && onConsoleLink && (
                <a 
                    href={onConsoleLink} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-1.5 text-gray-600 hover:text-cyan-400 transition-colors"
                    title="Open in Appwrite Console"
                >
                    <ExternalLinkIcon size={12} />
                </a>
            )}
        </div>
    );
};

export const ContextBar: React.FC<ContextBarProps> = ({
    activeProject,
    databases,
    collections,
    buckets,
    functions,
    selectedDatabase,
    selectedCollection,
    selectedBucket,
    selectedFunction,
    onDatabaseSelect,
    onCollectionSelect,
    onBucketSelect,
    onFunctionSelect,
    isLoading,
    onRefresh,
    onAddFunction,
}) => {

    return (
        <div className="flex-shrink-0 z-20 flex justify-center py-2 w-full px-4 border-b border-white/5 bg-gray-950/10">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-950/40 backdrop-blur-lg border border-white/10 rounded-full shadow-lg overflow-x-auto max-w-full custom-scrollbar">
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="p-1.5 rounded-full hover:bg-gray-800 text-gray-500 hover:text-cyan-400 transition-colors disabled:animate-spin"
                    title="Refresh Data"
                >
                    {isLoading ? <LoadingSpinnerIcon size={14} /> : <RefreshIcon size={14} />}
                </button>
                
                <div className="h-4 w-px bg-gray-700/50 mx-1"></div>

                <CustomDropdown
                    value={selectedDatabase?.$id || ''}
                    onSelect={(id) => onDatabaseSelect(databases.find(d => d.$id === id) || null)} 
                    options={databases} 
                    placeholder="Database" 
                    disabled={isLoading}
                    onConsoleLink={activeProject && selectedDatabase ? consoleLinks.database(activeProject, selectedDatabase.$id) : undefined}
                />
                
                {selectedDatabase && (
                    <CustomDropdown
                        value={selectedCollection?.$id || ''}
                        onSelect={(id) => onCollectionSelect(collections.find(c => c.$id === id) || null)} 
                        options={collections} 
                        placeholder="Collection" 
                        disabled={isLoading}
                        onConsoleLink={activeProject && selectedDatabase && selectedCollection ? consoleLinks.collection(activeProject, selectedDatabase.$id, selectedCollection.$id) : undefined}
                    />
                )}
                
                <div className="h-4 w-px bg-gray-700/50 mx-1"></div>

                <CustomDropdown
                    value={selectedBucket?.$id || ''}
                    onSelect={(id) => onBucketSelect(buckets.find(b => b.$id === id) || null)} 
                    options={buckets} 
                    placeholder="Bucket" 
                    disabled={isLoading}
                    onConsoleLink={activeProject && selectedBucket ? consoleLinks.bucket(activeProject, selectedBucket.$id) : undefined}
                />
                
                <div className="h-4 w-px bg-gray-700/50 mx-1"></div>
                
                <div className="flex items-center gap-1">
                    <CustomDropdown
                        value={selectedFunction?.$id || ''}
                        onSelect={(id) => onFunctionSelect(functions.find(f => f.$id === id) || null)} 
                        options={functions} 
                        placeholder="Function" 
                        disabled={isLoading}
                        onConsoleLink={activeProject && selectedFunction ? consoleLinks.function(activeProject, selectedFunction.$id) : undefined}
                    />
                     {onAddFunction && (
                        <button
                            onClick={onAddFunction}
                            className="p-1.5 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                            title="Create New Function"
                        >
                            <AddIcon size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
