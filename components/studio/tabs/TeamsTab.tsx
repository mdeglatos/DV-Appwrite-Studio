
import React, { useState, useMemo } from 'react';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { PaginationFooter } from '../ui/PaginationFooter';
import { ResourceSearchBar } from '../ui/ResourceSearchBar';
import { CleanupModal } from '../ui/CleanupModal';
import { Breadcrumb } from '../ui/Breadcrumb';
import { ExternalLinkIcon, DeleteIcon, EditIcon, TeamIcon, CleanupIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import type { AppwriteProject } from '../../../types';
import { getTeamCleanupConfig } from '../hooks/cleanupConfigs';
import type { PaginatedState } from '../hooks/usePaginatedQuery';

interface TeamsTabProps {
    activeProject: AppwriteProject;
    teams: Models.Team<any>[];
    selectedTeam: Models.Team<any> | null;
    memberships: Models.Membership[];
    onCreateTeam: () => void;
    onDeleteTeam: (t: Models.Team<any>) => void;
    onSelectTeam: (t: Models.Team<any> | null) => void;
    onCreateMembership: () => void;
    onDeleteMembership: (m: Models.Membership) => void;
    onRenameTeam?: (t: Models.Team<any>) => void;
    onBulkDeleteTeams?: (teamIds: string[]) => void;
    pagination: PaginatedState<Models.Team<any>>;
    membershipsPagination: PaginatedState<Models.Membership>;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({ 
    activeProject, teams, selectedTeam, memberships, 
    onCreateTeam, onDeleteTeam, onSelectTeam, 
    onCreateMembership, onDeleteMembership,
    onRenameTeam, onBulkDeleteTeams,
    pagination, membershipsPagination
}) => {
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [isCleanupOpen, setIsCleanupOpen] = useState(false);
    const cleanupConfig = useMemo(() => getTeamCleanupConfig(activeProject), [activeProject]);

    if (!selectedTeam) {
        return (
            <div className="space-y-3">
                <ResourceSearchBar
                    value={pagination.searchQuery}
                    onChange={pagination.setSearch}
                    placeholder="Search teams by name..."
                    total={pagination.searchQuery ? pagination.total : undefined}
                    isLoading={pagination.isLoading}
                />
                <ResourceTable<Models.Team<any>> 
                    title="Teams" 
                    data={teams} 
                    onCreate={onCreateTeam} 
                    onDelete={onDeleteTeam} 
                    onSelect={(item) => onSelectTeam(item)} 
                    createLabel="New Team" 
                    headers={['Actions', 'ID', 'Team', 'Details']}
                    selection={{
                        selectedIds: selectedTeamIds,
                        onSelectionChange: setSelectedTeamIds
                    }}
                    extraActions={
                        <div className="flex items-center gap-2 mr-2">
                            {selectedTeamIds.length > 0 && onBulkDeleteTeams && (
                                <button
                                    onClick={() => {
                                        onBulkDeleteTeams(selectedTeamIds);
                                        setSelectedTeamIds([]);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                    <DeleteIcon size={14} /> Delete ({selectedTeamIds.length})
                                </button>
                            )}
                            <a 
                                href={consoleLinks.teams(activeProject)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                            >
                                <ExternalLinkIcon size={14} /> Open in Console
                            </a>
                            <button
                                onClick={() => setIsCleanupOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 text-red-300 text-xs font-bold rounded-lg transition-colors"
                            >
                                <CleanupIcon size={14} /> Cleanup Center
                            </button>
                        </div>
                    }
                    renderExtraActions={(t) => (
                        onRenameTeam ? (
                            <button onClick={() => onRenameTeam(t)} className="text-gray-500 hover:text-cyan-400 p-1 rounded hover:bg-gray-800 transition-colors" title="Rename Team">
                                <EditIcon size={14} />
                            </button>
                        ) : null
                    )}
                    renderName={(t) => (
                        <div className="flex items-center gap-2">
                            <TeamIcon size={16} className="text-gray-500" />
                            <span className="font-medium text-gray-200">{t.name}</span>
                        </div>
                    )}
                    renderExtra={(t) => (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-400">
                                <span className="font-bold text-gray-200">{t.total}</span> {t.total === 1 ? 'member' : 'members'}
                            </span>
                            <span className="text-[10px] text-gray-600">
                                Created: {new Date(t.$createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    )}
                    footer={
                        <PaginationFooter
                            page={pagination.page}
                            pageSize={pagination.pageSize}
                            total={pagination.total}
                            totalPages={pagination.totalPages}
                            hasNextPage={pagination.hasNextPage}
                            hasPrevPage={pagination.hasPrevPage}
                            pageInfo={pagination.pageInfo}
                            onNextPage={pagination.nextPage}
                            onPrevPage={pagination.prevPage}
                            onPageSizeChange={pagination.setPageSize}
                            isLoading={pagination.isLoading}
                        />
                    }
                />
                <CleanupModal
                    isOpen={isCleanupOpen}
                    onClose={() => setIsCleanupOpen(false)}
                    config={cleanupConfig}
                    onComplete={() => pagination.refresh()}
                />
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-between items-start">
                <Breadcrumb items={[{ label: 'Teams', onClick: () => onSelectTeam(null) }, { label: selectedTeam.name }]} />
                <div className="flex gap-2">
                    {onRenameTeam && (
                        <button 
                            onClick={() => onRenameTeam(selectedTeam)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                        >
                            <EditIcon size={14} /> Rename
                        </button>
                    )}
                    <a 
                        href={consoleLinks.teams(activeProject)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                    >
                        <ExternalLinkIcon size={14} /> View in Console
                    </a>
                </div>
            </div>

            {/* Team Info Card */}
            <div className="flex items-center gap-4 mb-4 bg-gray-900/30 p-4 rounded-xl border border-gray-800/50">
                <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <TeamIcon size={24} className="text-cyan-400" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-100">{selectedTeam.name}</h2>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono">{selectedTeam.$id}</span>
                        <span>•</span>
                        <span><span className="font-bold text-gray-300">{selectedTeam.total}</span> members</span>
                    </div>
                </div>
            </div>

            <ResourceSearchBar
                value={membershipsPagination.searchQuery}
                onChange={membershipsPagination.setSearch}
                placeholder="Search members by name..."
                total={membershipsPagination.searchQuery ? membershipsPagination.total : undefined}
                isLoading={membershipsPagination.isLoading}
                className="mb-3"
            />

            <ResourceTable<Models.Membership> 
                title="Members" 
                data={memberships} 
                onCreate={onCreateMembership} 
                onDelete={onDeleteMembership} 
                createLabel="Invite Member"
                headers={['Actions', 'ID', 'Member', 'Roles & Status']}
                renderName={(m) => (
                    <div>
                        <div className="text-gray-200 font-medium">{m.userName || <span className="italic text-gray-500">No Name</span>}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{m.userEmail}</div>
                    </div>
                )}
                renderExtra={(m) => (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1 flex-wrap">
                            {m.roles.map(r => (
                                <span key={r} className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-300 border border-gray-600">
                                    {r}
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                                m.confirm 
                                    ? 'bg-green-900/20 text-green-400 border-green-900/50' 
                                    : 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50'
                            }`}>
                                {m.confirm ? 'Confirmed' : 'Pending'}
                            </span>
                            <span className="text-[10px] text-gray-600">
                                Joined: {new Date(m.$createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                )}
                footer={
                    <PaginationFooter
                        page={membershipsPagination.page}
                        pageSize={membershipsPagination.pageSize}
                        total={membershipsPagination.total}
                        totalPages={membershipsPagination.totalPages}
                        hasNextPage={membershipsPagination.hasNextPage}
                        hasPrevPage={membershipsPagination.hasPrevPage}
                        pageInfo={membershipsPagination.pageInfo}
                        onNextPage={membershipsPagination.nextPage}
                        onPrevPage={membershipsPagination.prevPage}
                        onPageSizeChange={membershipsPagination.setPageSize}
                        isLoading={membershipsPagination.isLoading}
                    />
                }
            />
        </>
    );
};
