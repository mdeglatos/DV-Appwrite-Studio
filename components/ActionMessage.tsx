import React, { useState } from 'react';
import type { ActionMessage } from '../types';
import { LoadingSpinnerIcon, ToolsIcon, ChevronDownIcon, CheckIcon } from './Icons';

const JsonViewer = ({ data, error = false }: { data: any, error?: boolean }) => {
    let content;
    try { content = JSON.stringify(data, null, 2); } catch (e) { content = String(data); }
    return (
        <pre className={`text-[10px] md:text-xs p-3 rounded-md overflow-x-auto font-mono leading-relaxed border ${error ? 'bg-red-950/30 border-red-900 text-red-200' : 'bg-black/30 border-gray-700 text-gray-300'}`}>
            <code>{content}</code>
        </pre>
    );
};

export const ActionMessageComponent: React.FC<{ message: ActionMessage }> = ({ message }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { toolCalls, toolResults, isLoading } = message;
    
    const singleToolName = toolCalls.length === 1 ? toolCalls[0].name : null;
    const title = singleToolName ? `Executed: ${singleToolName}` : `Executed ${toolCalls.length} Actions`;

    return (
        <div className="flex justify-center my-6 w-full animate-fade-in">
            <div className={`w-full max-w-2xl overflow-hidden border rounded-lg transition-all duration-300 ${isExpanded ? 'bg-gray-900/80 border-gray-700 shadow-lg' : 'bg-transparent border-gray-800/50 hover:border-gray-700'}`}>
                <button 
                    className="w-full flex items-center justify-between p-3 px-4 text-left transition-colors group"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-md ${isLoading ? 'bg-cyan-900/20 text-cyan-400' : 'bg-gray-800 text-gray-400 group-hover:text-gray-300'}`}>
                            {isLoading ? <LoadingSpinnerIcon /> : <ToolsIcon size={16} />}
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-sm font-medium ${isLoading ? 'text-cyan-300' : 'text-gray-400 group-hover:text-gray-200'}`}>{title}</span>
                            {isLoading && <span className="text-[10px] text-cyan-500/80 uppercase tracking-wider font-semibold">Processing...</span>}
                        </div>
                    </div>
                    <div className={`text-gray-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDownIcon size={16} />
                    </div>
                </button>
                
                {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-800/50 pt-3 bg-black/20">
                        {toolCalls.map((call, index) => {
                            const result = !isLoading && toolResults ? toolResults[index]?.functionResponse?.response : null;
                            const hasError = !!(result && typeof result === 'object' && result !== null && 'error' in result);
                            const isSuccess = !isLoading && !hasError;

                            return (
                                <div key={index} className="relative pl-3 border-l-2 border-gray-700 hover:border-gray-500 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-xs font-bold text-purple-300">{call.name}()</span>
                                        {isSuccess && <span className="text-green-500"><CheckIcon size={12}/></span>}
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1">Input</span>
                                            <JsonViewer data={call.args} />
                                        </div>

                                        {!isLoading && result !== null && (
                                            <div>
                                                <span className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${hasError ? 'text-red-400' : 'text-gray-500'}`}>
                                                    {hasError ? 'Error' : 'Output'}
                                                </span>
                                                <JsonViewer data={result} error={hasError} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};