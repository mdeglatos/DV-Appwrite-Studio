
import React, { useState, useEffect } from 'react';
import type { Models } from 'node-appwrite';
import { SettingsIcon, LoadingSpinnerIcon, CheckIcon, WarningIcon } from '../Icons';

interface CollectionSettingsProps {
    collection: Models.Collection;
    onUpdate: (data: any) => Promise<void>;
    onDelete: (coll: Models.Collection) => void;
}

export const CollectionSettings: React.FC<CollectionSettingsProps> = ({ collection, onUpdate, onDelete }) => {
    const [name, setName] = useState(collection.name);
    const [permissions, setPermissions] = useState(collection.$permissions.join(', '));
    const [enabled, setEnabled] = useState(collection.enabled);
    const [security, setSecurity] = useState(collection.documentSecurity);
    const [isSaving, setIsSaving] = useState(false);

    // Update local state when collection prop changes
    useEffect(() => {
        setName(collection.name);
        setPermissions(collection.$permissions.join(', '));
        setEnabled(collection.enabled);
        setSecurity(collection.documentSecurity);
    }, [collection]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdate({
                name, 
                permissions, 
                enabled, 
                documentSecurity: security
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <SettingsIcon className="text-gray-400" /> General Settings
                </h3>
                <div className="space-y-4 max-w-2xl">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Collection Name</label>
                        <input 
                            type="text" value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:border-cyan-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Permissions</label>
                        <input 
                            type="text" value={permissions} onChange={e => setPermissions(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:border-cyan-500 outline-none"
                            placeholder='read("any"), create("users")'
                        />
                    </div>
                    <div className="flex gap-6 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded bg-gray-800 border-gray-600 text-cyan-600 focus:ring-cyan-500" />
                            <span className="text-sm text-gray-300">Enabled</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={security} onChange={e => setSecurity(e.target.checked)} className="rounded bg-gray-800 border-gray-600 text-cyan-600 focus:ring-cyan-500" />
                            <span className="text-sm text-gray-300">Document Security</span>
                        </label>
                    </div>
                    <div className="pt-4">
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-cyan-900/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? <LoadingSpinnerIcon /> : <CheckIcon />} Save Changes
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <WarningIcon /> Danger Zone
                </h3>
                <p className="text-sm text-gray-400 mb-4">Deleting a collection is permanent and will delete all documents contained within it.</p>
                <button 
                    onClick={() => onDelete(collection)}
                    className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-300 text-sm font-semibold rounded-lg transition-colors"
                >
                    Delete Collection
                </button>
            </div>
        </div>
    );
};
