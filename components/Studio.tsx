
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppwriteProject, Database, Bucket, AppwriteFunction, AppwriteSite, StudioTab } from '../types';
import type { Models } from 'node-appwrite';
import type { UseRealtimeReturn } from '../hooks/useRealtime';
import { Modal, hasOpenDialog } from './Modal';
import { getSdkDatabases, getSdkStorage, getSdkFunctions } from '../services/appwrite';
import { LoadingSpinnerIcon, ChevronDownIcon } from './Icons';

// Sub-components & UI
import { StudioNavBar } from './studio/ui/StudioNavBar';
import { StudioSubNav } from './studio/ui/StudioSubNav';
import { STUDIO_SECTION_UI, type StudioSectionProps } from './studio/navigation';
import { groupOf, defaultSectionOf, type StudioGroupId } from '../services/studioNav';
import { ConsolidateBucketsModal } from './studio/ConsolidateBucketsModal';
import { ExecutionDetails } from './studio/ui/ExecutionDetails';
import { DocumentDetails } from './studio/ui/DocumentDetails';

// Hooks
import { useStudioData } from './studio/hooks/useStudioData';
import { useStudioModals } from './studio/hooks/useStudioModals';
import { useStudioActions } from './studio/hooks/useStudioActions';
import { SectionRefreshProvider, useSectionRefreshStore } from './studio/hooks/useSectionRefresh';
import { useToast } from '../hooks/useToast';
import { useRouter, routes } from '../services/router';

interface StudioProps {
    activeProject: AppwriteProject;
    projects: AppwriteProject[];
    databases: Database[];
    buckets: Bucket[];
    functions: AppwriteFunction[];
    refreshData: () => void;
    onCreateFunction: () => void;
    activeTab: StudioTab;
    onTabChange: (tab: StudioTab) => void;
    onEditCode: (func: AppwriteFunction) => void;
    logCallback: (msg: string) => void;
    realtimeHook?: UseRealtimeReturn;
}

export const Studio: React.FC<StudioProps> = ({
    activeProject, projects, databases, buckets, functions,
    refreshData, onCreateFunction, activeTab, onTabChange, onEditCode, logCallback,
    realtimeHook,
}) => {
    
    // 1. Initialize Router & Core Logic Hooks
    const { route, navigate } = useRouter();
    const { params } = route;

    const toast = useToast();

    const studioData = useStudioData(
        activeProject,
        activeTab,
        logCallback,
        params,
        navigate,
        databases,
        buckets,
        functions
    );

    // 2. Destructure data hooks for cleaner prop passing
    const {
        isLoading: dataLoading,
        selectedDb, setSelectedDb, selectedCollection, setSelectedCollection,
        selectedBucket, setSelectedBucket, selectedFunction, setSelectedFunction,
        selectedTeam, setSelectedTeam,
        selectedSite, setSelectedSite,
        attributes, indexes, variables, siteVariables,
        usersPagination, teamsPagination, collectionsPagination, documentsPagination,
        filesPagination, deploymentsPagination, executionsPagination, membershipsPagination,
        sitesPagination, siteDeploymentsPagination, siteLogsPagination,
        refreshCurrentView,
    } = studioData;

    // Closing a deep-linked modal must also drop its segment from the URL.
    const handleAfterModalClose = useCallback(() => {
        if (params.docId && selectedCollection && selectedDb) {
            navigate(routes.studioCollection(activeProject.$id, selectedDb.$id, selectedCollection.$id));
        } else if (params.fileId && selectedBucket) {
            navigate(routes.studioStorage(activeProject.$id, selectedBucket.$id));
        } else if (params.execId && selectedFunction) {
            navigate(routes.studioFunction(activeProject.$id, selectedFunction.$id));
        }
    }, [params.docId, params.fileId, params.execId, selectedCollection?.$id, selectedDb?.$id, selectedBucket?.$id, selectedFunction?.$id, activeProject?.$id, navigate]);

    const studioModals = useStudioModals(handleAfterModalClose);

    // Every self-loading panel registers its own re-fetch here, so the Sync
    // button, Shift+R and the snapshot actions all reach the section on screen.
    const sectionRefresh = useSectionRefreshStore();
    const notifyBackupsChanged = sectionRefresh.runAll;

    const studioActions = useStudioActions(activeProject, studioData, studioModals, refreshData, logCallback, toast, notifyBackupsChanged);

    // 3. Wire Realtime events to Studio data
    useEffect(() => {
        if (!realtimeHook?.isConnected || !studioData.handleRealtimeEvent) return;
        const cleanup = realtimeHook.addEventListener(studioData.handleRealtimeEvent);
        return cleanup;
    }, [realtimeHook?.isConnected, realtimeHook?.addEventListener, studioData.handleRealtimeEvent]);

    // 4. Local Feature States
    const [isConsolidateModalOpen, setIsConsolidateModalOpen] = useState(false);

    const { modal, setFormValues, formValues, modalLoading, openCustomModal, setModalLoading, closeModal } = studioModals;

    // Special handlers that need local UI components — now they navigate to their deep routes
    const handleViewExecution = (exec: Models.Execution) => {
        if (!selectedFunction) return;
        navigate(routes.studioExecution(activeProject.$id, selectedFunction.$id, exec.$id));
    };

    const handleViewDocument = (doc: Models.Document) => {
        if (!selectedDb || !selectedCollection) return;
        navigate(routes.studioDocument(activeProject.$id, selectedDb.$id, selectedCollection.$id, doc.$id));
    };

    const handlePreviewFile = (file: Models.File) => {
        if (!selectedBucket) return;
        navigate(routes.studioFile(activeProject.$id, selectedBucket.$id, file.$id));
    };

    // Always-current handles, so the deep-link effect below need not depend on
    // objects that are re-created on every render.
    const latestRef = useRef({ studioActions, openCustomModal, closeModal, handleViewExecution });
    latestRef.current = { studioActions, openCustomModal, closeModal, handleViewExecution };

    // Sync deep-linked modals with router parameters.
    // Guarded by the last-opened deep-link key so the modal is created once per
    // parameter change, not once per render.
    const lastDeepLinkRef = useRef<string | null>(null);

    useEffect(() => {
        const deepLinkKey = `${params.docId || ''}|${params.fileId || ''}|${params.execId || ''}`;
        if (deepLinkKey === '||') {
            lastDeepLinkRef.current = null;
            return;
        }
        if (lastDeepLinkRef.current === deepLinkKey) return;

        // 1. Handle Document Details Modal
        if (params.docId && selectedCollection && selectedDb) {
            lastDeepLinkRef.current = deepLinkKey;
            const renderDocument = (document: any) => {
                latestRef.current.openCustomModal(
                    "Document Preview",
                    <DocumentDetails
                        document={document}
                        onEdit={(d) => { latestRef.current.closeModal(); latestRef.current.studioActions.handleUpdateDocument(d); }}
                        onDelete={(d) => { latestRef.current.closeModal(); latestRef.current.studioActions.handleDeleteDocument(d); }}
                    />,
                    '3xl'
                );
            };
            const doc = (documentsPagination.items as any[]).find(d => d.$id === params.docId);
            if (doc) {
                renderDocument(doc);
            } else {
                const fetchAndOpen = async () => {
                    try {
                        const sdk = getSdkDatabases(activeProject);
                        const res = await sdk.getDocument(selectedDb.$id, selectedCollection.$id, params.docId);
                        renderDocument(res);
                    } catch (e) {
                        console.error("Could not fetch document details for route", e);
                        lastDeepLinkRef.current = null;
                    }
                };
                fetchAndOpen();
            }
        }
        // 2. Handle File Preview Modal
        else if (params.fileId && selectedBucket) {
            lastDeepLinkRef.current = deepLinkKey;
            const file = (filesPagination.items as any[]).find(f => f.$id === params.fileId);
            if (file) {
                latestRef.current.studioActions.handlePreviewFile(file as any);
            } else {
                const fetchAndOpen = async () => {
                    try {
                        const sdk = getSdkStorage(activeProject);
                        const res = await sdk.getFile(selectedBucket.$id, params.fileId);
                        latestRef.current.studioActions.handlePreviewFile(res as any);
                    } catch (e) {
                        console.error("Could not fetch file details for route", e);
                        lastDeepLinkRef.current = null;
                    }
                };
                fetchAndOpen();
            }
        }
        // 3. Handle Execution Details Modal
        else if (params.execId && selectedFunction) {
            lastDeepLinkRef.current = deepLinkKey;
            const renderExecution = (execution: any) => {
                latestRef.current.openCustomModal(
                    "Execution Details",
                    <ExecutionDetails
                        execution={execution}
                        allExecutions={executionsPagination.items as any[]}
                        onNavigate={(exec) => latestRef.current.handleViewExecution(exec)}
                    />,
                    '3xl'
                );
            };
            const exec = (executionsPagination.items as any[]).find(e => e.$id === params.execId);
            if (exec) {
                renderExecution(exec);
            } else {
                const fetchAndOpen = async () => {
                    try {
                        const sdk = getSdkFunctions(activeProject);
                        const res = await sdk.getExecution(selectedFunction.$id, params.execId);
                        renderExecution(res);
                    } catch (e) {
                        console.error("Could not fetch execution details for route", e);
                        lastDeepLinkRef.current = null;
                    }
                };
                fetchAndOpen();
            }
        }
    }, [
        params.docId,
        params.fileId,
        params.execId,
        selectedCollection?.$id,
        selectedDb?.$id,
        selectedBucket?.$id,
        selectedFunction?.$id,
        activeProject,
        documentsPagination.items,
        filesPagination.items,
        executionsPagination.items,
    ]);

    const handleStudioRefresh = async () => {
        refreshData();
        await refreshCurrentView();
        await sectionRefresh.runAll();
    };

    // The active group is derived from the active section — the registry owns the mapping.
    const activeGroup = groupOf(activeTab);

    // Switching group lands on that group's first section; switching section stays inside it.
    const handleGroupChange = useCallback((group: StudioGroupId) => {
        onTabChange(defaultSectionOf(group));
    }, [onTabChange]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if typing in input/textarea/select
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;
            // Don't trigger behind ANY open dialog — the dynamic modal, the
            // confirmation dialog, or a tab's own modal. Escape belongs to the
            // dialog on top, and must not also clear the selection underneath.
            if (hasOpenDialog()) return;

            switch (e.key) {
                case 'Escape':
                    // Navigate back (deselect current selection)
                    if (selectedCollection) { setSelectedCollection(null); }
                    else if (selectedDb) { setSelectedDb(null); }
                    else if (selectedBucket) { setSelectedBucket(null); }
                    else if (selectedFunction) { setSelectedFunction(null); }
                    else if (selectedTeam) { setSelectedTeam(null); }
                    else if (selectedSite) { setSelectedSite(null); }
                    break;
                case 'R':
                    // Shift+R — a bare letter key fires from anywhere on the page.
                    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        handleStudioRefresh();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedDb, selectedCollection, selectedBucket, selectedFunction, selectedTeam, selectedSite]);

    // Every section's props, keyed exhaustively by StudioTab and typechecked
    // against the panel registered for it in `components/studio/navigation.tsx`.
    // Adding a section without wiring its props here is a compile error.
    const sectionProps: StudioSectionProps = {
        'overview': {
            activeProject,
            databases, buckets, functions,
            sites: sitesPagination.items as unknown as AppwriteSite[],
            users: usersPagination.items, teams: teamsPagination.items, onTabChange,
            onCreateDatabase: studioActions.handleCreateDatabase,
            onCreateBucket: studioActions.handleCreateBucket,
            onCreateUser: studioActions.handleCreateUser,
            sitesTotal: sitesPagination.total,
            usersTotal: usersPagination.total,
            teamsTotal: teamsPagination.total,
        },
        'database': {
            activeProject,
            projects,
            databases, selectedDb, selectedCollection,
            collections: collectionsPagination.items, documents: documentsPagination.items, attributes, indexes,
            onCreateDatabase: studioActions.handleCreateDatabase, onDeleteDatabase: studioActions.handleDeleteDatabase, onSelectDb: setSelectedDb,
            onCreateCollection: studioActions.handleCreateCollection, onDeleteCollection: studioActions.handleDeleteCollection, onSelectCollection: setSelectedCollection,
            onCreateDocument: studioActions.handleCreateDocument, onUpdateDocument: studioActions.handleUpdateDocument, onDeleteDocument: studioActions.handleDeleteDocument,
            onViewDocument: handleViewDocument,
            onCreateAttribute: studioActions.handleCreateAttribute, onUpdateAttribute: studioActions.handleUpdateAttribute, onDeleteAttribute: studioActions.handleDeleteAttribute,
            onCreateIndex: studioActions.handleCreateIndex,
            onUpdateIndex: studioActions.handleUpdateIndex,
            onDeleteIndex: studioActions.handleDeleteIndex,
            onUpdateCollectionSettings: studioActions.handleUpdateCollectionSettings,
            onCopySchema: studioActions.handleCopyDatabaseSchema,
            handleBulkUpdateDocuments: studioActions.handleBulkUpdateDocuments,
            handleBulkDeleteDocuments: studioActions.handleBulkDeleteDocuments,
            onRenameDatabase: studioActions.handleRenameDatabase,
            collectionsPagination,
            documentsPagination,
        },
        'storage': {
            activeProject,
            buckets, selectedBucket, files: filesPagination.items,
            onCreateBucket: studioActions.handleCreateBucket, onDeleteBucket: studioActions.handleDeleteBucket, onSelectBucket: setSelectedBucket,
            onDeleteFile: studioActions.handleDeleteFile,
            onConsolidateBuckets: () => setIsConsolidateModalOpen(true),
            onBulkDeleteBuckets: studioActions.handleBulkDeleteBuckets,
            onBulkDeleteFiles: studioActions.handleBulkDeleteFiles,
            onUploadFile: studioActions.handleUploadFile,
            onDownloadFile: studioActions.handleDownloadFile,
            onPreviewFile: handlePreviewFile,
            onUpdateBucket: studioActions.handleUpdateBucket,
            filesPagination,
        },
        'erd': {
            activeProject,
            databases,
        },
        'functions': {
            activeProject,
            functions, selectedFunction,
            deployments: deploymentsPagination.items, executions: executionsPagination.items, variables,
            onCreateFunction, onDeleteFunction: studioActions.handleDeleteFunction, onSelectFunction: setSelectedFunction,
            onActivateDeployment: studioActions.handleActivateDeployment,
            onViewExecution: handleViewExecution,
            onBulkDeleteDeployments: studioActions.handleBulkDeleteDeployments,
            onEditCode,
            onRefresh: handleStudioRefresh,
            deploymentsPagination,
            executionsPagination,
            // Variables
            onCreateVariable: studioActions.handleCreateVariable,
            onUpdateVariable: studioActions.handleUpdateVariable,
            onDeleteVariable: studioActions.handleDeleteVariable,
            // Execute & Settings
            onExecuteFunction: studioActions.handleExecuteFunction,
            onUpdateFunction: studioActions.handleUpdateFunction,
        },
        'sites': {
            activeProject,
            sites: sitesPagination.items as unknown as AppwriteSite[],
            selectedSite,
            siteDeployments: siteDeploymentsPagination.items,
            siteVariables,
            siteLogs: siteLogsPagination.items,
            onSelectSite: setSelectedSite,
            onCreateSite: studioActions.handleCreateSite,
            onDeleteSite: studioActions.handleDeleteSite,
            onUpdateSite: studioActions.handleUpdateSite,
            onActivateDeployment: studioActions.handleActivateSiteDeployment,
            onCancelDeployment: studioActions.handleCancelSiteDeployment,
            onDeleteDeployment: studioActions.handleDeleteSiteDeployment,
            onBulkDeleteDeployments: studioActions.handleBulkDeleteSiteDeployments,
            onCreateVariable: studioActions.handleCreateSiteVariable,
            onUpdateVariable: studioActions.handleUpdateSiteVariable,
            onDeleteVariable: studioActions.handleDeleteSiteVariable,
            sitesPagination,
            siteDeploymentsPagination,
            siteLogsPagination,
            onRefresh: handleStudioRefresh,
        },
        'users': {
            activeProject,
            users: usersPagination.items,
            onCreateUser: studioActions.handleCreateUser,
            onDeleteUser: studioActions.handleDeleteUser,
            onUpdateStatus: studioActions.handleUpdateUserStatus,
            onUpdateLabels: studioActions.handleUpdateUserLabels,
            onUpdateName: studioActions.handleUpdateUserName,
            onUpdateEmail: studioActions.handleUpdateUserEmail,
            onVerifyEmail: studioActions.handleVerifyUserEmail,
            onBulkDeleteUsers: studioActions.handleBulkDeleteUsers,
            pagination: usersPagination,
        },
        'teams': {
            activeProject,
            teams: teamsPagination.items, selectedTeam, memberships: membershipsPagination.items,
            onCreateTeam: studioActions.handleCreateTeam,
            onDeleteTeam: studioActions.handleDeleteTeam,
            onSelectTeam: setSelectedTeam,
            onCreateMembership: studioActions.handleCreateMembership,
            onDeleteMembership: studioActions.handleDeleteMembership,
            onRenameTeam: studioActions.handleRenameTeam,
            onBulkDeleteTeams: studioActions.handleBulkDeleteTeams,
            pagination: teamsPagination,
            membershipsPagination,
        },
        'messaging': { activeProject },
        'webhooks': { activeProject },
        'health': { activeProject },
        'migrations': { activeProject, projects },
        'backups': {
            activeProject,
            logCallback,
            onDeleteBackup: studioActions.handleDeleteBackup,
            onRestoreBackup: studioActions.handleRestoreBackup,
        },
        'project-settings': { activeProject },
    };

    // The registry decides which panel renders — "unknown section" is not expressible.
    const ActivePanel = STUDIO_SECTION_UI[activeTab].Panel as React.ComponentType<any>;

    return (
        <div className="flex flex-col flex-1 h-full overflow-hidden bg-gray-950/20">
            {/* Nav Header */}
            <div className="flex-shrink-0 z-20 py-3 w-full border-b border-white/5 bg-gray-950/20 backdrop-blur-md flex flex-col items-center justify-center gap-2 relative">
                 <StudioNavBar
                    activeGroup={activeGroup.id}
                    onGroupChange={handleGroupChange}
                    onRefresh={handleStudioRefresh}
                    isLoading={dataLoading}
                 />
                 <StudioSubNav
                    group={activeGroup}
                    activeSection={activeTab}
                    onSectionChange={onTabChange}
                 />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 relative custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-10">
                    <SectionRefreshProvider store={sectionRefresh}>
                        <ActivePanel {...sectionProps[activeTab]} />
                    </SectionRefreshProvider>
                </div>
            </div>

            {/* Dynamic Modal Interface */}
            {modal && modal.isOpen && (
                <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} size={modal.size}>
                    <div className="space-y-4">
                        {modal.message && <p className="text-gray-300 mb-4">{modal.message}</p>}
                        
                        {modal.type === 'custom' && modal.content}

                        {modal.type === 'form' && modal.fields && (
                            <div className="space-y-4">
                                {modal.fields.map(field => (
                                    <div key={field.name}>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{field.label} {field.required && '*'}</label>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 font-mono focus:ring-1 focus:ring-cyan-500 outline-none h-48 custom-scrollbar"
                                                value={formValues[field.name] || ''}
                                                onChange={e => setFormValues({...formValues, [field.name]: e.target.value})}
                                            />
                                        ) : field.type === 'checkbox' ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" id={`field-${field.name}`} checked={!!formValues[field.name]}
                                                    onChange={e => setFormValues({...formValues, [field.name]: e.target.checked})}
                                                    className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                />
                                                <label htmlFor={`field-${field.name}`} className="text-sm text-gray-300 select-none cursor-pointer">{field.label}</label>
                                            </div>
                                        ) : field.type === 'select' ? (
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                                                    value={formValues[field.name] || ''}
                                                    onChange={e => setFormValues({...formValues, [field.name]: e.target.value})}
                                                >
                                                     {field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500"><ChevronDownIcon size={14} /></div>
                                            </div>
                                        ) : (
                                            <input
                                                type={field.type || 'text'}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none"
                                                value={formValues[field.name] || ''}
                                                onChange={e => setFormValues({...formValues, [field.name]: e.target.value})}
                                            />
                                        )}
                                        {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700 mt-6">
                            {!modal.hideCancel && (
                                <button 
                                    onClick={closeModal} 
                                    disabled={modalLoading}
                                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                                >
                                    Cancel
                                </button>
                            )}
                            <button 
                                onClick={async () => {
                                    if(modal.type === 'custom') { closeModal(); return; }
                                    setModalLoading(true);
                                    try {
                                        const result = modal.onConfirm ? await modal.onConfirm(modal.type === 'form' ? formValues : undefined) : undefined;
                                        const preventClose = result === true;
                                        if (!preventClose) {
                                            closeModal();
                                        }
                                    } catch (err: any) {
                                        toast.error(`Action Failed: ${err.message}`);
                                        logCallback(`❌ Action Failed: ${err.message}`);
                                        if (modal.type === 'form') {
                                            setModalLoading(false);
                                        } else {
                                            closeModal();
                                        }
                                    }
                                }}
                                disabled={modalLoading}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors flex items-center gap-2 ${modal.confirmClass || 'bg-cyan-600 hover:bg-cyan-500'} disabled:opacity-70 disabled:cursor-not-allowed`}
                            >
                                {modalLoading ? <LoadingSpinnerIcon size={14} /> : null}
                                {modal.confirmLabel || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            
            <ConsolidateBucketsModal 
                isOpen={isConsolidateModalOpen} onClose={() => setIsConsolidateModalOpen(false)}
                buckets={buckets} activeProject={activeProject} projects={projects}
                onSuccess={() => { refreshData(); filesPagination.refresh(); }}
            />
        </div>
    );
};
