
import React from 'react';
import type { StudioTab } from '../../../types';
import { DashboardIcon, DatabaseIcon, StorageIcon, FunctionIcon, UserIcon, TeamIcon, MigrationIcon, McpIcon, BackupIcon } from '../../Icons';

interface StudioNavBarProps {
    activeTab: StudioTab;
    onTabChange: (t: StudioTab) => void;
}

export const StudioNavBar: React.FC<StudioNavBarProps> = ({ activeTab, onTabChange }) => {
    const tabs: { id: StudioTab, label: string, icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Overview', icon: <DashboardIcon size={16} /> },
        { id: 'database', label: 'Databases', icon: <DatabaseIcon size={16} /> },
        { id: 'storage', label: 'Storage', icon: <StorageIcon size={16} /> },
        { id: 'functions', label: 'Functions', icon: <FunctionIcon size={16} /> },
        { id: 'users', label: 'Users', icon: <UserIcon size={16} /> },
        { id: 'teams', label: 'Teams', icon: <TeamIcon size={16} /> },
        { id: 'migrations', label: 'Migrations', icon: <MigrationIcon size={16} /> },
        { id: 'mcp', label: 'MCP', icon: <McpIcon size={16} /> },
        { id: 'backups', label: 'Backups', icon: <BackupIcon size={16} /> },
    ];

    return (
        <div className="flex justify-center w-full px-4">
            <div className="flex items-center gap-1 p-1 bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-x-auto max-w-full custom-scrollbar backdrop-blur-md shadow-sm">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap
                            ${activeTab === tab.id 
                                ? 'bg-gray-800 text-cyan-400 shadow-sm border border-gray-700/50' 
                                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}
                        `}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
