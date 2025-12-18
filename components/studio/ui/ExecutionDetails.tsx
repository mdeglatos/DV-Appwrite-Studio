
import React from 'react';
import type { Models } from 'node-appwrite';
import { CopyButton } from './CopyButton';

interface ExecutionDetailsProps {
    execution: Models.Execution;
}

export const ExecutionDetails: React.FC<ExecutionDetailsProps> = ({ execution }) => {
    const e = execution as any;
    const logs = e.logs || e.stdout || '';
    const errors = e.errors || e.stderr || '';
    const statusCode = e.responseStatusCode || 200;

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
        <div className="space-y-6">
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

            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4 space-y-2 text-xs">
                <div className="flex justify-between border-b border-gray-800 pb-2 group">
                    <span className="text-gray-500">Execution ID</span>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-300">{e.$id}</span>
                        <CopyButton text={e.$id} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Path</span>
                    <span className="font-mono text-gray-300 break-all">{e.requestPath || '/'}</span>
                </div>
            </div>

            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Logs</h4>
                <div className="bg-black/30 rounded-lg border border-gray-800 p-3 overflow-x-auto max-h-48 custom-scrollbar">
                    <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{logs || '(Empty)'}</pre>
                </div>
            </div>

            {errors && (
                <div>
                    <h4 className="text-xs font-bold text-red-400 uppercase mb-2">Errors</h4>
                    <div className="bg-red-950/10 rounded-lg border border-red-900/30 p-3 overflow-x-auto max-h-48 custom-scrollbar">
                        <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap">{errors}</pre>
                    </div>
                </div>
            )}

            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Request Headers</h4>
                <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-3 max-h-32 overflow-y-auto custom-scrollbar">
                    {formatHeaders(e.requestHeaders)}
                </div>
            </div>
        </div>
    );
};
