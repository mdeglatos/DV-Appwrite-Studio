
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../Modal';
import { LoadingSpinnerIcon, DatabaseIcon, RiRocketLine, RiShareForwardLine, ChevronDownIcon, CheckIcon, AddIcon, DeleteIcon, WarningIcon, DownloadCloudIcon, CloseIcon } from '../Icons';
import type { AppwriteProject, Database } from '../../types';
import { getSdkDatabases, getSdkFunctions, Query, ID } from '../../services/appwrite';
import { deployCodeFromString } from '../../tools/functionsTools';

interface MappingRow {
    id: string;
    sourceDbId: string;
    sourceCollId: string;
    destDbId: string;
    destCollId: string;
}

interface TransferResult {
    id: string;
    collectionId: string;
    status: 'migrated' | 'skipped' | 'failed';
    error?: string;
}

interface TransferDocumentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeProject: AppwriteProject;
    projects: AppwriteProject[];
    databases: Database[];
    onSuccess: () => void;
}

export const TransferDocumentsModal: React.FC<TransferDocumentsModalProps> = ({ 
    isOpen, onClose, activeProject, projects, databases, onSuccess 
}) => {
    const [mappings, setMappings] = useState<MappingRow[]>([]);
    const [sourceCollections, setSourceCollections] = useState<{[dbId: string]: any[]}>({});
    
    const [destType, setDestType] = useState<'internal' | 'external'>('internal');
    const [selectedDestProjId, setSelectedDestProjId] = useState<string>('manual');
    const [extEndpoint, setExtEndpoint] = useState('https://cloud.appwrite.io/v1');
    const [extProjectId, setExtProjectId] = useState('');
    const [extApiKey, setExtApiKey] = useState('');
    const [extDatabases, setExtDatabases] = useState<Database[]>([]);
    const [extCollections, setExtCollections] = useState<{[dbId: string]: any[]}>({});
    
    const [deleteOriginals, setDeleteOriginals] = useState(false);
    const [status, setStatus] = useState<'idle' | 'executing' | 'completed'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<TransferResult[]>([]);
    const [totalEstimated, setTotalEstimated] = useState(0);

    // Stats Calculation
    const stats = useMemo(() => {
        return {
            total: results.length,
            migrated: results.filter(r => r.status === 'migrated').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            failed: results.filter(r => r.status === 'failed').length,
            errors: results.filter(r => r.status === 'failed')
        };
    }, [results]);

    const fetchCollectionsForDb = async (dbId: string, project: AppwriteProject, isExternal: boolean) => {
        if (!dbId) return;
        try {
            const sdk = getSdkDatabases(project);
            const res = await sdk.listCollections(dbId, [Query.limit(100)]);
            if (isExternal) {
                setExtCollections(prev => ({ ...prev, [dbId]: res.collections }));
            } else {
                setSourceCollections(prev => ({ ...prev, [dbId]: res.collections }));
            }
        } catch (e) {
            console.error("Failed to load collections", e);
        }
    };

    const addMapping = () => {
        setMappings(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            sourceDbId: databases[0]?.$id || '',
            sourceCollId: '',
            destDbId: '',
            destCollId: ''
        }]);
    };

    const updateMapping = (id: string, field: keyof MappingRow, value: string) => {
        setMappings(prev => prev.map(m => {
            if (m.id === id) {
                const updated = { ...m, [field]: value };
                if (field === 'sourceDbId' || field === 'destDbId') {
                    if (field === 'sourceDbId') {
                        updated.sourceCollId = '';
                        fetchCollectionsForDb(value, activeProject, false);
                    } else {
                        updated.destCollId = '';
                        if (destType === 'external' && extProjectId) {
                             const tempProj: AppwriteProject = { $id: 'temp', name: 'Temp', endpoint: extEndpoint, projectId: extProjectId, apiKey: extApiKey };
                             fetchCollectionsForDb(value, tempProj, true);
                        } else {
                             fetchCollectionsForDb(value, activeProject, false);
                        }
                    }
                }
                return updated;
            }
            return m;
        }));
    };

    const handleClose = () => {
        if (status === 'executing') return;
        setStatus('idle');
        setLogs([]);
        setResults([]);
        setMappings([]);
        onClose();
    };

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const handleDownloadReport = () => {
        const report = {
            project: activeProject.name,
            timestamp: new Date().toISOString(),
            summary: stats,
            details: results
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transfer_report_${activeProject.projectId}.json`;
        a.click();
    };

    const executeTransfer = async () => {
        if (mappings.length === 0 || mappings.some(m => !m.sourceCollId || !m.destCollId)) {
            alert("Please complete all mappings.");
            return;
        }

        setStatus('executing');
        setResults([]);
        setLogs([]);
        
        const functions = getSdkFunctions(activeProject);
        const sourceDbSdk = getSdkDatabases(activeProject);
        let workerId: string | null = null;

        try {
            addLog("🚀 Deploying reporting worker...");
            const workerName = '_dv_doc_reporter_worker';
            const functionId = ID.unique();

            const indexJs = `
            import { Client, Databases, ID, Query } from 'node-appwrite';

            export default async ({ req, res, log, error }) => {
                try {
                    let payload = req.body;
                    if (typeof payload === 'string') payload = JSON.parse(payload);
                    const { sourceDbId, sourceCollId, docData, docId, destEndpoint, destProject, destKey, destDbId, destCollId, deleteSource } = payload;

                    const destClient = new Client().setEndpoint(destEndpoint).setProject(destProject).setKey(destKey);
                    const destDbs = new Databases(destClient);

                    try {
                        await destDbs.createDocument(destDbId, destCollId, docId, docData);
                        if (deleteSource) {
                            const sourceClient = new Client().setEndpoint(req.headers['x-appwrite-endpoint']).setProject(req.headers['x-appwrite-project']).setKey(req.headers['x-appwrite-key']);
                            const sourceDbs = new Databases(sourceClient);
                            await sourceDbs.deleteDocument(sourceDbId, sourceCollId, docId);
                        }
                        return res.json({ success: true, status: 'migrated', id: docId });
                    } catch (e) {
                        if (e.code === 409) return res.json({ success: true, status: 'skipped', id: docId });
                        throw e;
                    }
                } catch (e) {
                    return res.json({ success: false, status: 'failed', error: e.message, id: payload.docId }, 500);
                }
            };`;

            const func = await functions.create(functionId, workerName, 'node-18.0' as any, ['any'], undefined, '', 15, true, true);
            await deployCodeFromString(activeProject, func.$id, [{ name: 'package.json', content: JSON.stringify({ name: "reporter", type: "module", dependencies: { "node-appwrite": "^14.0.0" } }) }, { name: 'src/main.js', content: indexJs }], true, 'src/main.js', 'npm install');
            
            // Wait build
            let tries = 0;
            while(tries < 30) {
                await new Promise(r => setTimeout(r, 2000));
                const deps = await functions.listDeployments(func.$id, [Query.orderDesc('$createdAt'), Query.limit(1)]);
                if (deps.deployments[0]?.status === 'ready') break;
                if (deps.deployments[0]?.status === 'failed') throw new Error("Worker build failed");
                tries++;
            }
            workerId = func.$id;

            for (const mapping of mappings) {
                addLog(`Processing collection: ${mapping.sourceCollId}`);
                let cursor = undefined;
                while (true) {
                    const queries = [Query.limit(50)];
                    if (cursor) queries.push(Query.cursorAfter(cursor));
                    const docs = await sourceDbSdk.listDocuments(mapping.sourceDbId, mapping.sourceCollId, queries);
                    if (docs.documents.length === 0) break;

                    const batchPromises = docs.documents.map(async (doc) => {
                        const { $id, $databaseId, $collectionId, $createdAt, $updatedAt, $permissions, ...cleanData } = doc;
                        const payload = JSON.stringify({
                            sourceDbId: mapping.sourceDbId,
                            sourceCollId: mapping.sourceCollId,
                            docId: $id,
                            docData: cleanData,
                            destEndpoint: destType === 'internal' ? activeProject.endpoint : extEndpoint,
                            destProject: destType === 'internal' ? activeProject.projectId : extProjectId,
                            destKey: destType === 'internal' ? activeProject.apiKey : extApiKey,
                            destDbId: mapping.destDbId,
                            destCollId: mapping.destCollId,
                            deleteSource: deleteOriginals
                        });

                        try {
                            const execution = await functions.createExecution(workerId!, payload, false);
                            const res = JSON.parse(execution.responseBody);
                            setResults(prev => [...prev, { id: res.id, collectionId: mapping.sourceCollId, status: res.status, error: res.error }]);
                        } catch (e: any) {
                            setResults(prev => [...prev, { id: $id, collectionId: mapping.sourceCollId, status: 'failed', error: e.message }]);
                        }
                    });

                    await Promise.all(batchPromises);
                    cursor = docs.documents[docs.documents.length - 1].$id;
                    if (docs.documents.length < 50) break;
                }
            }

            addLog("✅ Operation Finished.");
            onSuccess();
            setStatus('completed');
        } catch (e: any) {
            addLog(`❌ CRITICAL ERROR: ${e.message}`);
            setStatus('completed');
        } finally {
            if (workerId) await functions.delete(workerId).catch(() => {});
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Transfer Documents" size="4xl">
            {status === 'idle' ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                        <div className="flex bg-gray-800 rounded-lg p-1">
                            <button onClick={()=>setDestType('internal')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${destType==='internal' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400'}`}>Internal</button>
                            <button onClick={()=>setDestType('external')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${destType==='external' ? 'bg-gray-700 text-purple-400' : 'text-gray-400'}`}>External Project</button>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={deleteOriginals} onChange={e => setDeleteOriginals(e.target.checked)} className="w-4 h-4 rounded bg-gray-800 text-red-500" />
                            <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Delete Source (Move)</span>
                        </label>
                    </div>

                    <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
                         <div className="grid grid-cols-[1fr_1fr_40px_1fr_1fr_40px] gap-2 p-3 bg-gray-800/80 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700">
                            <span>Source DB</span>
                            <span>Source Coll</span>
                            <span className="text-center">→</span>
                            <span>Target DB</span>
                            <span>Target Coll</span>
                            <span></span>
                        </div>
                        <div className="max-h-[250px] overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {mappings.map((m) => (
                                <div key={m.id} className="grid grid-cols-[1fr_1fr_40px_1fr_1fr_40px] gap-2 items-center">
                                    <select value={m.sourceDbId} onChange={e => updateMapping(m.id, 'sourceDbId', e.target.value)} className="bg-gray-800 border border-gray-700 rounded p-1.5 text-[11px] text-white outline-none">
                                        {databases.map(db => <option key={db.$id} value={db.$id}>{db.name}</option>)}
                                    </select>
                                    <select value={m.sourceCollId} onChange={e => updateMapping(m.id, 'sourceCollId', e.target.value)} className="bg-gray-800 border border-gray-700 rounded p-1.5 text-[11px] text-white outline-none">
                                        <option value="">Select...</option>
                                        {sourceCollections[m.sourceDbId]?.map(c => <option key={c.$id} value={c.$id}>{c.name}</option>)}
                                    </select>
                                    <div className="text-center text-gray-600">→</div>
                                    <select value={m.destDbId} onChange={e => updateMapping(m.id, 'destDbId', e.target.value)} className="bg-gray-800 border border-gray-700 rounded p-1.5 text-[11px] text-white outline-none">
                                        {(destType === 'internal' ? databases : extDatabases).map(db => <option key={db.$id} value={db.$id}>{db.name}</option>)}
                                    </select>
                                    <select value={m.destCollId} onChange={e => updateMapping(m.id, 'destCollId', e.target.value)} className="bg-gray-800 border border-gray-700 rounded p-1.5 text-[11px] text-white outline-none">
                                         <option value="">Select...</option>
                                        {(destType === 'internal' ? sourceCollections : extCollections)[m.destDbId]?.map(c => <option key={c.$id} value={c.$id}>{c.name}</option>)}
                                    </select>
                                    <button onClick={()=>setMappings(prev => prev.filter(row => row.id !== m.id))} className="text-gray-500 hover:text-red-400 transition-colors"><DeleteIcon size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <button onClick={addMapping} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-gray-700">
                            <AddIcon size={16}/> Add Mapping
                        </button>
                        <div className="flex gap-3">
                            <button onClick={handleClose} className="px-5 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button onClick={executeTransfer} disabled={mappings.length === 0} className="px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50">
                                <RiRocketLine size={16} /> Execute Transfer
                            </button>
                        </div>
                    </div>
                </div>
            ) : status === 'executing' ? (
                <div className="flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-6 p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-lg">
                        <div className="flex items-center gap-4">
                            <LoadingSpinnerIcon className="text-cyan-400 animate-spin" size={32} />
                            <div>
                                <h3 className="text-lg font-bold text-gray-100">Transferring Documents...</h3>
                                <div className="flex gap-4 mt-1 text-xs font-mono">
                                    <span className="text-green-400">Migrated: {stats.migrated}</span>
                                    <span className="text-yellow-400">Skipped: {stats.skipped}</span>
                                    <span className="text-red-400">Failed: {stats.failed}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 bg-black/30 rounded-2xl border border-gray-800 p-4 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-1">
                        {logs.slice(-10).map((log, i) => <div key={i} className="text-gray-500 border-l border-gray-700 pl-2">{log}</div>)}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-[500px] animate-fade-in">
                    <header className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Transfer Report</h2>
                            <p className="text-gray-400 text-sm">Summary of operations across all mappings.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleDownloadReport} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-cyan-400 text-xs font-bold rounded-xl border border-gray-700 transition-all">
                                <DownloadCloudIcon size={14}/> Download Report
                            </button>
                            <button onClick={handleClose} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700"><CloseIcon size={20}/></button>
                        </div>
                    </header>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-gray-800/40 rounded-2xl border border-gray-700 text-center">
                            <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Total Attempted</span>
                            <span className="text-2xl font-black text-gray-100">{stats.total}</span>
                        </div>
                        <div className="p-4 bg-green-900/10 rounded-2xl border border-green-900/30 text-center">
                            <span className="block text-[10px] font-bold text-green-500 uppercase mb-1">Migrated</span>
                            <span className="text-2xl font-black text-green-400">{stats.migrated}</span>
                        </div>
                        <div className="p-4 bg-yellow-900/10 rounded-2xl border border-yellow-900/30 text-center">
                            <span className="block text-[10px] font-bold text-yellow-500 uppercase mb-1">Skipped (Exist)</span>
                            <span className="text-2xl font-black text-yellow-400">{stats.skipped}</span>
                        </div>
                        <div className="p-4 bg-red-900/10 rounded-2xl border border-red-900/30 text-center">
                            <span className="block text-[10px] font-bold text-red-500 uppercase mb-1">Failed</span>
                            <span className="text-2xl font-black text-red-400">{stats.failed}</span>
                        </div>
                    </div>

                    {/* Detailed Issues Table */}
                    <div className="flex-1 flex flex-col bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden">
                        <div className="p-3 bg-gray-800/50 border-b border-gray-700 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex justify-between items-center">
                            <span>Issue Log</span>
                            <span className="bg-gray-700 text-[9px] px-1.5 py-0.5 rounded">{stats.failed} Errors</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {stats.errors.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 italic text-sm">
                                    <CheckIcon size={48} className="mb-2 opacity-20 text-green-500" />
                                    No errors encountered during transfer.
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-950/20 text-[10px] font-bold text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-2">Document ID</th>
                                            <th className="px-4 py-2">Collection</th>
                                            <th className="px-4 py-2">Reason / Error</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {stats.errors.map((err, i) => (
                                            <tr key={i} className="hover:bg-red-500/5 transition-colors">
                                                <td className="px-4 py-3 font-mono text-gray-300">{err.id}</td>
                                                <td className="px-4 py-3 text-gray-500">{err.collectionId}</td>
                                                <td className="px-4 py-3 text-red-400 font-medium">{err.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};
