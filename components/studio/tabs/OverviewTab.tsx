
import React, { useState, useEffect } from 'react';
import type { Database, Bucket, AppwriteFunction, AppwriteSite, StudioTab, AppwriteProject } from '../../../types';
import type { Models } from 'node-appwrite';
import { StatCard } from '../ui/StatCard';
import { DatabaseIcon, StorageIcon, FunctionIcon, UserIcon, TeamIcon, ExternalLinkIcon, AddIcon, InfoIcon, SitesIcon, LoadingSpinnerIcon, DashboardIcon } from '../../Icons';
import { CopyButton } from '../ui/CopyButton';
import { consoleLinks } from '../../../services/appwrite';
import { TabShell } from '../ui/TabShell';
import { getProjectUsage, type ProjectUsage } from '../../../services/projectAdminService';

const UsageStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
        <div className="text-sm font-bold text-gray-200">{value}</div>
    </div>
);

interface OverviewTabProps {
    activeProject: AppwriteProject;
    databases: Database[];
    buckets: Bucket[];
    functions: AppwriteFunction[];
    sites: AppwriteSite[];
    users: Models.User<any>[];
    teams: Models.Team<any>[];
    onTabChange: (tab: StudioTab) => void;
    onCreateDatabase?: () => void;
    onCreateBucket?: () => void;
    onCreateUser?: () => void;
    sitesTotal?: number;
    usersTotal?: number;
    teamsTotal?: number;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ 
    activeProject, databases, buckets, functions, sites, users, teams, onTabChange,
    onCreateDatabase, onCreateBucket, onCreateUser,
    sitesTotal, usersTotal, teamsTotal
}) => {
    const [usage, setUsage] = useState<ProjectUsage | null>(null);
    const [usageLoading, setUsageLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            setUsageLoading(true);
            try {
                
                const data = await getProjectUsage(activeProject);
                setUsage(data);
            } catch (e) {
                console.error(e);
                setUsage(null);
            } finally {
                setUsageLoading(false);
            }
        };
        fetchUsage();
    }, [activeProject]);

    const activeFunctions = functions.filter(f => f.enabled);
    const verifiedUsers = users.filter(u => u.emailVerification);
    const activeUsers = users.filter(u => u.status);

    const finalSitesCount = sitesTotal !== undefined ? sitesTotal : sites.length;
    const finalUsersCount = usersTotal !== undefined ? usersTotal : users.length;
    const finalTeamsCount = teamsTotal !== undefined ? teamsTotal : teams.length;

    return (
        <TabShell
            title="Project Overview"
            subtitle={`Resource totals, usage and quick actions for "${activeProject.name}".`}
            icon={<DashboardIcon size={24} className="text-cyan-400" />}
            consoleHref={consoleLinks.overview(activeProject)}
        >

            {/* Project Info Card */}
            <div className="mb-6 bg-gray-900/40 border border-gray-800/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                    <InfoIcon size={18} className="text-cyan-400" />
                    <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Project Details</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Project Name</span>
                        <span className="text-sm text-gray-200 font-medium">{activeProject.name}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Project ID</span>
                        <span className="text-sm text-gray-300 font-mono flex items-center gap-2 group">
                            {activeProject.projectId}
                            <CopyButton text={activeProject.projectId} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Endpoint</span>
                        <span className="text-sm text-gray-300 font-mono truncate" title={activeProject.endpoint}>{activeProject.endpoint}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">API Key</span>
                        <span className="text-sm text-gray-500 font-mono flex items-center gap-2 group">
                            {'•'.repeat(20)}
                            <CopyButton text={activeProject.apiKey} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                    </div>
                </div>
            </div>

            {/* Resource Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
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
                    description={`${activeFunctions.length} active`}
                />
                <StatCard 
                    title="Sites" 
                    value={finalSitesCount} 
                    icon={<SitesIcon />} 
                    color="text-cyan-400"
                    onClick={() => onTabChange('sites')}
                    description="Hosted web applications"
                />
                <StatCard 
                    title="Users" 
                    value={finalUsersCount} 
                    icon={<UserIcon />} 
                    color="text-purple-400"
                    onClick={() => onTabChange('users')}
                    description={`${activeUsers.length} active, ${verifiedUsers.length} verified`}
                />
                <StatCard 
                    title="Teams" 
                    value={finalTeamsCount} 
                    icon={<TeamIcon />} 
                    color="text-yellow-400"
                    onClick={() => onTabChange('teams')}
                    description="Organization & Roles"
                />
            </div>

            {/* Live Usage Statistics Panel */}
            <div className="mb-6 bg-gray-900/40 border border-gray-800/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <InfoIcon size={18} className="text-cyan-400" />
                    <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Usage Statistics</h2>
                </div>
                {usageLoading ? (
                    <div className="flex justify-center items-center py-4">
                        <LoadingSpinnerIcon size={16} className="text-cyan-400 animate-spin" />
                    </div>
                ) : usage ? (
                    /* Raw reported values only — this server exposes no quota, so no gauge is drawn. */
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <UsageStat label="Monthly Bandwidth" value={`${(usage.bandwidth / (1024 * 1024)).toFixed(1)} MB`} />
                        <UsageStat label="Cloud Storage" value={`${(usage.storage / (1024 * 1024)).toFixed(1)} MB`} />
                        <UsageStat label="Users" value={String(usage.users)} />
                        <UsageStat label="Databases" value={String(usage.databases)} />
                        <UsageStat label="Functions" value={String(usage.functions)} />
                    </div>
                ) : (
                    <div className="flex items-start gap-3 py-2">
                        <InfoIcon size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-gray-400">Usage statistics unavailable for this API key</p>
                            <p className="text-[11px] text-gray-500 mt-1">
                                This project's server did not return usage metrics. Add the required scopes to the API key,
                                or check the figures in the Appwrite Console.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions Row */}
            <div className="bg-gray-900/40 border border-gray-800/50 rounded-xl p-5">
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                    {onCreateDatabase && (
                        <button 
                            onClick={onCreateDatabase}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-red-900/30 border border-gray-700 hover:border-red-800 text-gray-300 hover:text-red-300 text-xs font-bold rounded-lg transition-all"
                        >
                            <AddIcon size={16} /> <DatabaseIcon size={14} /> New Database
                        </button>
                    )}
                    {onCreateBucket && (
                        <button 
                            onClick={onCreateBucket}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-green-900/30 border border-gray-700 hover:border-green-800 text-gray-300 hover:text-green-300 text-xs font-bold rounded-lg transition-all"
                        >
                            <AddIcon size={16} /> <StorageIcon size={14} /> New Bucket
                        </button>
                    )}
                    {onCreateUser && (
                        <button 
                            onClick={onCreateUser}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-purple-900/30 border border-gray-700 hover:border-purple-800 text-gray-300 hover:text-purple-300 text-xs font-bold rounded-lg transition-all"
                        >
                            <AddIcon size={16} /> <UserIcon size={14} /> New User
                        </button>
                    )}
                    <a 
                        href={consoleLinks.settings(activeProject)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-bold rounded-lg transition-all"
                    >
                        <ExternalLinkIcon size={14} /> Project Settings
                    </a>
                    <a 
                        href={consoleLinks.apiKeys(activeProject)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-bold rounded-lg transition-all"
                    >
                        <ExternalLinkIcon size={14} /> API Keys
                    </a>
                </div>
            </div>
        </TabShell>
    );
};
