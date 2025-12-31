
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { getAuditLogs, exportLogsToCSV, clearAuditLogs, type AuditLogEntry } from '../services/auditLogService';
import { LoadingSpinnerIcon, DeleteIcon, CheckIcon, WarningIcon, CloseIcon } from './Icons';

interface AuditLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, projectId }) => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showConfirmClear, setShowConfirmClear] = useState(false);

    const fetchLogs = async () => {
        setIsLoading(true);
        const data = await getAuditLogs(projectId);
        data.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(data);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
            setShowConfirmClear(false);
        }
    }, [isOpen, projectId]);

    const handleClear = async () => {
        await clearAuditLogs();
        setShowConfirmClear(false);
        fetchLogs();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Agent Audit Log" size="3xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <p className="text-sm text-gray-400">
                    Local history of actions performed by the AI Agent. Stored in browser IndexedDB.
                </p>
                <div className="flex gap-2">
                    <button 
                        onClick={() => exportLogsToCSV(logs)}
                        disabled={logs.length === 0}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-400 text-xs font-bold rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
                    >
                        Export CSV
                    </button>
                    
                    {!showConfirmClear ? (
                        <button 
                            onClick={() => setShowConfirmClear(true)}
                            disabled={logs.length === 0}
                            className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-900/50 disabled:opacity-50 flex items-center gap-1"
                        >
                            <DeleteIcon size={12} /> Clear
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 animate-fade-in bg-red-900/20 border border-red-900/50 rounded-lg p-1">
                            <span className="text-[10px] font-bold text-red-400 px-2 uppercase">Sure?</span>
                            <button onClick={handleClear} className="p-1 text-red-400 hover:bg-red-400 hover:text-white rounded transition-colors"><CheckIcon size={14}/></button>
                            <button onClick={() => setShowConfirmClear(false)} className="p-1 text-gray-400 hover:bg-gray-700 rounded transition-colors"><CloseIcon size={14}/></button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden min-h-[400px] flex flex-col">
                <div className="grid grid-cols-[140px_1fr_100px_100px] gap-4 bg-gray-800/50 px-4 py-2 border-b border-gray-700 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <span>Timestamp</span>
                    <span>Tool / Action</span>
                    <span>Duration</span>
                    <span>Status</span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <LoadingSpinnerIcon className="text-cyan-500 animate-spin" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8">
                            <p>No logs found.</p>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="grid grid-cols-[140px_1fr_100px_100px] gap-4 px-4 py-3 border-b border-gray-800/50 hover:bg-white/5 transition-colors text-xs text-gray-300">
                                <span className="font-mono text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                                <div className="space-y-1 overflow-hidden">
                                    <div className="font-bold text-cyan-300">{log.toolName}</div>
                                    <div className="font-mono text-gray-500 truncate" title={log.args}>{log.args}</div>
                                </div>
                                <span className="text-gray-500 font-mono">{log.duration}ms</span>
                                <span className={`flex items-center gap-1 font-bold ${log.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    {log.status === 'success' ? <CheckIcon size={12} /> : <WarningIcon size={12} />}
                                    {log.status.toUpperCase()}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>
    );
};
