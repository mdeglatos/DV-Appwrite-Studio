
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CloseIcon, WarningIcon, FilterIcon, DeleteIcon, CheckIcon, LoadingSpinnerIcon } from '../../Icons';

// ============================================================================
// Types
// ============================================================================

export interface CleanupFilter {
    id: string;
    label: string;
    type: 'select' | 'text' | 'date' | 'number';
    options?: { label: string; value: string }[];
    placeholder?: string;
    description?: string;
}

export interface CleanupPreset {
    label: string;
    description: string;
    filters: Record<string, any>;
}

export interface CleanupAction<T> {
    id: string;
    label: string;
    variant: 'danger' | 'warning' | 'info';
    confirmPhrase: (count: number) => string;
    execute: (items: T[], options?: any) => Promise<{ success: number; failed: number }>;
    /** Extra options specific to this action (e.g. "label to add") */
    options?: CleanupFilter[];
}

export interface CleanupConfig<T> {
    resourceName: string;
    resourceNameSingular?: string;
    filters: CleanupFilter[];
    presets: CleanupPreset[];
    fetchAll: () => Promise<T[]>;
    filterFn: (item: T, filters: Record<string, any>) => boolean;
    renderPreviewRow: (item: T) => React.ReactNode;
    getItemId: (item: T) => string;
    actions: CleanupAction<T>[];
}

interface CleanupModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
    config: CleanupConfig<T>;
    onComplete?: () => void;
}

// ============================================================================
// Component
// ============================================================================

type Phase = 'configure' | 'preview' | 'confirm' | 'executing' | 'done';

export function CleanupModal<T>({ isOpen, onClose, config, onComplete }: CleanupModalProps<T>) {
    const [phase, setPhase] = useState<Phase>('configure');
    const [filterValues, setFilterValues] = useState<Record<string, any>>({});
    const [allItems, setAllItems] = useState<T[]>([]);
    const [matchedItems, setMatchedItems] = useState<T[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [selectedActionId, setSelectedActionId] = useState<string>(config.actions[0]?.id || '');
    const [confirmInput, setConfirmInput] = useState('');
    const [actionOptions, setActionOptions] = useState<Record<string, any>>({});

    // Execution
    const [progress, setProgress] = useState({ done: 0, total: 0, success: 0, failed: 0 });
    const cancelRef = useRef(false);

    const selectedAction = config.actions.find(a => a.id === selectedActionId);
    const confirmPhrase = selectedAction ? selectedAction.confirmPhrase(matchedItems.length) : '';

    // Reset on open/config change
    useEffect(() => {
        if (isOpen) {
            setPhase('configure');
            setFilterValues({});
            setAllItems([]);
            setMatchedItems([]);
            setIsFetching(false);
            setConfirmInput('');
            setActionOptions({});
            setProgress({ done: 0, total: 0, success: 0, failed: 0 });
            cancelRef.current = false;
            setSelectedActionId(config.actions[0]?.id || '');
        }
    }, [isOpen, config]);

    const setFilter = useCallback((id: string, value: any) => {
        setFilterValues(prev => ({ ...prev, [id]: value }));
    }, []);

    const applyPreset = useCallback((preset: CleanupPreset) => {
        setFilterValues(preset.filters);
    }, []);

    const handlePreview = useCallback(async () => {
        setIsFetching(true);
        try {
            const items = await config.fetchAll();
            setAllItems(items);
            const matched = items.filter(item => config.filterFn(item, filterValues));
            setMatchedItems(matched);
            setPhase('preview');
        } catch (err) {
            console.error('Cleanup fetch error:', err);
        } finally {
            setIsFetching(false);
        }
    }, [config, filterValues]);

    const handleExecute = useCallback(async () => {
        if (!selectedAction) return;
        setPhase('executing');
        cancelRef.current = false;

        const total = matchedItems.length;
        setProgress({ done: 0, total, success: 0, failed: 0 });

        // Batch in groups of 25 - use sequential batches for rate limiting
        const BATCH_SIZE = 25;
        let success = 0;
        let failed = 0;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            if (cancelRef.current) break;

            const batch = matchedItems.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(item => selectedAction.execute([item], actionOptions))
            );

            for (const r of results) {
                if (r.status === 'fulfilled') {
                    success += r.value.success;
                    failed += r.value.failed;
                } else {
                    failed += 1;
                }
            }

            setProgress({ done: Math.min(i + BATCH_SIZE, total), total, success, failed });
        }

        setProgress({ done: total, total, success, failed });
        setPhase('done');
    }, [selectedAction, matchedItems, actionOptions]);

    const handleCancel = () => {
        cancelRef.current = true;
    };

    const handleDone = () => {
        onComplete?.();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={phase === 'executing' ? undefined : onClose} />
            
            {/* Modal */}
            <div className="relative bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <FilterIcon size={18} className="text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-100">Cleanup: {config.resourceName}</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {phase === 'configure' && 'Configure filters to select items'}
                                {phase === 'preview' && `${matchedItems.length} items match your criteria`}
                                {phase === 'confirm' && 'Confirm the operation'}
                                {phase === 'executing' && 'Executing...'}
                                {phase === 'done' && 'Operation complete'}
                            </p>
                        </div>
                    </div>
                    {phase !== 'executing' && (
                        <button onClick={phase === 'done' ? handleDone : onClose} className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
                            <CloseIcon size={18} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* PHASE: CONFIGURE */}
                    {phase === 'configure' && (
                        <div className="space-y-6">
                            {/* Presets */}
                            {config.presets.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Presets</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {config.presets.map(preset => (
                                            <button
                                                key={preset.label}
                                                onClick={() => applyPreset(preset)}
                                                className="text-left p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-cyan-500/30 hover:bg-gray-800 transition-all group"
                                            >
                                                <span className="text-sm font-medium text-gray-200 group-hover:text-cyan-300 transition-colors">{preset.label}</span>
                                                <span className="text-xs text-gray-500 block mt-0.5">{preset.description}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Filters */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Filter Criteria</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {config.filters.map(filter => (
                                        <div key={filter.id}>
                                            <label className="text-xs font-medium text-gray-400 mb-1 block">{filter.label}</label>
                                            {filter.type === 'select' ? (
                                                <select
                                                    value={filterValues[filter.id] ?? ''}
                                                    onChange={(e) => setFilter(filter.id, e.target.value || undefined)}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500 transition-colors"
                                                >
                                                    <option value="">Any</option>
                                                    {filter.options?.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            ) : filter.type === 'date' ? (
                                                <input
                                                    type="date"
                                                    value={filterValues[filter.id] ?? ''}
                                                    onChange={(e) => setFilter(filter.id, e.target.value || undefined)}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500 transition-colors"
                                                />
                                            ) : filter.type === 'number' ? (
                                                <input
                                                    type="number"
                                                    placeholder={filter.placeholder}
                                                    value={filterValues[filter.id] ?? ''}
                                                    onChange={(e) => setFilter(filter.id, e.target.value ? Number(e.target.value) : undefined)}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500 transition-colors"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    placeholder={filter.placeholder}
                                                    value={filterValues[filter.id] ?? ''}
                                                    onChange={(e) => setFilter(filter.id, e.target.value || undefined)}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500 transition-colors"
                                                />
                                            )}
                                            {filter.description && (
                                                <span className="text-[10px] text-gray-600 mt-1 block">{filter.description}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Selector */}
                            {config.actions.length > 1 && (
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Action</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {config.actions.map(action => (
                                            <button
                                                key={action.id}
                                                onClick={() => setSelectedActionId(action.id)}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                                                    selectedActionId === action.id
                                                        ? action.variant === 'danger'
                                                            ? 'bg-red-500/10 border-red-500/50 text-red-300'
                                                            : action.variant === 'warning'
                                                            ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300'
                                                            : 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                                                }`}
                                            >
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action-specific options */}
                            {selectedAction?.options && selectedAction.options.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Action Options</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedAction.options.map(opt => (
                                            <div key={opt.id}>
                                                <label className="text-xs font-medium text-gray-400 mb-1 block">{opt.label}</label>
                                                <input
                                                    type={opt.type === 'number' ? 'number' : 'text'}
                                                    placeholder={opt.placeholder}
                                                    value={actionOptions[opt.id] ?? ''}
                                                    onChange={(e) => setActionOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500 transition-colors"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PHASE: PREVIEW */}
                    {phase === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm">
                                <WarningIcon size={16} />
                                <span className="font-medium text-gray-200">
                                    {matchedItems.length === 0
                                        ? 'No items match your criteria.'
                                        : `${matchedItems.length} ${matchedItems.length === 1 ? (config.resourceNameSingular || config.resourceName) : config.resourceName} found matching your criteria:`
                                    }
                                </span>
                            </div>
                            {matchedItems.length > 0 && (
                                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950/50 custom-scrollbar">
                                    <table className="w-full">
                                        <tbody className="divide-y divide-gray-800/50">
                                            {matchedItems.slice(0, 100).map(item => (
                                                <tr key={config.getItemId(item)} className="text-xs text-gray-400">
                                                    {config.renderPreviewRow(item)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {matchedItems.length > 100 && (
                                        <div className="p-3 text-center text-xs text-gray-600 border-t border-gray-800">
                                            ... and {matchedItems.length - 100} more
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PHASE: CONFIRM */}
                    {phase === 'confirm' && (
                        <div className="space-y-5">
                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                                <p className="text-sm text-red-300 font-medium flex items-center gap-2">
                                    <WarningIcon size={16} /> This action cannot be undone.
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    You are about to {selectedAction?.label.toLowerCase()} <strong className="text-white">{matchedItems.length}</strong> {config.resourceName.toLowerCase()}.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-400 mb-2 block">
                                    Type <span className="font-mono text-cyan-400">{confirmPhrase}</span> to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={confirmInput}
                                    onChange={(e) => setConfirmInput(e.target.value)}
                                    placeholder={confirmPhrase}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 font-mono outline-none focus:border-red-500 transition-colors"
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    {/* PHASE: EXECUTING */}
                    {phase === 'executing' && (
                        <div className="space-y-5">
                            <div className="text-center py-4">
                                <LoadingSpinnerIcon size={32} className="text-cyan-400 mx-auto mb-4" />
                                <p className="text-sm text-gray-300 font-medium">
                                    Processing {progress.done} of {progress.total}...
                                </p>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>✅ {progress.success} succeeded</span>
                                {progress.failed > 0 && <span className="text-red-400">❌ {progress.failed} failed</span>}
                            </div>
                        </div>
                    )}

                    {/* PHASE: DONE */}
                    {phase === 'done' && (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                                <CheckIcon size={28} className="text-green-400" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-gray-100">Cleanup Complete</p>
                                <p className="text-sm text-gray-400 mt-1">{progress.success} {config.resourceName.toLowerCase()} processed successfully.</p>
                                {progress.failed > 0 && (
                                    <p className="text-sm text-red-400 mt-1">{progress.failed} items failed.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/50">
                    {/* Left side */}
                    <div>
                        {phase === 'preview' && (
                            <button
                                onClick={() => setPhase('configure')}
                                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                ← Back to Filters
                            </button>
                        )}
                        {phase === 'confirm' && (
                            <button
                                onClick={() => setPhase('preview')}
                                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                ← Back to Preview
                            </button>
                        )}
                        {phase === 'executing' && (
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {phase !== 'executing' && phase !== 'done' && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                        {phase === 'configure' && (
                            <button
                                onClick={handlePreview}
                                disabled={isFetching}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors shadow-lg shadow-cyan-900/20 disabled:opacity-50"
                            >
                                {isFetching ? <LoadingSpinnerIcon size={14} /> : <FilterIcon size={14} />}
                                Preview Results
                            </button>
                        )}
                        {phase === 'preview' && matchedItems.length > 0 && (
                            <button
                                onClick={() => { setConfirmInput(''); setPhase('confirm'); }}
                                className={`flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-colors shadow-lg ${
                                    selectedAction?.variant === 'danger'
                                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
                                        : selectedAction?.variant === 'warning'
                                        ? 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-yellow-900/20'
                                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20'
                                }`}
                            >
                                <DeleteIcon size={14} />
                                {selectedAction?.label} ({matchedItems.length})
                            </button>
                        )}
                        {phase === 'confirm' && (
                            <button
                                onClick={handleExecute}
                                disabled={confirmInput !== confirmPhrase}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg shadow-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <DeleteIcon size={14} />
                                Confirm {selectedAction?.label}
                            </button>
                        )}
                        {phase === 'done' && (
                            <button
                                onClick={handleDone}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors shadow-lg shadow-green-900/20"
                            >
                                <CheckIcon size={14} />
                                Done
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
