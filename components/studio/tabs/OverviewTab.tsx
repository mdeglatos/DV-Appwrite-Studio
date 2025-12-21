
import React from 'react';
import type { Database, Bucket, AppwriteFunction, StudioTab, AppwriteProject } from '../../../types';
import type { Models } from 'node-appwrite';
import { StatCard } from '../ui/StatCard';
import { DatabaseIcon, StorageIcon, FunctionIcon, UserIcon, TeamIcon, ExternalLinkIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';

interface OverviewTabProps {
    activeProject: AppwriteProject;
    databases: Database[];
    buckets: Bucket[];
    functions: AppwriteFunction[];
    users: Models.User<any>[];
    teams: Models.Team<any>[];
    onTabChange: (tab: StudioTab) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ activeProject, databases, buckets, functions, users, teams, onTabChange }) => {
    return (
        <>
            <header className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-gray-100">Project Overview</h1>
                <a 
                    href={consoleLinks.overview(activeProject)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                >
                    <ExternalLinkIcon size={14} /> Open Native Console
                </a>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard 
                    title="Databases" 
                    value={databases.length} 
                    icon={<DatabaseIcon />} 
                    color="text-red-400"
                    onClick={() => onTabChange('database')}
                    description="Manage your data structure"
                />
                <StatCard 
                    title="Buckets" 
                    value={buckets.length} 
                    icon={<StorageIcon />} 
                    color="text-green-400"
                    onClick={() => onTabChange('storage')}
                    description="File storage & permissions"
                />
                <StatCard 
                    title="Functions" 
                    value={functions.length} 
                    icon={<FunctionIcon />} 
                    color="text-blue-400"
                    onClick={() => onTabChange('functions')}
                    description="Serverless logic & runtimes"
                />
                <StatCard 
                    title="Users" 
                    value={users.length} 
                    icon={<UserIcon />} 
                    color="text-purple-400"
                    onClick={() => onTabChange('users')}
                    description="Auth & User management"
                />
                <StatCard 
                    title="Teams" 
                    value={teams.length} 
                    icon={<TeamIcon />} 
                    color="text-yellow-400"
                    onClick={() => onTabChange('teams')}
                    description="Organization & Roles"
                />
            </div>
        </>
    );
};
