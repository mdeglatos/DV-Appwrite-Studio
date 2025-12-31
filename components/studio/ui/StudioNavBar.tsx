
import React from 'react';
import type { StudioTab } from '../../../types';
import { DashboardIcon, DatabaseIcon, StorageIcon, FunctionIcon, UserIcon, TeamIcon, MigrationIcon, BackupIcon, RefreshIcon, LoadingSpinnerIcon } from '../../Icons';

interface StudioNavBarProps {
    activeTab: StudioTab;
    onTabChange: (t: StudioTab) => void;
    onRefresh: () => void;
    isLoading: boolean;
}

export const StudioNavBar: React.FC<StudioNavBarProps> = ({ activeTab, onTabChange, onRefresh, isLoading }) => {
    const tabs: { id: StudioTab, label: string, icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Overview', icon: <DashboardIcon size={16} /> },
        { id: 'database', label: 'Databases', icon: <DatabaseIcon size={16} /> },
        { id: 'storage', label: 'Storage', icon: <StorageIcon size={16} /> },
        { id: 'functions', label: 'Functions', icon: <FunctionIcon size={16} /> },
        { id: 'users', label: 'Users', icon: <UserIcon size={16} /> },
        { id: 'teams', label: 'Teams', icon: <TeamIcon size={16} /> },
        { id: 'migrations', label: 'Migrations', icon: <MigrationIcon size={16} /> },
        { id: 'backups', label: 'Backups', icon: <BackupIcon size={16} /> },
    ];

    return (
        <div className="flex justify-center w-full px-4">
            <div className="flex items-center gap-1 p-1 bg-gray-900/60 rounded-2xl border border-white/5 overflow-x-auto max-w-full custom-scrollbar backdrop-blur-md shadow-2xl">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap
                            ${activeTab === tab.id 
                                ? 'bg-gray-800 text-cyan-400 shadow-inner border border-white/5' 
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
                        `}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}

                {/* Integrated Refresh Action */}
                <div className="h-6 w-px bg-gray-800 mx-1.5 opacity-50" aria-hidden="true" />
                
                <button
                    onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                    disabled={isLoading}
                    title="Sync Current View with Backend"
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
