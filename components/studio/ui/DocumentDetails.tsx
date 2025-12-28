
import React from 'react';
import type { Models } from 'node-appwrite';
import { CopyButton } from './CopyButton';
import { DatabaseIcon, KeyIcon, TeamIcon, RefreshIcon, EditIcon, DeleteIcon } from '../../Icons';

interface DocumentDetailsProps {
    document: Models.Document;
    onEdit?: (doc: Models.Document) => void;
    onDelete?: (doc: Models.Document) => void;
}

export const DocumentDetails: React.FC<DocumentDetailsProps> = ({ document, onEdit, onDelete }) => {
    const { $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions, ...data } = document;

    const MetadataItem = ({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) => (
        <div className="flex flex-col gap-1 p-3 bg-gray-900/50 border border-gray-800 rounded-xl">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                {icon} {label}
            </span>
            <div className="flex items-center justify-between group">
                <span className="text-xs font-mono text-gray-300 truncate pr-2">{value}</span>
                <CopyButton text={value} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Quick Actions Header */}
            {(onEdit || onDelete) && (
                <div className="flex items-center justify-end gap-3 pb-2">
                    {onDelete && (
                        <button 
                            onClick={() => onDelete(document)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-700 hover:border-red-500/50 rounded-xl text-xs font-bold transition-all"
                        >
                            <DeleteIcon size={14} /> Delete
                        </button>
                    )}
                    {onEdit && (
                        <button 
                            onClick={() => onEdit(document)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-cyan-900/30 text-cyan-400 border border-gray-700 hover:border-cyan-500/50 rounded-xl text-xs font-bold transition-all"
                        >
                            <EditIcon size={14} /> Edit Document
                        </button>
                    )}
                </div>
            )}

            {/* Header Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetadataItem label="Document ID" value={$id} icon={<KeyIcon size={10}/>} />
                <MetadataItem label="Created" value={new Date($createdAt).toLocaleString()} icon={<RefreshIcon size={10}/>} />
                <MetadataItem label="Last Updated" value={new Date($updatedAt).toLocaleString()} icon={<RefreshIcon size={10}/>} />
            </div>

            {/* Data Preview */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <DatabaseIcon size={14} className="text-cyan-400" /> Attributes Data
                    </h4>
                    <CopyButton 
                        text={JSON.stringify(data, null, 2)} 
                        showLabel 
                        label="Copy JSON" 
                        className="bg-gray-800 px-3 py-1 rounded-lg border border-gray-700 hover:bg-gray-700" 
                    />
                </div>
                <div className="bg-[#0d1117] rounded-2xl border border-gray-800 p-6 overflow-hidden shadow-inner">
                    <pre className="text-sm font-mono leading-relaxed custom-scrollbar overflow-x-auto max-h-[400px]">
                        {Object.entries(data).map(([key, value]) => (
                            <div key={key} className="group py-0.5">
                                <span className="text-purple-400">"{key}"</span>
                                <span className="text-gray-500">: </span>
                                {typeof value === 'string' ? (
                                    <span className="text-green-400">"{value}"</span>
                                ) : typeof value === 'number' ? (
                                    <span className="text-orange-400">{value}</span>
                                ) : typeof value === 'boolean' ? (
                                    <span className="text-blue-400">{String(value)}</span>
                                ) : value === null ? (
                                    <span className="text-red-400">null</span>
                                ) : (
                                    <span className="text-cyan-300">{JSON.stringify(value)}</span>
                                )}
                                <span className="text-gray-500">,</span>
                            </div>
                        ))}
                    </pre>
                </div>
            </div>

            {/* Permissions */}
            <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <TeamIcon size={14} className="text-purple-400" /> Permissions
                </h4>
                <div className="flex flex-wrap gap-2 p-4 bg-gray-900/30 border border-gray-800 rounded-2xl">
                    {$permissions.length > 0 ? $permissions.map((perm, i) => (
                        <span key={i} className="px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg text-[11px] font-mono text-gray-400">
                            {perm}
                        </span>
                    )) : (
                        <span className="text-xs text-gray-600 italic">No explicit permissions set (using collection defaults)</span>
                    )}
                </div>
            </div>
        </div>
    );
};
