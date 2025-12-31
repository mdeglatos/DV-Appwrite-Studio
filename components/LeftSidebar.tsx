
import React, { useState, useEffect, useCallback } from 'react';
import type { AppwriteProject, StudioTab } from '../types';
import type { NewAppwriteProject } from '../services/projectService';
import { 
    AddIcon, DeleteIcon, CloseIcon, ToolsIcon, ProjectsIcon, ChevronDownIcon, 
    KeyIcon, SettingsIcon, DashboardIcon, DatabaseIcon, StorageIcon, 
    FunctionIcon, TeamIcon, EditIcon, WarningIcon, BackupIcon,
    RiShareForwardLine
} from './Icons';
import { ToolConfiguration } from './studio/ui/ToolConfiguration';
import { Modal } from './Modal';

// Sub-component for a single tool toggle switch (kept for local form inputs if needed, but primary tools use shared component)
const ToolToggle: React.FC<{
    label: string;
    isChecked: boolean;
    onChange: (isChecked: boolean) => void;
}> = ({ label, isChecked, onChange }) => {
    const id = `toggle-${label}`;
    return (
        <label htmlFor={id} className="flex items-center justify-between cursor-pointer px-3 py-2 rounded-md hover:bg-white/5 transition-colors group">
            <span className="text-xs text-gray-400 capitalize group-hover:text-gray-200 transition-colors">{label}</span>
            <div className="relative">
                <input id={id} type="checkbox" className="sr-only peer" checked={isChecked} onChange={(e) => onChange(e.target.checked)} />
                <div className="w-8 h-4 bg-gray-700/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600/50 peer-checked:after:bg-white"></div>
            </div>
        </label>
    );
};

// Sub-component for a collapsible section
interface CollapsibleSectionProps {
    title: React.ReactNode;
    icon: React.ReactNode;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    badge?: React.ReactNode;
    className?: string;
    transparent?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon, isExpanded, onToggle, children, badge, className = '', transparent = false }) => (
    <div className={` ${transparent ? '' : 'border-b border-gray-800/30'} ${className}`}>
        <button
            onClick={onToggle}
            className="w-full flex justify-between items-center px-4 py-3 text-left hover:bg-gray-800/30 transition-colors focus:outline-none"
            aria-expanded={isExpanded}
        >
            <div className="flex items-center gap-3 text-gray-400 group">
                <span className="text-gray-500 group-hover:text-cyan-400 transition-colors">{icon}</span>
                <h3 className="text-xs font-semibold uppercase tracking-wider group-hover:text-gray-200 transition-colors">{title}</h3>
                {badge}
            </div>
            <div className={`text-gray-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDownIcon size={14} />
            </div>
        </button>
        <div
            className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        >
            <div className="overflow-hidden">
                <div className="pb-4 px-3">
                    {children}
                </div>
            </div>
        </div>
    </div>
);

interface LeftSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: AppwriteProject[];
  activeProject: AppwriteProject | null;
  onSave: (projectData: NewAppwriteProject) => void;
  onDelete: (projectId: string, projectName: string) => void;
  onEdit: (project: AppwriteProject) => void;
  onSelect: (project: AppwriteProject) => void;
  activeTools: { [key: string]: boolean };
  onToolsChange: (tools: { [key: string]: boolean }) => void;
  geminiApiKey: string | null;
  geminiModel: string;
  geminiModels: string[];
  geminiThinkingEnabled: boolean;
  onSaveGeminiSettings: (settings: { apiKey: string, model: string, thinkingEnabled: boolean }) => Promise<void>;
  width: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  
  viewMode: 'agent' | 'studio';
  activeStudioTab: StudioTab;
  onStudioTabChange: (tab: StudioTab) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isOpen,
  onClose,
  projects,
  activeProject,
  onSave,
  onDelete,
  onEdit,
  onSelect,
  activeTools,
  onToolsChange,
  geminiApiKey,
  geminiModel,
  geminiModels,
  geminiThinkingEnabled,
  onSaveGeminiSettings,
  width,
  isResizing,
  onResizeStart,
  viewMode,
  activeStudioTab,
  onStudioTabChange
}) => {
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [thinkingInput, setThinkingInput] = useState(true);
  
  const [expandedSections, setExpandedSections] = useState({
    projects: true,
    tools: true,
    gemini: false,
    addProject: false,
    studioNav: true,
  });

  const [editingProject, setEditingProject] = useState<AppwriteProject | null>(null);

  useEffect(() => {
    setApiKeyInput(geminiApiKey || '');
    setModelInput(geminiModel || '');
    setThinkingInput(geminiThinkingEnabled);
  }, [geminiApiKey, geminiModel, geminiThinkingEnabled]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !endpoint || !projectId || !apiKey) return;
    const projectData: NewAppwriteProject = {
      name,
      endpoint,
      projectId,
      apiKey,
    };
    onSave(projectData);
    setName('');
    setEndpoint('');
    setProjectId('');
    setApiKey('');
    setExpandedSections(prev => ({ ...prev, addProject: false, projects: true }));
  };

  const handleUpdateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
        onEdit(editingProject);
        setEditingProject(null);
    }
  };
  
  const hasGeminiSettingsChanged = (apiKeyInput.trim() !== (geminiApiKey || '')) || (modelInput !== geminiModel) || (thinkingInput !== geminiThinkingEnabled);
  
  const handleSaveGeminiSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!hasGeminiSettingsChanged) return;
      await onSaveGeminiSettings({ apiKey: apiKeyInput, model: modelInput, thinkingEnabled: thinkingInput });
      setExpandedSections(prev => ({ ...prev, gemini: false }));
  };

  const handleResetGeminiSettings = () => {
    setApiKeyInput(geminiApiKey || '');
    setModelInput(geminiModel || '');
    setThinkingInput(geminiThinkingEnabled);
  };

  const studioTabs: { id: StudioTab, label: string, icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <DashboardIcon /> },
    { id: 'database', label: 'Databases', icon: <DatabaseIcon /> },
    { id: 'storage', label: 'Storage', icon: <StorageIcon /> },
    { id: 'functions', label: 'Functions', icon: <FunctionIcon /> },
    { id: 'users', label: 'Auth & Users', icon: <TeamIcon /> },
    { id: 'teams', label: 'Teams', icon: <TeamIcon /> },
    { id: 'migrations', label: 'Migrations', icon: <RiShareForwardLine /> },
    { id: 'backups', label: 'Backups', icon: <BackupIcon /> },
  ];

  const closeEditingModal = useCallback(() => {
    setEditingProject(null);
  }, []);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/80 z-20 transition-opacity md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        style={{
          width: isOpen ? `${width}px` : '0px',
        }}
        className={`
          flex flex-col
          transition-[width] duration-300 ease-in-out flex-shrink-0
          fixed md:relative inset-y-0 left-0 z-30 md:z-auto
          ${isResizing ? 'transition-none select-none' : ''}
          ${isOpen ? 'mr-0' : 'mr-0 overflow-hidden'}
        `}
      >
        <div className="flex flex-col h-full w-full overflow-hidden bg-gray-900/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl relative">
            {/* Header within sidebar for mobile or branding */}
            <div className="p-4 md:hidden border-b border-gray-800 flex justify-between items-center">
                <span className="font-bold text-gray-100">Menu</span>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <CloseIcon />
                </button>
            </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* PROJECTS SECTION - Always Visible */}
            <CollapsibleSection
              title="Projects"
              icon={<ProjectsIcon />}
              isExpanded={expandedSections.projects}
              onToggle={() => toggleSection('projects')}
              badge={
                projects.length > 0 && <span className="bg-gray-800 text-gray-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-700">{projects.length}</span>
              }
            >
              <ul className="space-y-1">
                {projects.length === 0 && (
                   <div className="text-center p-6 text-xs text-gray-600 border border-dashed border-gray-800 rounded-lg">
                        No projects found.
                   </div>
                )}
                {projects.map(p => (
                  <li
                    key={p.$id}
                    onClick={() => onSelect(p)}
                    className={`group flex items-center justify-between gap-2 p-2 rounded-lg transition-all cursor-pointer border border-transparent ${
                      activeProject?.$id === p.$id
                        ? 'bg-cyan-950/40 border-cyan-500/30 shadow-sm text-cyan-200'
                        : 'hover:bg-gray-800/50 hover:border-gray-700/50 text-gray-400'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate transition-colors ${activeProject?.$id === p.$id ? 'text-cyan-300' : 'group-hover:text-gray-200'}`}>{p.name}</p>
                      <p className="text-[10px] text-gray-600 truncate font-mono mt-0.5">{p.projectId}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setEditingProject(p); }}
                            className="text-gray-600 hover:text-cyan-400 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-800"
                            aria-label={`Edit ${p.name}`}
                        >
                            <EditIcon size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(p.$id, p.name); }}
                            className="text-gray-600 hover:text-red-400 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-800"
                            aria-label={`Delete ${p.name}`}
                        >
                            <DeleteIcon />
                        </button>
                    </div>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>

            {/* STUDIO MODE NAVIGATION */}
            {viewMode === 'studio' && (
                <CollapsibleSection
                    title="Studio Navigation"
                    icon={<DashboardIcon />}
                    isExpanded={expandedSections.studioNav}
                    onToggle={() => toggleSection('studioNav')}
                >
                     <nav className="space-y-1">
                        {studioTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => onStudioTabChange(tab.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                                    activeStudioTab === tab.id 
                                    ? 'bg-purple-900/30 text-purple-300 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]' 
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 border border-transparent'
                                }`}
                            >
                                <span className={activeStudioTab === tab.id ? 'text-purple-400' : 'text-gray-500'}>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </CollapsibleSection>
            )}

            {/* AGENT MODE TOOLS & SETTINGS - Using Shared Component */}
            {viewMode === 'agent' && (
                <>
                    <CollapsibleSection
                        title="Tools"
                        icon={<ToolsIcon />}
                        isExpanded={expandedSections.tools}
                        onToggle={() => toggleSection('tools')}
                    >
                        <ToolConfiguration 
                            activeTools={activeTools} 
                            onToolsChange={onToolsChange} 
                        />
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="Configuration"
                        icon={<SettingsIcon />}
                        isExpanded={expandedSections.gemini}
                        onToggle={() => toggleSection('gemini')}
                    >
                        <form onSubmit={handleSaveGeminiSettings} className="flex flex-col gap-4">
                            <div>
                            <label htmlFor="gemini-model-select" className="text-[10px] font-semibold text-gray-500 mb-1.5 block uppercase tracking-wider">Model</label>
                            <div className="relative">
                                <select
                                    id="gemini-model-select"
                                    value={modelInput}
                                    onChange={e => setModelInput(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-700 text-gray-300 text-xs rounded-lg focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 block p-2 appearance-none outline-none"
                                >
                                    {geminiModels.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                    <ChevronDownIcon size={14} />
                                </div>
                            </div>
                            </div>

                            {modelInput === 'gemini-2.5-flash' && (
                                <div className="bg-gray-900/50 p-1.5 rounded-lg border border-gray-800">
                                    <ToolToggle
                                        label="Deep Thinking"
                                        isChecked={thinkingInput}
                                        onChange={setThinkingInput}
                                    />
                                </div>
                            )}

                            <div>
                            <label htmlFor="gemini-api-key-input" className="text-[10px] font-semibold text-gray-500 mb-1.5 block uppercase tracking-wider">API Key Override</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600"><KeyIcon /></span>
                                <input 
                                    id="gemini-api-key-input"
                                    type="password" 
                                    value={apiKeyInput} 
                                    onChange={e => setApiKeyInput(e.target.value)} 
                                    placeholder="Use system default" 
                                    className="bg-gray-900/50 border border-gray-700 text-gray-300 text-xs rounded-lg focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 block w-full pl-9 p-2 placeholder-gray-700 outline-none" 
                                />
                            </div>
                            </div>
                            
                            <div className="flex gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={handleResetGeminiSettings}
                                    disabled={!hasGeminiSettingsChanged}
                                    className="flex-1 py-1.5 px-3 text-xs font-medium text-gray-400 bg-gray-800 rounded-lg hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
                                >
                                    Reset
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-1.5 px-3 text-xs font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-500 shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50 disabled:shadow-none"
                                    disabled={!hasGeminiSettingsChanged}
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </CollapsibleSection>
                </>
            )}
          </div>

          <div className="p-3 bg-gray-950/30 border-t border-gray-800/30">
             <CollapsibleSection
                title="New Project"
                icon={<AddIcon />}
                isExpanded={expandedSections.addProject}
                onToggle={() => toggleSection('addProject')}
                className="border-none"
                transparent
            >
                <div className="mb-4 p-2.5 bg-yellow-900/20 border border-yellow-700/50 rounded-xl text-[10px] text-yellow-200/80 space-y-1.5 animate-fade-in">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-yellow-500">
                        <WarningIcon size={12} /> Connection Tip
                    </div>
                    <p>To avoid "Failed to fetch", add this origin to your Appwrite Web Platforms:</p>
                    <div className="bg-black/40 p-1.5 rounded font-mono text-[9px] select-all border border-black/20 truncate">
                        {window.location.origin}
                    </div>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-2.5">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Project Name" className="bg-gray-900/50 border border-gray-700 text-gray-200 text-xs rounded-lg focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 block w-full p-2 placeholder-gray-600 outline-none" required />
                    <input type="url" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="Endpoint (with /v1)" className="bg-gray-900/50 border border-gray-700 text-gray-200 text-xs rounded-lg focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 block w-full p-2 placeholder-gray-600 outline-none" required />
                    <input type="text" value={projectId} onChange={e => setProjectId(e.target.value)} placeholder="Project ID" className="bg-gray-900/50 border border-gray-700 text-gray-200 text-xs rounded-lg focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 block w-full p-2 placeholder-gray-600 font-mono outline-none" required />
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key" className="bg-gray-900/50 border border-gray-700 text-gray-200 text-xs rounded-lg focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 block w-full p-2 placeholder-gray-600 font-mono outline-none" required />
                    <button type="submit" className="w-full mt-1 py-2 px-3 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-colors flex justify-center items-center gap-2 shadow-lg shadow-cyan-900/20">
                        <AddIcon />
                        Create
                    </button>
                </form>
            </CollapsibleSection>
          </div>
        </div>
        
        {/* Resizer */}
        {isOpen && (
            <div
                onMouseDown={onResizeStart}
                className="hidden md:block absolute top-0 -right-6 h-full w-6 cursor-col-resize z-50 select-none"
            />
        )}
      </aside>

      {/* Edit Project Modal */}
      {editingProject && (
          <Modal isOpen={!!editingProject} onClose={closeEditingModal} title="Edit Project">
               <div className="mb-4 p-3 bg-cyan-900/20 border border-cyan-700/50 rounded-xl text-xs text-cyan-200">
                    <p className="font-bold mb-1">CORS Troubleshoot:</p>
                    <p className="opacity-80">If you see "Failed to fetch", ensure <strong>{window.location.origin}</strong> is allowed in your Appwrite Dashboard under Settings &gt; Platforms.</p>
               </div>
               <form onSubmit={handleUpdateProjectSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Project Name</label>
                        <input type="text" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none" required />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Endpoint URL</label>
                        <input type="url" value={editingProject.endpoint} onChange={e => setEditingProject({...editingProject, endpoint: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none" required />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Project ID</label>
                        <input type="text" value={editingProject.projectId} onChange={e => setEditingProject({...editingProject, projectId: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 font-mono focus:ring-1 focus:ring-cyan-500 outline-none" required />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">API Key</label>
                        <input type="password" value={editingProject.apiKey} onChange={e => setEditingProject({...editingProject, apiKey: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 font-mono focus:ring-1 focus:ring-cyan-500 outline-none" required />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={closeEditingModal} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-cyan-900/20">Save Changes</button>
                    </div>
               </form>
          </Modal>
      )}
    </>
  );
};
