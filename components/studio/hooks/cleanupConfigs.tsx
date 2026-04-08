
import React from 'react';
import type { Models } from 'node-appwrite';
import type { AppwriteProject, Bucket, AppwriteFunction, AppwriteSite } from '../../../types';
import type { CleanupConfig } from '../ui/CleanupModal';
import { getSdkUsers, getSdkTeams, getSdkStorage, getSdkDatabases, getSdkFunctions, getSdkSites, Query } from '../../../services/appwrite';

// ============================================================================
// HELPERS
// ============================================================================

function matchesDateFilter(dateStr: string, filterMode?: string, filterDate?: string): boolean {
    if (!filterMode || !filterDate) return true;
    const itemDate = new Date(dateStr).getTime();
    const targetDate = new Date(filterDate).getTime();
    return filterMode === 'before' ? itemDate < targetDate : itemDate > targetDate;
}

function fetchAllPaginated<T>(
    listFn: (queries: string[]) => Promise<{ total: number; [key: string]: unknown }>,
    itemsKey: string
): () => Promise<T[]> {
    return async () => {
        const allItems: T[] = [];
        let offset = 0;
        const limit = 100;
        let total = Infinity;

        while (offset < total) {
            const res = await listFn([Query.limit(limit), Query.offset(offset), Query.orderDesc('$createdAt')]);
            total = res.total;
            const items = res[itemsKey] as T[] | undefined;
            if (!items || items.length === 0) break;
            allItems.push(...items);
            offset += items.length;
        }
        return allItems;
    };
}

// ============================================================================
// USER CLEANUP CONFIG
// ============================================================================

export function getUserCleanupConfig(project: AppwriteProject): CleanupConfig<Models.User<any>> {
    const sdk = getSdkUsers(project);

    return {
        resourceName: 'Users',
        resourceNameSingular: 'User',
        filters: [
            {
                id: 'status', label: 'Status', type: 'select',
                options: [{ label: 'Active', value: 'active' }, { label: 'Blocked', value: 'blocked' }]
            },
            {
                id: 'emailVerification', label: 'Email Verification', type: 'select',
                options: [{ label: 'Verified', value: 'true' }, { label: 'Unverified', value: 'false' }]
            },
            {
                id: 'hasName', label: 'Name', type: 'select',
                options: [{ label: 'Has Name', value: 'has' }, { label: 'No Name (empty)', value: 'empty' }]
            },
            {
                id: 'labelContains', label: 'Label Contains', type: 'text',
                placeholder: 'e.g. test, beta'
            },
            {
                id: 'registeredMode', label: 'Registration Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }]
            },
            {
                id: 'registeredDate', label: 'Registration Date Value', type: 'date'
            },
        ],
        presets: [
            {
                label: 'Test Users',
                description: 'Unverified users with no name',
                filters: { emailVerification: 'false', hasName: 'empty' }
            },
            {
                label: 'Blocked Users',
                description: 'All currently blocked users',
                filters: { status: 'blocked' }
            },
            {
                label: 'Unverified Users',
                description: 'All users without verified email',
                filters: { emailVerification: 'false' }
            },
            {
                label: 'Labeled Users',
                description: 'Users with any labels attached',
                filters: {} // Will show all, user can refine with labelContains
            },
        ],
        fetchAll: fetchAllPaginated(
            (queries) => sdk.list(queries),
            'users'
        ),
        filterFn: (user, filters) => {
            if (filters.status === 'active' && !user.status) return false;
            if (filters.status === 'blocked' && user.status) return false;
            if (filters.emailVerification === 'true' && !user.emailVerification) return false;
            if (filters.emailVerification === 'false' && user.emailVerification) return false;
            if (filters.hasName === 'has' && !user.name?.trim()) return false;
            if (filters.hasName === 'empty' && user.name?.trim()) return false;
            if (filters.labelContains && !user.labels?.some((l: string) => l.toLowerCase().includes(filters.labelContains.toLowerCase()))) return false;
            if (!matchesDateFilter(user.registration, filters.registeredMode, filters.registeredDate)) return false;
            return true;
        },
        getItemId: (u) => u.$id,
        renderPreviewRow: (u) => (
            <>
                <td className="px-3 py-2 font-mono text-[11px]">{u.$id.slice(0, 12)}...</td>
                <td className="px-3 py-2">{u.email || '—'}</td>
                <td className="px-3 py-2">{u.name || <span className="italic text-gray-600">no name</span>}</td>
                <td className="px-3 py-2">
                    <span className={u.status ? 'text-green-400' : 'text-red-400'}>
                        {u.status ? 'Active' : 'Blocked'}
                    </span>
                </td>
            </>
        ),
        actions: [
            {
                id: 'delete', label: 'Delete Users', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} USERS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const u of items) {
                        try { await sdk.delete(u.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
            {
                id: 'block', label: 'Block Users', variant: 'warning',
                confirmPhrase: (n) => `BLOCK ${n} USERS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const u of items) {
                        try { await sdk.updateStatus(u.$id, false); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
            {
                id: 'unblock', label: 'Unblock Users', variant: 'info',
                confirmPhrase: (n) => `UNBLOCK ${n} USERS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const u of items) {
                        try { await sdk.updateStatus(u.$id, true); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
            {
                id: 'verify', label: 'Verify Emails', variant: 'info',
                confirmPhrase: (n) => `VERIFY ${n} USERS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const u of items) {
                        try { await sdk.updateEmailVerification(u.$id, true); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
            {
                id: 'addLabel', label: 'Add Label', variant: 'info',
                confirmPhrase: (n) => `LABEL ${n} USERS`,
                options: [{ id: 'label', label: 'Label to Add', type: 'text' as const, placeholder: 'e.g. premium, beta' }],
                execute: async (items, options) => {
                    const label = options?.label;
                    if (!label) return { success: 0, failed: items.length };
                    let success = 0, failed = 0;
                    for (const u of items) {
                        try {
                            const newLabels = [...new Set([...(u.labels || []), label])];
                            await sdk.updateLabels(u.$id, newLabels);
                            success++;
                        } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// TEAM CLEANUP CONFIG
// ============================================================================

export function getTeamCleanupConfig(project: AppwriteProject): CleanupConfig<Models.Team<any>> {
    const sdk = getSdkTeams(project);

    return {
        resourceName: 'Teams',
        resourceNameSingular: 'Team',
        filters: [
            {
                id: 'memberCount', label: 'Member Count', type: 'select',
                options: [
                    { label: 'Empty (0 members)', value: '0' },
                    { label: '1 member', value: '1' },
                    { label: '≤ 5 members', value: 'lte5' },
                ]
            },
            {
                id: 'nameContains', label: 'Name Contains', type: 'text',
                placeholder: 'e.g. test, temp'
            },
            {
                id: 'createdMode', label: 'Created Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }]
            },
            {
                id: 'createdDate', label: 'Created Date Value', type: 'date'
            },
        ],
        presets: [
            {
                label: 'Empty Teams',
                description: 'Teams with 0 members',
                filters: { memberCount: '0' }
            },
            {
                label: 'Orphan Teams',
                description: 'Empty teams older than 30 days',
                filters: { memberCount: '0', createdMode: 'before', createdDate: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0] }
            },
        ],
        fetchAll: fetchAllPaginated(
            (queries) => sdk.list(queries),
            'teams'
        ),
        filterFn: (team, filters) => {
            if (filters.memberCount === '0' && team.total !== 0) return false;
            if (filters.memberCount === '1' && team.total !== 1) return false;
            if (filters.memberCount === 'lte5' && team.total > 5) return false;
            if (filters.nameContains && !team.name.toLowerCase().includes(filters.nameContains.toLowerCase())) return false;
            if (!matchesDateFilter(team.$createdAt, filters.createdMode, filters.createdDate)) return false;
            return true;
        },
        getItemId: (t) => t.$id,
        renderPreviewRow: (t) => (
            <>
                <td className="px-3 py-2 font-mono text-[11px]">{t.$id.slice(0, 12)}...</td>
                <td className="px-3 py-2">{t.name}</td>
                <td className="px-3 py-2">{t.total} members</td>
                <td className="px-3 py-2 text-gray-600">{new Date(t.$createdAt).toLocaleDateString()}</td>
            </>
        ),
        actions: [
            {
                id: 'delete', label: 'Delete Teams', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} TEAMS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const t of items) {
                        try { await sdk.delete(t.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// FILE CLEANUP CONFIG
// ============================================================================

export function getFileCleanupConfig(project: AppwriteProject, bucketId: string): CleanupConfig<Models.File> {
    const sdk = getSdkStorage(project);

    return {
        resourceName: 'Files',
        resourceNameSingular: 'File',
        filters: [
            {
                id: 'extension', label: 'File Extension', type: 'text',
                placeholder: 'e.g. .tmp, .log, .bak',
                description: 'Comma-separated extensions'
            },
            {
                id: 'mimeType', label: 'MIME Type', type: 'select',
                options: [
                    { label: 'Images', value: 'image/' },
                    { label: 'Videos', value: 'video/' },
                    { label: 'Audio', value: 'audio/' },
                    { label: 'Documents', value: 'application/pdf' },
                    { label: 'Archives', value: 'application/zip' },
                ]
            },
            {
                id: 'sizeMode', label: 'File Size', type: 'select',
                options: [
                    { label: 'Larger than (MB)', value: 'larger' },
                    { label: 'Smaller than (KB)', value: 'smaller' },
                ]
            },
            {
                id: 'sizeValue', label: 'Size Value', type: 'number',
                placeholder: 'Enter size value'
            },
            {
                id: 'nameContains', label: 'File Name Contains', type: 'text',
                placeholder: 'e.g. thumbnail, temp'
            },
            {
                id: 'uploadedMode', label: 'Upload Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }]
            },
            {
                id: 'uploadedDate', label: 'Upload Date Value', type: 'date'
            },
        ],
        presets: [
            {
                label: 'Temp Files',
                description: 'Files with .tmp, .bak, .log, .cache extensions',
                filters: { extension: '.tmp,.bak,.log,.cache' }
            },
            {
                label: 'Large Files',
                description: 'Files larger than 50 MB',
                filters: { sizeMode: 'larger', sizeValue: 50 }
            },
            {
                label: 'Old Files',
                description: 'Uploaded more than 90 days ago',
                filters: { uploadedMode: 'before', uploadedDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0] }
            },
            {
                label: 'All Images',
                description: 'All image files in this bucket',
                filters: { mimeType: 'image/' }
            },
        ],
        fetchAll: fetchAllPaginated(
            (queries) => sdk.listFiles(bucketId, queries),
            'files'
        ),
        filterFn: (file, filters) => {
            if (filters.extension) {
                const exts = filters.extension.split(',').map((e: string) => e.trim().toLowerCase());
                const fileName = file.name.toLowerCase();
                if (!exts.some((ext: string) => fileName.endsWith(ext))) return false;
            }
            if (filters.mimeType && !file.mimeType?.startsWith(filters.mimeType)) return false;
            if (filters.sizeMode === 'larger' && filters.sizeValue && file.sizeOriginal < filters.sizeValue * 1024 * 1024) return false;
            if (filters.sizeMode === 'smaller' && filters.sizeValue && file.sizeOriginal > filters.sizeValue * 1024) return false;
            if (filters.nameContains && !file.name.toLowerCase().includes(filters.nameContains.toLowerCase())) return false;
            if (!matchesDateFilter(file.$createdAt, filters.uploadedMode, filters.uploadedDate)) return false;
            return true;
        },
        getItemId: (f) => f.$id,
        renderPreviewRow: (f) => {
            const sizeStr = f.sizeOriginal < 1024 * 1024
                ? `${(f.sizeOriginal / 1024).toFixed(1)} KB`
                : `${(f.sizeOriginal / (1024 * 1024)).toFixed(1)} MB`;
            return (
                <>
                    <td className="px-3 py-2 font-mono text-[11px]">{f.$id.slice(0, 12)}...</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{f.name}</td>
                    <td className="px-3 py-2 font-mono">{sizeStr}</td>
                    <td className="px-3 py-2 text-gray-600">{f.mimeType}</td>
                </>
            );
        },
        actions: [
            {
                id: 'delete', label: 'Delete Files', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} FILES`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const f of items) {
                        try { await sdk.deleteFile(bucketId, f.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// EXECUTION CLEANUP CONFIG
// ============================================================================

export function getExecutionCleanupConfig(project: AppwriteProject, functionId: string): CleanupConfig<Models.Execution> {
    const sdk = getSdkFunctions(project);

    return {
        resourceName: 'Executions',
        resourceNameSingular: 'Execution',
        filters: [
            {
                id: 'status', label: 'Status', type: 'select',
                options: [
                    { label: 'Completed', value: 'completed' },
                    { label: 'Failed', value: 'failed' },
                    { label: 'Waiting', value: 'waiting' },
                    { label: 'Building', value: 'building' },
                ]
            },
            {
                id: 'durationMode', label: 'Duration', type: 'select',
                options: [
                    { label: 'Longer than (seconds)', value: 'longer' },
                    { label: 'Shorter than (seconds)', value: 'shorter' },
                ]
            },
            {
                id: 'durationValue', label: 'Duration Value (seconds)', type: 'number',
                placeholder: 'e.g. 10'
            },
            {
                id: 'dateMode', label: 'Execution Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }]
            },
            {
                id: 'dateValue', label: 'Date Value', type: 'date'
            },
        ],
        presets: [
            {
                label: 'Failed Executions',
                description: 'All executions with status = failed',
                filters: { status: 'failed' }
            },
            {
                label: 'Old Logs',
                description: 'Executions older than 7 days',
                filters: { dateMode: 'before', dateValue: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0] }
            },
            {
                label: 'Slow Executions',
                description: 'Executions with duration > 10 seconds',
                filters: { durationMode: 'longer', durationValue: 10 }
            },
        ],
        fetchAll: fetchAllPaginated(
            (queries) => sdk.listExecutions(functionId, queries),
            'executions'
        ),
        filterFn: (exec, filters) => {
            if (filters.status && exec.status !== filters.status) return false;
            if (filters.durationMode === 'longer' && filters.durationValue && exec.duration < filters.durationValue) return false;
            if (filters.durationMode === 'shorter' && filters.durationValue && exec.duration > filters.durationValue) return false;
            if (!matchesDateFilter(exec.$createdAt, filters.dateMode, filters.dateValue)) return false;
            return true;
        },
        getItemId: (e) => e.$id,
        renderPreviewRow: (e) => (
            <>
                <td className="px-3 py-2 font-mono text-[11px]">{e.$id.slice(0, 12)}...</td>
                <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase ${
                        e.status === 'completed' ? 'text-green-400' :
                        e.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                    }`}>{e.status}</span>
                </td>
                <td className="px-3 py-2 font-mono">{e.duration.toFixed(3)}s</td>
                <td className="px-3 py-2 text-gray-600">{new Date(e.$createdAt).toLocaleString()}</td>
            </>
        ),
        actions: [
            {
                id: 'delete', label: 'Delete Executions', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} EXECUTIONS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const e of items) {
                        try { await sdk.deleteExecution(functionId, e.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// DEPLOYMENT CLEANUP CONFIG
// ============================================================================

export function getDeploymentCleanupConfig(project: AppwriteProject, func: AppwriteFunction): CleanupConfig<Models.Deployment> {
    const sdk = getSdkFunctions(project);

    return {
        resourceName: 'Deployments',
        resourceNameSingular: 'Deployment',
        filters: [
            {
                id: 'status', label: 'Status', type: 'select',
                options: [
                    { label: 'Ready', value: 'ready' },
                    { label: 'Failed', value: 'failed' },
                    { label: 'Building', value: 'building' },
                ]
            },
            {
                id: 'active', label: 'Active Status', type: 'select',
                options: [
                    { label: 'Non-active only', value: 'inactive' },
                ]
            },
            {
                id: 'dateMode', label: 'Created Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }]
            },
            {
                id: 'dateValue', label: 'Date Value', type: 'date'
            },
        ],
        presets: [
            {
                label: 'Failed Builds',
                description: 'All deployments with status = failed',
                filters: { status: 'failed' }
            },
            {
                label: 'Non-Active Ready',
                description: 'Ready deployments that are not the active one',
                filters: { status: 'ready', active: 'inactive' }
            },
            {
                label: 'Old Deployments',
                description: 'Non-active deployments older than 30 days',
                filters: { active: 'inactive', dateMode: 'before', dateValue: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0] }
            },
        ],
        fetchAll: fetchAllPaginated(
            (queries) => sdk.listDeployments(func.$id, queries),
            'deployments'
        ),
        filterFn: (dep, filters) => {
            if (filters.status && dep.status !== filters.status) return false;
            if (filters.active === 'inactive' && dep.$id === func.deploymentId) return false;
            if (!matchesDateFilter(dep.$createdAt, filters.dateMode, filters.dateValue)) return false;
            return true;
        },
        getItemId: (d) => d.$id,
        renderPreviewRow: (d) => (
            <>
                <td className="px-3 py-2 font-mono text-[11px]">{d.$id.slice(0, 12)}...</td>
                <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase ${
                        d.status === 'ready' ? 'text-green-400' :
                        d.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                    }`}>{d.status}</span>
                    {d.$id === func.deploymentId && (
                        <span className="ml-2 text-[10px] bg-cyan-500 text-black px-1.5 py-0.5 rounded font-bold">ACTIVE</span>
                    )}
                </td>
                <td className="px-3 py-2 text-gray-600">{d.entrypoint}</td>
                <td className="px-3 py-2 text-gray-600">{new Date(d.$createdAt).toLocaleDateString()}</td>
            </>
        ),
        actions: [
            {
                id: 'delete', label: 'Delete Deployments', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} DEPLOYMENTS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const d of items) {
                        try { await sdk.deleteDeployment(func.$id, d.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// DOCUMENT CLEANUP CONFIG
// ============================================================================

export function getDocumentCleanupConfig(
    project: AppwriteProject, dbId: string, collId: string
): CleanupConfig<Models.Document> {
    const sdk = getSdkDatabases(project);

    return {
        resourceName: 'Documents',
        resourceNameSingular: 'Document',
        filters: [
            {
                id: 'createdMode', label: 'Created Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }]
            },
            {
                id: 'createdDate', label: 'Created Date Value', type: 'date'
            },
            {
                id: 'updatedMode', label: 'Updated Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }, { label: 'Never Updated', value: 'never' }]
            },
            {
                id: 'updatedDate', label: 'Updated Date Value', type: 'date'
            },
        ],
        presets: [
            {
                label: 'Stale Documents',
                description: 'Not updated in 90+ days',
                filters: { updatedMode: 'before', updatedDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0] }
            },
            {
                label: 'Old Documents',
                description: 'Created more than 180 days ago',
                filters: { createdMode: 'before', createdDate: new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().split('T')[0] }
            },
        ],
        fetchAll: fetchAllPaginated(
            (queries) => sdk.listDocuments(dbId, collId, queries),
            'documents'
        ),
        filterFn: (doc, filters) => {
            if (!matchesDateFilter(doc.$createdAt, filters.createdMode, filters.createdDate)) return false;
            if (filters.updatedMode === 'never' && doc.$updatedAt !== doc.$createdAt) return false;
            if (filters.updatedMode && filters.updatedMode !== 'never' && !matchesDateFilter(doc.$updatedAt, filters.updatedMode, filters.updatedDate)) return false;
            return true;
        },
        getItemId: (d) => d.$id,
        renderPreviewRow: (d) => {
            const { $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions, ...rest } = d;
            const preview = JSON.stringify(rest).slice(0, 80);
            return (
                <>
                    <td className="px-3 py-2 font-mono text-[11px]">{$id.slice(0, 12)}...</td>
                    <td className="px-3 py-2 truncate max-w-[250px] font-mono text-[10px]">{preview}...</td>
                    <td className="px-3 py-2 text-gray-600">{new Date($createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-gray-600">{new Date($updatedAt).toLocaleDateString()}</td>
                </>
            );
        },
        actions: [
            {
                id: 'delete', label: 'Delete Documents', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} DOCUMENTS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const d of items) {
                        try { await sdk.deleteDocument(dbId, collId, d.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// VARIABLE CLEANUP CONFIG
// ============================================================================

export function getVariableCleanupConfig(project: AppwriteProject, functionId: string): CleanupConfig<Models.Variable> {
    const sdk = getSdkFunctions(project);

    return {
        resourceName: 'Variables',
        resourceNameSingular: 'Variable',
        filters: [
            {
                id: 'keyPattern', label: 'Key Contains', type: 'text',
                placeholder: 'e.g. DEBUG_, TEST_, OLD_'
            },
            {
                id: 'valuePattern', label: 'Value Contains', type: 'text',
                placeholder: 'Search in values'
            },
            {
                id: 'hasValue', label: 'Value Status', type: 'select',
                options: [
                    { label: 'Has Value', value: 'has' },
                    { label: 'Empty Value', value: 'empty' },
                ]
            },
        ],
        presets: [
            {
                label: 'Empty Variables',
                description: 'Variables with empty string value',
                filters: { hasValue: 'empty' }
            },
            {
                label: 'Debug Variables',
                description: 'Keys starting with DEBUG_ or TEST_',
                filters: { keyPattern: 'DEBUG_' }
            },
        ],
        fetchAll: async () => {
            const res = await sdk.listVariables(functionId);
            return res.variables;
        },
        filterFn: (v, filters) => {
            if (filters.keyPattern && !v.key.toLowerCase().includes(filters.keyPattern.toLowerCase())) return false;
            if (filters.valuePattern && !v.value.toLowerCase().includes(filters.valuePattern.toLowerCase())) return false;
            if (filters.hasValue === 'has' && !v.value?.trim()) return false;
            if (filters.hasValue === 'empty' && v.value?.trim()) return false;
            return true;
        },
        getItemId: (v) => v.$id,
        renderPreviewRow: (v) => (
            <>
                <td className="px-3 py-2 font-mono text-[11px]">{v.$id.slice(0, 12)}...</td>
                <td className="px-3 py-2 font-mono font-bold">{v.key}</td>
                <td className="px-3 py-2 font-mono truncate max-w-[200px]">{v.value ? '••••••••' : <span className="italic text-gray-600">empty</span>}</td>
                <td className="px-3 py-2 text-gray-600">{new Date(v.$createdAt).toLocaleDateString()}</td>
            </>
        ),
        actions: [
            {
                id: 'delete', label: 'Delete Variables', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} VARIABLES`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const v of items) {
                        try { await sdk.deleteVariable(functionId, v.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// SITE CLEANUP CONFIG (top-level — cleanup sites themselves)
// ============================================================================

export function getSiteCleanupConfig(project: AppwriteProject): CleanupConfig<AppwriteSite> {
    const sdk = getSdkSites(project);

    return {
        resourceName: 'Sites',
        resourceNameSingular: 'Site',
        filters: [
            {
                id: 'framework', label: 'Framework', type: 'select',
                options: [
                    { label: 'Next.js', value: 'nextjs' },
                    { label: 'Nuxt', value: 'nuxt' },
                    { label: 'SvelteKit', value: 'sveltekit' },
                    { label: 'Astro', value: 'astro' },
                    { label: 'Remix', value: 'remix' },
                    { label: 'React', value: 'react' },
                    { label: 'Vue', value: 'vue' },
                    { label: 'Vite', value: 'vite' },
                    { label: 'Angular', value: 'angular' },
                    { label: 'Static', value: 'static' },
                ]
            },
            {
                id: 'status', label: 'Status', type: 'select',
                options: [
                    { label: 'Enabled', value: 'enabled' },
                    { label: 'Disabled', value: 'disabled' },
                ]
            },
            {
                id: 'nameContains', label: 'Name Contains', type: 'text',
                placeholder: 'e.g. staging, test, old'
            },
            {
                id: 'hasDeployment', label: 'Deployment Status', type: 'select',
                options: [
                    { label: 'Has Active Deployment', value: 'has' },
                    { label: 'No Active Deployment', value: 'none' },
                ]
            },
            {
                id: 'createdMode', label: 'Created Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }]
            },
            {
                id: 'createdDate', label: 'Created Date Value', type: 'date'
            },
        ],
        presets: [
            {
                label: 'Disabled Sites',
                description: 'All currently disabled sites',
                filters: { status: 'disabled' }
            },
            {
                label: 'No Deployment',
                description: 'Sites with no active deployment',
                filters: { hasDeployment: 'none' }
            },
            {
                label: 'Old Sites',
                description: 'Sites created more than 90 days ago',
                filters: { createdMode: 'before', createdDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0] }
            },
            {
                label: 'Test Sites',
                description: 'Sites with "test", "staging", or "temp" in name',
                filters: { nameContains: 'test' }
            },
        ],
        fetchAll: fetchAllPaginated<AppwriteSite>(
            (queries) => sdk.list(queries) as any,
            'sites'
        ),
        filterFn: (site, filters) => {
            if (filters.framework && site.framework !== filters.framework) return false;
            if (filters.status === 'enabled' && !site.enabled) return false;
            if (filters.status === 'disabled' && site.enabled) return false;
            if (filters.nameContains && !site.name.toLowerCase().includes(filters.nameContains.toLowerCase())) return false;
            if (filters.hasDeployment === 'has' && !site.deploymentId) return false;
            if (filters.hasDeployment === 'none' && site.deploymentId) return false;
            if (!matchesDateFilter(site.$createdAt, filters.createdMode, filters.createdDate)) return false;
            return true;
        },
        getItemId: (s) => s.$id,
        renderPreviewRow: (s) => (
            <>
                <td className="px-3 py-2 font-mono text-[11px]">{s.$id.slice(0, 12)}...</td>
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2 text-gray-500">{s.framework}</td>
                <td className="px-3 py-2">
                    <span className={s.enabled ? 'text-green-400' : 'text-red-400'}>
                        {s.enabled ? 'Active' : 'Disabled'}
                    </span>
                </td>
            </>
        ),
        actions: [
            {
                id: 'delete', label: 'Delete Sites', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} SITES`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const s of items) {
                        try { await sdk.delete(s.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
            {
                id: 'disable', label: 'Disable Sites', variant: 'warning',
                confirmPhrase: (n) => `DISABLE ${n} SITES`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const s of items) {
                        try {
                            await sdk.update(s.$id, s.name, s.framework as any, false);
                            success++;
                        } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
            {
                id: 'enable', label: 'Enable Sites', variant: 'info',
                confirmPhrase: (n) => `ENABLE ${n} SITES`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const s of items) {
                        try {
                            await sdk.update(s.$id, s.name, s.framework as any, true);
                            success++;
                        } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// SITE DEPLOYMENT CLEANUP CONFIG
// ============================================================================

export function getSiteDeploymentCleanupConfig(project: AppwriteProject, site: AppwriteSite): CleanupConfig<Models.Deployment> {
    const sdk = getSdkSites(project);

    return {
        resourceName: 'Site Deployments',
        resourceNameSingular: 'Deployment',
        filters: [
            {
                id: 'status', label: 'Status', type: 'select',
                options: [
                    { label: 'Ready', value: 'ready' },
                    { label: 'Failed', value: 'failed' },
                    { label: 'Building', value: 'building' },
                    { label: 'Cancelled', value: 'cancelled' },
                ]
            },
            {
                id: 'active', label: 'Active Status', type: 'select',
                options: [
                    { label: 'Non-active only', value: 'inactive' },
                ]
            },
            {
                id: 'dateMode', label: 'Created Date', type: 'select',
                options: [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }]
            },
            {
                id: 'dateValue', label: 'Date Value', type: 'date'
            },
        ],
        presets: [
            {
                label: 'Failed Builds',
                description: 'All deployments with status = failed',
                filters: { status: 'failed' }
            },
            {
                label: 'Non-Active Ready',
                description: 'Ready deployments that are not the live version',
                filters: { status: 'ready', active: 'inactive' }
            },
            {
                label: 'Old Deployments',
                description: 'Non-active deployments older than 30 days',
                filters: { active: 'inactive', dateMode: 'before', dateValue: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0] }
            },
        ],
        fetchAll: fetchAllPaginated(
            (queries) => sdk.listDeployments(site.$id, queries),
            'deployments'
        ),
        filterFn: (dep, filters) => {
            if (filters.status && dep.status !== filters.status) return false;
            if (filters.active === 'inactive' && dep.$id === site.deploymentId) return false;
            if (!matchesDateFilter(dep.$createdAt, filters.dateMode, filters.dateValue)) return false;
            return true;
        },
        getItemId: (d) => d.$id,
        renderPreviewRow: (d) => (
            <>
                <td className="px-3 py-2 font-mono text-[11px]">{d.$id.slice(0, 12)}...</td>
                <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase ${
                        d.status === 'ready' ? 'text-green-400' :
                        d.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                    }`}>{d.status}</span>
                    {d.$id === site.deploymentId && (
                        <span className="ml-2 text-[10px] bg-cyan-500 text-black px-1.5 py-0.5 rounded font-bold">LIVE</span>
                    )}
                </td>
                <td className="px-3 py-2 text-gray-600 font-mono">{(d.totalSize ?? 0) > 0 ? `${((d.totalSize ?? 0) / 1024).toFixed(1)} KB` : '—'}</td>
                <td className="px-3 py-2 text-gray-600">{new Date(d.$createdAt).toLocaleDateString()}</td>
            </>
        ),
        actions: [
            {
                id: 'delete', label: 'Delete Deployments', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} DEPLOYMENTS`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const d of items) {
                        try { await sdk.deleteDeployment(site.$id, d.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}

// ============================================================================
// SITE VARIABLE CLEANUP CONFIG
// ============================================================================

export function getSiteVariableCleanupConfig(project: AppwriteProject, siteId: string): CleanupConfig<Models.Variable> {
    const sdk = getSdkSites(project);

    return {
        resourceName: 'Site Variables',
        resourceNameSingular: 'Variable',
        filters: [
            {
                id: 'keyPattern', label: 'Key Contains', type: 'text',
                placeholder: 'e.g. DEBUG_, TEST_, OLD_'
            },
            {
                id: 'valuePattern', label: 'Value Contains', type: 'text',
                placeholder: 'Search in values'
            },
            {
                id: 'hasValue', label: 'Value Status', type: 'select',
                options: [
                    { label: 'Has Value', value: 'has' },
                    { label: 'Empty Value', value: 'empty' },
                ]
            },
        ],
        presets: [
            {
                label: 'Empty Variables',
                description: 'Variables with empty string value',
                filters: { hasValue: 'empty' }
            },
            {
                label: 'Debug Variables',
                description: 'Keys containing DEBUG_ or TEST_',
                filters: { keyPattern: 'DEBUG_' }
            },
        ],
        fetchAll: async () => {
            const res = await sdk.listVariables(siteId);
            return res.variables;
        },
        filterFn: (v, filters) => {
            if (filters.keyPattern && !v.key.toLowerCase().includes(filters.keyPattern.toLowerCase())) return false;
            if (filters.valuePattern && !v.value.toLowerCase().includes(filters.valuePattern.toLowerCase())) return false;
            if (filters.hasValue === 'has' && !v.value?.trim()) return false;
            if (filters.hasValue === 'empty' && v.value?.trim()) return false;
            return true;
        },
        getItemId: (v) => v.$id,
        renderPreviewRow: (v) => (
            <>
                <td className="px-3 py-2 font-mono text-[11px]">{v.$id.slice(0, 12)}...</td>
                <td className="px-3 py-2 font-mono font-bold">{v.key}</td>
                <td className="px-3 py-2 font-mono truncate max-w-[200px]">{v.value ? '••••••••' : <span className="italic text-gray-600">empty</span>}</td>
                <td className="px-3 py-2 text-gray-600">{new Date(v.$createdAt).toLocaleDateString()}</td>
            </>
        ),
        actions: [
            {
                id: 'delete', label: 'Delete Variables', variant: 'danger',
                confirmPhrase: (n) => `DELETE ${n} VARIABLES`,
                execute: async (items) => {
                    let success = 0, failed = 0;
                    for (const v of items) {
                        try { await sdk.deleteVariable(siteId, v.$id); success++; } catch { failed++; }
                    }
                    return { success, failed };
                }
            },
        ],
    };
}
