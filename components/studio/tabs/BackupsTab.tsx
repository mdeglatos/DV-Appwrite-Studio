
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppwriteProject, BackupOptions } from '../../../types';
import type { Models } from 'node-appwrite';
import { BackupService, BACKUP_BUCKET_ID } from '../../../services/backupService';
import { getSdkStorage, Query, ID } from '../../../services/appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { BackupIcon, LoadingSpinnerIcon, RiShareForwardLine, CheckIcon, DownloadCloudIcon, UploadCloudIcon, WarningIcon, DeleteIcon, DatabaseIcon, FunctionIcon, UserIcon, TeamIcon, StorageIcon, CloseIcon, CodeIcon } from '../../Icons';
import { Modal } from '../../Modal';

interface BackupsTabProps {
    activeProject: AppwriteProject;
    logCallback: (msg: string) => void;
}

export const BackupsTab: React.FC<BackupsTabProps> = ({ activeProject, logCallback }) => {
    const [backups, setBackups] = useState<Models.File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showExecutionLogs, setShowExecutionLogs] = useState(false);
    const [progressLogs, setProgressLogs] = useState<string[]>([]);
    
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [options, setOptions] = useState<BackupOptions>({
        includeDatabases: true,
        includeDocuments: true,
        includeFunctions: true,
        includeFunctionCode: true,
        includeStorageMetadata: true,
        includeUsers: true,
        includeTeams: true
    });

    const fetchBackups = useCallback(async () => {
        if (!activeProject) return;
        setIsLoading(true);
        try {
            const storage = getSdkStorage(activeProject);
            const res = await storage.listFiles(BACKUP_BUCKET_ID, [Query.orderDesc('$createdAt'), Query.limit(100)]);
            setBackups(res.files);
        } catch (e) {
            setBackups([]);
        } finally {
            setIsLoading(false);
        }
    }, [activeProject]);

    useEffect(() => {
        fetchBackups();
    }, [fetchBackups]);

    const handleToggleAll = (val: boolean) => {
        setOptions({
            includeDatabases: val,
            includeDocuments: val,
            includeFunctions: val,
            includeFunctionCode: val,
            includeStorageMetadata: val,
            includeUsers: val,
            includeTeams: val
        });
    };

    const handleCreateBackup = async () => {
        setIsConfigModalOpen(false);
        setIsExecuting(true);
        setShowExecutionLogs(true);
        setProgressLogs(["🚀 Initializing high-fidelity project snapshot..."]);
        
        try {
            const service = new BackupService(activeProject, logCallback);
            setProgressLogs(prev => [...prev, "📦 Deploying cloud backup worker..."]);
            await service.deployBackupWorker();
            
            setProgressLogs(prev => [...prev, "🔍 Scanning project resources and gathering metadata..."]);
            const result = await service.runBackup(options);
            
            if (result && result.success) {
                const successMsg = `✅ Snapshot completed successfully: ${result.fileName || 'Archive ready'}`;
                setProgressLogs(prev => [...prev, successMsg]);
                fetchBackups();
            } else {
                const errMsg = (result && result.error) || "Unknown worker execution error.";
                throw new Error(errMsg);
            }
        } catch (err: any) {
            const failMsg = `❌ Snapshot Failed: ${err.message || String(err)}`;
            setProgressLogs(prev => [...prev, failMsg]);
            console.error("Backup failure:", err);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleRestore = async (fileId: string, fileName: string) => {
        setIsExecuting(true);
        setShowExecutionLogs(true);
        setProgressLogs([`🚀 Initializing project restoration from: ${fileName}...`]);
        
        try {
            const service = new BackupService(activeProject, logCallback);
            setProgressLogs(prev => [...prev, "🛠️ Deploying cloud restore worker..."]);
            await service.deployRestoreWorker();
            
            setProgressLogs(prev => [...prev, "🏗️ Rebuilding infrastructure (databases, collections, indexes)..."]);
            const result = await service.runRestore(fileId);
            
            if (result && result.success) {
                setProgressLogs(prev => [...prev, "✅ Restoration complete. Resource structure matched."]);
            } else {
                const errMsg = (result && result.error) || "Restore worker failed.";
                throw new Error(errMsg);
            }
        } catch (err: any) {
            const failMsg = `❌ Restoration Failed: ${err.message || String(err)}`;
            setProgressLogs(prev => [...prev, failMsg]);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            alert("Please select a valid .json snapshot file.");
            return;
        }

        setIsUploading(true);
        setShowExecutionLogs(true);
        setProgressLogs([`📤 Uploading local snapshot: ${file.name}...`]);

        try {
            const service = new BackupService(activeProject, logCallback);
            await service.ensureBackupBucket();
            
            // Native fetch with FormData for browser compatibility
            const formData = new FormData();
            const fileId = ID.unique();
            formData.append('fileId', fileId);
            formData.append('file', file);

            const uploadRes = await fetch(`${activeProject.endpoint}/storage/buckets/${BACKUP_BUCKET_ID}/files`, {
                method: 'POST',
                headers: {
                    'X-Appwrite-Project': activeProject.projectId,
                    'X-Appwrite-Key': activeProject.apiKey,
                },
                body: formData
            });

            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                throw new Error(errData.message || "Upload failed");
            }

            setProgressLogs(prev => [...prev, "✅ Upload successful. Starting restoration pipeline..."]);
            fetchBackups();
            await handleRestore(fileId, file.name);

        } catch (err: any) {
            setProgressLogs(prev => [...prev, `❌ Upload Failed: ${err.message}`]);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteBackup = async (file: Models.File) => {
        if (!confirm('Delete this snapshot file?')) return;
        try {
            const storage = getSdkStorage(activeProject);
            await storage.deleteFile(BACKUP_BUCKET_ID, file.$id);
            fetchBackups();
        } catch (e: any) {
            alert(e.message || String(e));
        }
    };

    const handleDownload = async (file: Models.File) => {
        try {
            // Manual fetch ensures headers are correctly set and the response body is captured as a Blob.
            // This is more reliable for file downloads with API keys in browser than SDK internal binary return types.
            const response = await fetch(`${activeProject.endpoint}/storage/buckets/${BACKUP_BUCKET_ID}/files/${file.$id}/download`, {
                headers: {
                    'X-Appwrite-Project': activeProject.projectId,
                    'X-Appwrite-Key': activeProject.apiKey,
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: 'Download failed' }));
                throw new Error(errData.message || `HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e: any) {
            console.error("Download failed:", e);
            alert("Failed to download snapshot: " + (e.message || String(e)));
        }
    };

    const isAllSelected = Object.values(options).every(v => v === true);

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
                        <BackupIcon size={32} className="text-cyan-400" />
                        Project Snapshots
                    </h1>
                    <p className="text-gray-400 font-medium">Capture and restore exact replicas of your project infrastructure.</p>
                </div>
                <div className="flex gap-3">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleLocalFileUpload} 
                        className="hidden" 
                        accept=".json" 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isExecuting || isUploading}
                        className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-purple-400 border border-purple-500/30 font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isUploading ? <LoadingSpinnerIcon size={18}/> : <UploadCloudIcon size={18}/>}
                        Upload & Restore
                    </button>
                    <button 
                        onClick={() => setIsConfigModalOpen(true)} 
                        disabled={isExecuting || isUploading}
                        className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isExecuting ? <LoadingSpinnerIcon size={18}/> : <DownloadCloudIcon size={18}/>}
                        New Snapshot
                    </button>
                </div>
            </header>

            {showExecutionLogs && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl animate-fade-in relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            {isExecuting || isUploading ? <LoadingSpinnerIcon className="text-cyan-400 animate-spin" size={24} /> : <CheckIcon className="text-green-500" size={24} />}
                            <h3 className="font-bold text-gray-200">
                                {isExecuting || isUploading ? "Processing..." : "Process Finished"}
                            </h3>
                        </div>
                        {!(isExecuting || isUploading) && (
                            <button 
                                onClick={() => setShowExecutionLogs(false)}
                                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
                            >
                                <CloseIcon size={20} />
                            </button>
                        )}
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 font-mono text-[12px] text-gray-400 h-64 overflow-y-auto custom-scrollbar space-y-1.5 border border-gray-800/50">
                        {progressLogs.map((log, i) => (
                            <div key={`log-${i}`} className={log.includes('✅') ? 'text-green-400 font-bold' : log.includes('❌') ? 'text-red-400 font-bold' : ''}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-cyan-900/10 border border-cyan-900/30 rounded-2xl p-6 flex items-start gap-4 shadow-inner">
                    <WarningIcon className="text-cyan-500 flex-shrink-0" />
                    <div className="text-sm text-cyan-200/70 leading-relaxed">
                        <p className="font-bold text-cyan-400 mb-1">High-Fidelity Mode</p>
                        Snapshots include full database schemas, collections, relationship attributes, and user roles. Restore operations attempt to reconstruct the exact environment captured.
                    </div>
                </div>

                <ResourceTable<Models.File>
                    title="Available Snapshots"
                    data={backups}
                    headers={['Created At', 'File Name', 'Size', 'Actions']}
                    renderName={(f) => (
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-200">{f.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{f.$id}</span>
                        </div>
                    )}
                    renderExtra={(f) => (
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xs text-gray-400">{(f.sizeOriginal / 1024).toFixed(1)} KB</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDownload(f); }}
                                    className="p-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-400 rounded-lg transition-colors border border-gray-700"
                                    title="Download Locally"
                                >
                                    <DownloadCloudIcon size={16}/>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if (confirm(`Restore from "${f.name}"?`)) handleRestore(f.$id, f.name); }}
                                    className="p-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 rounded-lg transition-colors border border-purple-900/50"
                                    title="Restore Snapshot"
                                >
                                    <UploadCloudIcon size={16}/>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteBackup(f); }}
                                    className="p-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors border border-red-900/30"
                                    title="Delete File"
                                >
                                    <DeleteIcon size={16}/>
                                </button>
                            </div>
                        </div>
                    )}
                />
            </div>

            <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="Configure Snapshot" size="xl">
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                        <div>
                            <h3 className="text-sm font-bold text-gray-100">Include Everything</h3>
                            <p className="text-xs text-gray-500">Capture the entire project state for a perfect mirror.</p>
                        </div>
                        <button 
                            onClick={() => handleToggleAll(!isAllSelected)}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all ${isAllSelected ? 'bg-cyan-600/20 border-cyan-500 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                        >
                            {isAllSelected ? 'Deselect All' : 'Select Everything'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { id: 'includeDatabases', label: 'Databases & Collections', icon: <DatabaseIcon size={14}/> },
                            { id: 'includeDocuments', label: 'All Documents (JSON)', icon: <RiShareForwardLine size={14}/> },
                            { id: 'includeFunctions', label: 'Cloud Functions & Vars', icon: <FunctionIcon size={14}/> },
                            { id: 'includeFunctionCode', label: 'Source Code Files', icon: <CodeIcon size={14}/> },
                            { id: 'includeStorageMetadata', label: 'Storage Buckets', icon: <StorageIcon size={14}/> },
                            { id: 'includeUsers', label: 'User Accounts', icon: <UserIcon size={14}/> },
                            { id: 'includeTeams', label: 'Teams & Memberships', icon: <TeamIcon size={14}/> },
                        ].map((item) => (
                            <label key={item.id} className="flex items-center justify-between p-4 bg-gray-800/40 border border-gray-700 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${options[item.id as keyof BackupOptions] ? 'bg-cyan-900/30 text-cyan-400' : 'bg-gray-900 text-gray-600 group-hover:text-gray-400'}`}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <span className={`text-sm font-medium ${options[item.id as keyof BackupOptions] ? 'text-gray-100' : 'text-gray-400 group-hover:text-gray-300'}`}>{item.label}</span>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        checked={options[item.id as keyof BackupOptions] as boolean} 
                                        onChange={e => setOptions({...options, [item.id]: e.target.checked})}
                                        className="sr-only peer" 
                                    />
                                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-800">
                        <button onClick={() => setIsConfigModalOpen(false)} className="px-5 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                        <button 
                            onClick={handleCreateBackup}
                            className="px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg flex items-center gap-2"
                        >
                            <DownloadCloudIcon size={16} /> Start Backup
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
