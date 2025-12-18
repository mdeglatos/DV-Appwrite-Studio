
import React, { useState, useRef, useEffect } from 'react';
import type { AppwriteProject } from '../../../types';
import { MigrationService, type MigrationOptions, type MigrationPlan, type MigrationResource } from '../../../services/migrationService';
import { MigrationIcon, LoadingSpinnerIcon, WarningIcon, CheckIcon, ChevronDownIcon, ArrowLeftIcon, DatabaseIcon, StorageIcon, FunctionIcon, TeamIcon, UserIcon, DeleteIcon, RefreshIcon, RiRocketLine } from '../../Icons';

interface MigrationsTabProps {
    activeProject: AppwriteProject;
    projects: AppwriteProject[];
}

type Step = 'config' | 'preview' | 'executing';
type ExecutionStatus = 'running' | 'completed' | 'stopped' | 'error';

// Updated ResourceRow to handle a visual 'isRowDisabled' state
const ResourceRow = ({ label, id, name, enabled, onIdChange, onNameChange, onToggle, depth = 0, isRowDisabled = false }: any) => (
    <div 
        className={`grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center py-2 border-b border-gray-800/50 hover:bg-gray-800/20 px-2 transition-all ${isRowDisabled ? 'opacity-30 grayscale pointer-events-none' : ''}`} 
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
    >
        <div className="flex items-center gap-2 min-w-[150px]">
             <input 
                type="checkbox" 
                checked={enabled} 
                onChange={e => onToggle(e.target.checked)} 
                className="rounded bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500" 
                disabled={isRowDisabled}
             />
             <span className={`text-sm ${enabled && !isRowDisabled ? 'text-gray-300' : 'text-gray-600'}`}>{label}</span>
        </div>
        
        <input 
            type="text" value={id} onChange={e => onIdChange(e.target.value)} disabled={!enabled || isRowDisabled}
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:border-cyan-500 outline-none disabled:opacity-50"
            placeholder="Target ID"
        />
        
        <input 
            type="text" value={name} onChange={e => onNameChange(e.target.value)} disabled={!enabled || isRowDisabled}
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:border-cyan-500 outline-none disabled:opacity-50"
            placeholder="Target Name"
        />
        
        <div className="text-xs text-gray-600 w-6 text-center">
             {enabled && !isRowDisabled && <CheckIcon size={12} className="text-green-500 inline" />}
        </div>
    </div>
);

export const MigrationsTab: React.FC<MigrationsTabProps> = ({ activeProject, projects }) => {
    // Destination Config
    const [destEndpoint, setDestEndpoint] = useState('');
    const [destProjectId, setDestProjectId] = useState('');
    const [destApiKey, setDestApiKey] = useState('');
    const [selectedDestId, setSelectedDestId] = useState<string>('manual');

    // Options
    const [options, setOptions] = useState<MigrationOptions>({
        migrateDatabases: true,
        migrateStorage: true,
        migrateFunctions: true,
        migrateUsers: true,
        migrateTeams: true,
        migrateDocuments: true,
        migrateFiles: true,
        useCloudProxy: false,
    });

    // Workflow State
    const [step, setStep] = useState<Step>('config');
    const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('running');
    const [isLoading, setIsLoading] = useState(false);
    const [plan, setPlan] = useState<MigrationPlan | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [hasCheckpoint, setHasCheckpoint] = useState(false);
    
    // Service Ref for cancellation
    const serviceRef = useRef<MigrationService | null>(null);
    
    // Check for checkpoints whenever config changes
    useEffect(() => {
        if (destEndpoint && destProjectId && destApiKey) {
            try {
                const destProject: AppwriteProject = { $id: 'dest', name: 'Dest', projectId: destProjectId, endpoint: destEndpoint, apiKey: destApiKey };
                const service = new MigrationService(activeProject, destProject, () => {});
                setHasCheckpoint(service.hasCheckpoint());
            } catch (e) { setHasCheckpoint(false); }
        } else {
            setHasCheckpoint(false);
        }
    }, [destEndpoint, destProjectId, destApiKey, activeProject]);

    // UI Helpers
    const handleLog = (msg: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const handleProjectSelect = (id: string) => {
        setSelectedDestId(id);
        if (id === 'manual') {
            setDestEndpoint('');
            setDestProjectId('');
            setDestApiKey('');
        } else {
            const proj = projects.find(p => p.$id === id);
            if (proj) {
                setDestEndpoint(proj.endpoint);
                setDestProjectId(proj.projectId);
                setDestApiKey(proj.apiKey);
            }
        }
    };

    // Step 1 -> 2: Scan
    const handleScan = async (resume: boolean = false) => {
        if (!destEndpoint || !destProjectId || !destApiKey) {
            alert('Please provide all destination project details.');
            return;
        }

        setIsLoading(true);
        try {
            const destProject: AppwriteProject = {
                $id: 'dest',
                name: 'Destination',
                projectId: destProjectId,
                endpoint: destEndpoint,
                apiKey: destApiKey,
            };
            const service = new MigrationService(activeProject, destProject, () => {});
            const generatedPlan = await service.getMigrationPlan(options);
            setPlan(generatedPlan);
            setStep('preview');
        } catch (e) {
            alert(`Scan Failed: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Edit Plan Helpers
    const updateResource = (category: keyof MigrationPlan, index: number, updates: Partial<MigrationResource>) => {
        if (!plan) return;
        const list = plan[category] as MigrationResource[];
        const newList = [...list];
        let updatedItem = { ...newList[index], ...updates };

        // CASCADING LOGIC: If a database is toggled, update all its nested collections
        if (category === 'databases' && updates.hasOwnProperty('enabled')) {
            if (updatedItem.children) {
                updatedItem.children = updatedItem.children.map(c => ({
                    ...c,
                    enabled: updatedItem.enabled
                }));
            }
        }

        newList[index] = updatedItem;
        setPlan({ ...plan, [category]: newList });
    };

    const updateNestedResource = (dbIndex: number, colIndex: number, updates: Partial<MigrationResource>) => {
        if (!plan) return;
        const dbs = [...plan.databases];
        const db = dbs[dbIndex];
        if (db.children) {
            const newCols = [...db.children];
            newCols[colIndex] = { ...newCols[colIndex], ...updates };
            db.children = newCols;
        }
        setPlan({ ...plan, databases: dbs });
    };

    // Step 2 -> 3: Execute
    const handleExecute = async (resume: boolean = false) => {
        if (!plan) return;
        setStep('executing');
        setExecutionStatus('running');
        setLogs([]);
        handleLog(`Initializing migration from "${activeProject.name}" to "${destProjectId}"...`);

        const destProject: AppwriteProject = {
            $id: 'dest',
            name: 'Destination',
            projectId: destProjectId,
            endpoint: destEndpoint,
            apiKey: destApiKey,
        };

        const service = new MigrationService(activeProject, destProject, handleLog);
        serviceRef.current = service;

        try {
            await service.startMigration(plan, resume);
            handleLog('✅ Migration process finished.');
            setExecutionStatus('completed');
            setHasCheckpoint(false);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            handleLog(`❌ Fatal Error: ${msg}`);
            setExecutionStatus(msg.includes('force stopped') ? 'stopped' : 'error');
            setHasCheckpoint(service.hasCheckpoint());
        }
    };

    const handleStop = () => {
        if (serviceRef.current) {
            serviceRef.current.stop();
        }
    };

    const availableProjects = projects.filter(p => p.$id !== activeProject.$id);

    return (
        <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
            <header className="mb-6 flex-shrink-0">
                <div className="flex items-center gap-3">
                     {step !== 'config' && (
                        <button onClick={() => setStep('config')} className="p-1 text-gray-400 hover:text-white bg-gray-800 rounded-full transition-colors"><ArrowLeftIcon /></button>
                     )}
                     <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                        <MigrationIcon className="text-cyan-400" /> 
                        {step === 'config' ? 'Migration Setup' : step === 'preview' ? 'Preview & Edit Plan' : 'Migration Execution'}
                    </h1>
                </div>
                {step === 'config' && (
                     <p className="text-gray-400 mt-2 text-sm">
                        Select a destination project and choose which resources to migrate. You will be able to review and modify target IDs/Names before starting.
                    </p>
                )}
            </header>

            {/* STEP 1: CONFIG */}
            {step === 'config' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar">
                    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 h-fit">
                        <h3 className="text-lg font-semibold text-gray-200 mb-4">Destination Project</h3>
                        <div className="mb-4">
                             <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Select Project</label>
                             <div className="relative">
                                <select
                                    value={selectedDestId}
                                    onChange={(e) => handleProjectSelect(e.target.value)}
                                     className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:border-cyan-500 outline-none appearance-none"
                                >
                                    <option value="manual">Manual Configuration</option>
                                    {availableProjects.map(p => (
                                        <option key={p.$id} value={p.$id}>{p.name}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                    <ChevronDownIcon size={14} />
                                </div>
                             </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Endpoint</label>
                                <input 
                                    type="url" value={destEndpoint} onChange={e => setDestEndpoint(e.target.value)}
                                    placeholder="https://cloud.appwrite.io/v1"
                                    className={`w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:border-cyan-500 outline-none ${selectedDestId !== 'manual' ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    readOnly={selectedDestId !== 'manual'}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Project ID</label>
                                <input 
                                    type="text" value={destProjectId} onChange={e => setDestProjectId(e.target.value)}
                                    placeholder="destination-project-id"
                                    className={`w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:border-cyan-500 outline-none ${selectedDestId !== 'manual' ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    readOnly={selectedDestId !== 'manual'}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">API Key (Admin)</label>
                                <input 
                                    type="password" value={destApiKey} onChange={e => setDestApiKey(e.target.value)}
                                    placeholder="Secret API Key"
                                    className={`w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:border-cyan-500 outline-none ${selectedDestId !== 'manual' ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    readOnly={selectedDestId !== 'manual'}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 h-fit flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-200 mb-4">What to Migrate?</h3>
                            <div className="space-y-3 mb-8">
                                {Object.keys(options).filter(k => k !== 'useCloudProxy').map((key) => {
                                    const k = key as keyof MigrationOptions;
                                    return (
                                        <label key={k} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-700/30 transition-colors">
                                            <input 
                                                type="checkbox" 
                                                checked={options[k]} 
                                                onChange={e => setOptions({...options, [k]: e.target.checked})}
                                                className="w-5 h-5 rounded border-gray-600 bg-gray-900 text-cyan-600 focus:ring-cyan-500"
                                            />
                                            <span className="text-sm text-gray-300 capitalize font-medium">{key.replace('migrate', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                                        </label>
                                    );
                                })}
                                
                                <div className="border-t border-gray-700/50 my-2 pt-2"></div>
                                <label className="flex items-start gap-3 cursor-pointer p-3 rounded bg-purple-900/10 border border-purple-500/20 hover:bg-purple-900/20 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={options.useCloudProxy} 
                                        onChange={e => setOptions({...options, useCloudProxy: e.target.checked})}
                                        className="w-5 h-5 mt-0.5 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500"
                                    />
                                    <div>
                                        <span className="text-sm text-purple-300 font-bold flex items-center gap-2"><RiRocketLine size={14} /> Use Cloud Proxy (Serverless)</span>
                                        <p className="text-xs text-purple-200/70 mt-1">
                                            Deploys a temporary Cloud Function to transfer files directly between servers. Faster & saves your bandwidth.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={() => handleScan(false)} 
                                disabled={isLoading}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${isLoading ? 'bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'}`}
                            >
                                {isLoading ? <LoadingSpinnerIcon /> : <MigrationIcon />} 
                                {isLoading ? 'Scanning Project...' : 'Scan Project'}
                            </button>
                            
                            {hasCheckpoint && (
                                <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-xl text-center">
                                    <p className="text-xs text-yellow-300 mb-2">Previous migration checkpoint detected.</p>
                                    <button 
                                        onClick={() => handleScan(true)}
                                        disabled={isLoading}
                                        className="w-full py-2 bg-yellow-800 hover:bg-yellow-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshIcon size={12} /> Resume from Checkpoint
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: PREVIEW */}
            {step === 'preview' && plan && (
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl flex-1 overflow-hidden flex flex-col shadow-inner">
                         <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center py-3 px-4 bg-gray-800/80 border-b border-gray-700 font-bold text-[10px] text-gray-400 uppercase tracking-widest">
                            <span className="min-w-[150px]">Resource</span>
                            <span>Target ID</span>
                            <span>Target Name</span>
                            <span>Status</span>
                        </div>
                        <div className="overflow-y-auto flex-1 custom-scrollbar pb-10">
                            
                            {/* Databases */}
                            {plan.databases.map((db, i) => (
                                <React.Fragment key={db.sourceId}>
                                    <div className={`mt-2 mx-2 rounded-xl overflow-hidden border transition-all ${db.enabled ? 'border-transparent bg-gray-800/20' : 'border-red-900/30 bg-red-900/5 shadow-inner'}`}>
                                        <ResourceRow 
                                            label={<span className="flex items-center gap-2 font-bold text-gray-200"><DatabaseIcon size={14} className="text-red-400"/> {db.sourceName}</span>}
                                            id={db.targetId} name={db.targetName} enabled={db.enabled}
                                            onIdChange={(v: string) => updateResource('databases', i, { targetId: v })}
                                            onNameChange={(v: string) => updateResource('databases', i, { targetName: v })}
                                            onToggle={(v: boolean) => updateResource('databases', i, { enabled: v })}
                                        />
                                        
                                        {/* Cascade Warning Banner */}
                                        {!db.enabled && (
                                            <div className="px-10 py-2 bg-red-950/40 text-[10px] text-red-300 flex items-center gap-3 border-b border-red-900/30 animate-fade-in italic">
                                                <WarningIcon size={14} className="text-red-500 flex-shrink-0" />
                                                <span>Excluding this database will remove it and all of its {db.children?.length || 0} collections from the migration.</span>
                                            </div>
                                        )}

                                        {db.children?.map((col, j) => (
                                             <ResourceRow 
                                                key={col.sourceId}
                                                label={col.sourceName}
                                                id={col.targetId} name={col.targetName} enabled={col.enabled}
                                                onIdChange={(v: string) => updateNestedResource(i, j, { targetId: v })}
                                                onNameChange={(v: string) => updateNestedResource(i, j, { targetName: v })}
                                                onToggle={(v: boolean) => {
                                                    // Prevent enabling child if parent is disabled
                                                    if (!db.enabled) return; 
                                                    updateNestedResource(i, j, { enabled: v });
                                                }}
                                                depth={1}
                                                isRowDisabled={!db.enabled}
                                            />
                                        ))}
                                    </div>
                                </React.Fragment>
                            ))}

                            {/* Other resources grouped for cleaner list */}
                            <div className="mt-4 px-2 space-y-1">
                                {/* Buckets */}
                                {plan.buckets.map((b, i) => (
                                    <ResourceRow 
                                        key={b.sourceId}
                                        label={<span className="flex items-center gap-2 font-bold text-gray-300"><StorageIcon size={14} className="text-green-400"/> {b.sourceName}</span>}
                                        id={b.targetId} name={b.targetName} enabled={b.enabled}
                                        onIdChange={(v: string) => updateResource('buckets', i, { targetId: v })}
                                        onNameChange={(v: string) => updateResource('buckets', i, { targetName: v })}
                                        onToggle={(v: boolean) => updateResource('buckets', i, { enabled: v })}
                                    />
                                ))}

                                {/* Functions */}
                                {plan.functions.map((f, i) => (
                                    <ResourceRow 
                                        key={f.sourceId}
                                        label={<span className="flex items-center gap-2 font-bold text-gray-300"><FunctionIcon size={14} className="text-blue-400"/> {f.sourceName}</span>}
                                        id={f.targetId} name={f.targetName} enabled={f.enabled}
                                        onIdChange={(v: string) => updateResource('functions', i, { targetId: v })}
                                        onNameChange={(v: string) => updateResource('functions', i, { targetName: v })}
                                        onToggle={(v: boolean) => updateResource('functions', i, { enabled: v })}
                                    />
                                ))}

                                {/* Teams */}
                                {plan.teams.map((t, i) => (
                                    <ResourceRow 
                                        key={t.sourceId}
                                        label={<span className="flex items-center gap-2 font-bold text-gray-300"><TeamIcon size={14} className="text-yellow-400"/> {t.sourceName}</span>}
                                        id={t.targetId} name={t.targetName} enabled={t.enabled}
                                        onIdChange={(v: string) => updateResource('teams', i, { targetId: v })}
                                        onNameChange={(v: string) => updateResource('teams', i, { targetName: v })}
                                        onToggle={(v: boolean) => updateResource('teams', i, { enabled: v })}
                                    />
                                ))}

                                {/* Users */}
                                {plan.users.map((u, i) => (
                                    <ResourceRow 
                                        key={u.sourceId}
                                        label={<span className="flex items-center gap-2 font-bold text-gray-300"><UserIcon size={14} className="text-purple-400"/> {u.sourceName}</span>}
                                        id={u.targetId} name={u.targetName} enabled={u.enabled}
                                        onIdChange={(v: string) => updateResource('users', i, { targetId: v })}
                                        onNameChange={(v: string) => updateResource('users', i, { targetName: v })}
                                        onToggle={(v: boolean) => updateResource('users', i, { enabled: v })}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-4 flex justify-between items-center">
                         {hasCheckpoint ? (
                             <button 
                                onClick={() => handleExecute(true)}
                                className="px-8 py-3 bg-yellow-700 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"
                             >
                                 <RefreshIcon /> Resume from Checkpoint
                             </button>
                         ) : <div />}

                         <button 
                            onClick={() => handleExecute(false)} 
                            className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"
                        >
                            <MigrationIcon /> Start New Migration
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3: EXECUTION */}
            {step === 'executing' && (
                <div className="flex flex-col flex-1 min-h-0 bg-black/40 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                     <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                {executionStatus === 'running' && <LoadingSpinnerIcon className="text-cyan-400 animate-spin"/>}
                                {executionStatus === 'completed' && <CheckIcon className="text-green-400"/>}
                                {executionStatus === 'stopped' && <WarningIcon className="text-yellow-400"/>}
                                {executionStatus === 'error' && <WarningIcon className="text-red-400"/>}
                                
                                {executionStatus === 'running' ? 'Migration In Progress...' : 
                                 executionStatus === 'completed' ? 'Migration Complete' :
                                 executionStatus === 'stopped' ? 'Migration Stopped' : 'Migration Failed'}
                            </h3>
                            {executionStatus === 'running' && (
                                <button 
                                    onClick={handleStop}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                    <DeleteIcon size={12} /> Force Stop
                                </button>
                            )}
                        </div>
                        <span className="text-xs text-gray-500 font-mono">{logs.length} entries</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 font-mono text-xs space-y-1.5 bg-gray-950/80">
                         {logs.map((log, i) => (
                            <div key={i} className={`break-all border-b border-white/5 pb-1 ${log.includes('ERROR') ? 'text-red-400 bg-red-900/10 px-1 rounded' : log.includes('✅') ? 'text-green-400 font-bold pt-4 pb-2' : 'text-gray-400'}`}>
                                {log}
                            </div>
                        ))}
                    </div>
                     <div className="p-3 bg-gray-900 border-t border-gray-800 text-center">
                        {executionStatus === 'running' ? (
                            <p className="text-[10px] text-yellow-500 flex items-center justify-center gap-2 uppercase tracking-widest font-bold">
                                <WarningIcon size={12}/> Connection Active — Do not close this window.
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500">
                                Session finished. You can safely navigate away or review the target project.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
