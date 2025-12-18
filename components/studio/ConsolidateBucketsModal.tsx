
import React, { useState } from 'react';
import { Modal } from '../Modal';
import { LoadingSpinnerIcon, RefreshIcon, StorageIcon, RiRocketLine, RiShareForwardLine, ChevronDownIcon, CheckIcon } from '../Icons';
import type { AppwriteProject, Bucket } from '../../types';
import { getSdkStorage, getSdkFunctions, Query, ID } from '../../services/appwrite';
import { deployCodeFromString } from '../../tools/functionsTools';

interface ConsolidateBucketsModalProps {
    isOpen: boolean;
    onClose: () => void;
    buckets: Bucket[];
    activeProject: AppwriteProject;
    projects: AppwriteProject[];
    onSuccess: () => void;
}

export const ConsolidateBucketsModal: React.FC<ConsolidateBucketsModalProps> = ({ 
    isOpen, onClose, buckets, activeProject, projects, onSuccess 
}) => {
    const [sourceBucketIds, setSourceBucketIds] = useState<string[]>([]);
    
    // Destination Configuration
    const [destType, setDestType] = useState<'internal' | 'external'>('internal');
    const [destBucketId, setDestBucketId] = useState<string>('');
    
    // External Project Config
    const [selectedDestProjId, setSelectedDestProjId] = useState<string>('manual');
    const [extEndpoint, setExtEndpoint] = useState('https://cloud.appwrite.io/v1');
    const [extProjectId, setExtProjectId] = useState('');
    const [extApiKey, setExtApiKey] = useState('');
    const [extBucketId, setExtBucketId] = useState('');
    const [extBuckets, setExtBuckets] = useState<Bucket[]>([]);
    const [loadingExtBuckets, setLoadingExtBuckets] = useState(false);

    const [deleteOriginals, setDeleteOriginals] = useState(true); // Move vs Copy
    const [status, setStatus] = useState<'idle' | 'executing' | 'completed'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const handleSourceToggle = (id: string) => {
        if (sourceBucketIds.includes(id)) {
            setSourceBucketIds(prev => prev.filter(b => b !== id));
        } else {
            setSourceBucketIds(prev => [...prev, id]);
        }
    };

    const fetchExternalBuckets = async (endpoint: string, projectId: string, apiKey: string) => {
        setLoadingExtBuckets(true);
        try {
            const tempProj: AppwriteProject = {
                $id: 'temp',
                name: 'Temp',
                endpoint,
                projectId,
                apiKey
            };
            const storage = getSdkStorage(tempProj);
            const res = await storage.listBuckets([Query.limit(100)]);
            setExtBuckets(res.buckets);
            if (res.buckets.length > 0) {
                setExtBucketId(res.buckets[0].$id);
            } else {
                setExtBucketId('');
            }
        } catch (e) {
            console.error("Failed to load external buckets", e);
            setExtBuckets([]);
        } finally {
            setLoadingExtBuckets(false);
        }
    };

    const handleDestProjectSelect = (id: string) => {
        setSelectedDestProjId(id);
        if (id === 'manual') {
            setExtEndpoint('https://cloud.appwrite.io/v1');
            setExtProjectId('');
            setExtApiKey('');
            setExtBuckets([]);
            setExtBucketId('');
        } else {
            const proj = projects.find(p => p.$id === id);
            if (proj) {
                setExtEndpoint(proj.endpoint);
                setExtProjectId(proj.projectId);
                setExtApiKey(proj.apiKey);
                fetchExternalBuckets(proj.endpoint, proj.projectId, proj.apiKey);
            }
        }
    };

    const handleClose = () => {
        if (status === 'executing') return; // Prevent closing while running
        setStatus('idle');
        setLogs([]);
        setProgress({ current: 0, total: 0 });
        onClose();
    };

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const deployWorker = async () => {
        addLog("🚀 Deploying temporary worker function...");
        const functions = getSdkFunctions(activeProject);
        const functionId = ID.unique();
        const workerName = '_dv_transfer_worker';

        // 1. Create Function
        const func = await functions.create(
            functionId,
            workerName,
            'node-18.0' as any,
            undefined, undefined, '', 15, true, true
        );

        // 2. Code Bundle
        const packageJson = JSON.stringify({
            name: "transfer-worker",
            dependencies: { "node-appwrite": "^14.0.0" }
        });

        const indexJs = `
        const nodeAppwrite = require('node-appwrite');
        const { Client, Storage } = nodeAppwrite;

        module.exports = async ({ req, res, log, error }) => {
            try {
                let payload = req.body;
                if (typeof payload === 'string') {
                    try { payload = JSON.parse(payload); } catch(e) {}
                }
                
                // Flexible payload destructuring for Cross-Project support
                const { 
                    sourceBucketId, fileId, 
                    sourceEndpoint, sourceProject, sourceKey,
                    destEndpoint, destProject, destKey, destBucketId,
                    deleteSource 
                } = payload;

                // 1. Setup Source Client
                const sourceClient = new Client()
                    .setEndpoint(sourceEndpoint)
                    .setProject(sourceProject)
                    .setKey(sourceKey);

                const sourceStorage = new Storage(sourceClient);

                // 2. Download File Metadata & Content
                const fileMeta = await sourceStorage.getFile(sourceBucketId, fileId);
                const arrayBuffer = await sourceStorage.getFileDownload(sourceBucketId, fileId);

                // 3. Upload to Destination
                // Using native global fetch & FormData (available in Node 18+) to ensure correct multipart upload
                const blob = new Blob([arrayBuffer], { type: fileMeta.mimeType });
                const formData = new FormData();
                formData.append('fileId', fileId); // Preserve the ID
                formData.append('file', blob, fileMeta.name);
                
                if (fileMeta.$permissions && Array.isArray(fileMeta.$permissions)) {
                    fileMeta.$permissions.forEach((p, i) => formData.append(\`permissions[\${i}]\`, p));
                }

                const uploadUrl = \`\${destEndpoint}/storage/buckets/\${destBucketId}/files\`;
                
                const uploadRes = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'X-Appwrite-Project': destProject,
                        'X-Appwrite-Key': destKey,
                    },
                    body: formData
                });

                if (!uploadRes.ok) {
                    const errText = await uploadRes.text();
                    // If file exists (409), we consider it a success/skip to avoid breaking the batch
                    if (uploadRes.status === 409) {
                        log('File already exists: ' + fileId);
                    } else {
                        throw new Error(\`Upload failed: \${uploadRes.status} \${errText}\`);
                    }
                }

                // 4. Delete Source (if requested)
                if (deleteSource) {
                    await sourceStorage.deleteFile(sourceBucketId, fileId);
                }

                return res.json({ success: true });

            } catch (e) {
                error(e.message);
                return res.json({ success: false, error: e.message }, 500);
            }
        };
        `;

        // 3. Deploy
        await deployCodeFromString(
            activeProject,
            func.$id,
            [
                { name: 'package.json', content: packageJson },
                { name: 'src/main.js', content: indexJs }
            ],
            true,
            'src/main.js',
            'npm install'
        );

        addLog(`Worker deployed (${func.$id}). Waiting for build...`);

        // Wait for ready
        let tries = 0;
        while(tries < 30) { // 60s max
            await new Promise(r => setTimeout(r, 2000));
            const deployments = await functions.listDeployments(func.$id, [Query.orderDesc('$createdAt'), Query.limit(1)]);
            if (deployments.deployments.length > 0) {
                const status = deployments.deployments[0].status;
                if (status === 'ready') return func.$id;
                if (status === 'failed') throw new Error('Worker build failed.');
            }
            tries++;
        }
        throw new Error('Worker build timed out.');
    };

    const executeConsolidation = async () => {
        if (sourceBucketIds.length === 0) {
            alert("Please select at least one source bucket.");
            return;
        }
        
        let finalDestBucketId = destBucketId;
        
        if (destType === 'internal') {
            if (!destBucketId) {
                alert("Please select a destination bucket.");
                return;
            }
            if (sourceBucketIds.includes(destBucketId)) {
                alert("Destination bucket cannot be one of the source buckets.");
                return;
            }
        } else {
            if (!extEndpoint || !extProjectId || !extApiKey || !extBucketId) {
                alert("Please fill in all External Project details.");
                return;
            }
            finalDestBucketId = extBucketId;
        }

        setStatus('executing');
        setLogs([]);
        setProgress({ current: 0, total: 0 });
        
        let workerId: string | null = null;
        const functions = getSdkFunctions(activeProject);
        const storage = getSdkStorage(activeProject);

        try {
            // 1. Deploy Worker
            try {
                workerId = await deployWorker();
                addLog("Worker ready. Starting batch processing...");
            } catch (e: any) {
                addLog(`ERROR deploying worker: ${e.message}`);
                throw e;
            }

            // 2. Iterate Buckets
            let totalProcessed = 0;
            for (const sourceId of sourceBucketIds) {
                const sourceName = buckets.find(b => b.$id === sourceId)?.name || sourceId;
                addLog(`Processing bucket: ${sourceName}`);

                let cursor = undefined;
                while (true) {
                    const queries = [Query.limit(50)];
                    if (cursor) queries.push(Query.cursorAfter(cursor));

                    const fileList = await storage.listFiles(sourceId, queries);
                    if (fileList.files.length === 0) break;

                    // Process page in parallel using the worker
                    const promises = fileList.files.map(async (file) => {
                        try {
                            const payload = JSON.stringify({
                                sourceBucketId: sourceId,
                                fileId: file.$id,
                                
                                // Source Config
                                sourceEndpoint: activeProject.endpoint,
                                sourceProject: activeProject.projectId,
                                sourceKey: activeProject.apiKey,
                                
                                // Dest Config
                                destEndpoint: destType === 'internal' ? activeProject.endpoint : extEndpoint,
                                destProject: destType === 'internal' ? activeProject.projectId : extProjectId,
                                destKey: destType === 'internal' ? activeProject.apiKey : extApiKey,
                                destBucketId: finalDestBucketId,
                                
                                deleteSource: deleteOriginals
                            });

                            // Synchronous execution call ensures we wait for completion
                            const execution = await functions.createExecution(workerId!, payload, false);
                            
                            if (execution.status === 'failed') {
                                throw new Error(execution.responseBody || "Execution failed");
                            }
                            const response = JSON.parse(execution.responseBody);
                            if (!response.success) {
                                throw new Error(response.error);
                            }
                            
                            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                        } catch (err: any) {
                            addLog(`Failed to transfer ${file.name}: ${err.message}`);
                        }
                    });

                    await Promise.all(promises);
                    totalProcessed += fileList.files.length;
                    
                    cursor = fileList.files[fileList.files.length - 1].$id;
                    if (fileList.files.length < 50) break;
                }
            }
            
            addLog(`✅ Transfer Complete. Processed ${totalProcessed} files.`);
            onSuccess();
            setStatus('completed');

        } catch (e: any) {
            addLog(`FATAL ERROR: ${e.message}`);
            setStatus('completed'); // Allow close to see error
        } finally {
            // 3. Cleanup Worker
            if (workerId) {
                addLog("Cleaning up worker...");
                try {
                    await functions.delete(workerId);
                } catch (e) {
                    console.error("Failed to delete worker", e);
                }
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Transfer Files" size="4xl">
            {status === 'idle' ? (
                <div className="space-y-6">
                    <p className="text-sm text-gray-400">
                        Move or copy all files from selected buckets to another bucket. 
                        Files are transferred directly between servers using a temporary cloud worker.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Source Selection */}
                        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5 flex flex-col h-[400px]">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Source Buckets</h4>
                            <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                                {buckets.length === 0 && <p className="text-xs text-gray-500 italic">No buckets found.</p>}
                                {buckets.map(bucket => (
                                    <label key={bucket.$id} className="flex items-center gap-3 cursor-pointer p-3 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-gray-800">
                                        <input 
                                            type="checkbox" 
                                            checked={sourceBucketIds.includes(bucket.$id)}
                                            onChange={() => handleSourceToggle(bucket.$id)}
                                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-600 focus:ring-cyan-500"
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm text-gray-200 font-medium truncate">{bucket.name}</span>
                                            <span className="text-[10px] text-gray-500 font-mono truncate">{bucket.$id}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Dest Selection & Options */}
                        <div className="space-y-6 flex flex-col h-[400px]">
                            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5 flex-1 overflow-y-auto custom-scrollbar">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Destination</h4>
                                
                                {/* Dest Type Toggle */}
                                <div className="flex bg-gray-800 rounded-lg p-1 mb-5">
                                    <button 
                                        onClick={()=>setDestType('internal')} 
                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${destType==='internal' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-300'}`}
                                    >
                                        This Project
                                    </button>
                                    <button 
                                        onClick={()=>setDestType('external')} 
                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${destType==='external' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-300'}`}
                                    >
                                        Another Project
                                    </button>
                                </div>

                                {destType === 'internal' ? (
                                    <div className="relative">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Target Bucket</label>
                                        <select 
                                            value={destBucketId} 
                                            onChange={e => setDestBucketId(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg p-2.5 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none"
                                        >
                                            <option value="" disabled>Select Bucket</option>
                                            {buckets.filter(b => !sourceBucketIds.includes(b.$id)).map(b => (
                                                <option key={b.$id} value={b.$id}>{b.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-2 pt-6 flex items-center pointer-events-none text-gray-500">
                                            <StorageIcon size={14} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Saved Project</label>
                                            <div className="relative">
                                                <select 
                                                    value={selectedDestProjId} 
                                                    onChange={e => handleDestProjectSelect(e.target.value)}
                                                    className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg p-2.5 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none"
                                                >
                                                    <option value="manual">Manual Configuration</option>
                                                    {projects.filter(p => p.$id !== activeProject.$id).map(p => (
                                                        <option key={p.$id} value={p.$id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-gray-500">
                                                    <ChevronDownIcon size={14} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-gray-800 space-y-3">
                                            <div>
                                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Endpoint URL</label>
                                                <input 
                                                    type="url" value={extEndpoint} onChange={e => setExtEndpoint(e.target.value)}
                                                    placeholder="https://cloud.appwrite.io/v1" className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-xs text-gray-200 focus:border-cyan-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Project ID</label>
                                                <input 
                                                    type="text" value={extProjectId} onChange={e => setExtProjectId(e.target.value)}
                                                    placeholder="Project ID" className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-xs text-gray-200 focus:border-cyan-500 outline-none font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 uppercase mb-1">API Key</label>
                                                <input 
                                                    type="password" value={extApiKey} onChange={e => setExtApiKey(e.target.value)}
                                                    placeholder="API Key" className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-xs text-gray-200 focus:border-cyan-500 outline-none font-mono"
                                                />
                                            </div>
                                            
                                            {/* External Bucket Selector */}
                                            {selectedDestProjId !== 'manual' ? (
                                                <div className="relative">
                                                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Target Bucket</label>
                                                    <div className="relative">
                                                        <select 
                                                            value={extBucketId} 
                                                            onChange={e => setExtBucketId(e.target.value)}
                                                            className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded p-2 focus:border-cyan-500 outline-none appearance-none"
                                                            disabled={loadingExtBuckets}
                                                        >
                                                            <option value="" disabled>{loadingExtBuckets ? 'Loading buckets...' : 'Select Bucket'}</option>
                                                            {extBuckets.map(b => (
                                                                <option key={b.$id} value={b.$id}>{b.name} ({b.$id})</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-gray-500">
                                                            {loadingExtBuckets ? <LoadingSpinnerIcon size={12} className="animate-spin" /> : <ChevronDownIcon size={12} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Target Bucket ID</label>
                                                    <input 
                                                        type="text" value={extBucketId} onChange={e => setExtBucketId(e.target.value)}
                                                        placeholder="Bucket ID" className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-xs text-gray-200 focus:border-cyan-500 outline-none font-mono"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Options</h4>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={deleteOriginals} 
                                        onChange={e => setDeleteOriginals(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500"
                                    />
                                    <span className="text-sm text-gray-300">Delete from source (Move)</span>
                                </label>
                                <div className="flex items-start gap-2 mt-3 text-[10px] text-gray-500 bg-black/20 p-2.5 rounded-lg border border-gray-800">
                                    <RiRocketLine className="text-cyan-500 mt-0.5" size={12} />
                                    <p>Server-side transfer. Files are moved directly between project servers without downloading to your browser.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-800">
                        <button onClick={handleClose} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white transition-colors">
                            Cancel
                        </button>
                        <button 
                            onClick={executeConsolidation}
                            disabled={sourceBucketIds.length === 0}
                            className="px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <RiShareForwardLine size={16} /> Start Transfer
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-[500px]">
                    <div className="flex items-center justify-between gap-4 mb-6 p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-lg">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${status === 'completed' ? 'bg-green-900/20' : 'bg-cyan-900/20'}`}>
                                {status === 'completed' ? <CheckIcon className="text-green-400" size={32} /> : <LoadingSpinnerIcon className="text-cyan-400 animate-spin" size={32} />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-100">{status === 'completed' ? 'Transfer Complete' : 'Transferring Files...'}</h3>
                                <p className="text-sm text-gray-500">
                                    {status === 'completed' ? 'Review logs below.' : 'Deploying worker function and processing batches.'}
                                </p>
                            </div>
                        </div>
                        {status === 'completed' && (
                            <button onClick={handleClose} className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors border border-gray-700">
                                Close
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-1 bg-black/30 rounded-2xl border border-gray-800 p-6 overflow-y-auto custom-scrollbar font-mono text-xs">
                        {logs.map((log, i) => (
                            <div key={i} className={`py-1.5 border-b border-white/5 ${log.includes('ERROR') ? 'text-red-400' : 'text-gray-400'}`}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    );
};
