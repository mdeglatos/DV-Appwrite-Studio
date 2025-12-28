
import React, { useState } from 'react';
import type { AppwriteProject, Database, Bucket, AppwriteFunction, StudioTab } from '../types';
import type { Models } from 'node-appwrite';
import { Modal } from './Modal';
import { LoadingSpinnerIcon, ChevronDownIcon } from './Icons';

// Sub-components & UI
import { StudioNavBar } from './studio/ui/StudioNavBar';
import { OverviewTab } from './studio/tabs/OverviewTab';
import { DatabasesTab } from './studio/tabs/DatabasesTab';
import { StorageTab } from './studio/tabs/StorageTab';
import { FunctionsTab } from './studio/tabs/FunctionsTab';
import { UsersTab } from './studio/tabs/UsersTab';
import { TeamsTab } from './studio/tabs/TeamsTab';
import { MigrationsTab } from './studio/tabs/MigrationsTab';
import { McpTab } from './studio/tabs/McpTab';
import { BackupsTab } from './studio/tabs/BackupsTab';
import { ConsolidateBucketsModal } from './studio/ConsolidateBucketsModal';
import { ExecutionDetails } from './studio/ui/ExecutionDetails';
import { DocumentDetails } from './studio/ui/DocumentDetails';

// Hooks
import { useStudioData } from './studio/hooks/useStudioData';
import { useStudioModals } from './studio/hooks/useStudioModals';
import { useStudioActions } from './studio/hooks/useStudioActions';

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
    activeTools: { [key: string]: boolean };
}

export const Studio: React.FC<StudioProps> = ({ 
    activeProject, projects, databases, buckets, functions, 
    refreshData, onCreateFunction, activeTab, onTabChange, onEditCode, logCallback, activeTools
}) => {
    
    // 1. Initialize Core Logic Hooks
    const studioData = useStudioData(activeProject, activeTab, logCallback);
    const studioModals = useStudioModals();
    const studioActions = useStudioActions(activeProject, studioData, studioModals, refreshData, logCallback);
    
    // 2. Local Feature States
    const [isConsolidateModalOpen, setIsConsolidateModalOpen] = useState(false);

    // 3. Destructure hooks for cleaner prop passing
    const { 
        isLoading: dataLoading, users, teams, 
        selectedDb, setSelectedDb, selectedCollection, setSelectedCollection,
        selectedBucket, setSelectedBucket, selectedFunction, setSelectedFunction,
        selectedTeam, setSelectedTeam,
        collections, documents, attributes, indexes, files, deployments, executions, memberships
    } = studioData;

    const { modal, setFormValues, formValues, modalLoading, closeModal, openCustomModal } = studioModals;

    // Special handlers that need local UI components
    const handleViewExecution = (exec: Models.Execution) => {
        openCustomModal("Execution Details", <ExecutionDetails execution={exec} />, '3xl');
    };

    const handleViewDocument = (doc: Models.Document) => {
        openCustomModal(
            "Document Preview", 
            <DocumentDetails 
                document={doc} 
                onEdit={(d) => { closeModal(); studioActions.handleUpdateDocument(d); }}
                onDelete={(d) => { closeModal(); studioActions.handleDeleteDocument(d); }}
            />, 
            '3xl'
        );
    };

    return (
        <div className="flex flex-col flex-1 h-full overflow-hidden bg-gray-950/20">
            {/* Nav Header */}
            <div className="flex-shrink-0 z-20 py-2 w-full border-b border-white/5 bg-gray-950/10 backdrop-blur-sm">
                 <StudioNavBar activeTab={activeTab} onTabChange={onTabChange} />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 relative custom-scrollbar">
                 {(dataLoading) && (
                    <div className="absolute top-4 right-4 z-10">
                        <LoadingSpinnerIcon />
                    </div>
                 )}
                
                <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-10">
                    {activeTab === 'overview' && (
                        <OverviewTab 
                            activeProject={activeProject}
                            databases={databases} buckets={buckets} functions={functions} 
                            users={users} teams={teams} onTabChange={onTabChange} 
                        />
                    )}

                    {activeTab === 'database' && (
                        <DatabasesTab 
                            activeProject={activeProject}
                            databases={databases} selectedDb={selectedDb} selectedCollection={selectedCollection}
                            collections={collections} documents={documents} attributes={attributes} indexes={indexes}
                            onCreateDatabase={studioActions.handleCreateDatabase} onDeleteDatabase={studioActions.handleDeleteDatabase} onSelectDb={setSelectedDb}
                            onCreateCollection={studioActions.handleCreateCollection} onDeleteCollection={studioActions.handleDeleteCollection} onSelectCollection={setSelectedCollection}
                            onCreateDocument={studioActions.handleCreateDocument} onUpdateDocument={studioActions.handleUpdateDocument} onDeleteDocument={studioActions.handleDeleteDocument}
                            onViewDocument={handleViewDocument}
                            onCreateAttribute={studioActions.handleCreateAttribute} onUpdateAttribute={studioActions.handleUpdateAttribute} onDeleteAttribute={studioActions.handleDeleteAttribute}
                            onCreateIndex={studioActions.handleCreateIndex} onDeleteIndex={studioActions.handleDeleteIndex}
                            onUpdateCollectionSettings={studioActions.handleUpdateCollectionSettings}
                        />
                    )}

                    {activeTab === 'storage' && (
                        <StorageTab 
                            activeProject={activeProject}
                            buckets={buckets} selectedBucket={selectedBucket} files={files}
                            onCreateBucket={studioActions.handleCreateBucket} onDeleteBucket={studioActions.handleDeleteBucket} onSelectBucket={setSelectedBucket}
                            onDeleteFile={studioActions.handleDeleteFile}
                            onConsolidateBuckets={() => setIsConsolidateModalOpen(true)}
                        />
                    )}

                    {activeTab === 'functions' && (
                        <FunctionsTab 
                            activeProject={activeProject}
                            functions={functions} selectedFunction={selectedFunction} 
                            deployments={deployments} executions={executions}
                            onCreateFunction={onCreateFunction} onDeleteFunction={studioActions.handleDeleteFunction} onSelectFunction={setSelectedFunction}
                            onActivateDeployment={studioActions.handleActivateDeployment}
                            onDeleteAllExecutions={studioActions.handleDeleteAllExecutions}
                            onViewExecution={handleViewExecution}
                            onBulkDeleteDeployments={studioActions.handleBulkDeleteDeployments}
                            onCleanupOldDeployments={studioActions.handleCleanupOldDeployments}
                            onEditCode={onEditCode}
                            onRedeployAll={() => studioActions.handleRedeployAllFunctions(functions)}
                            onRedeploy={(func) => studioActions.handleRedeployFunction(func)}
                            onRefresh={() => selectedFunction && studioData.fetchFunctionDetails(selectedFunction.$id)}
                        />
                    )}

                    {activeTab === 'users' && (
                        <UsersTab activeProject={activeProject} users={users} onCreateUser={studioActions.handleCreateUser} onDeleteUser={studioActions.handleDeleteUser} />
                    )}

                    {activeTab === 'teams' && (
                        <TeamsTab 
                            activeProject={activeProject}
                            teams={teams} selectedTeam={selectedTeam} memberships={memberships}
                            onCreateTeam={studioActions.handleCreateTeam} onDeleteTeam={studioActions.handleDeleteTeam} onSelectTeam={setSelectedTeam}
                            onCreateMembership={studioActions.handleCreateMembership} onDeleteMembership={studioActions.handleDeleteMembership}
                        />
                    )}

                    {activeTab === 'migrations' && (
                        <MigrationsTab activeProject={activeProject} projects={projects} />
                    )}

                    {activeTab === 'mcp' && (
                        <McpTab activeProject={activeProject} />
                    )}

                    {activeTab === 'backups' && (
                        <BackupsTab activeProject={activeProject} logCallback={logCallback} />
                    )}
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
                                    if(modal.onConfirm) await modal.onConfirm(modal.type === 'form' ? formValues : undefined);
                                    closeModal();
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
            
            {/* Bulk File Transfer Feature */}
            <ConsolidateBucketsModal 
                isOpen={isConsolidateModalOpen} onClose={() => setIsConsolidateModalOpen(false)}
                buckets={buckets} activeProject={activeProject} projects={projects}
                onSuccess={() => { refreshData(); if (selectedBucket) studioData.fetchFiles(selectedBucket.$id); }}
            />
        </div>
    );
};
