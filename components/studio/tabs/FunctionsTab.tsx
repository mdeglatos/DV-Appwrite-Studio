
import React, { useState, useEffect } from 'react';
import type { AppwriteFunction, AppwriteProject } from '../../../types';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { Breadcrumb } from '../ui/Breadcrumb';
// Removed unused and non-exported 'RiLinksLine'
import { CodeIcon, TerminalIcon, EyeIcon, DeleteIcon, RefreshIcon, CheckIcon, SettingsIcon, KeyIcon, ChevronDownIcon, ExternalLinkIcon, RiGlobalLine } from '../../Icons';
import { CopyButton } from '../ui/CopyButton';
import { consoleLinks } from '../../../services/appwrite';

interface FunctionsTabProps {
    activeProject: AppwriteProject;
    functions: AppwriteFunction[];
    selectedFunction: AppwriteFunction | null;
    deployments: Models.Deployment[];
    executions: Models.Execution[];
    
    onCreateFunction: () => void;
    onDeleteFunction: (f: AppwriteFunction) => void;
    onSelectFunction: (f: AppwriteFunction | null) => void;
    
    onActivateDeployment: (depId: string) => void;
    
    onDeleteAllExecutions: () => void;
    onViewExecution: (e: Models.Execution) => void;

    // Bulk Actions
    onBulkDeleteDeployments?: (deploymentIds: string[]) => void;
    onCleanupOldDeployments?: () => void;
    onRedeployAll?: () => void;
    
    // New prop for code editing
    onEditCode?: (f: AppwriteFunction) => void;
}

/**
 * Format bytes into human readable string
 */
const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const FunctionsTab: React.FC<FunctionsTabProps> = ({
    activeProject, functions, selectedFunction, deployments, executions,
    onCreateFunction, onDeleteFunction, onSelectFunction,
    onActivateDeployment,
    onDeleteAllExecutions, onViewExecution,
    onBulkDeleteDeployments,
    onCleanupOldDeployments,
    onRedeployAll,
    onEditCode
}) => {
    const [selectedDeploymentIds, setSelectedDeploymentIds] = useState<string[]>([]);

    // Reset selection when function changes
    useEffect(() => {
        setSelectedDeploymentIds([]);
    }, [selectedFunction?.$id]);

    if (!selectedFunction) {
        return (
            <ResourceTable<AppwriteFunction> 
                title="Functions" 
                data={functions} 
                onCreate={onCreateFunction} 
                onDelete={onDeleteFunction} 
                onSelect={(item) => onSelectFunction(item)} 
                createLabel="Create Function" 
                extraActions={
                    <div className="flex items-center gap-2 mr-2">
                        <a 
                            href={consoleLinks.functions(activeProject)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                        >
                            <ExternalLinkIcon size={14} /> Console
                        </a>
                        {onRedeployAll && (
                            <button 
                                onClick={onRedeployAll}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                <RefreshIcon size={14} /> Redeploy All
                            </button>
                        )}
                    </div>
                }
                renderExtra={(f) => (
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${f.enabled ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{f.runtime}</span>
                        {onEditCode && (
                             <button
                                onClick={(e) => { e.stopPropagation(); onEditCode(f); }}
                                className="flex items-center gap-1.5 px-2 py-1 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-800 text-purple-300 text-[10px] font-bold rounded transition-colors"
                            >
                                <CodeIcon size={12} /> Source
                            </button>
                        )}
                    </div>
                )}
            />
        );
    }

    return (
        <>
            <div className="flex justify-between items-start">
                <Breadcrumb items={[{ label: 'Functions', onClick: () => onSelectFunction(null) }, { label: selectedFunction.name }]} />
                <div className="flex gap-2">
                     <a 
                        href={consoleLinks.functionDomains(activeProject, selectedFunction.$id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-800 text-blue-300 rounded-lg text-xs font-bold transition-all"
                    >
                        <RiGlobalLine size={14} /> Domains
                    </a>
                    <a 
                        href={consoleLinks.function(activeProject, selectedFunction.$id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                    >
                        <ExternalLinkIcon size={14} /> View in Console
                    </a>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-gray-900/30 p-4 rounded-xl border border-gray-800/50">
                <div className="flex items-center gap-4">
                     <div>
                        <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                            {selectedFunction.name}
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${selectedFunction.enabled ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-red-900/20 text-red-400 border-red-900/50'}`}>
                                {selectedFunction.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </h2>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-mono">
                            <span className="flex items-center gap-2 group">
                                {selectedFunction.$id}
                                <CopyButton text={selectedFunction.$id} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                            <span>•</span>
                            <span>{selectedFunction.runtime}</span>
                        </div>
                     </div>
                </div>
                 {onEditCode && (
                    <button
                        onClick={() => onEditCode(selectedFunction)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-purple-900/20 transition-all transform hover:scale-105"
                    >
                        <CodeIcon size={16} /> Edit Source & Deploy
                    </button>
                )}
            </div>

            <div className="space-y-8">
                <ResourceTable<Models.Deployment> 
                    title="Deployments" 
                    data={deployments} 
                    selection={{
                        selectedIds: selectedDeploymentIds,
                        onSelectionChange: setSelectedDeploymentIds
                    }}
                    headers={['Status & ID', 'Build Settings', 'Metadata', 'Action']}
                    autoHeight
                    isRowActive={(d) => d.$id === selectedFunction.deployment}
                    extraActions={
                        <div className="flex items-center gap-2">
                            {onCleanupOldDeployments && deployments.length > 1 && (
                                <button 
                                    onClick={onCleanupOldDeployments}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-red-900/40 border border-gray-700 hover:border-red-800 text-gray-400 hover:text-red-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                    <DeleteIcon size={14} /> Cleanup Old
                                </button>
                            )}
                            {selectedDeploymentIds.length > 0 && onBulkDeleteDeployments && (
                                <button 
                                    onClick={() => {
                                        onBulkDeleteDeployments(selectedDeploymentIds);
                                        setSelectedDeploymentIds([]);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                    <DeleteIcon size={14} /> Delete ({selectedDeploymentIds.length})
                                </button>
                            )}
                        </div>
                    }
                    renderName={(d) => {
                        const isActive = d.$id === selectedFunction.deployment;
                        return (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                        d.status === 'ready' ? 'bg-green-900/30 text-green-400' : 
                                        d.status === 'failed' ? 'bg-red-900/30 text-red-400' : 
                                        'bg-yellow-900/30 text-yellow-400'
                                    }`}>
                                        {d.status}
                                    </span>
                                    <span className="font-mono text-xs text-gray-400 group-hover:text-gray-200 transition-colors">{d.$id}</span>
                                    {isActive && (
                                        <span className="text-[10px] bg-cyan-500 text-black px-2 py-0.5 rounded font-black shadow-[0_0_15px_rgba(6,182,212,0.5)] flex items-center gap-1 animate-pulse">
                                            <CheckIcon size={10} /> ACTIVE
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-600 flex items-center gap-2">
                                    <span className="font-mono">{new Date(d.$createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        );
                    }}
                    renderExtra={(d) => {
                        const isActive = d.$id === selectedFunction.deployment;
                        // Use .size (compressed size) or .sizeOriginal (uncompressed) if needed
                        const sizeToDisplay = (d as any).size ?? (d as any).sizeOriginal ?? 0;
                        
                        return (
                            <div className="flex items-center justify-between w-full pr-4">
                                {/* Build Info */}
                                <div className="flex flex-col gap-1 min-w-[180px]">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                                        <CodeIcon size={12} className="text-purple-400 opacity-70" />
                                        <span className="truncate" title={d.entrypoint}>{d.entrypoint}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 italic">
                                        <TerminalIcon size={10} />
                                        {/* Fix: Cast d to any to access commands property which might be missing in some SDK type definitions */}
                                        <span className="truncate" title={(d as any).commands}>{(d as any).commands || 'No build command'}</span>
                                    </div>
                                </div>

                                {/* Metadata & Action */}
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold text-gray-300">{formatBytes(sizeToDisplay)}</span>
                                        <span className="text-[10px] text-gray-600 uppercase tracking-tighter">Size</span>
                                    </div>

                                    <div className="w-24 flex justify-end">
                                        {isActive ? (
                                            <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest border border-cyan-900/50 px-2 py-1 rounded bg-cyan-950/20">Current</span>
                                        ) : d.status === 'ready' ? (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onActivateDeployment(d.$id); }} 
                                                className="text-[10px] bg-gray-800 hover:bg-cyan-600 border border-gray-700 hover:border-cyan-500 px-3 py-1 rounded text-white transition-all font-bold uppercase shadow-sm active:scale-95"
                                            >
                                                Activate
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-gray-600 font-bold uppercase italic opacity-50">{d.status}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }}
                />
                
                <ResourceTable<Models.Execution> 
                    title="Executions (Logs)" 
                    data={executions} 
                    autoHeight
                    extraActions={
                        executions.length > 0 && (
                            <button 
                                onClick={onDeleteAllExecutions}
                                className="flex items-center gap-2 px-2 py-1 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-300 text-[10px] font-bold rounded-lg transition-colors"
                            >
                                <DeleteIcon size={12} /> Clear All
                            </button>
                        )
                    }
                    renderName={(e) => <span className="flex items-center gap-2"><TerminalIcon size={14}/> <span className="font-mono">{e.$id}</span></span>}
                    renderExtra={(e) => (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-gray-500">{new Date(e.$createdAt).toLocaleString()}</span>
                                <span className={`text-[10px] ${e.status === 'completed' ? 'text-green-400' : e.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                                    {e.status} ({e.duration.toFixed(3)}s)
                                </span>
                            </div>
                            <button 
                                onClick={(ev) => { ev.stopPropagation(); onViewExecution(e); }}
                                className="ml-2 p-1 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors"
                                title="View Logs"
                            >
                                <EyeIcon size={14} />
                            </button>
                        </div>
                    )}
                />
            </div>
        </>
    );
};
