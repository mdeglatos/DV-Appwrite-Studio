
import React, { useState } from 'react';
import { DatabaseIcon, KeyIcon, TeamIcon, CheckIcon, LoadingSpinnerIcon, CloseIcon } from '../../Icons';

interface Attribute {
    key: string;
    type: string;
    required: boolean;
    default?: any;
    array?: boolean;
    elements?: string[]; // for enums
    format?: string;
}

interface DocumentCreateFormProps {
    attributes: Attribute[];
    onSave: (documentId: string, data: any, permissions: string[]) => Promise<void>;
    onCancel: () => void;
}

export const DocumentCreateForm: React.FC<DocumentCreateFormProps> = ({ attributes, onSave, onCancel }) => {
    const [documentId, setDocumentId] = useState('unique()');
    const [permissionsStr, setPermissionsStr] = useState('');
    const [formData, setFormData] = useState<any>(() => {
        const initial: any = {};
        attributes.forEach(attr => {
            initial[attr.key] = attr.default !== undefined && attr.default !== null ? attr.default : (attr.type === 'boolean' ? false : '');
        });
        return initial;
    });
    
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleInputChange = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            // Process data: Convert types and handle arrays
            const processedData: any = {};
            attributes.forEach(attr => {
                let val = formData[attr.key];

                if (attr.array && typeof val === 'string') {
                    processedData[attr.key] = val.split(',').map(s => s.trim()).filter(Boolean);
                } else if (attr.type === 'integer' || attr.type === 'float') {
                    processedData[attr.key] = val === '' ? (attr.required ? 0 : null) : Number(val);
                } else if (attr.type === 'boolean') {
                    processedData[attr.key] = !!val;
                } else {
                    processedData[attr.key] = val === '' && !attr.required ? null : val;
                }
            });

            const permsArray = permissionsStr.split(',').map(p => p.trim()).filter(Boolean);
            await onSave(documentId, processedData, permsArray);
        } catch (e: any) {
            setError(e.message || "Failed to create document. Check attribute constraints.");
            setIsSaving(false);
        }
    };

    const renderInput = (attr: Attribute) => {
        const commonClasses = "w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none transition-all";
        
        if (attr.type === 'boolean') {
            return (
                <div className="flex items-center gap-3 py-2">
                    <input 
                        type="checkbox" 
                        checked={!!formData[attr.key]} 
                        onChange={e => handleInputChange(attr.key, e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                    <span className="text-xs text-gray-400">Value: {formData[attr.key] ? 'True' : 'False'}</span>
                </div>
            );
        }

        if (attr.type === 'enum' && attr.elements) {
            return (
                <select 
                    value={formData[attr.key]} 
                    onChange={e => handleInputChange(attr.key, e.target.value)}
                    className={commonClasses}
                >
                    <option value="" disabled={attr.required}>Select Option</option>
                    {attr.elements.map(el => <option key={el} value={el}>{el}</option>)}
                </select>
            );
        }

        let type = "text";
        if (attr.type === 'integer' || attr.type === 'float') type = "number";
        if (attr.type === 'email') type = "email";
        if (attr.type === 'url') type = "url";
        if (attr.type === 'datetime') type = "datetime-local";

        return (
            <input 
                type={type}
                value={formData[attr.key]}
                onChange={e => handleInputChange(attr.key, e.target.value)}
                placeholder={attr.array ? "Value 1, Value 2, ..." : `Enter ${attr.type}...`}
                className={commonClasses}
                required={attr.required}
                step={attr.type === 'float' ? "any" : "1"}
            />
        );
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
            {/* System Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-900/30 border border-gray-800 rounded-xl space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                        <KeyIcon size={12}/> Document ID
                    </label>
                    <input 
                        type="text" 
                        value={documentId} 
                        onChange={e => setDocumentId(e.target.value)}
                        className="w-full bg-transparent border-b border-gray-700 text-sm font-mono text-cyan-300 focus:border-cyan-500 outline-none py-1"
                        placeholder="unique()"
                        required
                    />
                </div>
                <div className="p-4 bg-gray-900/30 border border-gray-800 rounded-xl space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                        <TeamIcon size={12}/> Initial Permissions
                    </label>
                    <input 
                        type="text" 
                        value={permissionsStr} 
                        onChange={e => setPermissionsStr(e.target.value)}
                        className="w-full bg-transparent border-b border-gray-700 text-sm font-mono text-purple-300 focus:border-purple-500 outline-none py-1"
                        placeholder='read("any"), update("users")'
                    />
                </div>
            </div>

            {/* Dynamic Attributes */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <DatabaseIcon size={14} className="text-cyan-400" />
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Attributes Schema</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 bg-gray-900/20 p-6 rounded-2xl border border-gray-800">
                    {attributes.length === 0 ? (
                        <div className="col-span-2 text-center py-8 text-gray-500 text-sm italic">
                            This collection has no attributes defined.
                        </div>
                    ) : (
                        attributes.map(attr => (
                            <div key={attr.key} className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                        {attr.key}
                                        {attr.required && <span className="text-red-500 text-[10px]">*</span>}
                                    </label>
                                    <span className="text-[9px] font-mono text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                        {attr.type}{attr.array ? '[]' : ''}
                                    </span>
                                </div>
                                {renderInput(attr)}
                                {attr.array && <p className="text-[9px] text-gray-600 px-1 italic">Enter multiple values separated by commas.</p>}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-xs text-red-200 animate-fade-in">
                    {error}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button 
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-6 py-2 text-sm font-semibold text-gray-500 hover:text-white transition-colors disabled:opacity-30"
                >
                    Cancel
                </button>
                <button 
                    type="submit"
                    disabled={isSaving}
                    className="px-8 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-cyan-900/20 flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? <LoadingSpinnerIcon size={16} /> : <CheckIcon size={16} />}
                    Create Document
                </button>
            </div>
        </form>
    );
};
