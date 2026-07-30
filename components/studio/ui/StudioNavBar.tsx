
import React from 'react';
import { STUDIO_GROUPS, type StudioGroupId } from '../../../services/studioNav';
import { STUDIO_GROUP_ICONS } from '../navigation';
import { RefreshIcon, LoadingSpinnerIcon } from '../../Icons';

interface StudioNavBarProps {
    activeGroup: StudioGroupId;
    onGroupChange: (group: StudioGroupId) => void;
    onRefresh: () => void;
    isLoading: boolean;
}

const Divider = () => <div className="h-6 w-px bg-gray-800 mx-1.5 opacity-50" aria-hidden="true" />;

export const StudioNavBar: React.FC<StudioNavBarProps> = ({ activeGroup, onGroupChange, onRefresh, isLoading }) => {
    const primaryGroups = STUDIO_GROUPS.filter(g => g.placement !== 'trailing');
    const trailingGroups = STUDIO_GROUPS.filter(g => g.placement === 'trailing');

    const chipClass = (isActive: boolean) => `
        flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap
        ${isActive
            ? 'bg-gray-800 text-cyan-400 shadow-inner border border-white/5'
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
    `;

    return (
        <div className="flex justify-center w-full px-4">
            <div className="flex items-center gap-1 p-1 bg-gray-900/60 rounded-2xl border border-white/5 overflow-x-auto max-w-full custom-scrollbar backdrop-blur-md shadow-2xl">
                {primaryGroups.map(group => (
                    <button
                        key={group.id}
                        onClick={() => onGroupChange(group.id)}
                        aria-current={activeGroup === group.id ? 'page' : undefined}
                        className={chipClass(activeGroup === group.id)}
                    >
                        {STUDIO_GROUP_ICONS[group.id]}
                        <span>{group.label}</span>
                    </button>
                ))}

                <Divider />

                {trailingGroups.map(group => (
                    <button
                        key={group.id}
                        onClick={() => onGroupChange(group.id)}
                        title={group.label}
                        aria-label={group.label}
                        aria-current={activeGroup === group.id ? 'page' : undefined}
                        className={chipClass(activeGroup === group.id)}
                    >
                        {STUDIO_GROUP_ICONS[group.id]}
                    </button>
                ))}

                {/* Integrated Refresh Action */}
                <Divider />

                <button
                    onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                    disabled={isLoading}
                    title="Sync Current View with Backend (Shift+R)"
                    className={`
                        flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300
                        ${isLoading
                            ? 'bg-cyan-500/10 text-cyan-500 cursor-wait'
                            : 'text-gray-500 hover:bg-cyan-500/10 hover:text-cyan-400 active:scale-95'}
                    `}
                >
                    {isLoading ? (
                        <LoadingSpinnerIcon size={14} className="animate-spin" />
                    ) : (
                        <RefreshIcon size={14} />
                    )}
                    <span className="hidden lg:inline">Sync</span>
                </button>
            </div>
        </div>
    );
};
