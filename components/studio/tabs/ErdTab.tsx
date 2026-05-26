import React, { useState, useMemo, useEffect } from 'react';
import type { AppwriteProject, Database, Collection } from '../../../types';
import { parseCollectionsToErd, ErdNode, ErdEdge } from '../../../services/databaseToolsService';
import { ErdIcon, DatabaseIcon, InfoIcon, VerifiedIcon, LoadingSpinnerIcon } from '../../Icons';
import { useToast } from '../../../hooks/useToast';

interface ErdTabProps {
    activeProject: AppwriteProject;
    databases: Database[];
}

export const ErdTab: React.FC<ErdTabProps> = ({ activeProject, databases }) => {
    const toast = useToast();
    const [selectedDbId, setSelectedDbId] = useState<string>('');
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [collectionsLoading, setCollectionsLoading] = useState(false);

    // Filter databases to set initial selection
    useEffect(() => {
        if (databases.length > 0 && !selectedDbId) {
            setSelectedDbId(databases[0].$id);
        }
    }, [databases]);

    // Fetch collections dynamically
    useEffect(() => {
        if (!selectedDbId) return;
        const fetchCollections = async () => {
            setCollectionsLoading(true);
            try {
                const sdk = (await import('../../../services/appwrite')).getSdkDatabases(activeProject);
                const res = await sdk.listCollections(selectedDbId);
                setCollections(res.collections as any[] || []);
            } catch (e: any) {
                toast.error(`Could not fetch collections for ERD: ${e.message}`);
            } finally {
                setCollectionsLoading(false);
            }
        };
        fetchCollections();
    }, [selectedDbId, activeProject]);

    const activeDbName = useMemo(() => {
        return databases.find(d => d.$id === selectedDbId)?.name || 'Select Database';
    }, [databases, selectedDbId]);

    // Parse collections for active database into nodes and edges
    const { nodes, edges } = useMemo(() => {
        return parseCollectionsToErd(collections);
    }, [collections]);

    // Determine highlighting state
    const highlightedNodeIds = useMemo(() => {
        if (!hoveredNodeId) return new Set<string>();
        const set = new Set<string>([hoveredNodeId]);
        
        // Find all nodes connected to hovered node
        edges.forEach(edge => {
            if (edge.source === hoveredNodeId) set.add(edge.target);
            if (edge.target === hoveredNodeId) set.add(edge.source);
        });
        
        return set;
    }, [edges, hoveredNodeId]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <ErdIcon size={24} className="text-cyan-400" />
                        Entity-Relationship Visualizer (ERD)
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Interactive schema map analyzing data attributes and structural collection relationships.</p>
                </div>
                
                {/* Database Selector */}
                <div className="flex items-center gap-3 bg-gray-900/60 p-1.5 rounded-xl border border-white/5">
                    <DatabaseIcon size={14} className="text-cyan-400 ml-2" />
                    <select
                        className="bg-transparent border-0 text-xs font-semibold text-gray-200 outline-none pr-8 cursor-pointer focus:ring-0"
                        value={selectedDbId}
                        onChange={e => {
                            setSelectedDbId(e.target.value);
                            setSelectedNodeId(null);
                        }}
                    >
                        {databases.length === 0 ? (
                            <option value="">No Databases Found</option>
                        ) : (
                            databases.map(db => (
                                <option key={db.$id} value={db.$id} className="bg-gray-950 text-gray-200">
                                    {db.name}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            {databases.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/20 border border-white/5 rounded-2xl">
                    <ErdIcon size={40} className="text-gray-600 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-gray-400">No Databases Available</div>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1">Create a database first to visualize its schemas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Visual diagram view */}
                    <div className="lg:col-span-3 bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md min-h-[500px] flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-bold text-gray-200 uppercase tracking-widest flex items-center gap-1.5">
                                <DatabaseIcon size={14} className="text-cyan-400" />
                                {activeDbName} Schema Map
                            </h2>
                            <span className="text-[10px] text-gray-500 font-medium">Hover over cards to trace relationships</span>
                        </div>

                        {collectionsLoading ? (
                            <div className="flex-1 flex flex-col justify-center items-center py-20 text-gray-500 text-xs">
                                <LoadingSpinnerIcon size={32} className="text-cyan-400 animate-spin mb-2" />
                                <span>Analyzing collection relationship schemas...</span>
                            </div>
                        ) : nodes.length === 0 ? (
                            <div className="flex-1 flex flex-col justify-center items-center py-20 text-gray-500 text-xs">
                                <ErdIcon size={32} className="text-gray-600 mb-2" />
                                <span>No collections found in this database.</span>
                            </div>
                        ) : (
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
                                {nodes.map(node => {
                                    const isHovered = hoveredNodeId === node.id;
                                    const isSelected = selectedNodeId === node.id;
                                    const isHighlighted = highlightedNodeIds.has(node.id);
                                    
                                    // Count active relationship edges for this node
                                    const nodeEdges = edges.filter(e => e.source === node.id || e.target === node.id);

                                    return (
                                        <div
                                            key={node.id}
                                            onMouseEnter={() => setHoveredNodeId(node.id)}
                                            onMouseLeave={() => setHoveredNodeId(null)}
                                            onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                                            className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-cyan-500/10 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)] text-cyan-400' 
                                                    : isHovered 
                                                        ? 'bg-gray-950/60 border-cyan-500/50 text-cyan-300' 
                                                        : isHighlighted 
                                                            ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-200' 
                                                            : 'bg-gray-950/40 border-white/5 text-gray-300 hover:border-gray-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                                                <div>
                                                    <span className="text-xs font-bold font-mono tracking-wide">{node.name}</span>
                                                    <div className="text-[9px] text-gray-500 font-mono mt-0.5">{node.collectionId}</div>
                                                </div>
                                                <span className="text-[9px] font-semibold bg-gray-900 border border-white/5 text-gray-500 px-2 py-0.5 rounded-full">
                                                    {node.attributes.length} fields
                                                </span>
                                            </div>

                                            {/* Attributes listing */}
                                            <div className="space-y-1.5">
                                                {node.attributes.map(attr => (
                                                    <div key={attr.key} className="flex items-center justify-between text-[11px] font-mono">
                                                        <span className="text-gray-300 font-medium">
                                                            {attr.key} {attr.required && <span className="text-cyan-500" title="Required">*</span>}
                                                        </span>
                                                        <span className="text-gray-500 text-[10px]">
                                                            {attr.type}{attr.array ? '[]' : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {nodeEdges.length > 0 && (
                                                <div className="mt-3.5 pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-500">
                                                    <span>Relationships</span>
                                                    <span className="font-semibold bg-cyan-950/30 text-cyan-400 px-1.5 py-0.5 rounded-md border border-cyan-900/30">
                                                        {nodeEdges.length} active
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Sidebar detail inspector */}
                    <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md flex flex-col min-h-[500px]">
                        <h2 className="text-xs font-bold text-gray-200 uppercase tracking-widest mb-4">Relational Inspector</h2>
                        
                        {selectedNodeId ? (
                            (() => {
                                const selectedNode = nodes.find(n => n.id === selectedNodeId);
                                if (!selectedNode) return null;
                                
                                const nodeEdges = edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);

                                return (
                                    <div className="flex-1 flex flex-col justify-between space-y-4">
                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-xs font-bold text-gray-300">Selected Collection</div>
                                                <div className="text-cyan-400 font-bold font-mono text-sm mt-0.5">{selectedNode.name}</div>
                                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {selectedNode.collectionId}</div>
                                            </div>

                                            {nodeEdges.length > 0 ? (
                                                <div className="space-y-3.5">
                                                    <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Relationship Connections</div>
                                                    <div className="space-y-2">
                                                        {nodeEdges.map(edge => {
                                                            const isSource = edge.source === selectedNodeId;
                                                            const partnerNodeId = isSource ? edge.target : edge.source;
                                                            const partnerName = nodes.find(n => n.id === partnerNodeId)?.name || 'Unknown';
                                                            const relationDesc = edge.relationType.replace(/([A-Z])/g, ' $1');

                                                            return (
                                                                <div key={edge.id} className="bg-gray-950/50 border border-white/5 rounded-xl p-3 text-xs space-y-1">
                                                                    <div className="flex items-center justify-between font-bold text-gray-300">
                                                                        <span className="capitalize">{relationDesc}</span>
                                                                        <span className="text-[10px] uppercase bg-cyan-900/20 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/30">
                                                                            {isSource ? 'Owner' : 'Inverse'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[11px] text-gray-400 mt-1">
                                                                        Connects <span className="font-mono text-cyan-400 font-semibold">{selectedNode.name}</span> ({edge.sourceKey || 'id'}) to <span className="font-mono text-cyan-400 font-semibold">{partnerName}</span> ({edge.targetKey || 'id'})
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-500 italic py-4">No active relational links are registered for this collection schema.</div>
                                            )}
                                        </div>
                                        
                                        <button
                                            onClick={() => setSelectedNodeId(null)}
                                            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl text-xs transition-colors"
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="flex-1 flex flex-col justify-center items-center text-center text-gray-500 text-xs gap-2">
                                <InfoIcon size={24} className="text-gray-600" />
                                <span>Select a collection card in the diagram to inspect its connection paths, triggers, and relation owners.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
