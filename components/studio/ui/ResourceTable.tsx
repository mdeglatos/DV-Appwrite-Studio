
import React from 'react';
import { AddIcon, EditIcon, DeleteIcon } from '../../Icons';
import { CopyButton } from './CopyButton';

interface ResourceTableProps<T> {
    title?: string;
    data: T[];
    onDelete?: (item: T) => void;
    onEdit?: (item: T) => void;
    onCreate?: () => void;
    onSelect?: (item: T) => void;
    createLabel?: string;
    renderName?: (item: T) => React.ReactNode;
    renderExtra?: (item: T) => React.ReactNode;
    headers?: string[];
    extraActions?: React.ReactNode;
    
    // Selection props
    selection?: {
        selectedIds: string[];
        onSelectionChange: (ids: string[]) => void;
    };
    // Row highlighting
    isRowActive?: (item: T) => boolean;
    // Layout
    autoHeight?: boolean;
}

export const ResourceTable = <T extends { $id: string }>({ 
    title, 
    data, 
    onDelete, 
    onEdit,
    onCreate, 
    onSelect,
    createLabel = "Create",
    renderName,
    renderExtra,
    headers = ['ID', 'Name / Key', 'Details', 'Actions'],
    extraActions,
    selection,
    isRowActive,
    autoHeight = false,
}: ResourceTableProps<T>) => {

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selection) return;
        if (e.target.checked) {
            selection.onSelectionChange(data.map(d => d.$id));
        } else {
            selection.onSelectionChange([]);
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        if (!selection) return;
        if (checked) {
            selection.onSelectionChange([...selection.selectedIds, id]);
        } else {
            selection.onSelectionChange(selection.selectedIds.filter(sid => sid !== id));
        }
    };

    const hasActions = onDelete || onEdit || renderExtra;

    return (
        <div className={`bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden animate-fade-in flex flex-col shadow-sm ${autoHeight ? '' : 'h-full'}`}>
            {(title || onCreate || extraActions) && (
                <div className="p-4 border-b border-gray-700/50 flex flex-wrap justify-between items-center bg-gray-900/30 gap-3">
                    {title && <h3 className="text-lg font-semibold text-gray-200">{title}</h3>}
                    <div className="flex items-center gap-2 ml-auto">
                        {extraActions}
                        {onCreate && (
                            <button onClick={onCreate} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-cyan-900/20">
                                <AddIcon /> {createLabel}
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div className={`overflow-x-auto custom-scrollbar ${autoHeight ? '' : 'flex-1'}`}>
                <table className="w-full text-left text-sm text-gray-400 table-fixed min-w-[700px]">
                    <thead className="bg-gray-900/50 text-xs uppercase font-semibold text-gray-500 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            {selection && (
                                <th className="px-6 py-3 w-16">
                                    <input 
                                        type="checkbox" 
                                        className="rounded bg-gray-800 border-gray-600 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                        checked={data.length > 0 && selection.selectedIds.length === data.length}
                                        onChange={handleSelectAll}
                                        disabled={data.length === 0}
                                    />
                                </th>
                            )}
                            {hasActions && <th className="px-6 py-3 w-36">{headers[3] || 'Actions'}</th>}
                            <th className="px-6 py-3 w-48">{headers[0]}</th>
                            <th className="px-6 py-3 min-w-[250px]">{headers[1]}</th>
                            {renderExtra && !onDelete && !onEdit && <th className="px-6 py-3 w-48">{headers[2]}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {data.length === 0 ? (
                            <tr><td colSpan={selection ? 6 : 5} className="px-6 py-12 text-center text-gray-500 italic">No items found.</td></tr>
                        ) : (
                            data.map((item) => {
                                const isActive = isRowActive ? isRowActive(item) : false;
                                const displayIdentifier = renderName ? renderName(item) : ((item as any).name || (item as any).key || 'Unknown');
                                
                                return (
                                    <tr 
                                        key={item.$id} 
                                        className={`transition-colors ${isActive ? 'bg-green-900/10' : ''} ${onSelect ? 'hover:bg-gray-700/30 cursor-pointer' : 'hover:bg-gray-700/20'}`}
                                        onClick={() => onSelect && onSelect(item)}
                                    >
                                        {selection && (
                                            <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded bg-gray-800 border-gray-600 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                    checked={selection.selectedIds.includes(item.$id)}
                                                    onChange={(e) => handleSelectRow(item.$id, e.target.checked)}
                                                />
                                            </td>
                                        )}
                                        {hasActions && (
                                            <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1">
                                                    {renderExtra && renderExtra(item)}
                                                    {onEdit && (
                                                        <button 
                                                            onClick={() => onEdit(item)}
                                                            className="text-gray-500 hover:text-cyan-400 p-1.5 rounded hover:bg-gray-800 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <EditIcon size={16} />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button 
                                                            onClick={() => onDelete(item)}
                                                            className="text-gray-500 hover:text-red-400 p-1.5 rounded hover:bg-gray-800 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <DeleteIcon size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-3 font-mono text-xs text-gray-500 truncate group" title={item.$id}>
                                            <div className="flex items-center">
                                                <span className="truncate">{item.$id}</span>
                                                <CopyButton text={item.$id} className="opacity-0 group-hover:opacity-100 ml-2 transition-opacity flex-shrink-0" />
                                                {isActive && <span className="ml-2 text-[10px] bg-green-500 text-black px-1.5 py-0.5 rounded font-bold flex-shrink-0">ACTIVE</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-200">
                                            <div className="truncate max-w-full">
                                                {displayIdentifier}
                                            </div>
                                        </td>
                                        {renderExtra && !onDelete && !onEdit && <td className="px-6 py-3">{renderExtra(item)}</td>}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
