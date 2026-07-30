
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { UnpackedFile } from '../tools/functionsTools';
import { CloseIcon, CopyIcon, FileIcon, CheckIcon, CodeIcon, LoadingSpinnerIcon, FolderIcon, FileAddIcon, FolderAddIcon, EditIcon, DeleteIcon, ChevronDownIcon } from './Icons';

interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: { [key: string]: TreeNode };
}

const buildFileTree = (files: UnpackedFile[]): TreeNode => {
    const root: TreeNode = { name: 'root', path: '', type: 'folder', children: {} };
    for (const file of files) {
        const parts = file.name.split('/');
        let currentNode = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!currentNode.children) currentNode.children = {};
            if (!currentNode.children[part]) {
                const isFile = i === parts.length - 1;
                currentNode.children[part] = {
                    name: part,
                    path: parts.slice(0, i + 1).join('/'),
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : {},
                };
            }
            currentNode = currentNode.children[part];
        }
    }
    return root;
};

interface FileTreeItemProps {
    node: TreeNode;
    level: number;
    activeFilePath: string | null;
    onFileSelect: (path: string) => void;
    originalFiles: UnpackedFile[];
    editedFiles: UnpackedFile[];
    onFileAdd: (path: string) => void;
    onFileDelete: (path: string, type: 'file' | 'folder') => void;
    onFileRename: (oldPath: string, newPath: string, type: 'file' | 'folder') => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level, activeFilePath, onFileSelect, originalFiles, editedFiles, onFileAdd, onFileDelete, onFileRename }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isRenaming || isCreating) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isRenaming, isCreating]);

    if (!node) return null;

    const hasChanged = useMemo(() => {
        if (node.type === 'file') {
            const original = originalFiles.find(f => f.name === node.path)?.content;
            const edited = editedFiles.find(f => f.name === node.path)?.content;
            return original !== edited;
        }
        return false;
    }, [node.path, node.type, originalFiles, editedFiles]);

    const handleRenameSubmit = (newName: string) => {
        setIsRenaming(false);
        if (newName && newName !== node.name) {
            const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;
            onFileRename(node.path, newPath, node.type);
        }
    };

    const handleCreateSubmit = (newName: string) => {
        if (newName && isCreating) {
            const newPath = node.path ? `${node.path}/${newName}` : newName;
            if (isCreating === 'file') onFileAdd(newPath);
            else onFileAdd(`${newPath}/.gitkeep`);
        }
        setIsCreating(null);
    };

    const renderInput = (defaultValue: string, onConfirm: (value: string) => void) => (
        <div className="pl-4 pr-2 py-1" style={{ paddingLeft: `${level * 12 + 20}px`}}>
            <div className="flex items-center gap-1.5">
                 {isCreating === 'folder' || node.type === 'folder' ? <FolderIcon size={14} /> : <FileIcon size={14} />}
                <input
                    ref={inputRef}
                    type="text"
                    defaultValue={defaultValue}
                    className="w-full bg-gray-700 text-gray-100 text-xs p-1 rounded border border-cyan-500/50 outline-none"
                    onBlur={(e) => onConfirm(e.target.value)}
                    onKeyDown={(e) => { 
                        if (e.key === 'Enter') { e.preventDefault(); onConfirm(e.currentTarget.value); } 
                        else if (e.key === 'Escape') { setIsRenaming(false); setIsCreating(null); } 
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </div>
    );
    
    if (isRenaming) return renderInput(node.name, handleRenameSubmit);

    const children = node.children ? Object.values(node.children).sort((a: TreeNode, b: TreeNode) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
    }) : [];

    return (
        <div>
            <div
                className={`group flex items-center justify-between px-2 py-1 cursor-pointer border-l-2 border-transparent hover:bg-gray-800 ${activeFilePath === node.path ? 'bg-gray-800/80 border-purple-500 text-white' : 'text-gray-400'}`}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
                onClick={() => {
                    if (node.type === 'file') onFileSelect(node.path);
                    if (node.type === 'folder') setIsExpanded(!isExpanded);
                }}
            >
                <div className="flex items-center gap-2 truncate">
                    {node.type === 'folder' && (
                        <span className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                           <ChevronDownIcon size={10} /> {/* Using ChevronRight logic roughly */}
                        </span>
                    )}
                    {node.type === 'folder' ? <FolderIcon size={14} className="text-blue-400" /> : <FileIcon size={14} className="text-gray-300" />}
                    <span className="text-xs truncate font-medium">{node.name}</span>
                    {hasChanged && <span className="w-2 h-2 bg-yellow-500 rounded-full ml-1 shadow-sm" title="Unsaved changes"></span>}
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {node.type === 'folder' && <>
                        <button onClick={(e) => { e.stopPropagation(); setIsCreating('file'); }} className="text-gray-500 hover:text-gray-200" title="New File"><FileAddIcon size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setIsCreating('folder'); }} className="text-gray-500 hover:text-gray-200" title="New Folder"><FolderAddIcon size={12} /></button>
                    </>}
                    <button onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }} className="text-gray-500 hover:text-gray-200" title="Rename"><EditIcon size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onFileDelete(node.path, node.type); }} className="text-gray-500 hover:text-red-400" title="Delete"><DeleteIcon size={12} /></button>
                </div>
            </div>
            
            {isCreating && renderInput('', handleCreateSubmit)}
            
            {node.type === 'folder' && isExpanded && (
                <div>
                    {children.map((child: TreeNode) => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            level={level + 1}
                            activeFilePath={activeFilePath}
                            onFileSelect={onFileSelect}
                            originalFiles={originalFiles}
                            editedFiles={editedFiles}
                            onFileAdd={onFileAdd}
                            onFileDelete={onFileDelete}
                            onFileRename={onFileRename}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface CodeViewerSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    files: UnpackedFile[];
    originalFiles: UnpackedFile[];
    functionName: string;
    onFileContentChange: (fileName: string, newContent: string) => void;
    onDeploy: () => void;
    isDeploying: boolean;
    hasUnsavedChanges: boolean;
    onFileAdd: (path: string) => void;
    onFileDelete: (path: string, type: 'file' | 'folder') => void;
    onFileRename: (oldPath: string, newPath: string, type: 'file' | 'folder') => void;
}

export const CodeViewerSidebar: React.FC<CodeViewerSidebarProps> = ({ 
    isOpen, onClose, files, originalFiles, functionName, onFileContentChange, onDeploy, isDeploying, hasUnsavedChanges, onFileAdd, onFileDelete, onFileRename
}) => {
    const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
    const [copyStatus, setCopyStatus] = useState<string | null>(null);

    // Refs for synchronized scrolling
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (originalFiles.length > 0) {
            const firstFile = originalFiles.find(f => f.name.endsWith('.js') || f.name.endsWith('.ts')) || originalFiles[0];
            setActiveFilePath(firstFile.name);
        } else {
            setActiveFilePath(null);
        }
    }, [originalFiles, functionName]);

    const activeFile = useMemo(() => files.find(f => f.name === activeFilePath), [files, activeFilePath]);
    const rootNode = buildFileTree(files);

    // Calculate line numbers
    const lineCount = useMemo(() => {
        if (!activeFile?.content) return 1;
        return activeFile.content.split('\n').length;
    }, [activeFile?.content]);

    // Synchronize scrolling
    const handleScroll = () => {
        if (lineNumbersRef.current && textAreaRef.current) {
            lineNumbersRef.current.scrollTop = textAreaRef.current.scrollTop;
        }
    };

    const handleCopy = () => {
        if (!activeFile) return;
        navigator.clipboard.writeText(activeFile.content).then(() => {
            setCopyStatus('Copied');
            setTimeout(() => setCopyStatus(null), 2000);
        });
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black/60 z-30 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
            <aside className={`fixed top-6 bottom-6 right-6 z-40 bg-gray-900/95 backdrop-blur-xl shadow-2xl flex flex-col border border-gray-800 w-full max-w-5xl transform transition-transform duration-300 ease-in-out rounded-2xl overflow-hidden ${isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'}`}>
                
                {/* Toolbar */}
                <div className="h-14 px-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-900/20 p-2 rounded-lg text-purple-400"><CodeIcon /></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-200 leading-none">{functionName}</h2>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Workspace</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onDeploy} disabled={!hasUnsavedChanges || isDeploying || files.length === 0} className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed">
                            {isDeploying ? <LoadingSpinnerIcon /> : 'Deploy Changes'}
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-white rounded hover:bg-gray-800 transition-colors"><CloseIcon /></button>
                    </div>
                </div>
                
                <div className="flex flex-1 min-h-0">
                    {/* Sidebar */}
                    <div className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
                        <div className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Explorer</div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {rootNode.children && Object.keys(rootNode.children).length > 0 ? (
                                <FileTreeItem
                                    node={rootNode} level={0} activeFilePath={activeFilePath} onFileSelect={setActiveFilePath}
                                    originalFiles={originalFiles} editedFiles={files}
                                    onFileAdd={onFileAdd} onFileDelete={onFileDelete} onFileRename={onFileRename}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
                                    <span className="text-xs">Empty Workspace</span>
                                    <button onClick={() => onFileAdd('index.js')} className="text-xs text-purple-400 hover:underline">Create File</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editor */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
                        {activeFile ? (
                            <>
                                <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-b border-gray-800">
                                    <span className="text-xs text-gray-400 font-mono">{activeFile.name}</span>
                                    <button onClick={handleCopy} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                                        {copyStatus === 'Copied' ? <CheckIcon /> : <CopyIcon />} {copyStatus || 'Copy'}
                                    </button>
                                </div>
                                <div className="relative flex-1 flex min-h-0 overflow-hidden">
                                    {/* Line Numbers */}
                                    <div
                                        ref={lineNumbersRef}
                                        className="hidden sm:block flex-shrink-0 w-12 text-right text-gray-600 font-mono text-sm leading-6 pt-4 pb-4 pr-3 bg-[#0d1117] select-none overflow-hidden border-r border-gray-800/50 whitespace-pre"
                                        aria-hidden="true"
                                    >
                                         {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
                                    </div>

                                    <textarea
                                        ref={textAreaRef}
                                        onScroll={handleScroll}
                                        value={activeFile.content}
                                        onChange={(e) => onFileContentChange(activeFile.name, e.target.value)}
                                        className="flex-1 w-full h-full p-4 pl-3 bg-[#0d1117] text-gray-300 font-mono text-sm resize-none focus:outline-none leading-6 custom-scrollbar whitespace-pre"
                                        spellCheck="false"
                                        style={{ tabSize: 2 }}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-600">
                                <div className="text-center">
                                    <CodeIcon size={48} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Select a file to edit</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};
