
import React, { useState } from 'react';
import type { Models } from 'node-appwrite';
import { CopyButton } from './CopyButton';
import { DatabaseIcon, KeyIcon, TeamIcon, RefreshIcon, CheckIcon, LoadingSpinnerIcon } from '../../Icons';

interface DocumentEditorProps {
    document: Models.Document;
    onSave: (data: any, permissions: string[]) => Promise<void>;
    onCancel: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ document, onSave, onCancel }) => {
    const { $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions, ...initialData } = document;
    
    const [dataJson, setDataJson] = useState(JSON.stringify(initialData, null, 2));
    const [permissionsStr, setPermissionsStr] = useState($permissions.join(', '));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const parsedData = JSON.parse(dataJson);
            const permsArray = permissionsStr.split(',').map(p => p.trim()).filter(Boolean);
            await onSave(parsedData, permsArray);
        } catch (e: any) {
            setError(e.message || "Invalid JSON or save failed.");
            setIsSaving(false);
        }
    };

    const MetadataItem = ({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) => (
        <div className="flex flex-col gap-1 p-3 bg-gray-900/50 border border-gray-800 rounded-xl">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                {icon} {label}
            </span>
            <div className="flex items-center justify-between group">
                <span className="text-xs font-mono text-gray-400 truncate pr-2">{value}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Metadata (Read-Only) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetadataItem label="Document ID" value={$id} icon={<KeyIcon size={10}/>} />
                <MetadataItem label="Created" value={new Date($createdAt).toLocaleString()} icon={<RefreshIcon size={10}/>} />
                <MetadataItem label="Last Updated" value={new Date($updatedAt).toLocaleString()} icon={<RefreshIcon size={10}/>} />
            </div>

            {/* Data Editor */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <DatabaseIcon size={14} className="text-cyan-400" /> Attributes Data (JSON)
                    </h4>
                    <span className="text-[10px] text-gray-600 font-mono italic">Edit raw fields below</span>
                </div>
                <div className={`relative bg-[#0d1117] rounded-2xl border ${error ? 'border-red-500/50' : 'border-gray-800'} overflow-hidden shadow-inner focus-within:border-cyan-500/50 transition-all`}>
                    <textarea
                        value={dataJson}
                        onChange={(e) => setDataJson(e.target.value)}
                        className="w-full min-h-[300px] p-6 bg-transparent text-sm font-mono text-gray-300 leading-relaxed outline-none resize-y custom-scrollbar"
                        spellCheck="false"
                    />
                </div>
                {error && <p className="text-[11px] text-red-400 px-1 font-medium">{error}</p>}
            </div>

            {/* Permissions Editor */}
            <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <TeamIcon size={14} className="text-purple-400" /> Permissions
                </h4>
                <div className="p-4 bg-gray-900/30 border border-gray-800 rounded-2xl focus-within:border-purple-500/50 transition-all">
                    <input 
                        type="text"
                        value={permissionsStr}
                        onChange={(e) => setPermissionsStr(e.target.value)}
                        placeholder='e.g. read("any"), create("users")'
                        className="w-full bg-transparent text-xs font-mono text-gray-300 outline-none placeholder:text-gray-700"
                    />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button 
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-6 py-2 text-sm font-semibold text-gray-500 hover:text-white transition-colors disabled:opacity-30"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-cyan-900/20 flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? <LoadingSpinnerIcon size={16} /> : <CheckIcon size={16} />}
                    Save Changes
                </button>
            </div>
        </div>
    );
};
