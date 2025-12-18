
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Models } from 'appwrite';
import type { UserPrefs, AppwriteProject, ModelMessage, StudioTab, AppwriteFunction } from '../types';
import { getSdkFunctions } from '../services/appwrite';

// Custom Hooks
import { useProjects } from '../hooks/useProjects';
import { useAppContext } from '../hooks/useAppContext';
import { useSettings } from '../hooks/useSettings';
import { useChatSession } from '../hooks/useChatSession';
import { useCodeMode } from '../hooks/useCodeMode';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

// UI Components
import { LeftSidebar } from './LeftSidebar';
import { LogSidebar } from './LogSidebar';
import { CodeViewerSidebar } from './CodeViewerSidebar';
import { ConfirmationModal } from './ConfirmationModal';
import { CreateFunctionModal } from './CreateFunctionModal';
import { Header } from './Header';
import { ContextBar } from './ContextBar';
import { MainContent } from './MainContent';
import { Footer } from './Footer';
import { DragAndDropOverlay } from './DragAndDropOverlay';
import { Studio } from './Studio';
import { StudioIcon } from './Icons';

interface AgentAppProps {
    currentUser: Models.User<UserPrefs>;
    onLogout: () => void;
    refreshUser: () => Promise<void>;
}

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 500;
const VIEW_MODE_STORAGE_KEY = 'dv_appwrite_view_mode';

export const AgentApp: React.FC<AgentAppProps> = ({ currentUser, onLogout, refreshUser }) => {
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
    const [isLogSidebarOpen, setIsLogSidebarOpen] = useState(false);
    const [isCreateFunctionModalOpen, setIsCreateFunctionModalOpen] = useState(false);
    const [sessionLogs, setSessionLogs] = useState<string[]>([]);
    
    const [viewMode, setViewModeState] = useState<'agent' | 'studio'>(() => {
        const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
        return (saved === 'agent' || saved === 'studio') ? saved : 'agent';
    });
    
    const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('overview');

    const setViewMode = (mode: 'agent' | 'studio') => {
        setViewModeState(mode);
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    };
    
    const [confirmationState, setConfirmationState] = useState<{
        isOpen: boolean; title: string; message: string; confirmText: string; confirmButtonClass: string; onConfirm: () => void;
    } | null>(null);

    const logCallback = useCallback((log: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setSessionLogs(prev => [...prev, `[${timestamp}] ${log}`]);
    }, []);

    const {
        projects, activeProject, handleSaveProject, handleUpdateProject, handleDeleteProject, handleSelectProject,
        error: projectError, setError: setProjectError
    } = useProjects(currentUser, refreshUser, logCallback);

    const {
        activeTools, handleToolsChange,
        geminiApiKey, geminiModel, GEMINI_MODELS, geminiThinkingEnabled, handleSaveGeminiSettings,
        sidebarWidth, handleSidebarWidthChange
    } = useSettings(currentUser, refreshUser, logCallback);
    
    const [currentSidebarWidth, setCurrentSidebarWidth] = useState(sidebarWidth);
    const [isResizing, setIsResizing] = useState(false);

    const widthRef = useRef(currentSidebarWidth);
    useEffect(() => {
        widthRef.current = currentSidebarWidth;
    }, [currentSidebarWidth]);

    useEffect(() => {
        if (!isResizing) {
            setCurrentSidebarWidth(sidebarWidth);
        }
    }, [sidebarWidth]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        if (!isResizing) {
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = e.clientX;
            const constrainedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH));
            setCurrentSidebarWidth(constrainedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            handleSidebarWidthChange(widthRef.current);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleSidebarWidthChange]);

    const {
        databases, collections, buckets, functions,
        selectedDatabase, selectedCollection, selectedBucket, selectedFunction,
        setSelectedDatabase, setSelectedCollection, setSelectedBucket, setSelectedFunction,
        isContextLoading, error: contextError, setError: setContextError, refreshContextData,
    } = useAppContext(activeProject, logCallback);

    const {
        isFunctionContextLoading, functionFiles, editedFunctionFiles,
        isCodeViewerSidebarOpen, isDeploying, setIsCodeViewerSidebarOpen,
        handleCodeGenerated, handleFileContentChange,
        handleFileAdd, handleFileDelete, handleFileRename, handleDeployChanges,
        error: codeModeError, setError: setCodeModeError,
        codeModeEvent, clearCodeModeEvent,
    } = useCodeMode(activeProject, selectedFunction, logCallback);
    
    const {
        messages, setMessages, isLoading, error: chatError, setError: setChatError,
        selectedFiles, handleSendMessage, handleClearChat, handleFileSelect
    } = useChatSession({
        activeProject, selectedDatabase, selectedCollection, selectedBucket, selectedFunction,
        activeTools, geminiModel, geminiThinkingEnabled, geminiApiKey, logCallback,
        onCodeGenerated: handleCodeGenerated,
    });
    
    useEffect(() => {
        if (codeModeEvent) {
            const modelMessage: ModelMessage = {
                id: crypto.randomUUID(), role: 'model', content: codeModeEvent.message,
            };
            setMessages(prev => [...prev, modelMessage]);
            clearCodeModeEvent();
        }
    }, [codeModeEvent, setMessages, clearCodeModeEvent]);

    const error = projectError || contextError || chatError || codeModeError;
    const setError = useCallback((msg: string | null) => {
        setProjectError(msg);
        setContextError(msg);
        setChatError(msg);
        setCodeModeError(msg);
    }, [setProjectError, setContextError, setChatError, setCodeModeError]);

    // Confirmation Modals Logic
    const requestProjectDeletion = useCallback((projectId: string, projectName: string) => {
        setConfirmationState({
            isOpen: true, title: `Delete Project "${projectName}"?`, message: 'This action is irreversible.',
            confirmText: 'Delete Project', confirmButtonClass: 'bg-red-600 hover:bg-red-700',
            onConfirm: () => { handleDeleteProject(projectId); setConfirmationState(null); },
        });
    }, [handleDeleteProject]);
    
    const requestFileDelete = useCallback((path: string, type: 'file' | 'folder') => {
        setConfirmationState({
            isOpen: true, title: `Delete ${type} "${path}"?`, message: `This action is irreversible.`,
            confirmText: `Delete ${type}`, confirmButtonClass: 'bg-red-600 hover:bg-red-700',
            onConfirm: () => { handleFileDelete(path, type); setConfirmationState(null); },
        });
    }, [handleFileDelete]);
    
    const handleFunctionCreated = useCallback(async (functionId: string) => {
        if (!activeProject) return;
        await refreshContextData();
        try {
            const sdkFunctions = getSdkFunctions(activeProject);
            const newFunc = await sdkFunctions.get(functionId);
            setSelectedFunction(newFunc as unknown as AppwriteFunction);
            setIsCodeViewerSidebarOpen(true);
            logCallback(`Function "${newFunc.name}" created and selected.`);
        } catch (e) {
            console.error("Could not fetch newly created function details.", e);
        }
    }, [activeProject, refreshContextData, setSelectedFunction, logCallback, setIsCodeViewerSidebarOpen]);

    const { isDragging, ...dragHandlers } = useDragAndDrop(handleFileSelect);
    
    const isChatDisabled = isLoading || !activeProject || isFunctionContextLoading || isDeploying;
    const hasUnsavedCodeChanges = functionFiles && editedFunctionFiles ? JSON.stringify(functionFiles) !== JSON.stringify(editedFunctionFiles) : false;

    return (
        <div className="flex h-screen overflow-hidden text-gray-100 font-sans p-6 gap-6">
             <LeftSidebar
                isOpen={isLeftSidebarOpen} onClose={() => setIsLeftSidebarOpen(false)}
                projects={projects} activeProject={activeProject} onSave={handleSaveProject}
                onDelete={requestProjectDeletion} onEdit={handleUpdateProject} 
                onSelect={(p: AppwriteProject) => { handleSelectProject(p); if (window.innerWidth < 768) { setIsLeftSidebarOpen(false); } }}
                activeTools={activeTools} onToolsChange={handleToolsChange}
                geminiApiKey={geminiApiKey} geminiModel={geminiModel} geminiModels={GEMINI_MODELS}
                geminiThinkingEnabled={geminiThinkingEnabled} onSaveGeminiSettings={handleSaveGeminiSettings}
                width={isLeftSidebarOpen ? currentSidebarWidth : 0} 
                isResizing={isResizing} 
                onResizeStart={handleResizeMouseDown}
                viewMode={viewMode}
                activeStudioTab={activeStudioTab}
                onStudioTabChange={setActiveStudioTab}
            />
            
            {/* Main Canvas - Flex Column Layout */}
            <div className="flex flex-1 flex-col min-w-0 h-full transition-all duration-300 rounded-2xl overflow-hidden bg-gray-950/20 backdrop-blur-sm border border-white/5 shadow-2xl" {...dragHandlers}>
                
                {/* 1. Header (Static) */}
                <Header
                    isLeftSidebarOpen={isLeftSidebarOpen} setIsLeftSidebarOpen={setIsLeftSidebarOpen}
                    activeProject={activeProject} currentUser={currentUser} onLogout={onLogout}
                    messages={messages} handleClearChat={handleClearChat}
                    selectedFunction={selectedFunction} isCodeViewerSidebarOpen={isCodeViewerSidebarOpen}
                    setIsCodeViewerSidebarOpen={setIsCodeViewerSidebarOpen} setIsLogSidebarOpen={setIsLogSidebarOpen}
                    viewMode={viewMode} setViewMode={setViewMode}
                />
                
                {viewMode === 'agent' ? (
                    <>
                        {/* 2. Context Bar (Static) */}
                        {activeProject && (
                            <ContextBar 
                                databases={databases} collections={collections} buckets={buckets} functions={functions}
                                selectedDatabase={selectedDatabase} selectedCollection={selectedCollection}
                                selectedBucket={selectedBucket} selectedFunction={selectedFunction}
                                onDatabaseSelect={setSelectedDatabase} onCollectionSelect={setSelectedCollection}
                                onBucketSelect={setSelectedBucket} onFunctionSelect={setSelectedFunction}
                                isLoading={isContextLoading} onRefresh={refreshContextData}
                                onAddFunction={() => setIsCreateFunctionModalOpen(true)}
                            />
                        )}
                        
                        {/* 3. Main Content (Scrollable, fills remaining space) */}
                        <div className="flex-1 flex flex-col min-h-0 relative">
                            <MainContent
                                messages={messages} activeProject={activeProject}
                                selectedFunction={selectedFunction}
                                isFunctionContextLoading={isFunctionContextLoading} error={error}
                                currentUser={currentUser} isLeftSidebarOpen={isLeftSidebarOpen} setIsLeftSidebarOpen={setIsLeftSidebarOpen}
                            />
                        </div>

                        {/* 4. Footer (Static) */}
                        <Footer
                            onSubmit={handleSendMessage} selectedFiles={selectedFiles}
                            onFileSelect={handleFileSelect} isLoading={isLoading}
                            isDisabled={isChatDisabled} activeProject={activeProject}
                        />
                    </>
                ) : (
                    // Studio View
                    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/40">
                         {activeProject ? (
                            <Studio 
                                activeProject={activeProject} 
                                projects={projects}
                                databases={databases} 
                                buckets={buckets} 
                                functions={functions}
                                refreshData={refreshContextData}
                                onCreateFunction={() => setIsCreateFunctionModalOpen(true)}
                                activeTab={activeStudioTab}
                                onTabChange={setActiveStudioTab}
                                onEditCode={(func) => {
                                    setSelectedFunction(func);
                                    setIsCodeViewerSidebarOpen(true);
                                }}
                                logCallback={logCallback}
                            />
                        ) : (
                             <div className="flex flex-col items-center justify-center h-full text-center p-8 overflow-y-auto">
                                <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mb-4 text-gray-600 border border-gray-700/50">
                                    <StudioIcon />
                                </div>
                                <h2 className="text-xl font-bold text-gray-300">No Project Selected</h2>
                                <p className="text-gray-500 mt-2">Select a project from the sidebar to access the Studio controls.</p>
                            </div>
                        )}
                    </div>
                )}

                <DragAndDropOverlay isDragging={isDragging} />
            </div>

            <CodeViewerSidebar
                isOpen={isCodeViewerSidebarOpen} onClose={() => setIsCodeViewerSidebarOpen(false)}
                files={editedFunctionFiles || []} originalFiles={functionFiles || []}
                functionName={selectedFunction?.name || '...'}
                onFileContentChange={handleFileContentChange} onDeploy={handleDeployChanges}
                isDeploying={isDeploying} hasUnsavedChanges={hasUnsavedCodeChanges}
                onFileAdd={handleFileAdd} onFileDelete={requestFileDelete} onFileRename={handleFileRename}
            />
            <LogSidebar isOpen={isLogSidebarOpen} onClose={() => setIsLogSidebarOpen(false)} logs={sessionLogs} onClear={() => setSessionLogs([])} />

            {confirmationState?.isOpen && (
                <ConfirmationModal {...confirmationState} onClose={() => setConfirmationState(null)} />
            )}
            
            {activeProject && (
                <CreateFunctionModal 
                    isOpen={isCreateFunctionModalOpen} 
                    onClose={() => setIsCreateFunctionModalOpen(false)} 
                    project={activeProject}
                    onSuccess={handleFunctionCreated}
                />
            )}
        </div>
    );
};
