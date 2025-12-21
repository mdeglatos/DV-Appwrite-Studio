
import React, { useState } from 'react';
import { ChevronDownIcon, SettingsIcon, CheckIcon } from '../../Icons';
import { toolDefinitionGroups } from '../../../tools';

interface ToolConfigurationProps {
    activeTools: { [key: string]: boolean };
    onToolsChange: (tools: { [key: string]: boolean }) => void;
    showSearch?: boolean;
    className?: string;
    compact?: boolean;
}

const ToolToggle: React.FC<{
    label: string;
    isChecked: boolean;
    onChange: (isChecked: boolean) => void;
    compact?: boolean;
}> = ({ label, isChecked, onChange, compact }) => {
    const id = `toggle-${label}-${Math.random().toString(36).substr(2, 5)}`;
    return (
        <label htmlFor={id} className={`flex items-center justify-between cursor-pointer rounded-md hover:bg-white/5 transition-colors group ${compact ? 'px-2 py-1' : 'px-3 py-2'}`}>
            <span className={`text-gray-400 capitalize group-hover:text-gray-200 transition-colors ${compact ? 'text-[11px] font-mono' : 'text-xs'}`}>
                {label}
            </span>
            <div className={`relative ${compact ? 'scale-75' : ''}`}>
                <input id={id} type="checkbox" className="sr-only peer" checked={isChecked} onChange={(e) => onChange(e.target.checked)} />
                <div className="w-8 h-4 bg-gray-700/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600/50 peer-checked:after:bg-white"></div>
            </div>
        </label>
    );
};

export const ToolConfiguration: React.FC<ToolConfigurationProps> = ({ 
    activeTools, 
    onToolsChange, 
    showSearch = true,
    className = "",
    compact = false
}) => {
    const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
        database: true
    });

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
    };

    const handleEnableAll = () => {
        const newTools: { [key: string]: boolean } = showSearch ? { search: true } : {};
        Object.values(toolDefinitionGroups).flat().forEach(tool => {
            newTools[tool.name] = true;
        });
        onToolsChange(newTools);
    };

    const handleDisableAll = () => {
        const newTools: { [key: string]: boolean } = showSearch ? { search: false } : {};
        Object.values(toolDefinitionGroups).flat().forEach(tool => {
            newTools[tool.name] = false;
        });
        onToolsChange(newTools);
    };

    const handleCategoryToggle = (category: string, enabled: boolean) => {
        const tools = toolDefinitionGroups[category];
        const newTools = { ...activeTools };
        tools.forEach(t => newTools[t.name] = enabled);
        onToolsChange(newTools);
    };

    const getIndicatorInfo = (checked: number, total: number) => {
        if (checked === 0) return { className: 'bg-gray-700', title: 'None' };
        if (checked === total && total > 0) return { className: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]', title: 'All' };
        return { className: 'bg-yellow-500', title: 'Partial' };
    };

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex gap-2">
                <button 
                    type="button"
                    onClick={handleEnableAll}
                    className="flex-1 py-1.5 rounded bg-gray-800 border border-gray-700 hover:bg-cyan-900/30 hover:border-cyan-500/30 hover:text-cyan-200 text-[11px] text-gray-400 transition-all font-bold uppercase tracking-wider"
                >
                    Enable All
                </button>
                <button 
                    type="button"
                    onClick={handleDisableAll}
                    className="flex-1 py-1.5 rounded bg-gray-800 border border-gray-700 hover:bg-red-900/20 hover:border-red-500/30 hover:text-red-200 text-[11px] text-gray-400 transition-all font-bold uppercase tracking-wider"
                >
                    Disable All
                </button>
            </div>

            <div className="space-y-2">
                {showSearch && (
                    <div className="bg-gray-900/30 rounded-lg border border-gray-800/50 overflow-hidden">
                        <ToolToggle
                            label="Web Search"
                            isChecked={activeTools['search'] ?? false}
                            onChange={(isChecked) => onToolsChange({ ...activeTools, search: isChecked })}
                            compact={compact}
                        />
                    </div>
                )}

                {Object.entries(toolDefinitionGroups).map(([category, tools]) => {
                    const categoryToolNames = tools.map(t => t.name);
                    const checkedCount = categoryToolNames.filter(tool => activeTools[tool]).length;
                    const totalCount = categoryToolNames.length;
                    const isExpanded = expandedCategories[category] ?? false;
                    const indicator = getIndicatorInfo(checkedCount, totalCount);

                    return (
                        <div key={category} className="bg-gray-900/30 rounded-lg border border-gray-800/50 overflow-hidden">
                            <div className="group px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => toggleCategory(category)}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${indicator.className}`} />
                                        <span className="text-xs font-bold capitalize text-gray-400 group-hover:text-gray-300">{category}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="hidden group-hover:flex items-center gap-1 mr-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleCategoryToggle(category, true); }}
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-cyan-900/50 text-gray-500 hover:text-cyan-400 border border-gray-700 transition-colors"
                                            >
                                                On
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleCategoryToggle(category, false); }}
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-400 border border-gray-700 transition-colors"
                                            >
                                                Off
                                            </button>
                                        </div>
                                        <span className="text-[10px] text-gray-600 font-mono">{checkedCount}/{totalCount}</span>
                                        <div className={`text-gray-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDownIcon size={12} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="border-t border-gray-800/50 bg-black/20 p-1">
                                    {tools.map(tool => (
                                        <ToolToggle
                                            key={tool.name}
                                            label={tool.name}
                                            isChecked={activeTools[tool.name] ?? false}
                                            onChange={(isChecked) => onToolsChange({ ...activeTools, [tool.name]: isChecked })}
                                            compact={compact}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
