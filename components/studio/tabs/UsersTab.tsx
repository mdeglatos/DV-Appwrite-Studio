
import React, { useState, useMemo } from 'react';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { PaginationFooter } from '../ui/PaginationFooter';
import { ResourceSearchBar } from '../ui/ResourceSearchBar';
import { CleanupModal } from '../ui/CleanupModal';
import { ExternalLinkIcon, DeleteIcon, EditIcon, VerifiedIcon, EmailVerifiedIcon, LockIcon, UnlockIcon, KeyIcon, CleanupIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import type { AppwriteProject } from '../../../types';
import type { PaginatedState } from '../hooks/usePaginatedQuery';
import { getUserCleanupConfig } from '../hooks/cleanupConfigs';

interface UsersTabProps {
    activeProject: AppwriteProject;
    users: Models.User<any>[];
    onCreateUser: () => void;
    onDeleteUser: (u: Models.User<any>) => void;
    onUpdateStatus?: (u: Models.User<any>) => void;
    onUpdateLabels?: (u: Models.User<any>) => void;
    onUpdateName?: (u: Models.User<any>) => void;
    onUpdateEmail?: (u: Models.User<any>) => void;
    onVerifyEmail?: (u: Models.User<any>) => void;
    onBulkDeleteUsers?: (userIds: string[]) => void;
    pagination: PaginatedState<Models.User<any>>;
}

export const UsersTab: React.FC<UsersTabProps> = ({ 
    activeProject, users, onCreateUser, onDeleteUser,
    onUpdateStatus, onUpdateLabels, onUpdateName, onUpdateEmail, onVerifyEmail,
    onBulkDeleteUsers, pagination
}) => {
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isCleanupOpen, setIsCleanupOpen] = useState(false);
    const cleanupConfig = useMemo(() => getUserCleanupConfig(activeProject), [activeProject]);

    return (
        <div className="space-y-3">
            {/* Search Bar */}
            <ResourceSearchBar
                value={pagination.searchQuery}
                onChange={pagination.setSearch}
                placeholder="Search users by name or email..."
                total={pagination.searchQuery ? pagination.total : undefined}
                isLoading={pagination.isLoading}
            />

            <ResourceTable<Models.User<any>> 
                title="Users" 
                data={users} 
                onCreate={onCreateUser} 
                onDelete={onDeleteUser} 
                createLabel="New User"
                headers={['Actions', 'ID', 'User', 'Status & Details']}
                selection={{
                    selectedIds: selectedUserIds,
                    onSelectionChange: setSelectedUserIds
                }}
                extraActions={
                    <div className="flex items-center gap-2 mr-2">
                        {selectedUserIds.length > 0 && onBulkDeleteUsers && (
                            <button
                                onClick={() => {
                                    onBulkDeleteUsers(selectedUserIds);
                                    setSelectedUserIds([]);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-bold rounded-lg transition-colors"
                            >
                                <DeleteIcon size={14} /> Delete ({selectedUserIds.length})
                            </button>
                        )}
                        <a 
                            href={consoleLinks.users(activeProject)} 
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
                renderExtraActions={(u) => (
                    <div className="flex items-center gap-1">
                        {onUpdateName && (
                            <button onClick={() => onUpdateName(u)} className="text-gray-500 hover:text-cyan-400 p-1 rounded hover:bg-gray-800 transition-colors" title="Edit Name">
                                <EditIcon size={14} />
                            </button>
                        )}
                        {onUpdateStatus && (
                            <button onClick={() => onUpdateStatus(u)} className={`p-1 rounded hover:bg-gray-800 transition-colors ${u.status ? 'text-green-500 hover:text-red-400' : 'text-red-500 hover:text-green-400'}`} title={u.status ? "Block User" : "Activate User"}>
                                {u.status ? <UnlockIcon size={14} /> : <LockIcon size={14} />}
                            </button>
                        )}
                        {onUpdateLabels && (
                            <button onClick={() => onUpdateLabels(u)} className="text-gray-500 hover:text-purple-400 p-1 rounded hover:bg-gray-800 transition-colors" title="Edit Labels">
                                <KeyIcon size={14} />
                            </button>
                        )}
                    </div>
                )}
                renderName={(u) => (
                    <div>
                        <div className="font-medium text-gray-200">{u.name || <span className="italic text-gray-500">No Name</span>}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{u.email}</div>
                        {u.phone && <div className="text-xs text-gray-600 mt-0.5">{u.phone}</div>}
                    </div>
                )}
                renderExtra={(u) => (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                                u.status 
                                    ? 'bg-green-900/20 text-green-400 border-green-900/50' 
                                    : 'bg-red-900/20 text-red-400 border-red-900/50'
                            }`}>
                                {u.status ? 'Active' : 'Blocked'}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onVerifyEmail?.(u); }}
                                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer ${
                                    u.emailVerification 
                                        ? 'bg-cyan-900/20 text-cyan-400 border-cyan-900/50 hover:bg-cyan-900/40' 
                                        : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-cyan-400 hover:border-cyan-800'
                                }`}
                                title={u.emailVerification ? "Email verified — click to unverify" : "Email not verified — click to verify"}
                            >
                                <EmailVerifiedIcon size={10} />
                                {u.emailVerification ? 'Verified' : 'Unverified'}
                            </button>
                        </div>
                        {u.labels && u.labels.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {u.labels.map((label: string) => (
                                    <span key={label} className="text-[10px] bg-purple-900/30 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/50">
                                        {label}
                                    </span>
                                ))}
                            </div>
                        )}
                        <span className="text-[10px] text-gray-600">
                            Registered: {new Date(u.registration).toLocaleDateString()}
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
};
