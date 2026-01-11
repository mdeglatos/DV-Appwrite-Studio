
import React, { useState } from 'react';
import { DatabaseIcon, CheckIcon, LoadingSpinnerIcon, WarningIcon } from '../../Icons';

interface Attribute {
    key: string;
    type: string;
    required: boolean;
    array?: boolean;
    elements?: string[]; // for enums
}

interface BulkEditDocumentModalProps {
    attributes: Attribute[];
    count: number;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
}

export const BulkEditDocumentModal: React.FC<BulkEditDocumentModalProps> = ({ attributes, count, onSave, onCancel }) => {
    // Track which fields are enabled for editing
    const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
    // Track the values
    const [formData, setFormData] = useState<any>({});
    
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleField = (key: string) => {
        const newSet = new Set(enabledFields);
        if (newSet.has(key)) {
            newSet.delete(key);
            const newData = { ...formData };
            delete newData[key];
            setFormData(newData);
        } else {
            newSet.add(key);
            // Set default empty value based on type if needed, or just undefined
            setFormData({ ...formData, [key]: '' });
        }
        setEnabledFields(newSet);
    };

    const handleInputChange = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (enabledFields.size === 0) {
            setError("Please select at least one attribute to update.");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // Process data: Convert types and handle arrays
            const processedData: any = {};
            
            // Only process enabled fields
            Array.from(enabledFields).forEach((k) => {
                const key = k as string;
                const attr = attributes.find(a => a.key === key);
                if (!attr) return;

                let val = formData[key];

                if (attr.array && typeof val === 'string') {
                    processedData[key] = val.split(',').map((s: string) => s.trim()).filter(Boolean);
                } else if (attr.type === 'integer' || attr.type === 'float') {
                    // If empty string and field is enabled, send null (to clear) or 0 depending on requirement
                    // Here we assume if they enabled it and left it blank, they might want to clear it (if nullable) or set to 0.
                    // Appwrite updates are patches. Sending null clears nullable fields.
                    processedData[key] = val === '' ? null : Number(val);
                } else if (attr.type === 'boolean') {
                    processedData[key] = !!val;
                } else {
                    processedData[key] = val === '' ? null : val;
                }
            });

            await onSave(processedData);
        } catch (e: any) {
            setError(e.message || "Failed to update documents.");
            setIsSaving(false);
        }
    };

    const renderInput = (attr: Attribute) => {
        const isEnabled = enabledFields.has(attr.key);
        const commonClasses = `w-full bg-gray-900 border rounded-lg p-2.5 text-sm text-gray-100 outline-none transition-all ${isEnabled ? 'border-cyan-500/50 focus:ring-1 focus:ring-cyan-500' : 'border-gray-800 opacity-50 cursor-not-allowed'}`;
        
        if (attr.type === 'boolean') {
            return (
                <div className="flex items-center gap-3 py-2">
                    <input 
                        type="checkbox" 
                        checked={!!formData[attr.key]} 
                        onChange={e => handleInputChange(attr.key, e.target.checked)}
                        disabled={!isEnabled}
                        className="w-5 h-5 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className={`text-xs ${isEnabled ? 'text-gray-300' : 'text-gray-600'}`}>Set to {formData[attr.key] ? 'True' : 'False'}</span>
                </div>
            );
        }

        if (attr.type === 'enum' && attr.elements) {
            return (
                <select 
                    value={formData[attr.key] || ''} 
                    onChange={e => handleInputChange(attr.key, e.target.value)}
                    className={commonClasses}
                    disabled={!isEnabled}
                >
                    <option value="">Select Option</option>
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
                value={formData[attr.key] || ''}
                onChange={e => handleInputChange(attr.key, e.target.value)}
                placeholder={attr.array ? "Value 1, Value 2... (Comma separated)" : `Enter new ${attr.type}...`}
                className={commonClasses}
                disabled={!isEnabled}
                step={attr.type === 'float' ? "any" : "1"}
            />
        );
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
            <div className="bg-yellow-900/10 border border-yellow-700/30 p-4 rounded-xl flex items-start gap-3">
                <WarningIcon className="text-yellow-500 flex-shrink-0" />
                <div className="text-sm text-yellow-200/80">
                    <p className="font-bold text-yellow-400">Bulk Editing {count} Documents</p>
                    <p className="text-xs mt-1">Select the attributes you want to update. Only enabled fields will be changed. Existing data in these fields will be overwritten for all selected documents.</p>
                </div>
            </div>

            {/* Dynamic Attributes */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                <div className="flex items-center gap-2 px-1">
                    <DatabaseIcon size={14} className="text-cyan-400" />
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Attributes to Update</h4>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {attributes.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm italic border border-dashed border-gray-800 rounded-xl">
                            No attributes available to edit.
                        </div>
                    ) : (
                        attributes.map(attr => {
                            const isEnabled = enabledFields.has(attr.key);
                            return (
                                <div key={attr.key} className={`flex items-start gap-4 p-3 rounded-xl border transition-all ${isEnabled ? 'bg-gray-800/30 border-cyan-900/50' : 'bg-transparent border-gray-800/50 hover:bg-gray-900/30'}`}>
                                    <div className="pt-2">
                                        <input 
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={() => toggleField(attr.key)}
                                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex justify-between items-center px-1">
                                            <label 
                                                className={`text-xs font-bold cursor-pointer select-none ${isEnabled ? 'text-cyan-300' : 'text-gray-500'}`}
                                                onClick={() => toggleField(attr.key)}
                                            >
                                                {attr.key}
                                            </label>
                                            <span className="text-[9px] font-mono text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-gray-800">
                                                {attr.type}{attr.array ? '[]' : ''}
                                            </span>
                                        </div>
                                        {renderInput(attr)}
                                    </div>
                                </div>
                            );
                        })
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
                    disabled={isSaving || enabledFields.size === 0}
                    className="px-8 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-cyan-900/20 flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? <LoadingSpinnerIcon size={16} /> : <CheckIcon size={16} />}
                    Update {count} Documents
                </button>
            </div>
        </form>
    );
};
