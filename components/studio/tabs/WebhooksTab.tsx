import React, { useState, useEffect } from 'react';
import type { AppwriteProject, Webhook } from '../../../types';
import * as adminService from '../../../services/projectAdminService';
import { WebhookIcon, AddIcon, DeleteIcon, LoadingSpinnerIcon, ExternalLinkIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import { useToast } from '../../../hooks/useToast';
import { ConfirmationModal } from '../../ConfirmationModal';

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
    const [isLoading, setIsLoading] = useState(true);
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);

    // Form inputs state
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [selectedEvents, setSelectedEvents] = useState<string[]>(['databases.*.collections.*.documents.*.create']);
    const [newSecurity, setNewSecurity] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Confirmation Modal state
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Load webhooks
    const loadWebhooks = async () => {
        setIsLoading(true);
        try {
            const list = await adminService.listWebhooks(activeProject).catch(() => []);
            setWebhooks(list);
        } catch (e: any) {
            toast.error(`Webhooks Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadWebhooks();
    }, [activeProject]);

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
    const handleDeleteWebhook = (webhookId: string) => {
        setConfirmation({
            isOpen: true,
            title: 'Deregister Webhook',
            message: 'Are you sure you want to deregister and delete this webhook configuration?',
            onConfirm: async () => {
                try {
                    await adminService.deleteWebhook(activeProject, webhookId);
                    setWebhooks(prev => prev.filter(w => w.$id !== webhookId));
                    toast.success('Successfully deleted webhook.');
                } catch (err: any) {
                    toast.error(err.message);
                }
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <LoadingSpinnerIcon size={32} className="text-cyan-400 animate-spin" />
                <p className="text-gray-400 text-sm">Loading Webhook configurations...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <WebhookIcon size={24} className="text-cyan-400" />
                        Webhooks Plane
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Configure HTTP POST webhook endpoints that listen and fire automatically on Appwrite system events.</p>
                </div>
                <a 
                    href={consoleLinks.overview(activeProject) + '/webhooks'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900/60 hover:bg-gray-800 border border-white/5 rounded-xl text-xs font-bold text-gray-300 transition-all shadow-inner"
                >
                    <ExternalLinkIcon size={14} /> Open in Console
                </a>
            </div>

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
                                    <th className="pb-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {webhooks.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-4 text-gray-500 italic text-center">No webhooks registered. Create one to dispatch system triggers.</td>
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
            {confirmation && (
                <ConfirmationModal
                    isOpen={confirmation.isOpen}
                    title={confirmation.title}
                    message={confirmation.message}
                    onConfirm={() => {
                        confirmation.onConfirm();
                        setConfirmation(null);
                    }}
                    onClose={() => setConfirmation(null)}
                />
            )}
        </div>
    );
};
