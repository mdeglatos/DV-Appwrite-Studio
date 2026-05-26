import React, { useState, useEffect } from 'react';
import type { AppwriteProject, HealthStatus } from '../../../types';
import { getSdkHealth } from '../../../services/appwrite';
import { HealthIcon, LoadingSpinnerIcon, WarningIcon, VerifiedIcon, ExternalLinkIcon } from '../../Icons';
import { useToast } from '../../../hooks/useToast';

interface HealthTabProps {
    activeProject: AppwriteProject;
}

interface DiagnosticMetrics {
    database: { status: string; message?: string; ping?: number };
    cache: { status: string; message?: string };
    storage: { status: string; message?: string };
    time: { status: string; diff?: number; message?: string };
    antivirus: { status: string; version?: string; message?: string };
    queues: {
        webhooks?: number;
        messaging?: number;
        error?: string;
    };
}

export const HealthTab: React.FC<HealthTabProps> = ({ activeProject }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [diagnostics, setDiagnostics] = useState<DiagnosticMetrics | null>(null);
    const [scopeError, setScopeError] = useState<string | null>(null);

    const runDiagnostics = async () => {
        setIsLoading(true);
        setScopeError(null);
        try {
            const health = getSdkHealth(activeProject);
            
            // Run core checks and measure response ping
            const dbStart = Date.now();
            const dbCheck = (await health.getDB().catch(e => {
                if (e.code === 401 || e.code === 403) throw e;
                return { status: 'error', message: e.message };
            })) as any;
            const dbPing = Date.now() - dbStart;

            const cacheCheck = (await health.getCache().catch(e => ({ status: 'error', message: e.message }))) as any;
            const storageCheck = (await health.getStorage().catch(e => ({ status: 'error', message: e.message }))) as any;
            const timeCheck = (await health.getTime().catch(e => ({ status: 'error', message: e.message }))) as any;
            const antivirusCheck = (await health.getAntivirus().catch(e => ({ status: 'error', message: e.message }))) as any;

            // Fetch queues length
            let webhooksQueue = 0;
            let messagingQueue = 0;
            let queueError = undefined;

            try {
                const whRes = await health.getQueueWebhooks();
                const msgRes = await health.getQueueMessaging();
                webhooksQueue = whRes.size ?? 0;
                messagingQueue = msgRes.size ?? 0;
            } catch (e: any) {
                queueError = e.message;
            }

            setDiagnostics({
                database: {
                    status: dbCheck.status || 'OK',
                    ping: dbPing,
                    message: dbCheck.message
                },
                cache: {
                    status: cacheCheck.status || 'OK',
                    message: cacheCheck.message
                },
                storage: {
                    status: storageCheck.status || 'OK',
                    message: storageCheck.message
                },
                time: {
                    status: timeCheck.status ? 'OK' : 'sync_failed',
                    diff: timeCheck.diff ?? 0,
                    message: timeCheck.message
                },
                antivirus: {
                    status: antivirusCheck.status || 'OK',
                    version: antivirusCheck.version,
                    message: antivirusCheck.message
                },
                queues: {
                    webhooks: webhooksQueue,
                    messaging: messagingQueue,
                    error: queueError
                }
            });

        } catch (e: any) {
            if (e.code === 401 || e.code === 403) {
                setScopeError(`Missing Administrative API Scopes. To view live infrastructure health diagnostics, ensure your Appwrite API Key includes the "health.read" scope permission.`);
            } else {
                toast.error(`Health Audit Failed: ${e.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        runDiagnostics();
    }, [activeProject]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <LoadingSpinnerIcon size={32} className="text-cyan-400 animate-spin" />
                <p className="text-gray-400 text-sm">Executing system diagnostic audit...</p>
            </div>
        );
    }

    if (scopeError) {
        return (
            <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-8 backdrop-blur-md text-center max-w-xl mx-auto py-12 flex flex-col items-center gap-4">
                <WarningIcon size={40} className="text-cyan-400" />
                <h2 className="text-base font-bold text-gray-200 uppercase tracking-widest">Scope Permission Required</h2>
                <p className="text-xs text-gray-400 leading-relaxed">{scopeError}</p>
                <button
                    onClick={runDiagnostics}
                    className="mt-2 px-5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs font-bold text-gray-300 transition-all active:scale-95"
                >
                    Retry Diagnostics
                </button>
            </div>
        );
    }

    const isSystemHealthy = diagnostics 
        ? diagnostics.database.status === 'OK' && diagnostics.cache.status === 'OK' && diagnostics.storage.status === 'OK'
        : false;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <HealthIcon size={24} className="text-cyan-400 animate-pulse" />
                        Infrastructure Diagnostics
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Audit real-time server latencies, memory cache pools, storage checkouts, and queues backlogs.</p>
                </div>
                <button 
                    onClick={runDiagnostics}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 font-semibold rounded-xl text-xs text-white transition-all shadow-inner"
                >
                    Refresh Audit
                </button>
            </div>

            {/* Overall status card */}
            <div className={`p-6 rounded-2xl border flex items-center gap-4 backdrop-blur-md ${
                isSystemHealthy 
                    ? 'bg-green-950/20 border-green-500/20 text-green-400' 
                    : 'bg-red-950/20 border-red-500/20 text-red-400'
            }`}>
                <div className={`p-3 rounded-xl ${isSystemHealthy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <HealthIcon size={28} className={isSystemHealthy ? 'text-green-400' : 'text-red-400'} />
                </div>
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                        System Status: {isSystemHealthy ? 'OPERATIONAL' : 'DEGRADED PERFORMANCE'}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        {isSystemHealthy 
                            ? 'All monitored local and cloud backend components are checked and responding within normal tolerances.' 
                            : 'One or more diagnostic servers returned error signals. Check the gauges below.'}
                    </p>
                </div>
            </div>

            {/* Diagnostics Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Database gauge */}
                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Database Engine</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            diagnostics?.database.status === 'OK' 
                                ? 'bg-green-900/20 text-green-400 border border-green-900/50' 
                                : 'bg-red-900/20 text-red-400 border border-red-900/50'
                        }`}>{diagnostics?.database.status}</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-100 font-mono">
                            {diagnostics?.database.ping ? `${diagnostics.database.ping}ms` : 'Offline'}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">Read/Write latency response check</div>
                    </div>
                    {diagnostics?.database.message && (
                        <div className="text-[10px] text-red-400 bg-red-950/20 p-2 rounded-lg border border-red-900/30">
                            {diagnostics.database.message}
                        </div>
                    )}
                </div>

                {/* 2. Redis Cache Gauge */}
                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cache Pool</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            diagnostics?.cache.status === 'OK' 
                                ? 'bg-green-900/20 text-green-400 border border-green-900/50' 
                                : 'bg-red-900/20 text-red-400 border border-red-900/50'
                        }`}>{diagnostics?.cache.status}</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-100 font-mono">
                            {diagnostics?.cache.status === 'OK' ? 'Connected' : 'Disconnected'}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">In-memory key/value server status</div>
                    </div>
                    {diagnostics?.cache.message && (
                        <div className="text-[10px] text-red-400 bg-red-950/20 p-2 rounded-lg border border-red-900/30">
                            {diagnostics.cache.message}
                        </div>
                    )}
                </div>

                {/* 3. Storage Device Gauge */}
                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Storage System</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            diagnostics?.storage.status === 'OK' 
                                ? 'bg-green-900/20 text-green-400 border border-green-900/50' 
                                : 'bg-red-900/20 text-red-400 border border-red-900/50'
                        }`}>{diagnostics?.storage.status}</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-100 font-mono">
                            {diagnostics?.storage.status === 'OK' ? 'Online' : 'Offline'}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">Disk read/write connectivity check</div>
                    </div>
                    {diagnostics?.storage.message && (
                        <div className="text-[10px] text-red-400 bg-red-950/20 p-2 rounded-lg border border-red-900/30">
                            {diagnostics.storage.message}
                        </div>
                    )}
                </div>
            </div>

            {/* Antivirus & NTP time details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Antivirus & Time */}
                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md space-y-4">
                    <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest">System Sync & Antivirus</h3>
                    
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs py-2 border-b border-white/5">
                            <span className="text-gray-400">NTP Server Sync</span>
                            <span className="font-mono text-gray-200">
                                {diagnostics?.time.status === 'OK' ? `Synced (Diff: ${diagnostics.time.diff}s)` : 'Failed to sync'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-2">
                            <span className="text-gray-400">ClamAV Antivirus</span>
                            <span className="font-mono text-gray-200">
                                {diagnostics?.antivirus.status === 'OK' ? `Running ${diagnostics.antivirus.version || ''}` : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Redis Queues status */}
                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md space-y-4">
                    <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest">Redis Queue Backlog congestion</h3>
                    
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs py-2 border-b border-white/5">
                            <span className="text-gray-400">Webhooks Queue Size</span>
                            <span className="font-mono font-bold text-cyan-400">
                                {diagnostics?.queues.webhooks !== undefined ? `${diagnostics.queues.webhooks} jobs` : 'Error'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-2">
                            <span className="text-gray-400">Messaging Queue Size</span>
                            <span className="font-mono font-bold text-cyan-400">
                                {diagnostics?.queues.messaging !== undefined ? `${diagnostics.queues.messaging} jobs` : 'Error'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
