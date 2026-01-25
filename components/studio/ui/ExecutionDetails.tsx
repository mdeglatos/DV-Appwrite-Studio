
import React, { useState, useEffect } from 'react';
import type { Models } from 'node-appwrite';
import { CopyButton } from './CopyButton';
import { ArrowLeftIcon, ArrowRightIcon } from '../../Icons';

interface ExecutionDetailsProps {
    execution: Models.Execution;
    allExecutions?: Models.Execution[];
}

export const ExecutionDetails: React.FC<ExecutionDetailsProps> = ({ execution: initialExecution, allExecutions }) => {
    const [currentExecution, setCurrentExecution] = useState(initialExecution);

    useEffect(() => {
        setCurrentExecution(initialExecution);
    }, [initialExecution]);

    const e = currentExecution as any;
    const logs = e.logs || e.stdout || '';
    const errors = e.errors || e.stderr || '';
    const statusCode = e.responseStatusCode || 200;

    // Navigation Logic
    // Assuming allExecutions is sorted DESC (Newest at index 0)
    const currentIndex = allExecutions?.findIndex(ex => ex.$id === currentExecution.$id) ?? -1;
    const hasNewer = currentIndex > 0;
    const hasOlder = allExecutions && currentIndex !== -1 && currentIndex < allExecutions.length - 1;

    const handleNewer = () => {
        if (hasNewer && allExecutions) setCurrentExecution(allExecutions[currentIndex - 1]);
    };

    const handleOlder = () => {
        if (hasOlder && allExecutions) setCurrentExecution(allExecutions[currentIndex + 1]);
    };

    const formatHeaders = (headers: any[]) => {
        if (!headers || headers.length === 0) return <span className="text-gray-500 italic">No headers</span>;
        return (
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs font-mono">
                {headers.map((h, i) => (
                    <React.Fragment key={i}>
                        <span className="text-gray-400 text-right select-none">{h.name}:</span>
                        <span className="text-gray-200 break-all">{h.value}</span>
                    </React.Fragment>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-[65vh]">
            {/* Fixed Header Section */}
            <div className="flex-shrink-0 space-y-4 mb-4">
                {/* Navigation Bar */}
                {allExecutions && (
                    <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleNewer}
                                disabled={!hasNewer}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-gray-800 disabled:cursor-not-allowed transition-colors text-xs font-bold border border-gray-700"
                            >
                                <ArrowLeftIcon size={14} /> Newer
                            </button>
                            <button
                                onClick={handleOlder}
                                disabled={!hasOlder}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-gray-800 disabled:cursor-not-allowed transition-colors text-xs font-bold border border-gray-700"
                            >
                                Older <ArrowRightIcon size={14} />
                            </button>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono font-medium">
                            {currentIndex + 1} / {allExecutions.length}
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                        <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Status</span>
                        <span className={`text-sm font-bold ${e.status === 'completed' ? 'text-green-400' : e.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {e.status.toUpperCase()}
                        </span>
                    </div>
                    <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                        <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Method</span>
                        <span className="text-sm font-mono text-purple-300">{e.requestMethod || 'GET'}</span>
                    </div>
                    <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                        <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Duration</span>
                        <span className="text-sm font-mono text-gray-300">{e.duration?.toFixed(3) || 0}s</span>
                    </div>
                    <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                        <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Code</span>
                        <span className={`text-sm font-mono ${statusCode >= 400 ? 'text-red-400' : 'text-green-400'}`}>{statusCode}</span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Section */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4 space-y-2 text-xs">
                    <div className="flex justify-between border-b border-gray-800 pb-2 group">
                        <span className="text-gray-500">Execution ID</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-300">{e.$id}</span>
                            <CopyButton text={e.$id} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                        <span className="text-gray-500">Timestamp</span>
                        <span className="font-mono text-cyan-300">{new Date(e.$createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                        <span className="text-gray-500">Path</span>
                        <span className="font-mono text-gray-300 break-all text-right pl-4">{e.requestPath || '/'}</span>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Logs</h4>
                    <div className="bg-black/30 rounded-lg border border-gray-800 p-3 overflow-x-auto min-h-[100px]">
                        <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all">{logs || '(Empty)'}</pre>
                    </div>
                </div>

                {errors && (
                    <div>
                        <h4 className="text-xs font-bold text-red-400 uppercase mb-2">Errors</h4>
                        <div className="bg-red-950/10 rounded-lg border border-red-900/30 p-3 overflow-x-auto">
                            <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap break-all">{errors}</pre>
                        </div>
                    </div>
                )}

                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Request Headers</h4>
                    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-3 overflow-x-auto">
                        {formatHeaders(e.requestHeaders)}
                    </div>
                </div>
            </div>
        </div>
    );
};
