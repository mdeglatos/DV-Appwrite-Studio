
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { AppwriteProject } from '../types';
import { getSdkFunctions, ID } from '../services/appwrite';
import { deployCodeFromString } from '../tools/functionsTools';
import { LoadingSpinnerIcon, CodeIcon, FolderIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';

interface CreateFunctionModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: AppwriteProject;
    onSuccess: (functionId: string) => void;
}

export const CreateFunctionModal: React.FC<CreateFunctionModalProps> = ({ isOpen, onClose, project, onSuccess }) => {
    // Basic Config
    const [name, setName] = useState('');
    const [functionId, setFunctionId] = useState('unique()');
    const [runtime, setRuntime] = useState('node-18.0');
    const [runtimes, setRuntimes] = useState<{ $id: string; name: string }[]>([]);
    const [template, setTemplate] = useState<'simple' | 'structured'>('simple');
    
    // Advanced Config
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [_execute, setExecute] = useState<string[]>([]); // Default empty (admins only) usually, or 'any'
    const [executeInput, setExecuteInput] = useState('');
    const [_events, setEvents] = useState<string[]>([]);
    const [eventsInput, setEventsInput] = useState('');
    const [schedule, setSchedule] = useState('');
    const [timeout, setTimeout] = useState(15);
    const [enabled, setEnabled] = useState(true);
    const [logging, setLogging] = useState(true);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const fetchRuntimes = async () => {
                try {
                    const functions = getSdkFunctions(project);
                    const runtimeList = await functions.listRuntimes();
                    setRuntimes(runtimeList.runtimes);
                    if (runtimeList.runtimes.length > 0) {
                        // Prefer node-18.0 or node-20.0 if available
                        const preferred = runtimeList.runtimes.find(r => r.$id.includes('node-18'));
                        const fallback = runtimeList.runtimes.find(r => r.$id.includes('node'));
                        if (preferred) setRuntime(preferred.$id);
                        else if (fallback) setRuntime(fallback.$id);
                        else setRuntime(runtimeList.runtimes[0].$id);
                    }
                } catch (e) {
                    console.error("Failed to fetch runtimes", e);
                }
            };
            fetchRuntimes();
            
            // Reset state
            setName('');
            setFunctionId('unique()');
            setTemplate('simple');
            setShowAdvanced(false);
            setExecute([]);
            setExecuteInput('');
            setEvents([]);
            setEventsInput('');
            setSchedule('');
            setTimeout(15);
            setEnabled(true);
            setLogging(true);
            setError(null);
        }
    }, [isOpen, project]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            setError("Function name is required");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const functions = getSdkFunctions(project);
            const finalId = functionId === 'unique()' ? ID.unique() : functionId;
            
            // Parse array inputs
            const finalExecute = executeInput.split(',').map(s => s.trim()).filter(Boolean);
            const finalEvents = eventsInput.split(',').map(s => s.trim()).filter(Boolean);

            // 1. Create Function with all parameters
            const createdFunc = await functions.create(
                finalId,
                name,
                runtime as any,
                finalExecute.length > 0 ? finalExecute : undefined,
                finalEvents.length > 0 ? finalEvents : undefined,
                schedule || undefined,
                timeout,
                enabled,
                logging
            );

            // 2. Prepare Code
            const files = [];
            const packageJson = {
                name: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                version: "1.0.0",
                description: "Created with DV Backend Studio",
                main: template === 'simple' ? "index.js" : "src/main.js",
                type: "module",
                dependencies: {
                    "node-appwrite": "^14.0.0"
                },
                devDependencies: {}
            };

            files.push({
                name: 'package.json',
                content: JSON.stringify(packageJson, null, 2)
            });

            const indexContent = `
import { Client } from 'node-appwrite';

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }) => {
  // You can log messages to the console
  log('Hello, World!');

  // If this is a GET request, return a simple string
  if (req.method === 'GET') {
    return res.send('Hello World from Appwrite!');
  }

  // Otherwise return JSON
  return res.json({
    motto: 'Build like a team of hundreds_',
    learn: 'https://appwrite.io/docs',
    connect: 'https://appwrite.io/discord',
    getInspired: 'https://builtwith.appwrite.io',
    path: req.path,
    method: req.method,
  });
};
`;
            if (template === 'simple') {
                files.push({ name: 'index.js', content: indexContent });
            } else {
                files.push({ name: 'src/main.js', content: indexContent });
            }

            // 3. Deploy Code
            // We use 'npm install' as the build command for node runtimes
            const buildCommand = runtime.includes('node') ? 'npm install' : '';
            
            await deployCodeFromString(
                project,
                createdFunc.$id,
                files,
                true, // activate
                template === 'simple' ? 'index.js' : 'src/main.js',
                buildCommand
            );

            onSuccess(createdFunc.$id);
            onClose();

        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Function">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Basic Configuration */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Function Name</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                            placeholder="My Function"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Function ID</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={functionId} 
                                    onChange={e => setFunctionId(e.target.value)} 
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 font-mono focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    placeholder="unique()"
                                />
                                {functionId !== 'unique()' && (
                                    <button type="button" onClick={() => setFunctionId('unique()')} className="absolute right-2 top-2 text-[10px] bg-gray-700 px-2 py-0.5 rounded text-gray-300 hover:text-white">Reset</button>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Runtime</label>
                            <select 
                                value={runtime} 
                                onChange={e => setRuntime(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none"
                            >
                                {runtimes.length > 0 ? (
                                    runtimes.map(r => <option key={r.$id} value={r.$id}>{r.name} ({r.$id})</option>)
                                ) : (
                                    <option value="node-18.0">Node.js 18.0</option>
                                )}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Advanced Toggle */}
                <div className="border-t border-gray-700 pt-4">
                    <button 
                        type="button" 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-wider"
                    >
                        {showAdvanced ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                        Advanced Configuration
                    </button>

                    {showAdvanced && (
                        <div className="mt-4 space-y-4 animate-fade-in bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Execute Access</label>
                                <input 
                                    type="text" 
                                    value={executeInput} 
                                    onChange={e => setExecuteInput(e.target.value)} 
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none"
                                    placeholder='e.g., "any", "users", "user:123" (Comma separated)'
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Leave empty for admins only.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Events (Triggers)</label>
                                <input 
                                    type="text" 
                                    value={eventsInput} 
                                    onChange={e => setEventsInput(e.target.value)} 
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none"
                                    placeholder='e.g., "databases.*.collections.*.documents.*.create"'
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Schedule (CRON)</label>
                                    <input 
                                        type="text" 
                                        value={schedule} 
                                        onChange={e => setSchedule(e.target.value)} 
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                                        placeholder='e.g., "0 0 * * *"'
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Timeout (Seconds)</label>
                                    <input 
                                        type="number" 
                                        value={timeout} 
                                        onChange={e => setTimeout(Number(e.target.value))} 
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-1 focus:ring-cyan-500 outline-none"
                                        min={1}
                                        max={900}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded bg-gray-800 border-gray-600 text-cyan-600 focus:ring-cyan-500" />
                                    <span className="text-sm text-gray-300">Enabled</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={logging} onChange={e => setLogging(e.target.checked)} className="rounded bg-gray-800 border-gray-600 text-cyan-600 focus:ring-cyan-500" />
                                    <span className="text-sm text-gray-300">Logging</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Code Template</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div 
                            className={`cursor-pointer border rounded-xl p-3 flex flex-col gap-2 transition-all ${template === 'simple' ? 'bg-cyan-900/20 border-cyan-500/50 ring-1 ring-cyan-500/20' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'}`}
                            onClick={() => setTemplate('simple')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-1.5 rounded-lg bg-gray-800 text-purple-400"><CodeIcon /></div>
                                {template === 'simple' && <CheckIcon className="text-cyan-400" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-200">Basic</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Single index.js file</p>
                            </div>
                        </div>

                        <div 
                            className={`cursor-pointer border rounded-xl p-3 flex flex-col gap-2 transition-all ${template === 'structured' ? 'bg-cyan-900/20 border-cyan-500/50 ring-1 ring-cyan-500/20' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'}`}
                            onClick={() => setTemplate('structured')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-1.5 rounded-lg bg-gray-800 text-blue-400"><FolderIcon /></div>
                                {template === 'structured' && <CheckIcon className="text-cyan-400" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-200">Structured</h4>
                                <p className="text-xs text-gray-500 mt-0.5">src/main.js folder</p>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-xs text-red-200">
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-sm font-semibold rounded-lg shadow-lg shadow-cyan-900/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? <LoadingSpinnerIcon /> : 'Create Function'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
