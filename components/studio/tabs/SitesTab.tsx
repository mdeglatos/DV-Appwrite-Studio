
import React, { useState } from 'react';
import type { AppwriteSite, AppwriteProject } from '../../../types';
import type { Models } from 'node-appwrite';
import type { PaginatedState } from '../hooks/usePaginatedQuery';
import { SitesIcon, AddIcon, DeleteIcon, ArrowLeftIcon, ExternalLinkIcon, CheckIcon, EditIcon, KeyIcon, RefreshIcon, SettingsIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import { CopyButton } from '../ui/CopyButton';
import { PaginationFooter } from '../ui/PaginationFooter';

type SiteDetailSubTab = 'deployments' | 'variables' | 'logs';

interface SitesTabProps {
    activeProject: AppwriteProject;
    sites: AppwriteSite[];
    selectedSite: AppwriteSite | null;
    siteDeployments: Models.Deployment[];
    siteVariables: Models.Variable[];
    siteLogs: any[];
    onSelectSite: (site: AppwriteSite | null) => void;
    onCreateSite: () => void;
    onDeleteSite: (site: AppwriteSite) => void;
    onUpdateSite: (site: AppwriteSite) => void;
    onActivateDeployment: (depId: string) => void;
    onCancelDeployment: (depId: string) => void;
    onDeleteDeployment: (depId: string) => void;
    onBulkDeleteDeployments: (depIds: string[]) => void;
    onCreateVariable: () => void;
    onUpdateVariable: (v: Models.Variable) => void;
    onDeleteVariable: (v: Models.Variable) => void;
    siteDeploymentsPagination: PaginatedState<Models.Deployment>;
    siteLogsPagination: PaginatedState<any>;
    onRefresh: () => void;
}

const STATUS_THEME: Record<string, { bg: string; text: string; ring: string }> = {
    active: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
    ready: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', ring: 'ring-cyan-500/30' },
    building: { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30' },
    processing: { bg: 'bg-blue-500/15', text: 'text-blue-400', ring: 'ring-blue-500/30' },
    waiting: { bg: 'bg-gray-500/15', text: 'text-gray-400', ring: 'ring-gray-500/30' },
    failed: { bg: 'bg-red-500/15', text: 'text-red-400', ring: 'ring-red-500/30' },
};

function DeploymentStatusBadge({ status }: { status: string }) {
    const theme = STATUS_THEME[status] || STATUS_THEME.waiting;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'building' ? 'animate-pulse' : ''} ${theme.text.replace('text-', 'bg-')}`} />
            {status}
        </span>
    );
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function frameworkLabel(fw: string): string {
    const map: Record<string, string> = {
        nextjs: 'Next.js', nuxt: 'Nuxt', sveltekit: 'SvelteKit', astro: 'Astro',
        remix: 'Remix', angular: 'Angular', react: 'React', vue: 'Vue',
        static: 'Static', analog: 'Analog', flutter: 'Flutter',
    };
    return map[fw?.toLowerCase()] || fw || 'Unknown';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SitesTab: React.FC<SitesTabProps> = ({
    activeProject, sites, selectedSite,
    siteDeployments, siteVariables, siteLogs,
    onSelectSite, onCreateSite, onDeleteSite, onUpdateSite,
    onActivateDeployment, onCancelDeployment, onDeleteDeployment, onBulkDeleteDeployments,
    onCreateVariable, onUpdateVariable, onDeleteVariable,
    siteDeploymentsPagination, siteLogsPagination,
    onRefresh,
}) => {
    const [subTab, setSubTab] = useState<SiteDetailSubTab>('deployments');
    const [selectedDepIds, setSelectedDepIds] = useState<Set<string>>(new Set());

    // Reset sub-tab when site changes
    React.useEffect(() => {
        setSubTab('deployments');
        setSelectedDepIds(new Set());
    }, [selectedSite?.$id]);

    // ========================================================================
    // SITES LIST VIEW
    // ========================================================================
    if (!selectedSite) {
        return (
            <>
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-100">Sites</h1>
                    <div className="flex items-center gap-2">
                        <a 
                            href={consoleLinks.sites(activeProject)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                        >
                            <ExternalLinkIcon size={14} /> Console
                        </a>
                        <button
                            onClick={onCreateSite}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-all"
                        >
                            <AddIcon size={16} /> New Site
                        </button>
                    </div>
                </header>

                {sites.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <SitesIcon size={48} className="text-gray-700 mb-4" />
                        <p className="text-lg font-semibold text-gray-400 mb-2">No Sites Yet</p>
                        <p className="text-sm text-gray-500 max-w-md mb-6">Deploy web applications directly on Appwrite. Host static or SSR sites with automatic SSL, CDN, and custom domains.</p>
                        <button onClick={onCreateSite} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-all">
                            Create Your First Site
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sites.map(site => (
                            <div
                                key={site.$id}
                                onClick={() => onSelectSite(site)}
                                className="group flex items-center justify-between p-4 bg-gray-900/40 hover:bg-gray-800/60 border border-gray-800/50 hover:border-cyan-800/30 rounded-xl cursor-pointer transition-all duration-200"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                        <SitesIcon size={18} className="text-cyan-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-100 truncate">{site.name}</p>
                                        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                                            <span className="font-medium text-gray-400">{frameworkLabel(site.framework)}</span>
                                            <span>•</span>
                                            <span className={site.enabled ? 'text-emerald-500' : 'text-red-400'}>{site.enabled ? 'Active' : 'Disabled'}</span>
                                            <span>•</span>
                                            <span>{formatDate(site.$createdAt)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onUpdateSite(site); }}
                                        className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-cyan-400 transition-colors"
                                        title="Settings"
                                    >
                                        <SettingsIcon size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSite(site); }}
                                        className="p-1.5 hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <DeleteIcon size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        );
    }

    // ========================================================================
    // SITE DETAIL VIEW
    // ========================================================================
    const isInProgress = (status: string) => ['building', 'processing', 'waiting'].includes(status);

    return (
        <>
            {/* Back + Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => onSelectSite(null)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                    <ArrowLeftIcon size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-gray-100 truncate">{selectedSite.name}</h1>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="font-medium text-cyan-400">{frameworkLabel(selectedSite.framework)}</span>
                        <span>•</span>
                        <span className="font-mono text-gray-400">{selectedSite.$id}</span>
                        <CopyButton text={selectedSite.$id} className="opacity-50 hover:opacity-100" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onRefresh} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-cyan-400 transition-colors" title="Refresh">
                        <RefreshIcon size={16} />
                    </button>
                    <button onClick={() => onUpdateSite(selectedSite)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all">
                        <SettingsIcon size={14} /> Settings
                    </button>
                    <a 
                        href={consoleLinks.site(activeProject, selectedSite.$id)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                    >
                        <ExternalLinkIcon size={12} /> Console
                    </a>
                </div>
            </div>

            {/* Info Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 bg-gray-900/40 border border-gray-800/50 rounded-xl p-4">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</span>
                    <span className={`text-sm font-semibold ${selectedSite.enabled ? 'text-emerald-400' : 'text-red-400'}`}>{selectedSite.enabled ? 'Active' : 'Disabled'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Build Runtime</span>
                    <span className="text-sm text-gray-300 font-mono">{selectedSite.buildRuntime}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Adapter</span>
                    <span className="text-sm text-gray-300 capitalize">{selectedSite.adapter || 'auto'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Timeout</span>
                    <span className="text-sm text-gray-300">{selectedSite.timeout}s</span>
                </div>
            </div>

            {/* Sub-Tab Nav */}
            <div className="flex items-center gap-1 mb-6 border-b border-gray-800">
                {([
                    { id: 'deployments' as const, label: `Deployments (${siteDeploymentsPagination.total})` },
                    { id: 'variables' as const, label: `Variables (${siteVariables.length})` },
                    { id: 'logs' as const, label: `Logs (${siteLogsPagination.total})` },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSubTab(tab.id)}
                        className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px ${
                            subTab === tab.id
                                ? 'text-cyan-400 border-cyan-400'
                                : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sub-Tab Content */}
            {subTab === 'deployments' && (
                <div className="space-y-3">
                    {/* Bulk actions */}
                    {selectedDepIds.size > 0 && (
                        <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
                            <span className="text-xs text-red-300 font-semibold">{selectedDepIds.size} selected</span>
                            <button
                                onClick={() => { onBulkDeleteDeployments(Array.from(selectedDepIds)); setSelectedDepIds(new Set()); }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded transition-all"
                            >
                                Delete Selected
                            </button>
                            <button onClick={() => setSelectedDepIds(new Set())} className="text-xs text-gray-400 hover:text-white">Clear</button>
                        </div>
                    )}

                    {siteDeployments.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-sm">No deployments yet. Deploy from Git or upload a manual build.</div>
                    ) : (
                        siteDeployments.map(dep => {
                            const isActive = dep.$id === selectedSite.deploymentId;
                            return (
                                <div key={dep.$id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isActive ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-gray-900/40 border-gray-800/50 hover:border-gray-700'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedDepIds.has(dep.$id)}
                                        onChange={e => {
                                            const next = new Set(selectedDepIds);
                                            e.target.checked ? next.add(dep.$id) : next.delete(dep.$id);
                                            setSelectedDepIds(next);
                                        }}
                                        className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-mono text-gray-200 truncate">{dep.$id.substring(0, 12)}...</span>
                                            {isActive && <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/15 px-1.5 py-0.5 rounded">Live</span>}
                                            <DeploymentStatusBadge status={dep.status} />
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                            <span>{formatDate(dep.$createdAt)}</span>
                                            {dep.size > 0 && <span>{formatSize(dep.size)}</span>}
                                            {dep.buildTime > 0 && <span>Build: {dep.buildTime}s</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {!isActive && dep.status === 'ready' && (
                                            <button onClick={() => onActivateDeployment(dep.$id)} className="p-1.5 hover:bg-emerald-900/30 rounded-lg text-gray-400 hover:text-emerald-400 transition-colors" title="Activate">
                                                <CheckIcon size={14} />
                                            </button>
                                        )}
                                        {isInProgress(dep.status) && (
                                            <button onClick={() => onCancelDeployment(dep.$id)} className="px-2 py-1 text-[10px] font-bold text-amber-400 hover:bg-amber-900/20 rounded transition-colors" title="Cancel Build">
                                                Cancel
                                            </button>
                                        )}
                                        {!isActive && (
                                            <button onClick={() => onDeleteDeployment(dep.$id)} className="p-1.5 hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                                                <DeleteIcon size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <PaginationFooter
                        page={siteDeploymentsPagination.page}
                        pageSize={siteDeploymentsPagination.pageSize}
                        total={siteDeploymentsPagination.total}
                        totalPages={siteDeploymentsPagination.totalPages}
                        hasNextPage={siteDeploymentsPagination.hasNextPage}
                        hasPrevPage={siteDeploymentsPagination.hasPrevPage}
                        pageInfo={siteDeploymentsPagination.pageInfo}
                        onNextPage={siteDeploymentsPagination.nextPage}
                        onPrevPage={siteDeploymentsPagination.prevPage}
                        onPageSizeChange={siteDeploymentsPagination.setPageSize}
                        isLoading={siteDeploymentsPagination.isLoading}
                    />
                </div>
            )}

            {subTab === 'variables' && (
                <div className="space-y-3">
                    <div className="flex justify-end mb-2">
                        <button onClick={onCreateVariable} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-all">
                            <AddIcon size={14} /> Add Variable
                        </button>
                    </div>
                    {siteVariables.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-sm">No environment variables configured. Variables are available during build and runtime.</div>
                    ) : (
                        <div className="bg-gray-900/40 border border-gray-800/50 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-800">
                                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Key</th>
                                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Value</th>
                                        <th className="text-right px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {siteVariables.map(v => (
                                        <tr key={v.$id} className="border-b border-gray-800/50 last:border-b-0 hover:bg-gray-800/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-cyan-300 flex items-center gap-2">
                                                <KeyIcon size={12} className="text-gray-600" />
                                                {v.key}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-400 truncate max-w-[300px]">{v.value || '••••••'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => onUpdateVariable(v)} className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-cyan-400 transition-colors" title="Edit">
                                                        <EditIcon size={12} />
                                                    </button>
                                                    <button onClick={() => onDeleteVariable(v)} className="p-1 hover:bg-red-900/30 rounded text-gray-500 hover:text-red-400 transition-colors" title="Delete">
                                                        <DeleteIcon size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {subTab === 'logs' && (
                <div className="space-y-3">
                    {siteLogs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-sm">No request logs yet. Logs appear after your site receives traffic.</div>
                    ) : (
                        <div className="bg-gray-900/40 border border-gray-800/50 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-800">
                                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Method</th>
                                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Path</th>
                                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {siteLogs.map((log: any) => {
                                        const statusColor = log.responseStatusCode >= 500 ? 'text-red-400' 
                                            : log.responseStatusCode >= 400 ? 'text-amber-400' 
                                            : log.responseStatusCode >= 300 ? 'text-blue-400' 
                                            : 'text-emerald-400';
                                        return (
                                            <tr key={log.$id} className="border-b border-gray-800/50 last:border-b-0 hover:bg-gray-800/30 transition-colors">
                                                <td className="px-4 py-2.5 font-mono text-xs text-gray-300 font-bold">{log.requestMethod || 'GET'}</td>
                                                <td className="px-4 py-2.5 font-mono text-xs text-gray-400 truncate max-w-[300px]">{log.requestPath || '/'}</td>
                                                <td className={`px-4 py-2.5 font-mono text-xs font-bold ${statusColor}`}>{log.responseStatusCode || '—'}</td>
                                                <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{log.duration ? `${(log.duration * 1000).toFixed(0)}ms` : '—'}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(log.$createdAt)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <PaginationFooter
                        page={siteLogsPagination.page}
                        pageSize={siteLogsPagination.pageSize}
                        total={siteLogsPagination.total}
                        totalPages={siteLogsPagination.totalPages}
                        hasNextPage={siteLogsPagination.hasNextPage}
                        hasPrevPage={siteLogsPagination.hasPrevPage}
                        pageInfo={siteLogsPagination.pageInfo}
                        onNextPage={siteLogsPagination.nextPage}
                        onPrevPage={siteLogsPagination.prevPage}
                        onPageSizeChange={siteLogsPagination.setPageSize}
                        isLoading={siteLogsPagination.isLoading}
                    />
                </div>
            )}
        </>
    );
};
