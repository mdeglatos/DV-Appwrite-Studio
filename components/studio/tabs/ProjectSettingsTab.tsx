import React, { useState, useEffect } from 'react';
import type { AppwriteProject, ApiKey, Platform, ProjectVariable } from '../../../types';
import * as adminService from '../../../services/projectAdminService';
import { KeyIcon, AddIcon, DeleteIcon, LoadingSpinnerIcon, ExternalLinkIcon, WarningIcon, VerifiedIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import { useToast } from '../../../hooks/useToast';
import { ConfirmationModal } from '../../ConfirmationModal';

interface ProjectSettingsTabProps {
    activeProject: AppwriteProject;
}

const ALL_SCOPES = [
    'users.read', 'users.write',
    'teams.read', 'teams.write',
    'databases.read', 'databases.write',
    'collections.read', 'collections.write',
    'attributes.read', 'attributes.write',
    'indexes.read', 'indexes.write',
    'documents.read', 'documents.write',
    'files.read', 'files.write',
    'buckets.read', 'buckets.write',
    'functions.read', 'functions.write',
    'deployments.read', 'deployments.write',
    'executions.read', 'executions.write',
    'variables.read', 'variables.write',
    'webhooks.read', 'webhooks.write',
    'keys.read', 'keys.write',
    'platforms.read', 'platforms.write',
    'health.read',
    'migrations.read', 'migrations.write',
    'messaging.read', 'messaging.write'
];

export const ProjectSettingsTab: React.FC<ProjectSettingsTabProps> = ({ activeProject }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [variables, setVariables] = useState<ProjectVariable[]>([]);
    const [authSettings, setAuthSettings] = useState<adminService.AuthSettings | null>(null);

    // Form inputs state
    const [newKeyName, setNewKeyName] = useState('');
    const [selectedScopes, setSelectedScopes] = useState<string[]>(['databases.read', 'databases.write', 'documents.read', 'documents.write']);
    const [isCreatingKey, setIsCreatingKey] = useState(false);

    // Confirmation Modal state
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    const [newPlatformName, setNewPlatformName] = useState('');
    const [newPlatformType, setNewPlatformType] = useState<'web' | 'android' | 'apple'>('web');
    const [newPlatformHost, setNewPlatformHost] = useState('');
    const [newPlatformPackage, setNewPlatformPackage] = useState('');
    const [newPlatformBundle, setNewPlatformBundle] = useState('');
    const [isCreatingPlatform, setIsCreatingPlatform] = useState(false);

    const [newVarKey, setNewVarKey] = useState('');
    const [newVarVal, setNewVarVal] = useState('');
    const [isCreatingVar, setIsCreatingVar] = useState(false);

    const [isCorsFixing, setIsCorsFixing] = useState(false);

    // Fetch administrative configs
    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const [keysList, platList, varsList, authConfigs] = await Promise.all([
                adminService.listApiKeys(activeProject).catch(() => []),
                adminService.listPlatforms(activeProject).catch(() => []),
                adminService.listGlobalVariables(activeProject).catch(() => []),
                adminService.getAuthSettings(activeProject).catch(() => null)
            ]);
            setApiKeys(keysList);
            setPlatforms(platList);
            setVariables(varsList);
            setAuthSettings(authConfigs);
        } catch (e: any) {
            toast.error(`Could not fetch settings: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, [activeProject]);

    // Handlers
    const handleCreateApiKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName) return;
        setIsCreatingKey(true);
        try {
            const newKey = await adminService.createApiKey(activeProject, newKeyName, selectedScopes);
            setApiKeys([newKey, ...apiKeys]);
            setNewKeyName('');
            toast.success(`Successfully created API key: ${newKeyName}`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsCreatingKey(false);
        }
    };

    const handleDeleteApiKey = (keyId: string) => {
        setConfirmation({
            isOpen: true,
            title: 'Revoke API Key',
            message: 'Are you sure you want to revoke this API key? This action is permanent.',
            onConfirm: async () => {
                try {
                    await adminService.deleteApiKey(activeProject, keyId);
                    setApiKeys(prev => prev.filter(k => k.$id !== keyId));
                    toast.success('Successfully revoked API Key.');
                } catch (err: any) {
                    toast.error(err.message);
                }
            }
        });
    };

    const handleCreatePlatform = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlatformName) return;
        setIsCreatingPlatform(true);
        try {
            const newPlat = await adminService.createPlatform(
                activeProject,
                newPlatformName,
                newPlatformType,
                newPlatformHost,
                newPlatformPackage,
                newPlatformBundle
            );
            setPlatforms([newPlat, ...platforms]);
            setNewPlatformName('');
            setNewPlatformHost('');
            setNewPlatformPackage('');
            setNewPlatformBundle('');
            toast.success(`Successfully registered platform: ${newPlatformName}`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsCreatingPlatform(false);
        }
    };

    const handleDeletePlatform = (platformId: string) => {
        setConfirmation({
            isOpen: true,
            title: 'Delete Platform',
            message: 'Are you sure you want to delete this platform registration?',
            onConfirm: async () => {
                try {
                    await adminService.deletePlatform(activeProject, platformId);
                    setPlatforms(prev => prev.filter(p => p.$id !== platformId));
                    toast.success('Successfully removed platform registration.');
                } catch (err: any) {
                    toast.error(err.message);
                }
            }
        });
    };

    const handleCorsAutoFix = async () => {
        setIsCorsFixing(true);
        try {
            const hostname = window.location.hostname;
            const newPlat = await adminService.createPlatform(
                activeProject,
                `DV Studio (Auto-Registered)`,
                'web',
                hostname
            );
            setPlatforms([newPlat, ...platforms]);
            toast.success(`CORS Auto-Fix successful! Registered hostname "${hostname}".`);
        } catch (err: any) {
            toast.error(`CORS registration failed: ${err.message}`);
        } finally {
            setIsCorsFixing(false);
        }
    };

    const handleCreateVariable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVarKey || !newVarVal) return;
        setIsCreatingVar(true);
        try {
            const newVar = await adminService.createGlobalVariable(activeProject, newVarKey, newVarVal);
            setVariables([newVar, ...variables]);
            setNewVarKey('');
            setNewVarVal('');
            toast.success(`Successfully added global variable: ${newVarKey}`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsCreatingVar(false);
        }
    };

    const handleDeleteVariable = (varId: string) => {
        setConfirmation({
            isOpen: true,
            title: 'Delete Variable',
            message: 'Are you sure you want to delete this environment variable?',
            onConfirm: async () => {
                try {
                    await adminService.deleteGlobalVariable(activeProject, varId);
                    setVariables(prev => prev.filter(v => v.$id !== varId));
                    toast.success('Successfully deleted variable.');
                } catch (err: any) {
                    toast.error(err.message);
                }
            }
        });
    };

    const handleToggleAuthMethod = async (method: 'emailPassword' | 'magicLink' | 'anonymous' | 'phone' | 'invites', currentVal: boolean) => {
        try {
            await adminService.updateAuthMethod(activeProject, method, !currentVal);
            if (authSettings) {
                setAuthSettings({
                    ...authSettings,
                    authMethods: {
                        ...authSettings.authMethods,
                        [method]: !currentVal
                    }
                });
            }
            toast.success(`Successfully updated auth method: ${method}`);
        } catch (err: any) {
            toast.error(`Could not toggle method: ${err.message}`);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <LoadingSpinnerIcon size={32} className="text-cyan-400 animate-spin" />
                <p className="text-gray-400 text-sm">Loading Project settings plane...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header section with console links */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <KeyIcon size={24} className="text-cyan-400" />
                        Project Settings Dashboard
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Manage API Keys, allowed platforms, authentication configurations, and global variables.</p>
                </div>
                <a 
                    href={consoleLinks.settings(activeProject)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900/60 hover:bg-gray-800 border border-white/5 rounded-xl text-xs font-bold text-gray-300 transition-all shadow-inner"
                >
                    <ExternalLinkIcon size={14} /> Open in Console
                </a>
            </div>

            {/* Platform & CORS Fixer section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest">Platform Registrations</h2>
                        <button
                            onClick={handleCorsAutoFix}
                            disabled={isCorsFixing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold rounded-xl transition-all"
                        >
                            {isCorsFixing ? <LoadingSpinnerIcon size={12} className="animate-spin" /> : <VerifiedIcon size={12} />}
                            CORS Auto-Fix
                        </button>
                    </div>

                    <div className="text-xs text-gray-400 mb-4 bg-gray-950/40 p-3.5 rounded-xl border border-white/5 flex items-start gap-2">
                        <WarningIcon size={18} className="text-cyan-400 flex-shrink-0" />
                        <span>To prevent <strong>CORS "failed to fetch"</strong> issues inside this studio, the domain hosting this studio must be added as a Web platform in your target project. Use the one-click CORS Auto-Fixer button above to register it automatically.</span>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-gray-500 font-semibold">
                                    <th className="pb-3">Name</th>
                                    <th className="pb-3">Type</th>
                                    <th className="pb-3">Hostname / ID</th>
                                    <th className="pb-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {platforms.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-4 text-gray-500 italic text-center">No platforms registered. Add one below to authorize SDK access.</td>
                                    </tr>
                                ) : (
                                    platforms.map(plat => (
                                        <tr key={plat.$id} className="text-gray-300">
                                            <td className="py-3.5 font-medium">{plat.name}</td>
                                            <td className="py-3.5"><span className="text-[10px] uppercase bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-md">{plat.type}</span></td>
                                            <td className="py-3.5 font-mono text-[11px] text-gray-400">
                                                {plat.hostname || plat.packageIdentifier || plat.bundleId || '-'}
                                            </td>
                                            <td className="py-3.5 text-right">
                                                <button onClick={() => handleDeletePlatform(plat.$id)} className="text-gray-500 hover:text-red-400 p-1" title="Delete Platform">
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

                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                    <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">Register Platform</h2>
                    <form onSubmit={handleCreatePlatform} className="space-y-4">
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Platform Name</label>
                            <input
                                type="text"
                                className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                                placeholder="E.g., Web App Client"
                                value={newPlatformName}
                                onChange={e => setNewPlatformName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Type</label>
                            <select
                                className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                                value={newPlatformType}
                                onChange={e => setNewPlatformType(e.target.value as any)}
                            >
                                <option value="web">Web Host</option>
                                <option value="android">Android Application</option>
                                <option value="apple">Apple (iOS/macOS)</option>
                            </select>
                        </div>

                        {newPlatformType === 'web' && (
                            <div>
                                <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Hostname</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                                    placeholder="E.g., localhost or domain.com"
                                    value={newPlatformHost}
                                    onChange={e => setNewPlatformHost(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        {newPlatformType === 'android' && (
                            <div>
                                <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Package ID</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                                    placeholder="E.g., com.company.app"
                                    value={newPlatformPackage}
                                    onChange={e => setNewPlatformPackage(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        {newPlatformType === 'apple' && (
                            <div>
                                <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Bundle ID</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                                    placeholder="E.g., com.company.bundle"
                                    value={newPlatformBundle}
                                    onChange={e => setNewPlatformBundle(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isCreatingPlatform}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 font-semibold rounded-xl text-white text-xs transition-colors shadow-inner"
                        >
                            {isCreatingPlatform ? <LoadingSpinnerIcon size={14} className="animate-spin" /> : <AddIcon size={14} />}
                            Add Platform
                        </button>
                    </form>
                </div>
            </div>

            {/* API Keys Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                    <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">Project API Keys</h2>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-gray-500 font-semibold">
                                    <th className="pb-3">Name</th>
                                    <th className="pb-3">Secret Key (Preview)</th>
                                    <th className="pb-3">Scopes count</th>
                                    <th className="pb-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {apiKeys.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-4 text-gray-500 italic text-center">No administrative API keys listed. Create one to enable server-side SDK commands.</td>
                                    </tr>
                                ) : (
                                    apiKeys.map(key => (
                                        <tr key={key.$id}>
                                            <td className="py-3.5 font-medium">{key.name}</td>
                                            <td className="py-3.5 font-mono text-[11px] text-gray-400">
                                                {key.secret ? `${key.secret.slice(0, 10)}...${key.secret.slice(-6)}` : '••••••••••••'}
                                            </td>
                                            <td className="py-3.5">
                                                <span className="bg-purple-900/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-800/30">
                                                    {key.scopes ? key.scopes.length : 0} Scopes
                                                </span>
                                            </td>
                                            <td className="py-3.5 text-right">
                                                <button onClick={() => handleDeleteApiKey(key.$id)} className="text-gray-500 hover:text-red-400 p-1" title="Revoke Key">
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

                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                    <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">Create API Key</h2>
                    <form onSubmit={handleCreateApiKey} className="space-y-4">
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Key Name</label>
                            <input
                                type="text"
                                className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                                placeholder="E.g., Studio Integration Key"
                                value={newKeyName}
                                onChange={e => setNewKeyName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1.5">Configure Scopes</label>
                            <div className="bg-gray-950 border border-white/5 rounded-xl p-3 h-48 overflow-y-auto custom-scrollbar space-y-2">
                                {ALL_SCOPES.map(scope => (
                                    <label key={scope} className="flex items-center gap-2 text-xs text-gray-300 select-none cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedScopes.includes(scope)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setSelectedScopes([...selectedScopes, scope]);
                                                } else {
                                                    setSelectedScopes(selectedScopes.filter(s => s !== scope));
                                                }
                                            }}
                                            className="w-3.5 h-3.5 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                        />
                                        <span>{scope}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isCreatingKey}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 font-semibold rounded-xl text-white text-xs transition-colors shadow-inner"
                        >
                            {isCreatingKey ? <LoadingSpinnerIcon size={14} className="animate-spin" /> : <AddIcon size={14} />}
                            Generate API Key
                        </button>
                    </form>
                </div>
            </div>

            {/* Environment Variables & Auth Configuration Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Global Variables */}
                <div className="lg:col-span-2 bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                    <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">Project Environment Variables</h2>
                    
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-gray-500 font-semibold">
                                    <th className="pb-3">Variable Name</th>
                                    <th className="pb-3">Value</th>
                                    <th className="pb-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {variables.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-gray-500 italic text-center">No environment variables defined. Set one below.</td>
                                    </tr>
                                ) : (
                                    variables.map(v => (
                                        <tr key={v.$id}>
                                            <td className="py-3.5 font-mono text-[11px] font-semibold text-cyan-400">{v.key}</td>
                                            <td className="py-3.5 font-mono text-[11px] text-gray-400">{v.value || '••••••••••••'}</td>
                                            <td className="py-3.5 text-right">
                                                <button onClick={() => handleDeleteVariable(v.$id)} className="text-gray-500 hover:text-red-400 p-1" title="Delete Variable">
                                                    <DeleteIcon size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <form onSubmit={handleCreateVariable} className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-6 border-t border-white/5 pt-4">
                        <input
                            type="text"
                            placeholder="VAR_NAME"
                            className="bg-gray-950 border border-white/5 rounded-xl p-2.5 text-xs text-cyan-400 outline-none focus:ring-1 focus:ring-cyan-500 font-mono font-bold uppercase"
                            value={newVarKey}
                            onChange={e => setNewVarKey(e.target.value.toUpperCase())}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Value"
                            className="bg-gray-950 border border-white/5 rounded-xl p-2.5 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                            value={newVarVal}
                            onChange={e => setNewVarVal(e.target.value)}
                            required
                        />
                        <button
                            type="submit"
                            disabled={isCreatingVar}
                            className="flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 font-semibold rounded-xl text-white text-xs transition-colors shadow-inner"
                        >
                            {isCreatingVar ? <LoadingSpinnerIcon size={12} className="animate-spin" /> : <AddIcon size={12} />}
                            Set Variable
                        </button>
                    </form>
                </div>

                {/* Authentication toggles */}
                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                    <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">Authentication Routes</h2>
                    
                    {authSettings ? (
                        <div className="space-y-4">
                            {Object.entries(authSettings.authMethods).map(([method, val]) => (
                                <div key={method} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                    <div>
                                        <div className="text-xs font-semibold text-gray-200 capitalize">
                                            {method.replace(/([A-Z])/g, ' $1')}
                                        </div>
                                        <div className="text-[10px] text-gray-500">Allow users to log in using this pathway.</div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleAuthMethod(method as any, !!val)}
                                        className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${
                                            val ? 'bg-cyan-500 justify-end' : 'bg-gray-800 justify-start'
                                        }`}
                                    >
                                        <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 italic text-center py-10">
                            Auth Settings are not customizable on this API Key. Ensure it contains the "keys.write" scope.
                        </div>
                    )}
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
