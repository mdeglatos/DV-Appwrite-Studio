import React, { useState, useEffect, useCallback } from 'react';
import type { AppwriteProject, Webhook } from '../../../types';
import * as adminService from '../../../services/projectAdminService';
import { WebhookIcon, AddIcon, DeleteIcon, LoadingSpinnerIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import { useToast } from '../../../hooks/useToast';
import { useConfirm } from '../../../hooks/useConfirm';
import { TabShell } from '../ui/TabShell';
import { ListState } from '../ui/ListState';
import { CopyButton } from '../ui/CopyButton';
import { useRegisterSectionRefresh } from '../hooks/useSectionRefresh';

interface WebhooksTabProps {
    activeProject: AppwriteProject;
}

const COMMON_EVENTS = [
    'users.create',
    'users.update.status',
    'users.delete',
    'teams.create',
    'teams.delete',
    'databases.*.collections.*.documents.*.create',
    'databases.*.collections.*.documents.*.update',
    'databases.*.collections.*.documents.*.delete',
    'files.create',
    'files.delete',
    'functions.*.executions.create'
];

export const WebhooksTab: React.FC<WebhooksTabProps> = ({ activeProject }) => {
    const toast = useToast();
    const confirm = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);

    // Form inputs state
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [selectedEvents, setSelectedEvents] = useState<string[]>(['databases.*.collections.*.documents.*.create']);
    const [customEvent, setCustomEvent] = useState('');
    const [newSecurity, setNewSecurity] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Load webhooks. The failure used to be swallowed into an empty list, so a
    // key missing `webhooks.read` read as "no webhooks registered".
    const loadWebhooks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await adminService.listWebhooks(activeProject);
            setWebhooks(list);
        } catch (e: any) {
            setError(`Webhooks Error: ${e.message}`);
            setWebhooks([]);
        } finally {
            setIsLoading(false);
        }
    }, [activeProject]);

    useRegisterSectionRefresh(loadWebhooks);

    useEffect(() => {
        loadWebhooks();
    }, [loadWebhooks]);

    /** Events outside the preset list — Appwrite accepts far more than the 11 shown. */
    const addCustomEvent = () => {
        const event = customEvent.trim();
        if (!event || selectedEvents.includes(event)) {
            setCustomEvent('');
            return;
        }
        setSelectedEvents([...selectedEvents, event]);
        setCustomEvent('');
    };

    // Create webhook handler
    const handleCreateWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !newUrl) return;
        setIsCreating(true);
        try {
            const newWh = await adminService.createWebhook(activeProject, newName, newUrl, selectedEvents, newSecurity);
            setWebhooks([newWh, ...webhooks]);
            setNewName('');
            setNewUrl('');
            toast.success(`Successfully registered webhook: ${newName}`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    // Delete webhook handler
    const handleDeleteWebhook = async (webhookId: string) => {
        const confirmed = await confirm({
            title: 'Deregister Webhook',
            message: 'Are you sure you want to deregister and delete this webhook configuration?',
        });
        if (!confirmed) return;
        try {
            await adminService.deleteWebhook(activeProject, webhookId);
            setWebhooks(prev => prev.filter(w => w.$id !== webhookId));
            toast.success('Successfully deleted webhook.');
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <TabShell
            title="Webhooks Plane"
            subtitle="Configure HTTP POST webhook endpoints that listen and fire automatically on Appwrite system events."
            icon={<WebhookIcon size={24} className="text-cyan-400" />}
            consoleHref={consoleLinks.overview(activeProject) + '/webhooks'}
        >

            {/* List and Create layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Webhooks List */}
                <div className="lg:col-span-2 bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                    <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">Active Webhooks</h2>
                    
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-gray-500 font-semibold">
                                    <th className="pb-3">Name</th>
                                    <th className="pb-3">Destination URL</th>
                                    <th className="pb-3">Active Triggers</th>
                                    <th className="pb-3">Status &amp; Signature Key</th>
                                    <th className="pb-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {isLoading || error || webhooks.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <ListState
                                                isLoading={isLoading}
                                                error={error}
                                                isEmpty={webhooks.length === 0}
                                                emptyMessage="No webhooks registered. Create one to dispatch system triggers."
                                                loadingMessage="Loading Webhook configurations…"
                                                onRetry={loadWebhooks}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    webhooks.map(wh => (
                                        <tr key={wh.$id}>
                                            <td className="py-3.5">
                                                <div className="font-semibold">{wh.name}</div>
                                                <div className="text-[9px] text-gray-500 font-mono mt-0.5">{wh.$id}</div>
                                            </td>
                                            <td className="py-3.5 font-mono text-gray-400 break-all select-all">{wh.url}</td>
                                            <td className="py-3.5">
                                                <div className="flex gap-1 flex-wrap max-w-xs">
                                                    {wh.events.map(ev => (
                                                        <span key={ev} className="text-[9px] font-mono bg-purple-900/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/30">
                                                            {ev}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-3.5">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border w-fit ${
                                                        wh.enabled
                                                            ? 'bg-green-900/20 text-green-400 border-green-900/50'
                                                            : 'bg-gray-800 text-gray-500 border-gray-700'
                                                    }`}>
                                                        {wh.enabled ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                    {wh.signatureKey && (
                                                        <div className="flex items-center gap-1 group">
                                                            <span className="font-mono text-[9px] text-gray-500">
                                                                {`${wh.signatureKey.slice(0, 4)}${'•'.repeat(8)}${wh.signatureKey.slice(-4)}`}
                                                            </span>
                                                            <CopyButton text={wh.signatureKey} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 text-right">
                                                <button onClick={() => handleDeleteWebhook(wh.$id)} className="text-gray-500 hover:text-red-400 p-1" title="Delete Webhook">
                                                    <DeleteIcon size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Create Webhook */}
                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                    <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">Register Webhook</h2>
                    <form onSubmit={handleCreateWebhook} className="space-y-4">
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Webhook Name</label>
                            <input
                                type="text"
                                className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                                placeholder="E.g., Discord Channel Alert"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">POST Destination URL</label>
                            <input
                                type="url"
                                className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                                placeholder="E.g., https://hooks.zapier.com/..."
                                value={newUrl}
                                onChange={e => setNewUrl(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1.5">Select Event Triggers</label>
                            <div className="bg-gray-950 border border-white/5 rounded-xl p-3 h-40 overflow-y-auto custom-scrollbar space-y-2">
                                {COMMON_EVENTS.map(event => (
                                    <label key={event} className="flex items-center gap-2 text-xs text-gray-300 select-none cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedEvents.includes(event)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setSelectedEvents([...selectedEvents, event]);
                                                } else {
                                                    setSelectedEvents(selectedEvents.filter(ev => ev !== event));
                                                }
                                            }}
                                            className="w-3.5 h-3.5 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                        />
                                        <span>{event}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    aria-label="Custom event"
                                    placeholder="Custom event, e.g. buckets.*.files.*.update"
                                    className="flex-1 min-w-0 bg-gray-950 border border-white/5 rounded-xl p-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                                    value={customEvent}
                                    onChange={e => setCustomEvent(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { e.preventDefault(); addCustomEvent(); }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={addCustomEvent}
                                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-[10px] font-bold text-gray-300 transition-colors flex-shrink-0"
                                >
                                    Add Event
                                </button>
                            </div>
                            {selectedEvents.some(ev => !COMMON_EVENTS.includes(ev)) && (
                                <div className="flex gap-1 flex-wrap mt-2">
                                    {selectedEvents.filter(ev => !COMMON_EVENTS.includes(ev)).map(ev => (
                                        <span key={ev} className="text-[9px] font-mono bg-purple-900/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/30 flex items-center gap-1">
                                            {ev}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedEvents(selectedEvents.filter(e => e !== ev))}
                                                className="text-purple-400 hover:text-red-400"
                                                title={`Remove ${ev}`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="security"
                                checked={newSecurity}
                                onChange={e => setNewSecurity(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                            />
                            <label htmlFor="security" className="text-xs text-gray-300 cursor-pointer select-none">Verify SSL Certificates</label>
                        </div>

                        <button
                            type="submit"
                            disabled={isCreating}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 font-semibold rounded-xl text-white text-xs transition-colors shadow-inner"
                        >
                            {isCreating ? <LoadingSpinnerIcon size={14} className="animate-spin" /> : <AddIcon size={14} />}
                            Add Webhook
                        </button>
                    </form>
                </div>
            </div>
        </TabShell>
    );
};
