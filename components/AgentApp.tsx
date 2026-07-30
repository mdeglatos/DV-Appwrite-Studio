
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Models } from 'appwrite';
import type { UserPrefs, AppwriteProject, ModelMessage, StudioTab, AppwriteFunction } from '../types';
import { getSdkFunctions } from '../services/appwrite';
import { useRouter, routes, resolveStudioSection } from '../services/router';

// Custom Hooks
import { useProjects } from '../hooks/useProjects';
import { useAppContext } from '../hooks/useAppContext';
import { useSettings } from '../hooks/useSettings';
import { useChatSession } from '../hooks/useChatSession';
import { useCodeMode } from '../hooks/useCodeMode';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useRealtime } from '../hooks/useRealtime';
import { useConfirm } from '../hooks/useConfirm';

// UI Components
import { LeftSidebar } from './LeftSidebar';
import { LogSidebar } from './LogSidebar';
import { CodeViewerSidebar } from './CodeViewerSidebar';
import { CreateFunctionModal } from './CreateFunctionModal';
import { Header } from './Header';
import { ContextBar } from './ContextBar';
import { MainContent } from './MainContent';
import { Footer } from './Footer';
import { DragAndDropOverlay } from './DragAndDropOverlay';
import { Studio } from './Studio';
import { StudioIcon, LoadingSpinnerIcon } from './Icons';
import { ErrorBanner } from './ErrorBanner';

interface AgentAppProps {
    currentUser: Models.User<UserPrefs>;
    onLogout: () => void;
    refreshUser: () => Promise<void>;
}

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 500;

export const AgentApp: React.FC<AgentAppProps> = ({ currentUser, onLogout, refreshUser }) => {
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
    const [isLogSidebarOpen, setIsLogSidebarOpen] = useState(false);
    const [isCreateFunctionModalOpen, setIsCreateFunctionModalOpen] = useState(false);
    const [sessionLogs, setSessionLogs] = useState<string[]>([]);
    
    const { route, navigate } = useRouter();
    const { params } = route;

    const viewMode = route.name.startsWith('studio') ? 'studio' : 'agent';
    
    const resolvedStudioSection = resolveStudioSection(route);
    const activeStudioTab: StudioTab = resolvedStudioSection ?? 'overview';

    /** The landing path for a project in the current view mode. */
    const viewRootPath = (projectId: string) =>
        viewMode === 'studio' ? routes.studioSection(projectId, 'overview') : routes.agent(projectId);

    const setViewMode = (mode: 'agent' | 'studio') => {
        if (!activeProject) return;
        if (mode === 'studio') {
            navigate(routes.studioSection(activeProject.$id, activeStudioTab));
        } else {
            navigate(routes.agent(activeProject.$id));
        }
    };

    const setActiveStudioTab = (tab: StudioTab) => {
        if (!activeProject) return;
        navigate(routes.studioSection(activeProject.$id, tab));
    };

    const confirm = useConfirm();

    const logCallback = useCallback((log: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setSessionLogs(prev => [...prev, `[${timestamp}] ${log}`]);
    }, []);

    const {
        projects, activeProject, handleSaveProject, handleUpdateProject, handleDeleteProject, handleSelectProject,
        error: projectError, isLoading: isProjectsLoading
    } = useProjects(currentUser, refreshUser, logCallback, params.projectId);

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

    // Initialize Realtime WebSocket connection for the active project
    const realtime = useRealtime(activeProject);

    const {
        databases, collections, buckets, functions,
        selectedDatabase, selectedCollection, selectedBucket, selectedFunction,
        setSelectedDatabase, setSelectedCollection, setSelectedBucket, setSelectedFunction,
        isContextLoading, error: contextError, refreshContextData,
        handleRealtimeEvent: handleContextRealtimeEvent,
    } = useAppContext(activeProject, logCallback, params, navigate, viewMode === 'agent');

    // Wire realtime events to useAppContext's handler
    useEffect(() => {
        if (!realtime.isConnected) return;
        const cleanup = realtime.addEventListener(handleContextRealtimeEvent);
        return cleanup;
    }, [realtime.isConnected, realtime.addEventListener, handleContextRealtimeEvent]);

    const isCodeViewerSidebarOpen = route.name === 'studio_function_code' || route.name === 'agent_function_code';

    const setIsCodeViewerSidebarOpen = useCallback((open: boolean) => {
        if (!activeProject || !selectedFunction) return;
        const isStudio = route.name.startsWith('studio');
        if (open) {
            navigate(isStudio
                ? routes.studioFunctionCode(activeProject.$id, selectedFunction.$id)
                : routes.agentFunctionCode(activeProject.$id, selectedFunction.$id));
        } else {
            navigate(isStudio
                ? routes.studioFunction(activeProject.$id, selectedFunction.$id)
                : routes.agentFunction(activeProject.$id, selectedFunction.$id));
        }
    }, [activeProject?.$id, selectedFunction?.$id, route.name, navigate]);

    const {
        isFunctionContextLoading, functionFiles, editedFunctionFiles,
        isDeploying,
        handleCodeGenerated, handleFileContentChange,
        handleFileAdd, handleFileDelete, handleFileRename, handleDeployChanges,
        error: codeModeError,
        codeModeEvent, clearCodeModeEvent,
    } = useCodeMode(activeProject, selectedFunction, logCallback, isCodeViewerSidebarOpen, setIsCodeViewerSidebarOpen);

    // Redirect / or /projects to active project
    useEffect(() => {
        if (route.name === 'root' || route.name === 'projects') {
            if (activeProject) {
                navigate(viewRootPath(activeProject.$id), { replace: true });
            } else if (projects.length > 0) {
                navigate(viewRootPath(projects[0].$id), { replace: true });
            }
        }
    }, [route.name, activeProject?.$id, projects, viewMode, navigate]);

    // An unknown studio group/section can never reach a render — send it to Overview.
    useEffect(() => {
        if (viewMode !== 'studio' || resolvedStudioSection !== null) return;
        const projectId = activeProject?.$id ?? params.projectId;
        if (!projectId) return;
        navigate(routes.studioSection(projectId, 'overview'), { replace: true });
    }, [viewMode, resolvedStudioSection, activeProject?.$id, params.projectId, navigate]);
    
    const {
        messages, setMessages, isLoading, error: chatError,
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

    // Confirmation flows — routed through the app-wide confirmation owner.
    const requestProjectDeletion = useCallback(async (projectId: string, projectName: string) => {
        const confirmed = await confirm({
            title: `Delete Project "${projectName}"?`,
            message: 'This action is irreversible.',
            confirmText: 'Delete Project',
        });
        if (confirmed) handleDeleteProject(projectId);
    }, [confirm, handleDeleteProject]);

    const requestFileDelete = useCallback(async (path: string, type: 'file' | 'folder') => {
        const confirmed = await confirm({
            title: `Delete ${type} "${path}"?`,
            message: 'This action is irreversible.',
            confirmText: `Delete ${type}`,
        });
        if (confirmed) handleFileDelete(path, type);
    }, [confirm, handleFileDelete]);
    
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
                onSelect={(p: AppwriteProject) => { navigate(viewRootPath(p.$id)); if (window.innerWidth < 768) { setIsLeftSidebarOpen(false); } }}
                activeTools={activeTools} onToolsChange={handleToolsChange}
                geminiApiKey={geminiApiKey} geminiModel={geminiModel} geminiModels={GEMINI_MODELS}
                geminiThinkingEnabled={geminiThinkingEnabled} onSaveGeminiSettings={handleSaveGeminiSettings}
                width={isLeftSidebarOpen ? currentSidebarWidth : 0} 
                isResizing={isResizing} 
                onResizeStart={handleResizeMouseDown}
                viewMode={viewMode}
                activeStudioSection={activeStudioTab}
                onStudioSectionChange={setActiveStudioTab}
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
                    realtimeStatus={realtime.status}
                />

                {/* A failed project load or a CORS/connection failure is a
                    property of the app shell, not of the Agent view — it used to
                    be inlined in MainContent and so was invisible in the Studio. */}
                {error && <ErrorBanner message={error} />}

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
                                isFunctionContextLoading={isFunctionContextLoading}
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
                         {isProjectsLoading && !activeProject ? (
                             <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-3">
                                <LoadingSpinnerIcon size={32} className="text-cyan-400 animate-spin" />
                                <p className="text-gray-400 text-sm">Loading projects…</p>
                            </div>
                        ) : activeProject ? (
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
                                realtimeHook={realtime}
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
